import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function GET() {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const rows = db.prepare(`SELECT clave, valor FROM configuracion`).all() as any[];
  const config: Record<string, string> = {};
  rows.forEach(r => { config[r.clave] = r.valor; });
  return NextResponse.json({ config });
}

export async function POST(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const updates: Record<string, string> = await req.json();
    const stmt = db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES (?, ?)`);
    const upsertMany = db.transaction((entries: [string, string][]) => {
      for (const [k, v] of entries) stmt.run(k, v);
    });
    upsertMany(Object.entries(updates));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
