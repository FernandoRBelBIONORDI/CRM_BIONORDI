import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);

  const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
  if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const interacciones = db.prepare(
    `SELECT * FROM interacciones WHERE lead_id = ? ORDER BY fecha DESC`
  ).all(id);

  const cotizaciones = db.prepare(
    `SELECT * FROM cotizaciones WHERE lead_id = ? ORDER BY fecha DESC`
  ).all(id);

  const equipos = db.prepare(
    `SELECT * FROM equipos_cliente WHERE lead_id = ? ORDER BY id DESC`
  ).all(id);

  const ordenes = db.prepare(
    `SELECT * FROM ordenes_trabajo WHERE lead_id = ? ORDER BY fecha_creacion DESC`
  ).all(id);

  return NextResponse.json({ lead, interacciones, cotizaciones, equipos, ordenes });
}
