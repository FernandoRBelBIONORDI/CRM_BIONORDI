import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone") || "";
  const phone10 = phone.replace(/\D/g, "").slice(-10);

  const chats = db.prepare(`SELECT chat_id, name, phone, unread, last_message, last_timestamp FROM chats_wa ORDER BY last_timestamp DESC LIMIT 10`).all();

  const mensajes = phone10
    ? db.prepare(`
        SELECT id, chat_id, from_me, text, timestamp, status, media_type, media_url
        FROM mensajes_wa
        WHERE SUBSTR(REPLACE(REPLACE(chat_id, '@s.whatsapp.net', ''), '@c.us', ''), -10) = ?
        ORDER BY timestamp DESC LIMIT 30
      `).all(phone10)
    : db.prepare(`SELECT id, chat_id, from_me, text, timestamp, status, media_type, media_url FROM mensajes_wa ORDER BY timestamp DESC LIMIT 30`).all();

  const totalMensajes = (db.prepare(`SELECT COUNT(*) as c FROM mensajes_wa`).get() as any)?.c;
  const totalChats = (db.prepare(`SELECT COUNT(*) as c FROM chats_wa`).get() as any)?.c;
  const conMedia = (db.prepare(`SELECT COUNT(*) as c FROM mensajes_wa WHERE media_type IS NOT NULL`).get() as any)?.c;
  const conMediaUrl = (db.prepare(`SELECT COUNT(*) as c FROM mensajes_wa WHERE media_url IS NOT NULL`).get() as any)?.c;

  return NextResponse.json({ totalChats, totalMensajes, conMedia, conMediaUrl, chats, mensajes, phone10_buscado: phone10 || "(todos)" });
}
