import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status');
  const format   = searchParams.get('format');
  const ids      = searchParams.get('ids'); // "1,2,3" para exportar selección
  const limitRaw  = parseInt(searchParams.get('limit')  || '', 10);
  const offsetRaw = parseInt(searchParams.get('offset') || '', 10);
  const limit    = !isNaN(limitRaw)  && limitRaw  > 0 ? limitRaw  : null;
  const offset   = !isNaN(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  let leads: any[] = [];

  if (ids) {
    const idList = ids.split(',').map(Number).filter(Boolean);
    if (idList.length === 0) return NextResponse.json({ leads: [] });
    const placeholders = idList.map(() => '?').join(',');
    leads = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders}) ORDER BY id DESC`).all(...idList);
  } else if (status) {
    const q = limit
      ? `SELECT * FROM leads WHERE status_crm = ? ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
      : 'SELECT * FROM leads WHERE status_crm = ? ORDER BY id DESC';
    leads = db.prepare(q).all(status);
  } else {
    const q = limit
      ? `SELECT * FROM leads ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`
      : 'SELECT * FROM leads ORDER BY id DESC';
    leads = db.prepare(q).all();
  }
  const total: number = (db.prepare('SELECT COUNT(*) as n FROM leads').get() as any).n;

  // Exportar CSV
  if (format === 'csv') {
    const cols = [
      'id','nombre','telefono','whatsapp','correo','sitio_web',
      'direccion','ciudad','municipio','estado_republica',
      'nicho','sub_nicho','tamano_estimado','nivel_socioeconomico',
      'tiene_ultrasonido','score_potencial','razon_score',
      'fuente','confianza_fuente','status_crm',
      'decisor_nombre','decisor_cargo','decisor_linkedin',
      'notas','fecha_extraccion','fecha_ultimo_contacto'
    ];
    const header = cols.join(',');
    const rows = leads.map(l =>
      cols.map(c => {
        const val = String(l[c] ?? '').replace(/"/g, '""');
        return `"${val}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="bionordi_leads.csv"',
      },
    });
  }

  return NextResponse.json({ leads, total });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO leads (nombre, telefono, ciudad, estado_republica, nicho, notas, status_crm, fuente, confianza_fuente, fecha_extraccion, fecha_ultimo_cambio)
      VALUES (@nombre, @telefono, @ciudad, @estado_republica, @nicho, @notas, @status_crm, 'manual', 'media', @now, @now)
    `).run({
      nombre:           data.nombre || "Sin nombre",
      telefono:         data.telefono || null,
      ciudad:           data.ciudad || null,
      estado_republica: data.estado_republica || null,
      nicho:            data.nicho || null,
      notas:            data.notas || null,
      status_crm:       data.status_crm || "nuevo",
      now,
    });
    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(result.lastInsertRowid);
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
      'whatsapp_verificado','sitio_activo','fuente','sitio_web','barrido_id',
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
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
