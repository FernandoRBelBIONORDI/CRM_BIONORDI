import { NextResponse } from 'next/server';

const HEADERS: HeadersInit = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9',
  'Cache-Control':   'no-cache',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // URL de perfil de ejemplo — puedes pasar cualquier doctor
  const profileUrl = searchParams.get('url') ||
    'https://www.doctoralia.com.mx/ricardo-lua-alvarado/ginecologo/guadalajara';

  const res  = await fetch(profileUrl, { headers: HEADERS, redirect: 'follow' });
  const html = await res.text();

  // 1. Buscar el botón "mostrar teléfono" y sus atributos data-*
  const phoneButtonMatch = html.match(/<[^>]*(phone|telefon|tel)[^>]*>/gi) || [];
  const dataPhoneAttrs   = html.match(/data-[a-z-]*(?:phone|tel|telefon)[a-z-]*="[^"]*"/gi) || [];

  // 2. Buscar el doctor_id o specialist_id en el HTML
  const doctorIdMatch  = html.match(/(?:doctor[_-]id|specialist[_-]id|"id"\s*:\s*)["']?(\d+)["']?/i);
  const doctorId       = doctorIdMatch?.[1] || null;

  // 3. Buscar URLs de API que contengan "phone" en scripts inline
  const phoneApiUrls   = (html.match(/https?:\/\/[^\s"'<>]*phone[^\s"'<>]*/gi) || []).slice(0, 10);
  const ajaxPhoneUrls  = (html.match(/\/api\/[^\s"'<>]*phone[^\s"'<>]*/gi) || []).slice(0, 10);
  const ajaxUrls       = (html.match(/\/api\/v\d+\/[^\s"'<>]{0,80}/gi) || []).slice(0, 20);

  // 4. Buscar el teléfono parcial visible (ej: "55 XXXX ####")
  const partialPhones  = html.match(/\d{2,3}[\s-]\d{2,4}[\s-]\d{2,4}/g) || [];

  // 5. Buscar en scripts inline JSON con "phone" o "telefono"
  const scriptPhoneMatches = (html.match(/"(?:phone|telephone|telefono)"\s*:\s*"[^"]{4,20}"/gi) || []).slice(0, 10);

  // 6. Buscar window.__PROPS__ u otros objetos de datos embebidos
  const propsMatch     = html.match(/window\.__(?:PROPS|STATE|DATA|INITIAL)[^=]*=\s*(\{[^<]{0,800})/);

  // 7. Contexto alrededor de la palabra "telefono"
  const telContexts: string[] = [];
  const re = /telefon[oó]/gi;
  let m;
  while((m = re.exec(html)) !== null) {
    telContexts.push(html.slice(Math.max(0, m.index - 100), m.index + 200));
    if(telContexts.length >= 5) break;
  }

  return NextResponse.json({
    url: profileUrl,
    status: res.status,
    htmlLength: html.length,
    doctorId,
    dataPhoneAttrs:      dataPhoneAttrs.slice(0, 10),
    phoneButtonSnippets: phoneButtonMatch.slice(0, 5),
    phoneApiUrls,
    ajaxPhoneUrls,
    ajaxUrlsSample:      ajaxUrls,
    partialPhones:       [...new Set(partialPhones)].slice(0, 10),
    scriptPhoneMatches,
    propsPreview:        propsMatch ? propsMatch[1].slice(0, 600) : null,
    telContexts,
  });
}
