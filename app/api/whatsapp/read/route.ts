import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { chatId } = await req.json();
    if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

    // Obtener el último mensaje recibido (fromMe=0) de este chat
    const lastMsg = db.prepare(`
      SELECT id FROM mensajes_wa
      WHERE chat_id = ? AND from_me = 0
      ORDER BY timestamp DESC
      LIMIT 1
    `).get(chatId) as { id: string } | undefined;

    if (!lastMsg) return NextResponse.json({ ok: true, skipped: true });

    // Marcar como leído en WaSenderAPI → el lead verá las palomitas azules
    const res = await fetch("https://www.wasenderapi.com/api/messages/read", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WASENDER_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        key: {
          id: lastMsg.id,
          remoteJid: chatId,
          fromMe: false
        }
      })
    });

    const data = await res.json();
    console.log("[READ] mark-as-read:", chatId, "→", res.status, JSON.stringify(data).slice(0, 100));

    // Marcar también como leído en nuestra DB
    db.prepare("UPDATE chats_wa SET unread = 0 WHERE chat_id = ?").run(chatId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
