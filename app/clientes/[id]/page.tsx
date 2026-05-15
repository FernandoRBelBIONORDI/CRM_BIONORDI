"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MapPin, Globe, MessageCircle,
  FileText, Wrench, Package, Plus, Trash2, ChevronDown,
  Star, Calendar, Building2, Clock, CheckCircle2, XCircle,
  Edit2, Save, X, FileDown, Users, UserCheck,
  ExternalLink, Check, ClipboardList, Activity,
} from "lucide-react";
import { initials, avatarColor, fmtDate, fmtDatetime, waLink } from "@/lib/ui";
import CotizacionManualModal from "@/components/CotizacionManualModal";
import { useConfirm } from "@/hooks/useConfirm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: number; nombre: string; nicho: string; sub_nicho?: string;
  telefono?: string; whatsapp?: string; correo?: string;
  sitio_web?: string; direccion?: string; ciudad?: string;
  estado_republica?: string; status_crm: string;
  notas?: string; fuente?: string;
  fecha_ultimo_contacto?: string; fecha_extraccion?: string;
  fecha_proximo_contacto?: string; fecha_ultimo_cambio?: string;
  tamano_estimado?: string; nivel_socioeconomico?: string;
  asignado_a?: string;
}

interface Interaccion {
  id: number; lead_id: number; tipo: string;
  contenido: string; fecha: string; resultado?: string; usuario_nombre?: string;
}

interface Cotizacion {
  id: number; lead_id?: number; tipo: string; folio?: string;
  monto_total: number; items_json?: string; eq_tipo?: string; eq_marca?: string;
  eq_modelo?: string; notas?: string; status: string; fecha: string;
  pdf_path?: string;
}

interface Equipo {
  id: number; lead_id: number; tipo: string; marca?: string;
  modelo?: string; num_serie?: string; estado: string; notas?: string;
  fecha_alta?: string;
}

