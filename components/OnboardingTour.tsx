"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  X, Copy, Check, BookOpen,
  Database, FileText, Wrench, Sparkles, CheckCircle2,
  Loader2, ArrowRight, MousePointerClick, Users,
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
    why: "Vas a recorrer el ciclo de aprendizaje completo para nuevos usuarios: registrar un Lead como Cliente, buscarlo en el Directorio, abrir su Expediente y generar su Cotización y Orden de Taller desde su propio perfil.",
    steps: [
      "Interactuás directamente con la app real mientras te guío paso a paso.",
      "Cada paso muestra exactamente qué hacer, dónde hacer click y qué datos ingresar.",
      "Al terminar podés borrar los datos de prueba con un click.",
    ],
    position: "center",
  },
  /* 1 */ {
    title: "Abrir el CRM",
    subtitle: "Paso 1 de 12",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "El CRM (Customer Relationship Manager) es el panel principal de ventas donde controlás tus leads comerciales.",
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
    subtitle: "Paso 2 de 12",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Un Lead es el expediente inicial de un prospecto. Para que quede guardado en tu directorio permanente de Clientes, debés registrar sus datos.",
    steps: [
      "Buscá el botón azul '+ Nuevo Lead' en la barra superior del CRM.",
      "Hacé click. El formulario se abrirá automáticamente.",
    ],
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  /* 3 */ {
    title: "Registrar datos del Cliente",
    subtitle: "Paso 3 de 12",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Para que este Lead de prueba aparezca en tu directorio permanente de Clientes, es fundamental seleccionar 'Cliente' en el campo 'Estado CRM'.",
    steps: [
      "Hacé click en cada campo de la tabla de abajo para copiar el dato y pegalo en el formulario.",
      "⚠️ Importante: En 'Estado CRM' seleccioná 'Cliente'.",
      "Hacé click en el botón azul 'Crear Lead' al pie del formulario para guardarlo.",
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
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]') && Array.from(document.querySelectorAll("div, td, span")).some(el => el.textContent && el.textContent.includes("Tutorial")),
    autoAdvance: true,
  },
  /* 4 */ {
    title: "Ir al Directorio de Clientes",
    subtitle: "Paso 4 de 12",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "El directorio de Clientes almacena a todas las personas e instituciones médicas con un estatus activo en el sistema.",
    steps: [
      "En la barra lateral izquierda, buscá el módulo 'Clientes' (ícono de usuarios 👥).",
      "Hacé click. El tutorial avanzará solo cuando cargue la lista.",
    ],
    selector: '[data-tour="nav-clientes"]',
    position: "right",
    detect: (p) => p === "/clientes",
    autoAdvance: true,
  },
  /* 5 */ {
    title: "Buscar cliente de prueba",
    subtitle: "Paso 5 de 12",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "Cuando tenés cientos de clientes registrados, usar el buscador dinámico te permite ubicar el expediente de manera inmediata.",
    steps: [
      "Hacé click en la barra de búsqueda de clientes resaltada.",
      "Escribí 'Tutorial' para filtrar y localizar la tarjeta de tu cliente de prueba.",
    ],
    selector: '[data-tour="client-search-input"]',
    position: "bottom",
    detect: () => {
      const inp = document.querySelector('[data-tour="client-search-input"]') as HTMLInputElement;
      return inp && inp.value.toLowerCase().includes("tutorial");
    },
    autoAdvance: true,
  },
  /* 6 */ {
    title: "Abrir expediente",
    subtitle: "Paso 6 de 12",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "El expediente concentra todo el historial clínico del cliente: sus equipos, cotizaciones, órdenes de servicio y notas de contacto.",
    steps: [
      "Buscá la tarjeta de 'Dr. Juan García (Tutorial)' en el directorio.",
      "Hacé click sobre ella para ingresar a su expediente personal.",
    ],
    selector: '[data-tour="tour-client-card"]',
    position: "bottom",
    detect: (p) => /^\/clientes\/\d+$/.test(p),
    autoAdvance: true,
  },
  /* 7 */ {
    title: "Cotizar desde el Expediente",
    subtitle: "Paso 7 de 12",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Iniciar cotizaciones desde el expediente vincula de manera automática todos los datos fiscales y de contacto del cliente en el PDF formal.",
    steps: [
      "En la parte superior del perfil de Juan García, hacé click en el botón 'Cotizar' (ícono 📄).",
      "Se abrirá un selector para definir la línea de negocio.",
    ],
    selector: '[data-tour="profile-quote-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="quote-type-reparacion"]') || !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  /* 8 */ {
    title: "Elegir línea de servicio",
    subtitle: "Paso 8 de 12",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Bionordi ofrece Reparaciones, Mantenimientos, Venta de Equipos y Consumibles. Cada línea genera un formato y cláusulas legales de PDF distintas.",
    steps: [
      "Hacé click en la tarjeta de 'Reparación de Transductores' para abrir el cotizador especializado.",
    ],
    selector: '[data-tour="quote-type-reparacion"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  /* 9 */ {
    title: "Completar la Cotización",
    subtitle: "Paso 9 de 12",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "El cotizador opera en dos modalidades clave: Modo Catálogo (carga automáticamente las fotos y diagramas técnicos del transductor Mindray desde tu inventario) y Modo Manual (para escribir textos personalizados).",
    steps: [
      "Copiá y pegá los campos de abajo. Verás que al seleccionar 'Mindray 7L-4s' bajo Modo Catálogo, se cargan las especificaciones técnicas del transductor.",
      "En la tabla de costos, seleccioná o escribí un concepto y asignale el precio unitario sugerido.",
    ],
    saveHint: "Cuando la cotización esté llena → hacé click en el botón 'Generar PDF' al pie del formulario para registrar la cotización y visualizar el PDF formal.",
    selector: '[data-tour="quote-modal"]',
    position: "left",
    fields: [
      { label: "Equipo",            value: "Transductor Lineal" },
      { label: "Marca del equipo",   value: "Mindray" },
      { label: "Modelo del equipo",  value: "7L-4s" },
      { label: "Número de serie",   value: "MY-829281" },
      { label: "Falla reportada",   value: "Líneas negras en imagen" },
      { label: "Concepto / Costo",  value: "Reparación de arreglo de cristales y reencapsulado" },
      { label: "Precio unitario",   value: "6500" },
    ],
    detect: () => {
      if (typeof window === "undefined") return false;
      if (document.querySelector('[data-tour="doc-viewer-modal"]')) return true;
      const saveBtn = document.querySelector('[data-tour="quote-save-expediente"]');
      if (saveBtn && (saveBtn.textContent?.toLowerCase().includes("guardado") || saveBtn.className.includes("bg-[#059669]"))) {
        return true;
      }
      if (!document.querySelector('[data-tour="quote-modal"]')) {
        return Array.from(document.querySelectorAll("div, span, td")).some(el => el.textContent && el.textContent.includes("6,500"));
      }
      return false;
    },
    autoAdvance: true,
  },
  /* 10 */ {
    title: "Aprobar la Cotización",
    subtitle: "Paso 10 de 12",
    icon: CheckCircle2, color: "#059669", bg: "#ECFDF5",
    why: "Una vez que el cliente acepta el presupuesto, debemos aprobar la cotización directamente en su expediente digital para habilitar la creación automática de su Orden de Trabajo sin recapturar datos.",
    steps: [
      "Cerrá el previsualizador de PDF si se encuentra abierto (click en la X superior).",
      "Desplázate hacia abajo hasta la tabla de 'Cotizaciones' en el expediente del cliente.",
      "En la fila de tu cotización de $6,500, hacé click en el botón verde 'Aprobar'.",
    ],
    selector: '[data-tour="quote-approve-btn"]',
    position: "left",
    detect: () => !document.querySelector('[data-tour="doc-viewer-modal"]') && !document.querySelector('[data-tour="quote-approve-btn"]') && !!document.querySelector('[data-tour="quote-create-ot-btn"]'),
    autoAdvance: true,
  },
  /* 11 */ {
    title: "Crear Orden de Trabajo",
    subtitle: "Paso 11 de 12",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "Al hacer click en 'Crear OT', el CRM vincula automáticamente toda la información de la cotización aprobada (marca, modelo, falla y costo) en una nueva Orden de Trabajo para el taller, sin tener que escribir nada a mano.",
    steps: [
      "Hacá click en el nuevo botón morado 'Crear OT' que apareció en la fila de tu cotización aprobada.",
      "Aceptá la confirmación en la ventana emergente de tu navegador para registrar la Orden de Servicio automáticamente.",
    ],
    selector: '[data-tour="quote-create-ot-btn"]',
    position: "left",
    detect: () => {
      if (typeof window === "undefined") return false;
      return !document.querySelector('[data-tour="quote-create-ot-btn"]') && Array.from(document.querySelectorAll("span, td, div")).some(el => el.textContent && el.textContent.includes("BRT-"));
    },
    autoAdvance: true,
  },
  /* 12 */ {
    title: "¡Flujo completado!",
    subtitle: "Tutorial finalizado",
    icon: Sparkles, color: "#059669", bg: "#ECFDF5",
    why: "Dominaste el ciclo operativo completo de Bionordi CRM de la mano con las mejores prácticas comerciales y técnicas.",
    steps: [
      "✅ Lead registrado y catalogado como Cliente permanente.",
      "✅ Propuesta comercial formal generada desde su perfil técnico.",
      "✅ Orden de Trabajo ingresada al tablero Kanban del taller de reparaciones.",
    ],
    saveHint: "Hacé click abajo para limpiar la base de datos de los registros de prueba y dejar tu plataforma impecable.",
    position: "center",
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────
export default function OnboardingTour() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [active,     setActive]     = useState(false);
  const [step,       setStep]       = useState(0);
  const [quoteSubMode, setQuoteSubMode] = useState<"choose" | "catalogo" | "manual">("choose");
  const [coords,     setCoords]     = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [ready,      setReady]      = useState(false);
  const [copied,     setCopied]     = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleaned,    setCleaned]    = useState(false);

  // Selecciona el submodo y simula el click en el botón del modal de la app
  const selectSubMode = (mode: "catalogo" | "manual") => {
    setQuoteSubMode(mode);
    setTimeout(() => {
      const btn = document.querySelector(
        mode === "catalogo" ? '[data-tour="quote-mode-catalogo-btn"]' : '[data-tour="quote-mode-manual-btn"]'
      ) as HTMLButtonElement | null;
      if (btn) btn.click();
    }, 50);
  };

  // Resetea el submodo de cotización al entrar al paso 9
  useEffect(() => {
    if (step === 9) {
      setQuoteSubMode("choose");
    }
  }, [step]);

  // Sincronización automática de clics en la app con quoteSubMode
  useEffect(() => {
    if (!active || step !== 9) return;
    
    const handleCatClick = () => setQuoteSubMode("catalogo");
    const handleManClick = () => setQuoteSubMode("manual");

    let catBtn: Element | null = null;
    let manBtn: Element | null = null;

    const interval = setInterval(() => {
      catBtn = document.querySelector('[data-tour="quote-mode-catalogo-btn"]');
      manBtn = document.querySelector('[data-tour="quote-mode-manual-btn"]');
      if (catBtn && manBtn) {
        catBtn.addEventListener("click", handleCatClick);
        manBtn.addEventListener("click", handleManClick);
        clearInterval(interval);
      }
    }, 100);

    return () => {
      clearInterval(interval);
      if (catBtn && manBtn) {
        catBtn.removeEventListener("click", handleCatClick);
        manBtn.removeEventListener("click", handleManClick);
      }
    };
  }, [active, step]);

  const curRaw = STEPS[step];
  const isQuoteStep = step === 9;

  const cur = {
    ...curRaw,
    why: isQuoteStep
      ? (quoteSubMode === "choose"
          ? "Bionordi ofrece dos formas potentes de generar cotizaciones: usando el Catálogo (con diagramas y fichas de transductores Mindray preestablecidos) o en Modo Manual (para escribir especificaciones libres)."
          : quoteSubMode === "catalogo"
            ? "El Modo Catálogo vincula las especificaciones exactas del transductor desde tu inventario. Al seleccionar Mindray 7L-4s, el sistema autocompleta el diagrama clínico y la ficha técnica."
            : "El Modo Manual te da libertad absoluta. Sirve para escribir textos libres personalizados, configurar descuentos y subir imágenes o evidencias fotográficas directas de la reparación."
        )
      : curRaw.why,
    steps: isQuoteStep
      ? (quoteSubMode === "choose"
          ? ["Hacé click abajo en el modo que desees aprender para guiarte paso a paso."]
          : quoteSubMode === "catalogo"
            ? [
                "Confirmá que el control superior esté en Catálogo.",
                "Elegí la Marca 'Mindray' de la lista desplegable.",
                "Elegí el Modelo '7L-4s' para autocargar el diagrama clínico y ficha técnica.",
                "Copiá y pegá el No. de Serie y la Falla reportada sugeridos abajo.",
                "En la sección de servicios, haz click en el botón de servicio rápido 'Reparación transductor lineal — $6,500' para agregarlo con un solo click.",
                "Haz click en el botón verde 'Guardar PDF en expediente' al pie de la pantalla para registrar la cotización."
              ]
            : [
                "Cambiá el control superior a modo Manual.",
                "En 'Tipo de transductor', seleccioná la opción 'Lineal' de la lista.",
                "Escribí a mano la Marca (Mindray) y el Modelo (7L-4s).",
                "Copiá y pegá la Serie y Falla sugeridos abajo.",
                "En 'Evidencia Fotográfica', podés subir fotos directas del transductor y agregar descripciones libres.",
                "En la tabla de costos, haz click en '+ Agregar línea', escribe el concepto y precio unitario sugeridos.",
                "Haz click en el botón verde 'Guardar PDF en expediente' al pie del formulario para registrar la cotización."
              ]
        )
      : curRaw.steps,
    fields: isQuoteStep
      ? (quoteSubMode === "choose"
          ? undefined
          : quoteSubMode === "catalogo"
            ? [
                { label: "Número de serie", value: "MY-829281" },
                { label: "Falla reportada", value: "Líneas negras en imagen" },
                { label: "Concepto / Costo", value: "Reparación de arreglo de cristales y reencapsulado" },
                { label: "Precio unitario", value: "6500" }
              ]
            : [
                { label: "Marca del equipo", value: "Mindray" },
                { label: "Modelo del equipo", value: "7L-4s" },
                { label: "No. de Serie", value: "MY-829281" },
                { label: "Falla / Síntoma", value: "Líneas negras en imagen" },
                { label: "Concepto / Costo", value: "Reparación de transductor lineal" },
                { label: "Precio unitario", value: "6500" }
              ]
        )
      : curRaw.fields,
    saveHint: isQuoteStep
      ? (quoteSubMode === "choose"
          ? undefined
          : "💡 Consejo útil: Una vez completa, haz click en el botón verde 'Guardar PDF en expediente' para vincular permanentemente esta cotización al lead de prueba y poder avanzar."
        )
      : curRaw.saveHint,
    selector: isQuoteStep
      ? (quoteSubMode === "choose"
          ? '[data-tour="quote-mode-toggle"]'
          : quoteSubMode === "catalogo"
            ? '[data-tour="quote-mode-catalogo-btn"]'
            : '[data-tour="quote-mode-manual-btn"]'
        )
      : step === 10
        ? (typeof document !== "undefined" && document.querySelector('[data-tour="doc-viewer-modal"]')
            ? '[data-tour="close-doc-viewer"]'
            : '[data-tour="quote-approve-btn"]'
          )
        : curRaw.selector,
  };

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
        setCoords(prev => {
          if (prev &&
              prev.top === r.top &&
              prev.left === r.left &&
              prev.width === r.width &&
              prev.height === r.height) {
            return prev; // no cambia la referencia, evita rerenders
          }
          return { top: r.top, left: r.left, width: r.width, height: r.height };
        });
      } else if (findAttempts < 25) {
        findAttempts++;
      } else {
        setCoords(prev => prev === null ? null : null);
      }
    };

    // Ejecuta la detección del paso
    const runDetect = () => {
      if (advTimer || !def.detect) return;
      if (Date.now() - stepStart < 50) return; // guard mínimo anti-falso-positivo
      if (def.detect(pathname)) {
        setReady(true);
        if (def.autoAdvance) {
          advTimer = setTimeout(() => setStep(s => s + 1), 50); // avance rápido
        }
      }
    };

    // Polling para coordenadas (posición puede cambiar con scroll/resize)
    updateCoords();
    const coordsInterval = setInterval(updateCoords, 100);
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords, true); // intercepción en fase de captura

    // MutationObserver: detección instantánea cuando el DOM cambia
    let mutDebounce: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      updateCoords();
      if (mutDebounce) clearTimeout(mutDebounce);
      mutDebounce = setTimeout(runDetect, 5); // 5ms de debounce
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Polling como fallback
    const detectInterval = setInterval(runDetect, 80);

    return () => {
      clearInterval(coordsInterval);
      clearInterval(detectInterval);
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
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
      const data = await fetch("/api/leads?limit=300").then(r => r.json());
      if (Array.isArray(data.leads)) {
        for (const l of data.leads.filter((l: any) =>
          l.nombre.toLowerCase().includes("tutorial") || l.nombre.toLowerCase().includes("prueba")
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

  const canNext  = (!cur.detect || ready) && !(isQuoteStep && quoteSubMode === "choose");
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

          {isQuoteStep && quoteSubMode === "choose" && (
            <div className="pt-2 space-y-2.5">
              <button
                onClick={() => selectSubMode("catalogo")}
                className="w-full p-4 rounded-xl border-2 border-indigo-500/20 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-50 text-left transition-all hover:scale-[1.02] flex items-start gap-3 group"
              >
                <span className="text-[20px] shrink-0 mt-0.5">💡</span>
                <div>
                  <div className="text-[13px] font-extrabold text-[#4E60A9] group-hover:text-indigo-600">Modo Catálogo (Recomendado)</div>
                  <p className="text-[11.5px] text-gray-500 font-medium mt-1 leading-snug">Carga automática de diagramas, fotografías y cláusulas oficiales del transductor Mindray.</p>
                </div>
              </button>
              <button
                onClick={() => selectSubMode("manual")}
                className="w-full p-4 rounded-xl border-2 border-emerald-500/20 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-left transition-all hover:scale-[1.02] flex items-start gap-3 group"
              >
                <span className="text-[20px] shrink-0 mt-0.5">🛠️</span>
                <div>
                  <div className="text-[13px] font-extrabold text-emerald-600 group-hover:text-emerald-700">Modo Manual</div>
                  <p className="text-[11.5px] text-gray-500 font-medium mt-1 leading-snug">Escribe especificaciones libres, conceptos personalizados y configura descuentos o impuestos.</p>
                </div>
              </button>
            </div>
          )}

          {isQuoteStep && quoteSubMode !== "choose" && (
            <div className="border-t border-gray-100 pt-3 mt-3 space-y-2.5">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">💡 Guía rápida de botones y campos:</p>
              <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2 text-[12px] leading-relaxed scrollbar-thin" style={{ scrollbarWidth: "thin" }}>
                {quoteSubMode === "catalogo" ? (
                  <>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">🏷️ Marca y Modelo</strong>
                      <span>Selectores inteligentes. Al elegir <em>Mindray</em> y <em>7L-4s</em>, el CRM autocompleta el diagrama y la descripción técnica del transductor.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">⚡ Agregar servicio rápido</strong>
                      <span>Botones con precios precargados. Haz click y sumará la reparación del transductor al instante sin tener que escribir.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">➕ Agregar línea</strong>
                      <span>Añade una fila vacía en la tabla de costos si necesitas cobrar conceptos o refacciones adicionales.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">🧾 IVA 16% / Descuento %</strong>
                      <span>Controles rápidos para desglosar impuestos y aplicar descuentos directos con recálculo en tiempo real.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">👤 Generado por</strong>
                      <span>Firma la cotización como Director General o a nombre de un técnico para personalizar las firmas en el PDF.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-[#4E60A9] font-bold block mb-0.5">✉️ Enviar por correo</strong>
                      <span>Envía automáticamente la propuesta comercial con el PDF adjunto formal al correo electrónico del cliente.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]">
                      <strong className="font-extrabold block mb-0.5">💾 Guardar PDF en expediente (Recomendado)</strong>
                      <span>Guarda y vincula permanentemente este presupuesto en el expediente digital de este lead para avanzar.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900">
                      <strong className="text-indigo-700 font-extrabold block mb-0.5">📄 Generar PDF</strong>
                      <span>Guarda y compila los datos, y abre el visor de PDF interactivo de alta definición para revisión e impresión.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">🛠️ Tipo / Marca / Modelo libres</strong>
                      <span>Campos libres para escribir a mano cualquier tipo de equipo médico (ej. desfibrilador, monitor) sin plantillas fijas.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">📝 Características / Descripción</strong>
                      <span>Agrega hasta 4 puntos técnicos usando el botón '+ Agregar punto' para desglosar las bondades del equipo.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">📸 Subir imagen de equipo</strong>
                      <span>Permite subir y adjuntar una fotografía real del equipo que se incluirá en la parte superior del PDF.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">🖼️ Evidencia Fotográfica</strong>
                      <span>Carga hasta 4 fotos del daño real con sus respectivas descripciones para sustentar técnicamente tu diagnóstico.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">📄 Texto de la propuesta</strong>
                      <span>Acordeón para editar libremente el cuerpo del documento. Si queda en blanco, ¡el CRM autogenera un texto formal premium!</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <strong className="text-emerald-700 font-bold block mb-0.5">🏢 Datos de facturación</strong>
                      <span>Acordeón para llenar datos fiscales (RFC, Régimen, Uso de CFDI) y agilizar la emisión de facturas.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#047857]">
                      <strong className="font-extrabold block mb-0.5">💾 Guardar PDF en expediente (Recomendado)</strong>
                      <span>Guarda y vincula permanentemente este presupuesto personalizado en la base de datos y expediente del lead para avanzar.</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900">
                      <strong className="text-indigo-700 font-extrabold block mb-0.5">📄 Generar PDF</strong>
                      <span>Compila los datos libres, fotos de evidencia, datos fiscales y abre el visor de PDF interactivo de alta calidad.</span>
                    </div>
                  </>
                )}
              </div>
              <div className="pt-1.5 flex justify-end">
                <button
                  onClick={() => setQuoteSubMode("choose")}
                  className="text-[11px] font-extrabold text-gray-400 hover:text-[#4E60A9] underline transition-colors"
                >
                  ← Volver a elegir modo
                </button>
              </div>
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
