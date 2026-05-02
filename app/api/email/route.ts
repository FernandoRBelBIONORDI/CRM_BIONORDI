import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import dns from 'dns';
import db from '@/lib/db';

async function resolveIPv4(hostname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    dns.lookup(hostname, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
}

export async function POST(req: Request) {
  try {
    const { to, subject, html, replyTo, text: textBody, attachments } = await req.json();

    if (!to || !subject || !html) {
      return NextResponse.json({ error: 'Faltan campos: to, subject, html' }, { status: 400 });
    }

    const rows = db.prepare(`SELECT clave, valor FROM configuracion WHERE clave LIKE 'smtp_%'`).all() as { clave: string; valor: string }[];
    const cfg: Record<string, string> = {};
    rows.forEach(r => { cfg[r.clave] = r.valor; });

    if (!cfg.smtp_host || !cfg.smtp_user || !cfg.smtp_pass) {
      return NextResponse.json({
        error: 'SMTP no configurado. Ve a Configuración → Correo SMTP y completa los datos.',
      }, { status: 422 });
    }

    // Railway blocks outbound IPv6 — resolve hostname to IPv4 before connecting
    const smtpHost = await resolveIPv4(cfg.smtp_host);

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(cfg.smtp_port || 587),
      secure: cfg.smtp_secure === 'true',
      auth: { user: cfg.smtp_user, pass: cfg.smtp_pass },
      tls: {
        rejectUnauthorized: false,
        servername: cfg.smtp_host, // keep original hostname for TLS SNI
      },
    });

    const plainText = textBody || html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

    const mailAttachments = Array.isArray(attachments)
      ? attachments.map((a: { filename: string; content: string; type?: string }) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
          contentType: a.type || 'application/pdf',
        }))
      : [];

    await transporter.sendMail({
      from: `"${cfg.smtp_from_name || 'Bionordi'}" <${cfg.smtp_from_email || cfg.smtp_user}>`,
      to,
      subject,
      html,
      text: plainText,
      replyTo: replyTo || cfg.smtp_from_email || cfg.smtp_user,
      attachments: mailAttachments,
      headers: {
        "X-Mailer": "Bionordi CRM",
        "Message-ID": `<${Date.now()}.${Math.random().toString(36).slice(2)}@bionordi.mx>`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[email]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
