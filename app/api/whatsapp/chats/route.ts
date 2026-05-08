import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Comparar los últimos 10 dígitos del teléfono para manejar diferencias
    // de código de país (ej: 521XXXXXXXXXX vs 1XXXXXXXXXX vs XXXXXXXXXX)
    const chats = db.prepare(`
      SELECT c.*,
             l.id as lead_id,
             l.nombre as lead_nombre,
             l.score_potencial,
             l.nicho,
             l.fecha_ultimo_contacto
      FROM chats_wa c
      LEFT JOIN leads l
        ON SUBSTR(c.phone, -10) = SUBSTR(REPLACE(REPLACE(REPLACE(l.telefono, ' ', ''), '-', ''), '+', ''), -10)
        OR SUBSTR(c.phone, -10) = SUBSTR(REPLACE(REPLACE(REPLACE(l.whatsapp, ' ', ''), '-', ''), '+', ''), -10)
      ORDER BY c.last_timestamp DESC
      LIMIT 80
    `).all();
    return NextResponse.json({ chats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
