import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const { status, notas } = await req.json();
    db.prepare(`UPDATE cotizaciones SET status = COALESCE(?, status), notas = COALESCE(?, notas) WHERE id = ?`)
      .run(status || null, notas ?? null, id);
    const row = db.prepare(`SELECT * FROM cotizaciones WHERE id = ?`).get(id);
    return NextResponse.json({ cotizacion: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    db.prepare(`DELETE FROM cotizaciones WHERE id = ?`).run(Number(rawId));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
