"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search, Download, Trash2, Edit2, Save, X, MessageCircle,
  Stethoscope, Globe, Database, Calendar, Users, UserCheck,
  Star, FolderOpen, Activity, Check,
} from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────

const STATUS = {
  nuevo:       { label: "Nuevo",       color: "#5A85F1", bg: "#EEF3FC" },
  contactado:  { label: "Contactado",  color: "#D97706", bg: "#FFFBEB" },
  seguimiento: { label: "Seguimiento", color: "#EA580C", bg: "#FFF7ED" },
  diagnostico: { label: "Diagnóstico", color: "#7C3AED", bg: "#F5F3FF" },
  cliente:     { label: "Cliente",     color: "#34A853", bg: "#EEF9F1" },
  sin_equipo:  { label: "Sin equipo",  color: "#64748B", bg: "#F1F5F9" },
  descartado:  { label: "Descartado",  color: "#DC2626", bg: "#FEF2F2" },
} as const;
type StatusKey = keyof typeof STATUS;
const STATUS_OPTS = Object.entries(STATUS).map(([k, v]) => ({ value: k, label: v.label }));

const FUENTE = {
  google:     { label: "Google Maps", color: "#4E60A9", bg: "#EEF3FC", Icon: Globe },
  denue:      { label: "DENUE",       color: "#059669", bg: "#ECFDF5", Icon: Database },
  doctoralia: { label: "Doctoralia",  color: "#7C3AED", bg: "#F5F3FF", Icon: Stethoscope },
} as const;
type FuenteKey = keyof typeof FUENTE;

