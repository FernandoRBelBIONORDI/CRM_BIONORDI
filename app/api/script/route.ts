import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateScripts } from '@/lib/claude';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();

    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as any;
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });

    const scripts = await generateScripts({
      empresa: lead.nombre,
      medico: lead.decisor_nombre,
      nicho: lead.sub_nicho || lead.nicho,
      ciudad: lead.ciudad,
      tamano: lead.tamano_estimado,
      notas: lead.notas
    });

    if (!scripts) {
      return NextResponse.json({ error: 'Failed to generate scripts' }, { status: 500 });
    }

    const today = new Date().toISOString();

    db.prepare(`
      INSERT INTO scripts (lead_id, version_profesional, version_directa, version_problema_sol, fecha_generacion)
      VALUES (@lead_id, @vp, @vd, @vps, @fecha)
    `).run({
      lead_id: id,
      vp: scripts.profesional || '',
      vd: scripts.directo || '',
      vps: scripts.problema_solucion || '',
      fecha: today
    });

    return NextResponse.json({ success: true, scripts });

  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { lead_id, tipo } = await req.json();
    if (!lead_id) return NextResponse.json({ error: 'lead_id requerido' }, { status: 400 });
    db.prepare(`
      UPDATE scripts SET enviado = 1, version_usada = ?, fecha_envio = ?
      WHERE lead_id = ? AND id = (SELECT MAX(id) FROM scripts WHERE lead_id = ?)
    `).run(tipo || 'desconocido', new Date().toISOString(), lead_id, lead_id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
