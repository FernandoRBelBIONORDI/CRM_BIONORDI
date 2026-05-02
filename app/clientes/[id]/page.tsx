"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Phone, Mail, MapPin, Globe, MessageCircle,
  FileText, Wrench, Package, Plus, Trash2, ChevronRight,
  Star, Calendar, Building2, Clock, CheckCircle2, XCircle,
  AlertCircle, Edit2, Save, X, FileDown,
} from "lucide-react";
import { initials, avatarColor, fmtDate, fmtDatetime, waLink } from "@/lib/ui";

// ── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: number; nombre: string; nicho: string; sub_nicho?: string;
  telefono?: string; whatsapp?: string; correo?: string;
  sitio_web?: string; direccion?: string; ciudad?: string;
  estado_republica?: string; status_crm: string; score_potencial?: number;
  razon_score?: string; notas?: string; decisor_nombre?: string;
  decisor_cargo?: string; fecha_ultimo_contacto?: string;
  fecha_extraccion?: string; tamano_estimado?: string;
  nivel_socioeconomico?: string; fuente?: string;
}

interface Interaccion {
  id: number; lead_id: number; tipo: string;
  contenido: string; fecha: string; resultado?: string;
}

interface Cotizacion {
  id: number; lead_id?: number; tipo: string; folio?: string;
  monto_total: number; items_json?: string; eq_marca?: string;
  eq_modelo?: string; notas?: string; status: string; fecha: string;
  pdf_path?: string;
}

interface Equipo {
  id: number; lead_id: number; tipo: string; marca?: string;
  modelo?: string; num_serie?: string; estado: string; notas?: string;
  fecha_alta?: string;
}

interface Orden {
  id: number; folio: string; lead_id?: number; equipo_tipo?: string;
  equipo_marca?: string; equipo_modelo?: string; falla_reportada?: string;
  diagnostico?: string; presupuesto?: number; precio_final?: number;
  status: string; fecha_ingreso?: string; fecha_entrega?: string;
  fecha_creacion?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function $f(n?: number) { return n != null ? `$${n.toLocaleString("es-MX")}` : "—"; }

const STATUS_CRM: Record<string, { bg: string; text: string; label: string }> = {
  nuevo:        { bg:"#EFF6FF", text:"#1D4ED8", label:"Nuevo" },
  contactado:   { bg:"#ECFDF5", text:"#065F46", label:"Contactado" },
  interesado:   { bg:"#F0FDF4", text:"#166534", label:"Interesado" },
  propuesta:    { bg:"#FFF7ED", text:"#9A3412", label:"Propuesta" },
  negociacion:  { bg:"#FDF4FF", text:"#6B21A8", label:"Negociación" },
  cliente:      { bg:"#DCFCE7", text:"#14532D", label:"Cliente ★" },
  perdido:      { bg:"#FEF2F2", text:"#991B1B", label:"Perdido" },
  descartado:   { bg:"#F8FAFC", text:"#64748B", label:"Descartado" },
};

const TIPO_INT: Record<string, { label: string; color: string; icon: any }> = {
  mensaje_wa:    { label:"WhatsApp",    color:"#22C55E", icon:MessageCircle },
  llamada:       { label:"Llamada",     color:"#3B82F6", icon:Phone },
  visita:        { label:"Visita",      color:"#8B5CF6", icon:Building2 },
  email:         { label:"Email",       color:"#F59E0B", icon:Mail },
  nota_interna:  { label:"Nota",        color:"#94A3B8", icon:FileText },
};

const RESULTADO_CFG: Record<string, { icon: any; color: string; label: string }> = {
  sin_respuesta:      { icon:Clock,         color:"#94A3B8", label:"Sin respuesta" },
  respondio_positivo: { icon:CheckCircle2,  color:"#22C55E", label:"Respondió positivo" },
  respondio_negativo: { icon:XCircle,       color:"#EF4444", label:"Respondió negativo" },
  cita_agendada:      { icon:Calendar,      color:"#8B5CF6", label:"Cita agendada" },
  cierre:             { icon:Star,          color:"#F59E0B", label:"Cierre" },
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

const sel = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";
const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePerfilPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [lead,          setLead]          = useState<Lead | null>(null);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [cotizaciones,  setCotizaciones]  = useState<Cotizacion[]>([]);
  const [equipos,       setEquipos]       = useState<Equipo[]>([]);
  const [ordenes,       setOrdenes]       = useState<Orden[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [previewCot,    setPreviewCot]    = useState<Cotizacion | null>(null);

  // Nueva interacción
  const [showAddInt,    setShowAddInt]    = useState(false);
  const [intTipo,       setIntTipo]       = useState("nota_interna");
  const [intContenido,  setIntContenido]  = useState("");
  const [intResultado,  setIntResultado]  = useState("sin_respuesta");
  const [savingInt,     setSavingInt]     = useState(false);

  // Editar notas del lead
  const [editNotas,     setEditNotas]     = useState(false);
  const [notasVal,      setNotasVal]      = useState("");

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
      })
      .finally(() => setLoading(false));

