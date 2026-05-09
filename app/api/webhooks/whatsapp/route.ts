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
    msg?.messageBody ||   // WaSenderAPI lo incluye a nivel raíz
    msg?.text ||
    msg?.body ||
    ""
  );
}

/**
 * WaSenderAPI usa el nuevo formato LID de WhatsApp.
 * remoteJid puede ser "XXXXXX@lid" en vez de "PHONE@s.whatsapp.net".
 * En ese caso, el número real está en key.senderPn o key.cleanedSenderPn.
 */
function extractChatIdAndPhone(msg: any): { chatId: string; phone: string } {
  const rawJid: string =
    msg?.key?.remoteJid ||
    msg?.remoteJid ||
    msg?.from ||
    msg?.chatId ||
    "";

  // Si el JID es LID, buscar el número real en senderPn / cleanedSenderPn
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

  // Siempre normalizar a phone@s.whatsapp.net para consistencia
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
          : conn === "close" || conn === "disconnected" ? "disconnected"
          : conn;
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
          if (msgId && rawStatus !== undefined) {
            const s = baileyStatusToString(rawStatus);
            try { db.prepare(`UPDATE mensajes_wa SET status = ? WHERE id = ?`).run(s, msgId); } catch {}
            console.log("[WH] tick:", msgId, "→", s);
          }
        }
        continue;
      }

      // ─── MENSAJES NUEVOS ───────────────────────────────────────────────────
      const skipEvent = eventName.includes("delete") || eventName.includes("reaction") ||
        eventName.includes("group") || eventName.includes("presence") ||
        eventName.includes("contact");
      if (skipEvent) { console.log("[WH] skip:", eventName); continue; }

      // Extraer lista de mensajes
      // WaSenderAPI envía ev.data.messages como OBJETO (un solo mensaje), no array
      const raw = ev.data ?? ev.payload ?? ev;

      let msgList: any[];
      if (Array.isArray(raw)) {
        msgList = raw;
      } else if (raw?.messages && !Array.isArray(raw.messages)) {
        // objeto único dentro de data.messages
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
          msg?.key?.id ||
          msg?.id ||
          msg?.messageId ||
          `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const text = extractText(msg);
        if (!text) {
          console.log("[WH] sin texto, keys:", Object.keys(msg).join(","));
          continue;
        }

        const name: string = msg?.pushName || msg?.notifyName || phone;
        const ts = Number(msg?.messageTimestamp || msg?.timestamp || Math.floor(Date.now() / 1000));

        try {
          db.prepare(`
            INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              name = COALESCE(excluded.name, chats_wa.name),
              unread = chats_wa.unread + excluded.unread,
              last_message = excluded.last_message,
              last_timestamp = excluded.last_timestamp
          `).run(chatId, name, phone, fromMe ? 0 : 1, text, ts);

          db.prepare(`
            INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?)
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