interface Orden {
  id: number; folio: string; lead_id?: number;
  cotizacion_id?: number; cotizacion_folio?: string; cotizacion_monto?: number;
  equipo_tipo?: string; equipo_marca?: string; equipo_modelo?: string; falla_reportada?: string;
  diagnostico?: string; presupuesto?: number; precio_final?: number;
  status: string; fecha_ingreso?: string; fecha_entrega?: string;
  fecha_creacion?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function $f(n?: number) { return n != null ? `$${n.toLocaleString("es-MX")}` : "—"; }

const S: Record<string, { bg: string; text: string; label: string; color: string }> = {
  nuevo:        { bg:"#EFF6FF", text:"#1D4ED8", color:"#1D4ED8", label:"Nuevo" },
  contactado:   { bg:"#FFFBEB", text:"#D97706", color:"#D97706", label:"Contactado" },
  seguimiento:  { bg:"#FFF7ED", text:"#EA580C", color:"#EA580C", label:"Seguimiento" },
  diagnostico:  { bg:"#F5F3FF", text:"#7C3AED", color:"#7C3AED", label:"Diagnóstico" },
  cliente:      { bg:"#DCFCE7", text:"#14532D", color:"#14532D", label:"Cliente ★" },
  sin_equipo:   { bg:"#F1F5F9", text:"#64748B", color:"#64748B", label:"Sin equipo" },
  descartado:   { bg:"#FEF2F2", text:"#991B1B", color:"#991B1B", label:"Descartado" },
};
const STATUS_OPTS = Object.entries(S).map(([k, v]) => ({ value: k, label: v.label }));

const TIPO_INT: Record<string, { label: string; color: string; icon: any }> = {
  mensaje_wa:    { label:"WhatsApp",    color:"#22C55E", icon: MessageCircle },
  llamada:       { label:"Llamada",     color:"#3B82F6", icon: Phone },
  visita:        { label:"Visita",      color:"#8B5CF6", icon: Building2 },
  email:         { label:"Email",       color:"#F59E0B", icon: Mail },
  nota_interna:  { label:"Nota",        color:"#94A3B8", icon: FileText },
};

const RESULTADO_CFG: Record<string, { icon: any; color: string; label: string }> = {
  sin_respuesta:       { icon: Clock,         color:"#94A3B8", label:"Sin respuesta" },
  respondio_positivo:  { icon: CheckCircle2,  color:"#22C55E", label:"Respondió positivo" },
  respondio_negativo:  { icon: XCircle,       color:"#EF4444", label:"Respondió negativo" },
  interesado:          { icon: CheckCircle2,  color:"#22C55E", label:"Interesado" },
  no_interesado:       { icon: XCircle,       color:"#EF4444", label:"No interesado" },
  cita_agendada:       { icon: Calendar,      color:"#8B5CF6", label:"Cita agendada" },
  requiere_cotizacion: { icon: FileText,      color:"#D97706", label:"Requiere cotización" },
  cierre:              { icon: Star,          color:"#F59E0B", label:"Cierre" },
};

const STATUS_COT: Record<string, { bg: string; text: string; label: string }> = {
  borrador:  { bg:"#F1F5F9", text:"#475569", label:"Borrador" },
  enviada:   { bg:"#EFF6FF", text:"#1D4ED8", label:"Enviada" },
  aprobada:  { bg:"#DCFCE7", text:"#14532D", label:"Aprobada" },
  rechazada: { bg:"#FEF2F2", text:"#991B1B", label:"Rechazada" },
};

const TIPO_COT: Record<string, string> = {
  reparacion: "Reparación", venta: "Venta", mantenimiento: "Mantenimiento", consumibles: "Consumibles",
};

const STATUS_ORD: Record<string, { bg: string; text: string; label: string }> = {
  recibido:    { bg:"#EFF6FF", text:"#1D4ED8", label:"Recibido" },
  diagnostico: { bg:"#FFF7ED", text:"#9A3412", label:"Diagnóstico" },
  en_proceso:  { bg:"#FDF4FF", text:"#6B21A8", label:"En proceso" },
  listo:       { bg:"#DCFCE7", text:"#14532D", label:"Listo" },
  entregado:   { bg:"#F0FDF4", text:"#166534", label:"Entregado" },
  cancelado:   { bg:"#FEF2F2", text:"#991B1B", label:"Cancelado" },
};

const ESTADO_EQUIPO = [
  { value: "activo",    label: "Activo",       color: "#34A853" },
  { value: "en_falla",  label: "En falla",     color: "#EF4444" },
  { value: "reparado",  label: "Reparado",     color: "#4E60A9" },
  { value: "dado_baja", label: "Dado de baja", color: "#94A3B8" },
];

function waTemplates(lead: Lead) {
  return [
    {
      label: "Primer contacto",
      texto: `Hola, buenos días. Le contacto de parte de *Bionordi*, empresa especializada en reparación de transductores de ultrasonido médico.\n\nNos dedicamos a devolver la funcionalidad a equipos que presentan fallas, con garantía de 6 meses y tiempo de entrega de 5–7 días hábiles.\n\n¿Actualmente cuentan con algún transductor fuera de servicio o con fallas? Con gusto le brindamos diagnóstico sin costo.\n\nQuedo a sus órdenes. 🩺`,
    },
    {
      label: "Seguimiento (sin respuesta)",
      texto: `Hola, buen día. Le escribo nuevamente de *Bionordi*.\n\nHace unos días le contacté sobre nuestro servicio de reparación de transductores de ultrasonido. ¿Tuvieron oportunidad de revisarlo?\n\nEntendemos que el tiempo es valioso; si lo prefieren puedo agendar una llamada rápida de 5 minutos para resolver sus dudas.\n\n¿Les viene bien esta semana? 🙏`,
    },
    {
      label: "Cotización enviada",
      texto: `Hola, buenos días. Le escribo de *Bionordi* para dar seguimiento a la cotización que les enviamos.\n\n¿Tuvieron oportunidad de revisarla? Con gusto aclaro cualquier punto o ajusto según sus necesidades.\n\nRecuerden que el diagnóstico es sin costo y trabajamos con garantía de 6 meses en todas nuestras reparaciones. ✅`,
    },
    {
      label: "Seguimiento post-venta (6 meses)",
      texto: `Hola, buen día. Le contactamos de *Bionordi*.\n\nHan pasado aproximadamente 6 meses desde que realizamos la reparación de su transductor. Esperamos que el equipo haya funcionado sin inconvenientes. 😊\n\n¿Cuentan actualmente con algún transductor con fallas o que requiera mantenimiento preventivo? Con gusto les atendemos con la misma calidad y garantía.\n\nQuedo a sus órdenes.`,
    },
  ];
}

const sel = "sel text-[12px]";
const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const myName = session?.user?.name || "";
  const { confirm, ConfirmDialog } = useConfirm();

