"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  X, ChevronRight, ChevronLeft, Sparkles, BookOpen,
  Database, Wrench, FileText, CheckCircle2, Navigation, Activity
} from "lucide-react";

interface Step {
  title: string;
  selector?: string;
  position?: "top" | "bottom" | "left" | "right";
  icon: any;
  iconColor: string;
  iconBg: string;
  concept: string; // Didáctica: ¿Por qué?
  actionDesc: string; // Didáctica: ¿Cómo?
  description: string;
  showActionButton?: boolean;
  actionButtonText?: string;
}

export default function OnboardingTour() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Estados de la simulación interactiva
  const [tutorialLeadId, setTutorialLeadId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const STEPS: Step[] = [
    {
      title: "¡Bienvenido al Tutorial Guiado de Bionordi!",
      icon: BookOpen,
      iconColor: "#4E60A9",
      iconBg: "#EEF3FC",
      concept: "Aprende operando en tiempo real",
      actionDesc: "Paso 1: Registraremos un cliente de prueba",
      description: "Hola. Te guiaremos de la mano para que aprendas el flujo real de Bionordi: Registrar un Lead, hacerle su Cotización y generar su Orden en el Taller. Crearemos un cliente de prueba en tu base de datos y al final borraremos todo automáticamente para dejar tu sistema limpio. ¡Haz clic abajo para iniciar!",
      showActionButton: true,
      actionButtonText: "Crear Cliente de Prueba 🧪",
    },
    {
      title: "Paso 1: Cliente registrado en tu CRM",
      selector: 'tr[data-tour="tour-lead-row"]',
      position: "bottom",
      icon: Database,
      iconColor: "#4E60A9",
      iconBg: "#EEF3FC",
      concept: "¿Por qué registrar un Lead primero?",
      actionDesc: "Todo negocio empieza creando su expediente",
      description: "¡Listo! He registrado en tu base de datos al cliente '🧪 Dr. Armando Ríos (Tutorial Bionordi)' en la fase de 'Nuevo'. En el día a día de Bionordi, el primer paso indispensable es registrar los datos de contacto y el nicho médico de tu cliente.",
    },
    {
      title: "Paso 2: Generar su Cotización",
      selector: 'button[data-tour="tour-quote-btn"]',
      position: "bottom",
      icon: FileText,
      iconColor: "#059669",
      iconBg: "#ECFDF5",
      concept: "¿Cómo cobramos por el servicio?",
      actionDesc: "Abre el cotizador del cliente de prueba",
      description: "El segundo paso es enviarle una propuesta formal. Haz clic en el ícono de Documento (Generar cotización) en la fila del cliente destacado para abrir el cotizador de transductores biomédicos.",
      showActionButton: true,
      actionButtonText: "Simular Clic en Cotizar 📄",
    },
    {
      title: "Paso 2.1: El Creador de Cotizaciones",
      selector: '[data-tour="quote-modal"]',
      position: "left",
      icon: FileText,
      iconColor: "#059669",
      iconBg: "#ECFDF5",
      concept: "Estructura de la propuesta comercial",
      actionDesc: "Selecciona el servicio y calcula el total",
      description: "Este es el cotizador oficial de Bionordi. Aquí puedes elegir el tipo de transductor (Convex, Lineal), registrar la serie e ingresar la falla reportada. Al dar clic al botón de abajo, simularé la creación de la cotización y el PDF en el sistema por ti de forma ultra-rápida.",
      showActionButton: true,
      actionButtonText: "Generar Cotización de Prueba 📄",
    },
    {
      title: "Paso 3: Crear Orden de Servicio (Taller)",
      selector: '[data-tour="tour-new-order-btn"]',
      position: "bottom",
      icon: Wrench,
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF",
      concept: "El ingreso del equipo al laboratorio técnico",
      actionDesc: "Abre el registro de Órdenes de Trabajo (OT)",
      description: "¡Genial! Cotización generada y aprobada por el cliente. Ahora nos ha entregado físicamente el equipo en el laboratorio. El tercer paso fundamental es registrar la entrada del equipo al Taller. Haz clic en el botón 'Nueva Orden' para ver cómo se hace.",
      showActionButton: true,
      actionButtonText: "Simular Clic en Nueva Orden 🛠️",
    },
    {
      title: "Paso 3.1: Registro Técnico de Orden (OT)",
      selector: '[data-tour="tour-new-order-modal"]',
      position: "left",
      icon: Wrench,
      iconColor: "#7C3AED",
      iconBg: "#F5F3FF",
      concept: "Garantías, técnicos y entregas",
      actionDesc: "Vincula al cliente y detalla el equipo",
      description: "En este formulario seleccionas al cliente de prueba, describes la marca y serie del equipo, asignas un ingeniero de servicio y fijas la fecha de entrega. Da clic en el botón de abajo y crearé la Orden de Servicio en el laboratorio por ti.",
      showActionButton: true,
      actionButtonText: "Crear Orden de Servicio de Prueba 🛠️",
    },
    {
      title: "Flujo Operativo Completado",
      selector: '[data-tour="pipeline-funnel"]',
      position: "bottom",
      icon: Navigation,
      iconColor: "#EA580C",
      iconBg: "#FFF7ED",
      concept: "La regla de oro de Bionordi CRM",
      actionDesc: "Lead ➔ Cotización ➔ Orden de Servicio",
      description: "¡Excelente trabajo! Has aprendido cómo opera el sistema de la mano de un flujo real. Recuerda que esta secuencia te garantiza que tu administración sea impecable: 1. Guardar cliente, 2. Cotizar propuesta, 3. Registrar orden en taller.",
    },
    {
      title: "Limpieza automática de base de datos",
      icon: Sparkles,
      iconColor: "#34A853",
      iconBg: "#EEF9F1",
      concept: " CRM Impecable y Listo",
      actionDesc: "Borrado de todos los datos ficticios",
      description: "Para no contaminar tus métricas de ventas reales, al hacer clic en el botón de abajo eliminaré automáticamente de la base de datos el lead de prueba, la cotización simulada y la orden de servicio en una sola transacción. ¡Todo quedará perfectamente limpio!",
      showActionButton: true,
      actionButtonText: "Limpiar Datos y Terminar ✨",
    },
  ];

  // Iniciar automáticamente o vía URL param ?runTour=true
  useEffect(() => {
    const runParam = searchParams.get("runTour");
    const completed = localStorage.getItem("bionordi-tour-completed");

    if (runParam === "true") {
      // Limpiar query params sin causar refresco
      const url = new URL(window.location.href);
      url.searchParams.delete("runTour");
      window.history.replaceState({}, "", url.toString());

      setActive(true);
      setStepIndex(0);
    } else if (!completed) {
      const timer = setTimeout(() => {
        setActive(true);
        setStepIndex(0);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const activeStep = STEPS[stepIndex];

  // Recuperar ID del lead de prueba si se recargó la página
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = localStorage.getItem("bionordi-tutorial-lead-id");
      if (savedId) {
        setTutorialLeadId(Number(savedId));
      }
    }
  }, []);

  // Avanzar pasos automáticamente al detectar apertura de modales en pantalla
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      // Si estamos en paso 3 (esperando cotizar) y se abre el QuoteModal, avanzar
      if (stepIndex === 2 && document.querySelector('[data-tour="quote-modal"]')) {
        setStepIndex(3);
      }
      // Si estamos en paso 5 (esperando nueva orden) y se abre NuevaOrdenModal, avanzar
      if (stepIndex === 4 && document.querySelector('[data-tour="tour-new-order-modal"]')) {
        setStepIndex(5);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [active, stepIndex]);

  // Actualizar coordenadas del spotlight de forma "fixed" (viewport-relative)
  useEffect(() => {
    if (!active || !activeStep.selector) {
      setCoords(null);
      return;
    }

    let cancelled = false;

    const applyCoords = (el: Element) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const rect = el.getBoundingClientRect();
      setCoords({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };

    // Reintenta hasta 5 segundos para cubrir navegaciones con fetch async
    let attempts = 0;
    const tryFind = () => {
      if (cancelled) return;
      const el = document.querySelector(activeStep.selector!);
      if (el) {
        applyCoords(el);
      } else if (attempts < 20) {
        attempts++;
        setTimeout(tryFind, 250);
      } else {
        setCoords(null);
      }
    };
    const timer = setTimeout(tryFind, 150);

    const onResize = () => {
      const el = document.querySelector(activeStep.selector!);
      if (el) applyCoords(el);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [active, stepIndex, activeStep.selector]);

  if (!active) return null;

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(p => p + 1);
    } else {
      handleClose();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(p => p - 1);
    }
  };

  const handleClose = () => {
    localStorage.setItem("bionordi-tour-completed", "true");
    setActive(false);
  };

  const markDone = (idx: number) =>
    setCompletedSteps(prev => new Set(prev).add(idx));

  // Acciones didácticas interactivas
  const executeActionButton = async () => {
    setLoading(true);
    try {
      if (stepIndex === 0) {
        const res = await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: "🧪 Dr. Armando Ríos (Tutorial Bionordi)",
            telefono: "5551234567",
            whatsapp: "5551234567",
            ciudad: "Metepec",
            estado_republica: "EdoMex",
            nicho: "Cardiología",
            notas: "Prospecto de prueba del tutorial interactivo.",
            status_crm: "nuevo"
          })
        }).then(r => r.json());

        if (res.lead && res.lead.id) {
          setTutorialLeadId(res.lead.id);
          localStorage.setItem("bionordi-tutorial-lead-id", String(res.lead.id));
          markDone(0);
          setStepIndex(1);
          router.push("/crm?q=Tutorial");
        }
      }
      else if (stepIndex === 2) {
        const btn = document.querySelector('button[data-tour="tour-quote-btn"]') as HTMLButtonElement;
        if (btn) {
          btn.click();
          markDone(2);
          setStepIndex(3);
        }
      }
      else if (stepIndex === 3) {
        if (tutorialLeadId) {
          await fetch("/api/cotizaciones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: tutorialLeadId,
              tipo: "reparacion",
              monto_total: 6500,
              items_json: [{ nombre: "Reparación transductor convex", precio: 6500 }],
              eq_tipo: "Convex",
              eq_marca: "GE",
              eq_modelo: "C1-5",
              eq_descripcion: "Fuga de gel en membrana",
              status: "generada"
            })
          });

          await fetch("/api/leads", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: tutorialLeadId, status_crm: "seguimiento" })
          });

          const closeBtn = document.querySelector('[data-tour="quote-modal"] button') as HTMLButtonElement;
          if (closeBtn) closeBtn.click();

          markDone(3);
          setStepIndex(4);
          router.push("/taller");
        }
      }
      else if (stepIndex === 4) {
        const btn = document.querySelector('[data-tour="tour-new-order-btn"]') as HTMLButtonElement;
        if (btn) {
          btn.click();
          markDone(4);
          setStepIndex(5);
        }
      }
      else if (stepIndex === 5) {
        if (tutorialLeadId) {
          await fetch("/api/ordenes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: tutorialLeadId,
              tipo_orden: "reparacion",
              equipo_tipo: "Transductor Convex",
              equipo_marca: "GE",
              equipo_modelo: "C1-5",
              equipo_num_serie: "SN-987654",
              falla_reportada: "Fuga de gel en membrana",
              presupuesto: 6500,
              status: "recibido",
              tecnico: "Ing. Residente (Tutorial)"
            })
          });

          const closeBtn = document.querySelector('[data-tour="tour-new-order-modal"] button') as HTMLButtonElement;
          if (closeBtn) closeBtn.click();

          markDone(5);
          setStepIndex(6);
          router.push("/");
        }
      }
      else if (stepIndex === 7) {
        if (tutorialLeadId) {
          await fetch("/api/leads", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: tutorialLeadId })
          });
        }
        localStorage.removeItem("bionordi-tutorial-lead-id");
        localStorage.setItem("bionordi-tour-completed", "true");
        markDone(7);
        setActive(false);
      }
    } catch (e) {
      console.error("Error en simulación del tutorial:", e);
    }
    setLoading(false);
  };

  const StepIcon = activeStep.icon;

  const getTooltipStyle = () => {
    if (!coords) {
      return {
        position: "fixed" as const,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(460px, 92vw)",
        zIndex: 110,
      };
    }

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    if (isMobile) {
      return {
        position: "fixed" as const,
        bottom: "16px",
        left: "12px",
        right: "12px",
        width: "calc(100% - 24px)",
        zIndex: 110,
      };
    }

    const { top, left, width, height } = coords;
    const pos = activeStep.position || "bottom";
    const margin = 16;

    switch (pos) {
      case "top":
        return {
          position: "fixed" as const,
          top: `${top - margin}px`,
          left: `${left + width / 2}px`,
          transform: "translate(-50%, -100%)",
          width: "360px",
          zIndex: 110,
        };
      case "left":
        return {
          position: "fixed" as const,
          top: `${top + height / 2}px`,
          left: `${left - margin}px`,
          transform: "translate(-100%, -50%)",
          width: "360px",
          zIndex: 110,
        };
      case "right":
        return {
          position: "fixed" as const,
          top: `${top + height / 2}px`,
          left: `${left + width + margin}px`,
          transform: "translate(0, -50%)",
          width: "360px",
          zIndex: 110,
        };
      case "bottom":
      default:
        return {
          position: "fixed" as const,
          top: `${top + height + margin}px`,
          left: `${left + width / 2}px`,
          transform: "translate(-50%, 0)",
          width: "360px",
          zIndex: 110,
        };
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full font-sans select-none" style={{ pointerEvents: "auto" }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] transition-all duration-300"
        style={{ zIndex: 100 }}
        onClick={handleClose}
      />

      {/* Spotlight */}
      {coords && (
        <div
          className="rounded-[22px] border-2 border-[#4E60A9] ring-4 ring-[#4E60A9]/30 transition-all duration-300 pointer-events-none animate-pulse"
          style={{
            top: `${coords.top - 4}px`,
            left: `${coords.left - 4}px`,
            width: `${coords.width + 8}px`,
            height: `${coords.height + 8}px`,
            zIndex: 105,
            position: "fixed",
            boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65)",
          }}
        />
      )}

      {/* Dialog */}
      <div
        className="bg-white rounded-[26px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 flex flex-col overflow-hidden transition-all duration-300"
        style={getTooltipStyle()}
      >
        {/* Encabezado */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-inner shrink-0"
              style={{ backgroundColor: activeStep.iconBg }}
            >
              <StepIcon size={18} strokeWidth={2.5} style={{ color: activeStep.iconColor }} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#94A3B8]">
                Paso {stepIndex + 1} de {STEPS.length}
              </div>
              <h2 className="text-[15px] font-extrabold text-[#1E293B] leading-none mt-0.5 tracking-tight">
                {activeStep.title}
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            title="Omitir tutorial"
            className="w-7 h-7 rounded-full bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex items-center justify-center shrink-0"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Contenido didáctico */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#FAFBFD] border border-[#E8EFF8] rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-wider text-[#4E60A9] mb-1">
              💡 {activeStep.concept}
            </div>
            <div className="text-[11px] font-bold text-[#8B95A5] uppercase tracking-wider mb-2">
              🛠️ {activeStep.actionDesc}
            </div>
            <p className="text-[12.5px] leading-relaxed text-[#475569] font-medium mb-4">
              {activeStep.description}
            </p>

            {activeStep.showActionButton && (
              <button
                onClick={executeActionButton}
                disabled={loading}
                className="w-full h-11 rounded-xl text-white bg-gradient-to-r from-[#4E60A9] to-[#3B82F6] hover:brightness-105 font-bold text-[12.5px] shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
              >
                {loading ? <Activity size={15} className="animate-spin" /> : null}
                {activeStep.actionButtonText}
              </button>
            )}
          </div>
        </div>

        {/* Controles de navegación */}
        <div className="px-6 pb-5 pt-2 flex items-center justify-between bg-white border-t border-gray-50 shrink-0">
          <button
            onClick={handleClose}
            className="text-[12px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
          >
            Omitir
          </button>
          
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={handleBack}
                className="h-[38px] px-4 rounded-xl border border-gray-200 text-[#475569] hover:bg-gray-50 text-[12px] font-bold flex items-center gap-1.5 transition-colors"
              >
                <ChevronLeft size={14} strokeWidth={2.5} />
                Atrás
              </button>
            )}
            {(() => {
              const needsAction = !!activeStep.showActionButton && !completedSteps.has(stepIndex);
              return (
                <button
                  onClick={handleNext}
                  disabled={needsAction}
                  title={needsAction ? "Completá la acción para continuar" : undefined}
                  className="h-[38px] px-5 rounded-xl text-white bg-[#4E60A9] hover:bg-[#3B4CA0] text-[12px] font-bold flex items-center gap-1.5 shadow-md shadow-[#4E60A9]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {stepIndex === STEPS.length - 1 ? (
                    <>Entendido <CheckCircle2 size={14} strokeWidth={2.5} /></>
                  ) : (
                    <>Siguiente <ChevronRight size={14} strokeWidth={2.5} /></>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
