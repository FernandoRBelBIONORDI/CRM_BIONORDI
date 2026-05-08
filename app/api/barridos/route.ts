import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const rows = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM leads WHERE barrido_id = b.id) as leads_actuales
    FROM barridos b
    ORDER BY b.fecha DESC
    LIMIT 50
  `).all() as any[];

  // Single query for all status breakdowns — avoids N+1
  const breakdowns = db.prepare(`
    SELECT barrido_id, status_crm, COUNT(*) as count
    FROM leads
    WHERE barrido_id IS NOT NULL
    GROUP BY barrido_id, status_crm
  `).all() as any[];

  const bdMap = new Map<number, any[]>();
  for (const r of breakdowns) {
    if (!bdMap.has(r.barrido_id)) bdMap.set(r.barrido_id, []);
    bdMap.get(r.barrido_id)!.push({ status_crm: r.status_crm, count: r.count });
  }

  const barridos = rows.map(b => ({ ...b, statusBreakdown: bdMap.get(b.id) || [] }));

  return NextResponse.json({ barridos });
}

export async function POST(req: Request) {
  const { nombre, nicho, estado, zonas, max_por_zona, fuente, especialidad, notas } = await req.json();
  const fecha = new Date().toISOString();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO barridos (nombre, nicho, estado, zonas_json, max_por_zona, fecha, completado, fuente, especialidad, notas)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `).run(nombre, nicho || null, estado || null, JSON.stringify(zonas || []), max_por_zona || 60, fecha,
    fuente || 'google', especialidad || null, notas || null);
  return NextResponse.json({ id: Number(lastInsertRowid) });
}

export async function PATCH(req: Request) {
  const { id, total_encontrados, total_nuevos, zonas_completadas, completado } = await req.json();
  db.prepare(`
    UPDATE barridos
    SET total_encontrados = total_encontrados + ?,
        total_nuevos      = total_nuevos + ?,
        zonas_completadas = ?,
        completado        = COALESCE(?, completado)
    WHERE id = ?
  `).run(total_encontrados || 0, total_nuevos || 0, zonas_completadas ?? null, completado ?? null, id);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  db.prepare(`UPDATE leads SET barrido_id = NULL WHERE barrido_id = ?`).run(id);
  db.prepare(`DELETE FROM barridos WHERE id = ?`).run(id);
  return NextResponse.json({ success: true });
}
