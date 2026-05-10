import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;
const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads", "wa-media");

// ── Helpers ────────────────────────────────────────────────────────────────────

function baileyStatusToString(status: number | string): string {
  const n = Number(status);
  if (n >= 4) return "read";
  if (n === 3) return "delivered";
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "read") return "read";
    if (s === "delivered") return "delivered";
  }
  return "sent";
}

function mimeToExt(mimetype: string): string {
  const base = (mimetype || "").split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif",
    "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
    "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/mp4": "m4a",
    "audio/aac": "aac", "audio/opus": "opus",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[base] || base.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "bin";
}

interface MediaInfo {
  mediaType: string;
  url: string;
  mediaKey: string;
  mimetype: string;
  fileEncSha256: string;
  fileName?: string;
  directUrl?: string; // URL directa si WaSenderAPI ya la provee descifrada
}

function toBase64Key(raw: any): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  // Buffer serializado como { type:"Buffer", data:[...] }
  if (raw?.type === "Buffer" && Array.isArray(raw.data)) {
    return Buffer.from(raw.data).toString("base64");
  }
  if (raw instanceof Uint8Array || Buffer.isBuffer(raw)) {
    return Buffer.from(raw).toString("base64");
  }
  return String(raw);
}

function extractMedia(msg: any): MediaInfo | null {
  // Soporte para dos formatos: msg.message.imageMessage (Baileys estándar)
  // o msg.imageMessage (algunos wrappers lo aplanan)
  const m = msg?.message ?? msg;

  const img = m?.imageMessage;
  if (img?.url) return {
    mediaType: "image",
    url: img.url,
    mediaKey: toBase64Key(img.mediaKey),
    mimetype: img.mimetype || "image/jpeg",
    fileEncSha256: toBase64Key(img.fileEncSha256 || img.fileSha256),
    directUrl: img.mediaUrl || img.directUrl || undefined,
  };

  const vid = m?.videoMessage;
  if (vid?.url) return {
    mediaType: "video",
    url: vid.url,
    mediaKey: toBase64Key(vid.mediaKey),
    mimetype: vid.mimetype || "video/mp4",
    fileEncSha256: toBase64Key(vid.fileEncSha256),
    directUrl: vid.mediaUrl || vid.directUrl || undefined,
  };

  const doc = m?.documentMessage;
  if (doc?.url) return {
    mediaType: "document",
    url: doc.url,
    mediaKey: toBase64Key(doc.mediaKey),
    mimetype: doc.mimetype || "application/octet-stream",
    fileEncSha256: toBase64Key(doc.fileEncSha256),
    fileName: doc.fileName,
    directUrl: doc.mediaUrl || doc.directUrl || undefined,
  };

  const audio = m?.audioMessage || m?.pttMessage;
  if (audio?.url) return {
    mediaType: "audio",
    url: audio.url,
    mediaKey: toBase64Key(audio.mediaKey),
    mimetype: audio.mimetype || "audio/ogg",
    fileEncSha256: toBase64Key(audio.fileEncSha256),
    directUrl: audio.mediaUrl || audio.directUrl || undefined,
  };

  return null;
}

function extractText(msg: any): string {
  const m = msg?.message;
  const plain = m?.conversation || m?.extendedTextMessage?.text ||
    msg?.messageBody || msg?.text || msg?.body;
  if (plain) return plain;
  if (m?.imageMessage)    return m.imageMessage.caption    ? `📷 ${m.imageMessage.caption}`    : "📷 Imagen";
  if (m?.videoMessage)    return m.videoMessage.caption    ? `🎥 ${m.videoMessage.caption}`    : "🎥 Video";
  if (m?.documentMessage) {
    const name = m.documentMessage.fileName || "Archivo";
    return m.documentMessage.caption ? `📎 ${name} — ${m.documentMessage.caption}` : `📎 ${name}`;
  }
  if (m?.audioMessage || m?.pttMessage) return "🎵 Audio";
  if (m?.stickerMessage)  return "🎭 Sticker";
  if (m?.locationMessage) return "📍 Ubicación";
  if (m?.contactMessage)  return `👤 Contacto: ${m.contactMessage.displayName || ""}`;
  return "";
}

function extractChatIdAndPhone(msg: any): { chatId: string; phone: string } {
  const rawJid: string = msg?.key?.remoteJid || msg?.remoteJid || msg?.from || msg?.chatId || "";
  if (rawJid.endsWith("@lid")) {
    const cleanPhone: string =
      msg?.key?.cleanedSenderPn || msg?.cleanedSenderPn ||
      (msg?.key?.senderPn || msg?.senderPn || "").split("@")[0] || "";
    if (cleanPhone) {
      const phone = cleanPhone.split(":")[0];
      return { chatId: `${phone}@s.whatsapp.net`, phone };
    }
  }
  const phone = rawJid.split("@")[0].split(":")[0];
  const chatId = rawJid.includes("@") ? `${phone}@s.whatsapp.net` : rawJid;
  return { chatId, phone };
}

