import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export async function POST(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { to, subject, html, replyTo, text: textBody, attachments } = await req.json();

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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[email]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
