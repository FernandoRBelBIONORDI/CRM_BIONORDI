import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/require-auth';

// Persiste en el volumen de Railway — no en public/ (que es efímero)
const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads', 'expedientes');

export async function POST(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { leadId, folio, pdfBase64, cotizacionId } = await req.json();

    if (!folio || !pdfBase64)
      return NextResponse.json({ error: 'folio y pdfBase64 son requeridos' }, { status: 400 });

    const subdir = leadId ? String(leadId) : 'sin_lead';
    const dir = path.join(UPLOAD_ROOT, subdir);
    fs.mkdirSync(dir, { recursive: true });

    const filename = `${folio}.pdf`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(pdfBase64, 'base64'));

    const filePath = `/api/file/expedientes/${subdir}/${filename}`;

    if (cotizacionId)
      db.prepare(`UPDATE cotizaciones SET pdf_path = ? WHERE id = ?`).run(filePath, cotizacionId);

    return NextResponse.json({ success: true, path: filePath });
  } catch (e: any) {
    console.error('[expediente]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  if (!leadId) return NextResponse.json({ files: [] });

  const rows = db.prepare(
    `SELECT id, folio, tipo, monto_total, status, fecha, pdf_path
     FROM cotizaciones WHERE lead_id = ? AND pdf_path IS NOT NULL ORDER BY fecha DESC`
  ).all(Number(leadId));

  return NextResponse.json({ files: rows });
}
