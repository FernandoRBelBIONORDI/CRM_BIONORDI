import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const usuarios = db.prepare(`SELECT id, nombre, email, rol, activo, cargo, created_at FROM usuarios ORDER BY id ASC`).all();
  return NextResponse.json({ usuarios });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if ((session?.user as any)?.role !== 'admin')
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const { nombre, email, password, rol, cargo } = await req.json();
    if (!nombre || !email || !password)
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO usuarios (nombre, email, password_hash, rol, cargo) VALUES (?, ?, ?, ?, ?)
    `).run(nombre, email, hash, rol || 'operador', cargo || null);

    const usuario = db.prepare(`SELECT id, nombre, email, rol, activo, cargo, created_at FROM usuarios WHERE id = ?`).get(result.lastInsertRowid);
    return NextResponse.json({ success: true, usuario });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return NextResponse.json({ error: 'El email ya existe' }, { status: 409 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
