import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import Busboy from 'busboy';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

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

    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data'))
      return NextResponse.json({ error: 'Se requiere multipart/form-data' }, { status: 400 });

    if (!req.body)
      return NextResponse.json({ error: 'Body vacío' }, { status: 400 });

    // Use busboy to parse multipart — bypasses Next.js internal body size limits
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const bb = Busboy({ headers: { 'content-type': contentType }, limits: { fileSize: MAX_BYTES + 1 } });
      let found = false;

      bb.on('file', (_field, file) => {
        found = true;
        const chunks: Buffer[] = [];
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('end', () => resolve(Buffer.concat(chunks)));
        file.on('error', reject);
      });

      bb.on('finish', () => {
        if (!found) reject(new Error('Sin archivo en el campo "file"'));
      });
      bb.on('error', reject);

      Readable.fromWeb(req.body as any).pipe(bb);
    });

    if (fileBuffer.length === 0)
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    if (fileBuffer.length > MAX_BYTES)
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 413 });

    const originalBase = String(filename)
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9_.-]/gi, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'file';
    const newFilename = `${Date.now()}-${originalBase}.${ext}`;
    const uploadDir = path.join(UPLOAD_ROOT, subfolder);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, newFilename), fileBuffer);

    return NextResponse.json({
      path: `/api/file/${subfolder}/${newFilename}`,
      isPdf: ext === 'pdf',
    });
  } catch (e: any) {
    console.error('[upload] ERROR:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
