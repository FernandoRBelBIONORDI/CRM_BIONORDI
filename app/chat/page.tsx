"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import {
  MessageCircle, QrCode, Search, Send, Activity, Phone,
  Paperclip, ImageIcon, FileText, CheckCheck, Check,
  User, Building2, Zap, X,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

interface Chat {
  chat_id: string;
  name: string;
  phone: string;
  unread: number;
  last_message: string;
  last_timestamp: number;
  photo_url?: string;
  lead_id?: number;
  lead_nombre?: string;
  score_potencial?: number;
  nicho?: string;
  fecha_ultimo_contacto?: string;
}

interface Message {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  status?: string;
}

interface PendingMedia {
  type: "image" | "document";
  file: File;
  preview?: string; // object URL for images
}

const TEMPLATES = [
  {
    label: "Primer contacto",
    text: "Hola, buenos días. Le contacto de parte de *Bionordi*, empresa especializada en reparación y mantenimiento de transductores de ultrasonido. ¿Actualmente tienen algún equipo médico que requiera servicio? 🔧",
  },
  {
    label: "Solicitar detalles del equipo",
    text: "Gracias por su respuesta. Para orientarle mejor, ¿me podría indicar la marca, modelo del equipo y la falla que presenta?",
  },
  {
    label: "Confirmar recepción en taller",
    text: "Le confirmamos que hemos recibido su equipo en nuestro taller. En breve le enviamos el diagnóstico técnico con el presupuesto. Tiempo estimado: 3–5 días hábiles.",
  },
  {
    label: "Enviar cotización",
    text: "Adjunto encontrará la cotización para la reparación de su equipo. Nuestros trabajos incluyen *garantía de 6 meses* en mano de obra y refacciones. ¿Tiene alguna pregunta?",
  },
  {
    label: "Seguimiento post-cotización",
    text: "Buen día. Le contacto para dar seguimiento a la cotización que le enviamos. ¿Ha tenido oportunidad de revisarla? Quedo a sus órdenes para cualquier aclaración.",
  },
  {
    label: "Equipo listo para entrega",
    text: "¡Buenas noticias! Su equipo ya está listo. Puede pasar a recogerlo o coordinar el envío. El trabajo tiene garantía de 6 meses. ¡Gracias por su preferencia! 🙌",
  },
];


