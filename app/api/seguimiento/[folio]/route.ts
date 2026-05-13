import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request, { params }: { params: { folio: string } }) {
  const { folio } = params;

  try {
    const orden = db.prepare(`
      SELECT o.*,
             l.nombre  AS lead_nombre,
             l.telefono AS lead_telefono,
             l.ciudad  AS lead_ciudad
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.folio = ?
    `).get(folio);

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Omitir información sensible o precios si se requiere, pero por ahora enviamos lo principal
    return NextResponse.json({ orden });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
