import { NextResponse } from 'next/server';
import db from '@/lib/db';

// LinkedIn Cross-Check via Google Custom Search
// Requiere GOOGLE_CSE_ID en .env.local (opcional — si no está, retorna URL de búsqueda manual)
export async function POST(req: Request) {
  try {
    const { lead_id, nombre_empresa } = await req.json();
    if (!lead_id || !nombre_empresa) {
      return NextResponse.json({ error: 'lead_id y nombre_empresa requeridos' }, { status: 400 });
    }

    const query = `"${nombre_empresa}" site:linkedin.com/in Director OR Dueño OR "Médico" OR "Director Médico" OR Socio`;
    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    const cseId  = process.env.GOOGLE_CSE_ID;
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    let resultados: any[] = [];
    let metodo = 'manual';

    if (cseId && apiKey) {
      try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(query)}&num=5`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.items) {
          resultados = data.items.slice(0, 5).map((item: any) => {
            const urlMatch = item.link?.match(/linkedin\.com\/in\/([^/?]+)/);
            const profileSlug = urlMatch ? urlMatch[1] : null;
            const snippetParts = (item.snippet || '').split(/[-–|·]/);
            return {
              nombre:    item.title?.replace(/ - LinkedIn$/, '').replace(/ \| LinkedIn$/, '').trim(),
              cargo:     snippetParts[1]?.trim() || '',
              linkedin:  item.link,
              perfil_id: profileSlug,
              confianza: 'media',
            };
          }).filter((r: any) => r.linkedin?.includes('linkedin.com/in'));
          metodo = 'google_cse';
        }
      } catch {
        // Si falla CSE, devuelve URL manual
      }
    }

    return NextResponse.json({
      empresa: nombre_empresa,
      query,
      google_search_url: googleSearchUrl,
      resultados,
      metodo,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  // Guardar decisor confirmado en el lead
  try {
    const { lead_id, nombre, cargo, linkedin } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });

    db.prepare(`
      UPDATE leads SET decisor_nombre = ?, decisor_cargo = ?, decisor_linkedin = ?, fecha_ultimo_cambio = ?
      WHERE id = ?
    `).run(nombre || null, cargo || null, linkedin || null, new Date().toISOString(), lead_id);

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
