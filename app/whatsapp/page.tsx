"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Search, Send, RefreshCw, MessageCircle, Phone,
  User, AlertCircle, CheckCheck, Wifi, WifiOff,
} from "lucide-react";
import { initials, avatarColor } from "@/lib/ui";

interface Chat {
  id: string;
  name: string;
  phone: string;
  unread: number;
  lastMessage: string;
  lastMessageFromMe: boolean;
  lastTimestamp: number;
}

interface Msg {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
}

interface Lead {
  id: number;
  nombre: string;
  telefono?: string;
  whatsapp?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(ts: number) {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
function fmtHour(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}
function groupByDay(msgs: Msg[]) {
  const groups: { label: string; msgs: Msg[] }[] = [];
  for (const m of msgs) {
    const d = new Date(m.timestamp * 1000);
    const now = new Date();
    const label = d.toDateString() === now.toDateString()
      ? "Hoy"
      : d.toLocaleDateString("es-MX", { weekday: "long", day: "2-digit", month: "long" });
    const last = groups[groups.length - 1];
    if (last?.label === label) last.msgs.push(m);
    else groups.push({ label, msgs: [m] });
  }
  return groups;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function WhatsAppPageWrapper() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-[#F0F2F5]"><p className="text-gray-400 text-sm">Cargando...</p></div>}>
      <WhatsAppPage />
    </Suspense>
  );
}

function WhatsAppPage() {
  const searchParams = useSearchParams();
  const phoneParam   = searchParams.get("phone");

  const [waStatus,    setWaStatus]    = useState<"loading"|"connected"|"disconnected">("loading");
  const [chats,       setChats]       = useState<Chat[]>([]);
  const [query,       setQuery]       = useState("");
  const [activeChat,  setActiveChat]  = useState<Chat | null>(null);
  const [messages,    setMessages]    = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text,        setText]        = useState("");
  const [sending,     setSending]     = useState(false);
  const [leads,       setLeads]       = useState<Lead[]>([]);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoOpened  = useRef(false);

  const loadMessages = useCallback(async (chat: Chat) => {
    setLoadingMsgs(true);
    const d = await fetch(`/api/whatsapp/messages?number=${encodeURIComponent(chat.phone)}`).then(r => r.json()).catch(() => ({ messages: [] }));
    setMessages(d.messages || []);
    setLoadingMsgs(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  const openChat = useCallback((chat: Chat) => {
    setActiveChat(chat);
    setMessages([]);
    setText("");
    loadMessages(chat);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(chat), 5000);
  }, [loadMessages]);

  const loadChats = useCallback(async () => {
    const st = await fetch("/api/whatsapp/status").then(r => r.json()).catch(() => ({ connected: false }));
    if (!st.connected) { setWaStatus("disconnected"); return; }
    setWaStatus("connected");
    const d = await fetch("/api/whatsapp/chats").then(r => r.json()).catch(() => ({ chats: [] }));
    const lista: Chat[] = d.chats || [];
    setChats(lista);

    // Abrir automáticamente el chat si viene ?phone= en la URL
    if (phoneParam && !autoOpened.current) {
      const clean = phoneParam.replace(/\D/g, "");
      const found = lista.find(c => c.phone.replace(/\D/g, "").endsWith(clean.slice(-10)));
      if (found) {
        autoOpened.current = true;
        openChat(found);
      } else {
        // El número no tiene historial todavía — crear chat vacío para poder escribir
        autoOpened.current = true;
        const phantom: Chat = {
          id: `${clean}@c.us`,
          name: clean,
          phone: clean,
          unread: 0,
          lastMessage: "",
          lastMessageFromMe: false,
          lastTimestamp: 0,
        };
        openChat(phantom);
      }
    }
  }, [phoneParam, openChat]);

  useEffect(() => {
    loadChats();
    fetch("/api/leads").then(r => r.json()).then(d => setLeads(d.leads || []));
    const intv = setInterval(loadChats, 15000);
    return () => { clearInterval(intv); if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending || !activeChat) return;
    setSending(true);
    const draft = text.trim();
    setText("");
    const opt: Msg = { id: Date.now().toString(), fromMe: true, text: draft, timestamp: Date.now() / 1000 };
    setMessages(p => [...p, opt]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    const r = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: activeChat.phone, message: draft }),
    }).then(r => r.json());
    if (r.error) { setMessages(p => p.filter(m => m.id !== opt.id)); setText(draft); }
    setSending(false);
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: draft, lastMessageFromMe: true, lastTimestamp: Date.now() / 1000 } : c));
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Buscar lead vinculado por teléfono
  const findLead = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    return leads.find(l =>
      (l.telefono || "").replace(/\D/g, "").endsWith(clean.slice(-8)) ||
      (l.whatsapp || "").replace(/\D/g, "").endsWith(clean.slice(-8))
    );
  };

  const filteredChats = chats.filter(c =>
    !query || c.name.toLowerCase().includes(query.toLowerCase()) || c.phone.includes(query)
  );

  const groups = groupByDay(messages);
  const linkedLead = activeChat ? findLead(activeChat.phone) : null;

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-[#F0F2F5]">

      {/* ── Columna izq: lista de chats ───────────────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-white border-r border-[#E8EFF8]">

        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between bg-[#F0F2F5]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <span className="text-[15px] font-extrabold text-[#1E293B]">WhatsApp</span>
          </div>
          <div className="flex items-center gap-2">
            {waStatus === "connected"
              ? <span className="flex items-center gap-1 text-[11px] font-semibold text-[#25D366]"><Wifi size={12}/>Conectado</span>
              : waStatus === "disconnected"
              ? <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400"><WifiOff size={12}/>Sin conexión</span>
              : <span className="text-[11px] text-gray-400">...</span>
            }
            <button onClick={loadChats} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Buscador */}
        <div className="px-3 py-2 bg-white border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar conversación..."
              className="w-full pl-8 pr-3 py-2 text-[12px] bg-[#F0F2F5] rounded-full border-0 outline-none"
            />
          </div>
        </div>

        {/* Sin conexión */}
        {waStatus === "disconnected" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-5 text-center">
            <AlertCircle size={32} className="text-amber-400" />
            <p className="text-[13px] font-bold text-gray-700">WhatsApp no conectado</p>
            <p className="text-[12px] text-gray-500 leading-relaxed">
              Escanea el QR para conectar tu número
            </p>
            <a href="http://localhost:3100/qr" target="_blank"
              className="px-4 py-2 bg-[#25D366] text-white text-[12px] font-bold rounded-xl hover:bg-[#1ebe5d] transition-colors">
              Abrir QR
            </a>
          </div>
        )}

        {/* Lista */}
        {waStatus === "connected" && (
          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2">
                <MessageCircle size={24} className="text-gray-300" />
                <p className="text-[12px] text-gray-400">Sin conversaciones</p>
              </div>
            ) : filteredChats.map(chat => {
              const active = activeChat?.id === chat.id;
              const color = avatarColor(chat.name);
              return (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat)}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-b border-gray-50 hover:bg-[#F5F5F5] transition-colors text-left ${active ? "bg-[#F0F2F5]" : ""}`}
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[13px] font-extrabold shrink-0"
                    style={{ background: color }}>
                    {initials(chat.name)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[13px] font-bold text-[#1E293B] truncate">{chat.name}</span>
                      <span className={`text-[11px] shrink-0 ${chat.unread > 0 ? "text-[#25D366] font-bold" : "text-gray-400"}`}>
                        {fmtTime(chat.lastTimestamp)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-[12px] text-gray-500 truncate flex-1">
                        {chat.lastMessageFromMe && <span className="text-[#25D366] mr-0.5">✓✓</span>}
                        {chat.lastMessage || <span className="italic">Sin mensajes</span>}
                      </p>
                      {chat.unread > 0 && (
                        <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#25D366] text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {chat.unread > 99 ? "99+" : chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Centro: conversación ──────────────────────────────────────────── */}
      {!activeChat ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#F0F2F5]">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm">
            <MessageCircle size={36} className="text-[#25D366]" />
          </div>
          <div className="text-center">
            <p className="text-[16px] font-bold text-[#1E293B]">Bionordi — WhatsApp</p>
            <p className="text-[13px] text-gray-500 mt-1">Selecciona una conversación para empezar</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 bg-[#F0F2F5] border-b border-gray-200 shrink-0">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[12px] font-extrabold shrink-0"
              style={{ background: avatarColor(activeChat.name) }}>
              {initials(activeChat.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-extrabold text-[#1E293B]">{activeChat.name}</p>
              <p className="text-[11px] text-gray-500">+{activeChat.phone}</p>
            </div>
            <div className="flex items-center gap-2">
              <a href={`tel:+${activeChat.phone}`}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                <Phone size={15} className="text-gray-500" />
              </a>
              <button onClick={() => loadMessages(activeChat)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors">
                <RefreshCw size={14} className="text-gray-500" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div
            className="flex-1 overflow-y-auto px-6 py-4"
            style={{
              background: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e5ddd5'/%3E%3C/svg%3E\")",
              backgroundColor: "#E5DDD5",
            }}
          >
            {loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px] text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm">Cargando mensajes...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-[12px] text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm">Sin mensajes previos. Escribe el primero.</p>
              </div>
            ) : groups.map(({ label, msgs }) => (
              <div key={label}>
                {/* Separador de día */}
                <div className="flex justify-center my-4">
                  <span className="text-[11px] text-[#54656F] bg-white px-3 py-1 rounded-full shadow-sm font-medium">{label}</span>
                </div>
                {msgs.map((m, i) => {
                  const prevSame = i > 0 && msgs[i-1].fromMe === m.fromMe;
                  return (
                    <div key={m.id} className={`flex mb-0.5 ${m.fromMe ? "justify-end" : "justify-start"} ${prevSame ? "mt-0.5" : "mt-2"}`}>
                      <div className={`relative max-w-[72%] px-3 pt-2 pb-5 rounded-2xl shadow-sm text-[13px] leading-snug whitespace-pre-wrap ${
                        m.fromMe
                          ? "bg-[#D9FDD3] text-[#111B21] rounded-tr-sm"
                          : "bg-white text-[#111B21] rounded-tl-sm"
                      }`}>
                        {m.text}
                        <span className="absolute bottom-1 right-2.5 text-[10px] text-[#667781] flex items-center gap-0.5">
                          {fmtHour(m.timestamp)}
                          {m.fromMe && <CheckCheck size={12} className="text-[#53BDEB]" />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-end gap-3 px-4 py-3 bg-[#F0F2F5] border-t border-gray-200 shrink-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe un mensaje"
              rows={1}
              style={{ resize: "none" }}
              className="flex-1 bg-white text-[13px] rounded-2xl px-4 py-2.5 outline-none shadow-sm leading-snug max-h-32 overflow-y-auto border-0"
            />
            <button
              onClick={send}
              disabled={!text.trim() || sending}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-40 transition-colors shrink-0 shadow-sm"
            >
              <Send size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {/* ── Derecha: info del contacto ────────────────────────────────────── */}
      {activeChat && (
        <div className="w-[280px] shrink-0 bg-white border-l border-[#E8EFF8] flex flex-col overflow-y-auto">

          {/* Avatar grande */}
          <div className="flex flex-col items-center pt-8 pb-5 px-5 border-b border-gray-100">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-[24px] font-extrabold mb-3 shadow-md"
              style={{ background: avatarColor(activeChat.name) }}>
              {initials(activeChat.name)}
            </div>
            <p className="text-[15px] font-extrabold text-[#1E293B] text-center">{activeChat.name}</p>
            <p className="text-[12px] text-gray-400 mt-0.5">+{activeChat.phone}</p>
            <a
              href={`https://wa.me/${activeChat.phone}`}
              target="_blank"
              className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[#25D366] hover:underline"
            >
              <Phone size={11}/> Llamar por WhatsApp
            </a>
          </div>

          {/* Lead vinculado */}
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">Lead vinculado</p>
            {linkedLead ? (
              <Link href={`/clientes/${linkedLead.id}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition-colors">
                <div className="w-8 h-8 rounded-full bg-[#1D4ED8] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                  {initials(linkedLead.nombre)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#1D4ED8] truncate">{linkedLead.nombre}</p>
                  <p className="text-[10px] text-[#3B82F6]">Ver perfil →</p>
                </div>
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] text-gray-400">No hay lead vinculado</p>
                <Link href="/crm"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#4E60A9] hover:underline">
                  <User size={11}/> Buscar en CRM
                </Link>
              </div>
            )}
          </div>

          {/* Estadísticas de la conversación */}
          <div className="px-5 py-4">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">Conversación</p>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Total mensajes</span>
                <span className="font-bold text-[#1E293B]">{messages.length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Enviados</span>
                <span className="font-bold text-[#25D366]">{messages.filter(m => m.fromMe).length}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Recibidos</span>
                <span className="font-bold text-[#1E293B]">{messages.filter(m => !m.fromMe).length}</span>
              </div>
              {activeChat.unread > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-gray-500">Sin leer</span>
                  <span className="font-bold text-[#25D366]">{activeChat.unread}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
