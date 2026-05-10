import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const msgs = db.prepare("DELETE FROM mensajes_wa").run();
  const chats = db.prepare("DELETE FROM chats_wa").run();
  return NextResponse.json({ ok: true, mensajes_borrados: msgs.changes, chats_borrados: chats.changes });
}
