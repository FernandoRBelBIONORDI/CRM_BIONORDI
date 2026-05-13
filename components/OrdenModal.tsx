"use client";

import { useState, useEffect, useRef } from "react";
import { X, Wrench, Calendar, CheckCircle, Clock, DollarSign, User, FileText, ChevronRight, Trash2, Check, AlertTriangle, Link2, Activity, Mail } from "lucide-react";

export interface Orden {
  id: number; folio: string; lead_id?: number;
  lead_nombre?: string; lead_telefono?: string; lead_ciudad?: string;
  cotizacion_id?: number; cotizacion_folio?: string; cotizacion_monto?: number; cotizacion_tipo?: string;
  
  datos_fiscales?: string; datos_hospital?: string; direccion?: string; correo?: string; telefono?: string;
  
  equipo_tipo?: string; equipo_marca?: string; equipo_modelo?: string; equipo_num_serie?: string;
  equipo_version?: string; equipo_ano?: string; equipo_area_medica?: string; accesorios_recibidos?: string;
  
  falla_reportada?: string; diagnostico?: string; actividades_realizadas?: string; mantenimiento_realizado?: string;
  refacciones_utilizadas?: string; pruebas_realizadas?: string; notas_tecnicas?: string;
  observaciones?: string; recomendaciones?: string; garantia?: string; reporte_tecnico_final?: string;
  
  tecnico?: string; presupuesto?: number; presupuesto_aprobado?: number; precio_final?: number;
  status: string;
  fecha_ingreso?: string; fecha_compromiso?: string; fecha_entrega?: string; fecha_creacion?: string;
}

