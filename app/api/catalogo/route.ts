import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    db.prepare(`UPDATE catalogo_equipos SET activo = 1 WHERE tipo = 'transductor'`).run();
  } catch {}

  const equipos = db.prepare(
    `SELECT * FROM catalogo_equipos WHERE activo = 1 ORDER BY tipo, marca, modelo`
  ).all();
  return NextResponse.json({ equipos });
}

export async function POST(req: Request) {
  const { tipo, marca, modelo, descripcion, imagen_path, fotos_json, brochure_path, notas, tipo_transductor } = await req.json();
  if (!modelo?.trim()) return NextResponse.json({ error: 'El modelo es requerido' }, { status: 400 });

  const result = db.prepare(`
    INSERT INTO catalogo_equipos (tipo, marca, modelo, descripcion, imagen_path, fotos_json, brochure_path, notas, tipo_transductor, fecha_alta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    new Date().toISOString(),
  );

  const equipo = db.prepare('SELECT * FROM catalogo_equipos WHERE id = ?').get(result.lastInsertRowid);
  return NextResponse.json({ equipo }, { status: 201 });
}
