import { NextResponse } from 'next/server';
import path from 'path';
import { importDENUECSV, isDENUEImported } from '@/lib/denue';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const csvRelPath = body.path || 'db/denue/conjunto_de_datos/denue_inegi_62_.csv';
    const csvPath = path.join(process.cwd(), csvRelPath);
    const imported = importDENUECSV(csvPath);
    return NextResponse.json({ success: true, imported });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ imported: isDENUEImported() });
}
