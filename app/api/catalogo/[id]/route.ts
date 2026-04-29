import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const { tipo, marca, modelo, descripcion, imagen_path, fotos_json, brochure_path, notas } = await req.json();
  if (!modelo?.trim()) return NextResponse.json({ error: 'El modelo es requerido' }, { status: 400 });

  db.prepare(`
    UPDATE catalogo_equipos
    SET tipo=?, marca=?, modelo=?, descripcion=?, imagen_path=?, fotos_json=?, brochure_path=?, notas=?
    WHERE id=?
  `).run(
    tipo || 'transductor',
    marca || null,
    modelo.trim(),
    descripcion || null,
    imagen_path || null,
    fotos_json ? JSON.stringify(fotos_json) : null,
    brochure_path || null,
    notas || null,
    id,
  );

  const equipo = db.prepare('SELECT * FROM catalogo_equipos WHERE id = ?').get(id);
  return NextResponse.json({ equipo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const equipo = db.prepare('SELECT imagen_path, fotos_json, brochure_path FROM catalogo_equipos WHERE id = ?').get(id) as any;

  const pathsToDelete: string[] = [];
  if (equipo?.imagen_path) pathsToDelete.push(equipo.imagen_path);
  if (equipo?.brochure_path) pathsToDelete.push(equipo.brochure_path);
  if (equipo?.fotos_json) {
    try { pathsToDelete.push(...JSON.parse(equipo.fotos_json)); } catch {}
  }

  const uploadsDir = path.resolve(process.cwd(), 'public', 'uploads');
  for (const p of pathsToDelete) {
    try {
      const abs = path.resolve(process.cwd(), 'public', p.replace(/^\//, ''));
      // Previene path traversal: solo eliminar dentro de public/uploads
      if (!abs.startsWith(uploadsDir)) continue;
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {}
  }

  db.prepare('DELETE FROM catalogo_equipos WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