  useEffect(() => { reload(); }, [id]);

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
    reload();
  };

  const deleteCotizacion = async (cid: number) => {
    if (!confirm("¿Eliminar esta cotización del historial?")) return;
    await fetch(`/api/cotizaciones/${cid}`, { method: "DELETE" });
    reload();
  };

  const guardarNotas = async () => {
    await fetch(`/api/leads`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: Number(id), notas: notasVal }),
    });
    setEditNotas(false);
    reload();
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-[#F4F7FB]">
      <p className="text-[13px] text-gray-400">Cargando perfil...</p>
    </div>
  );
  if (!lead) return (
    <div className="flex-1 flex items-center justify-center bg-[#F4F7FB]">
      <p className="text-[13px] text-gray-400">Cliente no encontrado.</p>
    </div>
  );

  const st = STATUS_CRM[lead.status_crm] || STATUS_CRM.nuevo;
  const color = avatarColor(lead.nombre);
  const totalCot = cotizaciones.reduce((a, c) => a + (c.monto_total || 0), 0);
  const totalOrd = ordenes.filter(o => o.precio_final).reduce((a, o) => a + (o.precio_final || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F4F7FB]">

      {/* ── Topbar ── */}
      <div className="bg-white border-b border-[#E8EFF8] px-8 py-4 shrink-0 flex items-center gap-4">
        <Link href="/clientes" className="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-[#4E60A9] transition-colors">
          <ArrowLeft size={14} />
          <span>Clientes</span>
        </Link>
        <ChevronRight size={12} className="text-gray-300" />
        <span className="text-[13px] font-bold text-[#1E293B] truncate">{lead.nombre}</span>
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
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-full text-[12px] font-bold" style={{ background: st.bg, color: st.text }}>
                    {st.label}
                  </span>
                </div>
              </div>

              {/* Contact info row */}
              <div className="mt-4 flex flex-wrap gap-4">
                {lead.telefono && (
                  <a href={`tel:${lead.telefono}`} className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                    <Phone size={13} /><span>{lead.telefono}</span>
                  </a>
                )}
                {waLink(lead.whatsapp || lead.telefono) && (
                  <a
                    href={waLink(lead.whatsapp || lead.telefono)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#25D366] hover:bg-[#1ebe5d] px-3 py-1.5 rounded-full transition-colors shadow-sm"
                  >
                    <MessageCircle size={13} /><span>WhatsApp</span>
                  </a>
                )}
                {lead.correo && (
                  <a href={`mailto:${lead.correo}`} className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                    <Mail size={13} /><span>{lead.correo}</span>
                  </a>
                )}
                {lead.sitio_web && (
                  <a href={lead.sitio_web} target="_blank" className="flex items-center gap-1.5 text-[12px] text-gray-600 hover:text-[#4E60A9] transition-colors">
                    <Globe size={13} /><span>{lead.sitio_web.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}
                {(lead.ciudad || lead.estado_republica) && (
                  <span className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <MapPin size={13} />{[lead.ciudad, lead.estado_republica].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="border-t border-gray-100 grid grid-cols-4 divide-x divide-gray-100">
            {[
              { label:"Cotizaciones", value: cotizaciones.length, color:"#4E60A9", icon:FileText },
              { label:"Órdenes",      value: ordenes.length,      color:"#7C3AED", icon:Wrench },
              { label:"Total cotizado", value: $f(totalCot),      color:"#059669", icon:Package },
              { label:"Total facturado",value: $f(totalOrd || undefined), color:"#B45309", icon:Star },
            ].map(s => (
              <div key={s.label} className="px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: s.color + "15" }}>
                  <s.icon size={15} style={{ color: s.color }} />
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

          {/* Left: Info + Equipos + Notas */}
          <div className="col-span-2 space-y-4">

            {/* Info adicional */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="text-[13px] font-extrabold text-[#1E293B] mb-4">Información</h3>
              <dl className="space-y-2.5">
                {[
                  ["Fuente",         lead.fuente as string | undefined],
                  ["Tamaño",         lead.tamano_estimado],
                  ["NSE",            lead.nivel_socioeconomico],
                  ["Registrado",     fmtDate(lead.fecha_extraccion)],
                  ["Último contacto",fmtDate(lead.fecha_ultimo_contacto)],
                  ["Dirección",      lead.direccion],
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
              <h3 className="text-[13px] font-extrabold text-[#1E293B] mb-3">Equipos del cliente</h3>
              {equipos.length === 0 ? (
                <p className="text-[11px] text-gray-400">Sin equipos registrados</p>
              ) : (
                <div className="space-y-2">
                  {equipos.map(eq => (
                    <div key={eq.id} className="flex items-center gap-2 p-2.5 bg-[#F8FAFC] rounded-xl">
                      <Wrench size={12} className="text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-[#1E293B] truncate">
                          {[eq.marca, eq.modelo].filter(Boolean).join(" ") || eq.tipo}
                        </p>
                        {eq.num_serie && <p className="text-[10px] text-gray-400">Serie: {eq.num_serie}</p>}
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${eq.estado === "activo" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {eq.estado}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notas internas */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-extrabold text-[#1E293B]">Notas internas</h3>
                {!editNotas
                  ? <button onClick={() => setEditNotas(true)} className="text-[11px] text-[#4E60A9] hover:underline flex items-center gap-1"><Edit2 size={11}/>Editar</button>
                  : (
                    <div className="flex gap-2">
                      <button onClick={guardarNotas} className="text-[11px] text-[#059669] hover:underline flex items-center gap-1"><Save size={11}/>Guardar</button>
                      <button onClick={() => { setEditNotas(false); setNotasVal(lead.notas || ""); }} className="text-[11px] text-gray-400 hover:underline flex items-center gap-1"><X size={11}/>Cancelar</button>
                    </div>
                  )
                }
              </div>
              {editNotas ? (
                <textarea
                  value={notasVal}
                  onChange={e => setNotasVal(e.target.value)}
                  rows={5}
                  className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white resize-none"
                  placeholder="Notas sobre el cliente, situación, preferencias..."
                />
              ) : (
                <p className="text-[12px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {lead.notas || <span className="text-gray-400 italic">Sin notas</span>}
                </p>
              )}
            </div>
          </div>

          {/* Right: Historial de interacciones */}
          <div className="col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col" style={{ minHeight: 480 }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                <h3 className="text-[13px] font-extrabold text-[#1E293B]">Historial de contacto</h3>
                <button
                  onClick={() => setShowAddInt(p => !p)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#3A6FE0] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus size={12} />Nueva interacción
                </button>
              </div>

              {/* Formulario nueva interacción */}
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
                        <option value="respondio_positivo">Respondió positivo</option>
                        <option value="respondio_negativo">Respondió negativo</option>
                        <option value="cita_agendada">Cita agendada</option>
                        <option value="cierre">Cierre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">Descripción / Notas</label>
                    <textarea
                      value={intContenido}
                      onChange={e => setIntContenido(e.target.value)}
                      rows={3}
                      className={`${inp} resize-none`}
                      placeholder="¿Qué pasó? ¿Qué pidió? ¿Cómo respondió?"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowAddInt(false)} className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      Cancelar
                    </button>
                    <button onClick={addInteraccion} disabled={savingInt || !intContenido.trim()} className="px-4 py-1.5 text-[11px] font-bold text-white bg-[#4E60A9] hover:bg-[#3A6FE0] disabled:opacity-50 rounded-lg transition-colors">
                      {savingInt ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              )}

              {/* Timeline */}
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
                  const cfg  = TIPO_INT[int.tipo] || TIPO_INT.nota_interna;
                  const Icon = cfg.icon;
                  const res  = int.resultado ? RESULTADO_CFG[int.resultado] : null;
                  const ResIcon = res?.icon;
                  return (
                    <div key={int.id} className="flex gap-3 group">
                      {/* Línea timeline */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
                          style={{ background: cfg.color + "20" }}>
                          <Icon size={13} style={{ color: cfg.color }} />
                        </div>
                        {idx < interacciones.length - 1 && (
                          <div className="w-px flex-1 bg-gray-100 mt-1 mb-0" style={{ minHeight: 16 }} />
                        )}
                      </div>
                      {/* Contenido */}
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
                            <button
                              onClick={() => deleteInteraccion(int.id)}
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[12px] text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">{int.contenido}</p>
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
            <Link
              href={`/cotizar`}
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#059669] bg-[#ECFDF5] hover:bg-[#D1FAE5] px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} />Nueva cotización
            </Link>
          </div>
          {cotizaciones.length === 0 ? (
            <div className="px-6 py-8 text-center text-[12px] text-gray-400">Sin cotizaciones registradas</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Folio","Tipo","Equipo","Monto","Status","Fecha",""].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {cotizaciones.map(c => {
                  const sc = STATUS_COT[c.status] || STATUS_COT.enviada;
                  return (
                    <tr key={c.id}
                      onClick={() => setPreviewCot(c)}
                      className="hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                      <td className="px-5 py-3 text-[12px] font-mono font-bold text-[#4E60A9]">{c.folio || `#${c.id}`}</td>
                      <td className="px-5 py-3 text-[12px] text-gray-700">{TIPO_COT[c.tipo] || c.tipo}</td>
                      <td className="px-5 py-3 text-[12px] text-gray-500">
                        {[c.eq_marca, c.eq_modelo].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-[13px] font-bold text-[#1E293B]">{$f(c.monto_total)}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sc.bg, color: sc.text }}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[11px] text-gray-400">{fmtDate(c.fecha)}</td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {c.pdf_path && (
                            <a
                              href={c.pdf_path}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Descargar PDF"
                              className="text-[#4E60A9] hover:text-[#3d4e8a] transition-colors"
                            >
                              <FileDown size={14} />
                            </a>
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
            <Link
              href="/taller"
              className="flex items-center gap-1.5 text-[11px] font-bold text-[#7C3AED] bg-[#F5F3FF] hover:bg-[#EDE9FE] px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={12} />Nueva orden
            </Link>
          </div>
          {ordenes.length === 0 ? (
            <div className="px-6 py-8 text-center text-[12px] text-gray-400">Sin órdenes de trabajo registradas</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["Folio","Equipo","Falla","Precio final","Status","Ingreso","Entrega"].map(h => (
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
                      <td className="px-5 py-3 text-[12px] text-gray-700">
                        {[o.equipo_tipo, o.equipo_marca, o.equipo_modelo].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="px-5 py-3 text-[11px] text-gray-500 max-w-[200px] truncate">{o.falla_reportada || "—"}</td>
                      <td className="px-5 py-3 text-[13px] font-bold text-[#1E293B]">{$f(o.precio_final)}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: so.bg, color: so.text }}>
                          {so.label}
                        </span>
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

              {/* Header */}
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
                /* PDF iframe */
                <iframe src={previewCot.pdf_path} className="flex-1 w-full border-0" title="Cotización PDF" />
              ) : (
                /* Detalle de ítems */
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
                  {items.length === 0 && !previewCot.notas && (
                    <p className="text-[12px] text-gray-400 italic text-center py-4">Sin detalles adicionales disponibles</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
