import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Middleware bypassed (middleware.ts) — auth checked here via getToken.
// Body: raw binary (application/octet-stream). subfolder + filename as query params.
export async function POST(req: Request) {
  try {
    const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const subfolder = (searchParams.get('subfolder') || 'equipos')
      .replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'equipos';
    const filename = searchParams.get('filename') || 'file';
    const ext = String(filename).split('.').pop()?.toLowerCase() || '';

    if (!ALLOWED.has(ext))
      return NextResponse.json({ error: `Tipo no permitido (.${ext})` }, { status: 400 });

    const ab = await req.arrayBuffer();
    if (ab.byteLength === 0)
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    if (ab.byteLength > MAX_BYTES)
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 413 });

    const buffer = Buffer.from(ab);

    const originalBase = String(filename)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9_.-]/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'file';
    const newFilename = `${Date.now()}-${originalBase}.${ext}`;
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
