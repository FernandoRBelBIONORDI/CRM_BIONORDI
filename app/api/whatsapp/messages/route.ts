import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const chatId = url.searchParams.get("chatId");
  if (!chatId) return NextResponse.json({ error: "chatId required" }, { status: 400 });

  try {
    // Marcar como leídos
    db.prepare("UPDATE chats_wa SET unread = 0 WHERE chat_id = ?").run(chatId);

    const messages = db.prepare("SELECT * FROM mensajes_wa WHERE chat_id = ? ORDER BY timestamp ASC LIMIT 100").all(chatId).map((m: any) => ({
      ...m,
      fromMe: m.from_me === 1
    }));

    return NextResponse.json({ messages });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
