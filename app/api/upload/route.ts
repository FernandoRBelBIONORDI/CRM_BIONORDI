import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Accepts { subfolder, filename, data: base64 } as JSON.
// Avoids multipart/form-data which Next.js 16 middleware truncates/corrupts.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { subfolder: rawSub = 'equipos', filename = 'file', data } = body;

    if (!data) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const ext = String(filename).split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED.has(ext))
      return NextResponse.json({ error: `Tipo no permitido (.${ext})` }, { status: 400 });

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length === 0)
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    if (buffer.length > MAX_BYTES)
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 413 });

    const subfolder = String(rawSub).replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'equipos';
    const newFilename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(UPLOAD_ROOT, subfolder);

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, newFilename), buffer);

    return NextResponse.json({
      path: `/api/file/${subfolder}/${newFilename}`,
      isPdf: ext === 'pdf',
    });
  } catch (e: any) {
    console.error('[upload] ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
