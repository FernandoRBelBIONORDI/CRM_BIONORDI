import * as cheerio from 'cheerio';

export interface DoctoraliaLead {
  nombre: string;
  especialidad: string;
  telefono?: string;
  direccion?: string;
  ciudad: string;
  estado?: string;
  sitio_doctoralia?: string;
  reviews?: number;
  rating?: number;
}

export const ESPECIALIDADES_DOCTORALIA = [
  { slug: 'ginecologo',          label: 'Ginecólogo',        grupo: 'Ginecología' },
  { slug: 'ginecologo-obstetra', label: 'Gin. Obstetra',     grupo: 'Ginecología' },
  { slug: 'cardiologo',          label: 'Cardiólogo',        grupo: 'Cardiología' },
  { slug: 'radiologo',           label: 'Radiólogo',         grupo: 'Imagen' },
  { slug: 'medico-general',      label: 'Médico General',    grupo: 'General' },
  { slug: 'internista',          label: 'Internista',        grupo: 'General' },
  { slug: 'oncologo',            label: 'Oncólogo',          grupo: 'Oncología' },
  { slug: 'nefrologo',           label: 'Nefrólogo',         grupo: 'Nefrología' },
  { slug: 'pediatra',            label: 'Pediatra',          grupo: 'Pediatría' },
  { slug: 'cirujano-general',    label: 'Cir. General',      grupo: 'Cirugía' },
  { slug: 'angiologo',           label: 'Angiólogo',         grupo: 'Vascular' },
  { slug: 'cirujano-vascular',   label: 'Méd. Vascular',     grupo: 'Vascular' },
  { slug: 'urologo',             label: 'Urólogo',           grupo: 'Urología' },
];

export function ciudadToSlug(ciudad: string): string {
  return ciudad
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const HEADERS: HeadersInit = {
  'User-Agent':    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function cleanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^52/, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// ─── Extrae teléfonos del HTML usando dos métodos ─────────────────────────────

/**
 * Busca teléfonos en el HTML de la página del doctor (perfil o listing).
 * Método 1: data-target="[data-id='address-{id}-{10digits}-{n}-phone"
 * Método 2: href="tel:XX XXXX XXXX"
 * Devuelve un mapa nombre_normalizado → teléfono para el listing,
 * y el primer teléfono encontrado para perfiles individuales.
 */
function extractPhonesFromHtml(html: string, $: cheerio.CheerioAPI): {
  byName: Map<string, string>;
  first: string | undefined;
} {
  const byName = new Map<string, string>();
  let first: string | undefined;

  // Método 1 — data-target con teléfono codificado
  // Formato: address-{addressId}-{phone10digits}-{n}-phone
  const dtRegex = /data-target="[^"]*address-\d+-([\d]{10})-\d+-phone/g;
  let m: RegExpExecArray | null;

  while ((m = dtRegex.exec(html)) !== null) {
    const phone = m[1];
    if (!first) first = phone;

    // Intentar asociar al nombre buscando el entity_id del mismo botón
    // El botón tiene: data-one-tracking-entity_id="31068"
    const buttonCtx = html.slice(Math.max(0, m.index - 200), m.index + 500);
    const entityMatch = buttonCtx.match(/data-one-tracking-entity_id="(\d+)"/);
    if (entityMatch) byName.set(`entity_${entityMatch[1]}`, phone);
  }

  // Método 2 — href="tel:..."  (el teléfono completo visible en el modal)
  const telRegex = /href="tel:([\d\s]{8,16})"/g;
  while ((m = telRegex.exec(html)) !== null) {
    const phone = cleanPhone(m[1]);
    if (phone.length >= 8) {
      if (!first) first = phone;
      // Contexto alrededor para buscar el entity_id
      const ctx = html.slice(Math.max(0, m.index - 500), m.index + 200);
      const entityMatch = ctx.match(/data-one-tracking-entity_id="(\d+)"/);
      if (entityMatch) byName.set(`entity_${entityMatch[1]}`, phone);
    }
  }

  // Método 3 — cheerio: buscar dentro de cada tarjeta de doctor
  // Funciona tanto en listing como en perfiles
  $('[data-target*="-phone"]').each((_, el) => {
    const target = $(el).attr('data-target') || '';
    const phoneM = target.match(/address-\d+-([\d]{10})-\d+-phone/);
    if (!phoneM) return;
    const phone  = phoneM[1];
    if (!first) first = phone;

    // Buscar el nombre del doctor en el ancestro más cercano que sea una tarjeta
    const card  = $(el).closest('article, li, [data-doctor-id], [data-entity-id], div[class*="row"]');
    const name  = card.find('h2, h3, [itemprop="name"]').first().text().trim().replace(/\s+/g, ' ');
    if (name) byName.set(name.toLowerCase(), phone);

    // Entity ID del botón
    const entityId = $(el).attr('data-one-tracking-entity_id');
    if (entityId) byName.set(`entity_${entityId}`, phone);
  });

  $('a[href^="tel:"]').each((_, el) => {
    const raw   = $(el).attr('href')?.replace('tel:', '') || '';
    const phone = cleanPhone(raw);
    if (phone.length < 8) return;
    if (!first) first = phone;

    const card = $(el).closest('article, li, [data-doctor-id], div[class*="row"]');
    const name = card.find('h2, h3, [itemprop="name"]').first().text().trim().replace(/\s+/g, ' ');
    if (name) byName.set(name.toLowerCase(), phone);
  });

  return { byName, first };
}

// ─── Extrae teléfono de la página de perfil individual ───────────────────────

async function fetchPhoneFromProfile(profileUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(profileUrl, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return undefined;
    const html = await res.text();
    const $    = cheerio.load(html);
    const { first } = extractPhonesFromHtml(html, $);
    return first;
  } catch {
    return undefined;
  }
}

// ─── Extrae leads del JSON-LD ItemList ───────────────────────────────────────

function extractFromJsonLd(
  $: cheerio.CheerioAPI,
  ciudad: string,
  especialidad: string,
  phoneMap: Map<string, string>
): DoctoraliaLead[] {
  const leads: DoctoraliaLead[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');

      if (json['@type'] === 'ItemList' && Array.isArray(json.itemListElement)) {
        for (const listItem of json.itemListElement) {
          const item    = listItem.item || listItem;
          const nombre  = (item.name || listItem.name || '').trim();
          if (!nombre) continue;

          const addrObj = item.address || {};
          const telRaw  = item.telephone || '';

          // Buscar teléfono: JSON-LD → mapa por nombre → sin teléfono (se enriquece después)
          const telefono = telRaw
            ? cleanPhone(String(telRaw))
            : phoneMap.get(nombre.toLowerCase()) || undefined;

          leads.push({
            nombre,
            especialidad,
            telefono,
            direccion:        addrObj.streetAddress  || '',
            ciudad:           addrObj.addressLocality || ciudad,
            estado:           addrObj.addressRegion   || undefined,
            sitio_doctoralia: item.url || listItem.url || undefined,
            rating:  item.aggregateRating?.ratingValue ? Number(item.aggregateRating.ratingValue) : undefined,
            reviews: item.aggregateRating?.reviewCount ? Number(item.aggregateRating.reviewCount) : undefined,
          });
        }
      }
    } catch {}
  });

  return leads;
}