function ChatContent() {
  useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialChatId = searchParams.get("chatId");

  const [status, setStatus] = useState<"loading" | "disconnected" | "qr" | "ready">("loading");
  const [myPhone, setMyPhone] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sendingMedia, setSendingMedia] = useState(false);
  const [q, setQ] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  const [photosMap, setPhotosMap] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const pendingSentRef = useRef<Message | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll al fondo cuando cambia el chat o llegan mensajes nuevos
  useEffect(() => {
    if (messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
  }, [messages.length, activeChat?.chat_id]);

  // ── Status poll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let timer: any;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/whatsapp/status").then((r) => r.json());
        setStatus(res.status === "qr" ? "disconnected" : res.status || "disconnected");
        if (res.phone) setMyPhone(res.phone);
        if (res.status === "ready" && chats.length === 0) fetchChats();
      } catch {
        setStatus("disconnected");
      }
      timer = setTimeout(fetchStatus, 5000);
    };
    fetchStatus();
    return () => clearTimeout(timer);
  }, [chats.length]);

  // ── Chats + messages poll ────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "ready") return;
    const timer = setInterval(() => {
      fetchChats(true);
      if (activeChat) fetchMessages(activeChat.chat_id, true);
    }, 2000);
    return () => clearInterval(timer);
  }, [status, activeChat]);

  // ── Fetch chats ──────────────────────────────────────────────────────────────
  const fetchChats = async (silent = false) => {
    if (!silent) setLoadingChats(true);
    try {
      const res = await fetch("/api/whatsapp/chats").then((r) => r.json());
      if (res.chats) {
        setChats(res.chats);
        if (initialChatId && !activeChat) {
          const existing = res.chats.find((c: Chat) => c.chat_id === initialChatId);
          if (existing) {
            openChat(existing);
          } else {
            const phone = initialChatId.split("@")[0];
            setActiveChat({ chat_id: initialChatId, name: phone, phone, unread: 0, last_message: "", last_timestamp: Math.floor(Date.now() / 1000) });
          }
        }
      }
    } catch {}
    if (!silent) setLoadingChats(false);
  };

  // ── Fetch messages ───────────────────────────────────────────────────────────
  const fetchMessages = async (chatId: string, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}`).then((r) => r.json());
      if (res.messages) {
        const fetched: Message[] = res.messages;

        // Don't overwrite existing messages with empty array on silent polls
        if (silent && fetched.length === 0) {
          return;
        }

        let display = fetched;
        if (pendingSentRef.current) {
          const p = pendingSentRef.current;
          const arrived = fetched.some(
            (m) => m.fromMe && m.text === p.text && Math.abs(m.timestamp - p.timestamp) < 60
          );
          if (arrived) {
            pendingSentRef.current = null;
          } else {
            const alreadyShown = fetched.some((m) => m.id === p.id);
            if (!alreadyShown) display = [...fetched, p];
          }
        }

        const prevCount = messages.length;
        setMessages(display);

        const hasNewIncoming = fetched.some((m, i) => !m.fromMe && i >= prevCount);
        if (!silent || hasNewIncoming) {
          fetch("/api/whatsapp/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId }),
          }).catch(() => {});
        }

      }
    } catch {}
    if (!silent) setLoadingMsgs(false);
  };

  // ── Open chat (load messages + profile pic) ──────────────────────────────────
  const openChat = (c: Chat) => {
    setMessages([]);
    setActiveChat(c);
    fetchMessages(c.chat_id);
    if (!photosMap[c.phone] && !c.photo_url) {
      fetch(`/api/whatsapp/profile-pic?phone=${encodeURIComponent(c.phone)}`)
        .then((r) => r.json())
        .then((d) => { if (d.imgUrl) setPhotosMap((prev) => ({ ...prev, [c.phone]: d.imgUrl })); })
        .catch(() => {});
    } else if (c.photo_url && !photosMap[c.phone]) {
      setPhotosMap((prev) => ({ ...prev, [c.phone]: c.photo_url! }));
    }
  };

  // ── Send text ────────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!activeChat) return;
    if (pendingMedia) { await sendMedia(); return; }
    if (!inputMsg.trim()) return;

    const text = inputMsg.trim();
    setInputMsg("");

    const tempMsg: Message = { id: `temp-${Date.now()}`, fromMe: true, text, timestamp: Date.now() / 1000, status: "sent" };
    pendingSentRef.current = tempMsg;
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat.chat_id, message: text }),
      });
    } catch {
      pendingSentRef.current = null;
    }
  };

  // ── Send media ───────────────────────────────────────────────────────────────
  const sendMedia = async () => {
    if (!pendingMedia || !activeChat) return;
    const caption = inputMsg.trim();
    setSendingMedia(true);
    try {
      // 1. Upload file to CRM file server
      const params = new URLSearchParams({ subfolder: "wa-media", filename: pendingMedia.file.name });
      const fd = new FormData();
      fd.append("file", pendingMedia.file, pendingMedia.file.name);
      const uploadRes = await fetch(`/api/upload?${params}`, { method: "POST", body: fd });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.error || "Error al subir archivo");

      // 2. Build public URL
      const fileUrl = `${window.location.origin}${uploadData.path}`;

      // 3. Optimistic temp message
      const displayText = pendingMedia.type === "image" ? (caption ? `📷 ${caption}` : "📷 Imagen") : (caption ? `📎 ${pendingMedia.file.name} — ${caption}` : `📎 ${pendingMedia.file.name}`);
      const tempMsg: Message = { id: `temp-${Date.now()}`, fromMe: true, text: displayText, timestamp: Date.now() / 1000, status: "sent" };
      pendingSentRef.current = tempMsg;
      setMessages((prev) => [...prev, tempMsg]);

      // 4. Send via WaSenderAPI
      await fetch("/api/whatsapp/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: activeChat.chat_id, type: pendingMedia.type, fileUrl, fileName: pendingMedia.file.name, caption }),
      });

      setPendingMedia(null);
      setInputMsg("");
    } catch (e: any) {
      console.error("[media]", e);
      pendingSentRef.current = null;
    } finally {
      setSendingMedia(false);
    }
  };

  // ── File pickers ─────────────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPendingMedia({ type: "image", file, preview });
    e.target.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingMedia({ type: "document", file });
    e.target.value = "";
  };

  const cancelMedia = () => {
    if (pendingMedia?.preview) URL.revokeObjectURL(pendingMedia.preview);
    setPendingMedia(null);
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const filteredChats = chats.filter(
    (c) => c.name?.toLowerCase().includes(q.toLowerCase()) || c.phone?.includes(q)
  );

  const groupedMessages = messages.reduce((acc, m) => {
    const ts = m.timestamp && m.timestamp > 1_000_000 ? m.timestamp * 1000 : Date.now();
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    let label = d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    if (d.toDateString() === today.toDateString()) label = "Hoy";
    else if (d.toDateString() === yesterday.toDateString()) label = "Ayer";
    if (!acc[label]) acc[label] = [];
    acc[label].push(m);
    return acc;
  }, {} as Record<string, Message[]>);

  if (status === "loading") return <div className="h-full flex items-center justify-center text-gray-400"><Activity className="animate-spin" /></div>;

  return (
    <div className="h-full flex flex-col font-sans bg-[#F8FAFC]">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-[#E2E8F4] bg-white/80 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div>
          <h1 className="text-[20px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <MessageCircle className="text-[#22C55E]" size={22} fill="#22C55E" fillOpacity={0.2} />
            Bandeja de Prospección
          </h1>
          <p className="text-[12px] text-[#64748B] mt-0.5">Gestión de comunicaciones B2B en tiempo real</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold ${status === "ready" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-yellow-50 text-yellow-600 border border-yellow-100"}`}>
          <span className={`w-2 h-2 rounded-full ${status === "ready" ? "bg-emerald-500" : "bg-yellow-400 animate-pulse"}`} />
          {status === "ready" ? `WaSenderAPI Activa (+${myPhone})` : "Desconectado"}
        </div>
      </div>

      {status !== "ready" ? (
        <div className="flex-1 flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-white to-white">
          <div className="max-w-md w-full bg-white/60 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-white">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-600 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-emerald-500/30">
              <QrCode size={32} />
            </div>
            <h2 className="text-[22px] font-extrabold text-[#0F172A] mb-2 text-center">Conectado a WaSenderAPI</h2>
            <p className="text-[14px] text-[#64748B] mb-6 text-center leading-relaxed">Tu sesión de WhatsApp está siendo gestionada en la nube. No necesitas escanear códigos QR locales.</p>
            <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-[#E2E8F4] shadow-sm">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Activity size={18} /></div>
              <div>
                <h4 className="text-[13px] font-bold text-[#1E293B]">Estado del Servicio</h4>
                <p className="text-[12px] text-[#64748B]">Activo y en espera de eventos webhook.</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden p-4 gap-4 max-w-[1600px] mx-auto w-full">

          {/* ── Lista de chats ─────────────────────────────────────────────────── */}
          <div className="w-[340px] bg-white/60 backdrop-blur-xl rounded-3xl border border-white/50 flex flex-col shadow-xl shadow-blue-900/5 shrink-0 overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F4]/60 bg-white/40">
              <div className="relative group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#4E60A9]" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente o número..."
                  className="w-full bg-white border border-slate-200 text-[13px] py-2.5 pl-9 pr-4 rounded-xl outline-none focus:ring-2 focus:ring-[#4E60A9]/20 focus:border-[#4E60A9] font-medium shadow-sm" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingChats && chats.length === 0 ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-slate-200/60 shrink-0" />
                      <div className="flex-1 py-1.5 space-y-2.5">
                        <div className="h-3.5 bg-slate-200/60 rounded-full w-2/3" />
                        <div className="h-2.5 bg-slate-200/60 rounded-full w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <MessageCircle className="text-slate-300" size={24} />
                  </div>
                  <p className="text-[13px] font-bold text-slate-500">No hay conversaciones</p>
                </div>
              ) : (
                filteredChats.map((c) => {
                  const isActive = activeChat?.chat_id === c.chat_id;
                  const date = new Date(c.last_timestamp * 1000);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const photo = photosMap[c.phone] || c.photo_url;
                  return (
                    <div key={c.chat_id} onClick={() => openChat(c)}
                      className={`flex gap-3 p-4 cursor-pointer border-b border-slate-100/50 transition-all duration-200 ${isActive ? "bg-gradient-to-r from-[#EEF3FC] to-transparent border-l-[3px] border-l-[#4E60A9]" : "hover:bg-slate-50 border-l-[3px] border-l-transparent"}`}>
                      <div className="relative shrink-0">
                        {photo ? (
                          <img src={photo} alt={c.name} className="w-12 h-12 rounded-2xl object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 border border-indigo-50 flex items-center justify-center text-indigo-700 font-extrabold text-[16px]">
                            {c.lead_nombre ? c.lead_nombre.charAt(0).toUpperCase() : c.name ? c.name.charAt(0).toUpperCase() : c.phone.charAt(0)}
                          </div>
                        )}
                        {c.unread > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 border-2 border-white text-white text-[10px] font-extrabold flex items-center justify-center rounded-full">{c.unread}</span>}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="flex justify-between items-baseline mb-1">
                          <span className={`text-[14px] truncate pr-2 ${isActive ? "font-extrabold text-indigo-900" : "font-bold text-slate-800"}`}>
                            {c.lead_nombre || c.name || c.phone}
                          </span>
                          <span className={`text-[10px] font-bold shrink-0 ${c.unread > 0 ? "text-rose-500" : "text-slate-400"}`}>
                            {c.last_timestamp ? (isToday ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : date.toLocaleDateString()) : ""}
                          </span>
                        </div>
                        <span className={`text-[12px] truncate ${c.unread > 0 ? "font-bold text-slate-700" : "font-medium text-slate-500"}`}>
                          {c.last_message || "—"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Chat activo ────────────────────────────────────────────────────── */}
          <div className="flex-1 bg-white rounded-3xl border border-slate-200 flex flex-col shadow-xl shadow-blue-900/5 overflow-hidden relative">
            {activeChat ? (
              <>
                {/* Header del chat */}
                <div className="px-6 py-4 border-b border-slate-100 bg-white/90 backdrop-blur-md flex items-center gap-4 shrink-0 z-10">
                  <div className="relative shrink-0">
                    {photosMap[activeChat.phone] || activeChat.photo_url ? (
                      <img src={photosMap[activeChat.phone] || activeChat.photo_url} alt={activeChat.name}
                        className="w-11 h-11 rounded-2xl object-cover shadow-md"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4E60A9] to-indigo-500 flex items-center justify-center text-white font-extrabold text-[15px] shadow-md shadow-indigo-200">
                        {(activeChat.lead_nombre || activeChat.name)?.charAt(0).toUpperCase() || activeChat.phone.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[16px] font-extrabold text-slate-900 leading-tight">{activeChat.lead_nombre || activeChat.name || activeChat.phone}</h3>
                    <div className="text-[12px] font-semibold text-slate-500 mt-0.5 flex items-center gap-1.5">
                      <Phone size={11} className="text-slate-400" /> +{activeChat.phone}
                    </div>
                  </div>
                  <button onClick={() => setShowProfile(!showProfile)}
                    className={`text-[12px] font-bold px-4 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 ${showProfile ? "bg-[#4E60A9] text-white shadow-md shadow-indigo-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    <User size={14} /> Perfil CRM
                  </button>
                </div>

                {/* Mensajes */}
                <div ref={msgContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4 bg-[#F8FAFC]/50"
                  style={{ backgroundImage: "radial-gradient(#E2E8F4 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
                  {loadingMsgs && messages.length === 0 ? (
                    <div className="p-6 space-y-6">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className={`flex flex-col w-2/3 animate-pulse ${i % 2 === 0 ? "self-end items-end" : "self-start"}`}>
                          <div className="h-10 bg-slate-200/70 rounded-2xl w-full" />
                        </div>
                      ))}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                      <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mb-2">
                        <MessageCircle size={28} className="text-slate-300" />
                      </div>
                      <span className="text-[14px] font-bold text-slate-500">Inicia la prospección</span>
                      <span className="text-[12px] font-medium text-slate-400 text-center max-w-[250px]">Escribe un mensaje o selecciona una imagen para enviar.</span>
                    </div>
                  ) : (
                    Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                      <div key={dateLabel} className="flex flex-col gap-4 w-full">
                        <div className="flex justify-center sticky top-2 z-10">
                          <span className="px-3 py-1 bg-white/80 backdrop-blur border border-slate-200 shadow-sm rounded-full text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                            {dateLabel}
                          </span>
                        </div>
                        {msgs.map((m, i) => {
                          const prevFromMe = i > 0 && msgs[i - 1].fromMe === m.fromMe;
                          return (
                            <div key={m.id} className={`flex flex-col max-w-[75%] ${m.fromMe ? "self-end items-end" : "self-start items-start"} ${prevFromMe ? "mt-0" : "mt-2"}`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm break-words ${m.fromMe ? "bg-gradient-to-br from-[#E0F2FE] to-[#BAE6FD] text-[#0369A1] rounded-br-none border border-[#7DD3FC]/30" : "bg-white text-slate-700 border border-slate-200 rounded-bl-none"}`}>
                                {m.text}
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 mt-1 px-1 flex items-center gap-1">
                                {new Date(m.timestamp && m.timestamp > 1_000_000 ? m.timestamp * 1000 : Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                {m.fromMe && (
                                  m.status === "read" ? <CheckCheck size={12} className="text-[#38BDF8]" />
                                  : m.status === "delivered" ? <CheckCheck size={12} className="text-slate-400" />
                                  : <Check size={12} className="text-slate-400" />
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} className="pb-2" />
                </div>

                {/* Preview de media pendiente */}
                {pendingMedia && (
                  <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
                    {pendingMedia.type === "image" && pendingMedia.preview ? (
                      <img src={pendingMedia.preview} className="w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0" />
                    ) : (
                      <div className="w-14 h-14 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center shrink-0">
                        <FileText size={22} className="text-blue-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-700 truncate">{pendingMedia.file.name}</p>
                      <p className="text-[11px] text-slate-400">{(pendingMedia.file.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={cancelMedia} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 relative">
                  {/* Templates dropdown */}
                  {showTemplates && (
                    <div className="absolute bottom-full left-4 mb-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50">
                      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Plantillas rápidas</span>
                        <button onClick={() => setShowTemplates(false)} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>
                      </div>
                      {TEMPLATES.map((t, i) => (
                        <button key={i} onClick={() => { setInputMsg(t.text); setShowTemplates(false); }}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors">
                          <div className="text-[12px] font-bold text-slate-700">{t.label}</div>
                          <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.text.slice(0, 65)}…</div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex items-end gap-3 max-w-4xl mx-auto">
                    {/* Hidden inputs */}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx" className="hidden" onChange={handleFileSelect} />

                    {/* Botones de acción */}
                    <div className="flex gap-1 shrink-0 pb-1">
                      <button onClick={() => fileInputRef.current?.click()} title="Adjuntar documento"
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                        <Paperclip size={18} />
                      </button>
                      <button onClick={() => imageInputRef.current?.click()} title="Enviar imagen"
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                        <ImageIcon size={18} />
                      </button>
                      <button onClick={() => setShowTemplates((v) => !v)} title="Plantillas rápidas"
                        className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${showTemplates ? "bg-indigo-50 text-[#4E60A9]" : "text-slate-500 hover:bg-slate-100 hover:text-[#4E60A9]"}`}>
                        <FileText size={18} />
                      </button>
                    </div>

                    {/* Textarea */}
                    <div className="flex-1 relative bg-slate-50 border border-slate-200 rounded-2xl focus-within:ring-2 focus-within:ring-[#4E60A9]/20 focus-within:border-[#4E60A9] transition-all">
                      <textarea
                        value={inputMsg}
                        onChange={(e) => setInputMsg(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        placeholder={pendingMedia ? "Escribe un pie de foto (opcional)..." : "Escribe un mensaje al prospecto..."}
                        className="w-full bg-transparent border-none text-[14px] py-3.5 px-4 outline-none resize-none font-medium max-h-[150px] min-h-[50px]"
                        rows={1}
                      />
                    </div>

                    {/* Botón enviar */}
                    <button onClick={sendMessage}
                      disabled={(!inputMsg.trim() && !pendingMedia) || sendingMedia}
                      className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#4E60A9] to-indigo-600 text-white hover:shadow-lg hover:shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transform active:scale-95">
                      {sendingMedia ? <Activity size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 bg-white/50">
                <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                  <MessageCircle size={40} strokeWidth={1.5} className="text-slate-300" />
                </div>
                <p className="text-[18px] font-extrabold text-slate-800">Selecciona una conversación</p>
                <p className="text-[14px] mt-2 font-medium text-slate-500">Elige un contacto a la izquierda para iniciar la prospección.</p>
              </div>
            )}
          </div>

          {/* ── Panel CRM ──────────────────────────────────────────────────────── */}
          {showProfile && activeChat && (
            <div className="w-[280px] bg-white rounded-3xl border border-slate-200 shadow-xl shadow-blue-900/5 shrink-0 overflow-y-auto">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-[14px] font-extrabold text-slate-800 uppercase tracking-wider mb-6 flex items-center gap-2">
                  <Building2 size={16} className="text-indigo-500" /> Inteligencia CRM
                </h3>
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="w-20 h-20 rounded-3xl overflow-hidden bg-slate-100 border-2 border-white shadow-md mb-3">
                    {photosMap[activeChat.phone] || activeChat.photo_url ? (
                      <img src={photosMap[activeChat.phone] || activeChat.photo_url} alt={activeChat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-3xl font-extrabold uppercase">
                        {activeChat.lead_nombre ? activeChat.lead_nombre.charAt(0) : activeChat.name ? activeChat.name.charAt(0) : <User size={32} strokeWidth={1.5} />}
                      </div>
                    )}
                  </div>
                  <h4 className="text-[16px] font-extrabold text-slate-900">{activeChat.lead_nombre || activeChat.name || activeChat.phone}</h4>
                  <span className={`text-[12px] font-bold px-2.5 py-1 rounded-md mt-2 border ${activeChat.lead_id ? "text-emerald-600 bg-emerald-50 border-emerald-100" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
                    {activeChat.lead_id ? "Lead Guardado" : "Contacto Desconocido"}
                  </span>
                </div>

                {activeChat.lead_id ? (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase">Score de Conversión</span>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full ${activeChat.score_potencial && activeChat.score_potencial >= 7 ? "bg-gradient-to-r from-emerald-400 to-green-500" : "bg-gradient-to-r from-amber-400 to-orange-500"}`}
                            style={{ width: `${(activeChat.score_potencial || 0) * 10}%` }} />
                        </div>
                        <span className="text-[13px] font-extrabold text-slate-700">{activeChat.score_potencial || 0}/10</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <Phone size={14} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">+{activeChat.phone}</p>
                          <p className="text-[10px] font-semibold text-slate-400">Teléfono Directo</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Zap size={14} className="text-amber-500 mt-0.5" />
                        <div>
                          <p className="text-[12px] font-bold text-slate-700">{activeChat.nicho || "Sin Nicho"}</p>
                          <p className="text-[10px] font-semibold text-slate-400">Nicho Detectado</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                    <p className="text-[12px] text-slate-500 mb-3">Este contacto no está registrado en tu base de datos de leads.</p>
                    <button disabled className="text-[11px] font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg w-full cursor-not-allowed">
                      Crear Nuevo Lead (próximamente)
                    </button>
                  </div>
                )}
              </div>
              <div className="p-6">
                <button
                  onClick={() => activeChat.lead_id ? router.push(`/clientes/${activeChat.lead_id}`) : undefined}
                  disabled={!activeChat.lead_id}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[12px] py-2.5 rounded-xl transition-colors border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
                  Ver Ficha Completa
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><Activity className="animate-spin text-slate-400" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
