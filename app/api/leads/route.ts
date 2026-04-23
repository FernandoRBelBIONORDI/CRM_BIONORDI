import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status   = searchParams.get('status');
  const format   = searchParams.get('format');
  const ids      = searchParams.get('ids'); // "1,2,3" para exportar selección

  let leads: any[] = [];

  if (ids) {
    const idList = ids.split(',').map(Number).filter(Boolean);
    if (idList.length === 0) return NextResponse.json({ leads: [] });
    const placeholders = idList.map(() => '?').join(',');
    leads = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders}) ORDER BY id DESC`).all(...idList);
  } else if (status) {
    leads = db.prepare('SELECT * FROM leads WHERE status_crm = ? ORDER BY id DESC').all(status);
  } else {
    leads = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  }

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

  return NextResponse.json({ leads });
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

    // Calcular keys DESPUÉS de posibles mutaciones del auto-reminder
    const keys = Object.keys(updates);
    const setString = keys.map(k => `${k} = @${k}`).join(', ');

    db.prepare(
      `UPDATE leads SET ${setString}, fecha_ultimo_cambio = @fecha_cambio WHERE id = @id`
    ).run({ ...updates, fecha_cambio: new Date().toISOString(), id });

    return NextResponse.json({ success: true });
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
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
