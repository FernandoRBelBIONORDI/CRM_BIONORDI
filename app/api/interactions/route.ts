import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');
  if (!leadId) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });

  const rows = db.prepare(
    `SELECT * FROM interacciones WHERE lead_id = ? ORDER BY fecha DESC`
  ).all(leadId);
  return NextResponse.json({ interacciones: rows });
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const { lead_id, tipo, contenido, resultado } = await req.json();
    if (!lead_id || !tipo || !contenido)
      return NextResponse.json({ error: 'lead_id, tipo y contenido son requeridos' }, { status: 400 });

    const fecha = new Date().toISOString();
    const usuario_id = (session?.user as any)?.id ?? null;
    const usuario_nombre = session?.user?.name ?? null;

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO interacciones (lead_id, tipo, contenido, fecha, resultado, usuario_id, usuario_nombre)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(lead_id, tipo, contenido, fecha, resultado || null, usuario_id, usuario_nombre);

    db.prepare(
      `UPDATE leads SET fecha_ultimo_contacto = ?, fecha_ultimo_cambio = ? WHERE id = ?`
    ).run(fecha, fecha, lead_id);

    return NextResponse.json({ success: true, id: lastInsertRowid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    db.prepare(`DELETE FROM interacciones WHERE id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
