import { NextResponse } from "next/server";
import db from "@/lib/db";

// Mapea status numérico de Baileys a string legible
function baileyStatusToString(status: number | string): string {
  const n = Number(status);
  if (n === 1) return "sent";
  if (n === 2) return "sent";
  if (n === 3) return "delivered";
  if (n === 4) return "read";
  if (n === 5) return "read";
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "read" || s === "leído") return "read";
    if (s === "delivered" || s === "entregado") return "delivered";
  }
  return "sent";
}

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    console.log("[WH] payload:", JSON.stringify(payload).slice(0, 800));

    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      const eventName: string = (ev.event || ev.type || ev.eventType || "").toLowerCase();

      // ─── 1. ESTADO DE SESIÓN ────────────────────────────────────────────────
      const isSessionEvent =
        eventName.includes("connection") ||
        eventName.includes("session") ||
        eventName.includes("qr");

      if (isSessionEvent) {
        const conn = ev.data?.connection || ev.data?.status || ev.data?.state || "";
        if (conn) {
          const status = conn === "open" || conn === "connected" || conn === "ready"
            ? "ready"
            : conn === "close" || conn === "disconnected"
            ? "disconnected"
            : conn;
          try {
            db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('wa_session_status', ?)`)
              .run(status);
            console.log("[WH] session status:", status);
          } catch {}
        }
        continue;
      }

      // ─── 2. ACTUALIZACIÓN DE ESTADO DE MENSAJES (TICKS) ────────────────────
      const isUpdateEvent =
        eventName.includes("messages.update") ||
        eventName.includes("message.update") ||
        eventName.includes("receipt") ||
        eventName.includes("recibo");

      if (isUpdateEvent) {
        const updates = Array.isArray(ev.data) ? ev.data : [ev.data];
        for (const upd of updates) {
          if (!upd) continue;
          const msgId = upd.key?.id;
          const rawStatus = upd.update?.status ?? upd.status ?? upd.receipt?.readTimestamp ? 4 : undefined;
          if (msgId && rawStatus !== undefined) {
            const status = baileyStatusToString(rawStatus);
            try {
              db.prepare(`UPDATE mensajes_wa SET status = ? WHERE id = ?`).run(status, msgId);
              console.log("[WH] tick update:", msgId, "→", status);
            } catch {}
          }
        }
        continue;
      }

      // ─── 3. MENSAJES NUEVOS ────────────────────────────────────────────────
      // Aceptar cualquier evento que pueda contener un mensaje
      const isMessageEvent =
        eventName === "" ||                            // sin nombre → intentar igualmente
        eventName.includes("message") ||
        eventName.includes("mensaje") ||
        eventName.includes("upsert") ||
        eventName.includes("received") ||
        eventName.includes("recibid");

      if (!isMessageEvent) {
        console.log("[WH] evento ignorado:", eventName);
        continue;
      }

      // Extraer lista de mensajes — WaSenderAPI puede enviarlos de varias formas
      const raw = ev.data ?? ev.payload ?? ev;
      const msgList: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.messages)
        ? raw.messages
        : [raw];

      for (const msg of msgList) {
        if (!msg) continue;

        // Intentar extraer chatId de múltiples ubicaciones posibles
        const chatId: string =
          msg.key?.remoteJid ||
          msg.remoteJid ||
          msg.from ||
          msg.chatId ||
          msg.jid ||
          "";

        if (!chatId || chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) continue;
        if (!msg.key && !msg.id) continue; // no parece un mensaje

        const fromMe = !!(msg.key?.fromMe || msg.fromMe);
        const msgId: string =
          msg.key?.id ||
          msg.id ||
          msg.messageId ||
          `auto-${Date.now()}-${Math.random()}`;

        // Extraer texto de múltiples ubicaciones posibles
        let text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.text ||
          msg.body ||
          msg.content ||
          "";

        if (!text) {
          console.log("[WH] mensaje sin texto, id:", msgId);
          continue;
        }

        const phone = chatId.split("@")[0].split(":")[0];
        const name: string = msg.pushName || msg.notifyName || msg.senderName || phone;
        const ts = Number(msg.messageTimestamp || msg.timestamp || Math.floor(Date.now() / 1000));

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

          console.log("[WH] mensaje guardado:", phone, "→", text.slice(0, 60));
        } catch (dbErr: any) {
          console.error("[WH] DB error:", dbErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[WH] error parseando payload:", e.message, "| raw:", rawBody.slice(0, 300));
    return NextResponse.json({ ok: true }); // siempre 200 para que WaSenderAPI no retire el webhook
  }
}
