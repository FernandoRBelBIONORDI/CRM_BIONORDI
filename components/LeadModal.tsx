"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  X, Phone, Mail, Globe, MapPin, Calendar, MessageCircle, Sparkles,
  Activity, Check, ChevronDown, Clock, Trash2, Plus, ExternalLink,
  Tag, BarChart2, Building2, User, Wrench, FileText, ClipboardList,
  UserCheck, ArrowRight
} from "lucide-react";
import QuoteModal from "@/components/QuoteModal";
import Link from "next/link";
import { waLink } from "@/lib/ui";

interface Lead {
  id: number; nombre: string; telefono?: string; whatsapp?: string; correo?: string; sitio_web?: string;
  direccion?: string; ciudad?: string; municipio?: string; estado_republica?: string;
  nicho?: string; tamano_estimado?: string;
  score_potencial?: number; status_crm: string; notas?: string;
  decisor_nombre?: string; decisor_cargo?: string;
  fecha_ultimo_cambio?: string; fecha_proximo_contacto?: string;
  fuente?: string; confianza_fuente?: string; asignado_a?: string;
}
interface Interaccion { id: number; tipo: string; contenido: string; fecha: string; resultado?: string; usuario_nombre?: string; }
interface Equipo { id: number; tipo: string; marca?: string; modelo?: string; num_serie?: string; estado: string; notas?: string; fecha_alta: string; }
interface Cotizacion { id: number; tipo: string; folio?: string; monto_total: number; status: string; fecha: string; eq_tipo?: string; eq_marca?: string; eq_modelo?: string; }
interface UsuarioOpt { id: number; nombre: string; }

const S: Record<string, { label: string; color: string; bg: string }> = {
  nuevo:       { label: "Nuevo",       color: "#5A85F1", bg: "#EEF3FC" },
  contactado:  { label: "Contactado",  color: "#D97706", bg: "#FFFBEB" },
  seguimiento: { label: "Seguimiento", color: "#EA580C", bg: "#FFF7ED" },
  diagnostico: { label: "Diagnóstico", color: "#7C3AED", bg: "#F5F3FF" },
  cliente:     { label: "Cliente",     color: "#34A853", bg: "#EEF9F1" },
  sin_equipo:  { label: "Sin equipo",  color: "#64748B", bg: "#F1F5F9" },
  descartado:  { label: "Descartado",  color: "#DC2626", bg: "#FEF2F2" },
};
const STATUS_OPTS = Object.entries(S).map(([k, v]) => ({ value: k, label: v.label }));

const TIPO_OPTS = [
  { value: "mensaje_wa",    label: "WhatsApp" },
  { value: "llamada",       label: "Llamada" },
  { value: "email",         label: "Email" },
  { value: "visita",        label: "Visita" },
  { value: "nota_interna",  label: "Nota interna" },
];
const RES_OPTS = [
  { value: "sin_respuesta",     label: "Sin respuesta" },
  { value: "interesado",        label: "Interesado" },
  { value: "no_interesado",     label: "No interesado" },
  { value: "cita_agendada",     label: "Cita agendada" },
  { value: "requiere_cotizacion", label: "Requiere cotización" },
  { value: "cierre",            label: "Cierre" },
];

const ESTADO_EQUIPO = [
  { value: "activo",    label: "Activo",    color: "#34A853" },
  { value: "en_falla",  label: "En falla",  color: "#EF4444" },
  { value: "reparado",  label: "Reparado",  color: "#4E60A9" },
  { value: "dado_baja", label: "Dado de baja", color: "#94A3B8" },
];

