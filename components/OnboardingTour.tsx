"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { X, ChevronRight, Copy, Check, BookOpen, Database, FileText, Wrench, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

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
    title: "¡Bienvenido al Tutorial de Bionordi!",
    icon: BookOpen, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    instruction: "Aprenderás el flujo operativo real: crear un Lead, generar una Cotización y registrar una Orden de Trabajo en el Taller. Interactuás directamente con la app mientras te guío.",
    position: "center",
  },
  {
    title: "Paso 1 — Abrir el CRM",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "El CRM es el módulo donde registrás tus clientes y generás sus cotizaciones.",
    instruction: "Hacé click en la tarjeta 'Ventas & CRM' del dashboard, o en 'CRM' en el menú lateral.",
    selector: '[data-tour="crm-card"]',
    position: "bottom",
    detect: (p) => p === "/crm",
    autoAdvance: true,
  },
  {
    title: "Paso 2 — Crear un nuevo Lead",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Todo cliente comienza como un Lead — su ficha de contacto en el sistema.",
    instruction: "Hacé click en el botón '+ Nuevo Lead' que está en la barra superior del CRM.",
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 3 — Completar el formulario",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Un expediente completo te permite contactar al cliente por WhatsApp, correo o teléfono.",
    instruction: "Copiá y pegá cada dato en el campo correspondiente del formulario. Cuando estén todos llenos, hacé click en 'Crear Lead'.",
    selector: '[data-tour="nuevo-lead-modal"]',
    position: "left",
    dataFields: [
      { label: "Nombre / Razón Social", value: "Dr. Juan García (Tutorial)" },
      { label: "Teléfono",              value: "6641234567" },
      { label: "WhatsApp",              value: "526641234567" },
      { label: "Correo electrónico",    value: "juan.garcia@bionordi.mx" },
      { label: "Ciudad",                value: "Tijuana" },
      // Estado y Nicho son selects — elegí "Baja California" y "Cardiología"
    ],
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: false,
  },
  {
    title: "Paso 4 — Abrir cotizador del Lead",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "La cotización es la propuesta formal que se envía al cliente antes de que lleve el equipo.",
    instruction: "Buscá a 'Dr. Juan García (Tutorial)' en la tabla y hacé click en el ícono de documento 📄 al final de su fila.",
    selector: '[data-tour="tour-quote-btn"]',
    position: "left",
    detect: () => !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 5 — Completar la Cotización",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "Al generar el PDF queda registrada la propuesta en el historial del cliente.",
    instruction: "1) Seleccioná 'Lineal' en el dropdown 'Tipo de transductor'. 2) Completá Marca, Modelo, No. de Serie y Falla. 3) Marcá el checkbox de 'Reparación transductor lineal' en la lista. 4) Hacé click en 'Generar PDF'.",
    selector: '[data-tour="quote-modal"]',
    position: "left",
    dataFields: [
      { label: "Marca",          value: "Mindray" },
      { label: "Modelo",         value: "L14-6Ns" },
      { label: "No. de Serie",   value: "MY-829281" },
      { label: "Falla reportada",value: "Líneas negras en imagen" },
    ],
    detect: () => !document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: false,
  },
  {
    title: "Paso 6 — Ir al Taller",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "El cliente aprobó la cotización y trajo el equipo al laboratorio.",
    instruction: "Cerrá el visor de PDF si está abierto y hacé click en 'Servicios' en el menú lateral para abrir el Taller.",
    selector: '[data-tour="nav-taller"]',
    position: "right",
    detect: (p) => p === "/taller",
    autoAdvance: true,
  },
  {
    title: "Paso 7 — Nueva Orden de Trabajo",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "La OT documenta el ingreso físico del equipo y asigna al técnico responsable.",
    instruction: "Hacé click en el botón 'Nueva Orden' para registrar la entrada del equipo al taller.",
    selector: '[data-tour="tour-new-order-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 8 — Completar la Orden de Trabajo",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "Los datos del equipo y el técnico asignado quedan en el historial para trazabilidad.",
    instruction: "Buscá y vinculá a 'Dr. Juan García (Tutorial)'. Completá los campos del equipo y asigná un técnico. Hacé click en 'Guardar OT'.",
    selector: '[data-tour="tour-new-order-modal"]',
    position: "left",
    dataFields: [
      { label: "Tipo de transductor", value: "Transductor Lineal" },
      { label: "Marca",               value: "Mindray" },
      { label: "Modelo",              value: "L14-6Ns" },
      { label: "No. serie",           value: "MY-829281" },
      { label: "Técnico",             value: "Ing. Residente" },
      { label: "Falla reportada",     value: "Líneas negras en imagen" },
    ],
    detect: () => !document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: false,
  },
  {
    title: "¡Flujo completo dominado!",
    icon: Sparkles, iconColor: "#059669", iconBg: "#ECFDF5",
    instruction: "Aprendiste el ciclo completo: Lead → Cotización → Orden de Servicio. El sistema registra todo el historial automáticamente. Podés limpiar los datos de prueba con el botón de abajo.",
    position: "center",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  const [active, setActive]       = useState(false);
  const [step, setStep]           = useState(0);
  const [coords, setCoords]       = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [ready, setReady]         = useState(false);
  const [copied, setCopied]       = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaned, setCleaned]     = useState(false);

  const cur = STEPS[step]; // derivado del estado, disponible en el render

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
      setCleaned(false);
    } else if (!completed) {
      const t = setTimeout(() => { setActive(true); setStep(0); setCleaned(false); }, 2000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // Polling: spotlight + detección de completitud del paso
  useEffect(() => {
    if (!active) return;

    const cur       = STEPS[step];
    const stepStart = Date.now();
    let findAttempts = 0;
    let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

    setReady(false);
    setCoords(null);

    // Devuelve el primer elemento VISIBLE que coincide con el selector
    const findVisible = (selector: string): Element | null => {
      const els = Array.from(document.querySelectorAll(selector));
      return els.find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? null;
    };

    const tick = () => {
      // ── Coordenadas del spotlight ─────────────────────────────────────────
      if (cur.selector) {
        const el = findVisible(cur.selector)
          // fallback: si crm-card no está en pantalla (usuario ya en /crm), usar nav-crm
          ?? (cur.selector === '[data-tour="crm-card"]' ? findVisible('[data-tour="nav-crm"]') : null);

        if (el) {
          findAttempts = 0;
          const r = el.getBoundingClientRect();
          setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
        } else if (findAttempts < 20) {
          findAttempts++;
        } else {
          setCoords(null);
        }
      }

      // ── Detección (mínimo 800ms para evitar falsos positivos en auto-avance) ──
      if (!autoAdvanceTimer && cur.detect && Date.now() - stepStart > 800) {
        if (cur.detect(pathname)) {
          setReady(true);
          if (cur.autoAdvance) {
            autoAdvanceTimer = setTimeout(() => setStep(s => s + 1), 700);
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
  }, [active, step, pathname]); // cur se deriva de step — no necesita ser dep

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

  const cleanupData = async () => {
    setIsCleaning(true);
    try {
      // Busca por nombre para no depender del límite de paginación
      const res = await fetch("/api/leads?q=Tutorial&limit=100");
      const data = await res.json();
      if (data.leads && Array.isArray(data.leads)) {
        const tutorialLeads = data.leads.filter((l: any) =>
          l.nombre.includes("Tutorial") || l.nombre.includes("(Prueba)")
        );
        for (const lead of tutorialLeads) {
          await fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: lead.id }),
          });
        }
      }
      setCleaned(true);
      setTimeout(() => { close(); }, 2000);
    } catch (err) {
      console.error("Error cleaning up tutorial data:", err);
    } finally {
      setIsCleaning(false);
    }
  };

  // ─── Posición del card ─────────────────────────────────────────────────────
  const cardStyle = (): React.CSSProperties => {
    if (typeof window === "undefined") return {};
    const isMobile = window.innerWidth < 768;

    if (isMobile || !coords || cur.position === "center") {
      return {
        position: "fixed",
        bottom: isMobile ? "12px" : "50%",
        left:   isMobile ? "12px" : "50%",
        right:  isMobile ? "12px" : "auto",
        transform: isMobile ? "none" : "translate(-50%, 50%)",
        width:  isMobile ? "calc(100% - 24px)" : "380px",
        zIndex: 9999,
        pointerEvents: "auto",
      };
    }

    const { top, left, width, height } = coords;
    const gap = 16;
    const w   = 380;
    const vw  = window.innerWidth;
    const vh  = window.innerHeight;

    switch (cur.position) {
      case "right":
        return { position: "fixed", top: `${Math.min(top, vh - 480)}px`, left: `${left + width + gap}px`, width: `${w}px`, zIndex: 9999, pointerEvents: "auto" };
      case "left":
        return { position: "fixed", top: `${Math.min(top, vh - 480)}px`, left: `${Math.max(8, left - w - gap)}px`, width: `${w}px`, zIndex: 9999, pointerEvents: "auto" };
      case "top":
        return { position: "fixed", bottom: `${vh - top + gap}px`, left: `${Math.min(Math.max(8, left + width / 2 - w / 2), vw - w - 8)}px`, width: `${w}px`, zIndex: 9999, pointerEvents: "auto" };
      case "bottom":
      default:
        return { position: "fixed", top: `${top + height + gap}px`, left: `${Math.min(Math.max(8, left + width / 2 - w / 2), vw - w - 8)}px`, width: `${w}px`, zIndex: 9999, pointerEvents: "auto" };
    }
  };

  const StepIcon = cur.icon;
  const isLast   = step === STEPS.length - 1;
  const canNext  = !cur.detect || ready;

  return (
    <>
      {/* Spotlight: visual only — NO bloquea clicks en el fondo */}
      {coords && (
        <div
          style={{
            position: "fixed",
            top:    `${coords.top - 6}px`,
            left:   `${coords.left - 6}px`,
            width:  `${coords.width + 12}px`,
            height: `${coords.height + 12}px`,
            borderRadius: 18,
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
            border: `2px solid ${cur.iconColor}`,
            pointerEvents: "none",
            zIndex: 9990,
            transition: "all 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      )}

      {/* Fondo tenue cuando no hay spotlight (paso central) */}
      {!coords && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.40)", pointerEvents: "none", zIndex: 9989 }} />
      )}

      {/* Card del tutorial */}
      <div
        className="bg-white rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.18)] border border-slate-100 flex flex-col overflow-hidden animate-fade-in"
        style={cardStyle()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3.5 flex items-center justify-between border-b border-gray-50 shrink-0">
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
        <div className="px-5 py-4 space-y-3.5 flex-1 overflow-y-auto max-h-[360px] md:max-h-[440px]">
          {/* ¿Por qué? */}
          {cur.why && (
            <div className="flex gap-2 items-start bg-[#F8FAFF] rounded-xl p-3 border border-[#E8EFF8]">
              <span className="text-[14px] shrink-0 mt-0.5">💡</span>
              <p className="text-[11.5px] text-[#475569] font-medium leading-relaxed">{cur.why}</p>
            </div>
          )}

          {/* Instrucción */}
          <div className="flex gap-2 items-start">
            <span className="text-[14px] shrink-0 mt-0.5">🛠️</span>
            <p className="text-[12.5px] text-[#1E293B] font-semibold leading-relaxed">{cur.instruction}</p>
          </div>

          {/* Datos sugeridos */}
          {cur.dataFields && (
            <div className="space-y-1.5 mt-1.5">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8] mb-1">
                Datos de prueba — Haz click para copiar:
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {cur.dataFields.map(f => (
                  <button
                    key={f.label}
                    onClick={() => copyField(f.value)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#F8FAFF] border border-[#E8EFF8] hover:border-[#4E60A9]/30 hover:bg-[#EEF3FC] transition-all group"
                  >
                    <div className="text-left min-w-0 flex-1 mr-2">
                      <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#94A3B8] group-hover:text-[#4E60A9]">
                        {f.label}
                      </div>
                      <div className="text-[12px] font-bold text-[#1E293B] font-mono truncate">
                        {f.value}
                      </div>
                    </div>
                    {copied === f.value ? (
                      <div className="flex items-center gap-1 shrink-0 text-[#059669]">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider">¡Copiado!</span>
                        <Check size={13} strokeWidth={3} />
                      </div>
                    ) : (
                      <Copy size={12} className="text-[#CBD5E1] group-hover:text-[#4E60A9] shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Indicador de espera */}
          {cur.detect && !ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] font-medium bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
              <div className="w-2 h-2 rounded-full bg-[#94A3B8] animate-pulse shrink-0" />
              Esperando a que completes la acción en la app...
            </div>
          )}

          {/* Confirmación cuando detección disparó */}
          {ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2 text-[11.5px] text-[#059669] font-bold bg-[#ECFDF5] rounded-xl px-3 py-2 border border-green-100">
              <CheckCircle2 size={13} className="shrink-0" />
              ¡Acción completada con éxito!
            </div>
          )}

          {/* Limpieza final */}
          {isLast && (
            <div className="pt-2">
              {cleaned ? (
                <div className="flex items-center justify-center gap-2 text-[12px] font-bold text-[#059669] bg-[#ECFDF5] border border-green-200 rounded-xl p-3.5 animate-fade-in">
                  <CheckCircle2 size={15} />
                  ¡Datos de prueba limpiados exitosamente!
                </div>
              ) : (
                <button
                  onClick={cleanupData}
                  disabled={isCleaning}
                  className="w-full h-11 bg-gradient-to-r from-[#4E60A9] to-[#7C3AED] hover:from-[#3D4F99] hover:to-[#6D28D9] text-white rounded-xl font-bold text-[12.5px] flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isCleaning ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Limpiando base de datos...
                    </>
                  ) : (
                    <>Limpiar Datos de Prueba ✨</>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 flex items-center justify-between border-t border-gray-50 shrink-0">
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
            disabled={!canNext || isCleaning}
            className="h-[36px] px-5 rounded-xl text-white text-[12px] font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: canNext ? cur.iconColor : "#94A3B8" }}
          >
            {isLast ? (
              <><CheckCircle2 size={13} strokeWidth={2.5} /> Salir</>
            ) : (
              <>Siguiente <ChevronRight size={13} strokeWidth={2.5} /></>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
