"use client";

import { useRouter } from "next/navigation";
import { Wrench, ShoppingBag, Stethoscope, Package, ArrowRight } from "lucide-react";
import { COTIZACION_TIPO } from "@/lib/estados";

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
    features: ["Diagnóstico técnico", "Alcance en párrafo", "Evidencia fotográfica", "Garantía 12 meses"],
  },
  {
    id: "venta",
    label: "Venta",
    sub: "de Equipo Médico",
    desc: "Propuesta comercial con diagrama del equipo y especificaciones.",
    icon: ShoppingBag,
    color: COTIZACION_TIPO.venta.color,
    light: COTIZACION_TIPO.venta.bg,
    border: "#DDD6FE",
    features: ["Propuesta técnica", "Diagrama del equipo", "Especificaciones", "Precio desglosado"],
  },
  {
    id: "mantenimiento",
    label: "Mantenimiento",
    sub: "Preventivo / Correctivo",
    desc: "Contrato de servicio con puntos de inspección y alcance definido.",
    icon: Stethoscope,
    color: COTIZACION_TIPO.mantenimiento.color,
    light: COTIZACION_TIPO.mantenimiento.bg,
    border: "#A7F3D0",
    features: ["Inspección completa", "Limpieza y calibración", "Reporte técnico", "Garantía 3 meses"],
  },
  {
    id: "consumibles",
    label: "Consumibles",
    sub: "y Accesorios",
    desc: "Gel, fundas, papel térmico y accesorios con catálogo de precios.",
    icon: Package,
    color: COTIZACION_TIPO.consumibles.color,
    light: COTIZACION_TIPO.consumibles.bg,
    border: "#FDE68A",
    features: ["Gel conductor", "Fundas desechables", "Papel térmico", "Accesorios técnicos"],
  },
];

export default function CotizarPage() {
  const router = useRouter();

  const handleTipo = (id: TipoCotizacion) => {
    router.push(`/cotizar/${id}`);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F7FB]">

      {/* Header */}
      <div className="bg-white border-b border-[#E8EFF8] px-5 md:px-8 py-4 md:py-5 shrink-0">
        <h1 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight">Generador de Cotizaciones</h1>
        <p className="text-[11px] text-gray-400 mt-0.5">Selecciona el tipo y genera un PDF profesional listo para enviar</p>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 md:px-8 py-5 md:py-8 md:flex md:items-center md:justify-center">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-4xl">
          {TIPOS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => handleTipo(t.id)}
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

    </div>
  );
}
