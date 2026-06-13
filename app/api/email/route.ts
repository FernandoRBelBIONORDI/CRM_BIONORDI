import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const { session, unauth } = await requireAuth();
  if (unauth) return unauth;

  if (!rateLimit(`email:${session.user?.email}`, 15, 60_000)) {
    return NextResponse.json({ error: 'Demasiados emails. Esperá un momento.' }, { status: 429 });
  }

  try {
    const { lead_id, to, subject, html, replyTo, text: textBody, attachments } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltan campos: to, subject, html' }, { status: 400 });
    }

    const rows = db.prepare(
      `SELECT clave, valor FROM configuracion WHERE clave IN ('resend_api_key','smtp_from_name','smtp_from_email')`
    ).all() as { clave: string; valor: string }[];
    const cfg: Record<string, string> = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });

    if (!cfg.resend_api_key) {
      return NextResponse.json({
        error: 'Resend no configurado. Ve a Configuración → Correo y pega tu API Key de resend.com',
      }, { status: 422 });
    }
    if (!cfg.smtp_from_email) {
      return NextResponse.json({
        error: 'Configura el correo remitente en Configuración → Correo',
      }, { status: 422 });
    }

    const fromName  = cfg.smtp_from_name  || 'Bionordi';
    const fromEmail = cfg.smtp_from_email;
    const plainText = textBody || html.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();

    const body: Record<string, unknown> = {
      from:    `${fromName} <${fromEmail}>`,
      to:      Array.isArray(to) ? to : [to],
      subject,
      html,
      text:    plainText,
    };

    if (replyTo) body.reply_to = replyTo;

    if (Array.isArray(attachments) && attachments.length > 0) {
      body.attachments = attachments.map((a: { filename: string; content: string }) => ({
        filename: a.filename,
        content:  a.content, // Resend accepts base64 directly
      }));
    }

    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${cfg.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error((err as { message?: string }).message || `Resend error ${res.status}`);
    }

    // Resolve final lead_id
    let finalLeadId = lead_id || null;
    const emailToMatch = Array.isArray(to) ? to[0] : to;
    if (!finalLeadId && emailToMatch) {
      try {
        const match = db.prepare('SELECT id FROM leads WHERE correo = ? LIMIT 1').get(emailToMatch) as { id: number } | undefined;
        if (match) {
          finalLeadId = match.id;
        }
      } catch (e) {
        console.error('[email_logs] Error resolving lead_id', e);
      }
    }

    // Insert into email_logs
    try {
      db.prepare(`
        INSERT INTO email_logs (lead_id, destinatario, asunto, cuerpo, cuerpo_html, remitente, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        finalLeadId,
        Array.isArray(to) ? to.join(', ') : to,
        subject,
        plainText,
        html,
        session.user?.name || session.user?.email || 'Fernando',
        'enviado'
      );
    } catch (e) {
      console.error('[email_logs] Error writing log', e);
    }

    // Insert into interacciones and update lead last contact
    if (finalLeadId) {
      try {
        db.prepare(`
          INSERT INTO interacciones (lead_id, tipo, contenido, resultado, usuario_id, usuario_nombre)
          VALUES (?, 'correo', ?, 'Enviado con éxito', ?, ?)
        `).run(
          finalLeadId,
          `Asunto: ${subject}\n\n${plainText.slice(0, 500)}`,
          session.user?.id || null,
          session.user?.name || 'Sistema'
        );

        db.prepare(`
          UPDATE leads
          SET fecha_ultimo_contacto = datetime('now','localtime')
          WHERE id = ?
        `).run(finalLeadId);
      } catch (e) {
        console.error('[email_logs] Error writing interaction', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
