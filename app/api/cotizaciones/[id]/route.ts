import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = await req.json();

    if (body.tipo) {
      db.prepare(`
        UPDATE cotizaciones SET 
          tipo = ?, monto_total = ?, items_json = ?, eq_tipo = ?, 
          eq_marca = ?, eq_modelo = ?, eq_descripcion = ?, notas = ?, pdf_path = COALESCE(?, pdf_path), status = COALESCE(?, status)
        WHERE id = ?
      `).run(
        body.tipo, body.monto_total || 0, body.items_json ? JSON.stringify(body.items_json) : null,
        body.eq_tipo || null, body.eq_marca || null, body.eq_modelo || null, body.eq_descripcion || null, body.notas || null,
        body.pdf_path || null, body.status || null, id
      );
    } else {
      db.prepare(`UPDATE cotizaciones SET status = COALESCE(?, status), notas = COALESCE(?, notas) WHERE id = ?`)
        .run(body.status || null, body.notas ?? null, id);
    }

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
