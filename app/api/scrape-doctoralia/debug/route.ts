import { NextResponse } from 'next/server';
import { ciudadToSlug } from '@/lib/doctoralia';

const HEADERS: HeadersInit = {
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Cache-Control': 'no-cache',
};

async function probe(url: string) {
  try {
    const res  = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    const html = await res.text();
    const jsonLd: any[] = [];
    const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while((m = re.exec(html)) !== null) { try { jsonLd.push(JSON.parse(m[1])); } catch {} }
    return {
      url, status: res.status,
      isCloudflare: html.includes('cf-browser-verification') || html.includes('Just a moment'),
      htmlLength: html.length,
      jsonLdCount: jsonLd.length,
      jsonLdTypes: jsonLd.map(j => j['@type'] || 'graph'),
      // Si la página es grande y tiene JSON-LD = éxito
      ok: res.status === 200 && html.length > 10000,
      preview: html.slice(0, 400),
    };
  } catch(e: any) {
    return { url, status: 0, error: e.message, ok: false };
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const esp    = searchParams.get('especialidad') || 'ginecologo';
  const ciudad = searchParams.get('ciudad')       || 'guadalajara';
  const slug   = ciudadToSlug(ciudad);

  const url  = `https://www.doctoralia.com.mx/${esp}/${slug}`;
  const res  = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  const html = await res.text();

  // Extraer todos los JSON-LD
  const jsonLd: any[] = [];
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while((m = re.exec(html)) !== null) { try { jsonLd.push(JSON.parse(m[1])); } catch {} }

  // Buscar datos embebidos en window.__INITIAL_STATE__ u objetos similares
  const stateMatch = html.match(/window\.__(?:INITIAL_STATE|APP_STATE|DATA)__\s*=\s*(\{[\s\S]{0,5000})/);

  // Buscar bloques JSON grandes en <script> (next.js __NEXT_DATA__ etc)
  const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);

  // Mostrar una muestra de los primeros elementos del ItemList si existe
  const itemList = jsonLd.find(j => j['@type'] === 'ItemList');
  const items    = itemList?.itemListElement?.slice(0, 3) || [];

  return NextResponse.json({
    url, status: res.status, htmlLength: html.length,
    jsonLdCount: jsonLd.length,
    jsonLdTypes: jsonLd.map((j:any) => j['@type']),
    // Primeros 3 items del ItemList completos
    itemListSample: items,
    // Primeros 500 chars del state embebido
    hasInitialState: !!stateMatch,
    initialStatePreview: stateMatch ? stateMatch[1].slice(0, 500) : null,
    hasNextData: !!nextData,
    nextDataPreview: nextData ? nextData[1].slice(0, 500) : null,
    // Buscar href de paginación
    hasPagination: html.includes('page=2') || html.includes('rel="next"'),
    // Organization JSON-LD para confirmar que es la página correcta
    orgName: jsonLd.find((j:any) => j['@type'] === 'Organization')?.name,
  });
}
