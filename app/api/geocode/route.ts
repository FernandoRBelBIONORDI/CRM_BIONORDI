import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });

    const lead = db.prepare(
      `SELECT id, nombre, direccion, ciudad, municipio, estado_republica FROM leads WHERE id = ?`
    ).get(lead_id) as any;

    if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });

    // Build queries from most precise to least precise
    const queries: string[] = [];

    if (lead.direccion && lead.ciudad) {
      queries.push(
        [lead.direccion, lead.ciudad, lead.estado_republica, 'México']
          .filter(Boolean).join(', ')
      );
    }
    if (lead.ciudad) {
      queries.push(
        [lead.ciudad, lead.municipio, lead.estado_republica, 'México']
          .filter(Boolean).join(', ')
      );
    }

    for (const q of queries) {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=mx&limit=1`;

      const res = await fetch(url, {
        headers: { 'User-Agent': 'Bionordi CRM (bionordi.mx)' },
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (!data.length) continue;

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      db.prepare(`UPDATE leads SET latitud = ?, longitud = ? WHERE id = ?`).run(lat, lng, lead_id);

      return NextResponse.json({ lat, lng, display_name: data[0].display_name });
    }

    // No result found — mark as attempted with null sentinel to avoid retrying
    return NextResponse.json({ error: 'Sin resultado' }, { status: 404 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
