import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ lead });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[lead_by_id_api]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
