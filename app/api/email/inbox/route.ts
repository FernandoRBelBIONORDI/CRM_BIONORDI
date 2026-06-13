import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export const dynamic = 'force-dynamic';

function getImapConfig() {
  const rows = db.prepare(
    `SELECT clave, valor FROM configuracion WHERE clave IN ('imap_host','imap_port','imap_user','imap_pass')`
  ).all() as { clave: string; valor: string }[];
  const cfg: Record<string, string> = {};
  rows.forEach(r => { cfg[r.clave] = r.valor; });
  return cfg;
}

// Descarga los últimos mensajes del INBOX vía IMAP y guarda los que aún no existen.
// Solo baja el cuerpo completo de los mensajes nuevos (los conocidos se omiten por Message-ID).
async function syncInbox(): Promise<{ nuevos: number } | { error: string }> {
  const cfg = getImapConfig();
  if (!cfg.imap_host || !cfg.imap_user || !cfg.imap_pass) {
    return { error: 'IMAP no configurado. Ve a Configuración → Correo y captura el servidor, usuario y contraseña IMAP.' };
  }

  const client = new ImapFlow({
    host: cfg.imap_host,
    port: Number(cfg.imap_port) || 993,
    secure: true,
    auth: { user: cfg.imap_user, pass: cfg.imap_pass },
    logger: false,
    socketTimeout: 30_000,
  });

  let nuevos = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const total = (client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.exists : 0) || 0;
      if (total > 0) {
        const desde = Math.max(1, total - 49); // últimos 50 mensajes

        // 1ª pasada: solo sobres (ligero) para detectar cuáles faltan en la DB
        const conocidos = new Set(
          (db.prepare(`SELECT mensaje_id FROM emails_recibidos WHERE mensaje_id IS NOT NULL`).all() as { mensaje_id: string }[])
            .map(r => r.mensaje_id)
        );
        const faltantes: { uid: number; messageId: string }[] = [];
        for await (const msg of client.fetch(`${desde}:*`, { uid: true, envelope: true })) {
          const messageId = msg.envelope?.messageId || `uid-${msg.uid}@${cfg.imap_host}`;
          if (!conocidos.has(messageId)) faltantes.push({ uid: msg.uid, messageId });
        }

        // 2ª pasada: bajar y parsear solo los nuevos
        const insert = db.prepare(`
          INSERT OR IGNORE INTO emails_recibidos
            (uid, mensaje_id, remitente, remitente_nombre, destinatario, asunto, cuerpo_html, cuerpo_texto, fecha, leido, lead_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
        `);
        const findLead = db.prepare(`SELECT id FROM leads WHERE correo = ? COLLATE NOCASE LIMIT 1`);

        for (const { uid, messageId } of faltantes) {
          const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!full || !full.source) continue;
          const parsed = await simpleParser(full.source);

          const from = parsed.from?.value?.[0];
          const remitente = from?.address || '';
          const lead = remitente ? (findLead.get(remitente) as { id: number } | undefined) : undefined;
          const toText = Array.isArray(parsed.to)
            ? parsed.to.map(t => t.text).join(', ')
            : parsed.to?.text || '';

          const info = insert.run(
            uid,
            messageId,
            remitente,
            from?.name || '',
            toText,
            parsed.subject || '(Sin asunto)',
            typeof parsed.html === 'string' ? parsed.html : null,
            parsed.text || null,
            (parsed.date || new Date()).toISOString(),
            lead?.id ?? null
          );
          if (info.changes > 0) nuevos++;
        }
      }
    } finally {
      lock.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Error IMAP: ${message}` };
  } finally {
    await client.logout().catch(() => {});
  }
  return { nuevos };
}

export async function GET(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const url = new URL(req.url);
  let sync: { nuevos: number } | { error: string } | null = null;
  if (url.searchParams.get('sync') === '1') {
    sync = await syncInbox();
  }

  try {
    const emails = db.prepare(`
      SELECT er.*, l.nombre AS lead_nombre
      FROM emails_recibidos er
      LEFT JOIN leads l ON er.lead_id = l.id
      ORDER BY er.fecha DESC
      LIMIT 100
    `).all();
    return NextResponse.json({ emails, sync });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { id, leido } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });
    db.prepare(`UPDATE emails_recibidos SET leido = ? WHERE id = ?`).run(leido ? 1 : 0, id);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