// ─── Función principal ────────────────────────────────────────────────────────

export async function scrapeDoctoralia(
  especialidad: string,
  ciudad: string,
  paginas = 2
): Promise<{ leads: DoctoraliaLead[]; error?: string }> {
  const slug = ciudadToSlug(ciudad);
  const base = `https://www.doctoralia.com.mx/${especialidad}/${slug}`;
  const all: DoctoraliaLead[]  = [];
  const seen = new Set<string>();

  for (let page = 1; page <= paginas; page++) {
    const url = page === 1 ? base : `${base}?page=${page}`;

    let html: string;
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
      if (!res.ok) {
        if (page === 1) return { leads: [], error: `HTTP ${res.status} — Doctoralia no encontró la combinación especialidad/ciudad` };
        break;
      }
      html = await res.text();
    } catch (e: any) {
      if (page === 1) return { leads: [], error: `No se pudo conectar: ${e.message}` };
      break;
    }

    if (html.includes('cf-browser-verification') || html.includes('Just a moment') || html.includes('captcha')) {
      return { leads: all, error: 'Doctoralia bloqueó la solicitud. Intenta de nuevo en unos minutos.' };
    }

    const $       = cheerio.load(html);
    // Extraer teléfonos del listing directamente (sin fetch adicional)
    const { byName: phoneMap } = extractPhonesFromHtml(html, $);
    const pageLeads = extractFromJsonLd($, ciudad, especialidad, phoneMap);

    if (pageLeads.length === 0) break;

    // Para los leads sin teléfono, obtener del perfil individual
    // El teléfono sólo está en la página de perfil — hay que visitarla
    // Delay de 600-1000 ms por perfil para no ser bloqueados
    for (const lead of pageLeads) {
      if (!lead.telefono && lead.sitio_doctoralia) {
        await delay(600 + Math.random() * 400);
        lead.telefono = await fetchPhoneFromProfile(lead.sitio_doctoralia);
      }
    }

    for (const lead of pageLeads) {
      if (lead.nombre && !seen.has(lead.nombre)) {
        seen.add(lead.nombre);
        all.push(lead);
      }
    }

    if (page < paginas) await delay(1800 + Math.random() * 1200);
  }

  return { leads: all };
}
