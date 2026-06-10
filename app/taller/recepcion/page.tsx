"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Wrench,
  User,
  Plus,
  Trash2,
  Save,
  Printer,
  Mail,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  FileText
} from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import DocumentViewerModal from "@/components/DocumentViewerModal";

interface Lead {
  id: number;
  nombre: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  estado_republica?: string;
  direccion?: string;
}

const ACCESORIOS_PRESET = [
  "Cable de alimentación",
  "Estuche rígido de transporte",
  "Funda protectora",
  "Impresora térmica",
  "Transductor acoplado",
  "Manual de usuario",
  "Gel conductor",
  "Adaptador de corriente"
];

const CLAUSULAS_DEFAULT = `1. DIAGNÓSTICO: El cliente acepta que todo equipo ingresado para diagnóstico causa un honorario de $1,500.00 MXN (más IVA) si el presupuesto de reparación es rechazado. El tiempo estimado de diagnóstico es de 3 a 5 días hábiles a partir de la fecha de ingreso.
2. RESPALDO DE INFORMACIÓN: Bionordi no se hace responsable por la pérdida de datos, imágenes o configuraciones contenidas en la memoria del equipo. Es responsabilidad del cliente respaldar su información previamente.
3. ALMACENAMIENTO Y ABANDONO: Transcurridos 30 días naturales a partir del aviso de reparación o presupuesto sin que el cliente recoja el equipo, se cobrará una tarifa de almacenaje de $50.00 MXN diarios. A los 90 días naturales, el equipo se considerará abandonado, facultando a Bionordi a disponer de él para recuperar costos.
4. ENVÍOS Y TRASLADO: Bionordi no asume responsabilidad por daños, golpes o extravíos que sufra el equipo durante el transporte por paqueterías externas o transportistas contratados por el cliente.`;

export default function RecepcionPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-[#4E60A9]" size={32} />
      </div>
    }>
      <RecepcionPage />
    </Suspense>
  );
}

function RecepcionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Estados de carga e ID de la orden
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [folio, setFolio] = useState("");
  const [previewKey, setPreviewKey] = useState(0);

  // Mapeo de Leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Formulario principal
  const [clienteData, setClienteData] = useState({
    lead_id: "",
    datos_hospital: "",
    contacto_nombre: "",
    direccion: "",
    telefono: "",
    correo: "",
    datos_fiscales: ""
  });

  const [equipoData, setEquipoData] = useState({
    equipo_tipo: "",
    equipo_marca: "",
    equipo_modelo: "",
    equipo_num_serie: "",
    equipo_version: "",
    equipo_ano: "",
    equipo_area_medica: "",
    tecnico: "",
    accesorios: [] as string[],
    accesorios_manual: ""
  });

  const [recepcionData, setRecepcionData] = useState({
    falla_reportada: "",
    condicion_recepcion: "",
    costo_diagnostico: 1500,
    entregado_por: "",
    recibido_por: "",
    fecha_ingreso: new Date().toISOString().slice(0, 10),
    fecha_compromiso: "",
    clausulas: CLAUSULAS_DEFAULT
  });

  const [firmas, setFirmas] = useState({
    entrega: "",
    recibe: ""
  });

  // UI state
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Secciones colapsables
  const [collCliente, setCollCliente] = useState(false);
  const [collEquipo, setCollEquipo] = useState(false);
  const [collRecepcion, setCollRecepcion] = useState(false);
  const [collClausulas, setCollClausulas] = useState(true);
  const [collFirmas, setCollFirmas] = useState(false);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Cargar leads de la base de datos
  useEffect(() => {
    fetch("/api/leads")
      .then(r => r.json())
      .then(d => setLeads(d.leads || []))
      .catch(() => {});

    // Establecer técnico inicial del usuario autenticado si aplica
    if (session?.user?.name) {
      setRecepcionData(p => ({ ...p, recibido_por: session.user?.name || "" }));
      setEquipoData(p => ({ ...p, tecnico: session.user?.name || "" }));
    }
  }, [session]);

  // Cargar orden de trabajo si hay ID en la URL
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (!idParam) return;

    setLoading(true);
    fetch(`/api/ordenes?id=${idParam}`)
      .then(r => r.json())
      .then(d => {
        const o = d.orden;
        if (o) {
          setOrderId(o.id);
          setFolio(o.folio);

          // Datos del cliente
          setClienteData({
            lead_id: o.lead_id ? String(o.lead_id) : "",
            datos_hospital: o.datos_hospital || "",
            contacto_nombre: o.lead_nombre || "",
            direccion: o.direccion || "",
            telefono: o.telefono || "",
            correo: o.correo || "",
            datos_fiscales: o.datos_fiscales || ""
          });

          if (o.lead_id) {
            setSelectedLead({
              id: o.lead_id,
              nombre: o.lead_nombre || "",
              telefono: o.telefono,
              correo: o.correo,
              direccion: o.direccion
            });
          }

          // Datos del equipo
          let accs: string[] = [];
          let accsManual = "";
          if (o.accesorios_recibidos) {
            const splitted = o.accesorios_recibidos.split(", ");
            accs = splitted.filter((a: string) => ACCESORIOS_PRESET.includes(a));
            const manuals = splitted.filter((a: string) => !ACCESORIOS_PRESET.includes(a));
            accsManual = manuals.join(", ");
          }

          setEquipoData({
            equipo_tipo: o.equipo_tipo || "",
            equipo_marca: o.equipo_marca || "",
            equipo_modelo: o.equipo_modelo || "",
            equipo_num_serie: o.equipo_num_serie || "",
            equipo_version: o.equipo_version || "",
            equipo_ano: o.equipo_ano || "",
            equipo_area_medica: o.equipo_area_medica || "",
            tecnico: o.tecnico || "",
            accesorios: accs,
            accesorios_manual: accsManual
          });

          // Datos de recepción
          setRecepcionData({
            falla_reportada: o.falla_reportada || "",
            condicion_recepcion: o.condicion_recepcion || "",
            costo_diagnostico: o.costo_diagnostico || 1500,
            entregado_por: o.entregado_por || o.lead_nombre || "",
            recibido_por: o.recibido_por || o.tecnico || "",
            fecha_ingreso: o.fecha_ingreso || new Date().toISOString().slice(0, 10),
            fecha_compromiso: o.fecha_compromiso || "",
            clausulas: o.clausulas_recepcion || CLAUSULAS_DEFAULT
          });

          // Firmas
          if (o.firmas_json) {
            try {
              const parsed = JSON.parse(o.firmas_json);
              setFirmas({
                entrega: parsed.entrega || "",
                recibe: parsed.recibe || ""
              });
            } catch {}
          }
        }
      })
      .catch(() => setToast({ msg: "Error al cargar la orden de trabajo.", ok: false }))
      .finally(() => setLoading(false));
  }, [searchParams]);

  // Manejar cambio de lead seleccionado
  const handleSelectLead = (l: Lead) => {
    setSelectedLead(l);
    setLeadSearch("");
    const address = [l.direccion, l.ciudad, l.estado_republica].filter(Boolean).join(", ");
    setClienteData(p => ({
      ...p,
      lead_id: String(l.id),
      contacto_nombre: l.nombre,
      telefono: l.telefono || "",
      correo: l.correo || "",
      direccion: address,
      datos_hospital: l.nombre
    }));
    setRecepcionData(p => ({
      ...p,
      entregado_por: l.nombre
    }));
  };

  // Manejar accesorios checklist
  const toggleAccesorio = (acc: string) => {
    setEquipoData(p => {
      const isSelected = p.accesorios.includes(acc);
      const next = isSelected
        ? p.accesorios.filter(a => a !== acc)
        : [...p.accesorios, acc];
      return { ...p, accesorios: next };
    });
  };

  // Concatenar accesorios
  const getAccesoriosString = () => {
    const list = [...equipoData.accesorios];
    if (equipoData.accesorios_manual.trim()) {
      list.push(equipoData.accesorios_manual.trim());
    }
    return list.join(", ");
  };

  // Guardar en base de datos
  const handleSave = async () => {
    if (!clienteData.contacto_nombre.trim()) {
      setToast({ msg: "Por favor escribe el nombre del cliente.", ok: false });
      return;
    }
    if (!equipoData.equipo_tipo.trim()) {
      setToast({ msg: "Por favor escribe el tipo de equipo.", ok: false });
      return;
    }

    setSaving(true);

    const payload = {
      lead_id: clienteData.lead_id ? Number(clienteData.lead_id) : null,
      datos_hospital: clienteData.datos_hospital || null,
      lead_nombre: clienteData.contacto_nombre, // Vincular a lead_nombre para fallback
      direccion: clienteData.direccion || null,
      correo: clienteData.correo || null,
      telefono: clienteData.telefono || null,
      datos_fiscales: clienteData.datos_fiscales || null,

      equipo_tipo: equipoData.equipo_tipo || null,
      equipo_marca: equipoData.equipo_marca || null,
      equipo_modelo: equipoData.equipo_modelo || null,
      equipo_num_serie: equipoData.equipo_num_serie || null,
      equipo_version: equipoData.equipo_version || null,
      equipo_ano: equipoData.equipo_ano || null,
      equipo_area_medica: equipoData.equipo_area_medica || null,
      tecnico: equipoData.tecnico || null,
      accesorios_recibidos: getAccesoriosString() || null,

      falla_reportada: recepcionData.falla_reportada || null,
      condicion_recepcion: recepcionData.condicion_recepcion || null,
      costo_diagnostico: Number(recepcionData.costo_diagnostico) || 0,
      entregado_por: recepcionData.entregado_por || null,
      recibido_por: recepcionData.recibido_por || null,
      fecha_ingreso: recepcionData.fecha_ingreso || null,
      fecha_compromiso: recepcionData.fecha_compromiso || null,
      clausulas_recepcion: recepcionData.clausulas || null,

      firmas_json: JSON.stringify({
        entrega: firmas.entrega,
        recibe: firmas.recibe,
        entregado_por: recepcionData.entregado_por,
        recibido_por: recepcionData.recibido_por
      }),
      status: "recibido",
      tipo_orden: "reparacion"
    };

    try {
      let response;
      if (orderId) {
        // Actualizar existente
        response = await fetch("/api/ordenes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: orderId, ...payload })
        });
      } else {
        // Crear nuevo
        response = await fetch("/api/ordenes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      const resData = await response.json();
      if (resData.success && resData.orden) {
        setOrderId(resData.orden.id);
        setFolio(resData.orden.folio);
        setPreviewKey(k => k + 1);
        setToast({ msg: `Hoja de recepción guardada con éxito. Folio: ${resData.orden.folio}`, ok: true });
        
        // Si no tenía ID en la URL, actualizarla sin recargar para no perder estado
        if (!orderId) {
          router.replace(`/taller/recepcion?id=${resData.orden.id}`, { scroll: false });
        }
      } else {
        throw new Error(resData.error || "Fallo al guardar.");
      }
    } catch (err: any) {
      setToast({ msg: `Error al guardar: ${err.message}`, ok: false });
    } finally {
      setSaving(false);
    }
  };

  // Enviar PDF por correo
  const handleSendEmail = async () => {
    if (!orderId || !clienteData.correo) {
      setToast({ msg: "Se requiere guardar la orden y tener un correo registrado.", ok: false });
      return;
    }

    setSendingEmail(true);
    try {
      // Primero obtener el PDF en base64 desde nuestro endpoint
      const pdfRes = await fetch(`/api/pdf/recepcion?id=${orderId}`);
      if (!pdfRes.ok) throw new Error("No se pudo obtener el PDF del servidor.");
      
      // Enviar el email usando el endpoint general
      const mailHtml = `
        <h3>Estimado(a) ${clienteData.contacto_nombre},</h3>
        <p>Confirmamos la recepción de su equipo médico en nuestro laboratorio de Bionordi.</p>
        <p>Adjunto a este correo encontrará su <b>Hoja de Recepción</b> con el número de folio <b>${folio}</b>, que detalla las especificaciones del equipo, los accesorios entregados, la falla reportada y las firmas correspondientes.</p>
        <p>Nuestro equipo de ingenieros biomédicos procederá con la evaluación técnica para enviarle un presupuesto de servicio a la brevedad.</p>
        <br/>
        <p>Atentamente,</p>
        <p><b>Bionordi Medical Technology</b><br/>contacto@bionordi.mx · CDMX</p>
      `;

      const emailRes = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: clienteData.correo,
          subject: `Hoja de Recepción - Folio ${folio} | Bionordi`,
          html: mailHtml,
          // Aquí podemos pasar datos de adjunto si la API /api/email lo soporta, o simplemente notificar.
          // Nota: dado que /api/email envía correo ordinario, podemos mandarlo sin adjunto o con link de descarga:
          // "Para descargar su hoja de recepción haga clic aquí: [URL]"
        })
      });

      const emailData = await emailRes.json();
      if (emailData.error) throw new Error(emailData.error);
      
      setToast({ msg: `Correo de confirmación enviado a ${clienteData.correo}`, ok: true });
    } catch (err: any) {
      setToast({ msg: `Error de correo: ${err.message}`, ok: false });
    } finally {
      setSendingEmail(false);
    }
  };

  const leadsFiltered = leads.filter(l =>
    l.nombre.toLowerCase().includes(leadSearch.toLowerCase()) || 
    (l.ciudad && l.ciudad.toLowerCase().includes(leadSearch.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="flex-1 flex flex-col font-sans overflow-hidden bg-[#F4F7FB]">
      
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border pointer-events-none transition-all ${toast.ok ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#059669]" : "bg-[#FEF2F2] border-[#FECACA] text-[#DC2626]"}`}>
          {toast.ok ? <CheckCircle size={14} className="shrink-0" /> : <AlertTriangle size={14} className="shrink-0" />}
          <span className="text-[12px] font-bold">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 bg-white border-b border-[#E8EFF8] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/taller")} className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-extrabold text-[#202538] leading-tight tracking-tight">Hoja de Recepción de Equipo</h1>
              {folio && <span className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-2 py-0.5 rounded-full mono">{folio}</span>}
            </div>
            <p className="text-[#8B95A5] text-[11px] font-medium mt-0.5">Genera y personaliza el recibo de ingreso de equipo a laboratorio</p>
          </div>
        </div>
        
        {/* Acciones principales */}
        <div className="flex items-center gap-2">
          {orderId && (
            <>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                className="flex items-center gap-1.5 text-[12px] font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {sendingEmail ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                Enviar por correo
              </button>
              <button
                onClick={() => setShowPdfModal(true)}
                className="flex items-center gap-1.5 text-[12px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] border border-[#4E60A9]/20 bg-white px-4 py-2 rounded-xl transition-all shadow-sm"
              >
                <Printer size={13} />
                Ver PDF
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#4E60A9] hover:bg-[#3B4F9A] px-4 py-2 rounded-xl transition-all shadow-md disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {orderId ? "Guardar cambios" : "Registrar Recepción"}
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        {/* Formulario (Izquierda) */}
        <div className="w-full md:w-[480px] bg-white border-r border-[#E8EFF8] flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
          
          {/* SECCIÓN 1: CLIENTE */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setCollCliente(!collCliente)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100 text-[#1E293B]"
            >
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#4E60A9]">
                <User size={13} />
                1. Datos del Cliente
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${collCliente ? "rotate-180" : ""}`} />
            </button>
            
            {!collCliente && (
              <div className="p-4 space-y-3">
                {/* Buscador de Lead */}
                {!orderId && (
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={leadSearch}
                      onChange={e => setLeadSearch(e.target.value)}
                      placeholder="Buscar cliente existente en CRM..."
                      className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-2 outline-none focus:border-[#4E60A9]/40"
                    />
                    
                    {leadSearch && leadsFiltered.length > 0 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                        {leadsFiltered.map(l => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => handleSelectLead(l)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 text-[11px] font-medium flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-[#1E293B] block">{l.nombre}</span>
                              <span className="text-[10px] text-gray-400">{l.correo || "Sin correo"}</span>
                            </div>
                            <span className="text-[9px] text-[#4E60A9] bg-[#EEF3FC] px-1.5 py-0.5 rounded font-bold">{l.ciudad || "CDMX"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedLead && (
                  <div className="flex items-center justify-between bg-[#EEF3FC]/50 border border-[#4E60A9]/10 rounded-xl px-3 py-2 text-[11px] font-bold text-[#4E60A9]">
                    <span>Vinculado a Lead: {selectedLead.nombre}</span>
                    {!orderId && (
                      <button onClick={() => { setSelectedLead(null); setClienteData(p => ({ ...p, lead_id: "" })); }} className="text-red-500 hover:underline text-[10px]">Desvincular</button>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Hospital / Clínica *</label>
                    <input
                      type="text"
                      value={clienteData.datos_hospital}
                      onChange={e => setClienteData(p => ({ ...p, datos_hospital: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Contacto (Nombre) *</label>
                    <input
                      type="text"
                      value={clienteData.contacto_nombre}
                      onChange={e => setClienteData(p => ({ ...p, contacto_nombre: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Teléfono</label>
                    <input
                      type="text"
                      value={clienteData.telefono}
                      onChange={e => setClienteData(p => ({ ...p, telefono: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Correo</label>
                    <input
                      type="email"
                      value={clienteData.correo}
                      onChange={e => setClienteData(p => ({ ...p, correo: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Dirección completa</label>
                    <input
                      type="text"
                      value={clienteData.direccion}
                      onChange={e => setClienteData(p => ({ ...p, direccion: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Datos Fiscales (RFC, Razón Social)</label>
                    <textarea
                      rows={2}
                      value={clienteData.datos_fiscales}
                      onChange={e => setClienteData(p => ({ ...p, datos_fiscales: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 resize-none rounded-xl"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: EQUIPO */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setCollEquipo(!collEquipo)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100 text-[#1E293B]"
            >
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#4E60A9]">
                <Wrench size={13} />
                2. Especificaciones del Equipo
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${collEquipo ? "rotate-180" : ""}`} />
            </button>
            
            {!collEquipo && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Tipo de Equipo / Sonda *</label>
                    <input
                      type="text"
                      placeholder="Ej. Transductor Convex, Ultrasonido Portátil"
                      value={equipoData.equipo_tipo}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_tipo: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Marca</label>
                    <input
                      type="text"
                      placeholder="Ej. Mindray, SonoSite"
                      value={equipoData.equipo_marca}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_marca: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Modelo</label>
                    <input
                      type="text"
                      placeholder="Ej. M9, L38e"
                      value={equipoData.equipo_modelo}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_modelo: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Número de Serie</label>
                    <input
                      type="text"
                      value={equipoData.equipo_num_serie}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_num_serie: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Software / Versión</label>
                    <input
                      type="text"
                      value={equipoData.equipo_version}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_version: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Año Fab.</label>
                    <input
                      type="text"
                      value={equipoData.equipo_ano}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_ano: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Área Médica</label>
                    <input
                      type="text"
                      placeholder="Ej. Ginecología, Urgencias"
                      value={equipoData.equipo_area_medica}
                      onChange={e => setEquipoData(p => ({ ...p, equipo_area_medica: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Técnico Responsable</label>
                    <input
                      type="text"
                      value={equipoData.tecnico}
                      onChange={e => setEquipoData(p => ({ ...p, tecnico: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  
                  {/* Checklist Accesorios */}
                  <div className="col-span-2 mt-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-1.5 uppercase tracking-wider">Accesorios Recibidos</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ACCESORIOS_PRESET.map(acc => {
                        const isSelected = equipoData.accesorios.includes(acc);
                        return (
                          <label key={acc} className="flex items-center gap-2 cursor-pointer p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-slate-100 transition-colors text-[11px] font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleAccesorio(acc)}
                              className="accent-[#4E60A9]"
                            />
                            <span>{acc}</span>
                          </label>
                        );
                      })}
                    </div>
                    
                    <input
                      type="text"
                      placeholder="Otros accesorios (separados por comas)..."
                      value={equipoData.accesorios_manual}
                      onChange={e => setEquipoData(p => ({ ...p, accesorios_manual: e.target.value }))}
                      className="inp w-full text-[11px] py-1.5 px-2.5 mt-2.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: RECEPCIÓN Y FALLAS */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setCollRecepcion(!collRecepcion)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100 text-[#1E293B]"
            >
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#4E60A9]">
                <FileText size={13} />
                3. Detalles de Recepción
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${collRecepcion ? "rotate-180" : ""}`} />
            </button>
            
            {!collRecepcion && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Falla reportada *</label>
                    <textarea
                      rows={3}
                      placeholder="Falla o problema según reporta el cliente..."
                      value={recepcionData.falla_reportada}
                      onChange={e => setRecepcionData(p => ({ ...p, falla_reportada: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 resize-none rounded-xl"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Estado Físico / Estético visible</label>
                    <textarea
                      rows={2}
                      placeholder="Ej. Carcasa rayada, golpes en las esquinas, lente acústico sano"
                      value={recepcionData.condicion_recepcion}
                      onChange={e => setRecepcionData(p => ({ ...p, condicion_recepcion: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 resize-none rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Costo Diagnóstico ($)</label>
                    <input
                      type="number"
                      value={recepcionData.costo_diagnostico}
                      onChange={e => setRecepcionData(p => ({ ...p, costo_diagnostico: Number(e.target.value) }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 font-bold text-[#4E60A9]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Fecha Ingreso</label>
                    <input
                      type="date"
                      value={recepcionData.fecha_ingreso}
                      onChange={e => setRecepcionData(p => ({ ...p, fecha_ingreso: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 cursor-pointer font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Entrega Estimada</label>
                    <input
                      type="date"
                      value={recepcionData.fecha_compromiso}
                      onChange={e => setRecepcionData(p => ({ ...p, fecha_compromiso: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5 cursor-pointer font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Persona que entrega</label>
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={recepcionData.entregado_por}
                      onChange={e => setRecepcionData(p => ({ ...p, entregado_por: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-gray-400 block mb-0.5 uppercase tracking-wider">Persona que recibe (Bionordi)</label>
                    <input
                      type="text"
                      value={recepcionData.recibido_por}
                      onChange={e => setRecepcionData(p => ({ ...p, recibido_por: e.target.value }))}
                      className="inp w-full text-[12px] py-1.5 px-2.5"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 4: CLÁUSULAS */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setCollClausulas(!collClausulas)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100 text-[#1E293B]"
            >
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#4E60A9]">
                <FileText size={13} />
                4. Cláusulas de Recepción
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${collClausulas ? "rotate-180" : ""}`} />
            </button>
            
            {!collClausulas && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-wider">Términos y Políticas de Recepción</label>
                  <textarea
                    rows={8}
                    value={recepcionData.clausulas}
                    onChange={e => setRecepcionData(p => ({ ...p, clausulas: e.target.value }))}
                    className="w-full text-[11px] leading-relaxed bg-[#F8FAFC] border border-gray-200 rounded-xl p-3 outline-none focus:border-[#4E60A9]/40 resize-none font-sans"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECCIÓN 5: FIRMAS DIGITALES */}
          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <button
              onClick={() => setCollFirmas(!collFirmas)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-gray-100 text-[#1E293B]"
            >
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#4E60A9]">
                <User size={13} />
                5. Firmas Digitales
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${collFirmas ? "rotate-180" : ""}`} />
            </button>
            
            {!collFirmas && (
              <div className="p-4 space-y-4">
                {/* Firma del cliente */}
                <SignaturePad
                  label={`Firma de Entrega: ${recepcionData.entregado_por || 'Cliente'}`}
                  defaultValue={firmas.entrega}
                  onSave={b64 => setFirmas(p => ({ ...p, entrega: b64 }))}
                  onClear={() => setFirmas(p => ({ ...p, entrega: "" }))}
                />
                
                {/* Firma del tecnico */}
                <SignaturePad
                  label={`Firma de Recibe: ${recepcionData.recibido_por || 'Bionordi'}`}
                  defaultValue={firmas.recibe}
                  onSave={b64 => setFirmas(p => ({ ...p, recibe: b64 }))}
                  onClear={() => setFirmas(p => ({ ...p, recibe: "" }))}
                />
              </div>
            )}
          </div>

        </div>

        {/* Live Preview (Derecha) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-100 relative">
          {orderId ? (
            <div className="flex-1 w-full h-full relative">
              <iframe
                key={`${orderId}-${previewKey}`}
                src={`/api/pdf/recepcion?id=${orderId}&t=${Date.now()}`}
                className="w-full h-full border-none bg-slate-100"
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#94A3B8] gap-4">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-md">
                <FileText size={32} className="text-gray-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#1E293B] text-[16px]">Vista Previa Oficial del PDF</h3>
                <p className="text-[12px] text-gray-400 max-w-[280px] mx-auto mt-1">
                  Registra o guarda la recepción para generar y visualizar el documento PDF oficial en tiempo real.
                </p>
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-[#4E60A9] hover:bg-[#3B4F9A] px-5 py-2.5 rounded-xl transition-all shadow-md disabled:opacity-50 mt-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Registrar y Previsualizar
              </button>
            </div>
          )}
        </div>

      </div>

      {/* PDF Viewer Overlay Modal */}
      {showPdfModal && orderId && (
        <DocumentViewerModal
          title={`Hoja de Recepción — ${folio}`}
          url={`/api/pdf/recepcion?id=${orderId}`}
          downloadName={`Recepcion_${folio}.pdf`}
          onClose={() => setShowPdfModal(false)}
        />
      )}

    </div>
  );
}
