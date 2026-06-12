"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
  X, Copy, Check, BookOpen,
  Database, FileText, Wrench, Sparkles, CheckCircle2,
  Loader2, ArrowRight, MousePointerClick, Users, CalendarDays,
  ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type StepDef = {
  title: string;
  subtitle?: string;           // Si se omite se calcula "Paso N de M" automáticamente
  icon: any;
  color: string;
  bg: string;
  why: string;
  steps: string[];
  mobileSteps?: string[];      // Instrucciones alternativas en pantallas < 768px
  saveHint?: string;           // Muestra el botón exacto a presionar para guardar
  selector?: string;
  mobileSelector?: string;     // Selector alternativo para el spotlight en móvil
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
    why: "Vas a recorrer el ciclo operativo completo: registrar un Lead como Cliente, buscarlo en el Directorio, abrir su Expediente, generar su Cotización y convertirla en una Orden de Taller. Al final conocerás también los módulos de Taller, Recepción de Equipo, Agenda y comunicación.",
    steps: [
      "Interactúas directamente con la app real mientras te guío paso a paso.",
      "Cada paso muestra exactamente qué hacer, dónde hacer clic y qué datos ingresar.",
      "Al terminar puedes borrar los datos de prueba con un clic.",
    ],
    mobileSteps: [
      "Interactúas directamente con la app real mientras te guío paso a paso.",
      "En el teléfono navega con la barra inferior; el botón 'Más' abre el resto de los módulos.",
      "Puedes minimizar esta tarjeta con la flecha de arriba para ver mejor la pantalla.",
    ],
    position: "center",
  },
  /* 1 */ {
    title: "Abrir el CRM",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "El CRM (Customer Relationship Manager) es el panel principal de ventas donde controlas tus leads comerciales.",
    steps: [
      "Haz clic en la tarjeta azul 'Ventas & CRM' del panel principal.",
      "El tutorial avanza automáticamente en cuanto llegas al CRM.",
    ],
    selector: '[data-tour="crm-card"]',
    position: "bottom",
    detect: (p) => p === "/crm",
    autoAdvance: true,
  },
  /* 2 */ {
    title: "Crear un nuevo Lead",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Un Lead es el expediente inicial de un prospecto. Para que quede guardado en tu directorio permanente de Clientes, debes registrar sus datos.",
    steps: [
      "Busca el botón azul '+ Nuevo Lead' en la barra superior del CRM.",
      "Haz clic. El formulario se abrirá automáticamente.",
    ],
    selector: '[data-tour="new-lead-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="nuevo-lead-modal"]'),
    autoAdvance: true,
  },
  /* 3 */ {
    title: "Registrar datos del Cliente",
    icon: Database, color: "#4E60A9", bg: "#EEF3FC",
    why: "Para que este Lead de prueba aparezca en tu directorio permanente de Clientes, es fundamental seleccionar 'Cliente' en el campo 'Estado CRM'.",
    steps: [
      "Haz clic en cada campo de la tabla de abajo para copiar el dato y pégalo en el formulario.",
      "⚠️ Importante: En 'Estado CRM' selecciona 'Cliente'.",
      "Haz clic en el botón azul 'Crear Lead' al pie del formulario para guardarlo.",
    ],
    saveHint: "Cuando estén todos los campos completos → haz clic en el botón azul 'Crear Lead' al pie del formulario.",
    selector: '[data-tour="nuevo-lead-modal"]',
    position: "left",
    fields: [
      { label: "Nombre / Razón Social", value: "Dr. Juan García (Tutorial)" },
      { label: "Teléfono",              value: "6641234567" },
      { label: "WhatsApp",              value: "526641234567" },
      { label: "Correo electrónico",    value: "juan.garcia@bionordi.mx" },
      { label: "Ciudad",                value: "Tijuana" },
    ],
    detect: () => !document.querySelector('[data-tour="nuevo-lead-modal"]') && Array.from(document.querySelectorAll("div, td, span")).some(el => !!(el.textContent && el.textContent.includes("Tutorial"))),
    autoAdvance: true,
  },
  /* 4 */ {
    title: "Ir al Directorio de Clientes",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "El directorio de Clientes almacena a todas las personas e instituciones médicas con un estatus activo en el sistema.",
    steps: [
      "En la barra lateral izquierda, busca el módulo 'Clientes' (ícono de usuarios 👥).",
      "Haz clic. El tutorial avanzará solo cuando cargue la lista.",
    ],
    mobileSteps: [
      "Toca el botón 'Más' en la barra inferior para abrir el menú completo.",
      "En el menú, toca 'Clientes'. El tutorial avanzará solo cuando cargue la lista.",
    ],
    selector: '[data-tour="nav-clientes"]',
    mobileSelector: '[data-tour="nav-more"], [data-tour="nav-clientes"]',
    position: "right",
    detect: (p) => p === "/clientes",
    autoAdvance: true,
  },
  /* 5 */ {
    title: "Buscar cliente de prueba",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "Cuando tienes cientos de clientes registrados, usar el buscador dinámico te permite ubicar el expediente de manera inmediata.",
    steps: [
      "Haz clic en la barra de búsqueda de clientes resaltada.",
      "Escribe 'Tutorial' para filtrar y localizar la tarjeta de tu cliente de prueba.",
    ],
    selector: '[data-tour="client-search-input"]',
    position: "bottom",
    detect: () => {
      const inp = document.querySelector('[data-tour="client-search-input"]') as HTMLInputElement;
      return !!(inp && inp.value.toLowerCase().includes("tutorial"));
    },
    autoAdvance: true,
  },
  /* 6 */ {
    title: "Abrir expediente",
    icon: Users, color: "#4E60A9", bg: "#EEF3FC",
    why: "El expediente concentra todo el historial del cliente: sus equipos, cotizaciones, órdenes de servicio y notas de contacto.",
    steps: [
      "Busca la tarjeta de 'Dr. Juan García (Tutorial)' en el directorio.",
      "Haz clic sobre ella para ingresar a su expediente personal.",
    ],
    selector: '[data-tour="tour-client-card"]',
    position: "bottom",
    detect: (p) => /^\/clientes\/\d+$/.test(p),
    autoAdvance: true,
  },
  /* 7 */ {
    title: "Cotizar desde el Expediente",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Iniciar cotizaciones desde el expediente vincula de manera automática todos los datos fiscales y de contacto del cliente en el PDF formal.",
    steps: [
      "En la parte superior del perfil de Juan García, haz clic en el botón 'Cotizar' (ícono 📄).",
      "Se abrirá un selector para definir la línea de negocio.",
    ],
    selector: '[data-tour="profile-quote-btn"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="quote-type-reparacion"]') || !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  /* 8 */ {
    title: "Elegir línea de servicio",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Bionordi ofrece Reparaciones, Mantenimientos, Venta de Equipos y Consumibles. Cada línea genera un formato y cláusulas legales de PDF distintas.",
    steps: [
      "Haz clic en la tarjeta de 'Reparación de Transductores' para abrir el cotizador especializado.",
    ],
    selector: '[data-tour="quote-type-reparacion"]',
    position: "bottom",
    detect: () => !!document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  /* 9 */ {
    title: "Elegir Modo de Cotización",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "El cotizador opera en dos modalidades clave: Modo Catálogo (carga automáticamente fotos y diagramas oficiales de transductores) y Modo Manual (para textos libres y fotos). Observa ambos botones destacados.",
    steps: [
      "Identifica los botones superiores de 'Catálogo' y 'Manual' resaltados en el spotlight.",
      "Para este tutorial, haz clic en el botón 'Catálogo' para usar la base de datos oficial.",
    ],
    selector: '[data-tour="quote-mode-toggle"]',
    position: "bottom",
    detect: () => {
      const catBtn = document.querySelector('[data-tour="quote-mode-catalogo-btn"]');
      return !!(catBtn && catBtn.className.includes("bg-white"));
    },
    autoAdvance: true,
  },
  /* 10 */ {
    title: "Seleccionar Marca",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Al seleccionar la marca en Modo Catálogo, se filtrarán y habilitarán los modelos y fichas técnicas correspondientes.",
    steps: [
      "Haz clic en la lista desplegable de 'Marca' indicada.",
      "Selecciona la opción 'Mindray'.",
    ],
    selector: '[data-tour="quote-eq-marca"]',
    position: "bottom",
    detect: () => {
      const sel = document.querySelector('[data-tour="quote-eq-marca"]') as HTMLSelectElement;
      return !!(sel && sel.value.toLowerCase().includes("mindray"));
    },
    autoAdvance: true,
  },
  /* 11 */ {
    title: "Seleccionar Modelo",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Al elegir el modelo '7L-4s', el cotizador cargará automáticamente la ficha técnica oficial y el diagrama interactivo de cristales Mindray.",
    steps: [
      "Haz clic en la lista desplegable de 'Modelo' indicada.",
      "Selecciona la opción '7L-4s'.",
    ],
    selector: '[data-tour="quote-eq-modelo"]',
    position: "bottom",
    detect: () => {
      const sel = document.querySelector('[data-tour="quote-eq-modelo"]') as HTMLSelectElement;
      return !!(sel && sel.value.toLowerCase().includes("7l-4s"));
    },
    autoAdvance: true,
  },
  /* 12 */ {
    title: "No. de Serie y Falla",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Ingresar el número de serie y la falla reportada es indispensable para que la propuesta y la futura Orden de Servicio identifiquen plenamente al equipo.",
    steps: [
      "Copia y pega el No. de Serie y la Falla reportada sugeridos abajo en sus respectivos campos del formulario.",
    ],
    selector: '[data-tour="quote-eq-fields"]',
    position: "left",
    fields: [
      { label: "Número de serie", value: "MY-829281" },
      { label: "Falla reportada", value: "Líneas negras en imagen" },
    ],
    detect: () => {
      const serie = document.querySelector('input[placeholder="SN-XXXXXX"]') as HTMLInputElement;
      const falla = document.querySelector('input[placeholder="Sin imagen, cable dañado…"]') as HTMLInputElement;
      return !!(serie && serie.value.length > 3 && falla && falla.value.length > 3);
    },
    autoAdvance: true,
  },
  /* 13 */ {
    title: "Firma ('Generado por')",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "El campo 'Generado por' permite definir el firmante oficial de esta cotización (por ejemplo, el Administrador o un técnico especialista).",
    steps: [
      "Selecciona al firmante en la lista desplegable de 'Generado por' destacada abajo.",
      "Cuando estés listo, haz clic en Siguiente.",
    ],
    selector: '[data-tour="quote-firma-user"]',
    position: "left",
    autoAdvance: false,
  },
  /* 14 */ {
    title: "Agregar Servicio Rápido",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Bionordi incluye botones de atajos rápidos con precios precargados para los servicios más comunes, evitando errores manuales de escritura.",
    steps: [
      "Busca el botón 'Reparación transductor lineal — $6,500' en la sección de servicios rápidos.",
      "Haz clic para agregarlo al presupuesto automáticamente.",
    ],
    selector: '[data-tour="quote-rapidos"]',
    position: "left",
    detect: () => {
      const totalDiv = Array.from(document.querySelectorAll("div, span")).find(el => !!(el.textContent && el.textContent.includes("6,500")));
      return !!totalDiv;
    },
    autoAdvance: true,
  },
  /* 15 */ {
    title: "Agregar servicio manualmente",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Además de los atajos rápidos, puedes registrar conceptos adicionales de manera manual detallando su concepto y costo.",
    steps: [
      "Haz clic en '+ Agregar línea' en la tabla de servicios.",
      "En la nueva línea vacía, copia y pega los datos sugeridos abajo en sus respectivos campos ('Descripción' y 'Precio Unit').",
    ],
    fields: [
      { label: "Descripción", value: "Calibración y Pruebas" },
      { label: "Precio Unit.", value: "1500" },
    ],
    selector: '[data-tour="quote-items"]',
    position: "left",
    detect: () => {
      const inputs = Array.from(document.querySelectorAll("input")) as HTMLInputElement[];
      const hasDesc = inputs.some(i => i.value.toLowerCase().includes("calibración"));
      const hasPrice = inputs.some(i => i.value === "1500");
      return hasDesc && hasPrice;
    },
    autoAdvance: true,
  },
  /* 16 */ {
    title: "Propuesta técnica personalizada",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Bionordi genera automáticamente las cláusulas y descripción técnica en el PDF. Si deseas personalizar este texto, puedes desplegar esta sección.",
    steps: [
      "Haz clic en la barra 'Texto de la propuesta en el PDF' para expandir la sección.",
      "Una vez desplegado el espacio donde va el texto, haz clic en el botón 'Generar automáticamente' en la esquina superior derecha para precargar el texto oficial.",
      "Cuando termines de revisarlo, haz clic en Siguiente.",
    ],
    selector: '[data-tour="quote-propuesta-btn"]',
    position: "left",
    detect: () => !!document.querySelector('textarea[placeholder*="deja vacío"]') || !!document.querySelector('textarea[placeholder*="según el equipo"]'),
    autoAdvance: false,
  },
  /* 17 */ {
    title: "Datos de Facturación",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Esta sección te permite asociar los datos fiscales del cliente de manera permanente para automatizar la facturación SAT.",
    steps: [
      "Haz clic en la sección 'Datos de facturación del cliente' para expandirla.",
      "Los campos clave para facturar electrónicamente son:",
      "• Razón Social y RFC: Nombre y Registro fiscal para la emisión.",
      "• Régimen Fiscal y Uso de CFDI: Parámetros del SAT para deducir.",
      "• Correo para factura y Dirección fiscal: Envío de PDF y XML.",
      "Haz clic en Siguiente para continuar.",
    ],
    selector: '[data-tour="quote-facturacion-btn"]',
    position: "left",
    detect: () => !!document.querySelector('input[placeholder="XXXX000000XX0"]'),
    autoAdvance: false,
  },
  /* 18 */ {
    title: "Enviar por correo (Opcional)",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Puedes enviar la propuesta formal en PDF directamente al correo del cliente. De lo contrario, omite este paso haciendo clic en Siguiente.",
    steps: [
      "Si quieres enviar la cotización, escribe el correo del cliente y haz clic en 'Enviar'.",
      "Si prefieres no enviarla por correo ahora, haz clic en Siguiente para continuar.",
    ],
    fields: [
      { label: "Correo de prueba", value: "juan.garcia@bionordi.mx" },
    ],
    selector: '[data-tour="quote-email-to"]',
    position: "left",
    autoAdvance: false,
  },
  /* 19 */ {
    title: "Guardar Cotización en Expediente",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "Al guardar el PDF en el expediente, la propuesta comercial se asocia permanentemente al cliente en la base de datos.",
    steps: [
      "Haz clic en el botón verde 'Guardar PDF en expediente' al pie del modal.",
      "El tutorial avanzará cuando la cotización se registre con éxito.",
    ],
    selector: '[data-tour="quote-save-expediente"]',
    position: "left",
    detect: () => {
      const btn = document.querySelector('[data-tour="quote-save-expediente"]');
      return !!(btn && (btn.textContent?.toLowerCase().includes("guardado") || btn.className.includes("bg-[#059669]")));
    },
    autoAdvance: true,
  },
  /* 20 */ {
    title: "Cerrar Cotizador",
    icon: FileText, color: "#059669", bg: "#ECFDF5",
    why: "La cotización fue registrada correctamente. Ahora debemos cerrar el modal del cotizador para continuar operando en el expediente del cliente.",
    steps: [
      "Haz clic en el botón 'X' en la parte superior derecha del cotizador destacado en el spotlight.",
    ],
    selector: '[data-tour="close-quote-modal"]',
    position: "left",
    detect: () => !document.querySelector('[data-tour="quote-modal"]'),
    autoAdvance: true,
  },
  /* 21 */ {
    title: "Aprobar la Cotización",
    icon: CheckCircle2, color: "#059669", bg: "#ECFDF5",
    why: "Una vez que el cliente acepta el presupuesto, debemos aprobar la cotización directamente en su expediente digital para habilitar la creación automática de su Orden de Trabajo sin recapturar datos.",
    steps: [
      "La pantalla se desplazará automáticamente hacia la tabla de 'Cotizaciones' de este expediente.",
      "En la fila de tu cotización de $6,500, haz clic en el botón verde 'Aprobar'.",
    ],
    selector: '[data-tour="quote-approve-btn"]',
    position: "top",
    detect: () => !document.querySelector('[data-tour="quote-approve-btn"]') && !!document.querySelector('[data-tour="quote-create-ot-btn"]'),
    autoAdvance: true,
  },
  /* 22 */ {
    title: "Crear Orden de Trabajo",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "Al hacer clic en 'Crear OT', el CRM vincula automáticamente toda la información de la cotización aprobada en una nueva Orden de Trabajo para el taller, sin escribir nada a mano.",
    steps: [
      "Haz clic en el nuevo botón morado 'Crear OT' que apareció en la fila de tu cotización aprobada.",
      "Confirma en la ventana emergente de la aplicación para registrar la Orden de Servicio automáticamente.",
    ],
    selector: '[data-tour="quote-create-ot-btn"]',
    position: "left",
    detect: () => {
      return !document.querySelector('[data-tour="quote-create-ot-btn"]') && Array.from(document.querySelectorAll("span, td, div")).some(el => !!(el.textContent && el.textContent.includes("BRT-")));
    },
    autoAdvance: true,
  },
  /* 23 */ {
    title: "Taller: Kanban y Recepción de Equipo",
    icon: Wrench, color: "#7C3AED", bg: "#F5F3FF",
    why: "Tu Orden de Trabajo ya vive en el módulo 'Servicios' del taller: un tablero Kanban donde mueves cada orden por sus etapas hasta entregarla y cobrarla.",
    steps: [
      "En 'Servicios' puedes cambiar el estado de cada orden, registrar el diagnóstico y capturar el precio final al entregar.",
      "Al recibir físicamente un equipo, genera su 'Hoja de Recepción': checklist de accesorios y condiciones, términos legales y firma digital del cliente, con PDF automático de 2 páginas.",
      "Haz clic en Siguiente para conocer los módulos de apoyo diario.",
    ],
    position: "center",
  },
  /* 24 */ {
    title: "Agenda, WhatsApp, Correo y Cotizaciones",
    icon: CalendarDays, color: "#0EA5E9", bg: "#E0F2FE",
    why: "Además del flujo de ventas y taller, Bionordi integra las herramientas de seguimiento diario para que ningún cliente se enfríe.",
    steps: [
      "Agenda: programa la fecha de próximo contacto de cada lead; el globo rojo del menú te avisa cuántos seguimientos tienes pendientes o vencidos hoy.",
      "WhatsApp y Correo: escribe a tus clientes sin salir del CRM, con plantillas profesionales y registro de cada interacción en su expediente.",
      "Cotizaciones: consulta el historial completo de propuestas (reparación, venta, mantenimiento y consumibles) y su estado.",
    ],
    position: "center",
  },
  /* 25 */ {
    title: "¡Flujo completado!",
    subtitle: "Tutorial finalizado",
    icon: Sparkles, color: "#059669", bg: "#ECFDF5",
    why: "Dominaste el ciclo operativo completo de Bionordi: de lead a cliente, y de cotización aprobada a orden de taller.",
    steps: [
      "✅ Lead registrado y catalogado como Cliente permanente.",
      "✅ Propuesta comercial formal generada desde su perfil técnico.",
      "✅ Orden de Trabajo ingresada al tablero Kanban del taller.",
      "✅ Conociste la Hoja de Recepción, la Agenda y los módulos de WhatsApp y Correo.",
    ],
    saveHint: "Haz clic abajo para limpiar la base de datos de los registros de prueba y dejar tu plataforma impecable.",
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
  const [isMobile,   setIsMobile]   = useState(false);
  const [minimized,  setMinimized]  = useState(false);

  // Detección de viewport móvil (con listener para rotaciones / resize)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Al cambiar de paso se vuelve a expandir la tarjeta
  useEffect(() => { setMinimized(false); }, [step]);

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
    selector: step === 21
      ? (typeof document !== "undefined" && document.querySelector('[data-tour="doc-viewer-modal"]')
          ? '[data-tour="close-doc-viewer"]'
          : '[data-tour="quote-approve-btn"]'
        )
      : (isMobile && curRaw.mobileSelector ? curRaw.mobileSelector : curRaw.selector),
  };

  const isLast = step === STEPS.length - 1;
  const pct    = step === 0 ? 0 : Math.round((step / (STEPS.length - 1)) * 100);
  // Numeración automática: pasos 1..N (excluye intro y cierre)
  const subtitle = cur.subtitle ?? `Paso ${step} de ${STEPS.length - 2}`;
  const stepsToShow = isMobile && cur.mobileSteps ? cur.mobileSteps : cur.steps;

  // Scroll automático para centrar el elemento del spotlight cuando se vuelve visible
  const lastScrolledSelector = useRef<string | null>(null);

  useEffect(() => {
    if (!active || !cur.selector || !coords) return;
    const key = `${step}-${cur.selector}`;
    if (lastScrolledSelector.current !== key) {
      const el = Array.from(document.querySelectorAll(cur.selector)).find(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        lastScrolledSelector.current = key;
      }
    }
  }, [step, cur.selector, coords, active]);

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
    const effSelector = isMobile && def.mobileSelector ? def.mobileSelector : def.selector;
    const stepStart  = Date.now();
    let findAttempts = 0;
    let advTimer: ReturnType<typeof setTimeout> | null = null;

    setReady(false);
    if (!effSelector) setCoords(null); // solo limpia si no hay selector

    // Con selectores múltiples (separados por coma) priorizamos el último visible
    // en el DOM: los overlays/menús se montan después que la navegación base.
    const findVisible = (sel: string): Element | null =>
      Array.from(document.querySelectorAll(sel)).reverse().find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? null;

    // Actualiza coordenadas del spotlight
    const updateCoords = () => {
      if (!effSelector) return;
      const el = findVisible(effSelector);
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
  }, [active, step, pathname, isMobile]);

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
        // Solo borra los registros creados por el tutorial: el marcador "(Tutorial)"
        // o el correo exacto de prueba. Nunca por palabras genéricas como "prueba".
        for (const l of data.leads.filter((l: any) =>
          l.nombre.toLowerCase().includes("(tutorial)") ||
          (l.correo && l.correo.toLowerCase() === "juan.garcia@bionordi.mx")
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
    const W = 400, gap = 18;
    const vw = window.innerWidth, vh = window.innerHeight;
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    if (isMobile) {
      // Si el elemento destacado está en la mitad inferior, la tarjeta se ancla
      // arriba para no taparlo (ej. barra de navegación o menú 'Más').
      const targetNearBottom = coords && coords.top > vh * 0.45;
      if (targetNearBottom) return {
        position: "fixed",
        top: "calc(12px + env(safe-area-inset-top))",
        left: 12, right: 12,
        width: "calc(100% - 24px)", zIndex: 9999, pointerEvents: "auto",
        maxHeight: "calc(100dvh - 106px - env(safe-area-inset-bottom))",
      };
      return {
        // 70px de nav inferior + safe-area + 12px de margen: nunca tapa la navegación
        position: "fixed",
        bottom: "calc(82px + env(safe-area-inset-bottom))",
        left: 12, right: 12,
        width: "calc(100% - 24px)", zIndex: 9999, pointerEvents: "auto",
        maxHeight: "calc(100dvh - 106px - env(safe-area-inset-bottom))",
      };
    }
    if (!coords || cur.position === "center") return {
      position: "fixed", top: "50%", left: "50%",
      transform: "translate(-50%, -50%)",
      width: `${W}px`, zIndex: 9999, pointerEvents: "auto",
      maxHeight: "calc(100vh - 40px)",
    };

    const { top, left, width, height } = coords;
    const cardH = 500; // altura máxima estimada para calcular límites seguros

    switch (cur.position) {
      case "right": return { position: "fixed", top: `${clamp(top, 12, vh - cardH - 12)}px`, left: `${clamp(left + width + gap, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto", maxHeight: "calc(100vh - 40px)" };
      case "left":  return { position: "fixed", top: `${clamp(top, 12, vh - cardH - 12)}px`, left: `${clamp(left - W - gap, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto", maxHeight: "calc(100vh - 40px)" };
      case "top":   return { position: "fixed", top: `${clamp(top - cardH - gap, 12, vh - cardH - 12)}px`, left: `${clamp(left + width / 2 - W / 2, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto", maxHeight: "calc(100vh - 40px)" };
      default:      return { position: "fixed", top: `${clamp(top + height + gap, 12, vh - cardH - 12)}px`, left: `${clamp(left + width / 2 - W / 2, 12, vw - W - 12)}px`, width: `${W}px`, zIndex: 9999, pointerEvents: "auto", maxHeight: "calc(100vh - 40px)" };
    }
  };

  const canNext  = (!cur.detect || ready) && !(isQuoteStep && quoteSubMode === "choose");
  const StepIcon = cur.icon;

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Spotlight */}
      {coords && !minimized && (
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

      {coords && minimized && (
        <div style={{
          position: "fixed",
          top:    coords.top    - 6,
          left:   coords.left   - 6,
          width:  coords.width  + 12,
          height: coords.height + 12,
          borderRadius: 20,
          boxShadow: `0 0 0 2px ${cur.color}`,
          pointerEvents: "none",
          zIndex: 9990,
          transition: "top .18s, left .18s, width .18s, height .18s",
        }} />
      )}

      {!coords && !minimized && (
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
        <div className="px-5 pt-4 pb-3.5 flex items-start justify-between shrink-0" style={{ borderBottom: minimized ? "none" : `1px solid ${cur.color}18` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0" style={{ backgroundColor: cur.bg }}>
              <StepIcon size={19} strokeWidth={2.5} style={{ color: cur.color }} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.12em]" style={{ color: cur.color }}>{subtitle}</div>
              <div className="text-[15px] font-extrabold text-[#1E293B] leading-tight tracking-[-0.02em] mt-0.5">{cur.title}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {isMobile && (
              <button
                onClick={() => setMinimized(m => !m)}
                aria-label={minimized ? "Expandir tutorial" : "Minimizar tutorial"}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#475569] hover:bg-[#F1F5F9] transition-all">
                {minimized ? <ChevronUp size={14} strokeWidth={2.5} /> : <ChevronDown size={14} strokeWidth={2.5} />}
              </button>
            )}
            <button onClick={close} className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all">
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        {!minimized && (
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
              {stepsToShow.map((s, i) => (
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
              <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#94A3B8]">Datos de prueba — clic para copiar:</p>
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
              <span className="text-[12px] font-bold" style={{ color: cur.color }}>¡Acción detectada! Haz clic en Siguiente.</span>
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
        )}

        {/* Footer */}
        {!minimized && (
        <div className="px-5 py-3.5 flex items-center justify-between border-t border-[#F0F4F8] shrink-0 bg-[#FAFBFC]">
          <div className="flex items-center gap-1.5 flex-wrap max-w-[200px]">
            {STEPS.map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300" style={{ width: i === step ? 20 : 6, height: 6, backgroundColor: i === step ? cur.color : i < step ? `${cur.color}60` : "#E2E8F0" }} />
            ))}
          </div>
          {(!cur.autoAdvance || isLast) && (
            <button
              onClick={isLast ? close : next}
              disabled={!canNext || isCleaning}
              className="h-9 px-5 rounded-[12px] text-[12.5px] font-bold text-white flex items-center gap-1.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: canNext && !isCleaning ? cur.color : "#94A3B8" }}
            >
              {isLast ? <><CheckCircle2 size={13} strokeWidth={2.5} /> Salir</> : <>Siguiente <ArrowRight size={13} strokeWidth={2.5} /></>}
            </button>
          )}
        </div>
        )}
      </div>
    </>
  );
}
