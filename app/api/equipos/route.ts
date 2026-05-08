import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  if (!lead_id) return NextResponse.json({ error: 'Falta lead_id' }, { status: 400 });

  const equipos = db.prepare(
    `SELECT * FROM equipos_cliente WHERE lead_id = ? ORDER BY fecha_alta DESC`
  ).all(Number(lead_id));

  return NextResponse.json({ equipos });
}

export async function POST(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { lead_id, tipo, marca, modelo, num_serie, estado, notas } = await req.json();
  if (!lead_id || !tipo) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const fecha_alta = new Date().toISOString();
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO equipos_cliente (lead_id, tipo, marca, modelo, num_serie, estado, notas, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead_id, tipo, marca || null, modelo || null, num_serie || null, estado || 'activo', notas || null, fecha_alta);

  return NextResponse.json({ id: Number(lastInsertRowid) });
}

export async function PATCH(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { id, tipo, marca, modelo, num_serie, estado, notas } = await req.json();
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  db.prepare(`
    UPDATE equipos_cliente SET tipo=?, marca=?, modelo=?, num_serie=?, estado=?, notas=? WHERE id=?
  `).run(tipo, marca || null, modelo || null, num_serie || null, estado || 'activo', notas || null, id);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { id } = await req.json();
  db.prepare(`DELETE FROM equipos_cliente WHERE id = ?`).run(id);
  return NextResponse.json({ success: true });
}
