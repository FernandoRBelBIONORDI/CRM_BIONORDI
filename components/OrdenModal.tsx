"use client";

import { useState, useEffect, useRef } from "react";
import { X, Wrench, Calendar, CheckCircle, Clock, DollarSign, User, FileText, ChevronRight, Trash2, Check, AlertTriangle, Link2 } from "lucide-react";

export interface Orden {
  id: number; folio: string; lead_id?: number;
  lead_nombre?: string; lead_telefono?: string; lead_ciudad?: string;
  cotizacion_id?: number; cotizacion_folio?: string; cotizacion_monto?: number; cotizacion_tipo?: string;
  equipo_tipo?: string; equipo_marca?: string; equipo_modelo?: string; equipo_num_serie?: string;
  falla_reportada?: string; diagnostico?: string; notas_tecnicas?: string; tecnico?: string;
  presupuesto?: number; presupuesto_aprobado?: number; precio_final?: number;
  status: string;
  fecha_ingreso?: string; fecha_compromiso?: string; fecha_entrega?: string; fecha_creacion?: string;
}

const STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: "recibido",              label: "Recibido",           color: "#5A85F1", bg: "#EEF3FC" },
  { value: "en_diagnostico",        label: "En diagnóstico",     color: "#7C3AED", bg: "#F5F3FF" },
  { value: "en_reparacion",         label: "En reparación",      color: "#D97706", bg: "#FFFBEB" },
  { value: "en_espera_refacciones", label: "Espera refacciones", color: "#EA580C", bg: "#FFF7ED" },
  { value: "listo",                 label: "Listo para entregar", color: "#059669", bg: "#ECFDF5" },
  { value: "entregado",             label: "Entregado",          color: "#34A853", bg: "#EEF9F1" },
  { value: "cancelado",             label: "Cancelado",          color: "#DC2626", bg: "#FEF2F2" },
];

function stColor(s: string) { return STATUSES.find(x => x.value === s) || STATUSES[0]; }

interface Props {
  orden: Orden | null;
  onClose: () => void;
  onUpdate: (o: Orden) => void;
  onDelete: (id: number) => void;
}

