import { NextResponse } from 'next/server';
import db from '@/lib/db';

const KEY = process.env.GOOGLE_PLACES_API_KEY;

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY}`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json() as any;
  if (data.status === 'OK' && data.results?.[0]) {
    const { lat, lng } = data.results[0].geometry.location;
    return { lat, lng };
  }
  return null;
}

function buildAddress(lead: any): string {
  return [lead.direccion, lead.municipio, lead.ciudad, lead.estado_republica, 'México']
    .filter(Boolean).join(', ');
}

// POST { id } → geocodifica un lead
// POST { all: true } → geocodifica todos sin coordenadas
export async function POST(req: Request) {
  if (!KEY) return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY no configurada en Railway' }, { status: 500 });

  try {
    const body = await req.json();

    if (body.all) {
      const leads = db.prepare(`
        SELECT id, direccion, municipio, ciudad, estado_republica
        FROM leads
        WHERE (lat IS NULL OR lng IS NULL)
          AND (direccion IS NOT NULL OR ciudad IS NOT NULL OR estado_republica IS NOT NULL)
      `).all() as any[];

      let ok = 0, fail = 0;
      for (const lead of leads) {
        const coords = await geocode(buildAddress(lead));
        if (coords) {
          db.prepare('UPDATE leads SET lat = ?, lng = ? WHERE id = ?').run(coords.lat, coords.lng, lead.id);
          ok++;
        } else {
          fail++;
        }
        await new Promise(r => setTimeout(r, 120)); // evitar rate limit
      }
      return NextResponse.json({ ok, fail, total: leads.length });
    }

    if (body.id) {
      const lead = db.prepare(
        'SELECT id, direccion, municipio, ciudad, estado_republica FROM leads WHERE id = ?'
      ).get(body.id) as any;
      if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });

      const address = buildAddress(lead);
      if (!address.replace('México', '').trim())
        return NextResponse.json({ error: 'El lead no tiene dirección ni ciudad' }, { status: 422 });

      const coords = await geocode(address);
      if (!coords) return NextResponse.json({ error: `No se encontró ubicación para: ${address}` }, { status: 422 });

      db.prepare('UPDATE leads SET lat = ?, lng = ? WHERE id = ?').run(coords.lat, coords.lng, lead.id);
      return NextResponse.json({ lat: coords.lat, lng: coords.lng, address });
    }

    return NextResponse.json({ error: 'Se requiere id o all:true' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
