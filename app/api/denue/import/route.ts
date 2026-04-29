import { NextResponse } from 'next/server';
import path from 'path';
import { importDENUECSV, isDENUEImported } from '@/lib/denue';

export async function POST(req: Request) {
  try {
    // Ruta fija — nunca controlada por el usuario (previene path traversal)
    const csvPath = path.join(process.cwd(), 'db', 'denue', 'conjunto_de_datos', 'denue_inegi_62_.csv');
    const imported = importDENUECSV(csvPath);
    return NextResponse.json({ success: true, imported });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ imported: isDENUEImported() });
}
