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
    const phone10 = chatId.split("@")[0].replace(/\D/g, "").slice(-10);
    db.prepare(`UPDATE chats_wa SET unread = 0 WHERE SUBSTR(REPLACE(REPLACE(chat_id, '@s.whatsapp.net', ''), '@c.us', ''), -10) = ?`).run(phone10);

    const total = (db.prepare(`SELECT COUNT(*) as c FROM mensajes_wa`).get() as any)?.c ?? 0;

    const messages = db.prepare(`
      SELECT * FROM (
        SELECT m.*
        FROM mensajes_wa m
        WHERE m.text != ''
          AND SUBSTR(REPLACE(REPLACE(m.chat_id, '@s.whatsapp.net', ''), '@c.us', ''), -10) = ?
        ORDER BY m.timestamp DESC
        LIMIT 200
      ) ORDER BY timestamp ASC
    `).all(phone10).map((m: any) => ({
      ...m,
      fromMe: m.from_me === 1
    }));

    console.log(`[MSGS] chatId=${chatId} phone10=${phone10} found=${messages.length} totalInDB=${total}`);

    return NextResponse.json({ messages });
  } catch (e: any) {
    console.error("[MSGS] error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
