import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { searchGooglePlaces } from '@/lib/google-places';
import { verifyContact } from '@/lib/verificacion';
import { searchDENUE, nombreSimilarity } from '@/lib/denue';
import zonas from '@/data/zonas_mexico.json';

export async function POST(req: Request) {
  try {
    const { nicho, ciudad } = await req.json();
    if (!nicho || !ciudad) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

    const today = new Date().toISOString();
    const zonasDisponibles = (zonas as Record<string, string[]>)[ciudad];

    // Si no hay zonas definidas, buscar ciudad entera
    const targets: string[] = zonasDisponibles
      ? zonasDisponibles.map(z => `${z}, ${ciudad}`)
      : [ciudad];

    let totalAdded = 0;
    let totalFound = 0;
    const progreso: { zona: string; encontrados: number; nuevos: number }[] = [];

    for (const target of targets) {
      const placesLeads = await searchGooglePlaces(nicho, target);
      const denueLeads = searchDENUE(ciudad, nicho);
      let zonaAdded = 0;

      for (const place of placesLeads) {
        const v = await verifyContact({ telefono: place.telefono, sitio_web: place.sitio_web });
        const match = denueLeads.find((d: any) => nombreSimilarity(d.nom_estab, place.nombre) > 0.4);
        let confianza = place.confianza_fuente;
        let fuenteFinal = 'google_places';
        if (match) { confianza = 'alta'; fuenteFinal = 'google_places+denue'; }

        const result = db.prepare(`
          INSERT OR IGNORE INTO leads (
            nombre, telefono, sitio_web, direccion,
            fuente, confianza_fuente, google_place_id,
            ciudad, municipio, estado_republica, nicho,
            whatsapp_verificado, sitio_activo, fecha_extraccion, status_crm
          ) VALUES (
            @nombre, @telefono, @sitio_web, @direccion,
            @fuente, @confianza_fuente, @google_place_id,
            @ciudad, @municipio, @estado_republica, @nicho,
            @whatsapp_verificado, @sitio_activo, @fecha_extraccion, 'nuevo'
          )
        `).run({
          nombre: place.nombre, telefono: place.telefono, sitio_web: place.sitio_web,
          direccion: place.direccion, fuente: fuenteFinal, confianza_fuente: confianza,
          google_place_id: place.google_place_id,
          ciudad, municipio: target, estado_republica: ciudad, nicho,
          whatsapp_verificado: v.whatsapp_verificado, sitio_activo: v.sitio_activo,
          fecha_extraccion: today,
        });

        if (result.changes > 0) zonaAdded++;
      }

      totalFound += placesLeads.length;
      totalAdded += zonaAdded;
      progreso.push({ zona: target, encontrados: placesLeads.length, nuevos: zonaAdded });

      // Guardar búsqueda por zona
      db.prepare(`INSERT INTO busquedas (nicho, ciudad, estado_republica, municipio, fecha, leads_encontrados, filtros_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(nicho, ciudad, ciudad, target, today, zonaAdded, JSON.stringify({ nicho, zona: target }));
    }

    return NextResponse.json({ success: true, total_found: totalFound, total_added: totalAdded, zonas: progreso });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
