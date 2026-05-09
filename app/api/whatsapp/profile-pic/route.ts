import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  try {
    // Return cached value if available
    const cached = db
      .prepare("SELECT photo_url FROM chats_wa WHERE phone = ? AND photo_url IS NOT NULL LIMIT 1")
      .get(phone) as any;
    if (cached?.photo_url) return NextResponse.json({ imgUrl: cached.photo_url });

    const res = await fetch(
      `https://wasenderapi.com/api/contacts/${encodeURIComponent(phone)}/picture`,
      {
        headers: { Authorization: `Bearer ${WASENDER_TOKEN}`, Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!res.ok) return NextResponse.json({ imgUrl: null });

    const data = await res.json();
    const imgUrl: string | null = data?.data?.imgUrl || null;

    if (imgUrl) {
      try {
        db.prepare("UPDATE chats_wa SET photo_url = ? WHERE phone = ?").run(imgUrl, phone);
      } catch {}
    }

    return NextResponse.json({ imgUrl });
  } catch {
    return NextResponse.json({ imgUrl: null });
  }
}