const STATUSES: { value: string; label: string; color: string; bg: string }[] = [
  { value: "recibido",              label: "Equipo recibido",     color: "#5A85F1", bg: "#EEF3FC" },
  { value: "en_diagnostico",        label: "Evaluación técnica",  color: "#7C3AED", bg: "#F5F3FF" },
  { value: "en_reparacion",         label: "Servicio en proceso", color: "#D97706", bg: "#FFFBEB" },
  { value: "en_espera_refacciones", label: "Espera refacciones",  color: "#EA580C", bg: "#FFF7ED" },
  { value: "en_pruebas",            label: "Pruebas de funcionamiento", color: "#0E7490", bg: "#ECFEFF" },
  { value: "listo",                 label: "Servicio finalizado", color: "#059669", bg: "#ECFDF5" },
  { value: "entregado",             label: "Entregado",           color: "#34A853", bg: "#EEF9F1" },
  { value: "cancelado",             label: "Cancelado",           color: "#DC2626", bg: "#FEF2F2" },
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
  const [sendingEmail, setSendingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState("cliente");
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

  const TABS = [
    { id: "cliente", label: "Cliente" },
    { id: "equipo", label: "Equipo" },
    { id: "tecnico", label: "Servicio Técnico" },
    { id: "reporte", label: "Reporte y Garantía" },
    { id: "logistica", label: "Logística y Pagos" },
  ];

  const sendStatusEmail = async () => {
    if (!orden) return;
    const dest = form.correo || orden.correo;
    if (!dest) { alert("No hay correo registrado. Agrégalo en la pestaña Cliente."); return; }
    setSendingEmail(true);
    const st = stColor(form.status || orden.status);
    const currentStatus = form.status || orden.status;
    const STEPS = [
      { id: "recibido",              label: "Equipo Recibido" },
      { id: "en_diagnostico",        label: "Evaluación Técnica" },
      { id: "en_reparacion",         label: "Servicio en Proceso" },
      { id: "en_espera_refacciones", label: "Espera de Refacciones" },
      { id: "en_pruebas",            label: "Pruebas de Funcionamiento" },
      { id: "listo",                 label: "Servicio Finalizado" },
      { id: "entregado",             label: "Entregado" },
    ];
    const idx = STEPS.findIndex(s => s.id === currentStatus);
    const timelineRows = STEPS.map((step, i) => {
      const done = i < idx;
      const current = i === idx;
      const bg = (done || current) ? '#4E60A9' : '#E2E8F0';
      const icon = done ? '&#10003;' : current ? '&#9679;' : '';
      const iconColor = (done || current) ? 'white' : '#E2E8F0';
      const nameColor = current ? '#4E60A9' : done ? '#1E293B' : '#94A3B8';
      const op = i > idx ? '0.4' : '1';
      return `<tr style="opacity:${op}"><td width="36" style="vertical-align:top;padding-right:12px;padding-top:2px;"><div style="width:28px;height:28px;border-radius:50%;background:${bg};text-align:center;line-height:28px;font-size:13px;color:${iconColor};font-weight:900;">${icon}</div></td><td style="padding-bottom:14px;"><div style="font-size:14px;font-weight:700;color:${nameColor};">${step.label}</div></td></tr>`;
    }).join('');

    const techNote = form.diagnostico || orden.diagnostico || '';
    const falla = form.falla_reportada || orden.falla_reportada || '';
    const equipo = [form.equipo_tipo || orden.equipo_tipo, form.equipo_marca || orden.equipo_marca, form.equipo_modelo || orden.equipo_modelo].filter(Boolean).join(' / ');
    const serie = form.equipo_num_serie || orden.equipo_num_serie || '';
    const fechaRaw = form.fecha_compromiso || orden.fecha_compromiso || '';
    const fechaStr = fechaRaw ? new Date(fechaRaw + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const emailHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#F4F7FB" style="padding:24px 16px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<tr><td bgcolor="#FFFFFF" style="padding:24px 32px;border-bottom:1px solid #E8EFF8;border-radius:16px 16px 0 0;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td><div style="font-size:17px;font-weight:900;color:#1E293B;letter-spacing:-0.03em;">BIONORDI</div><div style="font-size:9px;color:#4E60A9;font-weight:700;letter-spacing:0.1em;margin-top:2px;">MEDICAL TECHNOLOGY</div></td>
    <td align="right"><span style="font-size:11px;font-weight:800;color:#4E60A9;background:#EEF3FC;padding:4px 12px;border-radius:20px;">Folio: ${orden.folio}</span></td>
  </tr></table>
</td></tr>
<tr><td bgcolor="#FFFFFF" style="padding:28px 32px;border-bottom:1px solid #F1F5F9;">
  <div style="font-size:22px;font-weight:900;color:#1E293B;margin-bottom:6px;">Actualización de Servicio</div>
  <div style="font-size:13px;color:#64748B;margin-bottom:20px;">${hoy}</div>
  <div style="display:inline-block;font-size:13px;font-weight:800;color:${st.color};background:${st.bg};padding:8px 20px;border-radius:20px;border:1px solid ${st.color}44;">${st.label}</div>
  ${fechaStr ? `<div style="margin-top:20px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;"><div style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Entrega Estimada</div><div style="font-size:15px;font-weight:800;color:#1E293B;">${fechaStr}</div></div>` : ''}
</td></tr>
${equipo || serie ? `<tr><td bgcolor="#FFFFFF" style="padding:24px 32px;border-bottom:1px solid #F1F5F9;">
  <div style="font-size:10px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">Información del Equipo</div>
  ${equipo ? `<div style="font-size:15px;font-weight:700;color:#1E293B;margin-bottom:8px;">${equipo}</div>` : ''}
  ${serie ? `<span style="font-size:12px;font-weight:600;color:#4E60A9;background:#EEF3FC;padding:3px 10px;border-radius:6px;">No. Serie: ${serie}</span>` : ''}
</td></tr>` : ''}
<tr><td bgcolor="#FFFFFF" style="padding:24px 32px;border-bottom:1px solid #F1F5F9;">
  <div style="font-size:10px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:16px;">Progreso del Servicio</div>
  <table width="100%" cellpadding="0" cellspacing="0">${timelineRows}</table>
</td></tr>
${falla || techNote ? `<tr><td bgcolor="#FFFFFF" style="padding:24px 32px;border-bottom:1px solid #F1F5F9;">
  <div style="font-size:10px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:14px;">Notas del Servicio</div>
  ${falla ? `<div style="margin-bottom:14px;"><div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">Falla reportada</div><div style="font-size:13px;color:#475569;background:#F8FAFC;padding:12px;border-radius:8px;border:1px solid #E2E8F0;line-height:1.6;">${falla.replace(/\n/g, '<br/>')}</div></div>` : ''}
  ${techNote ? `<div><div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">Diagnóstico / Avance técnico</div><div style="font-size:13px;color:#475569;background:#F8FAFC;padding:12px;border-radius:8px;border:1px solid #E2E8F0;line-height:1.6;">${techNote.replace(/\n/g, '<br/>')}</div></div>` : ''}
</td></tr>` : ''}
<tr><td bgcolor="#F8FAFC" style="padding:24px 32px;border-radius:0 0 16px 16px;border-top:1px solid #E8EFF8;">
  <div style="font-size:12px;color:#64748B;line-height:1.7;text-align:center;"><strong style="color:#1E293B;">Bionordi Medical Technology</strong> | Servicio Técnico Especializado<br/>Para cualquier consulta, responda a este correo o comuníquese directamente con su asesor Bionordi.</div>
</td></tr>
</table></td></tr></table></body></html>`;

    try {
      const r = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: dest, subject: `Actualización de Servicio – Folio ${orden.folio} | Bionordi`, html: emailHtml }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      alert(`Correo enviado a ${dest}`);
    } catch (e: any) {
      alert(`Error al enviar correo: ${e.message}`);
    } finally {
      setSendingEmail(false);
    }
  };

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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div ref={panelRef}
        className="relative w-full sm:w-[700px] h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right"
        style={{ borderLeft: "1px solid #E2E8F0" }}>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 shrink-0 bg-white z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-2 py-0.5 rounded-full mono">{orden.folio}</span>
                {saving && <span className="text-[10px] text-[#D97706] font-bold flex items-center gap-1"><Activity size={10} className="animate-spin" /> Guardando…</span>}
              </div>
              <h2 className="text-[22px] font-bold text-[#1E293B] tracking-tight leading-tight truncate">
                {form.lead_nombre || "Sin cliente"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/pdf/orden?id=${orden.id}`} target="_blank" rel="noreferrer"
                className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors shrink-0" title="Generar PDF">
                <FileText size={15} />
              </a>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Status selector */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUSES.map(s => (
              <button key={s.value} onClick={() => changeStatus(s.value)}
                className="text-[10px] font-bold px-3 py-1.5 rounded-full transition-all border"
                style={form.status === s.value
                  ? { color: s.color, backgroundColor: s.bg, borderColor: s.color + "40" }
                  : { color: "#94A3B8", backgroundColor: "transparent", borderColor: "#E2E8F0" }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Alertas */}
          {comprVencida && (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-[#DC2626] bg-[#FEF2F2] px-3 py-2 rounded-xl">
              <AlertTriangle size={12} /> Fecha de entrega vencida
            </div>
          )}
          {diasRestantes !== null && !comprVencida && diasRestantes <= 2 && form.status !== "entregado" && (
            <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-[#D97706] bg-[#FFFBEB] px-3 py-2 rounded-xl">
              <Clock size={12} /> {diasRestantes === 0 ? "Entrega hoy" : `${diasRestantes} día${diasRestantes > 1 ? "s" : ""} para entrega`}
            </div>
          )}
          
          {/* Tabs */}
          <div className="flex items-center gap-4 mt-4 border-b border-gray-100 pb-0">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`text-[12px] font-bold pb-2 transition-all ${activeTab === t.id ? 'text-[#4E60A9] border-b-2 border-[#4E60A9]' : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
          
          {activeTab === "cliente" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Input label="Datos del Hospital / Clínica" field="datos_hospital" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div className="col-span-2"><Input label="Dirección completa" field="direccion" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Teléfono" field="telefono" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Correo electrónico" field="correo" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div className="col-span-2"><Textarea label="Datos Fiscales (RFC, Razón Social, etc)" field="datos_fiscales" form={form} setForm={setForm} onBlur={saveField} rows={2} /></div>
              </div>
            </div>
          )}

          {activeTab === "equipo" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Input label="Tipo de equipo" field="equipo_tipo" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Marca" field="equipo_marca" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Modelo" field="equipo_modelo" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Número de serie" field="equipo_num_serie" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Versión / Software" field="equipo_version" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Año de fabricación" field="equipo_ano" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div><Input label="Área Médica" field="equipo_area_medica" form={form} setForm={setForm} onBlur={saveField} /></div>
                <div className="col-span-2"><Textarea label="Accesorios recibidos (cables, manuales, etc)" field="accesorios_recibidos" form={form} setForm={setForm} onBlur={saveField} rows={2} /></div>
              </div>
            </div>
          )}

          {activeTab === "tecnico" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <Textarea label="Falla reportada por el cliente" field="falla_reportada" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Diagnóstico Técnico" field="diagnostico" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Actividades Realizadas" field="actividades_realizadas" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Mantenimiento Realizado" field="mantenimiento_realizado" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Refacciones Utilizadas" field="refacciones_utilizadas" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Pruebas Realizadas" field="pruebas_realizadas" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Notas técnicas internas" field="notas_tecnicas" form={form} setForm={setForm} onBlur={saveField} rows={2} />
            </div>
          )}

          {activeTab === "reporte" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <Textarea label="Observaciones" field="observaciones" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Textarea label="Recomendaciones" field="recomendaciones" form={form} setForm={setForm} onBlur={saveField} rows={2} />
              <Input label="Garantía de Servicio (Tiempo y Condiciones)" field="garantia" form={form} setForm={setForm} onBlur={saveField} />
              <Textarea label="Reporte Técnico Final (Conclusión)" field="reporte_tecnico_final" form={form} setForm={setForm} onBlur={saveField} rows={3} />
            </div>
          )}

          {activeTab === "logistica" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
              <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Presupuesto cotizado (MXN)</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-[#4E60A9]/40 focus-within:bg-white transition-all">
                    <span className="text-[12px] text-gray-400 font-bold">$</span>
                    <input type="number" min={0} value={form.presupuesto || ""}
                      onChange={e => setForm(p => ({ ...p, presupuesto: Number(e.target.value) }))}
                      onBlur={e => saveField("presupuesto", Number(e.target.value) || null)}
                      className="flex-1 text-[13px] font-bold bg-transparent outline-none text-[#1E293B]" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1">Precio final a cobrar (MXN)</label>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-[#4E60A9]/40 focus-within:bg-white transition-all">
                    <span className="text-[12px] text-gray-400 font-bold">$</span>
                    <input type="number" min={0} value={form.precio_final || ""}
                      onChange={e => setForm(p => ({ ...p, precio_final: Number(e.target.value) }))}
                      onBlur={e => saveField("precio_final", Number(e.target.value) || null)}
                      className="flex-1 text-[13px] font-bold bg-transparent outline-none text-[#1E293B]" />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div onClick={() => { const v = form.presupuesto_aprobado ? 0 : 1; setForm(p => ({ ...p, presupuesto_aprobado: v })); saveField("presupuesto_aprobado", v); }}
                      className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 ${form.presupuesto_aprobado ? "bg-[#34A853]" : "bg-gray-300"}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${form.presupuesto_aprobado ? "translate-x-4" : ""}`} />
                    </div>
                    <span className="text-[12px] font-bold text-gray-600">Presupuesto aprobado por el cliente</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DateInput label="Fecha de ingreso" field="fecha_ingreso" form={form} setForm={setForm} onBlur={saveField} />
                <DateInput label="Fecha comprometida" field="fecha_compromiso" form={form} setForm={setForm} onBlur={saveField} />
                <div className="col-span-2">
                  <Input label="Técnico Responsable" field="tecnico" form={form} setForm={setForm} onBlur={saveField} />
                </div>
                {form.status === "entregado" && (
                  <div className="col-span-2">
                    <DateInput label="Fecha de entrega real" field="fecha_entrega" form={form} setForm={setForm} onBlur={saveField} />
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between bg-white z-10">
          <button onClick={async () => {
            if (!window.confirm(`¿Eliminar orden ${orden.folio}?`)) return;
            const res = await fetch("/api/ordenes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orden.id }) });
            if (!res.ok) { alert("Error al eliminar la orden."); return; }
            onDelete(orden.id);
            onClose();
          }} className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-2 rounded-full transition-colors">
            <Trash2 size={13} /> Eliminar Orden
          </button>
          
          <div className="flex items-center gap-3">
            <button onClick={sendStatusEmail} disabled={sendingEmail}
              className="flex items-center gap-1.5 text-[12px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] px-3 py-2 rounded-full transition-colors disabled:opacity-50">
              <Mail size={13} /> {sendingEmail ? "Enviando…" : "Actualizar por correo"}
            </button>
            <span className="text-[11px] text-gray-400 font-medium flex items-center gap-1">
              <Clock size={11} />
              Ingresó {orden.fecha_ingreso ? new Date(orden.fecha_ingreso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, field, form, setForm, onBlur }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <input value={(form[field] as string) || ""}
        onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
        onBlur={e => onBlur(field, e.target.value)}
        className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 focus:ring-2 focus:ring-[#4E60A9]/10 transition-all shadow-sm" />
    </div>
  );
}

function Textarea({ label, field, form, setForm, onBlur, rows }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <textarea value={(form[field] as string) || ""}
        onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
        onBlur={e => onBlur(field, e.target.value)}
        rows={rows}
        className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 focus:ring-2 focus:ring-[#4E60A9]/10 resize-none transition-all shadow-sm" />
    </div>
  );
}

function DateInput({ label, field, form, setForm, onBlur }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">{label}</label>
      <input type="date" value={(form[field] as string)?.slice(0, 10) || ""}
        onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
        onBlur={e => onBlur(field, e.target.value)}
        className="w-full text-[12px] font-bold bg-white border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 cursor-pointer shadow-sm" />
    </div>
  );
}
