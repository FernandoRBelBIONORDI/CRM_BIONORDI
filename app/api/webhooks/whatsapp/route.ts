import { NextResponse } from "next/server";
import db from "@/lib/db";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Webhook WA recibido:", JSON.stringify(payload, null, 2));

    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      const eventName: string = ev.event || ev.type || "";

      // Aceptar cualquier variante de evento de mensaje entrante
      const isMessageEvent =
        eventName === "message.received" ||
        eventName === "messages.received" ||
        eventName === "message.upsert" ||
        eventName === "messages.upsert" ||
        eventName === "message" ||
        eventName === "messages";

      if (!isMessageEvent) continue;

      // WaSenderAPI puede enviar un solo objeto en ev.data
      // o un array en ev.data.messages
      const raw = ev.data;
      if (!raw) continue;

      const msgList: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw.messages)
        ? raw.messages
        : [raw];

      for (const msg of msgList) {
        if (!msg || !msg.key) continue;

        const chatId = msg.key.remoteJid;
        if (!chatId || chatId.endsWith("@g.us")) continue; // ignorar grupos por ahora

        const fromMe = msg.key.fromMe ? 1 : 0;
        const msgId = msg.key.id;

        let text = "";
        if (msg.message?.conversation) text = msg.message.conversation;
        else if (msg.message?.extendedTextMessage?.text) text = msg.message.extendedTextMessage.text;
        else if (msg.text) text = msg.text;
        else if (typeof msg.body === "string") text = msg.body;

        if (!text) continue;

        const phone = chatId.split("@")[0].split(":")[0];
        const name = msg.pushName || msg.notifyName || phone;
        const ts = Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000);

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
          VALUES (?, ?, ?, ?, ?, 'received')
        `).run(msgId, chatId, fromMe, text, ts);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Error en Webhook WA:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
