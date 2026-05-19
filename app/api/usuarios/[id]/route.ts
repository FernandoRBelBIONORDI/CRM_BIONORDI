import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { nombre, email, password, rol, activo, cargo } = await req.json();
    const { id: rawId } = await params;
    const id = Number(rawId);

    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare(`UPDATE usuarios SET password_hash = ? WHERE id = ?`).run(hash, id);
    }

    const COLS = new Set(['nombre', 'email', 'rol', 'activo', 'cargo']);
    const updates: Record<string, any> = {};
    for (const [k, v] of Object.entries({ nombre, email, rol, activo, cargo })) {
      if (v !== undefined && COLS.has(k)) updates[k] = v;
    }

    if (Object.keys(updates).length > 0) {
      const setStr = Object.keys(updates).map(k => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE usuarios SET ${setStr} WHERE id = @id`).run({ ...updates, id });
    }

    const usuario = db.prepare(`SELECT id, nombre, email, rol, activo, cargo, created_at FROM usuarios WHERE id = ?`).get(id);
    return NextResponse.json({ success: true, usuario });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  const me = (session?.user as any)?.id;
  if (me && Number(me) === id)
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });

  db.prepare(`UPDATE usuarios SET activo = 0 WHERE id = ?`).run(id);
  return NextResponse.json({ success: true });
}
