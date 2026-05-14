"use client";

import { useState, useEffect } from "react";
import { Wrench, Plus, Activity, Search, X, ChevronRight, Clock, DollarSign, AlertTriangle, CheckCircle } from "lucide-react";
import OrdenModal, { Orden } from "@/components/OrdenModal";

const COLS: { value: string; label: string; color: string; bg: string }[] = [
  { value: "recibido",              label: "Equipo recibido",     color: "#5A85F1", bg: "#EEF3FC" },
  { value: "en_diagnostico",        label: "Evaluación técnica",  color: "#7C3AED", bg: "#F5F3FF" },
  { value: "en_reparacion",         label: "Servicio en proceso", color: "#D97706", bg: "#FFFBEB" },
  { value: "en_espera_refacciones", label: "Espera refacciones",  color: "#EA580C", bg: "#FFF7ED" },
  { value: "en_pruebas",            label: "Pruebas de funcionamiento", color: "#0E7490", bg: "#ECFEFF" },
  { value: "listo",                 label: "Servicio finalizado", color: "#059669", bg: "#ECFDF5" },
  { value: "entregado",             label: "Entregado",           color: "#34A853", bg: "#EEF9F1" },
];

// Modal para crear nueva OT
function NuevaOrdenModal({ onClose, onCreate, initialLeadId }: { onClose: () => void; onCreate: (o: Orden) => void; initialLeadId?: number }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [form, setForm] = useState({
    lead_id: initialLeadId ? String(initialLeadId) : "",
    equipo_tipo: "", equipo_marca: "", equipo_modelo: "",
    equipo_num_serie: "", falla_reportada: "", fecha_ingreso: new Date().toISOString().slice(0, 10),
    fecha_compromiso: "", tecnico: "", presupuesto: "",
  });
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/leads").then(r => r.json()).then(d => {
      const allLeads = d.leads || [];
      setLeads(allLeads);
      if (initialLeadId) {
        const lead = allLeads.find((l: any) => l.id === initialLeadId);
        if (lead) setQ(lead.nombre);
      }
    }).catch(() => {});
  }, []);

  const leadsFiltered = leads.filter(l =>
    l.nombre.toLowerCase().includes(q.toLowerCase()) || l.ciudad?.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 8);

  const submit = async () => {
    setSaving(true);
    const res = await fetch("/api/ordenes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        lead_id: form.lead_id ? Number(form.lead_id) : null,
        presupuesto: form.presupuesto ? Number(form.presupuesto) : null,
      }),
    }).then(r => r.json());
    if (res.orden) { onCreate(res.orden); onClose(); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[560px] max-h-[88vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF3FC] flex items-center justify-center">
              <Wrench size={16} className="text-[#4E60A9]" />
            </div>
            <div>
              <h3 className="font-bold text-[15px] text-[#1E293B]">Nueva Orden de Servicio</h3>
              <p className="text-[11px] text-gray-400">El folio se asigna automáticamente</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Vincular cliente */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Vincular a lead (opcional)</label>
            {initialLeadId ? (
              <div className="w-full text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] border border-[#4E60A9]/20 rounded-xl px-3 py-2.5">
                {q || "Cargando cliente..."}
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar cliente..."
                    className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 outline-none focus:border-[#4E60A9]/40" />
                </div>
                {q && leadsFiltered.length > 0 && (
                  <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
                    {leadsFiltered.map(l => (
                      <button key={l.id} onClick={() => { setForm(p => ({ ...p, lead_id: String(l.id) })); setQ(l.nombre); }}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[12px] ${form.lead_id === String(l.id) ? "border-[#4E60A9] bg-[#EEF3FC] font-bold text-[#4E60A9]" : "border-gray-200 hover:border-gray-300"}`}>
                        <span className="text-gray-300 text-[10px] mono">#{String(l.id).padStart(4, "0")}</span>
                        <span className="flex-1 font-medium">{l.nombre}</span>
                        <span className="text-gray-400 text-[10px]">{l.ciudad}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Equipo */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Equipo</label>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Tipo de transductor *" value={form.equipo_tipo}
                onChange={e => setForm(p => ({ ...p, equipo_tipo: e.target.value }))}
                className="col-span-2 text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
              <input placeholder="Marca" value={form.equipo_marca}
                onChange={e => setForm(p => ({ ...p, equipo_marca: e.target.value }))}
                className="text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
              <input placeholder="Modelo" value={form.equipo_modelo}
                onChange={e => setForm(p => ({ ...p, equipo_modelo: e.target.value }))}
                className="text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
              <input placeholder="No. serie" value={form.equipo_num_serie}
                onChange={e => setForm(p => ({ ...p, equipo_num_serie: e.target.value }))}
                className="text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
              <input placeholder="Técnico" value={form.tecnico}
                onChange={e => setForm(p => ({ ...p, tecnico: e.target.value }))}
                className="text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 placeholder:text-gray-400" />
            </div>
          </div>

          {/* Falla */}
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Falla reportada</label>
            <textarea placeholder="Descripción del problema según el cliente..." value={form.falla_reportada}
              onChange={e => setForm(p => ({ ...p, falla_reportada: e.target.value }))}
              rows={2} className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 resize-none placeholder:text-gray-400" />
          </div>

          {/* Fechas + presupuesto */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Fecha ingreso</label>
              <input type="date" value={form.fecha_ingreso}
                onChange={e => setForm(p => ({ ...p, fecha_ingreso: e.target.value }))}
                className="w-full text-[12px] font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 cursor-pointer" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Entrega comprometida</label>
              <input type="date" value={form.fecha_compromiso}
                onChange={e => setForm(p => ({ ...p, fecha_compromiso: e.target.value }))}
                className="w-full text-[12px] font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 cursor-pointer" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 block mb-1">Presupuesto $</label>
              <input type="number" placeholder="0" value={form.presupuesto}
                onChange={e => setForm(p => ({ ...p, presupuesto: e.target.value }))}
                className="w-full text-[12px] font-bold bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={submit} disabled={saving || !form.equipo_tipo.trim()}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-[#4E60A9] hover:bg-[#2B5FD9] py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Activity size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear Orden de Servicio
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TallerPage() {
  const [ordenes, setOrdenes]       = useState<Orden[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOrden, setModalOrden] = useState<Orden | null>(null);
  const [showNueva, setShowNueva]   = useState(false);
  const [initialLeadId, setInitialLeadId] = useState<number | undefined>(undefined);
  const [q, setQ]                   = useState("");
  const [showEntregadas, setShowEntregadas] = useState(false);

  useEffect(() => {
    fetchOrdenes();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("nuevo") === "1") {
        const leadIdParam = sp.get("lead_id");
        if (leadIdParam) setInitialLeadId(Number(leadIdParam));
        setShowNueva(true);
      }
    }
  }, []);

  const fetchOrdenes = async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/ordenes").then(r => r.json());
      setOrdenes(d.ordenes || []);
    } catch {} finally { setLoading(false); }
  };

  const filtered = ordenes.filter(o => {
    if (!showEntregadas && o.status === "entregado") return false;
    if (q) {
      const txt = q.toLowerCase();
      return o.folio.toLowerCase().includes(txt)
        || o.lead_nombre?.toLowerCase().includes(txt)
        || o.equipo_tipo?.toLowerCase().includes(txt)
        || o.equipo_marca?.toLowerCase().includes(txt);
    }
    return true;
  });

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  const cols = showEntregadas ? COLS : COLS.filter(c => c.value !== "entregado");

  const metrics = {
    activas: ordenes.filter(o => !["entregado", "cancelado"].includes(o.status)).length,
    listas:  ordenes.filter(o => o.status === "listo").length,
    vencidas: ordenes.filter(o => {
      if (!o.fecha_compromiso || ["entregado", "cancelado"].includes(o.status)) return false;
      return new Date(o.fecha_compromiso + "T00:00:00") < hoy;
    }).length,
    entregadasMes: ordenes.filter(o => {
      if (o.status !== "entregado" || !o.fecha_entrega) return false;
      const ini = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return new Date(o.fecha_entrega) >= ini;
    }).length,
  };

  return (
    <div className="h-full flex flex-col font-sans">

      {/* Header */}
      <div className="px-4 md:px-4 pt-3 pb-2 bg-white border-b border-[#E8EFF8] shrink-0 space-y-3">
        {/* Título */}
        <div className="px-1">
          <h1 className="text-[22px] md:text-[28px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">Órdenes de Servicio</h1>
          <p className="text-[#8B95A5] text-[12px] md:text-[13px] font-medium mt-0.5">Administración técnica, reparaciones y mantenimiento</p>
        </div>

        {/* Buscador + botón */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar orden o cliente..."
              className="inp pl-10 w-full rounded-full py-[10px]" />
          </div>
          <button onClick={() => setShowNueva(true)}
            className="btn-primary flex items-center gap-2 shrink-0">
            <Plus size={14} /> Nueva Orden
          </button>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            { label: "Activas",     val: metrics.activas,      color: "#4E60A9", bg: "#EEF3FC" },
            { label: "Listas",      val: metrics.listas,       color: "#059669", bg: "#ECFDF5" },
            { label: "Vencidas",    val: metrics.vencidas,     color: "#DC2626", bg: "#FEF2F2" },
            { label: "Entregadas",  val: metrics.entregadasMes, color: "#34A853", bg: "#EEF9F1" },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-2xl border border-gray-100 bg-white shadow-sm shrink-0">
              <span className="text-[18px] md:text-[20px] font-extrabold tabular-nums" style={{ color: m.color }}>{m.val}</span>
              <span className="text-[10px] md:text-[11px] font-bold text-gray-400">{m.label}</span>
            </div>
          ))}
          <label className="flex items-center gap-2 ml-auto cursor-pointer text-[11px] md:text-[12px] font-bold text-gray-400 shrink-0">
            <input type="checkbox" checked={showEntregadas} onChange={e => setShowEntregadas(e.target.checked)} className="accent-[#4E60A9]" />
            Ver entregadas
          </label>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-x-auto p-4 md:p-6 pt-2 snap-x snap-mandatory pb-24 md:pb-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Activity size={24} className="animate-spin text-[#4E60A9]" />
          </div>
        ) : (
          <div className="flex gap-4 h-full">
            {cols.map(col => {
              const colOrdenes = filtered.filter(o => o.status === col.value);
              return (
                <div key={col.value} className="w-[85vw] md:w-[240px] flex flex-col gap-2 shrink-0 snap-center">
                  {/* Col header */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: col.bg, borderColor: col.color + "30" }}>
                    <span className="text-[12px] font-bold" style={{ color: col.color }}>{col.label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70" style={{ color: col.color }}>{colOrdenes.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-4">
                    {colOrdenes.length === 0 && (
                      <div className="py-6 text-center text-[11px] text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">Sin órdenes</div>
                    )}
                    {colOrdenes.map(o => {
                      const compFecha  = o.fecha_compromiso ? new Date(o.fecha_compromiso + "T00:00:00") : null;
                      const ingFecha   = o.fecha_ingreso    ? new Date(o.fecha_ingreso    + "T00:00:00") : null;
                      const vencida    = compFecha && compFecha < hoy && !["entregado", "cancelado"].includes(o.status);
                      const diasRest   = compFecha ? Math.ceil((compFecha.getTime() - hoy.getTime()) / 86400000) : null;
                      const urgente    = diasRest !== null && diasRest <= 1 && !vencida;
                      const diasEnTaller = ingFecha ? Math.floor((hoy.getTime() - ingFecha.getTime()) / 86400000) : null;
                      const monto      = o.precio_final || o.presupuesto;
                      const isListo    = o.status === "listo";

                      return (
                        <div key={o.id}
                          onClick={() => setModalOrden(o)}
                          className="bg-white rounded-2xl p-3.5 cursor-pointer transition-all duration-[130ms] relative"
                          style={{
                            border: `1.5px solid ${vencida ? "#FECACA" : urgente ? "#FED7AA" : "#E8EFF8"}`,
                            boxShadow: isListo
                              ? "0 4px 14px -4px rgba(5,150,105,.15)"
                              : "0 2px 8px -3px rgba(0,0,0,0.04)",
                          }}
                          onMouseEnter={e=>{
                            (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 5px 18px -4px rgba(124,58,237,.14)";
                          }}
                          onMouseLeave={e=>{
                            (e.currentTarget as HTMLElement).style.transform = "none";
                            (e.currentTarget as HTMLElement).style.boxShadow = isListo
                              ? "0 4px 14px -4px rgba(5,150,105,.15)"
                              : "0 2px 8px -3px rgba(0,0,0,0.04)";
                          }}>

                          {/* Folio + estado + días */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-[#CBD5E1] font-mono">{o.folio}</span>
                            <div className="flex items-center gap-1.5">
                              {vencida   && <AlertTriangle size={12} className="text-[#DC2626]" />}
                              {urgente && !vencida && <Clock size={12} className="text-[#D97706]" />}
                              {isListo   && <CheckCircle  size={12} className="text-[#059669]" />}
                              {diasEnTaller !== null && (
                                <span className="text-[9px] font-bold text-[#CBD5E1]">{diasEnTaller}d</span>
                              )}
                            </div>
                          </div>

                          {/* Cliente */}
                          <div className="font-bold text-[13px] text-[#1E293B] leading-snug mb-1.5 truncate">
                            {o.lead_nombre || "Sin cliente"}
                          </div>

                          {/* Equipo */}
                          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-[#F1F5F9] rounded-lg px-2 py-1.5 mb-2">
                            <Wrench size={10} className="text-[#94A3B8] shrink-0" />
                            <span className="text-[11px] font-semibold text-[#64748B] truncate">
                              {[o.equipo_tipo, o.equipo_marca].filter(Boolean).join(" · ") || "—"}
                            </span>
                          </div>

                          {/* Footer: técnico + monto + fecha */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="flex items-center gap-1.5">
                              {o.equipo_marca && (
                                <span className="text-[9px] font-bold text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-md">{o.equipo_marca}</span>
                              )}
                              {(o as any).tecnico && (
                                <span className="text-[10px] text-[#94A3B8] max-w-[80px] truncate">👷 {(o as any).tecnico}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {monto ? (
                                <span className="text-[12px] font-extrabold"
                                  style={{ color: isListo ? "#059669" : "#4E60A9" }}>
                                  ${monto.toLocaleString("es-MX")}
                                </span>
                              ) : null}
                              {compFecha ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                  style={{
                                    background: vencida ? "#FEF2F2" : urgente ? "#FFFBEB" : "#F8FAFC",
                                    color:      vencida ? "#DC2626" : urgente ? "#D97706" : "#94A3B8",
                                  }}>
                                  {vencida ? "Vencida" : compFecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNueva && (
        <NuevaOrdenModal
          onClose={() => { setShowNueva(false); setInitialLeadId(undefined); }}
          onCreate={o => setOrdenes(p => [o, ...p])}
          initialLeadId={initialLeadId}
        />
      )}
      {modalOrden && (
        <OrdenModal
          orden={modalOrden}
          onClose={() => setModalOrden(null)}
          onUpdate={updated => setOrdenes(p => p.map(o => o.id === updated.id ? updated : o))}
          onDelete={id => { setOrdenes(p => p.filter(o => o.id !== id)); setModalOrden(null); }}
        />
      )}
    </div>
  );
}
