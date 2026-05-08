import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { chatId, message } = await req.json();
    if (!chatId || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const phone = chatId.split("@")[0];

    // Llamada a WaSenderAPI
    const res = await fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WASENDER_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        to: phone,
        text: message
      })
    });

    const data = await res.json();
    
    if (res.ok && data.success !== false) {
      // Guardar en la DB
      const ts = Math.floor(Date.now() / 1000);
      const msgId = data.data?.id || `out-${Date.now()}`;
      
      // Asegurar que el chat existe
      db.prepare(`
        INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          last_message = excluded.last_message,
          last_timestamp = excluded.last_timestamp
      `).run(chatId, phone, phone, message, ts);

      // Insertar el mensaje
      db.prepare(`
        INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
        VALUES (?, ?, 1, ?, ?, 'sent')
      `).run(msgId, chatId, message, ts);

      return NextResponse.json({ ok: true, messageId: msgId });
    } else {
      return NextResponse.json({ error: data.message || "Error WaSenderAPI" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