// Descarga el media de WaSenderAPI y lo guarda en el volumen persistente
async function downloadAndStoreMedia(msgId: string, media: MediaInfo): Promise<void> {
  try {
    console.log("[WH] descargando media:", media.mediaType, "url[:60]:", media.url?.slice(0, 60), "hasKey:", !!media.mediaKey, "directUrl:", media.directUrl?.slice(0, 60) || "none");

    let downloadUrl: string | undefined = media.directUrl;

    // Si tenemos URL directa (ya descifrada), usarla sin llamar a decrypt-media
    if (!downloadUrl && media.mediaKey) {
      const decryptRes = await fetch("https://www.wasenderapi.com/api/decrypt-media", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WASENDER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: media.url,
          mediaKey: media.mediaKey,
          mimetype: media.mimetype,
          fileEncSha256: media.fileEncSha256,
        }),
      });

      const decryptText = await decryptRes.text();
      console.log("[WH] decrypt-media status:", decryptRes.status, "body:", decryptText.slice(0, 300));

      if (decryptRes.ok) {
        try {
          const d = JSON.parse(decryptText);
          // Intentar todos los campos posibles
          downloadUrl = d.publicUrl || d.url || d.downloadUrl || d.mediaUrl ||
            d.data?.url || d.data?.publicUrl || d.media?.url || d.result?.url;
          if (!downloadUrl) {
            console.error("[WH] decrypt-media: campos disponibles:", Object.keys(d).join(","));
          }
        } catch { console.error("[WH] decrypt-media: respuesta no es JSON"); }
      }
    }

    // Último fallback: intentar descargar la URL original directamente
    if (!downloadUrl && media.url) {
      console.log("[WH] fallback: intentando URL directa");
      downloadUrl = media.url;
    }

    if (!downloadUrl) { console.error("[WH] sin URL de descarga para:", msgId); return; }

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      console.error("[WH] descarga media falló:", fileRes.status, "url:", downloadUrl.slice(0, 80));
      return;
    }

    const ext = media.fileName
      ? (media.fileName.split(".").pop() || mimeToExt(media.mimetype))
      : mimeToExt(media.mimetype);
    const safeId = msgId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${safeId}.${ext}`;

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, fileName), Buffer.from(await fileRes.arrayBuffer()));

    const localUrl = `/api/file/wa-media/${fileName}`;
    db.prepare(`UPDATE mensajes_wa SET media_url = ? WHERE id = ?`).run(localUrl, msgId);
    console.log("[WH] ✅ media guardado:", localUrl);
  } catch (e: any) {
    console.error("[WH] downloadAndStoreMedia error:", e.message);
  }
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    console.log("[WH] raw:", JSON.stringify(payload).slice(0, 2000));

    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      const eventName = (ev.event || ev.type || ev.eventType || "").toLowerCase();
      console.log("[WH] event:", eventName || "(sin nombre)");

      // ─── ESTADO DE SESIÓN ────────────────────────────────────────────────
      if (eventName.includes("connection") || eventName.includes("session") || eventName.includes("qr")) {
        const conn = ev.data?.connection || ev.data?.status || ev.data?.state || "";
        const status = conn === "open" || conn === "connected" || conn === "ready" ? "ready"
          : conn === "close" || conn === "disconnected" ? "disconnected" : conn;
        if (status) {
          try { db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('wa_session_status', ?)`).run(status); } catch {}
          console.log("[WH] session →", status);
        }
        continue;
      }

      // ─── TICKS ──────────────────────────────────────────────────────────
      if (eventName.includes("update") || eventName.includes("receipt") || eventName.includes("recibo")) {
        const updates = Array.isArray(ev.data) ? ev.data : [ev.data];
        for (const upd of updates) {
          if (!upd) continue;
          const msgId = upd?.key?.id || upd?.id;
          const rawStatus = upd?.update?.status ?? upd?.status ?? (upd?.receipt?.readTimestamp ? 4 : undefined);
          if (!msgId || rawStatus === undefined) continue;
          const s = baileyStatusToString(rawStatus);

          const result = db.prepare(`
            UPDATE mensajes_wa SET status = ?
            WHERE id = ? AND (
              (status = 'sent') OR
              (status = 'delivered' AND ? = 'read') OR
              (status = '' OR status IS NULL)
            )
          `).run(s, msgId, s);

          if (result.changes === 0) {
            const remoteJid: string = upd?.key?.remoteJid || upd?.remoteJid || "";
            const phone = remoteJid.split("@")[0].split(":")[0];
            const chatId = phone ? `${phone}@s.whatsapp.net` : "";
            const ts = Number(upd?.messageTimestamp || Math.floor(Date.now() / 1000));
            if (chatId) {
              try {
                db.prepare(`INSERT OR IGNORE INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp) VALUES (?, ?, ?, 0, '', ?)`).run(chatId, phone, phone, ts);
                db.prepare(`INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status) VALUES (?, ?, 1, '', ?, ?)`).run(msgId, chatId, ts, s);
              } catch {}
            }
          }
          console.log("[WH] tick:", msgId, "→", s);
        }
        continue;
      }

      // ─── MENSAJES NUEVOS ────────────────────────────────────────────────
      const skipEvent = eventName.includes("delete") || eventName.includes("reaction") ||
        eventName.includes("group") || eventName.includes("presence") ||
        eventName.includes("contact");
      if (skipEvent) { console.log("[WH] skip:", eventName); continue; }

      const raw = ev.data ?? ev.payload ?? ev;
      let msgList: any[];
      if (Array.isArray(raw)) msgList = raw;
      else if (raw?.messages && !Array.isArray(raw.messages)) msgList = [raw.messages];
      else if (Array.isArray(raw?.messages)) msgList = raw.messages;
      else msgList = [raw];

      console.log("[WH] mensajes a procesar:", msgList.length);

      for (const msg of msgList) {
        if (!msg || typeof msg !== "object") continue;

        const { chatId, phone } = extractChatIdAndPhone(msg);
        if (!chatId || !phone) continue;
        if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast") || chatId.endsWith("@newsletter")) continue;

        const fromMe = !!(msg?.key?.fromMe ?? msg?.fromMe ?? false);
        const msgId: string =
          msg?.key?.id || msg?.id || msg?.messageId ||
          `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const text = extractText(msg);
        if (!text) { console.log("[WH] sin texto, keys:", Object.keys(msg).join(",")); continue; }

        const media = extractMedia(msg);
        if (media) {
          console.log("[WH] media detectado:", media.mediaType, "hasKey:", !!media.mediaKey, "directUrl:", !!media.directUrl, "url[:50]:", media.url?.slice(0, 50));
        } else {
          const msgKeys = Object.keys(msg?.message || msg || {}).join(",");
          console.log("[WH] sin media, claves message:", msgKeys);
        }
        const name: string = msg?.pushName || msg?.notifyName || phone;
        const ts = Number(msg?.messageTimestamp?.low ?? msg?.messageTimestamp ?? msg?.timestamp ?? Math.floor(Date.now() / 1000));

        try {
          // Dedup: si existe, actualizar ID al real (para que los ticks funcionen)
          const dupe = db.prepare(`
            SELECT id FROM mensajes_wa
            WHERE chat_id = ? AND from_me = ? AND text = ? AND ABS(timestamp - ?) <= 5
            LIMIT 1
          `).get(chatId, fromMe ? 1 : 0, text, ts) as { id: string } | undefined;

          if (dupe) {
            if (dupe.id !== msgId) {
              try { db.prepare(`UPDATE mensajes_wa SET id = ? WHERE id = ?`).run(msgId, dupe.id); } catch {}
              console.log("[WH] dedup: id actualizado", dupe.id, "→", msgId);
            }
            continue;
          }

          db.prepare(`
            INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              name = COALESCE(NULLIF(excluded.name, phone), chats_wa.name),
              unread = chats_wa.unread + excluded.unread,
              last_message = excluded.last_message,
              last_timestamp = excluded.last_timestamp
          `).run(chatId, name, phone, fromMe ? 0 : 1, text, ts);

          db.prepare(`
            INSERT INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status, media_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              text       = CASE WHEN mensajes_wa.text = '' THEN excluded.text ELSE mensajes_wa.text END,
              timestamp  = CASE WHEN mensajes_wa.timestamp = 0 THEN excluded.timestamp ELSE mensajes_wa.timestamp END,
              media_type = CASE WHEN mensajes_wa.media_type IS NULL THEN excluded.media_type ELSE mensajes_wa.media_type END
          `).run(msgId, chatId, fromMe ? 1 : 0, text, ts, fromMe ? "sent" : "received", media?.mediaType ?? null);

          console.log("[WH] ✅", phone, fromMe ? "→" : "←", text.slice(0, 60));

          // Descarga de media en background (no bloquea la respuesta al webhook)
          if (media) {
            downloadAndStoreMedia(msgId, media).catch(() => {});
          }
        } catch (dbErr: any) {
          console.error("[WH] DB error:", dbErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[WH] error:", e.message, "raw:", rawBody.slice(0, 300));
    return NextResponse.json({ ok: true });
  }
}
