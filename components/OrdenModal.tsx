"use client";

import { useState, useEffect, useRef } from "react";
import { X, CheckCircle, Clock, FileText, ChevronRight, Trash2, Check, AlertTriangle, Activity, Mail, Camera, Download } from "lucide-react";

export interface Orden {
  id: number; folio: string; tipo_orden?: string; lead_id?: number;
  lead_nombre?: string; lead_telefono?: string; lead_ciudad?: string;
  cotizacion_id?: number; cotizacion_folio?: string; cotizacion_monto?: number; cotizacion_tipo?: string;

  datos_fiscales?: string; datos_hospital?: string; direccion?: string; correo?: string; telefono?: string;

  equipo_tipo?: string; equipo_marca?: string; equipo_modelo?: string; equipo_num_serie?: string;
  equipo_version?: string; equipo_ano?: string; equipo_area_medica?: string; accesorios_recibidos?: string;

  falla_reportada?: string; diagnostico?: string; actividades_realizadas?: string; mantenimiento_realizado?: string;
  refacciones_utilizadas?: string; pruebas_realizadas?: string; notas_tecnicas?: string;
  observaciones?: string; recomendaciones?: string; garantia?: string; reporte_tecnico_final?: string;
  fotografias_json?: string;

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

// ─── Diálogo de confirmación para cambio de estado ───────────────────────────
function ConfirmStatusDialog({
  currentStatus,
  newStatus,
  clientEmail,
  onConfirm,
  onCancel,
}: {
  currentStatus: string;
  newStatus: string;
  clientEmail: string;
  onConfirm: (sendEmail: boolean) => void;
  onCancel: () => void;
}) {
  const [sendEmail, setSendEmail] = useState(!!clientEmail);
  const cur = stColor(currentStatus);
  const nxt = stColor(newStatus);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[360px] max-w-[calc(100vw-32px)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEF3FC] flex items-center justify-center shrink-0">
              <ChevronRight size={14} className="text-[#4E60A9]" />
            </div>
            <span className="text-[14px] font-bold text-[#1E293B]">Cambiar Estado</span>
          </div>
          <button onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Transición de estado */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cambio de estado</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                style={{ color: cur.color, backgroundColor: cur.bg, borderColor: cur.color + "40" }}>
                {cur.label}
              </span>
              <ChevronRight size={13} className="text-gray-300 shrink-0" />
              <span className="text-[11px] font-bold px-3 py-1.5 rounded-full border"
                style={{ color: nxt.color, backgroundColor: nxt.bg, borderColor: nxt.color + "40" }}>
                {nxt.label}
              </span>
            </div>
          </div>

          {/* Toggle de notificación por correo */}
          <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-opacity ${clientEmail ? "bg-[#F8FAFC] border-gray-100" : "bg-gray-50 border-gray-100 opacity-50"}`}>
            <div className="flex items-center gap-2 min-w-0">
              <Mail size={13} className="text-[#4E60A9] shrink-0" />
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-[#1E293B]">Notificar al cliente</div>
                <div className="text-[10px] text-gray-400 truncate">
                  {clientEmail || "Sin correo registrado"}
                </div>
              </div>
            </div>
            {clientEmail && (
              <button
                onClick={() => setSendEmail(v => !v)}
                className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${sendEmail ? "bg-[#4E60A9]" : "bg-gray-300"}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${sendEmail ? "translate-x-4" : ""}`} />
              </button>
            )}
          </div>

          {sendEmail && clientEmail && (
            <p className="text-[11px] text-[#4E60A9] bg-[#EEF3FC] px-3 py-2 rounded-xl">
              Se enviará el reporte de actualización al correo del cliente.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="text-[12px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={() => onConfirm(sendEmail)}
            className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#4E60A9] hover:bg-[#3B4F9A] px-4 py-2 rounded-xl transition-colors">
            <Check size={12} /> Confirmar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Diálogo de confirmación para eliminación ─────────────────────────────────
function ConfirmDeleteDialog({
  folio,
  onConfirm,
  onCancel,
}: {
  folio: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[360px] max-w-[calc(100vw-32px)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FEF2F2] flex items-center justify-center shrink-0">
            <Trash2 size={14} className="text-[#DC2626]" />
          </div>
          <span className="text-[14px] font-bold text-[#1E293B]">Eliminar Orden</span>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-[13px] text-[#475569] leading-relaxed">
            ¿Deseas eliminar la orden{" "}
            <span className="font-bold text-[#1E293B] font-mono">{folio}</span>?
          </p>
          <p className="text-[12px] text-[#94A3B8] mt-1">Esta acción es permanente y no se puede deshacer.</p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="text-[12px] font-bold text-gray-400 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#DC2626] hover:bg-[#B91C1C] px-4 py-2 rounded-xl transition-colors">
            <Trash2 size={12} /> Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function OrdenModal({ orden, onClose, onUpdate, onDelete }: Props) {
  const [form, setForm] = useState<Partial<Orden>>({});
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [fotosActividades, setFotosActividades] = useState<string[]>([]);
  const [fotosResultado, setFotosResultado] = useState<string[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState<'actividades' | 'resultado' | null>(null);
  const [activeTab, setActiveTab] = useState("cliente");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orden) return;
    setForm({ ...orden });
    try {
      const parsed = JSON.parse(orden.fotografias_json || '{}');
      setFotosActividades(parsed.actividades || []);
      setFotosResultado(parsed.resultado || []);
    } catch {
      setFotosActividades([]);
      setFotosResultado([]);
    }
  }, [orden?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pendingStatus || showDeleteConfirm) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    if (orden) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [orden, pendingStatus, showDeleteConfirm]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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

  const saveField = (field: keyof Orden, val: any) => patch({ [field]: val || null });

  // Abre el diálogo de confirmación en lugar de cambiar directamente
  const handleStatusClick = (s: string) => {
    if (s === (form.status || orden?.status)) return;
    setPendingStatus(s);
  };

  // Construye y envía el email de actualización con el formato oficial
  const sendEmailForStatus = async (statusOverride: string) => {
    if (!orden) return;
    const dest = form.correo || orden.correo;
    if (!dest) {
      setToast({ msg: "No hay correo registrado. Agrégalo en la pestaña Cliente.", ok: false });
      return;
    }
    setSendingEmail(true);
    const st = stColor(statusOverride);
    const STEPS = [
      { id: "recibido",              label: "Equipo Recibido" },
      { id: "en_diagnostico",        label: "Evaluación Técnica" },
      { id: "en_reparacion",         label: "Servicio en Proceso" },
      { id: "en_espera_refacciones", label: "Espera de Refacciones" },
      { id: "en_pruebas",            label: "Pruebas de Funcionamiento" },
      { id: "listo",                 label: "Servicio Finalizado" },
      { id: "entregado",             label: "Entregado" },
    ];
    const idx = STEPS.findIndex(s => s.id === statusOverride);
    const timelineRows = STEPS.map((step, i) => {
      const done = i < idx;
      const current = i === idx;
      const isLast = i === STEPS.length - 1;
      const circleBg = (done || current) ? '#4E60A9' : '#E8EFF8';
      const icon = done ? '&#10003;' : current ? '&#9679;' : '';
      const iconColor = (done || current) ? 'white' : '#CBD5E1';
      const nameColor = current ? '#4E60A9' : done ? '#334155' : '#CBD5E1';
      const weight = current ? '800' : done ? '600' : '500';
      const badge = current ? `<span style="display:inline-block;font-size:9px;font-weight:800;color:#4E60A9;background:#EEF3FC;padding:2px 9px;border-radius:10px;margin-left:8px;vertical-align:middle;">EN CURSO</span>` : '';
      const connectorColor = done ? '#4E60A9' : '#E8EFF8';
      const stepRow = `<tr style="opacity:${i > idx ? '0.4' : '1'}"><td width="40" valign="middle" style="padding-right:14px;padding-top:0;"><div style="width:32px;height:32px;border-radius:50%;background:${circleBg};text-align:center;line-height:32px;font-size:15px;color:${iconColor};font-weight:900;">${icon}</div></td><td style="padding-top:6px;padding-bottom:6px;"><span style="font-size:14px;font-weight:${weight};color:${nameColor};">${step.label}</span>${badge}</td></tr>`;
      const connRow = isLast ? '' : `<tr><td style="padding-right:14px;"><div style="width:2px;height:12px;background:${connectorColor};margin:0 15px;opacity:0.35;"></div></td><td></td></tr>`;
      return stepRow + connRow;
    }).join('');

    const techNote = form.diagnostico || orden.diagnostico || '';
    const falla = form.falla_reportada || orden.falla_reportada || '';
    const tecnico = form.tecnico || orden.tecnico || '';
    const equipo = [form.equipo_tipo || orden.equipo_tipo, form.equipo_marca || orden.equipo_marca, form.equipo_modelo || orden.equipo_modelo].filter(Boolean).join(' / ');
    const serie = form.equipo_num_serie || orden.equipo_num_serie || '';
    const fechaRaw = form.fecha_compromiso || orden.fecha_compromiso || '';
    const fechaStr = fechaRaw ? new Date(fechaRaw + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
    const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const LOGO = 'https://raw.githubusercontent.com/FernandoRBelBIONORDI/BIONORDI_IMAGENES/main/IMAGENES/LOGO_PRINCIPAL.png';

    const emailHtml = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-collapse:collapse;">

<!-- Top gradient bar -->
<tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

<!-- Logo header -->
<tr><td style="background:#ffffff;padding:18px 40px 16px;border-bottom:1px solid #E8EDF4;">
  <img src="${LOGO}" alt="Bionordi Medical Technology" height="40" border="0" style="display:block;height:40px;width:auto;margin-bottom:10px;" />
  <span style="display:inline-block;font-size:11px;font-weight:800;color:#4E60A9;background:#EEF3FC;padding:4px 14px;border-radius:20px;border:1px solid #C7D6F5;">Folio: ${orden.folio}</span>
</td></tr>

<!-- Hero: status -->
<tr><td bgcolor="#FFFFFF" style="padding:32px 40px 28px;">
  <div style="font-size:9px;font-weight:800;color:#94A3B8;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;">Actualización de Servicio</div>
  <div style="font-size:24px;font-weight:900;color:#1E293B;margin-bottom:4px;letter-spacing:-0.03em;">Estado actual del equipo</div>
  <div style="font-size:13px;color:#94A3B8;margin-bottom:22px;">${hoy}</div>
  <div style="display:inline-block;font-size:14px;font-weight:800;color:${st.color};background:${st.bg};padding:10px 24px;border-radius:50px;border:1.5px solid ${st.color}44;">${st.label}</div>
  ${fechaStr ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr><td bgcolor="#F8FAFC" style="border:1px solid #E2E8F0;border-radius:12px;padding:14px 18px;"><div style="font-size:9px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:5px;">Entrega Estimada</div><div style="font-size:15px;font-weight:800;color:#1E293B;">${fechaStr}</div></td></tr></table>` : ''}
</td></tr>

${equipo || serie ? `<!-- Equipment -->
<tr><td bgcolor="#FFFFFF" style="padding:0 40px 24px;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td bgcolor="#F8FAFC" style="border:1px solid #E8EFF8;border-radius:14px;padding:16px 20px;">
    <div style="font-size:9px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:10px;">Equipo en Servicio</div>
    ${equipo ? `<div style="font-size:15px;font-weight:700;color:#1E293B;margin-bottom:8px;">${equipo}</div>` : ''}
    <table cellpadding="0" cellspacing="0"><tr>
      ${serie ? `<td><span style="font-size:11px;font-weight:700;color:#4E60A9;background:#EEF3FC;padding:3px 12px;border-radius:6px;border:1px solid #C7D6F5;">No. Serie: ${serie}</span></td>` : ''}
      ${tecnico ? `<td style="padding-left:8px;"><span style="font-size:11px;font-weight:700;color:#64748B;background:#F1F5F9;padding:3px 12px;border-radius:6px;">Técnico: ${tecnico}</span></td>` : ''}
    </tr></table>
  </td></tr></table>
</td></tr>` : ''}

<!-- Divider -->
<tr><td style="padding:0 40px;"><div style="height:1px;background:#E8EDF4;"></div></td></tr>

<!-- Timeline -->
<tr><td bgcolor="#FFFFFF" style="padding:24px 40px;">
  <div style="font-size:9px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:20px;">Progreso del Servicio</div>
  <table width="100%" cellpadding="0" cellspacing="0">${timelineRows}</table>
</td></tr>

${falla || techNote ? `<!-- Notes -->
<tr><td bgcolor="#F8FAFC" style="padding:24px 40px;border-top:1px solid #E8EDF4;">
  <div style="font-size:9px;font-weight:800;color:#94A3B8;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:16px;">Notas del Servicio</div>
  ${falla ? `<div style="margin-bottom:14px;"><div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">Falla reportada</div><div style="font-size:13px;color:#475569;background:#FFFFFF;padding:12px 16px;border-radius:10px;border:1px solid #E2E8F0;line-height:1.7;">${falla.replace(/\n/g, '<br/>')}</div></div>` : ''}
  ${techNote ? `<div><div style="font-size:11px;font-weight:700;color:#64748B;margin-bottom:6px;">Diagnóstico / Avance técnico</div><div style="font-size:13px;color:#475569;background:#FFFFFF;padding:12px 16px;border-radius:10px;border:1px solid #E2E8F0;line-height:1.7;">${techNote.replace(/\n/g, '<br/>')}</div></div>` : ''}
</td></tr>` : ''}

<!-- Footer -->
<tr><td style="padding:20px 40px 24px;background:#F8FAFC;border-top:1px solid #E8EDF4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr>
    <td valign="middle"><img src="${LOGO}" alt="Bionordi" height="28" border="0" style="display:block;height:28px;width:auto;" /></td>
    <td align="right" valign="middle">
      <a href="https://www.bionordi.com" style="font-size:11px;color:#94A3B8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;" target="_blank">Sitio web</a>&nbsp;&nbsp;
      <a href="mailto:contacto@bionordi.mx" style="font-size:11px;color:#94A3B8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Contacto</a>
    </td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;"><tr><td height="1" bgcolor="#E8EDF4" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
  <p style="font-size:11px;color:#94A3B8;line-height:1.7;margin:0;font-family:Arial,Helvetica,sans-serif;">
    <strong style="color:#64748B;">Bionordi S.A. de C.V.</strong><br/>
    Laboratorio especializado en reparación y mantenimiento de transductores de ultrasonido.<br/>
    Para cualquier consulta responda a este correo o comuníquese con su asesor Bionordi.
  </p>
</td></tr>

<!-- Bottom gradient bar -->
<tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

</table></body></html>`;

    try {
      const r = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: dest, subject: `Actualización de Servicio – Folio ${orden.folio} | Bionordi`, html: emailHtml }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      setToast({ msg: `Correo enviado a ${dest}`, ok: true });
    } catch (e: any) {
      setToast({ msg: `Error al enviar correo: ${e.message}`, ok: false });
    } finally {
      setSendingEmail(false);
    }
  };

  const confirmStatusChange = async (sendEmail: boolean) => {
    if (!pendingStatus) return;
    const statusToSet = pendingStatus;
    setPendingStatus(null);
    await patch({ status: statusToSet });
    if (sendEmail) {
      await sendEmailForStatus(statusToSet);
    }
  };

  const handleDelete = async () => {
    if (!orden) return;
    setShowDeleteConfirm(false);
    const res = await fetch("/api/ordenes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: orden.id }),
    });
    if (!res.ok) {
      setToast({ msg: "Error al eliminar la orden.", ok: false });
      return;
    }
    onDelete(orden.id);
    onClose();
  };

  const TABS = [
    { id: "cliente", label: "Cliente" },
    { id: "equipo", label: "Equipo" },
    { id: "tecnico", label: "Servicio Técnico" },
    { id: "reporte", label: "Reporte y Garantía" },
    { id: "logistica", label: "Logística y Pagos" },
  ];

  const saveFotos = (act: string[], res: string[]) =>
    patch({ fotografias_json: JSON.stringify({ actividades: act, resultado: res }) });

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'actividades' | 'resultado') => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    const current = tipo === 'actividades' ? fotosActividades : fotosResultado;
    if (current.length >= 4) return;
    setUploadingFoto(tipo);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await fetch(`/api/upload?subfolder=ordenes&filename=${encodeURIComponent(file.name)}`, { method: 'POST', body: fd }).then(r => r.json());
      if (res.path) {
        const next = [...current, res.path];
        if (tipo === 'actividades') { setFotosActividades(next); saveFotos(next, fotosResultado); }
        else { setFotosResultado(next); saveFotos(fotosActividades, next); }
      }
    } catch {}
    setUploadingFoto(null);
  };

  const removeFoto = (tipo: 'actividades' | 'resultado', idx: number) => {
    if (tipo === 'actividades') {
      const next = fotosActividades.filter((_, i) => i !== idx);
      setFotosActividades(next); saveFotos(next, fotosResultado);
    } else {
      const next = fotosResultado.filter((_, i) => i !== idx);
      setFotosResultado(next); saveFotos(fotosActividades, next);
    }
  };

  if (!orden) return null;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const comprFecha = form.fecha_compromiso ? new Date(form.fecha_compromiso + "T00:00:00") : null;
  const comprVencida = comprFecha && comprFecha < hoy && form.status !== "entregado";
  const diasRestantes = comprFecha
    ? Math.ceil((comprFecha.getTime() - hoy.getTime()) / 86400000)
    : null;
  const clientEmail = form.correo || orden.correo || "";

  return (
    <>
      <div className="fixed inset-0 z-[70] flex justify-end">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div ref={panelRef}
          className="relative w-full sm:w-[700px] h-full bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right"
          style={{ borderLeft: "1px solid #E2E8F0" }}>

          {/* Toast */}
          {toast && (
            <div className={`absolute top-4 left-4 right-4 z-20 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border pointer-events-none ${toast.ok ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]" : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"}`}>
              {toast.ok ? <CheckCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
              <span className="text-[12px] font-bold">{toast.msg}</span>
            </div>
          )}

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
                <button onClick={() => setShowPdfPreview(true)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 bg-red-50 hover:bg-red-100 transition-colors shrink-0" title="Ver PDF">
                  <FileText size={15} />
                </button>
                <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Status selector */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {STATUSES.map(s => (
                <button key={s.value} onClick={() => handleStatusClick(s.value)}
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
            <div className="flex items-center gap-4 mt-4 border-b border-gray-100 pb-0 overflow-x-auto scrollbar-none">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`text-[12px] font-bold pb-2 transition-all shrink-0 ${activeTab === t.id ? 'text-[#4E60A9] border-b-2 border-[#4E60A9]' : 'text-gray-400 border-b-2 border-transparent hover:text-gray-600'}`}>
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
                <FotoUploader
                  label="Fotos de actividades realizadas (máx. 4)"
                  fotos={fotosActividades}
                  onUpload={(e: React.ChangeEvent<HTMLInputElement>) => handleFotoUpload(e, 'actividades')}
                  onRemove={(i: number) => removeFoto('actividades', i)}
                  uploading={uploadingFoto === 'actividades'}
                />
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
                <FotoUploader
                  label="Fotos del equipo al finalizar (máx. 4)"
                  fotos={fotosResultado}
                  onUpload={(e: React.ChangeEvent<HTMLInputElement>) => handleFotoUpload(e, 'resultado')}
                  onRemove={(i: number) => removeFoto('resultado', i)}
                  uploading={uploadingFoto === 'resultado'}
                />
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
          <div className="px-4 md:px-6 py-3 md:py-4 border-t border-gray-100 shrink-0 flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-white z-10">
            <button onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-[12px] font-bold text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-2 rounded-full transition-colors self-start md:self-auto">
              <Trash2 size={13} /> Eliminar Orden
            </button>

            <div className="flex items-center justify-between md:justify-end gap-3">
              <button
                onClick={() => {
                  const dest = form.correo || orden.correo;
                  if (!dest) {
                    setToast({ msg: "No hay correo registrado. Agrégalo en la pestaña Cliente.", ok: false });
                    return;
                  }
                  sendEmailForStatus(form.status || orden.status);
                }}
                disabled={sendingEmail}
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

      {/* Diálogo de confirmación de cambio de estado */}
      {pendingStatus && (
        <ConfirmStatusDialog
          currentStatus={form.status || orden.status}
          newStatus={pendingStatus}
          clientEmail={clientEmail}
          onConfirm={confirmStatusChange}
          onCancel={() => setPendingStatus(null)}
        />
      )}

      {/* Diálogo de confirmación de eliminación */}
      {showDeleteConfirm && (
        <ConfirmDeleteDialog
          folio={orden.folio}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPdfPreview(false)} />
          <div className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white shrink-0">
              <span className="text-[16px] font-extrabold text-[#1E293B]">Reporte — {orden.folio}</span>
              <div className="flex items-center gap-3">
                <a href={`/api/pdf/orden?id=${orden.id}`} download={`Orden_${orden.folio}.pdf`}
                  className="flex items-center gap-2 text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-4 py-2 rounded-xl transition-colors">
                  <Download size={16} /> Descargar
                </a>
                <button onClick={() => setShowPdfPreview(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe src={`/api/pdf/orden?id=${orden.id}`} className="flex-1 w-full border-0 bg-gray-50 rounded-b-2xl" title={`Reporte ${orden.folio}`} />
          </div>
        </div>
      )}
    </>
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

function FotoUploader({ label, fotos, onUpload, onRemove, uploading }: {
  label: string;
  fotos: string[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
  uploading: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-400 block mb-2 uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {fotos.map((p, i) => (
          <div key={i} className="relative w-[88px] h-[88px] group shrink-0">
            <img src={p} alt={`foto-${i+1}`} className="w-full h-full object-contain rounded-lg border border-gray-200 bg-white" />
            <button
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[11px] font-bold hidden group-hover:flex items-center justify-center shadow-sm"
            >×</button>
            <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center text-gray-400 bg-white/80 rounded-b-lg py-0.5">Foto {i+1}</span>
          </div>
        ))}
        {fotos.length < 4 && (
          <label className={`w-[88px] h-[88px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-[#4E60A9]/50 hover:bg-[#EEF3FC]/40 transition-all shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading
              ? <Activity size={18} className="text-[#4E60A9] animate-spin" />
              : <Camera size={18} className="text-gray-300" />}
            <span className="text-[9px] text-gray-400 mt-1">{uploading ? 'Subiendo…' : 'Agregar'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
        )}
      </div>
    </div>
  );
}
