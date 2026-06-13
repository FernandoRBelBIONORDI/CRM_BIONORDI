import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

const DB_UPLOADS = path.join(process.cwd(), 'db', 'uploads');

function deleteUploadedFile(storedPath: string) {
  try {
    // Supports both new format (/api/file/subfolder/file) and old (/uploads/subfolder/file)
    let rel: string;
    if (storedPath.startsWith('/api/file/')) {
      rel = storedPath.replace(/^\/api\/file\//, '');
    } else if (storedPath.startsWith('/uploads/')) {
      // old format — files may no longer exist (public/ is ephemeral on Railway)
      rel = storedPath.replace(/^\/uploads\//, '');
    } else {
      return;
    }
    const abs = path.join(DB_UPLOADS, rel);
    if (!abs.startsWith(DB_UPLOADS)) return; // path traversal guard
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const { tipo, marca, modelo, descripcion, imagen_path, fotos_json, brochure_path, notas, tipo_transductor } = await req.json();
  if (!modelo?.trim()) return NextResponse.json({ error: 'El modelo es requerido' }, { status: 400 });

  db.prepare(`
    UPDATE catalogo_equipos
    SET tipo=?, marca=?, modelo=?, descripcion=?, imagen_path=?, fotos_json=?, brochure_path=?, notas=?, tipo_transductor=?
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
    tipo_transductor || null,
    id,
  );

  const equipo = db.prepare('SELECT * FROM catalogo_equipos WHERE id = ?').get(id);
  return NextResponse.json({ equipo });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  const equipo = db.prepare('SELECT imagen_path, fotos_json, brochure_path FROM catalogo_equipos WHERE id = ?').get(id) as any;

  if (equipo?.imagen_path) deleteUploadedFile(equipo.imagen_path);
  if (equipo?.brochure_path) deleteUploadedFile(equipo.brochure_path);
  if (equipo?.fotos_json) {
    try {
      for (const p of JSON.parse(equipo.fotos_json)) deleteUploadedFile(p);
    } catch {}
  }

  db.prepare('DELETE FROM catalogo_equipos WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
