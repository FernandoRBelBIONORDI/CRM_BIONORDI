import { NextResponse } from "next/server";
import db from "@/lib/db";

function baileyStatusToString(status: number | string): string {
  const n = Number(status);
  if (n >= 4) return "read";
  if (n === 3) return "delivered";
  if (typeof status === "string") {
    const s = status.toLowerCase();
    if (s === "read" || s === "leído") return "read";
    if (s === "delivered" || s === "entregado") return "delivered";
  }
  return "sent";
}

function extractText(msg: any): string {
  return (
    msg?.message?.conversation ||
    msg?.message?.extendedTextMessage?.text ||
    msg?.message?.imageMessage?.caption ||
    msg?.message?.videoMessage?.caption ||
    msg?.message?.documentMessage?.caption ||
    msg?.message?.buttonsResponseMessage?.selectedDisplayText ||
    msg?.message?.listResponseMessage?.title ||
    msg?.text ||
    msg?.body ||
    msg?.content ||
    msg?.caption ||
    ""
  );
}

function extractChatId(msg: any): string {
  return (
    msg?.key?.remoteJid ||
    msg?.remoteJid ||
    msg?.from ||
    msg?.chatId ||
    msg?.jid ||
    msg?.chat ||
    ""
  );
}

export async function POST(req: Request) {
  let rawBody = "";
  try {
    rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Log primeros 1000 chars del payload para diagnóstico en Railway
    console.log("[WH] raw:", JSON.stringify(payload).slice(0, 1000));

    const events = Array.isArray(payload) ? payload : [payload];

    for (const ev of events) {
      const eventName = (ev.event || ev.type || ev.eventType || "").toLowerCase();
      console.log("[WH] event:", eventName || "(sin nombre)");

      // ─── ESTADO DE SESIÓN ──────────────────────────────────────────────────
      if (
        eventName.includes("connection") ||
        eventName.includes("session") ||
        eventName.includes("qr")
      ) {
        const conn = ev.data?.connection || ev.data?.status || ev.data?.state || "";
        const status =
          conn === "open" || conn === "connected" || conn === "ready"
            ? "ready"
            : conn === "close" || conn === "disconnected"
            ? "disconnected"
            : conn;
        if (status) {
          try { db.prepare(`INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('wa_session_status', ?)`).run(status); } catch {}
          console.log("[WH] session →", status);
        }
        continue;
      }

      // ─── TICKS / ESTADO DE MENSAJES ────────────────────────────────────────
      if (
        eventName.includes("messages.update") ||
        eventName.includes("message.update") ||
        eventName.includes("receipt") ||
        eventName.includes("recibo")
      ) {
        const updates = Array.isArray(ev.data) ? ev.data : [ev.data];
        for (const upd of updates) {
          if (!upd) continue;
          const msgId = upd?.key?.id || upd?.id;
          const rawStatus = upd?.update?.status ?? upd?.status ?? (upd?.receipt?.readTimestamp ? 4 : undefined);
          if (msgId && rawStatus !== undefined) {
            const status = baileyStatusToString(rawStatus);
            try { db.prepare(`UPDATE mensajes_wa SET status = ? WHERE id = ?`).run(status, msgId); } catch {}
            console.log("[WH] tick:", msgId, "→", status);
          }
        }
        continue;
      }

      // ─── MENSAJES NUEVOS ───────────────────────────────────────────────────
      // Aceptar cualquier evento con nombre de mensaje O sin nombre (procesar todo)
      const skipEvent =
        eventName.includes("delete") ||
        eventName.includes("reaction") ||
        eventName.includes("reaccion") ||
        eventName.includes("group") ||
        eventName.includes("grupo") ||
        eventName.includes("contact") ||
        eventName.includes("contacto") ||
        eventName.includes("presence");

      if (skipEvent) {
        console.log("[WH] skip event:", eventName);
        continue;
      }

      // WaSenderAPI puede enviar el mensaje directamente en ev.data o en ev.data.messages[]
      const raw = ev.data ?? ev.payload ?? ev;
      const msgList: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.messages)
        ? raw.messages
        : [raw];

      console.log("[WH] procesando", msgList.length, "mensaje(s)");

      for (const msg of msgList) {
        if (!msg || typeof msg !== "object") continue;

        const chatId = extractChatId(msg);
        console.log("[WH] chatId:", chatId);

        if (!chatId) continue;
        if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast") || chatId.endsWith("@newsletter")) continue;

        // ✅ Removida la condición restrictiva !msg.key && !msg.id
        // Siempre generamos un ID como fallback
        const fromMe = !!(msg?.key?.fromMe ?? msg?.fromMe ?? false);
        const msgId: string =
          msg?.key?.id ||
          msg?.id ||
          msg?.messageId ||
          msg?.wamid ||
          `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        const text = extractText(msg);
        if (!text) {
          console.log("[WH] msg sin texto, id:", msgId, "keys:", Object.keys(msg).join(","));
          continue;
        }

        const phone = chatId.split("@")[0].split(":")[0];
        const name: string = msg?.pushName || msg?.notifyName || msg?.senderName || phone;
        const ts = Number(msg?.messageTimestamp || msg?.timestamp || Math.floor(Date.now() / 1000));

        try {
          db.prepare(`
            INSERT INTO chats_wa (chat_id, name, phone, unread, last_message, last_timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
              name = COALESCE(excluded.name, chats_wa.name),
              unread = chats_wa.unread + excluded.unread,
              last_message = excluded.last_message,
              last_timestamp = excluded.last_timestamp
          `).run(chatId, name, phone, fromMe ? 0 : 1, text, ts);

          db.prepare(`
            INSERT OR IGNORE INTO mensajes_wa (id, chat_id, from_me, text, timestamp, status)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(msgId, chatId, fromMe ? 1 : 0, text, ts, fromMe ? "sent" : "received");

          console.log("[WH] ✅ guardado:", phone, fromMe ? "→" : "←", text.slice(0, 60));
        } catch (dbErr: any) {
          console.error("[WH] DB error:", dbErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[WH] parse error:", e.message, "raw:", rawBody.slice(0, 400));
    return NextResponse.json({ ok: true }); // siempre 200 para no perder el webhook
  }
}
