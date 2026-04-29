import { NextResponse } from 'next/server';
import db from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { leadId, folio, pdfBase64, cotizacionId } = await req.json();

    if (!folio || !pdfBase64) {
      return NextResponse.json({ error: 'folio y pdfBase64 son requeridos' }, { status: 400 });
    }

    const dir = leadId
      ? path.join(process.cwd(), 'public', 'uploads', 'expedientes', String(leadId))
      : path.join(process.cwd(), 'public', 'uploads', 'expedientes', 'sin_lead');

    fs.mkdirSync(dir, { recursive: true });

    const filename = `${folio}.pdf`;
    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, Buffer.from(pdfBase64, 'base64'));

    const relativePath = leadId
      ? `/uploads/expedientes/${leadId}/${filename}`
      : `/uploads/expedientes/sin_lead/${filename}`;

    // Actualizar registro de cotización si se proporcionó id
    if (cotizacionId) {
      db.prepare(`UPDATE cotizaciones SET pdf_path = ? WHERE id = ?`).run(relativePath, cotizacionId);
    }

    return NextResponse.json({ success: true, path: relativePath });
  } catch (e: any) {
    console.error('[expediente]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leadId = searchParams.get('lead_id');

  if (!leadId) return NextResponse.json({ files: [] });

  const rows = db.prepare(
    `SELECT id, folio, tipo, monto_total, status, fecha, pdf_path FROM cotizaciones WHERE lead_id = ? AND pdf_path IS NOT NULL ORDER BY fecha DESC`
  ).all(Number(leadId));

  return NextResponse.json({ files: rows });
}
