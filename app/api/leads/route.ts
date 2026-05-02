import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { enrichLead } from '@/lib/claude';

const CSV_COLS = [
  'id','nombre','telefono','whatsapp','correo','sitio_web',
  'direccion','ciudad','municipio','estado_republica',
  'nicho','sub_nicho','tamano_estimado','nivel_socioeconomico',
  'tiene_ultrasonido','score_potencial','razon_score',
  'fuente','confianza_fuente','status_crm',
  'decisor_nombre','decisor_cargo','decisor_linkedin',
  'notas','fecha_extraccion','fecha_ultimo_contacto',
];
function buildCsv(leads: any[]) {
  const rows = leads.map(l =>
    CSV_COLS.map(c => `"${String(l[c] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  return new Response([CSV_COLS.join(','), ...rows].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="bionordi_leads.csv"',
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ids      = searchParams.get('ids');
  const format   = searchParams.get('format');
  const status      = searchParams.get('status') || '';
  const q           = searchParams.get('q') || '';
  const nicho       = searchParams.get('nicho') || '';
  const minScore    = Number(searchParams.get('min_score') || 0);
  const asignadoA   = searchParams.get('asignado_a') || '';
  const limit       = Number(searchParams.get('limit') || 75);
  const offset      = Number(searchParams.get('offset') || 0);

  // Exportar IDs seleccionados
  if (ids) {
    const idList = ids.split(',').map(Number).filter(Boolean);
    if (!idList.length) return NextResponse.json({ leads: [], total: 0 });
    const ph = idList.map(() => '?').join(',');
    const leads = db.prepare(`SELECT * FROM leads WHERE id IN (${ph}) ORDER BY id ASC`).all(...idList) as any[];
    if (format === 'csv') return buildCsv(leads);
    return NextResponse.json({ leads, total: leads.length });
  }

  // Construcción dinámica de WHERE
  const conds: string[] = [];
  const params: any[] = [];
  if (status && status !== 'todos') { conds.push('status_crm = ?'); params.push(status); }
  if (q) {
    conds.push('(LOWER(nombre) LIKE LOWER(?) OR LOWER(ciudad) LIKE LOWER(?) OR CAST(id AS TEXT) = ?)');
    params.push(`%${q}%`, `%${q}%`, q);
  }
  if (nicho) { conds.push('nicho = ?'); params.push(nicho); }
  if (minScore > 0) { conds.push('score_potencial >= ?'); params.push(minScore); }
  if (asignadoA) { conds.push('asignado_a = ?'); params.push(asignadoA); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total: number = (db.prepare(`SELECT COUNT(*) as n FROM leads ${where}`).get(...params) as any).n;

  // CSV: todos los resultados sin límite
  if (format === 'csv') {
    const leads = db.prepare(`SELECT * FROM leads ${where} ORDER BY id ASC`).all(...params) as any[];
    return buildCsv(leads);
  }

  const leads = db.prepare(
    `SELECT * FROM leads ${where} ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`
  ).all(...params) as any[];

  return NextResponse.json({ leads, total });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO leads (nombre, telefono, whatsapp, ciudad, estado_republica, nicho, notas, status_crm, asignado_a, fuente, confianza_fuente, fecha_extraccion, fecha_ultimo_cambio)
      VALUES (@nombre, @telefono, @whatsapp, @ciudad, @estado_republica, @nicho, @notas, @status_crm, @asignado_a, 'manual', 'media', @now, @now)
    `).run({
      nombre:           data.nombre || "Sin nombre",
      telefono:         data.telefono || null,
      whatsapp:         data.whatsapp || null,
      ciudad:           data.ciudad || null,
      estado_republica: data.estado_republica || null,
      nicho:            data.nicho || null,
      notas:            data.notas || null,
      status_crm:       data.status_crm || "nuevo",
      asignado_a:       data.asignado_a || null,
      now,
    });
    const leadId = result.lastInsertRowid as number;
    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId) as any;

    // Enriquecimiento AI en segundo plano — no bloquea la respuesta
    enrichLead(lead).then(enrichment => {
      if (!enrichment) return;
      db.prepare(`
        UPDATE leads SET
          sub_nicho = ?, tiene_ultrasonido = ?, tamano_estimado = ?,
          nivel_socioeconomico = ?, score_potencial = ?, razon_score = ?
        WHERE id = ?
      `).run(
        enrichment.tipo_especialidad_medica,
        enrichment.tiene_equipo_ultrasonido,
        enrichment.tamano_estimado,
        enrichment.nivel_socioeconomico_zona,
        enrichment.score_potencial_biomed,
        enrichment.razon_score,
        leadId,
      );
    }).catch(() => {});

    return NextResponse.json({ success: true, lead });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const data = await req.json();
    const { id, ...updates } = data;

    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });

    if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });

    // Auto-reminder: al pasar a cliente, programar seguimiento en 6 meses si no tiene uno ya
    if (updates.status_crm === 'cliente') {
      const existing = db.prepare(`SELECT fecha_proximo_contacto FROM leads WHERE id = ?`).get(id) as any;
      if (!existing?.fecha_proximo_contacto) {
        const sixMonths = new Date();
        sixMonths.setMonth(sixMonths.getMonth() + 6);
        updates.fecha_proximo_contacto = sixMonths.toISOString().slice(0, 10);
      }
    }

    // Whitelist de columnas permitidas — previene SQL injection
    const COLS = new Set([
      'nombre','telefono','correo','whatsapp','direccion','ciudad','municipio',
      'estado_republica','nicho','status_crm','confianza_fuente','notas',
      'fecha_seguimiento','fecha_proximo_contacto','score_potencial','prioridad',
      'whatsapp_verificado','sitio_activo','fuente','sitio_web','barrido_id','asignado_a',
    ]);
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => COLS.has(k))
    );
    if (Object.keys(safeUpdates).length === 0)
      return NextResponse.json({ success: true });

    const keys = Object.keys(safeUpdates);
    const setString = keys.map(k => `${k} = @${k}`).join(', ');

    db.prepare(
      `UPDATE leads SET ${setString}, fecha_ultimo_cambio = @fecha_cambio WHERE id = @id`
    ).run({ ...safeUpdates, fecha_cambio: new Date().toISOString(), id });

    const updated = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
    return NextResponse.json({ success: true, lead: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    db.prepare(`DELETE FROM leads WHERE id = ?`).run(id);
    db.prepare(`DELETE FROM interacciones WHERE lead_id = ?`).run(id);
    db.prepare(`DELETE FROM scripts WHERE lead_id = ?`).run(id);
    db.prepare(`DELETE FROM equipos_cliente WHERE lead_id = ?`).run(id);
    db.prepare(`DELETE FROM cotizaciones WHERE lead_id = ?`).run(id);
    db.prepare(`DELETE FROM ordenes_trabajo WHERE lead_id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
