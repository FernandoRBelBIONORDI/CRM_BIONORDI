import { NextResponse } from 'next/server';
import db from '@/lib/db';

function generarFolio(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(
    `SELECT folio FROM ordenes_trabajo WHERE folio LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`OT-${ym}-%`) as any;
  const seq = last ? parseInt(last.folio.split('-')[2]) + 1 : 1;
  return `OT-${ym}-${String(seq).padStart(3, '0')}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  const status  = searchParams.get('status');

  let rows: any[];
  if (lead_id) {
    rows = db.prepare(`
      SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono, l.ciudad as lead_ciudad
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.lead_id = ?
      ORDER BY o.id DESC
    `).all(Number(lead_id));
  } else if (status) {
    rows = db.prepare(`
      SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono, l.ciudad as lead_ciudad
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.status = ?
      ORDER BY o.fecha_ingreso DESC
    `).all(status);
  } else {
    rows = db.prepare(`
      SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono, l.ciudad as lead_ciudad
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      ORDER BY o.id DESC
    `).all();
  }

  return NextResponse.json({ ordenes: rows });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const now = new Date().toISOString();
    const folio = generarFolio();

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO ordenes_trabajo (
        folio, lead_id, equipo_tipo, equipo_marca, equipo_modelo, equipo_num_serie,
        falla_reportada, diagnostico, notas_tecnicas, tecnico,
        presupuesto, presupuesto_aprobado, precio_final,
        status, fecha_ingreso, fecha_compromiso, fecha_entrega, fecha_creacion
      ) VALUES (
        @folio, @lead_id, @equipo_tipo, @equipo_marca, @equipo_modelo, @equipo_num_serie,
        @falla_reportada, @diagnostico, @notas_tecnicas, @tecnico,
        @presupuesto, @presupuesto_aprobado, @precio_final,
        @status, @fecha_ingreso, @fecha_compromiso, @fecha_entrega, @fecha_creacion
      )
    `).run({
      folio,
      lead_id:              data.lead_id || null,
      equipo_tipo:          data.equipo_tipo || null,
      equipo_marca:         data.equipo_marca || null,
      equipo_modelo:        data.equipo_modelo || null,
      equipo_num_serie:     data.equipo_num_serie || null,
      falla_reportada:      data.falla_reportada || null,
      diagnostico:          data.diagnostico || null,
      notas_tecnicas:       data.notas_tecnicas || null,
      tecnico:              data.tecnico || null,
      presupuesto:          data.presupuesto || null,
      presupuesto_aprobado: data.presupuesto_aprobado || 0,
      precio_final:         data.precio_final || null,
      status:               data.status || 'recibido',
      fecha_ingreso:        data.fecha_ingreso || now.slice(0, 10),
      fecha_compromiso:     data.fecha_compromiso || null,
      fecha_entrega:        data.fecha_entrega || null,
      fecha_creacion:       now,
    });

    const orden = db.prepare(`
      SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono, l.ciudad as lead_ciudad
      FROM ordenes_trabajo o LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.id = ?
    `).get(Number(lastInsertRowid));

    return NextResponse.json({ success: true, orden });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const keys = Object.keys(updates);
    if (keys.length === 0) return NextResponse.json({ success: true });

    const setStr = keys.map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE ordenes_trabajo SET ${setStr} WHERE id = @id`).run({ ...updates, id });

    const orden = db.prepare(`
      SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono, l.ciudad as lead_ciudad
      FROM ordenes_trabajo o LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.id = ?
    `).get(id);

    return NextResponse.json({ success: true, orden });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    db.prepare(`DELETE FROM ordenes_trabajo WHERE id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
