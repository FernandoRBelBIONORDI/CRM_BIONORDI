"use client";

import { useState, useEffect, useRef } from "react";
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
    title: "¡Te damos la bienvenida a Bionordi!",
    icon: BookOpen, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    instruction: "En este tutorial aprenderás el flujo operativo real de la clínica biomédica: Registrar un Lead, hacerle una Cotización formal y generar su Orden de Trabajo en el Taller. ¡Interactúa con la app real mientras te guiaemos!",
    position: "center",
  },
  {
    title: "Paso 1 — Abrir el CRM",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "El CRM es el módulo comercial donde administras los prospectos (leads) y realizas sus cotizaciones.",
    instruction: "Haz click en la tarjeta 'Ventas & CRM' en el panel o en 'CRM' en la barra lateral para continuar.",
    selector: '[data-tour="crm-card"]',
    position: "bottom",
    detect: (p) => p === "/crm",
    autoAdvance: true,
  },
  {
    title: "Paso 2 — Abrir Formulario de Lead",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Todo cliente nuevo comienza como un Lead. Es su ficha inicial de registro en Bionordi.",
    instruction: "Haz click en el botón '+ Nuevo Lead' para abrir el formulario de registro.",
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 3 — Registrar el Lead de prueba",
    icon: Database, iconColor: "#4E60A9", iconBg: "#EEF3FC",
    why: "Contar con los datos completos del prospecto te permitirá contactarlo fácilmente por WhatsApp o correo.",
    instruction: "Rellena los campos a mano. Copia y pega los datos sugeridos. Al terminar, haz click en 'Crear Lead' para guardarlo en la base de datos.",
    selector: '[data-tour="nuevo-lead-modal"]',
    position: "left",
    dataFields: [
      { label: "Nombre completo", value: "Dr. Juan García (Tutorial)" },
      { label: "Teléfono de contacto", value: "6641234567" },
      { label: "WhatsApp corporativo", value: "526641234567" },
      { label: "Correo electrónico", value: "juan.garcia@bionordi.mx" },
      { label: "Ciudad de residencia", value: "Tijuana" },
      { label: "Estado o provincia", value: "Baja California" },
      { label: "Especialidad / Nicho", value: "Cardiología" }
    ],
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]') && Array.from(document.querySelectorAll("div, td, span")).some(el => el.textContent && el.textContent.includes("Tutorial")),
    autoAdvance: false,
  },
  {
    title: "Paso 4 — Generar Cotización",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "La cotización es el presupuesto formal que se le envía al cliente antes de que envíe su equipo.",
    instruction: "Busca en la tabla al 'Dr. Juan García (Tutorial)' y haz click en el ícono de documento 📄 en su fila para cotizar.",
    selector: '[data-tour="tour-quote-btn"]',
    position: "left",
    detect: () => !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 5 — Completar la Cotización",
    icon: FileText, iconColor: "#059669", iconBg: "#ECFDF5",
    why: "Aquí especificas los detalles técnicos del transductor a reparar, la falla reportada y el costo del servicio.",
    instruction: "Ingresa los datos del equipo a mano. Copia los datos de prueba sugeridos abajo. Agrega el servicio a la tabla y haz click en 'Generar PDF'.",
    selector: '[data-tour="quote-modal"]',
    position: "left",
    dataFields: [
      { label: "Equipo", value: "Transductor Lineal" },
      { label: "Marca", value: "Mindray" },
      { label: "Modelo", value: "L14-6Ns" },
      { label: "No. serie", value: "MY-829281" },
      { label: "Falla reportada", value: "Líneas negras en imagen" },
      { label: "Servicio / Concepto", value: "Reparación de arreglo de cristales y reencapsulado" },
      { label: "Precio unitario", value: "6500" }
    ],
    detect: () => !!document.querySelector('[data-tour="doc-viewer-modal"]') || (!document.querySelector('[data-tour="quote-modal"]') && Array.from(document.querySelectorAll("div, span, td")).some(el => el.textContent && el.textContent.includes("6,500"))),
    autoAdvance: false,
  },
  {
    title: "Paso 6 — Abrir el Taller",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "Una vez aprobada la propuesta comercial, el equipo físico ingresa al taller para ser reparado.",
    instruction: "Cierra el visor de PDF y haz click en 'Servicios' (Taller) en el menú lateral para abrir el módulo técnico.",
    selector: '[data-tour="nav-taller"]',
    position: "right",
    detect: (p) => p === "/taller",
    autoAdvance: true,
  },
  {
    title: "Paso 7 — Nueva Orden de Trabajo",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "La Orden de Trabajo (OT) documenta el estado de entrada del equipo médico al laboratorio.",
    instruction: "Haz click en '+ Nueva Orden' para registrar la recepción del equipo en el taller.",
    selector: '[data-tour="tour-new-order-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: true,
  },
  {
    title: "Paso 8 — Vincular Cliente y Datos",
    icon: Wrench, iconColor: "#7C3AED", iconBg: "#F5F3FF",
    why: "Es crucial asociar la OT al Lead correcto para mantener todo su historial clínico y financiero unificado.",
    instruction: "Busca y vincula a 'Dr. Juan García (Tutorial)'. Escribe a mano los datos del transductor sugeridos y haz click en 'Guardar OT'.",
    selector: '[data-tour="tour-new-order-modal"]',
    position: "left",
    dataFields: [
      { label: "Vincular a lead", value: "Dr. Juan García (Tutorial)" },
      { label: "Marca del transductor", value: "Mindray" },
      { label: "Modelo del transductor", value: "L14-6Ns" },
      { label: "Número de serie", value: "MY-829281" },
      { label: "Falla a diagnosticar", value: "Líneas negras en imagen y reencapsulado" },
      { label: "Presupuesto aprobado", value: "6500" }
    ],
    detect: () => !document.querySelector('[data-tour="tour-new-order-modal"]') && Array.from(document.querySelectorAll("div, span, td")).some(el => el.textContent && el.textContent.includes("Tutorial")),
    autoAdvance: false,
  },
  {
    title: "¡Flujo operativo dominado!",
    icon: Sparkles, iconColor: "#059669", iconBg: "#ECFDF5",
    instruction: "¡Excelente trabajo! Has aprendido a llevar de la mano a un cliente en su ciclo completo de servicio. Presiona el botón de abajo para limpiar todos los datos de prueba creados.",
    position: "center",
  }
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
      setCleaned(false);
    } else if (!completed) {
      const t = setTimeout(() => { setActive(true); setStep(0); setCleaned(false); }, 2000);
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

  // Polling & Coords Updates (including resize/scroll handlers in capture mode)
  useEffect(() => {
    if (!active) return;

    let attempts = 0;
    let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelRef.current) return;
      const elapsed = Date.now() - stepStartRef.current;

      // Actualizar coordenadas del spotlight
      if (cur.selector) {
        let el = document.querySelector(cur.selector);
        // Fallback para crm-card si no está en DOM pero nav-crm sí
        if (!el && cur.selector === '[data-tour="crm-card"]') {
          el = document.querySelector('[data-tour="nav-crm"]');
        }
        if (el) {
          const r = el.getBoundingClientRect();
          setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
        } else if (attempts < 10) {
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
    window.addEventListener("scroll", tick, true); // capture inner scroll containers

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", tick);
      window.removeEventListener("scroll", tick, true);
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
