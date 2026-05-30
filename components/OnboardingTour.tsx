"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  X, Copy, Check, BookOpen,
  Database, FileText, Wrench, Sparkles, CheckCircle2,
  Loader2, ArrowRight, MousePointerClick,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type StepDef = {
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  bg: string;
  why: string;
  steps: string[];
  saveHint?: string;           // Muestra el botón exacto a presionar para guardar
  selector?: string;
  position?: "bottom" | "top" | "left" | "right" | "center";
  fields?: { label: string; value: string }[];
  detect?: (pathname: string) => boolean;
  autoAdvance?: boolean;
};

// ─── Pasos ────────────────────────────────────────────────────────────────────
const STEPS: StepDef[] = [
  /* 0 */ {
    title: "Tutorial Bionordi CRM",
    subtitle: "Flujo operativo completo",
    icon: BookOpen, color: "#4E60A9", bg: "#EEF3FC",
    why: "Vas a recorrer el ciclo completo de un cliente: registrarlo como Lead, generarle una Cotización y abrir una Orden de Trabajo en el Taller.",
    steps: [
      "Interactuás directamente con la app real mientras te guío paso a paso.",
      "Cada paso muestra exactamente qué hacer, dónde hacer click y qué datos ingresar.",
      "Al terminar podés borrar los datos de prueba con un click.",
    ],
    position: "center",
  },
  /* 1 */ {
    title: "Abrir el CRM",
    subtitle: "Paso 1 de 9",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "El CRM (Customer Relationship Manager) es donde registrás y seguís todos tus prospectos y clientes.",
    steps: [
      "Hacé click en la tarjeta azul 'Ventas & CRM' del panel principal.",
      "El tutorial avanza automáticamente en cuanto llegás al CRM.",
    ],
    selector: '[data-tour="crm-card"]',
    position: "bottom",
    detect: (p) => p === "/crm",
    autoAdvance: true,
  },
  /* 2 */ {
    title: "Crear un nuevo Lead",
    subtitle: "Paso 2 de 9",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Un Lead es el expediente inicial de un prospecto. Sin este registro, no podés cotizar ni generar órdenes.",
    steps: [
      "Buscá el botón azul '+ Nuevo Lead' en la barra superior del CRM.",
      "Hacé click. El formulario se abre solo.",
    ],
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  /* 3 */ {
    title: "Completar datos del Lead",
    subtitle: "Paso 3 de 9",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Un expediente completo te permite contactar al cliente por WhatsApp, correo o llamada directamente desde el sistema.",
    steps: [
      "Hacé click en cada campo de la tabla de abajo para copiar el dato.",
      "Pegalo en el campo correspondiente del formulario.",
      "Para 'Estado' elegí 'Baja California' del selector.",
      "Para 'Nicho' dejá 'Cardiología' que ya viene seleccionado.",
    ],
    saveHint: "Cuando estén todos los campos completos → hacé click en el botón azul 'Crear Lead' al pie del formulario.",
    selector: '[data-tour="nuevo-lead-modal"]',
    position: "left",
    fields: [
      { label: "Nombre / Razón Social", value: "Dr. Juan García (Tutorial)" },
      { label: "Teléfono",              value: "6641234567" },
      { label: "WhatsApp",              value: "526641234567" },
      { label: "Correo electrónico",    value: "juan.garcia@bionordi.mx" },
      { label: "Ciudad",                value: "Tijuana" },
    ],
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: false,
  },
  /* 4 */ {
    title: "Abrir el cotizador",
    subtitle: "Paso 4 de 9",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "La cotización es el presupuesto formal que recibe el cliente antes de entregar el equipo.",
    steps: [
      "En la tabla del CRM buscá la fila de 'Dr. Juan García (Tutorial)'.",
      "Al final de esa fila hacé click en el ícono de documento 📄.",
      "Se abre el cotizador con los datos del cliente ya cargados.",
    ],
    selector: '[data-tour="tour-quote-btn"]',
    position: "left",
    detect: () => !!document.querySelector('[data-tour="cot-modal-open"]'),
    autoAdvance: true,
  },
  /* 5 */ {
    title: "Completar la Cotización",
    subtitle: "Paso 5 de 9",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Los datos técnicos del equipo quedan registrados en la cotización y en el historial del cliente.",
    steps: [
      "Verificá que el tipo sea 'Reparación' (viene seleccionado por defecto).",
      "En la sección de servicios, marcá el servicio correspondiente.",
      "Si querés podés agregar notas adicionales sobre el equipo.",
    ],
    saveHint: "Cuando hayas elegido el servicio → hacé click en 'Generar PDF · Reparación'. El modal se cierra solo y el tutorial avanza.",
    position: "center",
    detect: () => !document.querySelector('[data-tour="cot-modal-open"]'),
    autoAdvance: false,
  },
  /* 6 */ {
    title: "Ir al Taller",
    subtitle: "Paso 6 de 9",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "El cliente aprobó la cotización y trae físicamente el equipo al laboratorio. Ahora hay que registrar su entrada.",
    steps: [
      "Cerrá el visor de PDF si está abierto (click en la X).",
      "En el menú lateral, hacé click en 'Servicios' (ícono de llave inglesa 🔧).",
      "El tutorial avanza solo cuando llegás al Taller.",
    ],
    selector: '[data-tour="nav-taller"]',
    position: "right",
    detect: (p) => p === "/taller",
    autoAdvance: true,
  },
  /* 7 */ {
    title: "Nueva Orden de Trabajo",
    subtitle: "Paso 7 de 9",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "La OT (Orden de Trabajo) es el documento interno que registra el equipo recibido, el técnico asignado y la fecha de entrega.",
    steps: [
      "En la barra superior del Taller, hacé click en el botón 'Nueva Orden'.",
      "El formulario se abre automáticamente.",
    ],
    selector: '[data-tour="tour-new-order-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="tour-new-order-modal"]'),
    autoAdvance: true,
  },
  /* 8 */ {
    title: "Completar la Orden de Trabajo",
    subtitle: "Paso 8 de 9",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "Los datos completos de la OT permiten trazabilidad técnica: saber quién repara qué, cuándo entra y cuándo se entrega.",
    steps: [
      "En 'Vincular a lead': escribí 'Juan García' y seleccioná el resultado.",
      "En el campo 'Tipo de transductor *': ingresá el tipo del equipo.",
      "Completá Marca, Modelo y No. de serie con los datos de abajo.",
      "Asigná un técnico en el campo 'Técnico'.",
      "En 'Falla reportada': describí el problema.",
    ],
    saveHint: "Cuando estén todos los campos → hacé click en el botón azul 'Guardar OT' al pie del formulario.",
    selector: '[data-tour="tour-new-order-modal"]',
    position: "left",
    fields: [
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
  /* 9 */ {
    title: "¡Flujo completado!",
    subtitle: "Tutorial finalizado",
    icon: Sparkles, color: "#059669", bg: "#ECFDF5",
    why: "Dominaste el ciclo operativo completo de Bionordi CRM. Repetí este flujo con cada cliente real.",
    steps: [
      "✅ Lead registrado en el CRM.",
      "✅ Cotización de reparación generada en PDF.",
      "✅ Orden de Trabajo creada en el Taller.",
    ],
    saveHint: "Podés limpiar los datos de prueba con el botón de abajo para que no afecten tus métricas.",
    position: "center",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [active,     setActive]     = useState(false);
  const [step,       setStep]       = useState(0);
  const [coords,     setCoords]     = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [ready,      setReady]      = useState(false);
  const [copied,     setCopied]     = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaned,    setCleaned]    = useState(false);

  const cur    = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const pct    = step === 0 ? 0 : Math.round((step / (STEPS.length - 1)) * 100);

  // ─── Activación ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const run       = searchParams.get("runTour");
    const completed = localStorage.getItem("bionordi-tour-completed");
    if (run === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("runTour");
      window.history.replaceState({}, "", url.toString());
      setActive(true); setStep(0); setCleaned(false);
    } else if (!completed) {
      const t = setTimeout(() => { setActive(true); setStep(0); setCleaned(false); }, 2000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  // ─── Spotlight + detección en tiempo real ────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    const def        = STEPS[step];
    const stepStart  = Date.now();
    let findAttempts = 0;
    let advTimer: ReturnType<typeof setTimeout> | null = null;

    setReady(false);
    if (!def.selector) setCoords(null); // solo limpia si no hay selector

    const findVisible = (sel: string): Element | null =>
      Array.from(document.querySelectorAll(sel)).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? null;

    // Actualiza coordenadas del spotlight
    const updateCoords = () => {
      if (!def.selector) return;
      const el = findVisible(def.selector);
      if (el) {
        findAttempts = 0;
        const r = el.getBoundingClientRect();
        setCoords({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (findAttempts < 25) {
        findAttempts++;
      } else {
        setCoords(null);
      }
    };

    // Ejecuta la detección del paso
    const runDetect = () => {
      if (advTimer || !def.detect) return;
      if (Date.now() - stepStart < 200) return; // guard mínimo anti-falso-positivo
      if (def.detect(pathname)) {
        setReady(true);
        if (def.autoAdvance) {
          advTimer = setTimeout(() => setStep(s => s + 1), 200); // avance rápido
        }
      }
    };

    // Polling para coordenadas (posición puede cambiar con scroll/resize)
    updateCoords();
    const coordsInterval = setInterval(updateCoords, 250);
    window.addEventListener("resize", updateCoords);

    // MutationObserver: detección instantánea cuando el DOM cambia
    let mutDebounce: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      updateCoords();
      if (mutDebounce) clearTimeout(mutDebounce);
      mutDebounce = setTimeout(runDetect, 20); // 20ms de debounce
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Polling como fallback
    const detectInterval = setInterval(runDetect, 200);

    return () => {
      clearInterval(coordsInterval);
      clearInterval(detectInterval);
      window.removeEventListener("resize", updateCoords);
      observer.disconnect();
      if (advTimer)    clearTimeout(advTimer);
      if (mutDebounce) clearTimeout(mutDebounce);
    };
  }, [active, step, pathname]);

  if (!active) return null;

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const next  = () => step < STEPS.length - 1 ? setStep(s => s + 1) : close();
  const close = () => { localStorage.setItem("bionordi-tour-completed", "true"); setActive(false); };

  const copy = (val: string) => {
    navigator.clipboard.writeText(val).then(() => {
      setCopied(val);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const cleanupData = async () => {
    setIsCleaning(true);
    try {
      const data = await fetch("/api/leads?q=Tutorial&limit=100").then(r => r.json());
      if (Array.isArray(data.leads)) {
        for (const l of data.leads.filter((l: any) =>
          l.nombre.includes("Tutorial") || l.nombre.includes("(Prueba)")
        )) {
          await fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: l.id }),
          });
        }
      }
      setCleaned(true);
      setTimeout(close, 2000);
    } catch {}
    finally { setIsCleaning(false); }
  };

  // ─── Posición del card ────────────────────────────────────────────────────────
  const cardStyle = (): React.CSSProperties => {
    if (typeof window === "undefined") return { display: "none" };
    const mobile = window.innerWidth < 768;
    const W = 400, gap = 18;
    const vw = window.innerWidth, vh = window.innerHeight;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    if (mobile) return {
      position: "fixed", bottom: 12, left: 12, right: 12,
      width: "calc(100% - 24px)", zIndex: 9999, pointerEvents: "auto",
    };
    if (!coords || cur.position === "center") return {
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: `${W}px`, zIndex: 9999, pointerEvents: "auto",
    };

    const { top, left, width, height } = coords;
    switch (cur.position) {
      case "right": return { position: "fixed", top: `${clamp(top, 12, vh - 600)}px`, left: `${left + width + gap}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto" };
      case "left":  return { position: "fixed", top: `${clamp(top, 12, vh - 600)}px`, left: `${clamp(left - W - gap, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto" };
      case "top":   return { position: "fixed", bottom: `${vh - top + gap}px`, left: `${clamp(left + width / 2 - W / 2, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto" };
      default:      return { position: "fixed", top: `${top + height + gap}px`, left: `${clamp(left + width / 2 - W / 2, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto" };
    }
  };

  const canNext  = !cur.detect || ready;
  const StepIcon = cur.icon;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spotlight */}
      {coords && (
        <div style={{
          position: "fixed",
          top:    coords.top    - 6,
          left:   coords.left   - 6,
          width:  coords.width  + 12,
          height: coords.height + 12,
          borderRadius: 20,
          boxShadow: `0 0 0 9999px rgba(10, 14, 28, 0.52), 0 0 0 2px ${cur.color}`,
          pointerEvents: "none",
          zIndex: 9990,
          transition: "top .18s, left .18s, width .18s, height .18s",
        }} />
      )}

      {!coords && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10, 14, 28, 0.45)", pointerEvents: "none", zIndex: 9989 }} />
      )}

      {/* Card del tutorial */}
      <div
        style={cardStyle()}
        className="bg-white rounded-[22px] overflow-hidden flex flex-col shadow-[0_20px_50px_-8px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
      >
        {/* Barra progreso */}
        <div className="h-[3px] w-full bg-[#F0F4F8] shrink-0">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: cur.color }} />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3.5 flex items-start justify-between shrink-0" style={{ borderBottom: `1px solid ${cur.color}18` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: cur.bg }}>
              <StepIcon size={19} strokeWidth={2.5} style={{ color: cur.color }} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: cur.color }}>{cur.subtitle}</div>
              <div className="text-[15px] font-extrabold text-[#1E293B] leading-tight tracking-[-0.02em] mt-0.5">{cur.title}</div>
            </div>
          </div>
          <button onClick={close} className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all shrink-0 mt-0.5">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5 max-h-[450px]" style={{ scrollbarWidth: "thin" }}>

          {/* Por qué */}
          <div className="rounded-[14px] px-4 py-3 flex gap-2.5 items-start" style={{ backgroundColor: `${cur.color}0C`, border: `1px solid ${cur.color}20` }}>
            <span className="text-[15px] shrink-0 mt-0.5">💡</span>
            <p className="text-[12px] leading-relaxed font-medium" style={{ color: `${cur.color}CC` }}>{cur.why}</p>
          </div>

          {/* Instrucciones numeradas */}
          <div className="space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">Qué hacer:</p>
            <div className="space-y-2">
              {cur.steps.map((s, i) => (
                <div key={i} className="flex gap-2.5 items-start">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5" style={{ backgroundColor: cur.bg, color: cur.color }}>
                    {s.startsWith("✅") ? "✓" : i + 1}
                  </div>
                  <p className="text-[12.5px] text-[#334155] font-medium leading-snug">{s.startsWith("✅") ? s.slice(2) : s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Datos de prueba */}
          {cur.fields && (
            <div className="space-y-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">Datos de prueba — click para copiar:</p>
              <div className="space-y-1.5">
                {cur.fields.map(f => (
                  <button
                    key={f.label}
                    onClick={() => copy(f.value)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[12px] border text-left transition-all group"
                    style={{ borderColor: copied === f.value ? `${cur.color}50` : "#E2E8F0", backgroundColor: copied === f.value ? cur.bg : "#FAFBFC" }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-[#94A3B8] leading-none mb-1">{f.label}</div>
                      <div className="text-[12.5px] font-bold text-[#1E293B] font-mono truncate leading-none">{f.value}</div>
                    </div>
                    {copied === f.value
                      ? <div className="flex items-center gap-1 shrink-0" style={{ color: cur.color }}><span className="text-[9px] font-extrabold">Copiado</span><Check size={12} strokeWidth={3} /></div>
                      : <Copy size={13} className="text-[#CBD5E1] group-hover:text-[#64748B] shrink-0 transition-colors" />
                    }
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint de botón guardar */}
          {cur.saveHint && (
            <div
              className="flex gap-2.5 items-start rounded-[14px] px-4 py-3"
              style={{ backgroundColor: `${cur.color}08`, border: `1.5px dashed ${cur.color}40` }}
            >
              <MousePointerClick size={15} className="shrink-0 mt-0.5" style={{ color: cur.color }} />
              <p className="text-[12px] font-semibold leading-snug" style={{ color: cur.color }}>
                {cur.saveHint}
              </p>
            </div>
          )}

          {/* Estado de espera */}
          {cur.detect && !ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: cur.color }} />
              <span className="text-[11.5px] text-[#64748B] font-medium">Detectando tu acción en la app...</span>
            </div>
          )}

          {/* Confirmación */}
          {ready && !cur.autoAdvance && (
            <div className="flex items-center gap-2.5 rounded-[12px] px-3.5 py-2.5 border" style={{ backgroundColor: `${cur.color}0C`, borderColor: `${cur.color}30` }}>
              <CheckCircle2 size={14} strokeWidth={2.5} style={{ color: cur.color }} className="shrink-0" />
              <span className="text-[12px] font-bold" style={{ color: cur.color }}>¡Acción detectada! Hacé click en Siguiente.</span>
            </div>
          )}

          {/* Limpieza final */}
          {isLast && (
            <div className="pt-1">
              {cleaned ? (
                <div className="flex items-center gap-2.5 rounded-[14px] px-4 py-3 bg-[#ECFDF5] border border-[#A7F3D0]">
                  <CheckCircle2 size={15} className="text-[#059669] shrink-0" />
                  <span className="text-[12.5px] font-bold text-[#059669]">Datos de prueba eliminados correctamente.</span>
                </div>
              ) : (
                <button
                  onClick={cleanupData}
                  disabled={isCleaning}
                  className="w-full h-11 rounded-[14px] font-bold text-[13px] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg, ${cur.color}, #7C3AED)` }}
                >
                  {isCleaning
                    ? <><Loader2 size={14} className="animate-spin" /> Eliminando datos...</>
                    : <>✨ Limpiar datos de prueba</>
                  }
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 flex items-center justify-between border-t border-[#F0F4F8] shrink-0 bg-[#FAFBFC]">
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === step ? 20 : 6, height: 6, backgroundColor: i === step ? cur.color : i < step ? `${cur.color}60` : "#E2E8F0" }} />
            ))}
          </div>
          <button
            onClick={isLast ? close : next}
            disabled={!canNext || isCleaning}
            className="h-9 px-5 rounded-[12px] text-[12.5px] font-bold text-white flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ backgroundColor: canNext && !isCleaning ? cur.color : "#94A3B8" }}
          >
            {isLast ? <><CheckCircle2 size={13} strokeWidth={2.5} /> Salir</> : <>Siguiente <ArrowRight size={13} strokeWidth={2.5} /></>}
          </button>
        </div>
      </div>
    </>
  );
}