export default function OrdenModal({ orden, onClose, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Orden>>({});
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orden) return;
    setForm({ ...orden });
  }, [orden?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    if (orden) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [orden]);

  const patch = async (updates: Partial<Orden>) => {
    if (!orden) return;
    setSaving(true);
    const res = await fetch("/api/ordenes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orden.id, ...updates }),
    }).then(r => r.json());
    if (res.orden) { setForm(res.orden); onUpdate(res.orden); }
    setSaving(false);
  };

  const changeStatus = (s: string) => patch({ status: s });

  const saveField = (field: keyof Orden, val: any) => patch({ [field]: val || null });

  if (!orden) return null;

  const st = stColor(form.status || orden.status);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const comprFecha = form.fecha_compromiso ? new Date(form.fecha_compromiso + "T00:00:00") : null;
  const comprVencida = comprFecha && comprFecha < hoy && form.status !== "entregado";
  const diasRestantes = comprFecha
    ? Math.ceil((comprFecha.getTime() - hoy.getTime()) / 86400000)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />
      <div ref={panelRef}
        className="relative w-[560px] h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ borderLeft: "1px solid #E2E8F0" }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-gray-300 mono">{orden.folio}</span>
                {saving && <span className="text-[10px] text-gray-400 font-medium">Guardando…</span>}
              </div>
              <h2 className="text-[20px] font-bold text-[#1E293B] tracking-tight leading-tight truncate">
                {form.lead_nombre || "Sin cliente"}
              </h2>
              {form.lead_ciudad && <p className="text-[12px] text-gray-400 font-medium mt-0.5">{form.lead_ciudad}</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => changeStatus(s.value)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all border"
                style={form.status === s.value
                  ? { color: s.color, backgroundColor: s.bg, borderColor: s.color + "40" }
                  : { color: "#94A3B8", backgroundColor: "transparent", borderColor: "#E2E8F0" }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Cotización de origen */}
          {form.cotizacion_folio && (
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-3 py-2 rounded-xl">
              <Link2 size={11} />
              <span>Cotización de origen:</span>
              <span className="font-mono">{form.cotizacion_folio}</span>
              {form.cotizacion_monto != null && (
                <span className="ml-auto font-bold text-[#1E293B]">
                  ${form.cotizacion_monto.toLocaleString("es-MX")}
                </span>
              )}
            </div>
          )}

          {/* Alerta compromiso */}
          {comprVencida && (
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] px-3 py-2 rounded-xl">
              <AlertTriangle size={12} /> Fecha de entrega vencida
            </div>
          )}
          {diasRestantes !== null && !comprVencida && diasRestantes <= 2 && form.status !== "entregado" && (
            <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#D97706] bg-[#FFFBEB] px-3 py-2 rounded-xl">
              <Clock size={12} /> {diasRestantes === 0 ? "Entrega hoy" : `${diasRestantes} día${diasRestantes > 1 ? "s" : ""} para entrega`}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* Equipo */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Equipo</h3>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["equipo_tipo",       "Tipo de transductor"],
                ["equipo_marca",      "Marca"],
                ["equipo_modelo",     "Modelo"],
                ["equipo_num_serie",  "No. serie"],
              ] as [keyof Orden, string][]).map(([field, label]) => (
                <div key={field} className={field === "equipo_tipo" ? "col-span-2" : ""}>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">{label}</label>
                  <input
                    value={(form[field] as string) || ""}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    onBlur={e => saveField(field, e.target.value)}
                    className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 focus:bg-white transition-all"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Falla + Diagnóstico */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Falla y Diagnóstico</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Falla reportada por cliente</label>
                <textarea
                  value={(form.falla_reportada as string) || ""}
                  onChange={e => setForm(p => ({ ...p, falla_reportada: e.target.value }))}
                  onBlur={e => saveField("falla_reportada", e.target.value)}
                  rows={2} className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 focus:bg-white resize-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Diagnóstico técnico</label>
                <textarea
                  value={(form.diagnostico as string) || ""}
                  onChange={e => setForm(p => ({ ...p, diagnostico: e.target.value }))}
                  onBlur={e => saveField("diagnostico", e.target.value)}
                  rows={2} className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 focus:bg-white resize-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Notas técnicas internas</label>
                <textarea
                  value={(form.notas_tecnicas as string) || ""}
                  onChange={e => setForm(p => ({ ...p, notas_tecnicas: e.target.value }))}
                  onBlur={e => saveField("notas_tecnicas", e.target.value)}
                  rows={2} className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 focus:bg-white resize-none transition-all" />
              </div>
            </div>
          </div>

          {/* Económico */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Económico</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Presupuesto (MXN)</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-[#4E60A9]/40 focus-within:bg-white transition-all">
                  <span className="text-[12px] text-gray-400 font-bold">$</span>
                  <input type="number" min={0}
                    value={form.presupuesto || ""}
                    onChange={e => setForm(p => ({ ...p, presupuesto: Number(e.target.value) }))}
                    onBlur={e => saveField("presupuesto", Number(e.target.value) || null)}
                    className="flex-1 text-[13px] font-bold bg-transparent outline-none text-[#1E293B]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Precio final (MXN)</label>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-[#4E60A9]/40 focus-within:bg-white transition-all">
                  <span className="text-[12px] text-gray-400 font-bold">$</span>
                  <input type="number" min={0}
                    value={form.precio_final || ""}
                    onChange={e => setForm(p => ({ ...p, precio_final: Number(e.target.value) }))}
                    onBlur={e => saveField("precio_final", Number(e.target.value) || null)}
                    className="flex-1 text-[13px] font-bold bg-transparent outline-none text-[#1E293B]" />
                </div>
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => { const v = form.presupuesto_aprobado ? 0 : 1; setForm(p => ({ ...p, presupuesto_aprobado: v })); saveField("presupuesto_aprobado", v); }}
                    className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.presupuesto_aprobado ? "bg-[#34A853]" : "bg-gray-300"}`}>
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.presupuesto_aprobado ? "translate-x-4" : ""}`} />
                  </div>
                  <span className="text-[12px] font-bold text-gray-600">Presupuesto aprobado por cliente</span>
                  {!!form.presupuesto_aprobado && <CheckCircle size={13} className="text-[#34A853]" />}
                </label>
              </div>
            </div>
          </div>

          {/* Fechas + Técnico */}
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Logística</h3>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["fecha_ingreso",    "Fecha de ingreso"],
                ["fecha_compromiso", "Fecha de entrega comprometida"],
              ] as [keyof Orden, string][]).map(([field, label]) => (
                <div key={field}>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">{label}</label>
                  <input type="date"
                    value={(form[field] as string)?.slice(0, 10) || ""}
                    onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                    onBlur={e => saveField(field, e.target.value)}
                    className="w-full text-[12px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 cursor-pointer" />
                </div>
              ))}
              <div>
                <label className="text-[10px] font-bold text-gray-400 block mb-1">Técnico asignado</label>
                <input
                  value={(form.tecnico as string) || ""}
                  onChange={e => setForm(p => ({ ...p, tecnico: e.target.value }))}
                  onBlur={e => saveField("tecnico", e.target.value)}
                  className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 focus:bg-white transition-all" />
              </div>
              {form.status === "entregado" && (
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Fecha de entrega real</label>
                  <input type="date"
                    value={(form.fecha_entrega as string)?.slice(0, 10) || ""}
                    onChange={e => setForm(p => ({ ...p, fecha_entrega: e.target.value }))}
                    onBlur={e => saveField("fecha_entrega", e.target.value)}
                    className="w-full text-[12px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 cursor-pointer" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-gray-50/50">
          <button onClick={async () => {
            if (!window.confirm(`¿Eliminar orden ${orden.folio}?`)) return;
            const res = await fetch("/api/ordenes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orden.id }) });
            if (!res.ok) { alert("Error al eliminar la orden. Intenta de nuevo."); return; }
            onDelete(orden.id);
            onClose();
          }} className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-2 rounded-full transition-colors">
            <Trash2 size={13} /> Eliminar OT
          </button>
          <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
            <Clock size={11} />
            Ingresó {orden.fecha_ingreso ? new Date(orden.fecha_ingreso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
