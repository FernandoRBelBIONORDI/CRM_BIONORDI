import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch("https://wasenderapi.com/api/user", {
      headers: { "Authorization": `Bearer ${WASENDER_TOKEN}`, "Accept": "application/json" },
      // no-cache para evitar que Next.js cachee la respuesta
      cache: 'no-store'
    });
    const data = await res.json();

    if (data.success && data.data) {
      const phone = data.data.id.split("@")[0].split(":")[0];
      return NextResponse.json({ connected: true, status: "ready", phone, name: data.data.name });
    }
    return NextResponse.json({ connected: false, status: "disconnected" });
  } catch (e) {
    return NextResponse.json({ connected: false, status: "disconnected" });
  }
}