const ESP_LABEL: Record<string, string> = {
  ginecologo: "Ginecólogo", "ginecologo-obstetra": "Gin. Obstetra",
  cardiologo: "Cardiólogo", radiologo: "Radiólogo",
  "medico-general": "Médico General", internista: "Internista",
  oncologo: "Oncólogo", nefrologo: "Nefrólogo",
  pediatra: "Pediatra", "cirujano-general": "Cir. General",
  angiologo: "Angiólogo", "cirujano-vascular": "Méd. Vascular",
  urologo: "Urólogo",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatusEntry { status_crm: string; count: number; }
interface Barrido {
  id: number; nombre: string; fuente?: string; especialidad?: string;
  nicho?: string; estado?: string; fecha?: string; notas?: string;
  total_encontrados: number; total_nuevos: number; leads_actuales: number;
  completado: number; statusBreakdown: StatusEntry[];
}
interface Lead {
  id: number; nombre: string; nicho?: string; telefono?: string; whatsapp?: string;
  ciudad?: string; estado_republica?: string; status_crm: string; score_potencial?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFecha(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" });
}

function breakdown(leads: Lead[]): StatusEntry[] {
  const m: Record<string, number> = {};
  for (const l of leads) m[l.status_crm] = (m[l.status_crm] || 0) + 1;
  return Object.entries(m).map(([status_crm, count]) => ({ status_crm, count }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BarridosPage() {
  const [barridos, setBarridos]         = useState<Barrido[]>([]);
  const [selected, setSelected]         = useState<Barrido | null>(null);
  const [leads, setLeads]               = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [search, setSearch]             = useState("");
  const [fuenteFilt, setFuenteFilt]     = useState("");

  const [editNombre, setEditNombre] = useState(false);
  const [nombreVal, setNombreVal]   = useState("");
  const [notasVal, setNotasVal]     = useState("");
  const [savingNotas, setSavingNotas] = useState(false);

  const fetchBarridos = async () => {
    const d = await fetch("/api/barridos").then(r => r.json());
    if (d.barridos) setBarridos(d.barridos);
  };

  useEffect(() => { fetchBarridos(); }, []);

  const selectBarrido = async (b: Barrido) => {
    setSelected(b);
    setNombreVal(b.nombre);
    setNotasVal(b.notas || "");
    setEditNombre(false);
    setLoadingLeads(true);
    setLeads([]);
    const d = await fetch(`/api/barridos/${b.id}`).then(r => r.json());
    setLeads(d.leads || []);
    setLoadingLeads(false);
  };

  const saveNombre = async () => {
    if (!selected || !nombreVal.trim()) return;
    const res = await fetch(`/api/barridos/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nombreVal.trim() }),
    });
    if (!res.ok) {
      alert("Error al guardar el nombre. Intenta de nuevo.");
      return;
    }
    const updated = { ...selected, nombre: nombreVal.trim() };
    setSelected(updated);
    setBarridos(p => p.map(b => b.id === selected.id ? { ...b, nombre: nombreVal.trim() } : b));
    setEditNombre(false);
  };

  const saveNotas = async () => {
    if (!selected) return;
    setSavingNotas(true);
    await fetch(`/api/barridos/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notas: notasVal }),
    });
    setSelected(p => p ? { ...p, notas: notasVal } : p);
    setBarridos(p => p.map(b => b.id === selected.id ? { ...b, notas: notasVal } : b));
    setSavingNotas(false);
  };

  const deleteBarrido = async (b: Barrido) => {
    if (!confirm(`¿Eliminar "${b.nombre}" y desvincular sus ${b.leads_actuales} leads?`)) return;
    await fetch("/api/barridos", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: b.id }),
    });
    setBarridos(p => p.filter(x => x.id !== b.id));
    if (selected?.id === b.id) { setSelected(null); setLeads([]); }
  };

  const patchStatus = async (leadId: number, status: string) => {
    await fetch("/api/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: leadId, status_crm: status }),
    });
    setLeads(p => p.map(l => l.id === leadId ? { ...l, status_crm: status } : l));
  };

  const exportCSV = () => {
    if (!selected || leads.length === 0) return;
    const header = ["ID", "Nombre", "Nicho", "Ciudad", "Teléfono", "Status"].join(",");
    const rows = leads.map(l =>
      [l.id, `"${l.nombre}"`, l.nicho || "", l.ciudad || "", l.telefono || "", l.status_crm].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `barrido-${selected.nombre.replace(/[^a-z0-9]/gi, "_")}.csv`,
    });
    a.click();
  };

  const filtered = barridos.filter(b => {
    if (fuenteFilt && b.fuente !== fuenteFilt) return false;
    const q = search.toLowerCase();
    if (q && !b.nombre.toLowerCase().includes(q) && !(b.estado || "").toLowerCase().includes(q)) return false;
    return true;
  });

  // Breakdown en vivo desde leads cargados (más preciso que el snapshot de la lista)
  const liveBreakdown = leads.length > 0 ? breakdown(leads) : (selected?.statusBreakdown || []);
  const totalLeads = leads.length > 0 ? leads.length : (selected?.leads_actuales || 0);

  const stat = (statuses: string[]) =>
    liveBreakdown.filter(s => statuses.includes(s.status_crm)).reduce((a, s) => a + s.count, 0);

  return (
    <div className="h-full flex flex-col bg-[#F4F7FB] font-sans">

      {/* Header */}
      <div className="px-8 py-4 bg-white border-b border-[#E8EFF8] shrink-0">
        <h1 className="text-[24px] font-extrabold text-[#1E293B] tracking-tight leading-tight">Barridos de Prospección</h1>
        <p className="text-[13px] text-[#94A3B8] font-medium mt-0.5">
          {barridos.length} barridos · {barridos.reduce((a, b) => a + b.leads_actuales, 0).toLocaleString()} leads en total
        </p>
      </div>

      <div className="flex-1 flex overflow-hidden p-5 gap-4">

        {/* ── LISTA ─────────────────────────────────────────────────────── */}
        <div className="w-[300px] shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">

          {/* Búsqueda + filtro fuente */}
          <div className="p-3 border-b border-gray-100 space-y-2 shrink-0">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar barrido o estado..."
                className="w-full bg-[#F8FAFC] border border-gray-100 rounded-xl pl-8 pr-3 py-2 text-[12px] outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400 transition-all" />
            </div>
            <div className="flex gap-1">
              {[
                { id: "",           label: "Todos" },
                { id: "google",     label: "Maps" },
                { id: "denue",      label: "DENUE" },
                { id: "doctoralia", label: "Dr." },
              ].map(f => (
                <button key={f.id} onClick={() => setFuenteFilt(f.id)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${fuenteFilt === f.id ? "bg-[#4E60A9] text-white" : "bg-gray-50 text-gray-400 hover:text-gray-600"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="py-12 flex flex-col items-center gap-2">
                <FolderOpen size={28} className="text-gray-200" />
                <p className="text-[12px] text-gray-400 font-medium">Sin barridos aún</p>
                <Link href="/encontrar"
                  className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-3 py-1.5 rounded-full hover:bg-[#4E60A9] hover:text-white transition-colors mt-1">
                  Ir a Encontrar
                </Link>
              </div>
            ) : filtered.map(b => {
              const f = FUENTE[(b.fuente || "google") as FuenteKey] || FUENTE.google;
              const isSelected = selected?.id === b.id;
              const total = b.leads_actuales;
              return (
                <button key={b.id} onClick={() => selectBarrido(b)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${isSelected ? "border-[#4E60A9] bg-[#EEF3FC]" : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"}`}>

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider"
                      style={{ color: f.color, backgroundColor: f.bg }}>
                      <f.Icon size={9} />
                      {b.especialidad ? (ESP_LABEL[b.especialidad] || b.especialidad) : f.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{fmtFecha(b.fecha)}</span>
                  </div>

                  <p className={`text-[13px] font-bold leading-tight truncate ${isSelected ? "text-[#4E60A9]" : "text-[#1E293B]"}`}>
                    {b.nombre}
                  </p>
                  {b.estado && <p className="text-[10px] text-gray-400 mt-0.5">{b.estado}</p>}

                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[11px] font-bold text-[#1E293B]">{total} leads</span>
                    {b.total_nuevos > 0 && (
                      <span className="text-[10px] font-bold text-[#34A853] bg-[#EEF9F1] px-1.5 py-0.5 rounded-full">
                        +{b.total_nuevos} nuevos
                      </span>
                    )}
                    <span className={`ml-auto text-[9px] font-bold ${b.completado ? "text-[#34A853]" : "text-orange-400"}`}>
                      {b.completado ? "✓ Completo" : "Parcial"}
                    </span>
                  </div>

                  {/* Mini barra de status */}
                  {b.statusBreakdown.length > 0 && total > 0 && (
                    <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
                      {b.statusBreakdown.map(s => {
                        const st = STATUS[s.status_crm as StatusKey];
                        if (!st) return null;
                        return (
                          <div key={s.status_crm}
                            style={{ backgroundColor: st.color, width: `${(s.count / total) * 100}%` }}
                            title={`${st.label}: ${s.count}`} />
                        );
                      })}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── DETALLE ────────────────────────────────────────────────────── */}
        {!selected ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3">
            <FolderOpen size={44} className="text-gray-200" />
            <p className="text-[15px] font-bold text-gray-400">Selecciona un barrido</p>
            <p className="text-[12px] text-gray-300">para ver sus médicos y estadísticas</p>
          </div>
        ) : (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">

            {/* Cabecera del detalle */}
            <div className="px-6 py-4 border-b border-gray-100 shrink-0 space-y-3">

              {/* Nombre + acciones */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {editNombre ? (
                    <div className="flex items-center gap-2">
                      <input autoFocus value={nombreVal} onChange={e => setNombreVal(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveNombre(); if (e.key === "Escape") setEditNombre(false); }}
                        className="flex-1 text-[18px] font-extrabold border-b-2 border-[#4E60A9] outline-none bg-transparent text-[#1E293B] min-w-0" />
                      <button onClick={saveNombre} className="text-[#34A853] hover:text-[#16A34A] shrink-0"><Check size={16} /></button>
                      <button onClick={() => setEditNombre(false)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setEditNombre(true)}>
                      <h2 className="text-[18px] font-extrabold text-[#1E293B] truncate leading-tight">{selected.nombre}</h2>
                      <Edit2 size={12} className="text-gray-300 group-hover:text-[#4E60A9] shrink-0 transition-colors" />
                    </div>
                  )}
                  {/* Badges: fuente, estado, fecha */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {(() => {
                      const f = FUENTE[(selected.fuente || "google") as FuenteKey] || FUENTE.google;
                      return (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ color: f.color, backgroundColor: f.bg }}>
                          <f.Icon size={10} />
                          {selected.especialidad ? (ESP_LABEL[selected.especialidad] || selected.especialidad) : f.label}
                        </span>
                      );
                    })()}
                    {selected.estado && <span className="text-[11px] text-gray-400 font-medium">{selected.estado}</span>}
                    {selected.fecha && (
                      <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
                        <Calendar size={11} /> {fmtFecha(selected.fecha)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={exportCSV}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 bg-gray-50 hover:bg-white border border-gray-200 px-3 py-1.5 rounded-full transition-colors">
                    <Download size={12} /> CSV
                  </button>
                  <button onClick={() => deleteBarrido(selected)}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Total leads",    value: totalLeads,                                      color: "#4E60A9", Icon: Users },
                  { label: "Sin contactar",  value: stat(["nuevo"]),                                 color: "#5A85F1", Icon: Users },
                  { label: "En proceso",     value: stat(["contactado","seguimiento","diagnostico"]), color: "#D97706", Icon: UserCheck },
                  { label: "Clientes",       value: stat(["cliente"]),                               color: "#34A853", Icon: Star },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 bg-[#F8FAFC] rounded-xl">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.color + "18" }}>
                      <s.Icon size={13} style={{ color: s.color }} />
                    </div>
                    <div>
                      <p className="text-[18px] font-extrabold text-[#1E293B] leading-none">{s.value}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Barra de progreso CRM */}
              {totalLeads > 0 && liveBreakdown.length > 0 && (
                <div>
                  <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                    {liveBreakdown.map(s => {
                      const st = STATUS[s.status_crm as StatusKey];
                      if (!st || s.count === 0) return null;
                      return (
                        <div key={s.status_crm}
                          title={`${st.label}: ${s.count}`}
                          style={{ backgroundColor: st.color, width: `${(s.count / totalLeads) * 100}%` }}
                          className="transition-all" />
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    {liveBreakdown.map(s => {
                      const st = STATUS[s.status_crm as StatusKey];
                      if (!st || s.count === 0) return null;
                      return (
                        <span key={s.status_crm} className="flex items-center gap-1 text-[10px] font-bold" style={{ color: st.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: st.color }} />
                          {st.label} ({s.count})
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Notas del barrido</p>
                  <button onClick={saveNotas}
                    disabled={savingNotas || notasVal === (selected.notas || "")}
                    className="flex items-center gap-1 text-[10px] font-bold text-[#4E60A9] disabled:text-gray-300 transition-colors">
                    {savingNotas ? <Activity size={10} className="animate-spin" /> : <Save size={10} />}
                    Guardar
                  </button>
                </div>
                <textarea value={notasVal} onChange={e => setNotasVal(e.target.value)} rows={2}
                  placeholder="Objetivo, contexto, campaña, zona específica..."
                  className="w-full text-[12px] font-medium text-[#1E293B] bg-[#F8FAFC] border border-gray-100 rounded-xl px-3 py-2 outline-none focus:border-[#4E60A9]/30 resize-none placeholder:text-gray-400 transition-all" />
              </div>
            </div>

            {/* Tabla de leads */}
            <div className="flex-1 overflow-y-auto">
              {loadingLeads ? (
                <div className="flex items-center justify-center py-16">
                  <Activity size={22} className="animate-spin text-gray-400" />
                </div>
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <Users size={32} className="text-gray-200" />
                  <p className="text-[13px] text-gray-400">Sin leads vinculados a este barrido</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                    <tr>
                      {["Médico / Especialidad", "Ciudad", "Teléfono", "Status CRM", ""].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {leads.map(lead => {
                      const st = STATUS[lead.status_crm as StatusKey] || STATUS.nuevo;
                      return (
                        <tr key={lead.id} className="hover:bg-[#F8FAFC] transition-colors">
                          <td className="px-5 py-3">
                            <Link href={`/clientes/${lead.id}`}
                              className="text-[13px] font-bold text-[#1E293B] hover:text-[#4E60A9] transition-colors">
                              {lead.nombre}
                            </Link>
                            {lead.nicho && <p className="text-[10px] text-gray-400 mt-0.5">{lead.nicho}</p>}
                          </td>
                          <td className="px-5 py-3 text-[12px] text-gray-500">
                            {[lead.ciudad, lead.estado_republica].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="px-5 py-3 text-[12px] font-mono text-gray-700">{lead.telefono || "—"}</td>
                          <td className="px-5 py-3">
                            <select value={lead.status_crm || "nuevo"}
                              onChange={e => patchStatus(lead.id, e.target.value)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-full outline-none cursor-pointer border-0 appearance-none shadow-sm"
                              style={{ color: st.color, backgroundColor: st.bg }}>
                              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                          </td>
                          <td className="px-5 py-3">
                            {(lead.whatsapp || lead.telefono) && (
                              <Link
                                href={`/whatsapp?phone=${(lead.whatsapp || lead.telefono)!.replace(/\D/g, "")}`}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#25D366] hover:bg-green-50 px-2 py-1 rounded-full transition-all">
                                <MessageCircle size={10} /> WA
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
