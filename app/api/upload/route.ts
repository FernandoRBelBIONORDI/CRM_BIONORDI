import { NextResponse } from 'next/server';
import Busboy from 'busboy';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');
const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// Parse multipart/form-data using busboy (req.formData() fails in Next.js App Router)
function parseMultipart(req: Request): Promise<{ fields: Record<string, string>; file: { buffer: Buffer; ext: string } | null }> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return reject(new Error('Content-Type must be multipart/form-data'));
    }

    const bb = Busboy({ headers: { 'content-type': contentType }, limits: { fileSize: MAX_BYTES } });
    const fields: Record<string, string> = {};
    let file: { buffer: Buffer; ext: string } | null = null;

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (_fieldname, stream, info) => {
      const ext = info.filename.split('.').pop()?.toLowerCase() || '';
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('limit', () => reject(new Error('Archivo demasiado grande (máx 20 MB)')));
      stream.on('end', () => { file = { buffer: Buffer.concat(chunks), ext }; });
    });

    bb.on('finish', () => resolve({ fields, file }));
    bb.on('error', reject);

    // Pipe the request body into busboy
    req.arrayBuffer().then(ab => {
      const readable = Readable.from(Buffer.from(ab));
      readable.pipe(bb);
    }).catch(reject);
  });
}

export async function POST(req: Request) {
  try {
    const { fields, file } = await parseMultipart(req);

    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const { ext, buffer } = file;
    if (!ALLOWED.has(ext)) {
      return NextResponse.json({ error: `Tipo no permitido (.${ext})` }, { status: 400 });
    }

    const subfolder = (fields.subfolder || 'equipos').replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'equipos';
    const filename  = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
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
