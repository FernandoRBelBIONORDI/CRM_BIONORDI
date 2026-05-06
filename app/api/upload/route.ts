import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024;

// Receives raw binary body — avoids Next.js 16 multipart/form-data parsing bug.
// subfolder and filename are passed as query params.
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const subfolder = (searchParams.get('subfolder') || 'equipos')
      .replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'equipos';
    const origName = searchParams.get('filename') || 'file';
    const ext = origName.split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED.has(ext))
      return NextResponse.json({ error: `Tipo no permitido (.${ext})` }, { status: 400 });

    const buffer = Buffer.from(await req.arrayBuffer());
    if (buffer.length === 0)
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    if (buffer.length > MAX_BYTES)
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 413 });

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(UPLOAD_ROOT, subfolder);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return NextResponse.json({
      path: `/api/file/${subfolder}/${filename}`,
      isPdf: ext === 'pdf',
    });
  } catch (e: any) {
    console.error('[upload] ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