function waTemplates(lead: Lead) {
  const nombre = lead.nombre;
  const tel = lead.telefono ? `52${lead.telefono.replace(/\D/g, "")}` : "";
  return [
    {
      etapa: "nuevo",
      label: "Primer contacto",
      texto: `Hola, buenos días. Le contacto de parte de *Bionordi*, empresa especializada en reparación de transductores de ultrasonido médico.\n\nNos dedicamos a devolver la funcionalidad a equipos que presentan fallas, con garantía de 6 meses y tiempo de entrega de 5–7 días hábiles.\n\n¿Actualmente cuentan con algún transductor fuera de servicio o con fallas? Con gusto le brindamos diagnóstico sin costo.\n\nQuedo a sus órdenes. 🩺`,
    },
    {
      etapa: "contactado",
      label: "Seguimiento (sin respuesta)",
      texto: `Hola, buen día. Le escribo nuevamente de *Bionordi*.\n\nHace unos días le contacté sobre nuestro servicio de reparación de transductores de ultrasonido. ¿Tuvieron oportunidad de revisarlo?\n\nEntendemos que el tiempo es valioso; si lo prefieren puedo agendar una llamada rápida de 5 minutos para resolver sus dudas.\n\n¿Les viene bien esta semana? 🙏`,
    },
    {
      etapa: "seguimiento",
      label: "Cotización enviada",
      texto: `Hola, buenos días. Le escribo de *Bionordi* para dar seguimiento a la cotización que les enviamos.\n\n¿Tuvieron oportunidad de revisarla? Con gusto aclaro cualquier punto o ajusto según sus necesidades.\n\nRecuerden que el diagnóstico es sin costo y trabajamos con garantía de 6 meses en todas nuestras reparaciones. ✅`,
    },
    {
      etapa: "diagnostico",
      label: "Diagnóstico en proceso",
      texto: `Hola, buenos días. Le informamos que el transductor de *${nombre}* ya se encuentra en nuestro taller en proceso de diagnóstico.\n\nEn cuanto tengamos el informe técnico completo le compartimos los detalles y el presupuesto para su aprobación.\n\nCualquier duda, aquí estamos. 🔧`,
    },
    {
      etapa: "cliente",
      label: "Seguimiento post-venta (6 meses)",
      texto: `Hola, buen día. Le contactamos de *Bionordi*.\n\nHan pasado aproximadamente 6 meses desde que realizamos la reparación de su transductor. Esperamos que el equipo haya funcionado sin inconvenientes. 😊\n\n¿Cuentan actualmente con algún transductor con fallas o que requiera mantenimiento preventivo? Con gusto les atendemos con la misma calidad y garantía.\n\nQuedo a sus órdenes.`,
    },
  ].filter(t => !["diagnostico", "cliente"].includes(t.etapa) || t.etapa === lead.status_crm || t.etapa === "cliente");
}

interface Props {
  lead: Lead | null;
  onClose: () => void;
  onUpdate: (id: number, upd: Partial<Lead>) => void;
  onDelete: (id: number) => void;
}

