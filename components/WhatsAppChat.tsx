"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, MessageCircle, RefreshCw, Phone, AlertCircle } from "lucide-react";

interface Msg {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

interface Props {
  nombre: string;
  numero: string;
  onClose: () => void;
}

function fmtHour(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

export default function WhatsAppChat({ nombre, numero, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText]         = useState("");
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError]       = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const checkStatus = async () => {
    const r = await fetch("/api/whatsapp/status").then(r => r.json());
    setConnected(r.connected);
    return r.connected;
  };

  const loadMessages = async () => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/whatsapp/messages?number=${encodeURIComponent(numero)}`).then(r => r.json());
      if (r.error) setError(r.error);
      else setMessages(r.messages || []);
    } catch { setError("No se pudieron cargar los mensajes"); }
    setLoading(false);
  };

  useEffect(() => {
    checkStatus().then(ok => { if (ok) loadMessages(); else setLoading(false); });
  }, [numero]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const draft = text.trim();
    setText("");
    const optimistic: Msg = { id: Date.now().toString(), fromMe: true, text: draft, timestamp: Date.now() / 1000 };
    setMessages(p => [...p, optimistic]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: numero, message: draft }),
    }).then(r => r.json());

    if (r.error) {
      setError(r.error);
      setMessages(p => p.filter(m => m.id !== optimistic.id));
      setText(draft);
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Group messages by day
  const grouped: { day: string; msgs: Msg[] }[] = [];
  for (const m of messages) {
    const day = fmtDay(m.timestamp);
    const last = grouped[grouped.length - 1];
    if (last?.day === day) last.msgs.push(m);
    else grouped.push({ day, msgs: [m] });
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[420px] h-[600px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold truncate">{nombre}</p>
            <p className="text-[11px] text-white/70 truncate">{numero}</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={loadMessages} title="Actualizar" className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <RefreshCw size={14} />
            </button>
            <a href={`https://wa.me/${numero.replace(/\D/g,"")}`} target="_blank" title="Abrir en WhatsApp Web"
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <Phone size={14} />
            </a>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Estado desconectado */}
        {connected === false && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[#ECE5DD]">
            <AlertCircle size={32} className="text-amber-500" />
            <p className="text-[13px] font-bold text-gray-700">WhatsApp no conectado</p>
            <p className="text-[12px] text-gray-500">
              Abre <a href="http://localhost:3100/qr" target="_blank" className="text-[#075E54] font-semibold underline">localhost:3100/qr</a> y escanea el QR con tu WhatsApp.
            </p>
            <button onClick={() => checkStatus().then(ok => { if (ok) loadMessages(); })}
              className="mt-2 px-4 py-2 bg-[#075E54] text-white text-[12px] font-bold rounded-xl">
              Verificar conexión
            </button>
          </div>
        )}

        {/* Mensajes */}
        {connected !== false && (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1" style={{ background: "#ECE5DD" }}>
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px] text-gray-500">Cargando mensajes...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-[12px] text-gray-500 text-center">{error}</p>
                <button onClick={loadMessages} className="text-[11px] text-[#075E54] underline">Reintentar</button>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <MessageCircle size={28} className="text-gray-400" />
                <p className="text-[12px] text-gray-500">Sin mensajes previos</p>
                <p className="text-[11px] text-gray-400">Escribe el primero abajo</p>
              </div>
            ) : (
              grouped.map(({ day, msgs }) => (
                <div key={day}>
                  {/* Separador de día */}
                  <div className="flex items-center justify-center my-3">
                    <span className="text-[10px] bg-white/70 text-gray-500 px-3 py-0.5 rounded-full shadow-sm">{day}</span>
                  </div>
                  {msgs.map(m => (
                    <div key={m.id} className={`flex mb-1.5 ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm ${
                          m.fromMe
                            ? "bg-[#DCF8C6] rounded-tr-sm"
                            : "bg-white rounded-tl-sm"
                        }`}
                      >
                        <p className="text-[13px] text-gray-800 leading-snug whitespace-pre-wrap">{m.text}</p>
                        <p className="text-[10px] text-gray-400 text-right mt-0.5">{fmtHour(m.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Input */}
        {connected !== false && (
          <div className="flex items-end gap-2 px-3 py-3 bg-[#F0F0F0] border-t border-gray-200 shrink-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe un mensaje..."
              rows={1}
              style={{ resize: "none" }}
              className="flex-1 text-[13px] bg-white border-0 rounded-2xl px-4 py-2.5 outline-none shadow-sm leading-snug max-h-24 overflow-y-auto"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-[#075E54] hover:bg-[#054d44] disabled:opacity-40 transition-colors shrink-0"
            >
              <Send size={16} className="text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
