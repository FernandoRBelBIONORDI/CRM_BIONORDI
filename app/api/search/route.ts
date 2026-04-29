import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { searchGooglePlaces } from '@/lib/google-places';
import { verifyContact } from '@/lib/verificacion';
import { searchDENUE, nombreSimilarity } from '@/lib/denue';

function findDuplicate(nombre: string, telefono: string | undefined, ciudad: string): any | null {
  // 1. Match exacto por teléfono
  if (telefono) {
    const byPhone = db.prepare(
      `SELECT * FROM leads WHERE telefono = ? AND ciudad = ? LIMIT 1`
    ).get(telefono, ciudad);
    if (byPhone) return byPhone;
  }

  // 2. Match por nombre similar (Jaccard > 0.55) en la misma ciudad
  const candidates = db.prepare(
    `SELECT * FROM leads WHERE ciudad = ?`
  ).all(ciudad) as any[];

  for (const c of candidates) {
    if (c.nombre && nombreSimilarity(c.nombre, nombre) > 0.55) return c;
  }

  return null;
}

function mergeIntoExisting(existing: any, patch: Record<string, any>) {
  const updates: string[] = [];
  const values: any[] = [];

  for (const [key, val] of Object.entries(patch)) {
    if (val && !existing[key]) {
      updates.push(`${key} = ?`);
      values.push(val);
    }
  }

  if (updates.length === 0) return;
  values.push(existing.id);
  db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`).run(...values);
}

export async function POST(req: Request) {
  try {
    const { nicho, ciudad, estado_republica, municipio, barrido_id, max_paginas } = await req.json();

    if (!nicho || !ciudad) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    const today = new Date().toISOString();

    // ETAPA 1A — Google Places
    const placesLeads = await searchGooglePlaces(nicho, ciudad, max_paginas || 3);

    // ETAPA 1B — DENUE (cross-reference local), respeta el mismo límite que Google
    const denueLimit = (max_paginas || 3) * 20;
    const denueLeads = searchDENUE(ciudad, nicho, denueLimit);

    let newAdded = 0;

    for (const place of placesLeads) {
      // ETAPA 2 — Verificación Proof of Life
      const v = await verifyContact({ telefono: place.telefono, sitio_web: place.sitio_web });

      // ETAPA 2 — Cruce con DENUE: buscar coincidencia por nombre
      let confianza = 'media';
      let fuenteFinal = 'google_places';

      const match = denueLeads.find(d => nombreSimilarity(d.nom_estab, place.nombre) > 0.4);
      if (match) {
        confianza = 'alta';
        fuenteFinal = 'google_places+denue';
        if (!place.telefono && match.telefono) place.telefono = match.telefono;
        if (!place.sitio_web && match.www) place.sitio_web = match.www;
      } else {
        confianza = place.confianza_fuente;
      }

      // ETAPA 3 — Detección de duplicados antes de insertar
      const dup = findDuplicate(place.nombre, place.telefono, ciudad);
      if (dup) {
        mergeIntoExisting(dup, {
          telefono: place.telefono,
          sitio_web: place.sitio_web,
          direccion: place.direccion,
          google_place_id: place.google_place_id,
          whatsapp_verificado: v.whatsapp_verificado,
          sitio_activo: v.sitio_activo,
        });
        continue; // no contar como nuevo
      }

      // ETAPA 4 — Insertar en DB
      const stmt = db.prepare(`
        INSERT OR IGNORE INTO leads (
          nombre, telefono, sitio_web, direccion,
          fuente, confianza_fuente, google_place_id,
          ciudad, municipio, estado_republica, nicho,
          whatsapp_verificado, sitio_activo,
          fecha_extraccion, status_crm, barrido_id
        ) VALUES (
          @nombre, @telefono, @sitio_web, @direccion,
          @fuente, @confianza_fuente, @google_place_id,
          @ciudad, @municipio, @estado_republica, @nicho,
          @whatsapp_verificado, @sitio_activo,
          @fecha_extraccion, 'nuevo', @barrido_id
        )
      `);

      const result = stmt.run({
        nombre:            place.nombre,
        telefono:          place.telefono,
        sitio_web:         place.sitio_web,
        direccion:         place.direccion,
        fuente:            fuenteFinal,
        confianza_fuente:  confianza,
        google_place_id:   place.google_place_id,
        ciudad,
        municipio:         municipio || null,
        estado_republica:  estado_republica || null,
        nicho,
        whatsapp_verificado: v.whatsapp_verificado,
        sitio_activo:      v.sitio_activo,
        fecha_extraccion:  today,
        barrido_id:        barrido_id || null,
      });

      if (result.changes > 0) newAdded++;
    }

    // También insertar leads sólo DENUE que no matchearon Google Places
    for (const d of denueLeads) {
      const yaExiste = placesLeads.find((p: any) => nombreSimilarity(p.nombre, d.nom_estab) > 0.4);
      if (!yaExiste && d.nom_estab) {
        const dup = findDuplicate(d.nom_estab, d.telefono, ciudad);
        if (dup) {
          mergeIntoExisting(dup, {
            telefono: d.telefono,
            sitio_web: d.www,
            correo: d.e_mail,
          });
          continue;
        }

        const v = await verifyContact({ telefono: d.telefono, sitio_web: d.www });
        const res = db.prepare(`
          INSERT OR IGNORE INTO leads (
            nombre, telefono, sitio_web, correo, fuente, confianza_fuente,
            ciudad, municipio, estado_republica, nicho,
            whatsapp_verificado, sitio_activo, fecha_extraccion, status_crm, barrido_id
          ) VALUES (
            @nombre, @telefono, @sitio_web, @correo, 'denue', 'media',
            @ciudad, @municipio, @estado_republica, @nicho,
            @whatsapp_verificado, @sitio_activo, @fecha_extraccion, 'nuevo', @barrido_id
          )
        `).run({
          nombre:           d.nom_estab,
          telefono:         d.telefono || null,
          sitio_web:        d.www || null,
          correo:           d.e_mail || null,
          ciudad,
          municipio:        d.municipio || municipio || null,
          estado_republica: d.entidad || estado_republica || null,
          nicho,
          whatsapp_verificado: v.whatsapp_verificado,
          sitio_activo:     v.sitio_activo,
          fecha_extraccion: today,
          barrido_id:       barrido_id || null,
        });
        if (res.changes > 0) newAdded++;
      }
    }

    // Guardar búsqueda en historial
    db.prepare(`
      INSERT INTO busquedas (nicho, ciudad, estado_republica, municipio, fecha, leads_encontrados, filtros_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nicho, ciudad, estado_republica || null, municipio || null, today, newAdded, JSON.stringify({ nicho, ciudad }));

    return NextResponse.json({
      success: true,
      found_in_maps: placesLeads.length,
      found_in_denue: denueLeads.length,
      new_added: newAdded,
    });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
