import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

const WASENDER_TOKEN = process.env.WASENDER_TOKEN!;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch("https://wasenderapi.com/api/user", {
      headers: { "Authorization": `Bearer ${WASENDER_TOKEN}`, "Accept": "application/json" },
      cache: "no-store",
    });
    const data = await res.json();

    if (data.success && data.data) {
      const phone = data.data.id?.split("@")[0]?.split(":")[0] || "";
      // Actualizar estado cacheado en DB
      try {
        db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('wa_session_status', 'ready')`).run();
      } catch {}
      return NextResponse.json({ connected: true, status: "ready", phone, name: data.data.name });
    }

    // Fallback: leer estado cacheado del último webhook de sesión
    let cachedStatus = "disconnected";
    try {
      const row = db.prepare(`SELECT valor FROM configuracion WHERE clave = 'wa_session_status'`).get() as any;
      if (row?.valor) cachedStatus = row.valor;
    } catch {}

    return NextResponse.json({ connected: false, status: cachedStatus });
  } catch (e) {
    return NextResponse.json({ connected: false, status: "disconnected" });
  }
}
