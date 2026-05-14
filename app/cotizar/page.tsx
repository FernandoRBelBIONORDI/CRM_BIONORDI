"use client";

import { useState } from "react";
import { Wrench, ShoppingBag, Stethoscope, Package, ArrowRight, CheckCircle2 } from "lucide-react";
import CotizacionManualModal from "@/components/CotizacionManualModal";

type TipoCotizacion = "reparacion" | "venta" | "mantenimiento" | "consumibles";

const TIPOS: {
  id: TipoCotizacion;
  label: string;
  sub: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  light: string;
  border: string;
  features: string[];
}[] = [
  {
    id: "reparacion",
    label: "Reparación",
    sub: "de Transductores",
    desc: "Propuesta técnica con alcance en párrafo y precio único al cliente.",
    icon: Wrench,
    color: "#4E60A9",
    light: "#EFF6FF",
    border: "#BFDBFE",
    features: ["Diagnóstico técnico", "Alcance en párrafo", "Evidencia fotográfica", "Garantía 6 meses"],
  },
  {
    id: "venta",
    label: "Venta",
    sub: "de Equipo Médico",
    desc: "Propuesta comercial con diagrama del equipo y especificaciones.",
    icon: ShoppingBag,
    color: "#6D28D9",
    light: "#F5F3FF",
    border: "#DDD6FE",
    features: ["Propuesta técnica", "Diagrama del equipo", "Especificaciones", "Precio desglosado"],
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    sub: "Preventivo / Correctivo",
    desc: "Contrato de servicio con puntos de inspección y alcance definido.",
    icon: Stethoscope,
    color: "#065F46",
    light: "#ECFDF5",
    border: "#A7F3D0",
    features: ["Inspección completa", "Limpieza y calibración", "Reporte técnico", "Garantía 3 meses"],
  },
  {
    id: "consumibles",
    label: "Consumibles",
    sub: "y Accesorios",
    desc: "Gel, fundas, papel térmico y accesorios con catálogo de precios.",
    icon: Package,
    color: "#92400E",
    light: "#FFFBEB",
    border: "#FDE68A",
    features: ["Gel conductor", "Fundas desechables", "Papel térmico", "Accesorios técnicos"],
  },
];

export default function CotizarPage() {
  const [modal, setModal] = useState<TipoCotizacion | null>(null);
  const [lastFolio, setLastFolio] = useState<string | null>(null);

  const handleSuccess = (folio: string) => {
    setLastFolio(folio);
    setTimeout(() => setLastFolio(null), 6000);
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F4F7FB]">

      {/* Header */}
      <div className="bg-white border-b border-[#E8EFF8] px-5 md:px-8 py-4 md:py-5 shrink-0">
        <h1 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight">Generador de Cotizaciones</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">Selecciona el tipo y genera un PDF profesional listo para enviar</p>
      </div>

      {/* Banner de éxito */}
      {lastFolio && (
        <div className="mx-4 md:mx-8 mt-4 flex items-center gap-3 bg-[#ECFDF5] border border-[#6EE7B7] rounded-xl px-4 py-3 shrink-0">
          <CheckCircle2 size={16} className="text-[#059669] shrink-0" />
          <span className="text-[12px] font-semibold text-[#065F46]">
            Cotización <span className="font-mono">{lastFolio}</span> generada correctamente
          </span>
        </div>
      )}

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5 md:py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-4xl md:mx-auto">
          {TIPOS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setModal(t.id)}
                className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 hover:-translate-y-1 flex flex-col overflow-hidden"
              >
                {/* Header de la card */}
                <div className="p-5 pb-4" style={{ background: t.light }}>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                    style={{ background: "white", border: `1.5px solid ${t.border}` }}
                  >
                    <Icon size={20} strokeWidth={1.8} style={{ color: t.color }} />
                  </div>
                  <div className="text-[16px] font-extrabold leading-tight" style={{ color: t.color }}>
                    {t.label}
                  </div>
                  <div className="text-[11px] font-medium mt-0.5" style={{ color: t.color, opacity: 0.6 }}>
                    {t.sub}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 pt-4 flex flex-col flex-1">
                  <p className="text-[11px] text-gray-500 leading-relaxed mb-4">{t.desc}</p>

                  <div className="space-y-2 flex-1">
                    {t.features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full shrink-0" style={{ background: t.color, opacity: 0.5 }} />
                        <span className="text-[10.5px] text-gray-500">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    className="mt-5 flex items-center justify-between text-[11px] font-bold pt-4 border-t"
                    style={{ borderColor: t.border, color: t.color }}
                  >
                    <span>Nueva cotización</span>
                    <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {modal && (
        <CotizacionManualModal
          initialTipo={modal}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
