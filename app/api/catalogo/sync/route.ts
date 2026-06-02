import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import db from '@/lib/db';

type ProductoWeb = {
  tipo: string;
  marca: string;
  modelo: string;
  descripcion: string;
  notas: string;
};

// Inventario conocido como respaldo si el scraping falla
const INVENTARIO_FALLBACK: ProductoWeb[] = [
  { tipo: 'transductor', marca: 'SonoSite',  modelo: 'L38e',    descripcion: 'Transductor lineal 10-5 MHz. Ideal para partes blandas, vascular y musculoesquelético.', notas: '$17,400 MXN' },
  { tipo: 'transductor', marca: 'SonoSite',  modelo: 'P21x',    descripcion: 'Transductor phased array / sectorial 5-1 MHz. Cardiología y abdomen profundo.', notas: '$22,040 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L4s',    descripcion: 'Transductor lineal. Partes blandas, tiroides y vascular.', notas: '$34,800 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '2P-2s',   descripcion: 'Transductor phased array 2 MHz. Ecocardiografía y abdomen.', notas: '$31,320 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P4-2s',   descripcion: 'Transductor phased array 4-2 MHz. Cardiología pediátrica.', notas: '$40,600 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P4-2',    descripcion: 'Transductor phased array 4-2 MHz. Cardiología general.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'Sp5-1s',  descripcion: 'Transductor phased array 5-1 MHz. Ecocardiografía.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P7-3s',   descripcion: 'Transductor phased array 7-3 MHz. Cardiología pediátrica avanzada.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-4P',   descripcion: 'Transductor lineal. Musculoesquelético y tejidos superficiales.', notas: '$32,480 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-5P',   descripcion: 'Transductor lineal de alta frecuencia. Vascular y partes blandas.', notas: '$32,481 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '3C-5A',   descripcion: 'Transductor convex 3-5 MHz. Abdomen general y obstetricia.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-4A',   descripcion: 'Transductor lineal. Accesos vasculares guiados por imagen.', notas: '$45,240 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'L13-3',   descripcion: 'Transductor lineal de banda ancha 13-3 MHz. Alta resolución para partes blandas.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'EC3-10',  descripcion: 'Transductor endocavitario. Ginecología y urología.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'SC1-6H',  descripcion: 'Transductor convex. Abdomen y obstetricia general.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'L3-12H',  descripcion: 'Transductor lineal 3-12 MHz. Partes blandas y vascular.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Chison',    modelo: 'D3C60L',  descripcion: 'Transductor convex 3.5 MHz. Abdomen y obstetricia.', notas: '$23,200 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M9',         descripcion: 'Ultrasonido portátil premium con sondas monocristal 3T. Pantalla LED 16", SSD 128GB.', notas: '$275,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'Z50',        descripcion: 'Ultrasonido de carrito de gama media. Abdomen, obstetricia y cardiología.', notas: '$195,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DC-60 Exp',  descripcion: 'Ultrasonido diagnóstico de alto desempeño con Doppler color avanzado.', notas: '$420,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DC-30',      descripcion: 'Ultrasonido de carrito compacto. General y obstetricia.', notas: '$148,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M5',         descripcion: 'Ultrasonido portátil compacto para urgencias y consultorios.', notas: '$128,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M7',         descripcion: 'Ultrasonido portátil avanzado con Doppler color y modo M.', notas: '$168,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'MX7',        descripcion: 'Ultrasonido portátil de alta gama con inteligencia artificial.', notas: '$315,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DP-50 Exp',  descripcion: 'Ultrasonido básico de carrito para consultorios generales.', notas: '$92,000 MXN' },
];

function normalizarModelo(raw: string): string {
  // "L38e/10-5 Mhz" → "L38e"
  return raw.split('/')[0].trim();
}

function extraerPrecio(texto: string): string {
  const m = texto.match(/\$\s*[\d,]+(?:\.\d+)?\s*MXN/i);
  return m ? m[0].replace(/\s+/g, '') : '';
}

function normalizarMarca(raw: string): string {
  const map: Record<string, string> = {
    'mindray': 'Mindray',
    'sonosite': 'SonoSite',
    'alpinion': 'Alpinion',
    'chison': 'Chison',
    'ge': 'GE Healthcare',
    'ge healthcare': 'GE Healthcare',
  };
  return map[raw.toLowerCase()] ?? raw;
}

function tipoDesdeSubtipo(subtipo: string): string {
  const s = subtipo.toLowerCase();
  if (s.includes('lineal') || s.includes('convex') || s.includes('phased') || s.includes('endocav') || s.includes('sectorial')) return 'transductor';
  return 'transductor';
}

async function scrapTransductores(): Promise<ProductoWeb[]> {
  const res = await fetch('https://bionordi.com/transductores', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const productos: ProductoWeb[] = [];

  // Intento 1: __NEXT_DATA__ JSON
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const transductores =
        json?.props?.pageProps?.transductores ||
        json?.props?.pageProps?.productos ||
        json?.props?.pageProps?.items;
      if (Array.isArray(transductores) && transductores.length > 0) {
        for (const t of transductores) {
          const modelo = normalizarModelo(t.modelo || t.model || t.name || t.nombre || '');
          if (!modelo) continue;
          productos.push({
            tipo: 'transductor',
            marca: normalizarMarca(t.marca || t.brand || ''),
            modelo,
            descripcion: t.descripcion || t.description || '',
            notas: extraerPrecio(t.precio || t.price || t.notas || '') || `$${t.precio || ''} MXN`,
          });
        }
        if (productos.length > 0) return productos;
      }
    } catch { /* continúa con cheerio */ }
  }

  // Intento 2: tabla HTML
  $('table tr').each((_, row) => {
    const celdas = $(row).find('td');
    if (celdas.length < 2) return;
    const textos = celdas.toArray().map(c => $(c).text().trim());
    const precioIdx = textos.findIndex(t => /\$[\d,]/.test(t));
    if (precioIdx === -1) return;
    const modelo = normalizarModelo(textos[0]);
    if (!modelo || modelo.length < 2) return;
    const marca = normalizarMarca(textos[1] || '');
    const subtipo = textos[2] || '';
    const precio = extraerPrecio(textos[precioIdx]);
    productos.push({ tipo: 'transductor', marca, modelo, descripcion: subtipo, notas: precio });
  });
  if (productos.length > 0) return productos;

  // Intento 3: cards con precio
  $('[class]').each((_, el) => {
    const texto = $(el).text();
    if (!extraerPrecio(texto)) return;
    const heading = $(el).find('h1,h2,h3,h4,h5,strong').first().text().trim();
    if (!heading || heading.length < 2) return;
    const marca = normalizarMarca($(el).find('[class*="brand"],[class*="marca"]').text().trim() || '');
    productos.push({
      tipo: 'transductor',
      marca,
      modelo: normalizarModelo(heading),
      descripcion: '',
      notas: extraerPrecio(texto),
    });
  });

  return productos;
}

