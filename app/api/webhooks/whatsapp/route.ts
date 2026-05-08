import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Webhook WhatsApp recibido:", JSON.stringify(payload, null, 2));

    // WaSenderAPI envia un array de eventos o un solo evento
    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      if (ev.event === "message.received" || ev.event === "message.upsert") {
        const msg = ev.data;
        if (!msg || !msg.key) continue;

        const chatId = msg.key.remoteJid;
        const fromMe = msg.key.fromMe ? 1 : 0;
        const msgId = msg.key.id;
        
        let text = "";
        if (msg.message?.conversation) text = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;

        if (!text) continue; // Ignorar si no hay texto por ahora

        const phone = chatId.split("@")[0];
        const name = msg.pushName || phone;
        const ts = msg.messageTimestamp || Math.floor(Date.now() / 1000);

        // Actualizar/Crear el chat
        db.prepare(`
          INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(chat_id) DO UPDATE SET
            name = COALESCE(excluded.name, chats_wa.name),
            unread = chats_wa.unread + excluded.unread,
            last_message = excluded.last_message,
            last_timestamp = excluded.last_timestamp
        `).run(chatId, name, phone, fromMe ? 0 : 1, text, ts);

        // Guardar mensaje
        db.prepare(`
          INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
          VALUES (?, ?, ?, ?, ?, 'received')
        `).run(msgId, chatId, fromMe, text, ts);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en Webhook:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
