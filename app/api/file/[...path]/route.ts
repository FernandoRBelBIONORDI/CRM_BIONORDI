import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');

const MIME: Record<string, string> = {
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
  gif:  'image/gif',
  pdf:  'application/pdf',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const segments = (await params).path;

  // Prevent path traversal
  const safe = segments.map(s => path.basename(s));
  const filePath = path.join(UPLOAD_ROOT, ...safe);

  if (!filePath.startsWith(UPLOAD_ROOT)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const mime = MIME[ext] || 'application/octet-stream';
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
