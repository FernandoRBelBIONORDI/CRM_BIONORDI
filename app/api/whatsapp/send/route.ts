import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("52") && digits.length === 12) {
    return `521${digits.slice(2)}`;
  }
  return digits;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { chatId, message } = await req.json();
    if (!chatId || !message) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const rawPhone = chatId.split("@")[0];
    const phone = normalizePhone(rawPhone);
    const normalizedChatId = `${phone}@s.whatsapp.net`;

    const res = await fetch("https://wasenderapi.com/api/send-message", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WASENDER_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ to: phone, text: message })
    });

    const data = await res.json();

    if (res.ok && data.success !== false) {
      const ts = Math.floor(Date.now() / 1000);

      db.prepare(`
        INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
        VALUES (?, ?, ?, 0, ?, ?)
        ON CONFLICT(chat_id) DO UPDATE SET
          last_message = excluded.last_message,
          last_timestamp = excluded.last_timestamp
      `).run(normalizedChatId, phone, phone, message, ts);

      return NextResponse.json({ ok: true });
    } else {
      return NextResponse.json({ error: data.message || "Error WaSenderAPI" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