export default function LeadModal({ lead, onClose, onUpdate, onDelete }: Props) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const [ints, setInts]               = useState<Interaccion[]>([]);
  const [equipos, setEquipos]         = useState<Equipo[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [usuarios, setUsuarios]       = useState<UsuarioOpt[]>([]);
  const [loadingInts, setLoadingInts] = useState(false);
  const [nota, setNota]               = useState("");
  const [proxDate, setProxDate]       = useState("");
  const [status, setStatus]           = useState("");
  const [asignadoA, setAsignadoA]     = useState("");
  const [newTipo, setNewTipo]         = useState("mensaje_wa");
  const [newRes, setNewRes]           = useState("sin_respuesta");
  const [newCont, setNewCont]         = useState("");
  const [addingInt, setAddingInt]     = useState(false);
  const [savingNota, setSavingNota]   = useState(false);
  const [showEquipoForm, setShowEquipoForm] = useState(false);
  const [showQuote, setShowQuote]     = useState(false);
  const [editWA, setEditWA]           = useState(false);
  const [waVal, setWaVal]             = useState("");
  const [copiedTpl, setCopiedTpl]     = useState<number | null>(null);
  const [newEquipo, setNewEquipo]     = useState({ tipo: "", marca: "", modelo: "", num_serie: "", estado: "activo", notas: "" });
  const [savingEq, setSavingEq]       = useState(false);
  const [creatingOT, setCreatingOT]   = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lead) return;
    setNota(lead.notas || "");
    setProxDate(lead.fecha_proximo_contacto?.slice(0, 10) || "");
    setStatus(lead.status_crm);
    setAsignadoA(lead.asignado_a || "");
    setWaVal(lead.whatsapp || "");
    setInts([]);
    setEquipos([]);
    setCotizaciones([]);
    loadInts(lead.id);
    loadEquipos(lead.id);
    loadCotizaciones(lead.id);
  }, [lead?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuarios(d.usuarios || []));
  }, [isAdmin]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // No cerrar si hay un modal hijo abierto (QuoteModal u otros portals)
      if (showQuote) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    if (lead) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [lead, showQuote]);

  const loadInts = async (id: number) => {
    setLoadingInts(true);
    const d = await fetch(`/api/interactions?lead_id=${id}`).then(r => r.json());
    setInts(d.interacciones || []);
    setLoadingInts(false);
  };

  const loadEquipos = async (id: number) => {
    const d = await fetch(`/api/equipos?lead_id=${id}`).then(r => r.json());
    setEquipos(d.equipos || []);
  };

  const loadCotizaciones = async (id: number) => {
    const d = await fetch(`/api/cotizaciones?lead_id=${id}`).then(r => r.json());
    setCotizaciones(d.cotizaciones || []);
  };

  const updateCotStatus = async (cotId: number, newStatus: string) => {
    await fetch(`/api/cotizaciones/${cotId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setCotizaciones(p => p.map(c => c.id === cotId ? { ...c, status: newStatus } : c));
  };

  const createOTFromCot = async (cot: Cotizacion) => {
    if (!lead) return;
    setCreatingOT(cot.id);
    const res = await fetch("/api/ordenes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: lead.id,
        cotizacion_id: cot.id,
        equipo_tipo: cot.eq_tipo || "",
        equipo_marca: cot.eq_marca || "",
        equipo_modelo: cot.eq_modelo || "",
        falla_reportada: `Cotización ${cot.folio || `#${cot.id}`} aprobada`,
        presupuesto: cot.monto_total,
        presupuesto_aprobado: 1,
        fecha_ingreso: new Date().toISOString().slice(0, 10),
        status: "recibido",
      }),
    });
    const data = await res.json();
    setCreatingOT(null);
    if (data.orden?.folio) {
      alert(`Orden creada: ${data.orden.folio}`);
    }
  };

  const saveAsignadoA = async (val: string) => {
    if (!lead) return;
    setAsignadoA(val);
    await fetch("/api/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: lead.id, asignado_a: val || null }),
    });
    onUpdate(lead.id, { asignado_a: val || undefined });
  };

  const addInt = async () => {
    if (!newCont.trim() || !lead) return;
    setAddingInt(true);
    await fetch("/api/interactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: lead.id, tipo: newTipo, contenido: newCont, resultado: newRes }),
    });
    setNewCont("");
    await loadInts(lead.id);
    setAddingInt(false);
  };

  const saveWA = async () => {
    if (!lead) return;
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, whatsapp: waVal.trim() || null }) });
    onUpdate(lead.id, { whatsapp: waVal.trim() || undefined });
    setEditWA(false);
  };

  const saveNota = async () => {
    if (!lead) return;
    setSavingNota(true);
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, notas: nota }) });
    onUpdate(lead.id, { notas: nota });
    setSavingNota(false);
  };

  const saveProxDate = async (val: string) => {
    if (!lead) return;
    setProxDate(val);
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, fecha_proximo_contacto: val || null }) });
    onUpdate(lead.id, { fecha_proximo_contacto: val || undefined });
  };

  const changeStatus = async (val: string) => {
    if (!lead) return;
    setStatus(val);
    await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, status_crm: val }) });
    onUpdate(lead.id, { status_crm: val });
  };

  const deleteInt = async (intId: number) => {
    if (!lead) return;
    await fetch("/api/interactions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: intId }) });
    setInts(p => p.filter(i => i.id !== intId));
  };

  const addEquipo = async () => {
    if (!lead || !newEquipo.tipo.trim()) return;
    setSavingEq(true);
    await fetch("/api/equipos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: lead.id, ...newEquipo }),
    });
    setNewEquipo({ tipo: "", marca: "", modelo: "", num_serie: "", estado: "activo", notas: "" });
    setShowEquipoForm(false);
    await loadEquipos(lead.id);
    setSavingEq(false);
  };

  const deleteEquipo = async (eqId: number) => {
    await fetch("/api/equipos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eqId }) });
    setEquipos(p => p.filter(e => e.id !== eqId));
  };

  if (!lead) return null;

  const st = S[status] || S.nuevo;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const proxFecha = proxDate ? new Date(proxDate + "T00:00:00") : null;
  const proxVencida = proxFecha && proxFecha < hoy;
  const proxHoy = proxFecha && proxFecha.toDateString() === hoy.toDateString();

  const tipoLabel = (t: string) => TIPO_OPTS.find(o => o.value === t)?.label || t;
  const resColor = (r?: string) => {
    if (!r) return "text-gray-400";
    if (r === "interesado" || r === "cita_agendada" || r === "cierre") return "text-[#34A853]";
    if (r === "no_interesado" || r === "sin_respuesta") return "text-[#EF4444]";
    return "text-[#D97706]";
  };
  const estadoColor = (e: string) => ESTADO_EQUIPO.find(x => x.value === e)?.color || "#94A3B8";
  const estadoLabel = (e: string) => ESTADO_EQUIPO.find(x => x.value === e)?.label || e;

  return (
    <>
      {showQuote && <QuoteModal lead={lead} onClose={() => setShowQuote(false)} />}

      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

        {/* Panel */}
        <div ref={panelRef}
          className="relative w-[520px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
          style={{ borderLeft: "1px solid #E2E8F0" }}>

          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-gray-400 mono">#{String(lead.id).padStart(4, "0")}</span>
                  {lead.score_potencial && (
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                      style={{ color: lead.score_potencial >= 7 ? "#34A853" : lead.score_potencial >= 4 ? "#D97706" : "#94A3B8", backgroundColor: lead.score_potencial >= 7 ? "#EEF9F1" : lead.score_potencial >= 4 ? "#FFFBEB" : "#F1F5F9" }}>
                      ★ {lead.score_potencial.toFixed(1)}
                    </span>
                  )}
                </div>
                <h2 className="text-[20px] font-bold text-[#1E293B] tracking-tight leading-tight truncate">{lead.nombre}</h2>
                {lead.ciudad && <p className="text-[12px] text-gray-400 font-medium mt-0.5">{lead.ciudad}{lead.estado_republica ? `, ${lead.estado_republica}` : ""}</p>}
              </div>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            {/* Asignado a — accesible para todos los usuarios */}
            <div className="mt-2 flex items-center gap-2">
              <UserCheck size={12} className="text-gray-400 shrink-0" />
              <select value={asignadoA} onChange={e => saveAsignadoA(e.target.value)}
                className="text-[11px] font-semibold text-gray-500 bg-transparent border-0 outline-none cursor-pointer">
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
              </select>
            </div>

            {/* Status selector */}
            <div className="mt-3 flex items-center gap-2">
              <select value={status} onChange={e => changeStatus(e.target.value)}
                className="text-[12px] font-bold px-4 py-2 rounded-full outline-none cursor-pointer border-0 appearance-none shadow-sm"
                style={{ color: st.color, backgroundColor: st.bg }}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {waLink(lead.whatsapp || lead.telefono) && (
                <a
                  href={waLink(lead.whatsapp || lead.telefono)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] px-3 py-2 rounded-full transition-colors shadow-sm">
                  <MessageCircle size={13} strokeWidth={2.5} /> WhatsApp
                </a>
              )}
              <button onClick={() => setShowQuote(true)}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-2 rounded-full transition-colors shadow-sm">
                <FileText size={13} /> Cotizar
              </button>
              <Link href={`/taller?nuevo=1&lead_id=${lead.id}`}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#7C3AED] hover:text-white px-3 py-2 rounded-full transition-colors shadow-sm">
                <ClipboardList size={13} /> Nueva OT
              </Link>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">

            {/* Contact info */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Datos de Contacto</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Phone,    label: "Teléfono",  val: lead.telefono },
                  { icon: Mail,     label: "Correo",    val: lead.correo },
                  { icon: Globe,    label: "Sitio web", val: lead.sitio_web, href: lead.sitio_web },
                  { icon: Tag,      label: "Nicho",     val: lead.nicho },
                  { icon: Building2,label: "Tamaño",    val: lead.tamano_estimado },
                  { icon: User,     label: "Decisor",   val: lead.decisor_nombre ? `${lead.decisor_nombre}${lead.decisor_cargo ? ` · ${lead.decisor_cargo}` : ""}` : undefined },
                ].map(({ icon: Icon, label, val, href }) => (
                  <div key={label} className={`flex items-start gap-2 p-2 rounded-lg ${val ? "bg-gray-50" : "opacity-0 pointer-events-none"}`}>
                    <Icon size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-gray-400 font-medium">{label}</div>
                      {href
                        ? <a href={href.startsWith("http") ? href : `https://${href}`} target="_blank" rel="noopener noreferrer"
                            className="text-[12px] font-bold text-[#4E60A9] hover:underline truncate block">{val}</a>
                        : <div className="text-[12px] font-bold text-[#1E293B] truncate">{val || "—"}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* WhatsApp editable */}
              <div className="mt-2 flex items-center gap-2">
                <MessageCircle size={13} className="text-[#22C55E] shrink-0" />
                {editWA ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={waVal}
                      onChange={e => setWaVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") saveWA(); if (e.key === "Escape") setEditWA(false); }}
                      placeholder="52 55 1234 5678"
                      className="flex-1 text-[12px] border border-[#22C55E]/40 rounded-lg px-3 py-1.5 outline-none focus:border-[#22C55E]/70 bg-white"
                    />
                    <button onClick={saveWA} className="text-[11px] font-bold text-white bg-[#22C55E] hover:bg-[#16A34A] px-3 py-1.5 rounded-lg transition-colors">
                      Guardar
                    </button>
                    <button onClick={() => { setEditWA(false); setWaVal(lead.whatsapp || ""); }} className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1.5">
                      ✕
                    </button>
                  </div>
                ) : lead.whatsapp ? (
                  <div className="flex items-center gap-2 flex-1">
                    <a href={waLink(lead.whatsapp)!} target="whatsapp_web"
                      className="text-[12px] font-bold text-[#22C55E] hover:underline">{lead.whatsapp}</a>
                    <button onClick={() => setEditWA(true)} className="text-[10px] text-gray-400 hover:text-gray-600 underline ml-1">editar</button>
                  </div>
                ) : (
                  <button onClick={() => setEditWA(true)} className="text-[12px] text-[#22C55E] hover:text-[#16A34A] font-semibold">
                    + Agregar WhatsApp
                  </button>
                )}
              </div>
            </div>

            {/* Equipos del cliente */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Equipo del Cliente</h3>
                <button onClick={() => setShowEquipoForm(p => !p)}
                  className="flex items-center gap-1 text-[11px] font-bold text-[#4E60A9] hover:text-[#2B5FD9] transition-colors">
                  <Plus size={12} /> Agregar
                </button>
              </div>

              {/* Add form */}
              {showEquipoForm && (
                <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="Tipo de transductor *" value={newEquipo.tipo} onChange={e => setNewEquipo(p => ({ ...p, tipo: e.target.value }))}
                      className="text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 col-span-2 placeholder:text-gray-400" />
                    <input placeholder="Marca" value={newEquipo.marca} onChange={e => setNewEquipo(p => ({ ...p, marca: e.target.value }))}
                      className="text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
                    <input placeholder="Modelo" value={newEquipo.modelo} onChange={e => setNewEquipo(p => ({ ...p, modelo: e.target.value }))}
                      className="text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
                    <input placeholder="No. serie" value={newEquipo.num_serie} onChange={e => setNewEquipo(p => ({ ...p, num_serie: e.target.value }))}
                      className="text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
                    <select value={newEquipo.estado} onChange={e => setNewEquipo(p => ({ ...p, estado: e.target.value }))}
                      className="text-[12px] font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none cursor-pointer">
                      {ESTADO_EQUIPO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                  </div>
                  <input placeholder="Notas (opcional)" value={newEquipo.notas} onChange={e => setNewEquipo(p => ({ ...p, notas: e.target.value }))}
                    className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowEquipoForm(false)}
                      className="text-[11px] font-bold text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button onClick={addEquipo} disabled={savingEq || !newEquipo.tipo.trim()}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#2B5FD9] px-4 py-1.5 rounded-lg transition-colors disabled:opacity-40">
                      {savingEq ? <Activity size={11} className="animate-spin" /> : <Check size={11} />}
                      Guardar
                    </button>
                  </div>
                </div>
              )}

              {equipos.length === 0 && !showEquipoForm ? (
                <div className="py-4 text-center text-[12px] text-gray-400 italic">Sin equipos registrados.</div>
              ) : (
                <div className="space-y-2">
                  {equipos.map(eq => (
                    <div key={eq.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 group hover:border-gray-200 transition-colors">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: estadoColor(eq.estado) + "20" }}>
                        <Wrench size={14} style={{ color: estadoColor(eq.estado) }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] font-bold text-[#1E293B]">{eq.tipo}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: estadoColor(eq.estado), backgroundColor: estadoColor(eq.estado) + "20" }}>
                            {estadoLabel(eq.estado)}
                          </span>
                        </div>
                        {(eq.marca || eq.modelo) && (
                          <div className="text-[11px] text-gray-500 font-medium mt-0.5">
                            {[eq.marca, eq.modelo].filter(Boolean).join(" · ")}
                            {eq.num_serie && <span className="ml-2 text-gray-400">S/N: {eq.num_serie}</span>}
                          </div>
                        )}
                        {eq.notas && <p className="text-[11px] text-gray-400 mt-0.5 italic">{eq.notas}</p>}
                      </div>
                      <button onClick={() => deleteEquipo(eq.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Próximo contacto */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Próximo Contacto</h3>
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border ${proxVencida ? "border-red-200 bg-[#FEF2F2]" : proxHoy ? "border-blue-200 bg-[#EEF3FC]" : "border-gray-200 bg-gray-50"}`}>
                  <Calendar size={14} className={proxVencida ? "text-[#DC2626]" : proxHoy ? "text-[#4E60A9]" : "text-gray-400"} />
                  <input type="date" value={proxDate} onChange={e => saveProxDate(e.target.value)}
                    className={`flex-1 bg-transparent outline-none text-[13px] font-bold ${proxVencida ? "text-[#DC2626]" : proxHoy ? "text-[#4E60A9]" : "text-[#1E293B]"}`} />
                </div>
                {proxDate && (
                  <button onClick={() => saveProxDate("")}
                    className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              {proxVencida && <p className="text-[11px] text-[#DC2626] font-bold mt-1.5 ml-1">⚠ Seguimiento vencido</p>}
            </div>

            {/* Notas */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Notas</h3>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={3}
                placeholder="Agrega notas de contexto, detalles del equipo, etc."
                className="w-full text-[13px] font-medium text-[#1E293B] bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#4E60A9]/40 focus:bg-white resize-none placeholder:text-gray-400 transition-all" />
              <div className="flex justify-end mt-2">
                <button onClick={saveNota}
                  className="flex items-center gap-1.5 text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-4 py-2 rounded-full transition-colors">
                  {savingNota ? <Activity size={12} className="animate-spin" /> : <Check size={12} />}
                  Guardar nota
                </button>
              </div>
            </div>

            {/* WhatsApp Templates */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Mensajes Rápidos WA</h3>
              <div className="space-y-2">
                {waTemplates(lead).map((tpl, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                      <span className="text-[11px] font-bold text-[#1E293B]">{tpl.label}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(tpl.texto);
                            setCopiedTpl(i);
                            setTimeout(() => setCopiedTpl(null), 2000);
                          }}
                          className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors px-2 py-1 rounded-lg hover:bg-[#EEF3FC]">
                          {copiedTpl === i ? <Check size={10} className="text-[#34A853]" /> : <MessageCircle size={10} />}
                          {copiedTpl === i ? "Copiado" : "Copiar"}
                        </button>
                        {waLink(lead.whatsapp || lead.telefono) && (
                          <a href={waLink(lead.whatsapp || lead.telefono, tpl.texto)!}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-green-600 hover:text-white hover:bg-green-500 transition-colors px-2 py-1 rounded-lg bg-green-50">
                            <ExternalLink size={10} /> Enviar
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="px-3 py-2 text-[11px] text-gray-500 font-medium leading-relaxed whitespace-pre-wrap line-clamp-3">{tpl.texto}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Cotizaciones */}
            {cotizaciones.length > 0 && (
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cotizaciones</h3>
                <div className="space-y-2">
                  {cotizaciones.map(cot => {
                    const isAprobada = cot.status === "aprobada";
                    const isRechazada = cot.status === "rechazada";
                    return (
                      <div key={cot.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12px] font-bold text-[#1E293B]">{cot.folio || `#${cot.id}`}</span>
                            <span className="text-[11px] text-gray-400">{cot.tipo}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isAprobada ? "bg-green-50 text-green-700" :
                              isRechazada ? "bg-red-50 text-red-500" :
                              "bg-[#FFFBEB] text-[#D97706]"}`}>
                              {cot.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            ${cot.monto_total?.toLocaleString("es-MX") || "0"} · {cot.fecha?.slice(0, 10)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isAprobada && !isRechazada && (
                            <>
                              <button onClick={() => updateCotStatus(cot.id, "aprobada")}
                                className="text-[10px] font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg transition-colors">
                                Aprobar
                              </button>
                              <button onClick={() => updateCotStatus(cot.id, "rechazada")}
                                className="text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors">
                                Rechazar
                              </button>
                            </>
                          )}
                          {isAprobada && (
                            <button onClick={() => createOTFromCot(cot)} disabled={creatingOT === cot.id}
                              className="flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#7C3AED] hover:text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                              {creatingOT === cot.id
                                ? <Activity size={10} className="animate-spin" />
                                : <><ClipboardList size={10} /> Crear OT</>}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Historial de interacciones */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Historial de Contacto</h3>

              {/* Add interaction */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 border border-gray-100">
                <div className="flex gap-2 mb-2">
                  <select value={newTipo} onChange={e => setNewTipo(e.target.value)}
                    className="text-[11px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer flex-1">
                    {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={newRes} onChange={e => setNewRes(e.target.value)}
                    className="text-[11px] font-bold bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none cursor-pointer flex-1">
                    {RES_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input value={newCont} onChange={e => setNewCont(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addInt()}
                    placeholder="¿Qué pasó? (Enter para guardar)"
                    className="flex-1 text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
                  <button onClick={addInt} disabled={addingInt || !newCont.trim()}
                    className="w-9 h-9 flex items-center justify-center bg-[#4E60A9] text-white rounded-lg hover:bg-[#2B5FD9] transition-colors disabled:opacity-40">
                    {addingInt ? <Activity size={13} className="animate-spin" /> : <Plus size={14} />}
                  </button>
                </div>
              </div>

              {/* Timeline */}
              {loadingInts ? (
                <div className="py-6 flex items-center justify-center">
                  <Activity size={16} className="animate-spin text-gray-400" />
                </div>
              ) : ints.length === 0 ? (
                <div className="py-6 text-center text-[12px] text-gray-400 italic">Sin interacciones registradas.</div>
              ) : (
                <div className="space-y-2">
                  {ints.map(i => (
                    <div key={i.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 group hover:border-gray-200 transition-colors">
                      <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                          {new Date(i.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-2 py-0.5 rounded-full">{tipoLabel(i.tipo)}</span>
                          {i.resultado && (
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${resColor(i.resultado)}`}>
                              {i.resultado.replace(/_/g, " ")}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] font-medium text-[#1E293B] leading-relaxed">{i.contenido}</p>
                        {i.usuario_nombre && (
                          <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <User size={9} /> {i.usuario_nombre}
                          </span>
                        )}
                      </div>
                      <button onClick={() => deleteInt(i.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0">
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-gray-50/50">
            <button onClick={() => {
              if (window.confirm(`¿Eliminar "${lead.nombre}"?`)) { onDelete(lead.id); onClose(); }
            }} className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-2 rounded-full transition-colors">
              <Trash2 size={13} /> Eliminar
            </button>
            <div className="flex items-center gap-2 text-[11px] text-gray-400 font-medium">
              {lead.fecha_ultimo_cambio && (
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  Actualizado {new Date(lead.fecha_ultimo_cambio).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
