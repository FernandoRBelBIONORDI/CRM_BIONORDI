import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leads = db.prepare(`
    SELECT id, nombre, nicho, telefono, whatsapp, correo, ciudad, estado_republica,
           status_crm, score_potencial, fecha_extraccion
    FROM leads
    WHERE barrido_id = ?
    ORDER BY fecha_extraccion DESC
  `).all(id);
  return NextResponse.json({ leads });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sets: string[] = [];
  const vals: any[] = [];
  if (body.nombre !== undefined) { sets.push('nombre = ?'); vals.push(body.nombre); }
  if (body.notas  !== undefined) { sets.push('notas = ?');  vals.push(body.notas);  }
  if (sets.length) {
    vals.push(id);
    db.prepare(`UPDATE barridos SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  }
  return NextResponse.json({ success: true });
}
