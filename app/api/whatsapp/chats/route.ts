import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Deduplicar chats con el mismo número (últimos 10 dígitos).
    // Ocurre cuando el mismo contacto tiene 527XXXXXXXX y 5217XXXXXXXX (formato MX con/sin 1).
    // Nos quedamos con el chat más reciente por número.
    const chats = db.prepare(`
      WITH deduped AS (
        SELECT *,
               ROW_NUMBER() OVER (
                 PARTITION BY SUBSTR(phone, -10)
                 ORDER BY last_timestamp DESC
               ) AS rn
        FROM chats_wa
      )
      SELECT d.chat_id, d.name, d.phone, d.unread, d.last_message, d.last_timestamp,
             l.id   AS lead_id,
             l.nombre AS lead_nombre,
             l.score_potencial,
             l.nicho,
             l.fecha_ultimo_contacto
      FROM deduped d
      LEFT JOIN leads l
        ON SUBSTR(d.phone, -10) = SUBSTR(REPLACE(REPLACE(REPLACE(l.telefono,  ' ',''),'-',''),'+',''), -10)
        OR SUBSTR(d.phone, -10) = SUBSTR(REPLACE(REPLACE(REPLACE(l.whatsapp, ' ',''),'-',''),'+',''), -10)
      WHERE d.rn = 1
      ORDER BY d.last_timestamp DESC
      LIMIT 80
    `).all();

    return NextResponse.json({ chats });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
