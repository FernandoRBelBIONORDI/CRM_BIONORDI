import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function POST() {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const now = new Date().toISOString();

  const cfgRows = db.prepare(
    `SELECT clave, valor FROM configuracion WHERE clave = 'dias_alerta_seguimiento'`
  ).all() as any[];
  const diasSeguimiento = parseInt((cfgRows[0] as any)?.valor || '3', 10);

  const cutoff = new Date(Date.now() - diasSeguimiento * 24 * 60 * 60 * 1000).toISOString();

  const { changes } = db.prepare(`
    UPDATE leads SET status_crm = 'seguimiento', fecha_ultimo_cambio = ?
    WHERE status_crm = 'contactado'
      AND (fecha_ultimo_cambio < ? OR fecha_ultimo_cambio IS NULL)
  `).run(now, cutoff);

  return NextResponse.json({ success: true, moved: changes });
}
