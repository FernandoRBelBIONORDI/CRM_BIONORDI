import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get('days') || 14);

  const today = new Date().toISOString().slice(0, 10);
  const future = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const events = db.prepare(`
    SELECT id AS lead_id, nombre AS lead_nombre, status_crm, fecha_proximo_contacto, asignado_a
    FROM leads
    WHERE fecha_proximo_contacto IS NOT NULL
      AND fecha_proximo_contacto != ''
      AND fecha_proximo_contacto >= ?
      AND fecha_proximo_contacto <= ?
    ORDER BY fecha_proximo_contacto ASC
    LIMIT 30
  `).all(today, future) as any[];

  return NextResponse.json({ agenda: events });
}