async function scrapVenta(): Promise<ProductoWeb[]> {
  const res = await fetch('https://bionordi.com/venta', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  const productos: ProductoWeb[] = [];

  // Intento 1: __NEXT_DATA__ JSON
  const nextData = $('script#__NEXT_DATA__').text();
  if (nextData) {
    try {
      const json = JSON.parse(nextData);
      const equipos =
        json?.props?.pageProps?.equipos ||
        json?.props?.pageProps?.productos ||
        json?.props?.pageProps?.items;
      if (Array.isArray(equipos) && equipos.length > 0) {
        for (const e of equipos) {
          const modelo = (e.modelo || e.model || e.name || e.nombre || '').trim();
          if (!modelo) continue;
          productos.push({
            tipo: e.tipo || 'ultrasonido',
            marca: normalizarMarca(e.marca || e.brand || 'Mindray'),
            modelo,
            descripcion: e.descripcion || e.description || '',
            notas: extraerPrecio(String(e.precio || e.price || e.notas || '')),
          });
        }
        if (productos.length > 0) return productos;
      }
    } catch { /* continúa */ }
  }

  // Intento 2: JSON-LD schema
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).text());
      const items = json['@type'] === 'ItemList' ? json.itemListElement : (Array.isArray(json) ? json : [json]);
      for (const item of items) {
        const name = item.name || item.item?.name || '';
        const price = item.offers?.price || item.item?.offers?.price || '';
        if (!name) continue;
        productos.push({
          tipo: 'ultrasonido',
          marca: normalizarMarca(item.brand?.name || 'Mindray'),
          modelo: name,
          descripcion: item.description || '',
          notas: price ? `$${price} MXN` : '',
        });
      }
    } catch { /* continúa */ }
  });
  if (productos.length > 0) return productos;

  // Intento 3: headings + precio cercano
  $('h1,h2,h3,h4').each((_, el) => {
    const heading = $(el).text().trim();
    if (!heading || !/mindray|ge|philips|sonosite/i.test(heading) && heading.split(' ').length > 3) return;
    const container = $(el).closest('[class]');
    const precio = extraerPrecio(container.text());
    if (!precio) return;
    // inferir marca del nombre "Mindray M9" → marca="Mindray", modelo="M9"
    const partes = heading.split(/\s+/);
    const marcaRaw = partes[0];
    const modeloRaw = partes.slice(1).join(' ') || partes[0];
    productos.push({
      tipo: 'ultrasonido',
      marca: normalizarMarca(marcaRaw),
      modelo: modeloRaw,
      descripcion: '',
      notas: precio,
    });
  });

  return productos;
}

