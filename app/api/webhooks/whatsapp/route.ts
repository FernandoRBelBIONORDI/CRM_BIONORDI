import { NextResponse } from "next/server";
import db from "@/lib/db";

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

function extractText(msg: any): string {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    msg?.message?.documentMessage?.caption ||
    msg?.messageBody ||
    msg?.text ||
    msg?.body ||
    ""
  );
}

function extractChatIdAndPhone(msg: any): { chatId: string; phone: string } {
  const rawJid: string =
    msg?.key?.remoteJid || msg?.remoteJid || msg?.from || msg?.chatId || "";

  if (rawJid.endsWith("@lid")) {
    const cleanPhone: string =
      msg?.key?.cleanedSenderPn ||
      msg?.cleanedSenderPn ||
      (msg?.key?.senderPn || msg?.senderPn || "").split("@")[0] ||
      "";
    if (cleanPhone) {
      const phone = cleanPhone.split(":")[0];
      return { chatId: `${phone}@s.whatsapp.net`, phone };
    }
  }

  const phone = rawJid.split("@")[0].split(":")[0];
  const chatId = rawJid.includes("@") ? `${phone}@s.whatsapp.net` : rawJid;
  return { chatId, phone };
}

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    console.log("[WH] raw:", JSON.stringify(payload).slice(0, 800));

    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      const eventName = (ev.event || ev.type || ev.eventType || "").toLowerCase();
      console.log("[WH] event:", eventName || "(sin nombre)");

      // ─── ESTADO DE SESIÓN ──────────────────────────────────────────────────
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

      // ─── TICKS ────────────────────────────────────────────────────────────
      if (eventName.includes("update") || eventName.includes("receipt") || eventName.includes("recibo")) {
        const updates = Array.isArray(ev.data) ? ev.data : [ev.data];
        for (const upd of updates) {
          if (!upd) continue;
          const msgId = upd?.key?.id || upd?.id;
          const rawStatus = upd?.update?.status ?? upd?.status ?? (upd?.receipt?.readTimestamp ? 4 : undefined);
          if (!msgId || rawStatus === undefined) continue;

          const s = baileyStatusToString(rawStatus);

          // Intentar actualizar si ya existe
          const result = db.prepare(`UPDATE mensajes_wa SET status = ? WHERE id = ?`).run(s, msgId);

          // Si no existía aún (race condition: tick llegó antes que upsert),
          // guardar placeholder con el status correcto. El upsert posterior
          // rellenará el texto sin sobreescribir el status.
          if (result.changes === 0) {
            const remoteJid: string = upd?.key?.remoteJid || upd?.remoteJid || "";
            const phone = remoteJid.split("@")[0].split(":")[0];
            const chatId = phone ? `${phone}@s.whatsapp.net` : "";
            const ts = Number(upd?.messageTimestamp || Math.floor(Date.now() / 1000));
            if (chatId) {
              try {
                // Asegurar que el chat exista
                db.prepare(`INSERT OR IGNORE INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp) VALUES (?, ?, ?, 0, '', ?)`).run(chatId, phone, phone, ts);
                // Insertar placeholder — el upsert posterior llenará el texto
                db.prepare(`INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status) VALUES (?, ?, 1, '', ?, ?)`).run(msgId, chatId, ts, s);
              } catch {}
            }
          }

          console.log("[WH] tick:", msgId, "→", s);
        }
        continue;
      }

      // ─── MENSAJES NUEVOS ───────────────────────────────────────────────────
      const skipEvent = eventName.includes("delete") || eventName.includes("reaction") ||
        eventName.includes("group") || eventName.includes("presence") ||
        eventName.includes("contact");
      if (skipEvent) { console.log("[WH] skip:", eventName); continue; }

      const raw = ev.data ?? ev.payload ?? ev;
      let msgList: any[];
      if (Array.isArray(raw)) {
        msgList = raw;
      } else if (raw?.messages && !Array.isArray(raw.messages)) {
        msgList = [raw.messages];
      } else if (Array.isArray(raw?.messages)) {
        msgList = raw.messages;
      } else {
        msgList = [raw];
      }

      console.log("[WH] mensajes a procesar:", msgList.length);

      for (const msg of msgList) {
        if (!msg || typeof msg !== "object") continue;

        const { chatId, phone } = extractChatIdAndPhone(msg);
        console.log("[WH] chatId:", chatId, "phone:", phone);
        if (!chatId || !phone) continue;
        if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast") || chatId.endsWith("@newsletter")) continue;

        const fromMe = !!(msg?.key?.fromMe ?? msg?.fromMe ?? false);
        const msgId: string =
          msg?.key?.id || msg?.id || msg?.messageId ||
          `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const text = extractText(msg);
        if (!text) {
          console.log("[WH] sin texto, keys:", Object.keys(msg).join(","));
          continue;
        }

        const name: string = msg?.pushName || msg?.notifyName || phone;
        const ts = Number(msg?.messageTimestamp?.low ?? msg?.messageTimestamp ?? msg?.timestamp ?? Math.floor(Date.now() / 1000));

        try {
          db.prepare(`
            INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              name = COALESCE(NULLIF(excluded.name, phone), chats_wa.name),
              unread = chats_wa.unread + excluded.unread,
              last_message = excluded.last_message,
              last_timestamp = excluded.last_timestamp
          `).run(chatId, name, phone, fromMe ? 0 : 1, text, ts);

          // ON CONFLICT: rellenar texto si estaba vacío (placeholder de tick),
          // NO sobreescribir el status si ya fue actualizado por un tick.
          db.prepare(`
            INSERT INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              text      = CASE WHEN mensajes_wa.text = '' THEN excluded.text ELSE mensajes_wa.text END,
              timestamp = CASE WHEN mensajes_wa.timestamp = 0 THEN excluded.timestamp ELSE mensajes_wa.timestamp END
          `).run(msgId, chatId, fromMe ? 1 : 0, text, ts, fromMe ? "sent" : "received");

          console.log("[WH] ✅", phone, fromMe ? "→" : "←", text.slice(0, 60));
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
