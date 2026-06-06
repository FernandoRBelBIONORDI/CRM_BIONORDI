import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET() {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const rows = db.prepare(`
      SELECT el.*, l.nombre as lead_nombre
      FROM email_logs el
      LEFT JOIN leads l ON el.lead_id = l.id
      ORDER BY el.fecha DESC
      LIMIT 50
    `).all();
    return NextResponse.json({ logs: rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email_logs_api]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
