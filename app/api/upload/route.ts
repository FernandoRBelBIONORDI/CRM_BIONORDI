import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Bypasses middleware (see middleware.ts) so Next.js 16 never buffers the body.
// Receives raw binary (Content-Type: application/octet-stream).
// subfolder and filename come as query params.
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

    if (!req.body)
      return NextResponse.json({ error: 'Sin body' }, { status: 400 });

    // Stream the body directly — avoids Next.js 16 body size limit on req.json() / req.arrayBuffer()
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const reader = req.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > MAX_BYTES)
        return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 413 });
      chunks.push(Buffer.from(value));
    }

    const buffer = Buffer.concat(chunks);
    if (buffer.length === 0)
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });

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