  const [lead,          setLead]          = useState<Lead | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [cotizaciones,  setCotizaciones]  = useState<Cotizacion[]>([]);
  const [equipos,       setEquipos]       = useState<Equipo[]>([]);
  const [ordenes,       setOrdenes]       = useState<Orden[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [previewCot,    setPreviewCot]    = useState<Cotizacion | null>(null);
  const [usuarios,      setUsuarios]      = useState<{id:number;nombre:string}[]>([]);

  // Editable estados del lead
  const [statusEdit,  setStatusEdit]  = useState("");
  const [asignadoA,   setAsignadoA]   = useState("");
  const [proxDate,    setProxDate]    = useState("");
  const [editWA,      setEditWA]      = useState(false);
  const [waVal,       setWaVal]       = useState("");

  // Nueva interacción
  const [showAddInt,    setShowAddInt]    = useState(false);
  const [intTipo,       setIntTipo]       = useState("nota_interna");
  const [intContenido,  setIntContenido]  = useState("");
  const [intResultado,  setIntResultado]  = useState("sin_respuesta");
  const [savingInt,     setSavingInt]     = useState(false);

  // Equipo
  const [showEquipoForm, setShowEquipoForm] = useState(false);
  const [newEquipo, setNewEquipo] = useState({ tipo: "", marca: "", modelo: "", num_serie: "", estado: "activo", notas: "" });
  const [savingEq, setSavingEq] = useState(false);

  // Notas
  const [editNotas, setEditNotas] = useState(false);
  const [notasVal,  setNotasVal]  = useState("");

  // Mensajes WA
  const [copiedTpl, setCopiedTpl] = useState<number | null>(null);

  // Cotizar
  const [showQuote, setShowQuote] = useState(false);
  const [showQuoteTypePicker, setShowQuoteTypePicker] = useState(false);
  const [quoteType, setQuoteType] = useState<string>("reparacion");

  // OT
  const [creatingOT, setCreatingOT] = useState<number | null>(null);

  const patchLead = async (upd: Record<string, any>) => {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id), ...upd }),
    });
  };

  const reload = () =>
    fetch(`/api/clientes/${id}`)
      .then(r => r.json())
      .then(d => {
        setLead(d.lead);
        setInteracciones(d.interacciones || []);
        setCotizaciones(d.cotizaciones || []);
        setEquipos(d.equipos || []);
        setOrdenes(d.ordenes || []);
        setNotasVal(d.lead?.notas || "");
        setStatusEdit(d.lead?.status_crm || "nuevo");
        setAsignadoA(d.lead?.asignado_a || "");
        setProxDate(d.lead?.fecha_proximo_contacto?.slice(0, 10) || "");
        setWaVal(d.lead?.whatsapp || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    reload();
    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuarios(d.usuarios || [])).catch(() => {});
  }, [id]);

  const changeStatus = async (val: string) => {
    setStatusEdit(val);
    setLead(p => p ? { ...p, status_crm: val } : p);
    await patchLead({ status_crm: val });
  };

  const saveAsignadoA = async (val: string) => {
    setAsignadoA(val);
    await patchLead({ asignado_a: val || null });
  };

  const saveProxDate = async (val: string) => {
    setProxDate(val);
    await patchLead({ fecha_proximo_contacto: val || null });
  };

  const saveWA = async () => {
    await patchLead({ whatsapp: waVal.trim() || null });
    setLead(p => p ? { ...p, whatsapp: waVal.trim() || undefined } : p);
    setEditWA(false);
  };

  const addInteraccion = async () => {
    if (!intContenido.trim()) return;
    setSavingInt(true);
    await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: Number(id), tipo: intTipo, contenido: intContenido, resultado: intResultado }),
    });
    setIntContenido(""); setShowAddInt(false);
    setSavingInt(false);
    reload();
  };

  const deleteInteraccion = async (iid: number) => {
    await fetch("/api/interactions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: iid }),
    });
    setInteracciones(p => p.filter(i => i.id !== iid));
  };

  const guardarNotas = async () => {
    await patchLead({ notas: notasVal });
    setLead(p => p ? { ...p, notas: notasVal } : p);
    setEditNotas(false);
  };

  const updateCotStatus = async (cotId: number, newStatus: string) => {
    await fetch(`/api/cotizaciones/${cotId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setCotizaciones(p => p.map(c => c.id === cotId ? { ...c, status: newStatus } : c));
  };

  const createOTFromCot = async (cot: Cotizacion) => {
    setCreatingOT(cot.id);
    await fetch("/api/ordenes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: Number(id),
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
    }).then(r => r.json()).then(d => {
      if (d.orden?.folio) alert(`Orden creada: ${d.orden.folio}`);
    });
    setCreatingOT(null);
    reload();
  };

  const deleteCotizacion = async (cid: number) => {
    confirm({
      message: "¿Eliminar esta cotización?",
      onConfirm: async () => {
        await fetch(`/api/cotizaciones/${cid}`, { method: "DELETE" });
        setCotizaciones(p => p.filter(c => c.id !== cid));
      }
    });
  };

  const addEquipo = async () => {
    if (!newEquipo.tipo.trim()) return;
    setSavingEq(true);
    await fetch("/api/equipos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_id: Number(id), ...newEquipo }),
    });
    setNewEquipo({ tipo: "", marca: "", modelo: "", num_serie: "", estado: "activo", notas: "" });
    setShowEquipoForm(false);
    setSavingEq(false);
    reload();
  };

  const deleteEquipo = async (eqId: number) => {
    await fetch("/api/equipos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: eqId }) });
    setEquipos(p => p.filter(e => e.id !== eqId));
  };

  const deleteLead = async () => {
    if (!lead) return;
    confirm({
      message: `¿Eliminar "${lead.nombre}"? Esta acción no se puede deshacer.`,
      onConfirm: async () => {
        await fetch("/api/leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: Number(id) }) });
        router.push("/crm");
      }
    });
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#F4F7FB]">
      <Activity size={18} className="animate-spin text-[#4E60A9]" />
    </div>
  );
  if (!lead) return (
    <div className="flex-1 flex items-center justify-center bg-[#F4F7FB]">
      <p className="text-[13px] text-gray-400">Lead no encontrado.</p>
    </div>
  );

  const st = S[statusEdit] || S.nuevo;
  const color = avatarColor(lead.nombre);
  const totalCot = cotizaciones.reduce((a, c) => a + (c.monto_total || 0), 0);
  const totalOrd = ordenes.filter(o => o.precio_final).reduce((a, o) => a + (o.precio_final || 0), 0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const proxFecha = proxDate ? new Date(proxDate + "T00:00:00") : null;
  const proxVencida = proxFecha && proxFecha < hoy;
  const proxHoy = proxFecha && proxFecha.toDateString() === hoy.toDateString();

  return (
    <>
      <ConfirmDialog />
      {showQuoteTypePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowQuoteTypePicker(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-[320px] flex flex-col gap-2.5">
            <h3 className="text-[15px] font-extrabold text-[#1E293B] mb-1">Tipo de cotización</h3>
            {[
              { val: "reparacion",    label: "Reparación de Transductores", color: "#4E60A9", bg: "#EEF3FC" },
              { val: "mantenimiento", label: "Mantenimiento de Equipo",      color: "#059669", bg: "#ECFDF5" },
              { val: "venta",         label: "Venta de Equipo",              color: "#7C3AED", bg: "#F5F3FF" },
              { val: "consumibles",   label: "Venta de Consumibles",         color: "#D97706", bg: "#FFFBEB" },
            ].map(t => (
              <button key={t.val}
                onClick={() => { setQuoteType(t.val); setShowQuoteTypePicker(false); setShowQuote(true); }}
                className="flex items-center px-4 py-3 rounded-xl border-2 text-left transition-all hover:scale-[1.01]"
                style={{ background: t.bg, borderColor: t.color + "30" }}>
                <span className="text-[13px] font-bold" style={{ color: t.color }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showQuote && lead && (
        <CotizacionManualModal
          initialTipo={quoteType as any}
          initialLead={{
            id: lead.id,
            nombre: lead.nombre,
            telefono: lead.telefono || lead.whatsapp,
            correo: lead.correo,
            ciudad: lead.ciudad,
            estado_republica: lead.estado_republica,
            direccion: lead.direccion,
          }}
          onClose={() => { setShowQuote(false); reload(); }}
          onSuccess={() => { setShowQuote(false); reload(); }}
        />
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F4F7FB]">

        {/* ── Topbar ── */}
        <div className="bg-white border-b border-[#E8EFF8] px-8 py-4 shrink-0 flex items-center justify-between">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#4E60A9] transition-colors">
            <ArrowLeft size={14} />
            <span>Volver</span>
          </button>
          <span className="text-[13px] font-bold text-[#1E293B] truncate">{lead.nombre}</span>
          <button onClick={deleteLead}
            className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-full transition-colors">
            <Trash2 size={13} /> Eliminar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

          {/* ── Header Card ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="h-2" style={{ background: color }} />
            <div className="p-6 flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-[20px] font-extrabold shrink-0"
                style={{ background: color }}>
                {initials(lead.nombre)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="text-[20px] font-extrabold text-[#1E293B] leading-tight">{lead.nombre}</h1>
                    <p className="text-[13px] text-gray-500 mt-0.5">{lead.sub_nicho || lead.nicho}</p>
                  </div>
                  {/* Status selector */}
                  <div className="relative inline-flex items-center shrink-0">
                    <select value={statusEdit} onChange={e => changeStatus(e.target.value)}
                      className="text-[12px] font-bold pl-3 pr-7 py-2 rounded-full outline-none cursor-pointer border-0 appearance-none shadow-sm"
                      style={{ color: st.text, backgroundColor: st.bg }}>
                      {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 pointer-events-none opacity-60" style={{ color: st.text }} />
                  </div>
                </div>

                {/* Asignado a */}
                <div className="mt-2 flex items-center gap-2">
                  <UserCheck size={12} className="text-gray-400 shrink-0" />
                  {!asignadoA ? (
                    <button onClick={() => saveAsignadoA(myName)}
                      className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1">
                      <Users size={10} /> Tomar este lead
                    </button>
                  ) : (
                    <div className="relative inline-flex items-center">
                      <select value={asignadoA} onChange={e => saveAsignadoA(e.target.value)}
                        className={`text-[11px] font-bold bg-transparent border-0 outline-none cursor-pointer appearance-none pr-4 ${asignadoA === myName ? "text-green-600" : "text-[#4E60A9]"}`}>
                        <option value="">Sin asignar</option>
                        {usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
                      </select>
                      <ChevronDown size={9} className={`absolute right-0 pointer-events-none ${asignadoA === myName ? "text-green-500" : "text-[#4E60A9]"}`} />
                    </div>
                  )}
                </div>

                {/* Contact info row */}
                <div className="mt-3 flex flex-wrap gap-3">
                  {lead.telefono && (
                    <a href={`tel:${lead.telefono}`} className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                      <Phone size={13} /><span>{lead.telefono}</span>
                    </a>
                  )}
                  {/* WhatsApp editable */}
                  {editWA ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={waVal} onChange={e => setWaVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveWA(); if (e.key === "Escape") setEditWA(false); }}
                        placeholder="52 55 1234 5678"
                        className="text-[12px] border border-[#22C55E]/40 rounded-lg px-3 py-1.5 outline-none w-44" />
                      <button onClick={saveWA} className="text-[11px] font-bold text-white bg-[#22C55E] px-3 py-1.5 rounded-lg">Guardar</button>
                      <button onClick={() => { setEditWA(false); setWaVal(lead.whatsapp || ""); }} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                    </div>
                  ) : lead.whatsapp ? (
                    <div className="flex items-center gap-1">
                      <a href={waLink(lead.whatsapp)!}
                        className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] px-3 py-1.5 rounded-full transition-colors shadow-sm">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                      <button onClick={() => setEditWA(true)} className="text-[10px] text-gray-400 hover:text-gray-600 underline ml-1">editar</button>
                    </div>
                  ) : (
                    <button onClick={() => setEditWA(true)}
                      className="flex items-center gap-1.5 text-[12px] font-bold text-[#25D366] hover:bg-green-50 px-3 py-1.5 rounded-full border border-dashed border-green-300 transition-colors">
                      <MessageCircle size={13} /> + WhatsApp
                    </button>
                  )}
                  {lead.correo && (
                    <a href={`mailto:${lead.correo}`} className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                      <Mail size={13} /><span>{lead.correo}</span>
                    </a>
                  )}
                  {lead.sitio_web && (
                    <a href={lead.sitio_web.startsWith("http") ? lead.sitio_web : `https://${lead.sitio_web}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                      <Globe size={13} /><span>{lead.sitio_web.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {(lead.ciudad || lead.estado_republica) && (
                    <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                      <MapPin size={13} />{[lead.ciudad, lead.estado_republica].filter(Boolean).join(", ")}
                    </span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button onClick={() => setShowQuoteTypePicker(true)}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-2 rounded-full transition-colors shadow-sm">
                    <FileText size={13} /> Cotizar
                  </button>
                  <a href={`/taller?nuevo=1&lead_id=${lead.id}`}
                    className="flex items-center gap-1.5 text-[12px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#7C3AED] hover:text-white px-3 py-2 rounded-full transition-colors shadow-sm">
                    <ClipboardList size={13} /> Nueva OT
                  </a>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="border-t border-gray-100 grid grid-cols-4 divide-x divide-gray-100">
              {[
                { label:"Cotizaciones",  value: cotizaciones.length, color:"#4E60A9", Icon: FileText },
                { label:"Órdenes",       value: ordenes.length,      color:"#7C3AED", Icon: Wrench },
                { label:"Total cotizado",value: $f(totalCot),        color:"#059669", Icon: Package },
                { label:"Total facturado",value: $f(totalOrd || undefined), color:"#B45309", Icon: Star },
              ].map(s => (
                <div key={s.label} className="px-6 py-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + "15" }}>
                    <s.Icon size={15} style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-[18px] font-extrabold text-[#1E293B] leading-none">{s.value}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Main 2-col ── */}
          <div className="grid grid-cols-5 gap-5">

            {/* Left col */}
            <div className="col-span-2 space-y-4">

              {/* Próximo contacto */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-[13px] font-extrabold text-[#1E293B] mb-3">Próximo Contacto</h3>
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${proxVencida ? "border-red-200 bg-[#FEF2F2]" : proxHoy ? "border-blue-200 bg-[#EEF3FC]" : "border-gray-200 bg-gray-50"}`}>
                  <Calendar size={14} className={proxVencida ? "text-[#DC2626]" : proxHoy ? "text-[#4E60A9]" : "text-gray-400"} />
                  <input type="date" value={proxDate} onChange={e => saveProxDate(e.target.value)}
                    className={`flex-1 bg-transparent outline-none text-[13px] font-bold cursor-pointer ${proxVencida ? "text-[#DC2626]" : proxHoy ? "text-[#4E60A9]" : "text-[#1E293B]"}`} />
                  {proxDate && (
                    <button onClick={() => saveProxDate("")} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={13} />
                    </button>
                  )}
                </div>
                {proxVencida && <p className="text-[11px] text-[#DC2626] font-bold mt-1.5 ml-1">⚠ Seguimiento vencido</p>}
              </div>

              {/* Info adicional */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-[13px] font-extrabold text-[#1E293B] mb-4">Información</h3>
                <dl className="space-y-2.5">
                  {[
                    ["Fuente",          lead.fuente as string | undefined],
                    ["Tamaño",          lead.tamano_estimado],
                    ["NSE",             lead.nivel_socioeconomico],
                    ["Registrado",      fmtDate(lead.fecha_extraccion)],
                    ["Último contacto", fmtDate(lead.fecha_ultimo_contacto)],
                    ["Dirección",       lead.direccion],
                  ].map(([k, v]) => v ? (
                    <div key={k as string} className="flex items-start gap-2">
                      <dt className="text-[11px] text-gray-400 shrink-0 w-28">{k}</dt>
                      <dd className="text-[11px] font-semibold text-[#1E293B] flex-1">{v}</dd>
                    </div>
                  ) : null)}
                </dl>

              </div>

              {/* Equipos del cliente */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-extrabold text-[#1E293B]">Equipos del cliente</h3>
                  <button onClick={() => setShowEquipoForm(p => !p)}
                    className="flex items-center gap-1 text-[11px] font-bold text-[#4E60A9] hover:text-[#2B5FD9] transition-colors">
                    <Plus size={12} /> Agregar
                  </button>
                </div>
                {showEquipoForm && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input placeholder="Tipo *" value={newEquipo.tipo} onChange={e => setNewEquipo(p => ({ ...p, tipo: e.target.value }))}
                        className="text-[12px] bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none col-span-2 placeholder:text-gray-400" />
                      <input placeholder="Marca" value={newEquipo.marca} onChange={e => setNewEquipo(p => ({ ...p, marca: e.target.value }))}
                        className="text-[12px] bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none placeholder:text-gray-400" />
                      <input placeholder="Modelo" value={newEquipo.modelo} onChange={e => setNewEquipo(p => ({ ...p, modelo: e.target.value }))}
                        className="text-[12px] bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none placeholder:text-gray-400" />
                      <input placeholder="No. serie" value={newEquipo.num_serie} onChange={e => setNewEquipo(p => ({ ...p, num_serie: e.target.value }))}
                        className="text-[12px] bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none placeholder:text-gray-400" />
                      <select value={newEquipo.estado} onChange={e => setNewEquipo(p => ({ ...p, estado: e.target.value }))}
                        className="sel text-[12px] font-bold">
                        {ESTADO_EQUIPO.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                      </select>
                    </div>
                    <input placeholder="Notas (opcional)" value={newEquipo.notas} onChange={e => setNewEquipo(p => ({ ...p, notas: e.target.value }))}
                      className="w-full text-[12px] bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none placeholder:text-gray-400" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowEquipoForm(false)} className="text-[11px] font-bold text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg">Cancelar</button>
                      <button onClick={addEquipo} disabled={savingEq || !newEquipo.tipo.trim()}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#2B5FD9] px-4 py-1.5 rounded-lg disabled:opacity-40">
                        {savingEq ? <Activity size={11} className="animate-spin" /> : <Check size={11} />} Guardar
                      </button>
                    </div>
                  </div>
                )}
                {equipos.length === 0 && !showEquipoForm ? (
                  <p className="text-[11px] text-gray-400 italic">Sin equipos registrados</p>
                ) : (
                  <div className="space-y-2">
                    {equipos.map(eq => {
                      const ec = ESTADO_EQUIPO.find(x => x.value === eq.estado);
                      return (
                        <div key={eq.id} className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl group">
                          <Wrench size={12} className="text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-[#1E293B] truncate">
                              {[eq.marca, eq.modelo].filter(Boolean).join(" ") || eq.tipo}
                            </p>
                            {eq.num_serie && <p className="text-[10px] text-gray-400">Serie: {eq.num_serie}</p>}
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                            style={{ color: ec?.color, background: (ec?.color || "#94A3B8") + "20" }}>
                            {ec?.label || eq.estado}
                          </span>
                          <button onClick={() => deleteEquipo(eq.id)}
                            className="w-5 h-5 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <X size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Notas internas */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[13px] font-extrabold text-[#1E293B]">Notas internas</h3>
                  {!editNotas
                    ? <button onClick={() => setEditNotas(true)} className="text-[11px] text-[#4E60A9] hover:underline flex items-center gap-1"><Edit2 size={11} />Editar</button>
                    : (
                      <div className="flex gap-2">
                        <button onClick={guardarNotas} className="text-[11px] text-[#059669] hover:underline flex items-center gap-1"><Save size={11} />Guardar</button>
                        <button onClick={() => { setEditNotas(false); setNotasVal(lead.notas || ""); }} className="text-[11px] text-gray-400 hover:underline flex items-center gap-1"><X size={11} />Cancelar</button>
                      </div>
                    )}
                </div>
                {editNotas ? (
                  <textarea value={notasVal} onChange={e => setNotasVal(e.target.value)} rows={5}
                    className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white resize-none"
                    placeholder="Notas sobre el cliente, situación, preferencias..." />
                ) : (
                  <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {lead.notas || <span className="text-gray-400 italic">Sin notas</span>}
                  </p>
                )}
              </div>

              {/* Mensajes rápidos WA */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="text-[13px] font-extrabold text-[#1E293B] mb-3">Mensajes rápidos WA</h3>
                <div className="grid grid-cols-2 gap-2">
                  {waTemplates(lead).map((tpl, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden flex flex-col">
                      <div className="px-2.5 pt-2 pb-1.5 border-b border-gray-100">
                        <span className="text-[11px] font-bold text-[#1E293B] block truncate">{tpl.label}</span>
                      </div>
                      <p className="px-2.5 py-2 text-[10px] text-gray-500 leading-relaxed whitespace-pre-wrap line-clamp-3 flex-1">{tpl.texto}</p>
                      <div className="px-2.5 pb-2 pt-1 border-t border-gray-100 flex items-center gap-1.5 justify-end">
                        <button onClick={() => { navigator.clipboard.writeText(tpl.texto); setCopiedTpl(i); setTimeout(() => setCopiedTpl(null), 2000); }}
                          className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors px-1.5 py-1 rounded-lg hover:bg-[#EEF3FC]">
                          {copiedTpl === i ? <Check size={9} className="text-[#34A853]" /> : <MessageCircle size={9} />}
                          {copiedTpl === i ? "Copiado" : "Copiar"}
                        </button>
                        {waLink(lead.whatsapp || lead.telefono) && (
                          <a href={waLink(lead.whatsapp || lead.telefono, tpl.texto)!}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-[9px] font-bold text-green-600 hover:text-white hover:bg-green-500 transition-colors px-1.5 py-1 rounded-lg bg-green-50">
                            <ExternalLink size={9} /> Enviar
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right col: Historial */}
            <div className="col-span-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col" style={{ minHeight: 480 }}>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                  <h3 className="text-[13px] font-extrabold text-[#1E293B]">Historial de contacto</h3>
                  <button onClick={() => setShowAddInt(p => !p)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#3A6FE0] px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={12} />Nueva interacción
                  </button>
                </div>

                {showAddInt && (
                  <div className="px-5 py-4 border-b border-gray-100 bg-[#F8FAFC] space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 block mb-1">Tipo</label>
                        <select value={intTipo} onChange={e => setIntTipo(e.target.value)} className={sel}>
                          <option value="mensaje_wa">WhatsApp</option>
                          <option value="llamada">Llamada</option>
                          <option value="visita">Visita</option>
                          <option value="email">Email</option>
                          <option value="nota_interna">Nota interna</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 block mb-1">Resultado</label>
                        <select value={intResultado} onChange={e => setIntResultado(e.target.value)} className={sel}>
                          <option value="sin_respuesta">Sin respuesta</option>
                          <option value="interesado">Interesado</option>
                          <option value="no_interesado">No interesado</option>
                          <option value="cita_agendada">Cita agendada</option>
                          <option value="requiere_cotizacion">Requiere cotización</option>
                          <option value="cierre">Cierre</option>
                        </select>
                      </div>
                    </div>
                    <textarea value={intContenido} onChange={e => setIntContenido(e.target.value)} rows={3}
                      className={`${inp} resize-none`}
                      placeholder="¿Qué pasó? ¿Qué pidió? ¿Cómo respondió?" />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setShowAddInt(false)} className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancelar</button>
                      <button onClick={addInteraccion} disabled={savingInt || !intContenido.trim()}
                        className="px-4 py-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#3A6FE0] disabled:opacity-50 rounded-lg">
                        {savingInt ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {interacciones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <MessageCircle size={28} className="text-gray-200" />
                      <p className="text-[12px] text-gray-400">Sin interacciones registradas</p>
                      <button onClick={() => setShowAddInt(true)} className="text-[11px] text-[#4E60A9] hover:underline mt-1">
                        + Agregar primera interacción
                      </button>
                    </div>
                  ) : interacciones.map((int, idx) => {
                    const cfg = TIPO_INT[int.tipo] || TIPO_INT.nota_interna;
                    const Icon = cfg.icon;
                    const res = int.resultado ? RESULTADO_CFG[int.resultado] : null;
                    const ResIcon = res?.icon;
                    return (
                      <div key={int.id} className="flex gap-3 group">
                        <div className="flex flex-col items-center shrink-0">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                            style={{ background: cfg.color + "20" }}>
                            <Icon size={13} style={{ color: cfg.color }} />
                          </div>
                          {idx < interacciones.length - 1 && (
                            <div className="w-px flex-1 bg-gray-100 mt-1" style={{ minHeight: 16 }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{cfg.label}</span>
                              {res && ResIcon && (
                                <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: res.color }}>
                                  <ResIcon size={10} />{res.label}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-gray-400">{fmtDatetime(int.fecha)}</span>
                              <button onClick={() => deleteInteraccion(int.id)}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[12px] text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">{int.contenido}</p>
                          {int.usuario_nombre && (
                            <span className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <UserCheck size={9} /> {int.usuario_nombre}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Cotizaciones ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[13px] font-extrabold text-[#1E293B]">Cotizaciones</h3>
              <button onClick={() => setShowQuoteTypePicker(true)}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#059669] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={12} />Nueva cotización
              </button>
            </div>
            {cotizaciones.length === 0 ? (
              <div className="px-6 py-8 text-center text-[12px] text-gray-400">Sin cotizaciones registradas</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Folio", "Tipo", "Equipo", "Monto", "Status", "Fecha", ""].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cotizaciones.map(c => {
                    const sc = STATUS_COT[c.status] || STATUS_COT.enviada;
                    const isAprobada = c.status === "aprobada";
                    const isRechazada = c.status === "rechazada";
                    return (
                      <tr key={c.id} onClick={() => setPreviewCot(c)} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                        <td className="px-5 py-3 text-[12px] font-mono font-bold text-[#4E60A9]">{c.folio || `#${c.id}`}</td>
                        <td className="px-5 py-3 text-[12px] text-gray-700">{TIPO_COT[c.tipo] || c.tipo}</td>
                        <td className="px-5 py-3 text-[12px] text-gray-500">
                          {[c.eq_marca, c.eq_modelo].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-5 py-3 text-[13px] font-bold text-[#1E293B]">{$f(c.monto_total)}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-400">{fmtDate(c.fecha)}</td>
                        <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2 flex-wrap">
                            {!isAprobada && !isRechazada && (
                              <>
                                <button onClick={() => updateCotStatus(c.id, "aprobada")}
                                  className="text-[10px] font-bold text-green-700 bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg">Aprobar</button>
                                <button onClick={() => updateCotStatus(c.id, "rechazada")}
                                  className="text-[10px] font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg">Rechazar</button>
                              </>
                            )}
                            {isAprobada && (() => {
                              const otLinked = ordenes.find(o => o.cotizacion_id === c.id);
                              return otLinked ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] bg-[#F5F3FF] px-2 py-1 rounded-lg font-mono">
                                  <ClipboardList size={10} /> {otLinked.folio}
                                </span>
                              ) : (
                                <button onClick={() => createOTFromCot(c)} disabled={creatingOT === c.id}
                                  className="flex items-center gap-1 text-[10px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#7C3AED] hover:text-white px-2 py-1 rounded-lg disabled:opacity-50">
                                  {creatingOT === c.id ? <Activity size={10} className="animate-spin" /> : <><ClipboardList size={10} /> Crear OT</>}
                                </button>
                              );
                            })()}
                            {c.pdf_path && (
                              <a href={c.pdf_path} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                className="text-[#4E60A9] hover:text-[#3d4e8a] transition-colors"><FileDown size={14} /></a>
                            )}
                            <button onClick={() => deleteCotizacion(c.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-100 bg-[#F8FAFC]">
                    <td colSpan={3} className="px-5 py-2 text-[11px] text-gray-400">Total</td>
                    <td className="px-5 py-2 text-[13px] font-extrabold text-[#1E293B]">{$f(totalCot)}</td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          {/* ── Órdenes de trabajo ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-[13px] font-extrabold text-[#1E293B]">Órdenes de trabajo</h3>
              <a href={`/taller?nuevo=1&lead_id=${lead.id}`}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#EDE9FE] px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={12} />Nueva orden
              </a>
            </div>
            {ordenes.length === 0 ? (
              <div className="px-6 py-8 text-center text-[12px] text-gray-400">Sin órdenes de trabajo registradas</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Folio", "Cotización", "Equipo", "Falla", "Precio final", "Status", "Ingreso", "Entrega"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ordenes.map(o => {
                    const so = STATUS_ORD[o.status] || STATUS_ORD.recibido;
                    return (
                      <tr key={o.id} className="hover:bg-[#F8FAFC] transition-colors">
                        <td className="px-5 py-3 text-[12px] font-mono font-bold text-gray-600">{o.folio}</td>
                        <td className="px-5 py-3">
                          {o.cotizacion_folio ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-2 py-1 rounded-lg font-mono w-fit">
                              <FileText size={9} /> {o.cotizacion_folio}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-gray-700">
                          {[o.equipo_tipo, o.equipo_marca, o.equipo_modelo].filter(Boolean).join(" ") || "—"}
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-500 max-w-[180px] truncate">{o.falla_reportada || "—"}</td>
                        <td className="px-5 py-3 text-[13px] font-bold text-[#1E293B]">{$f(o.precio_final)}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: so.bg, color: so.text }}>{so.label}</span>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-400">{fmtDate(o.fecha_ingreso)}</td>
                        <td className="px-5 py-3 text-[11px] text-gray-400">{fmtDate(o.fecha_entrega)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>

        {/* ── Cotización Preview Modal ── */}
        {previewCot && (() => {
          const sc = STATUS_COT[previewCot.status] || STATUS_COT.enviada;
          let items: { descripcion: string; cantidad: number; precioUnit: number }[] = [];
          try { if (previewCot.items_json) items = JSON.parse(previewCot.items_json); } catch {}
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPreviewCot(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ width: previewCot.pdf_path ? "80vw" : 540, maxHeight: "90vh" }}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                  <div>
                    <p className="text-[16px] font-extrabold text-[#1E293B]">{previewCot.folio || `Cotización #${previewCot.id}`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-gray-400">{TIPO_COT[previewCot.tipo] || previewCot.tipo}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text }}>{sc.label}</span>
                      <span className="text-[11px] text-gray-400">{fmtDate(previewCot.fecha)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {previewCot.pdf_path && (
                      <a href={previewCot.pdf_path} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                        <FileDown size={13} /> Descargar PDF
                      </a>
                    )}
                    <button onClick={() => setPreviewCot(null)}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                      <X size={15} />
                    </button>
                  </div>
                </div>
                {previewCot.pdf_path ? (
                  <iframe src={previewCot.pdf_path} className="flex-1 w-full border-0" title="Cotización PDF" />
                ) : (
                  <div className="overflow-y-auto p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {previewCot.eq_marca && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Equipo</p>
                          <p className="text-[13px] font-semibold text-[#1E293B]">{[previewCot.eq_marca, previewCot.eq_modelo].filter(Boolean).join(" ")}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Monto total</p>
                        <p className="text-[20px] font-extrabold text-[#1E293B]">{$f(previewCot.monto_total)}</p>
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Conceptos</p>
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-1.5 font-bold text-gray-500">Descripción</th>
                              <th className="text-center py-1.5 font-bold text-gray-500 w-12">Cant.</th>
                              <th className="text-right py-1.5 font-bold text-gray-500 w-24">P. unit.</th>
                              <th className="text-right py-1.5 font-bold text-gray-500 w-24">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {items.map((it, i) => (
                              <tr key={i}>
                                <td className="py-2 text-[#1E293B]">{it.descripcion}</td>
                                <td className="py-2 text-center text-gray-500">{it.cantidad}</td>
                                <td className="py-2 text-right text-gray-500">{$f(it.precioUnit)}</td>
                                <td className="py-2 text-right font-bold text-[#1E293B]">{$f(it.cantidad * it.precioUnit)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200">
                              <td colSpan={3} className="py-2 font-bold text-gray-500 text-right">Total</td>
                              <td className="py-2 font-extrabold text-[#1E293B] text-right">{$f(previewCot.monto_total)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                    {previewCot.notas && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Notas</p>
                        <p className="text-[12px] text-gray-600 leading-relaxed">{previewCot.notas}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
}
