import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("52") && digits.length === 12) return `521${digits.slice(2)}`;
  return digits;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { chatId, type, fileUrl, fileName, caption } = await req.json();
    if (!chatId || !type || !fileUrl)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const phone = normalizePhone(chatId.split("@")[0]);
    const normalizedChatId = `${phone}@s.whatsapp.net`;
    const ts = Math.floor(Date.now() / 1000);

    // Build WaSenderAPI body — same endpoint, different field name per media type
    const body: Record<string, string> = { to: phone };
    let displayText: string;

    if (type === "image") {
      body.imageUrl = fileUrl;
      if (caption) body.text = caption;
      displayText = caption ? `📷 ${caption}` : "📷 Imagen";
    } else {
      body.documentUrl = fileUrl;
      if (fileName) body.fileName = fileName;
      if (caption) body.text = caption;
      displayText = fileName || "📎 Documento";
    }

    const res = await fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WASENDER_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (res.ok && data.success !== false) {
      const msgId: string =
        data?.data?.key?.id ||
        data?.data?.msgId?.toString() ||
        `out-media-${ts}-${Math.random().toString(36).slice(2, 7)}`;

      db.prepare(`
        INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          last_message = excluded.last_message,
          last_timestamp = excluded.last_timestamp
      `).run(normalizedChatId, phone, phone, displayText, ts);

      db.prepare(`
        INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
        VALUES (?, ?, 1, ?, ?, 'sent')
      `).run(msgId, normalizedChatId, displayText, ts);

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: data.message || "Error WaSenderAPI" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
