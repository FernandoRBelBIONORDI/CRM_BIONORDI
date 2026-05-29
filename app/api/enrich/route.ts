import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { enrichLead } from '@/lib/claude';
import { requireAuth } from '@/lib/require-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const { session, unauth } = await requireAuth();
  if (unauth) return unauth;

  if (!rateLimit(`enrich:${session.user?.email}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes de IA. Esperá un momento.' }, { status: 429 });
  }

  try {
    const { id } = await req.json();

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any;
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const enrichment = await enrichLead(lead);

    if (!enrichment) {
       return NextResponse.json({ error: 'Failed to enrich via AI' }, { status: 500 });
    }

    // Update DB
    db.prepare(`
      UPDATE leads SET
        sub_nicho = @tipo_especialidad_medica,
        tiene_ultrasonido = @tiene_equipo_ultrasonido,
        tamano_estimado = @tamano_estimado,
        nivel_socioeconomico = @nivel_socioeconomico_zona,
        score_potencial = @score_potencial_biomed,
        razon_score = @razon_score
      WHERE id = @id
    `).run({
      ...enrichment,
      id
    });

    return NextResponse.json({ success: true, enrichment });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