export async function POST() {
  let productosWeb: ProductoWeb[] = [];
  let useFallback = false;
  const errores: string[] = [];

  // Intentar scraping
  try {
    const [transductores, venta] = await Promise.all([
      scrapTransductores().catch(e => { errores.push(`/transductores: ${e.message}`); return [] as ProductoWeb[]; }),
      scrapVenta().catch(e => { errores.push(`/venta: ${e.message}`); return [] as ProductoWeb[]; }),
    ]);
    productosWeb = [...transductores, ...venta];
  } catch (e: any) {
    errores.push(e.message);
  }

  // Fallback si scraping no retornó suficientes productos
  if (productosWeb.length < 10) {
    useFallback = true;
    productosWeb = INVENTARIO_FALLBACK;
  }

  // Aplicar sync a la DB
  const dbItems = db.prepare('SELECT id, tipo, marca, modelo, activo FROM catalogo_equipos').all() as any[];

  const keyWeb = new Set(
    productosWeb.map(p => `${p.marca.toLowerCase()}|${p.modelo.toLowerCase()}`)
  );

  let activados = 0;
  let desactivados = 0;
  let insertados = 0;
  let actualizados = 0;

  const sync = db.transaction(() => {
    // 1. Activar/actualizar los que están en el sitio
    for (const pw of productosWeb) {
      const existing = dbItems.find(
        d => d.marca?.toLowerCase() === pw.marca.toLowerCase() &&
             d.modelo.toLowerCase() === pw.modelo.toLowerCase()
      );
      if (existing) {
        const changes = db.prepare(`
          UPDATE catalogo_equipos
          SET activo = 1, notas = ?, tipo = ?
          WHERE id = ?
        `).run(pw.notas, pw.tipo, existing.id).changes;
        if (changes > 0) {
          if (existing.activo === 0) activados++;
          else actualizados++;
        }
      } else {
        db.prepare(`
          INSERT INTO catalogo_equipos (tipo, marca, modelo, descripcion, notas, activo, fecha_alta)
          VALUES (?, ?, ?, ?, ?, 1, date('now'))
        `).run(pw.tipo, pw.marca, pw.modelo, pw.descripcion, pw.notas);
        insertados++;
      }
    }

    // 2. Desactivar los que ya no están en el sitio (solo ultrasonidos, transductores se quedan siempre activos ya que se pueden reparar)
    for (const d of dbItems) {
      const key = `${(d.marca || '').toLowerCase()}|${d.modelo.toLowerCase()}`;
      if (!keyWeb.has(key) && d.activo === 1 && d.tipo !== 'transductor') {
        db.prepare('UPDATE catalogo_equipos SET activo = 0 WHERE id = ?').run(d.id);
        desactivados++;
      }
    }
  });

  sync();

  return NextResponse.json({
    ok: true,
    fuente: useFallback ? 'fallback' : 'scraping',
    productosEnSitio: productosWeb.length,
    activados,
    desactivados,
    insertados,
    actualizados,
    errores: errores.length > 0 ? errores : undefined,
  });
}
