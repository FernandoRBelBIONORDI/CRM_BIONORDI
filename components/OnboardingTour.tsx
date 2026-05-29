"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { X, ChevronRight, Copy, Check, BookOpen, Database, FileText, Wrench, Sparkles, CheckCircle2 } from "lucide-react";

// ─── Datos sugeridos para el Lead de prueba ───────────────────────────────────
const LEAD_SUGERIDO = [
  { label: "Nombre",   value: "Dr. Juan García (Prueba)" },
  { label: "Teléfono", value: "6641234567" },
  { label: "WhatsApp", value: "526641234567" },
  { label: "Correo",   value: "ventas@bionordi.mx" },
  { label: "Ciudad",   value: "Tijuana" },
  { label: "Estado",   value: "Baja California" },
  { label: "Nicho",    value: "Cardiología" },
];

// ─── Definición de pasos ──────────────────────────────────────────────────────
type StepDef = {
  title: string;
  icon: any;
  iconColor: string;
  iconBg: string;
  why?: string;
  instruction: string;
  selector?: string;
  position?: "bottom" | "top" | "left" | "right" | "center";
  dataFields?: { label: string; value: string }[];
  detect?: (pathname: string) => boolean;
  autoAdvance?: boolean;
};

const STEPS: StepDef[] = [
  {
    title: "Tutorial: flujo completo de Bionordi",
    icon: BookOpen, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    instruction: "Vas a crear un Lead real, generarle una Cotización y registrar una Orden de Trabajo en el Taller — todo vos mismo, paso a paso en la app.",
    position: "center",
  },
  {
    title: "Paso 1 — Abrir el CRM",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "El CRM es donde registrás todos tus clientes y prospectos.",
    instruction: 'Hacé click en la tarjeta "Ventas & CRM" del dashboard para abrir el módulo de clientes.',
    selector: '[data-tour="crm-card"]',
    position: "bottom",
    detect: (p) => p === "/crm",
    autoAdvance: true,
  },
  {
    title: "Paso 2 — Crear un Lead",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Cada cliente comienza como un Lead — su expediente en el sistema.",
    instruction: 'Hacé click en el botón "+ Nuevo Lead" para registrar tu primer cliente.',
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 3 — Completar los datos",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Un expediente completo te permite personalizar la propuesta comercial.",
    instruction: 'Copiá estos datos en el formulario, llenando cada campo. Cuando termines hacé click en "Crear Lead".',
    selector: '[data-tour="nuevo-lead-modal"]',
    position: "left",
    dataFields: LEAD_SUGERIDO,
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: false,
  },
  {
    title: "Paso 4 — Generar Cotización",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "La cotización es la propuesta formal que le enviás al cliente antes de iniciar el servicio.",
    instruction: 'En la tabla del CRM buscá a "Dr. Juan García (Prueba)" y hacé click en el ícono de documento 📄 al final de su fila.',
    selector: '[data-tour="tour-quote-btn"]',
    position: "left",
    detect: () => !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 5 — Completar la Cotización",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "Al generar el PDF queda registrada la propuesta en el historial del cliente.",
    instruction: 'Seleccioná el tipo de servicio, completá los datos del equipo y hacé click en "Generar PDF".',
    selector: '[data-tour="quote-modal"]',
    position: "left",
    detect: () => !document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: false,
  },
  {
    title: "Paso 6 — Ir al Taller",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "El cliente aprobó la cotización y trajo el equipo. Ahora lo registrás en el Taller.",
    instruction: 'Hacé click en "Servicios" en el menú lateral para abrir el módulo de Taller.',
    selector: '[data-tour="nav-taller"]',
    position: "right",
    detect: (p) => p === "/taller",
    autoAdvance: true,
  },
  {
    title: "Paso 7 — Nueva Orden de Trabajo",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "La OT documenta la entrada del equipo al laboratorio y asigna responsabilidades.",
    instruction: 'Hacé click en "Nueva Orden" para registrar el equipo que ingresó al taller.',
    selector: '[data-tour="tour-new-order-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 8 — Completar la Orden",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "Los datos completos de la OT permiten dar seguimiento técnico y fijar fechas de entrega.",
    instruction: 'Vinculá el Lead, completá los datos del equipo, asigná un técnico y hacé click en "Guardar OT".',
    selector: '[data-tour="tour-new-order-modal"]',
    position: "left",
    detect: () => !document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: false,
  },
  {
    title: "¡Flujo completo dominado!",
    icon: Sparkles, iconColor: "#059669", iconBg: "#ECFDF5",
    instruction: "Repetí este ciclo con cada cliente real: Lead → Cotización → Orden de Servicio. El sistema registra todo el historial automáticamente.",
    position: "center",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [coords, setCoords]   = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [ready, setReady]     = useState(false);   // detección completada
  const [copied, setCopied]   = useState<string | null>(null);

  const stepStartRef = useRef<number>(Date.now());
  const cancelRef    = useRef(false);

  const cur = STEPS[step];

  // Activar vía ?runTour=true o automáticamente en usuarios nuevos
  useEffect(() => {
    const runParam  = searchParams.get("runTour");
    const completed = localStorage.getItem("bionordi-tour-completed");

    if (runParam === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("runTour");
      window.history.replaceState({}, "", url.toString());
      setActive(true);
      setStep(0);
    } else if (!completed) {
      const t = setTimeout(() => { setActive(true); setStep(0); }, 2000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // Reiniciar estado cuando cambia el paso
  useEffect(() => {
    setReady(false);
    stepStartRef.current = Date.now();
    cancelRef.current = false;
    return () => { cancelRef.current = true; };
  }, [step]);

  // Polling: buscar elemento + detectar completitud del paso
  useEffect(() => {
    if (!active) return;

    let attempts = 0;
    let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelRef.current) return;
      const elapsed = Date.now() - stepStartRef.current;

      // Actualizar coordenadas del spotlight
      if (cur.selector) {
        const el = document.querySelector(cur.selector);
        if (el) {
          const r = el.getBoundingClientRect();
          setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else if (attempts < 30) {
          attempts++;
        } else {
          setCoords(null);
        }
      } else {
        setCoords(null);
      }

      // Detección de completitud (mínimo 500ms en el paso para evitar falsos positivos)
      if (elapsed > 500 && cur.detect) {
        const done = cur.detect(pathname);
        if (done) {
          setReady(true);
          if (cur.autoAdvance && !autoAdvanceTimer) {
            autoAdvanceTimer = setTimeout(() => {
              if (!cancelRef.current) setStep(s => s + 1);
            }, 600);
          }
        }
      }
    };

    tick();
    const interval = setInterval(tick, 300);
    window.addEventListener("resize", tick);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", tick);
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    };
  }, [active, step, pathname, cur]);

  if (!active) return null;

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else close();
  };

  const close = () => {
    localStorage.setItem("bionordi-tour-completed", "true");
    setActive(false);
  };

  const copyField = (value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(value);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  // ─── Posición del card ─────────────────────────────────────────────────────
  const cardStyle = (): React.CSSProperties => {
    const isMobile = window.innerWidth < 768;

    if (isMobile || !coords || cur.position === "center") {
      return {
        position: "fixed",
        bottom: isMobile ? "12px" : "50%",
        left:   isMobile ? "12px" : "50%",
        right:  isMobile ? "12px" : "auto",
        transform: isMobile ? "none" : "translate(-50%, 50%)",
        width:  isMobile ? "calc(100% - 24px)" : "360px",
        zIndex: 9999,
      };
    }

    const { top, left, width, height } = coords;
    const gap = 16;
    const w   = 360;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    switch (cur.position) {
      case "right":
        return { position: "fixed", top: `${Math.min(top, vh - 480)}px`, left: `${left + width + gap}px`, width: `${w}px`, zIndex: 9999 };
      case "left":
        return { position: "fixed", top: `${Math.min(top, vh - 480)}px`, left: `${Math.max(8, left - w - gap)}px`, width: `${w}px`, zIndex: 9999 };
      case "top":
        return { position: "fixed", bottom: `${vh - top + gap}px`, left: `${Math.min(Math.max(8, left + width / 2 - w / 2), vw - w - 8)}px`, width: `${w}px`, zIndex: 9999 };
      case "bottom":
      default:
        return { position: "fixed", top: `${top + height + gap}px`, left: `${Math.min(Math.max(8, left + width / 2 - w / 2), vw - w - 8)}px`, width: `${w}px`, zIndex: 9999 };
    }
  };

  const StepIcon = cur.icon;
  const isLast   = step === STEPS.length - 1;
  const canNext  = !cur.detect || ready;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spotlight: visual only — NO bloquea clicks */}
      {coords && (
        <div
          style={{
            position: "fixed",
            top:    `${coords.top - 6}px`,
            left:   `${coords.left - 6}px`,
            width:  `${coords.width + 12}px`,
            height: `${coords.height + 12}px`,
            borderRadius: 18,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.50)",
            border: `2px solid ${cur.iconColor}`,
            pointerEvents: "none",
            zIndex: 9990,
            transition: "all 0.25s ease",
          }}
        />
      )}

      {/* Fondo tenue cuando no hay spotlight (paso sin selector) */}
      {!coords && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.40)", pointerEvents: "none", zIndex: 9989 }} />
      )}

      {/* Card del tutorial */}
      <div
        className="bg-white rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.18)] border border-slate-100 flex flex-col overflow-hidden"
        style={cardStyle()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3.5 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] flex items-center justify-center shrink-0" style={{ backgroundColor: cur.iconBg }}>
              <StepIcon size={17} strokeWidth={2.5} style={{ color: cur.iconColor }} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8]">
                {step === 0 ? "Inicio" : step === STEPS.length - 1 ? "Completado" : `Paso ${step} de ${STEPS.length - 2}`}
              </div>
              <h2 className="text-[14px] font-extrabold text-[#1E293B] leading-tight tracking-tight">
                {cur.title}
              </h2>
            </div>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 rounded-full bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center shrink-0"
            title="Cerrar tutorial"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-5 py-4 space-y-3 flex-1">
          {/* ¿Por qué? */}
          {cur.why && (
            <div className="flex gap-2 items-start bg-[#F8FAFF] rounded-xl p-3 border border-[#E8EFF8]">
              <span className="text-[14px] shrink-0 mt-px">💡</span>
              <p className="text-[11.5px] text-[#475569] font-medium leading-relaxed">{cur.why}</p>
            </div>
          )}

          {/* Instrucción */}
          <div className="flex gap-2 items-start">
            <span className="text-[14px] shrink-0 mt-px">🛠️</span>
            <p className="text-[12.5px] text-[#1E293B] font-semibold leading-relaxed">{cur.instruction}</p>
          </div>

          {/* Datos sugeridos */}
          {cur.dataFields && (
            <div className="space-y-1.5 mt-1">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">Datos a ingresar — hacé click para copiar</p>
              {cur.dataFields.map(f => (
                <button
                  key={f.label}
                  onClick={() => copyField(f.value)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#F8FAFF] border border-[#E8EFF8] hover:border-[#4E60A9]/30 hover:bg-[#EEF3FC] transition-all group"
                >
                  <div className="text-left">
                    <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#94A3B8] group-hover:text-[#4E60A9]">{f.label}</div>
                    <div className="text-[12px] font-bold text-[#1E293B] font-mono">{f.value}</div>
                  </div>
                  {copied === f.value
                    ? <Check size={13} className="text-[#059669] shrink-0" />
                    : <Copy size={12} className="text-[#CBD5E1] group-hover:text-[#4E60A9] shrink-0" />
                  }
                </button>
              ))}
            </div>
          )}

          {/* Indicador de espera */}
          {cur.detect && !ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] font-medium">
              <div className="w-2 h-2 rounded-full bg-[#94A3B8] animate-pulse" />
              Esperando que completes la acción...
            </div>
          )}

          {/* Confirmación cuando detección disparó */}
          {ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2 text-[11px] text-[#059669] font-bold bg-[#ECFDF5] rounded-xl px-3 py-2 border border-green-100">
              <CheckCircle2 size={13} className="shrink-0" />
              ¡Acción completada! Hacé click en Siguiente para continuar.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-gray-50">
          {/* Dots de progreso */}
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-200"
                style={{
                  width: i === step ? 16 : 6,
                  height: 6,
                  backgroundColor: i === step ? cur.iconColor : i < step ? "#CBD5E1" : "#E2E8F0",
                }}
              />
            ))}
          </div>

          <button
            onClick={isLast ? close : next}
            disabled={!canNext}
            className="h-[36px] px-5 rounded-xl text-white text-[12px] font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: canNext ? cur.iconColor : "#94A3B8" }}
          >
            {isLast ? (
              <><CheckCircle2 size={13} strokeWidth={2.5} /> Finalizar</>
            ) : (
              <>Siguiente <ChevronRight size={13} strokeWidth={2.5} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
