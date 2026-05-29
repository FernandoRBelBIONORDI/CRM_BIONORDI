import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { scrapeDoctoralia } from '@/lib/doctoralia';
import { verifyContact } from '@/lib/verificacion';
import { nombreSimilarity } from '@/lib/denue';
import { requireAuth } from '@/lib/require-auth';
import { rateLimit } from '@/lib/rate-limit';

function findDuplicate(nombre: string, telefono: string | undefined, ciudad: string): any | null {
  if (telefono && telefono.length >= 8) {
    const byPhone = db.prepare(
      `SELECT * FROM leads WHERE telefono = ? AND ciudad = ? LIMIT 1`
    ).get(telefono, ciudad);
    if (byPhone) return byPhone;
  }
  const candidates = db.prepare(`SELECT * FROM leads WHERE ciudad = ?`).all(ciudad) as any[];
  for (const c of candidates) {
    if (c.nombre && nombreSimilarity(c.nombre, nombre) > 0.55) return c;
  }
  return null;
}

export async function POST(req: Request) {
  const { session, unauth } = await requireAuth();
  if (unauth) return unauth;

  if (!rateLimit(`scrape:${session.user?.email}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: 'Demasiadas búsquedas. Esperá unos minutos.' }, { status: 429 });
  }

  try {
    const { especialidad, ciudad, estado_republica, municipio, paginas = 2, nicho, barrido_id } = await req.json();

    if (!especialidad || !ciudad) {
      return NextResponse.json({ error: 'Faltan parámetros: especialidad y ciudad son requeridos' }, { status: 400 });
    }

    const { leads, error } = await scrapeDoctoralia(especialidad, ciudad, paginas);

    if (error && leads.length === 0) {
      return NextResponse.json({ error }, { status: 502 });
    }

    const today  = new Date().toISOString();
    const nichoDB = nicho || especialidad;
    let newAdded  = 0;
    let updated   = 0;

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO leads (
        nombre, telefono, sitio_web, direccion,
        fuente, confianza_fuente,
        ciudad, municipio, estado_republica, nicho,
        whatsapp_verificado, sitio_activo,
        fecha_extraccion, status_crm, barrido_id
      ) VALUES (
        @nombre, @telefono, @sitio_web, @direccion,
        'doctoralia', @confianza,
        @ciudad, @municipio, @estado_republica, @nicho,
        @whatsapp_verificado, @sitio_activo,
        @fecha_extraccion, 'nuevo', @barrido_id
      )
    `);

    for (const lead of leads) {
      const dup = findDuplicate(lead.nombre, lead.telefono, ciudad);
      if (dup) {
        // Enriquecer datos faltantes
        const updates: string[] = [];
        const vals: any[] = [];
        if (!dup.telefono && lead.telefono)             { updates.push('telefono = ?');   vals.push(lead.telefono); }
        if (!dup.direccion && lead.direccion)           { updates.push('direccion = ?');  vals.push(lead.direccion); }
        if (!dup.sitio_web && lead.sitio_doctoralia)    { updates.push('sitio_web = ?');  vals.push(lead.sitio_doctoralia); }
        if (updates.length > 0) {
          vals.push(dup.id);
          db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...vals);
          updated++;
        }
        continue;
      }

      const v = await verifyContact({ telefono: lead.telefono, sitio_web: lead.sitio_doctoralia });

      // Confianza más alta si tiene reseñas (establecimiento activo)
      const confianza = (lead.reviews && lead.reviews > 5) ? 'alta' : 'media';

      const res = stmt.run({
        nombre:           lead.nombre,
        telefono:         lead.telefono   || null,
        sitio_web:        lead.sitio_doctoralia || null,
        direccion:        lead.direccion  || null,
        confianza,
        ciudad:           lead.ciudad     || ciudad,
        municipio:        municipio        || null,
        estado_republica: estado_republica || lead.estado || null,
        nicho:            nichoDB,
        whatsapp_verificado: v.whatsapp_verificado,
        sitio_activo:        v.sitio_activo,
        fecha_extraccion: today,
        barrido_id: barrido_id || null,
      });

      if (res.changes > 0) newAdded++;
    }

    return NextResponse.json({
      success:    true,
      scraped:    leads.length,
      new_added:  newAdded,
      updated,
      warning:    error || undefined,
    });

  } catch (err: any) {
    console.error('[scrape-doctoralia]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
