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
  mp4:  'video/mp4',
  webm: 'video/webm',
  mov:  'video/quicktime',
  mp3:  'audio/mpeg',
  ogg:  'audio/ogg',
  oga:  'audio/ogg',
  m4a:  'audio/mp4',
  aac:  'audio/aac',
  opus: 'audio/opus',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt:  'text/plain',
  zip:  'application/zip',
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
    return new Response('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response('Not found', { status: 404 });
  }

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const mime = MIME[ext] || 'application/octet-stream';
  const nodeBuffer = fs.readFileSync(filePath);

  const isDownload = ['pdf','doc','docx','xls','xlsx','ppt','pptx','zip','txt'].includes(ext);
  const cacheControl = isDownload ? 'no-store' : 'public, max-age=31536000, immutable';
  const disposition = isDownload
    ? `attachment; filename="${path.basename(filePath)}"`
    : 'inline';

  return new Response(new Uint8Array(nodeBuffer), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': disposition,
      'Content-Length': String(nodeBuffer.byteLength),
      'Cache-Control': cacheControl,
    },
  });
}
