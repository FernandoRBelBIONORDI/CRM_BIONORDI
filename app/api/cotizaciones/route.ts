import { NextResponse } from 'next/server';
import db from '@/lib/db';

function generarFolioBCS(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(
    `SELECT folio FROM cotizaciones WHERE folio LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`BCS-${ym}-%`) as any;
  const seq = last ? parseInt(last.folio.split('-')[2]) + 1 : 1;
  return `BCS-${ym}-${String(seq).padStart(3, '0')}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  const rows = leadId
    ? db.prepare(`SELECT * FROM cotizaciones WHERE lead_id = ? ORDER BY fecha DESC`).all(Number(leadId))
    : db.prepare(`SELECT c.*, l.nombre as lead_nombre FROM cotizaciones c LEFT JOIN leads l ON c.lead_id = l.id ORDER BY c.fecha DESC`).all();

  return NextResponse.json({ cotizaciones: rows });
}

export async function POST(req: Request) {
  try {
    const { lead_id, tipo, folio: folioParam, monto_total, items_json, eq_tipo, eq_marca, eq_modelo, notas, status, pdf_path } = await req.json();
    if (!tipo) return NextResponse.json({ error: 'tipo requerido' }, { status: 400 });

    const folio = folioParam || generarFolioBCS();
    const fecha = new Date().toISOString();
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO cotizaciones (lead_id, tipo, folio, monto_total, items_json, eq_tipo, eq_marca, eq_modelo, notas, status, fecha, pdf_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      lead_id || null,
      tipo,
      folio || null,
      monto_total || 0,
      items_json ? JSON.stringify(items_json) : null,
      eq_tipo || null,
      eq_marca || null,
      eq_modelo || null,
      notas || null,
      status || 'enviada',
      fecha,
      pdf_path || null,
    );

    return NextResponse.json({ id: lastInsertRowid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
