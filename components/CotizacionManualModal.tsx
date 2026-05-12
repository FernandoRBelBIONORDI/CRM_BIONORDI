"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Printer, Plus, Trash2, ChevronDown, ChevronUp, Layers, Mail, Check, AlertCircle, Save, Loader2 } from "lucide-react";

type TipoCotizacion = "reparacion" | "venta" | "mantenimiento" | "consumibles";

interface BionordiCfg {
  razonSocial: string; rfc: string; banco: string; cuenta: string;
  clabe: string; direccionFiscal: string; correo: string;
  representante: string; cargo: string;
}

interface LineItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

const USOS_CFDI = [
  { clave:"G03", desc:"Gastos en general" },
  { clave:"G01", desc:"Adquisición de mercancias" },
  { clave:"D01", desc:"Honorarios médicos" },
  { clave:"P01", desc:"Por definir" },
];

const REGIMENES = [
  { clave:"612", desc:"Personas Físicas con Act. Empresariales" },
  { clave:"601", desc:"General de Ley Personas Morales" },
  { clave:"626", desc:"Régimen Simplificado de Confianza" },
  { clave:"605", desc:"Sueldos y Salarios" },
];

const TIPOS_TRANSDUCTOR = [
  "Lineal", "Convex / Curvilíneo", "Sectorial / Phased Array",
  "Intracavitario / Endovaginal", "TEE (Transesofágico)", "3D/4D", "Microconvex", "Otro",
];

const SERVICIOS_RAPIDOS: Record<TipoCotizacion, { nombre: string; precio: number }[]> = {
  reparacion: [
    { nombre:"Diagnóstico técnico de transductor",   precio:1500  },
    { nombre:"Reparación transductor lineal",         precio:6500  },
    { nombre:"Reparación transductor convex",         precio:6500  },
    { nombre:"Reparación transductor sectorial",      precio:7500  },
    { nombre:"Reparación transductor intracavitario", precio:8500  },
    { nombre:"Reparación transductor TEE",            precio:12000 },
    { nombre:"Reparación transductor 3D/4D",          precio:9500  },
    { nombre:"Cambio de cable del transductor",       precio:3200  },
    { nombre:"Reencapsulado (carcasa)",               precio:2800  },
  ],
  mantenimiento: [
    { nombre:"Mantenimiento preventivo",              precio:2500  },
    { nombre:"Limpieza y calibración",                precio:1800  },
    { nombre:"Revisión general de sistema",           precio:3500  },
    { nombre:"Mantenimiento correctivo",              precio:4500  },
  ],
  venta: [],
  consumibles: [
    { nombre:"Gel conductor de ultrasonido 1 L",          precio:150  },
    { nombre:"Gel conductor de ultrasonido 5 L",          precio:580  },
    { nombre:"Fundas desechables para transductor c/100", precio:320  },
    { nombre:"Papel térmico para impresora de US (3 rollos)", precio:95 },
    { nombre:"Alcohol isopropílico 1 L",                  precio:120  },
    { nombre:"Solución limpiadora para transductores",    precio:280  },
    { nombre:"Bolsas esterilizables para transductor c/10",precio:450 },
    { nombre:"Electrodos desechables c/50",               precio:180  },
    { nombre:"Paño absorbente/desechable c/100",          precio:95   },
  ],
};

const TIPO_LABELS: Record<TipoCotizacion, string> = {
  reparacion:    "Reparación de Transductores",
  venta:         "Venta de Equipo",
  mantenimiento: "Mantenimiento de Equipo",
  consumibles:   "Venta de Consumibles",
};

const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";
const sel = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white appearance-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), descripcion: "", cantidad: 1, precioUnit: 0 };
}

async function generarPDFBase64(htmlString: string): Promise<string> {
  // Primario: Puppeteer server-side (alta calidad — requiere chromium-browser en Railway)
  try {
    const res = await fetch("/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlString }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.base64) return data.base64;
    }
    console.warn("[pdf] server falló, usando fallback client-side");
  } catch { /* fallback */ }

  // Fallback: html2canvas + jspdf en el browser (si Puppeteer no está disponible)
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed", top: "0", left: "-9999px",
      width: "794px", height: "1123px", border: "none", opacity: "0", pointerEvents: "none",
    });
    document.body.appendChild(iframe);
    const cleanup = () => { try { document.body.removeChild(iframe); } catch {} };

    iframe.onload = async () => {
      try {
        await new Promise(r => setTimeout(r, 800));
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");
        const doc = iframe.contentDocument;
        if (!doc) { cleanup(); reject(new Error("No se pudo acceder al iframe")); return; }
        
        // Simular page-breaks para html2canvas (ya que no los soporta nativamente)
        const A4_HEIGHT = 1123;
        const elementsToCheck = doc.querySelectorAll('table, [style*="page-break-before:always"], [style*="page-break-before: always"], .avoid-break');
        
        elementsToCheck.forEach(el => {
          // Medir posición actual (puede haber cambiado si empujamos elementos previos)
          const rect = el.getBoundingClientRect();
          const isPageBreak = el.tagName === 'TABLE' || (el.getAttribute('style') || '').includes('page-break-before');
          
          if (isPageBreak) {
            const currentPos = rect.top;
            const pageNumber = Math.floor(currentPos / A4_HEIGHT);
            const nextPagePos = (pageNumber + 1) * A4_HEIGHT + 40; // +40px de margen en nueva hoja
            const pushAmount = nextPagePos - currentPos;
            // Solo empujar si no está ya justo al principio de una hoja
            if (pushAmount > 0 && (currentPos % A4_HEIGHT) > 50) {
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          } else {
            // avoid-break
            const topPage = Math.floor(rect.top / A4_HEIGHT);
            const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
            if (topPage !== bottomPage) { // Si el elemento cruza entre dos páginas
              const nextPagePos = bottomPage * A4_HEIGHT + 40;
              const pushAmount = nextPagePos - rect.top;
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          }
        });

        const canvas = await html2canvas(doc.documentElement, {
          scale: 3, useCORS: true, allowTaint: true,
          width: 794, windowWidth: 794, logging: false,
        });
        const pdf = new jsPDF({ format: "a4", unit: "mm", orientation: "portrait" });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgH = (canvas.height * pdfW) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        let y = 0;
        while (y < imgH) {
          if (y > 0) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, -y, pdfW, imgH);
          y += pdfH;
        }
        cleanup();
        resolve(pdf.output("datauristring").split(",")[1]);
      } catch (err) { cleanup(); reject(err); }
    };
    iframe.onerror = () => { cleanup(); reject(new Error("Error al cargar el HTML")); };
    iframe.srcdoc = htmlString;
  });
}

export default function CotizacionManualModal({
  onClose,
  initialTipo = "reparacion",
  onSuccess,
  initialLead,
}: {
  onClose: () => void;
  initialTipo?: TipoCotizacion;
  onSuccess?: (folio: string) => void;
  initialLead?: {
    id: number;
    nombre: string;
    telefono?: string;
    correo?: string;
    ciudad?: string;
    estado_republica?: string;
    direccion?: string;
  };
}) {
  // ── Estado ────────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<TipoCotizacion>(initialTipo);
  const [bn, setBn] = useState<BionordiCfg>({
    razonSocial:"Bionordi S.A. de C.V.", rfc:"—", banco:"—", cuenta:"—",
    clabe:"—", direccionFiscal:"Ciudad de México, CDMX",
    correo:"contacto@bionordi.mx", representante:"Fernando Rosas", cargo:"Director General",
  });

  // Cliente
  const [cliNombre,   setCliNombre]   = useState("");
  const [cliContacto, setCliContacto] = useState("");
  const [cliTel,      setCliTel]      = useState("");
  const [cliCorreo,   setCliCorreo]   = useState("");
  const [cliDireccion,setCliDireccion]= useState("");
  const [cliCiudad,   setCliCiudad]   = useState("");
  const [cliEstado,   setCliEstado]   = useState("");

  // Equipo (reparacion / mantenimiento)
  const [eqTipo,   setEqTipo]   = useState("");
  const [eqMarca,  setEqMarca]  = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie,  setEqSerie]  = useState("");
  const [eqFalla,  setEqFalla]  = useState("");

  // Items
  const [items, setItems] = useState<LineItem[]>([newItem()]);

  // Vincular con lead existente
  const [leadId,        setLeadId]        = useState<number | null>(null);
  const [leadSearch,    setLeadSearch]    = useState("");
  const [leadsList,     setLeadsList]     = useState<{ id: number; nombre: string; ciudad?: string; nicho?: string; telefono?: string; correo?: string; direccion?: string; estado_republica?: string }[]>([]);

  // Catálogo de equipos
  const [catalogo, setCatalogo] = useState<{
    id: number; tipo: string; marca: string; modelo: string;
    imagen_path: string; fotos_json: string | null;
    brochure_path: string | null; descripcion: string | null; notas: string | null;
  }[]>([]);
  // Modo de captura del equipo: catálogo (dropdowns) o manual (texto libre)
  const [equipoMode, setEquipoMode] = useState<"catalogo" | "manual">("catalogo");

  // Datos del equipo cargados desde el catálogo (para personalizar el PDF)
  const [eqDescripcion, setEqDescripcion] = useState("");
  const [eqFotos,       setEqFotos]       = useState<string[]>([]);
  const [eqBrochureB64, setEqBrochureB64] = useState<string | null>(null);

  // Imagen del transductor (diagrama) y evidencias fotográficas
  const [imgEquipoB64, setImgEquipoB64] = useState<string | null>(null);
  const [evidencias,   setEvidencias]   = useState<{ b64: string; caption: string }[]>([]);

  // Ajustes
  const [descuento, setDescuento] = useState(0);
  const [conIVA,    setConIVA]    = useState(true);
  const [notas,     setNotas]     = useState("");
  const [showFact,  setShowFact]  = useState(false);

  // Email
  const [emailTo,      setEmailTo]      = useState("");
  const [emailStatus,  setEmailStatus]  = useState<"idle"|"sending"|"ok"|"error">("idle");
  const [emailMsg,     setEmailMsg]     = useState("");
  const [saveStatus,   setSaveStatus]   = useState<"idle"|"saving"|"ok"|"error">("idle");

  // Cotización ya guardada en esta sesión — evita duplicados entre Generar, Guardar y Enviar
  const [savedCot, setSavedCot] = useState<{ id: number; folio: string } | null>(null);

  // Facturación
  const [facRazonSoc,  setFacRazonSoc]  = useState("");
  const [facRFC,       setFacRFC]       = useState("");
  const [facRegimen,   setFacRegimen]   = useState("612");
  const [facCFDI,      setFacCFDI]      = useState("G03");
  const [facDirFiscal, setFacDirFiscal] = useState("");
  const [facCorreo,    setFacCorreo]    = useState("");

  // ── Efectos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/catalogo").then(r => r.json()).then(d => setCatalogo(d.equipos || [])).catch(() => {});
    fetch("/api/leads").then(r => r.json()).then(d => setLeadsList(d.leads || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialLead) return;
    setLeadId(initialLead.id);
    setCliNombre(initialLead.nombre || "");
    setCliTel(initialLead.telefono || "");
    setCliCorreo(initialLead.correo || "");
    setCliCiudad(initialLead.ciudad || "");
    setCliEstado(initialLead.estado_republica || "");
    setCliDireccion(initialLead.direccion || "");
    if (initialLead.correo) setEmailTo(initialLead.correo);
  }, []);

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      const c = d.config || {};
      setBn({
        razonSocial:    c.fact_razon_social        || "Bionordi S.A. de C.V.",
        rfc:            c.fact_rfc                 || "—",
        banco:          c.fact_banco               || "—",
        cuenta:         c.fact_cuenta              || "—",
        clabe:          c.fact_clabe               || "—",
        direccionFiscal:c.fact_direccion_fiscal    || "Ciudad de México, CDMX",
        correo:         c.fact_correo_facturacion  || "contacto@bionordi.mx",
        representante:  c.nombre_representante     || "Fernando Rosas",
        cargo:          c.fact_cargo_representante || "Director General",
      });
    }).catch(() => {});
  }, []);


  const addItem = () => setItems(p => [...p, newItem()]);
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  const addRapido = (s: { nombre: string; precio: number }) => {
    setItems(p => {
      const existe = p.find(i => i.descripcion === s.nombre);
      if (existe) return p;
      const limpio = p.filter(i => i.descripcion !== "" || i.precioUnit !== 0);
      return [...limpio, { id: Math.random().toString(36).slice(2), descripcion: s.nombre, cantidad: 1, precioUnit: s.precio }];
    });
  };

  const validItems = items.filter(i => i.descripcion.trim() !== "");
  const subtotal   = validItems.reduce((a, i) => a + i.cantidad * i.precioUnit, 0);
  const descMonto  = Math.round(subtotal * descuento / 100);
  const baseNeta   = subtotal - descMonto;
  const iva        = conIVA ? Math.round(baseNeta * 0.16) : 0;
  const total      = baseNeta + iva;
  const $f = (n: number) => `$${n.toLocaleString("es-MX")}`;

  const canGenerar = cliNombre.trim() !== "" && validItems.length > 0;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  const fetchBase64 = async (path: string): Promise<string> => {
    try {
      const res = await fetch(path);
      const blob = await res.blob();
      return await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { return path; }
  };

  const seleccionarDelCatalogo = async (eq: typeof catalogo[0]) => {
    setEqMarca(eq.marca || "");
    setEqModelo(eq.modelo || "");
    setEqDescripcion(eq.descripcion || "");
    // Fotos del producto
    let fotos: string[] = [];
    if (eq.fotos_json) { try { fotos = JSON.parse(eq.fotos_json); } catch {} }
    setEqFotos(fotos);
    // Diagrama técnico del catálogo
    if (eq.imagen_path) {
      setImgEquipoB64(await fetchBase64(eq.imagen_path));
    } else {
      setImgEquipoB64(null);
    }
    // Ficha técnica (brochure) como imagen — si no es PDF la embebemos en el PDF
    if (eq.brochure_path && !eq.brochure_path.toLowerCase().endsWith('.pdf')) {
      setEqBrochureB64(await fetchBase64(eq.brochure_path));
    } else {
      setEqBrochureB64(null);
    }
  };

  const limpiarEquipoCatalogo = () => {
    setEqDescripcion(""); setEqFotos([]); setEqBrochureB64(null);
    setImgEquipoB64(null);
  };

  const handleImgEquipo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgEquipoB64(await fileToBase64(file));
  };

  const handleEvidencia = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setEvidencias(prev => {
      const next = [...prev];
      next[idx] = { b64, caption: prev[idx]?.caption || "" };
      return next;
    });
  };

  const setEvidenciaCaption = (idx: number, caption: string) => {
    setEvidencias(prev => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], caption };
      return next;
    });
  };

  const removeEvidencia = (idx: number) => {
    setEvidencias(prev => prev.filter((_, i) => i !== idx));
  };

  const buildPDFHtml = async (folioOverride?: string): Promise<{ html: string; folio: string }> => {
    let imgTransductor = "/transductor.png";
    let imgFront       = "/equipo_movil_front.png";
    let imgBack        = "/equipo_movil_back.png.png";

    if (tipo === "reparacion") {
      imgTransductor = imgEquipoB64 || await fetchBase64("/transductor.png");
    }
    if (tipo === "mantenimiento" && !imgEquipoB64) {
      [imgFront, imgBack] = await Promise.all([
        fetchBase64("/equipo_movil_front.png"),
        fetchBase64("/equipo_movil_back.png.png"),
      ]);
    }
    if (tipo === "venta" && eqFotos.length === 0) {
      [imgFront, imgBack] = await Promise.all([
        fetchBase64("/equipo_movil_front.png"),
        fetchBase64("/equipo_movil_back.png.png"),
      ]);
    }
    // Fotos del catálogo para venta (se necesita b64 para funcionar en el blob HTML)
    const eqFotosB64: string[] = tipo === "venta" && eqFotos.length > 0
      ? await Promise.all(eqFotos.slice(0, 4).map(f => fetchBase64(f)))
      : [];

    const fecha    = new Date().toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });
    const folioSuffix = tipo === "venta" ? "V" : tipo === "mantenimiento" ? "M" : tipo === "consumibles" ? "CS" : "C";
    const folio    = folioOverride || `BNRD-${new Date().getFullYear().toString().slice(-2)}-${folioSuffix}-${Date.now().toString().slice(-4)}`;
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });

    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");

    // Para reparación: párrafo de alcance específico por tipo de transductor
    const generarParrafoAlcance = (): string => {
      const nombres = validItems.map(i => i.descripcion.trim()).filter(Boolean);
      if (nombres.length === 0) return "";
      const equipoRef = [eqMarca, eqModelo].filter(Boolean).join(" ") || "el transductor";
      const listaTexto = nombres.length === 1
        ? nombres[0].toLowerCase()
        : nombres.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombres[nombres.length - 1].toLowerCase();
      const falla = eqFalla ? ` La falla reportada («${eqFalla}») ha sido evaluada y el plan de intervención contempla su resolución integral.` : "";
      let especifico = "";
      switch (eqTipo) {
        case "Lineal":
          especifico = "El transductor lineal opera en rangos de alta frecuencia (5–18 MHz), diseñado para aplicaciones vasculares, musculoesqueléticas y de tejidos superficiales. La intervención técnica contempla el reacondicionamiento del arreglo de cristales piezoeléctricos en geometría lineal, asegurando la uniformidad del haz acústico y la resolución axial óptima en toda la apertura activa del transductor.";
          break;
        case "Convex / Curvilíneo":
          especifico = "El transductor convex opera en rangos de frecuencia media-baja (2–6 MHz), ampliamente utilizado en estudios abdominales, obstétricos y pélvicos. La intervención técnica contempla el reacondicionamiento del arreglo curvilíneo de cristales, preservando la geometría del sector de imagen y garantizando la uniformidad del campo acústico en todo el rango de profundidad de exploración.";
          break;
        case "Sectorial / Phased Array":
          especifico = "El transductor sectorial phased array opera mediante un arreglo de alta densidad de elementos de pequeña huella, diseñado para la visualización de estructuras cardiacas profundas entre espacios intercostales. La intervención incluye calibración del desfase electrónico entre canales, restauración del arreglo piezoeléctrico y verificación de la integridad del cableado coaxial multi-conductor de alta precisión.";
          break;
        case "Intracavitario / Endovaginal":
          especifico = "El transductor intracavitario requiere un estándar técnico y sanitario de alta exigencia por su uso en cavidades corporales. La intervención incluye verificación rigurosa de la hermeticidad del cuerpo del transductor, restitución del material acústico del lente distal, pruebas de aislamiento eléctrico conforme a normas de seguridad para dispositivos de contacto directo con mucosas, y validación de la integridad del cable en toda su longitud.";
          break;
        case "TEE (Transesofágico)":
          especifico = "El transductor transesofágico (TEE) es un instrumento de alta complejidad clínica y técnica, utilizado en ecocardiografía intraoperatoria y en unidades de cuidados intensivos. La intervención abarca la revisión del mecanismo de articulación multiplanar distal, restitución del encapsulado de la cabeza con materiales biocompatibles, verificación del arreglo matricial de cristales y pruebas de aislamiento eléctrico conforme a la normativa IEC 60601-2-37 para transductores de contacto esofágico.";
          break;
        case "3D/4D":
          especifico = "El transductor 3D/4D incorpora un arreglo matricial de cristales que permite la adquisición volumétrica de imágenes en tiempo real mediante barrido electrónico o mecánico interno. La intervención técnica contempla la revisión del sistema de barrido, restitución del polímero acústico del lente volumétrico, verificación de la sincronía electrónica entre planos de adquisición y calibración del sistema de procesamiento de señal tridimensional.";
          break;
        case "Microconvex":
          especifico = "El transductor microconvex combina una huella de contacto reducida con un amplio campo de visión sectorial, siendo la elección preferida en neonatología, pediatría y aplicaciones cardiacas de ventana acústica restringida. La intervención contempla el reacondicionamiento del arreglo curvilíneo de pequeño radio, con especial atención a la delicadeza mecánica del ensamble de cristales y la integridad del sellado hermético del lente acústico.";
          break;
        default:
          especifico = "El equipo ha sido evaluado mediante protocolos de diagnóstico automatizado que incluyen pruebas de pulso-eco, medición de capacitancia por canal y análisis de uniformidad del campo acústico, determinando con precisión el alcance de la intervención técnica necesaria para restablecer el rendimiento óptimo del transductor.";
      }
      return `El presente presupuesto comprende la realización de los siguientes trabajos sobre ${equipoRef}: ${listaTexto}.${falla} ${especifico} El servicio incluye mano de obra especializada, refacciones y materiales necesarios, pruebas de funcionamiento conforme a protocolos técnicos establecidos, y garantía escrita de 12 meses sobre la intervención realizada.`;
    };

    const rows = validItems.map((s, i) => `
      <tr>
        <td class="c text-muted">${i + 1}</td>
        <td><div class="s-name">${s.descripcion}</div></td>
        <td class="c">${s.cantidad}</td>
        <td class="r">${$f(s.precioUnit)}</td>
        <td class="r b">${$f(s.cantidad * s.precioUnit)}</td>
      </tr>`).join("");

    const diagramaHTML = tipo === "reparacion" ? `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
      <div class="card-title">Alcance Técnico y Diagnóstico Integral${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <p class="diag-p" style="margin-bottom:8px;">
        ${eqDescripcion ? `<strong>${eqDescripcion}.</strong> ` : ""}Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>.
        Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.
      </p>
      <div class="diag-grid">
        <div style="flex:.8;position:relative;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;height:148px;overflow:hidden;">
          <img src="${imgTransductor}" alt="${eqMarca || "Transductor"} ${eqModelo || ""}" style="width:100%;height:140px;object-fit:contain;display:block;" />
          <div style="position:absolute;top:25%;left:39%;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;text-align:center;line-height:20px;border:2px solid #fff;box-sizing:border-box;transform:translate(-50%,-50%);">1</div>
          <div style="position:absolute;top:20%;left:55%;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;text-align:center;line-height:20px;border:2px solid #fff;box-sizing:border-box;transform:translate(-50%,-50%);">2</div>
          <div style="position:absolute;top:68%;left:30%;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;text-align:center;line-height:20px;border:2px solid #fff;box-sizing:border-box;transform:translate(-50%,-50%);">3</div>
          <div style="position:absolute;top:88%;left:82%;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;text-align:center;line-height:20px;border:2px solid #fff;box-sizing:border-box;transform:translate(-50%,-50%);">4</div>
        </div>
        <div class="diag-list" style="gap:8px;">
          <div class="d-item"><div class="d-num">1</div><div><strong>Lente Acústico / Membrana:</strong> Retiro del material desgastado, descontaminación del arreglo de cristales e inyección de nuevo polímero acústico con curado térmico.</div></div>
          <div class="d-item"><div class="d-num">2</div><div><strong>Carcasa y Sellado:</strong> Reencapsulado de uniones para evitar filtraciones de gel transmisor y proteger los componentes electrónicos internos.</div></div>
          <div class="d-item"><div class="d-num">3</div><div><strong>Cableado:</strong> Revisión de micro-coaxiales, verificación de continuidad eléctrica y refuerzo estructural en zonas de flexión y estrés mecánico del cableado principal.</div></div>
          <div class="d-item"><div class="d-num">4</div><div><strong>Conector:</strong> Limpieza profunda de pines de contacto, verificación de continuidad en placa base y prueba de impedancia de señal en cada canal del arreglo piezoeléctrico.</div></div>
        </div>
      </div>
    </div>`
    : tipo === "mantenimiento" ? (imgEquipoB64 ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Alcance del Mantenimiento — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Equipo"}</div>
      <p class="diag-p">
        ${eqDescripcion ? `<strong>${eqDescripcion}.</strong> ` : ""}Se realiza inspección completa de la unidad incluyendo panel de control, conectores, sistema de enfriamiento y componentes eléctricos. Cada punto es documentado antes y después del servicio.
      </p>
      <div style="display:flex;gap:20px;align-items:flex-start;margin-top:8px;">
        <div style="flex:0 0 240px;">
          <div class="img-container" style="height:200px;">
            <img src="${imgEquipoB64}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ")}" style="width:100%;height:100%;object-fit:contain;background:white;" />
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;padding-top:4px;">
          <div class="d-item"><div class="d-num">1</div><div><strong>Diagnóstico General:</strong> Revisión sistemática de todos los componentes del equipo y pruebas de funcionamiento inicial.</div></div>
          <div class="d-item"><div class="d-num">2</div><div><strong>Limpieza y Calibración:</strong> Limpieza profunda interior y exterior, ajuste de parámetros de imagen según especificaciones del fabricante.</div></div>
          <div class="d-item"><div class="d-num">3</div><div><strong>Revisión Eléctrica:</strong> Verificación de voltajes, corrientes y sistema de tierra física. Prueba de puertos de transductores.</div></div>
          <div class="d-item"><div class="d-num">4</div><div><strong>Reporte de Estado:</strong> Entrega de informe técnico con hallazgos y recomendaciones para mantenimiento preventivo futuro.</div></div>
        </div>
      </div>
    </div>` : `
    <div class="tech-card avoid-break">
      <div class="card-title">Alcance del Mantenimiento — Equipo Móvil</div>
      <p class="diag-p">Se realiza inspección completa de la unidad cubriendo panel frontal, conectores, sistema de enfriamiento y puertos traseros. Cada punto es documentado antes y después del servicio.</p>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;text-align:center;">Vista Frontal</div>
          <div class="img-container" style="height:200px;">
            <img src="${imgFront}" alt="Equipo Móvil Frente" style="width:100%;height:100%;object-fit:contain;background:white;" />
            <div class="dot" style="top:12%;left:50%;transform:translateX(-50%);">1</div>
            <div class="dot" style="top:42%;left:18%;">2</div>
            <div class="dot" style="top:42%;right:18%;">3</div>
            <div class="dot" style="bottom:18%;left:50%;transform:translateX(-50%);">4</div>
          </div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
            <div class="d-item"><div class="d-num">1</div><div><strong>Pantalla / Display:</strong> Revisión de píxeles, brillo, contraste y calibración de imagen.</div></div>
            <div class="d-item"><div class="d-num">2</div><div><strong>Panel de Control:</strong> Limpieza profunda de teclado, trackball y encoders rotatorios.</div></div>
            <div class="d-item"><div class="d-num">3</div><div><strong>Puertos de Transductores:</strong> Inspección de pines, limpieza de conectores y prueba de continuidad.</div></div>
            <div class="d-item"><div class="d-num">4</div><div><strong>Base / Ruedas:</strong> Revisión de frenos, ruedas y estructura del chasis.</div></div>
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;text-align:center;">Vista Posterior</div>
          <div class="img-container" style="height:200px;">
            <img src="${imgBack}" alt="Equipo Móvil Trasera" style="width:100%;height:100%;object-fit:contain;background:white;" />
            <div class="dot" style="top:15%;left:50%;transform:translateX(-50%);">A</div>
            <div class="dot" style="top:45%;right:15%;">B</div>
            <div class="dot" style="bottom:20%;left:30%;">C</div>
          </div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
            <div class="d-item"><div class="d-num" style="background:#FEF3C7;color:#92400E;">A</div><div><strong>Rejillas de Ventilación:</strong> Limpieza de filtros de polvo y verificación del flujo de aire del sistema de enfriamiento.</div></div>
            <div class="d-item"><div class="d-num" style="background:#FEF3C7;color:#92400E;">B</div><div><strong>Conector de Alimentación:</strong> Revisión del cable de poder, protección contra sobretensión y tierra física.</div></div>
            <div class="d-item"><div class="d-num" style="background:#FEF3C7;color:#92400E;">C</div><div><strong>Puertos USB / Red / Video:</strong> Prueba funcional de puertos y limpieza de contactos.</div></div>
          </div>
        </div>
      </div>
    </div>`)
    : tipo === "venta" ? (eqFotosB64.length > 0 ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Galería del Equipo — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Producto"}</div>
      ${eqDescripcion ? `<p class="diag-p">${eqDescripcion}</p>` : ""}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
        ${eqFotosB64.map((b64, i) => `
          <div style="flex:1;min-width:150px;max-width:220px;">
            <img src="${b64}" alt="Foto ${i+1}" style="width:100%;max-height:220px;object-fit:contain;background:white;border-radius:8px;border:1px solid #E2E8F0;" />
          </div>`).join("")}
      </div>
    </div>` : imgEquipoB64 ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Foto del Equipo — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Producto"}</div>
      ${eqDescripcion ? `<p class="diag-p">${eqDescripcion}</p>` : ""}
      <div style="display:flex;justify-content:center;margin-top:8px;">
        <img src="${imgEquipoB64}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Equipo"}" style="max-width:340px;max-height:300px;object-fit:contain;background:white;border-radius:8px;border:1px solid #E2E8F0;" />
      </div>
    </div>` : `
    <div class="tech-card avoid-break">
      <div class="card-title">Características del Equipo — Vista de Referencia</div>
      <p class="diag-p">Equipo portátil de ultrasonido. Se incluyen vistas frontal y posterior para referencia de especificaciones y puntos de inspección en recepción.</p>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;text-align:center;">Vista Frontal</div>
          <div class="img-container" style="height:200px;"><img src="${imgFront}" alt="Equipo Frente" style="width:100%;height:100%;object-fit:contain;background:white;" /></div>
        </div>
        <div style="flex:1;">
          <div style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;text-align:center;">Vista Posterior</div>
          <div class="img-container" style="height:200px;"><img src="${imgBack}" alt="Equipo Trasera" style="width:100%;height:100%;object-fit:contain;background:white;" /></div>
        </div>
      </div>
    </div>`) : "";

    const evidenciaLabel = tipo === "reparacion" ? "Evidencia Fotográfica del Defecto"
      : tipo === "mantenimiento" ? "Fotos del Mantenimiento"
      : tipo === "venta" ? "Fotos del Equipo"
      : "Fotos de Productos";
    const evidenciaColor = tipo === "reparacion" ? "#B91C1C" : "#4E60A9";
    const evidenciaBorder = tipo === "reparacion" ? "#FECACA" : "#E2E8F0";
    const evidenciaImgBorder = tipo === "reparacion" ? "#FECACA" : "#E2E8F0";
    const evidenciaTextColor = tipo === "reparacion" ? "#7F1D1D" : "#475569";
    const evidenciaHTML = evidencias.length > 0 ? `
    <div class="tech-card" style="margin-top:10px;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid;">
      <div class="card-title" style="color:${evidenciaColor};border-bottom-color:${evidenciaBorder};">${evidenciaLabel}</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        ${evidencias.map((ev, i) => `
          <div style="flex:1;min-width:130px;max-width:200px;">
            <img src="${ev.b64}" alt="Evidencia ${i+1}" style="width:100%;max-height:140px;object-fit:contain;background:white;border-radius:6px;border:1px solid ${evidenciaImgBorder};" />
            <div style="margin-top:4px;font-size:9px;color:${evidenciaTextColor};font-weight:600;text-align:center;">
              Foto ${i+1}${ev.caption ? ` — ${ev.caption}` : ""}
            </div>
          </div>`).join("")}
      </div>
    </div>` : "";

    // Ficha técnica embebida (brochure como imagen del catálogo)
    const brochureHTML = eqBrochureB64 ? `
    <div class="tech-card avoid-break" style="margin-bottom:20px;">
      <div class="card-title">Ficha Técnica del Equipo${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <img src="${eqBrochureB64}" alt="Ficha técnica" style="width:100%;max-height:520px;object-fit:contain;margin-top:10px;border-radius:6px;border:1px solid #E2E8F0;" />
    </div>` : "";

    const equipoHTML = (tipo === "reparacion" || tipo === "mantenimiento") && (eqTipo || eqMarca || eqModelo || eqSerie || eqFalla) ? `
    <div class="eq-card">
      <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Especificaciones del Equipo</div>
      <div class="eq-grid">
        <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie || "—"}</div></div>
        ${eqDescripcion && tipo !== "reparacion" ? `<div class="eq-full"><div class="eq-lbl">Descripción</div><div class="eq-val" style="margin-top:2px;">${eqDescripcion}</div></div>` : ""}
        ${eqFalla ? `<div class="eq-full"><div class="eq-lbl" style="color:#B91C1C;">Falla Reportada / Síntoma</div><div class="eq-val" style="color:#7F1D1D;margin-top:2px;">${eqFalla}</div></div>` : ""}
      </div>
    </div>`
    : tipo === "venta" && (eqMarca || eqModelo || eqTipo) ? `
    <div class="eq-card">
      <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Equipo Cotizado</div>
      <div class="eq-grid">
        ${eqTipo ? `<div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo}</div></div>` : ""}
        ${eqMarca ? `<div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca}</div></div>` : ""}
        ${eqModelo ? `<div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo}</div></div>` : ""}
        ${eqSerie ? `<div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie}</div></div>` : ""}
        ${eqDescripcion ? `<div class="eq-full"><div class="eq-lbl">Descripción</div><div class="eq-val" style="margin-top:2px;">${eqDescripcion}</div></div>` : ""}
      </div>
    </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/>
<title>Cotización ${folio} · Bionordi</title>
<style>
  @page{margin:20mm 0 15mm 0}
  @page:first{margin-top:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{padding:40px 70px;max-width:850px;margin:0 auto}
  .avoid-break{page-break-inside:avoid}
  .text-muted{color:#94A3B8}.b{font-weight:700}.c{text-align:center}.r{text-align:right}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:15px}
  .logo{font-size:34px;font-weight:900;color:#4E60A9;letter-spacing:-1px;line-height:1}
  .logo span{color:#38AD64}
  .logo-sub{font-size:10px;font-weight:600;color:#64748B;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}
  .meta-box{text-align:right}
  .doc-title{font-size:18px;font-weight:300;color:#94A3B8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
  .meta-grid{display:grid;grid-template-columns:auto auto;gap:4px 15px;justify-content:end;font-size:11px}
  .meta-lbl{font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px}
  .meta-val{color:#1E293B;font-weight:600}
  .divider{height:4px;background:linear-gradient(90deg,#4E60A9,#38AD64,#E2E8F0);border-radius:4px;margin-bottom:15px}
  .info-section{display:flex;gap:20px;margin-bottom:12px}
  .info-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px 16px}
  .card-title{font-size:10px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #E2E8F0;padding-bottom:6px}
  .i-row{display:flex;margin-bottom:5px;font-size:11px;line-height:1.4}
  .i-lbl{width:85px;color:#64748B;font-weight:700}
  .i-val{flex:1;color:#1E293B;font-weight:500}
  .eq-card{background:#fff;border:1px solid #CBD5E1;border-radius:12px;padding:12px 16px;margin-bottom:12px;border-left:4px solid #4E60A9}
  .eq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
  .eq-item{display:flex;flex-direction:column;gap:4px}
  .eq-lbl{font-size:9px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
  .eq-val{font-size:12px;color:#0F172A;font-weight:600}
  .eq-full{grid-column:span 4;background:#FEF2F2;padding:8px 12px;border-radius:8px;border-left:3px solid #EF4444;margin-top:5px}
  .tech-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px 16px;margin-top:12px;margin-bottom:12px}
  .diag-p{font-size:11px;color:#475569;line-height:1.5;margin-bottom:15px}
  .diag-grid{display:flex;gap:20px;align-items:center}
  .img-container{flex:.8;position:relative;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .dot{position:absolute;width:18px;height:18px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);border:2px solid #fff}
  .diag-list{flex:1.2;display:flex;flex-direction:column;gap:12px}
  .d-item{display:flex;gap:10px;font-size:10.5px;color:#334155;line-height:1.4;align-items:flex-start}
  .d-num{width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
  table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px;page-break-before:always}
  th{background:#F1F5F9;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;padding:10px 15px;text-align:left;letter-spacing:1px;border-bottom:2px solid #CBD5E1}
  th:first-child{border-top-left-radius:8px;border-bottom-left-radius:8px}
  th:last-child{border-top-right-radius:8px;border-bottom-right-radius:8px}
  td{padding:12px 15px;font-size:12px;color:#1E293B;border-bottom:1px solid #E2E8F0;vertical-align:middle}
  .s-name{font-weight:600;color:#0F172A}
  .bottom-flex{display:flex;gap:20px;margin-bottom:25px;align-items:flex-start}
  .totals-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px}
  .t-row{display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:8px}
  .t-row .t-val{font-weight:600;color:#1E293B}
  .t-row.final{border-top:2px solid #E2E8F0;padding-top:12px;margin-top:4px;font-size:16px;font-weight:900;color:#4E60A9}
  .t-row.final .t-val{color:#4E60A9}
  .billing-instructions{flex:1;background:#EEF0F7;border:1px solid #C5CAE0;border-radius:12px;padding:16px}
  .billing-instructions .card-title{color:#4E60A9;border-bottom-color:#C5CAE0}
  .b-step{display:flex;gap:8px;font-size:10.5px;color:#4E60A9;margin-bottom:8px;line-height:1.4}
  .b-step strong{font-weight:800}
  .b-icon{font-weight:bold;color:#4E60A9}
  .cond-section{margin-bottom:20px;page-break-inside:avoid}
  .cond-title{font-size:11px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .cond-list{list-style:none;padding:0}
  .cond-list li{position:relative;padding-left:14px;font-size:10px;color:#475569;margin-bottom:6px;line-height:1.5}
  .cond-list li::before{content:"•";position:absolute;left:0;color:#38AD64;font-weight:bold;font-size:14px;line-height:1;top:-1px}
  .signatures{margin-top:40px;display:flex;justify-content:flex-end;page-break-inside:avoid}
  .sig-box{text-align:center;width:240px}
  .sig-line{border-top:2px solid #CBD5E1;margin-bottom:10px;padding-top:10px}
  .sig-name{font-size:13px;font-weight:800;color:#4E60A9}
  .sig-role{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;margin-top:2px}
  .footer{text-align:center;border-top:1px solid #E2E8F0;padding-top:15px;margin-top:30px;font-size:10px;color:#94A3B8;line-height:1.6}
  @media print{body{padding:0}.page{padding:40px 70px}}
</style>
</head>
<body><div class="page">

<div class="hdr">
  <div>
    <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:52px;width:auto;display:block;" />
  </div>
  <div class="meta-box">
    <div class="doc-title">${TIPO_LABELS[tipo]}</div>
    <div class="meta-grid">
      <div class="meta-lbl">Folio</div><div class="meta-val">${folio}</div>
      <div class="meta-lbl">Fecha</div><div class="meta-val">${fecha}</div>
    </div>
  </div>
</div>
<div class="divider"></div>

<div class="info-section">
  <div class="info-card">
    <div class="card-title">Datos del Cliente</div>
    <div class="i-row"><div class="i-lbl">Cliente</div><div class="i-val">${cliNombre || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Contacto</div><div class="i-val">${cliContacto || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Teléfono</div><div class="i-val">${cliTel || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Correo</div><div class="i-val">${cliCorreo || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${[cliDireccion, cliCiudad, cliEstado].filter(Boolean).join(", ") || "—"}</div></div>
  </div>
  <div class="info-card">
    <div class="card-title">Datos de Transferencia</div>
    <div class="i-row"><div class="i-lbl">Beneficiario</div><div class="i-val">${bn.razonSocial}</div></div>
    <div class="i-row"><div class="i-lbl">RFC</div><div class="i-val">${bn.rfc}</div></div>
    <div class="i-row"><div class="i-lbl">Banco</div><div class="i-val">${bn.banco}</div></div>
    <div class="i-row"><div class="i-lbl">Cuenta</div><div class="i-val">${bn.cuenta}</div></div>
    <div class="i-row"><div class="i-lbl">CLABE</div><div class="i-val">${bn.clabe}</div></div>
  </div>
</div>

${equipoHTML}
${diagramaHTML}
${evidenciaHTML}
${brochureHTML}

${tipo === "reparacion" ? `
<div class="tech-card avoid-break" style="margin-bottom:20px;border-left:4px solid #4E60A9;page-break-before:always;">
  <div class="card-title">Propuesta Técnica de Servicio</div>
  <p style="font-size:12px;color:#334155;line-height:1.75;margin-bottom:16px;">${generarParrafoAlcance()}</p>
  <div style="background:#EEF0F7;border:1px solid #C5CAE0;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inversión Total del Servicio</div>
      <div style="font-size:11px;color:#4E60A9;">Incluye materiales, mano de obra y garantía de 12 meses</div>
    </div>
    <div style="text-align:right;">
      ${descuento > 0 ? `<div style="font-size:11px;color:#94A3B8;text-decoration:line-through;margin-bottom:2px;">${$f(subtotal)}</div>` : ""}
      <div style="font-size:28px;font-weight:900;color:#4E60A9;letter-spacing:-1px;">${$f(total)}</div>
      ${conIVA ? `<div style="font-size:9px;color:#38AD64;font-weight:700;">IVA incluido</div>` : `<div style="font-size:9px;color:#64748B;">Más IVA</div>`}
    </div>
  </div>
</div>` : `
<table>
  <thead><tr>
    <th class="c" style="width:50px;">Item</th>
    <th>Descripción</th>
    <th class="c" style="width:60px;">Cant.</th>
    <th class="r" style="width:120px;">Precio Unit.</th>
    <th class="r" style="width:120px;">Importe</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>`}

${notas ? `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:9px 13px;margin-bottom:20px;font-size:11px;color:#92400E;border-radius:0 4px 4px 0;"><strong>Notas:</strong> ${notas}</div>` : ""}

<div class="bottom-flex avoid-break">
  <div class="billing-instructions">
    <div class="card-title">Instrucciones para Solicitar Factura</div>
    <div class="b-step"><span class="b-icon">1.</span><div>Realice el pago total o anticipo a la cuenta CLABE indicada arriba.</div></div>
    <div class="b-step"><span class="b-icon">2.</span><div>Envíe un correo a <strong>${bn.correo}</strong> adjuntando comprobante de pago y Constancia de Situación Fiscal.</div></div>
    <div class="b-step"><span class="b-icon">3.</span><div>Indique su <strong>Uso de CFDI</strong> (${facCFDI || "G03"}) en el correo.</div></div>
    <div class="b-step"><span class="b-icon">4.</span><div>Su factura será procesada en un lapso no mayor a 24 horas hábiles.</div></div>
  </div>
  <div class="totals-card">
    ${tipo !== "reparacion" ? `
    <div class="t-row"><div>Subtotal</div><div class="t-val">${$f(subtotal)}</div></div>
    ${descuento > 0 ? `<div class="t-row"><div>Descuento (${descuento}%)</div><div class="t-val" style="color:#EF4444;">−${$f(descMonto)}</div></div>` : ""}
    ${conIVA ? `<div class="t-row"><div>IVA (16%)</div><div class="t-val">${$f(iva)}</div></div>` : ""}` : ""}
    <div class="t-row final"><div>Total (MXN)</div><div class="t-val">${$f(total)}</div></div>
  </div>
</div>

<div class="cond-section">
  <div class="cond-title">Políticas Comerciales y Garantía</div>
  <ul class="cond-list">
    <li><strong>Vigencia:</strong> 15 días naturales (hasta el ${vigencia}).</li>
    <li><strong>Esquema de Pago:</strong> Contado 100% anticipado — o anticipo del 50% (${$f(Math.round(total / 2))}) y liquidación contra entrega.</li>
    <li><strong>Tiempo de Entrega:</strong> 5 a 7 días hábiles a partir del ingreso del equipo y validación de anticipo.</li>
    ${tipo === "reparacion" ? `<li><strong>Garantía:</strong> 12 meses sobre la reparación. No cubre daños por caídas, tirones de cable o derrames posteriores a la entrega.</li>` : ""}
    ${tipo === "mantenimiento" ? `<li><strong>Garantía:</strong> 3 meses sobre el servicio de mantenimiento realizado.</li>` : ""}
    ${tipo === "consumibles" ? `<li><strong>Devoluciones:</strong> Se aceptan en 7 días naturales con producto sin abrir y en empaque original.</li>` : ""}
  </ul>
</div>

<div class="signatures">
  <div class="sig-box">
    <div class="sig-line">
      <div class="sig-name">${bn.representante}</div>
      <div class="sig-role">${bn.cargo}</div>
      <div class="sig-role" style="color:#4E60A9;font-weight:800;margin-top:4px;">${bn.razonSocial}</div>
    </div>
  </div>
</div>

<div class="footer">
  <strong>${bn.razonSocial}</strong> · ${bn.direccionFiscal} · ${bn.correo}<br/>
  Documento generado digitalmente por el sistema de Gestión Bionordi.
</div>

</div></body></html>`;

    return { html, folio };
  };

  const generarPDF = async () => {
    const { html, folio } = await buildPDFHtml(savedCot?.folio);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => setTimeout(() => { w.focus(); w.print(); }, 300));
    setTimeout(() => URL.revokeObjectURL(url), 15000);

    if (leadId && !savedCot) {
      fetch("/api/cotizaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId, tipo, folio, monto_total: total,
          items_json: validItems.map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
          eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
          notas: notas || null, status: "enviada",
        }),
      }).then(r => r.json()).then(d => { if (d.id) setSavedCot({ id: d.id, folio }); }).catch(() => {});
    }
    onSuccess?.(folio);
  };

  const guardarEnExpediente = async () => {
    if (!leadId || !canGenerar) return;
    setSaveStatus("saving");
    try {
      const { html, folio } = await buildPDFHtml(savedCot?.folio);

      // 1. Guardar cotizacion en DB (siempre — es el paso crítico)
      let cotizacionId = savedCot?.id ?? null;
      if (!savedCot) {
        const dbRes = await fetch("/api/cotizaciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lead_id: leadId, tipo, folio, monto_total: total,
            items_json: validItems.map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
            eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
            notas: notas || null, status: "guardada",
          }),
        });
        const data = await dbRes.json();
        if (!dbRes.ok) throw new Error(data.error || "Error al guardar en base de datos");
        cotizacionId = data.id ?? null;
        if (cotizacionId) setSavedCot({ id: cotizacionId, folio });
      }

      // 2. Intentar generar PDF (no-fatal: si falla, la cotización ya está guardada)
      try {
        const pdfB64 = await generarPDFBase64(html);
        await fetch("/api/expediente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, folio, pdfBase64: pdfB64, cotizacionId }),
        });
      } catch (pdfErr) {
        console.warn("[cotizacion] PDF no generado (no fatal):", pdfErr);
      }

      setSaveStatus("ok");
      onSuccess?.(folio);
    } catch (err: any) {
      console.error("[cotizacion] error fatal al guardar:", err?.message);
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus("idle"), 5000);
  };

  const enviarPorCorreo = async () => {
    if (!emailTo.trim() || !canGenerar) return;
    setEmailStatus("sending"); setEmailMsg("");

    const origin = "https://raw.githubusercontent.com/FernandoRBelBIONORDI/BIONORDI_IMAGENES/main/IMAGENES";
    const fecha    = new Date().toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });
    const folioSuffix = tipo === "venta" ? "V" : tipo === "mantenimiento" ? "M" : tipo === "consumibles" ? "CS" : "C";
    const folio    = savedCot?.folio ?? `BNRD-${new Date().getFullYear().toString().slice(-2)}-${folioSuffix}-${Date.now().toString().slice(-4)}`;
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });

    const rowsHTML = validItems.map(s => `
      <tr style="border-bottom:1px solid #F1F5F9;">
        <td style="padding:11px 12px;font-size:13px;color:#1E293B;font-weight:600;">${s.descripcion}</td>
        <td align="center" style="padding:11px 12px;font-size:12px;color:#64748B;">${s.cantidad}</td>
        <td align="right" style="padding:11px 12px;font-size:12px;color:#64748B;">${$f(s.precioUnit)}</td>
        <td align="right" style="padding:11px 12px;font-size:13px;font-weight:700;color:#4E60A9;">${$f(s.cantidad * s.precioUnit)}</td>
      </tr>`).join("");

    // Párrafo descriptivo para el correo de reparación
    const nombresEmail = validItems.map(i => i.descripcion.trim()).filter(Boolean);
    const equipoRefEmail = [eqMarca, eqModelo].filter(Boolean).join(" ") || "el transductor indicado";
    const listaEmail = nombresEmail.length === 0 ? "los servicios acordados"
      : nombresEmail.length === 1 ? nombresEmail[0].toLowerCase()
      : nombresEmail.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombresEmail[nombresEmail.length - 1].toLowerCase();
    const fallaEmail = eqFalla ? ` La falla reportada («${eqFalla}») será atendida de manera integral.` : "";
    const parrafoEmail = `Nos complace presentarle la siguiente propuesta técnica para la realización de: ${listaEmail}, sobre ${equipoRefEmail}.${fallaEmail} El servicio comprende diagnóstico técnico especializado, mano de obra calificada, refacciones y materiales necesarios, pruebas de funcionamiento conforme a estándares técnicos establecidos, y garantía escrita de 12 meses sobre la intervención realizada. El detalle completo de la propuesta se encuentra en el PDF adjunto.`;

    const emailHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Cotizaci&#243;n ${folio}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#ffffff;">

  <tr><td height="5" bgcolor="#4E60A9" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

  <tr><td style="padding:16px 36px 14px;border-bottom:1px solid #E8EDF4;background:#ffffff;">
    <img src="${origin}/LOGO_PRINCIPAL.png" alt="Bionordi Medical Technology" height="34" border="0" style="display:block;height:34px;width:auto;" />
  </td></tr>

  <tr><td style="padding:20px 36px 18px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
    <p style="margin:0;font-size:10px;color:#64748B;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;">${TIPO_LABELS[tipo]}</p>
    <p style="margin:5px 0 0;font-size:22px;font-weight:900;color:#1E293B;letter-spacing:-0.5px;">${folio}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#94A3B8;">${fecha} &middot; Vigente hasta ${vigencia}</p>
  </td></tr>

  <tr><td style="padding:20px 36px;border-bottom:1px solid #E2E8F0;">
    <p style="margin:0 0 10px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Para</p>
    <p style="margin:0;font-size:17px;font-weight:700;color:#1E293B;">${cliNombre || "&#8212;"}</p>
    ${cliContacto ? `<p style="margin:3px 0 0;font-size:13px;color:#64748B;">${cliContacto}</p>` : ""}
    ${cliTel ? `<p style="margin:2px 0 0;font-size:12px;color:#64748B;">Tel: ${cliTel}</p>` : ""}
    ${[cliCiudad, cliEstado].filter(Boolean).length ? `<p style="margin:2px 0 0;font-size:12px;color:#94A3B8;">${[cliCiudad, cliEstado].filter(Boolean).join(", ")}</p>` : ""}
  </td></tr>

  ${(eqMarca || eqModelo || eqTipo) ? `
  <tr><td style="padding:18px 36px;background:#F8FAFC;border-bottom:1px solid #E2E8F0;">
    <p style="margin:0 0 10px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Equipo</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${eqMarca ? `<tr><td width="90" valign="top" style="padding:3px 0;font-size:12px;color:#64748B;font-weight:600;">Marca</td><td style="padding:3px 0;font-size:12px;color:#1E293B;font-weight:600;">${eqMarca}</td></tr>` : ""}
      ${eqModelo ? `<tr><td valign="top" style="padding:3px 0;font-size:12px;color:#64748B;font-weight:600;">Modelo</td><td style="padding:3px 0;font-size:12px;color:#1E293B;font-weight:600;">${eqModelo}</td></tr>` : ""}
      ${eqTipo ? `<tr><td valign="top" style="padding:3px 0;font-size:12px;color:#64748B;font-weight:600;">Tipo</td><td style="padding:3px 0;font-size:12px;color:#1E293B;">${eqTipo}</td></tr>` : ""}
      ${eqDescripcion ? `<tr><td colspan="2" style="padding:8px 0 0;font-size:11px;color:#64748B;">${eqDescripcion}</td></tr>` : ""}
      ${eqFalla ? `<tr><td colspan="2" style="padding-top:8px;"><table cellpadding="8" cellspacing="0" border="0" width="100%" style="border-left:3px solid #EF4444;background:#FEF2F2;border-collapse:collapse;"><tr><td style="font-size:12px;color:#7F1D1D;"><strong>Falla reportada:</strong> ${eqFalla}</td></tr></table></td></tr>` : ""}
    </table>
  </td></tr>` : ""}

  ${tipo === "reparacion" ? `
  <tr><td style="padding:20px 36px;border-bottom:1px solid #E2E8F0;">
    <p style="margin:0 0 12px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Alcance del Servicio</p>
    <p style="margin:0;font-size:13px;color:#334155;line-height:1.8;">${parrafoEmail}</p>
  </td></tr>
  <tr><td style="padding:20px 36px;background:#EEF0F7;border-top:2px solid #C5CAE0;">
    <p style="margin:0 0 6px;font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;">Inversi&#243;n Total del Servicio</p>
    <p style="margin:0;font-size:32px;font-weight:900;color:#4E60A9;letter-spacing:-1px;">${$f(total)}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#64748B;">Incluye materiales, mano de obra y garant&#237;a de 12 meses${conIVA ? " &middot; IVA incluido" : ""}</p>
  </td></tr>` : `
  <tr><td style="padding:20px 36px 0;">
    <p style="margin:0 0 14px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">
      ${tipo === "venta" ? "Productos" : tipo === "consumibles" ? "Consumibles" : "Servicios"}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr bgcolor="#F1F5F9">
        <th align="left" style="padding:10px 12px;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px;">Descripci&#243;n</th>
        <th width="50" align="center" style="padding:10px 12px;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;">Cant.</th>
        <th width="90" align="right" style="padding:10px 12px;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;">P.U.</th>
        <th width="100" align="right" style="padding:10px 12px;font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;">Importe</th>
      </tr>
      ${rowsHTML}
    </table>
  </td></tr>
  <tr><td style="padding:16px 36px;background:#EEF0F7;border-top:2px solid #C5CAE0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      ${descuento > 0 ? `
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#64748B;">Subtotal</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#64748B;">${$f(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#EF4444;">Descuento (${descuento}%)</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#EF4444;">&#8722;${$f(descMonto)}</td>
      </tr>` : ""}
      ${conIVA ? `
      <tr>
        <td style="padding:3px 0;font-size:12px;color:#64748B;">IVA (16%)</td>
        <td align="right" style="padding:3px 0;font-size:12px;color:#64748B;">${$f(iva)}</td>
      </tr>` : ""}
      <tr>
        <td style="padding:10px 0 0;font-size:22px;font-weight:900;color:#4E60A9;border-top:1px solid #C5CAE0;">Total (MXN)</td>
        <td align="right" style="padding:10px 0 0;font-size:22px;font-weight:900;color:#4E60A9;border-top:1px solid #C5CAE0;">${$f(total)}</td>
      </tr>
    </table>
  </td></tr>`}

  <tr><td style="padding:20px 36px;border-top:1px solid #E2E8F0;">
    <p style="margin:0 0 12px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">Datos de Transferencia</p>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td width="90" style="padding:4px 0;font-size:11px;color:#64748B;font-weight:600;">Beneficiario</td><td style="padding:4px 0;font-size:12px;color:#1E293B;font-weight:600;">${bn.razonSocial}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748B;font-weight:600;">RFC</td><td style="padding:4px 0;font-size:12px;color:#1E293B;">${bn.rfc}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748B;font-weight:600;">Banco</td><td style="padding:4px 0;font-size:12px;color:#1E293B;">${bn.banco}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748B;font-weight:600;">Cuenta</td><td style="padding:4px 0;font-size:12px;color:#1E293B;">${bn.cuenta}</td></tr>
      <tr><td style="padding:4px 0;font-size:11px;color:#64748B;font-weight:600;">CLABE</td><td style="padding:4px 0;font-size:15px;font-weight:900;color:#4E60A9;font-family:monospace;letter-spacing:1px;">${bn.clabe}</td></tr>
    </table>
  </td></tr>

  ${notas ? `
  <tr><td style="padding:14px 36px;background:#FFFBEB;border-top:1px solid #FDE68A;">
    <p style="margin:0;font-size:12px;color:#92400E;"><strong>Notas:</strong> ${notas}</p>
  </td></tr>` : ""}

  <tr><td style="padding:20px 36px;background:#1E293B;">
    <p style="margin:0;font-size:11px;color:#94A3B8;text-align:center;line-height:1.8;">
      ${bn.razonSocial} &middot; <a href="mailto:${bn.correo}" style="color:#60A5FA;text-decoration:none;">${bn.correo}</a><br>
      <span style="color:#475569;">Este presupuesto tiene vigencia de 15 d&#237;as naturales (hasta ${vigencia}).</span>
    </p>
  </td></tr>

  <tr><td height="5" bgcolor="#38AD64" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

</table>
</body></html>`;

    // Generate PDF attachment
    let attachments: { filename: string; content: string; type: string }[] = [];
    let cotizacionId: number | null = null;
    try {
      const { html: pdfHtml } = await buildPDFHtml(folio);
      const pdfB64 = await generarPDFBase64(pdfHtml);
      attachments = [{ filename: `${folio}.pdf`, content: pdfB64, type: "application/pdf" }];

      // Save to DB once — reusar el registro si ya fue guardado en esta sesión
      if (leadId) {
        cotizacionId = savedCot?.id ?? null;
        if (!savedCot) {
          const dbRes = await fetch("/api/cotizaciones", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: leadId, tipo, folio, monto_total: total,
              items_json: validItems.map(i => ({ descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
              eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
              notas: notas || null, status: "enviada",
            }),
          });
          const dbData = await dbRes.json();
          cotizacionId = dbData.id ?? null;
          if (cotizacionId) setSavedCot({ id: cotizacionId, folio });
        }

        // Save PDF to expediente
        await fetch("/api/expediente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, folio, pdfBase64: pdfB64, cotizacionId }),
        });
      }
    } catch { /* PDF generation failed — send email without attachment */ }

    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: `Cotización ${folio} — ${TIPO_LABELS[tipo]} · Bionordi`,
          html: emailHTML,
          attachments,
        }),
      });
      const data = await res.json();
      if (data.success) { setEmailStatus("ok"); setEmailMsg(`Enviado a ${emailTo}`); onSuccess?.(folio); }
      else { setEmailStatus("error"); setEmailMsg(data.error || "Error al enviar"); }
    } catch {
      setEmailStatus("error"); setEmailMsg("Error de red");
    }
    setTimeout(() => setEmailStatus("idle"), 6000);
  };

  const showEquipo = tipo !== "consumibles";
  const rapidosList = SERVICIOS_RAPIDOS[tipo] ?? [];

  // Derived catalog values — computed here so JSX stays clean (no IIFE)
  const transductores = catalogo.filter(e => e.tipo === "transductor");
  const marcasUnicas = [...new Set(transductores.map(e => e.marca).filter(Boolean))].sort() as string[];
  const modelosPorMarca = transductores.filter(e =>
    !eqMarca || equipoMode === "manual" || e.marca === eqMarca || !e.marca
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-[700px] max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-[#1E293B] text-[15px] leading-tight">{TIPO_LABELS[tipo]}</h3>
            <p className="text-[11px] text-gray-400 font-medium">Nueva cotización</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X size={15}/>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Cliente */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest mb-3">Datos del cliente</div>

            {/* Vincular con lead existente */}
            <div className="mb-4">
              {leadId ? (() => {
                const lead = leadsList.find(l => l.id === leadId);
                return (
                  <div className="flex items-center gap-3 p-3 bg-[#EEF0F7] border border-[#C5CAE0] rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#4E60A9] truncate">{lead?.nombre}</p>
                      {lead?.ciudad && <p className="text-[10px] text-[#4E60A9]">{lead.ciudad}</p>}
                    </div>
                    <button
                      onClick={() => { setLeadId(null); setLeadSearch(""); }}
                      className="text-[10px] text-[#4E60A9] hover:text-[#4E60A9] font-semibold shrink-0"
                    >
                      Cambiar
                    </button>
                  </div>
                );
              })() : (
                <div>
                  <label className="text-[11px] font-bold text-gray-500 block mb-1">Vincular con cliente del CRM <span className="font-normal text-gray-400">(opcional — guarda en historial)</span></label>
                  <div className="relative">
                    <input
                      value={leadSearch}
                      onChange={e => setLeadSearch(e.target.value)}
                      placeholder="Buscar por nombre, ciudad..."
                      className={inp}
                    />
                    {leadSearch.length > 1 && (() => {
                      const q = leadSearch.toLowerCase();
                      const matches = leadsList.filter(l =>
                        l.nombre.toLowerCase().includes(q) || (l.ciudad || "").toLowerCase().includes(q)
                      ).slice(0, 6);
                      if (matches.length === 0) return null;
                      return (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                          {matches.map(l => (
                            <button
                              key={l.id}
                              onClick={() => {
                                setLeadId(l.id);
                                setLeadSearch("");
                                setCliNombre(l.nombre || "");
                                setCliTel(l.telefono || "");
                                setCliCorreo(l.correo || "");
                                if (l.correo) setEmailTo(l.correo);
                                setCliDireccion(l.direccion || "");
                                setCliCiudad(l.ciudad || "");
                                setCliEstado(l.estado_republica || "");
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] border-b border-gray-50 last:border-0 transition-colors"
                            >
                              <p className="text-[12px] font-semibold text-[#1E293B]">{l.nombre}</p>
                              {l.ciudad && <p className="text-[10px] text-gray-400">{l.ciudad}</p>}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Nombre / Institución *">
                <input value={cliNombre} onChange={e => setCliNombre(e.target.value)} placeholder="Hospital / Clínica / Nombre" className={inp}/>
              </Field>
              <Field label="Contacto / Dr.">
                <input value={cliContacto} onChange={e => setCliContacto(e.target.value)} placeholder="Dr. Nombre Apellido" className={inp}/>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Teléfono">
                <input value={cliTel} onChange={e => setCliTel(e.target.value)} placeholder="55 0000 0000" className={inp}/>
              </Field>
              <Field label="Correo">
                <input value={cliCorreo} onChange={e => setCliCorreo(e.target.value)} placeholder="correo@ejemplo.com" className={inp}/>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Dirección">
                <input value={cliDireccion} onChange={e => setCliDireccion(e.target.value)} placeholder="Calle y número" className={inp}/>
              </Field>
              <Field label="Ciudad / Municipio">
                <input value={cliCiudad} onChange={e => setCliCiudad(e.target.value)} placeholder="Ciudad" className={inp}/>
              </Field>
              <Field label="Estado">
                <input value={cliEstado} onChange={e => setCliEstado(e.target.value)} placeholder="CDMX" className={inp}/>
              </Field>
            </div>
          </div>

          {/* Equipo */}
          {showEquipo && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">
                  {tipo === "reparacion" ? "Equipo a reparar" : tipo === "venta" ? "Equipo a cotizar" : "Equipo a dar mantenimiento"}
                </div>
                {catalogo.length > 0 && (
                  <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                    <button
                      onClick={() => { setEquipoMode("catalogo"); setEqMarca(""); setEqModelo(""); setEqTipo(""); setImgEquipoB64(null); limpiarEquipoCatalogo(); }}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${equipoMode === "catalogo" ? "bg-white text-[#4E60A9] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                      Catálogo
                    </button>
                    <button
                      onClick={() => setEquipoMode("manual")}
                      className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${equipoMode === "manual" ? "bg-white text-[#4E60A9] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}>
                      Manual
                    </button>
                  </div>
                )}
              </div>

              {/* Lista plana del catálogo para venta y mantenimiento en modo catálogo */}
              {(tipo === "venta" || tipo === "mantenimiento") && equipoMode === "catalogo" && catalogo.length > 0 && (
                <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1 mb-3">
                  {catalogo.map(eq => {
                    const desc = [eq.marca, eq.modelo].filter(Boolean).join(" — ") || eq.tipo || "Equipo";
                    return (
                      <button key={eq.id} onClick={async () => {
                        await seleccionarDelCatalogo(eq);
                        setEqTipo(eq.tipo || "");
                        if (tipo === "venta") {
                          setItems(p => {
                            const limpio = p.filter(i => i.descripcion !== "" || i.precioUnit !== 0);
                            return [...limpio, { id: Math.random().toString(36).slice(2), descripcion: desc, cantidad: 1, precioUnit: 0 }];
                          });
                        }
                      }}
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded-xl border border-gray-100 hover:border-[#4E60A9]/30 hover:bg-blue-50/50 transition-all">
                        {eq.imagen_path && (
                          <img src={eq.imagen_path} alt="" className="w-9 h-9 object-contain rounded-lg border border-gray-100 bg-white shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-bold text-[#1E293B] truncate">{eq.modelo || "Sin modelo"}</p>
                          <p className="text-[10px] text-gray-400">{[eq.marca, eq.tipo].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span className="text-[10px] font-bold text-[#4E60A9] shrink-0 flex items-center gap-1">
                          <Plus size={10} /> Agregar
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Campos para reparación (siempre) o modo manual (venta/mantenimiento) */}
              {(tipo === "reparacion" || equipoMode === "manual") && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Field label={tipo === "reparacion" ? "Tipo de transductor" : "Tipo de equipo"}>
                      {tipo === "reparacion"
                        ? <select value={eqTipo} onChange={e => setEqTipo(e.target.value)} className={sel}>
                            <option value="">— Seleccionar —</option>
                            {TIPOS_TRANSDUCTOR.map(t => <option key={t}>{t}</option>)}
                          </select>
                        : <input value={eqTipo} onChange={e => setEqTipo(e.target.value)} placeholder="Ultrasonido, Monitor de signos vitales…" className={inp}/>
                      }
                    </Field>

                    <Field label="Marca">
                      {tipo === "reparacion" && equipoMode === "catalogo" && marcasUnicas.length > 0 ? (
                        <select value={eqMarca} onChange={e => { setEqMarca(e.target.value); setEqModelo(""); setImgEquipoB64(null); }} className={sel}>
                          <option value="">— Seleccionar marca —</option>
                          {marcasUnicas.map(m => <option key={m} value={m}>{m}</option>)}
                          {transductores.some(e => !e.marca) && <option value="__sin_marca__">Sin marca especificada</option>}
                        </select>
                      ) : (
                        <input value={eqMarca} onChange={e => setEqMarca(e.target.value)}
                          placeholder="GE, Philips, Mindray…" className={inp}/>
                      )}
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <Field label="Modelo">
                      {tipo === "reparacion" && equipoMode === "catalogo" && modelosPorMarca.length > 0 ? (
                        <select value={eqModelo} onChange={async e => {
                          const found = transductores.find(t => t.modelo === e.target.value && (!eqMarca || t.marca === eqMarca));
                          setEqModelo(e.target.value);
                          if (found) await seleccionarDelCatalogo(found);
                          else setImgEquipoB64(null);
                        }} className={sel}>
                          <option value="">— Seleccionar modelo —</option>
                          {modelosPorMarca.map(e => (
                            <option key={e.id} value={e.modelo}>
                              {e.modelo}{e.imagen_path ? " ✓" : ""}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input value={eqModelo} onChange={e => setEqModelo(e.target.value)}
                          placeholder="Modelo" className={inp}/>
                      )}
                    </Field>

                    <Field label="No. de Serie">
                      <input value={eqSerie} onChange={e => setEqSerie(e.target.value)} placeholder="SN-XXXXXX" className={inp}/>
                    </Field>
                    {tipo !== "venta" && (
                      <Field label="Falla / Síntoma">
                        <input value={eqFalla} onChange={e => setEqFalla(e.target.value)} placeholder="Sin imagen, cable dañado…" className={inp}/>
                      </Field>
                    )}
                  </div>

                  {/* Subida de foto/diagrama para venta y mantenimiento en modo manual */}
                  {tipo !== "reparacion" && (
                    <div className="mt-1">
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        {tipo === "venta" ? "Foto / Diagrama del equipo" : "Foto del equipo"}
                      </label>
                      {imgEquipoB64 ? (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <img src={imgEquipoB64} alt="diagrama" className="h-8 w-12 object-contain rounded border border-blue-200 bg-white shrink-0"/>
                          <span className="text-[10px] text-blue-700 font-medium flex-1">Imagen cargada — aparecerá en el PDF</span>
                          <button onClick={() => setImgEquipoB64(null)} className="text-[10px] text-blue-400 hover:text-blue-600">Quitar</button>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-blue-200 hover:border-[#4E60A9] text-[11px] text-[#4E60A9] font-medium transition-all bg-blue-50/40 hover:bg-blue-50">
                          <Plus size={12}/>
                          Subir imagen
                          <input type="file" accept="image/*" className="hidden" onChange={handleImgEquipo}/>
                        </label>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Indicador de datos del catálogo cargados */}
              {(imgEquipoB64 || eqFotos.length > 0 || eqBrochureB64 || ((tipo === "venta" || tipo === "mantenimiento") && equipoMode === "catalogo" && (eqMarca || eqModelo))) && (
                <div className="flex items-center gap-3 mt-3 p-3 bg-[#EEF0F7] border border-[#C5CAE0] rounded-xl">
                  {eqFotos[0]
                    ? <img src={eqFotos[0]} alt="foto" className="h-10 w-14 object-cover rounded border border-blue-200 shrink-0" />
                    : imgEquipoB64
                    ? <img src={imgEquipoB64} alt="diagrama" className="h-10 w-14 object-contain rounded border border-blue-200 bg-white shrink-0" />
                    : null}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-[#4E60A9]">
                      {equipoMode === "catalogo" ? "Datos del catálogo cargados en el PDF" : "Imagen cargada en el PDF"}
                    </p>
                    <p className="text-[10px] text-[#4E60A9] mt-0.5">
                      {[imgEquipoB64 && "Diagrama técnico", eqFotos.length > 0 && `${eqFotos.length} foto(s)`, eqBrochureB64 && "Ficha técnica", (eqMarca || eqModelo) && [eqMarca, eqModelo].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
                    </p>
                    {eqDescripcion && <p className="text-[10px] text-[#4E60A9] mt-0.5 truncate">{eqDescripcion}</p>}
                  </div>
                  <button
                    onClick={() => { limpiarEquipoCatalogo(); if (tipo !== "reparacion") { setEqMarca(""); setEqModelo(""); setEqTipo(""); } }}
                    className="text-[10px] text-blue-300 hover:text-blue-500 shrink-0">Quitar</button>
                </div>
              )}
            </div>
          )}

          {/* Evidencia fotográfica / Fotos — todos los tipos */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tipo === "reparacion" ? "text-red-700" : "text-[#4E60A9]"}`}>
              {tipo === "reparacion" ? "Evidencia fotográfica del defecto" :
               tipo === "mantenimiento" ? "Fotos del mantenimiento (antes / después)" :
               tipo === "venta" ? "Fotos adicionales del equipo" :
               "Fotos de productos / referencia"}
            </div>
            {tipo === "reparacion" && imgEquipoB64 && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-200">
                <img src={imgEquipoB64} alt="diagrama" className="h-8 w-12 object-contain rounded border border-blue-200 bg-white shrink-0"/>
                <span className="text-[10px] text-blue-700 font-medium flex-1">Diagrama cargado desde catálogo</span>
                <button onClick={() => setImgEquipoB64(null)} className="text-[10px] text-blue-400 hover:text-blue-600">Quitar</button>
              </div>
            )}
            <div className="space-y-2">
              {evidencias.map((ev, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={ev.b64} alt={`ev${i}`} className={`h-10 w-16 object-cover rounded shrink-0 ${tipo === "reparacion" ? "border border-red-200" : "border border-blue-200"}`}/>
                  <input
                    value={ev.caption}
                    onChange={e => setEvidenciaCaption(i, e.target.value)}
                    placeholder={tipo === "reparacion" ? "Descripción del defecto (opcional)" : "Descripción (opcional)"}
                    className="flex-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4E60A9]/40"/>
                  <button onClick={() => removeEvidencia(i)} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 ${tipo === "reparacion" ? "text-red-300 hover:text-red-500" : "text-gray-300 hover:text-red-400"}`}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              ))}
              {evidencias.length < 4 && (
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-medium transition-all ${
                  tipo === "reparacion"
                    ? "border-red-200 hover:border-red-400 text-red-500 bg-red-50/40 hover:bg-red-50"
                    : "border-blue-200 hover:border-[#4E60A9] text-[#4E60A9] bg-blue-50/40 hover:bg-blue-50"
                }`}>
                  <Plus size={12}/>
                  {tipo === "reparacion" ? "Agregar foto de defecto" :
                   tipo === "mantenimiento" ? "Agregar foto del mantenimiento" :
                   tipo === "venta" ? "Agregar foto del equipo" :
                   "Agregar foto de producto"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => handleEvidencia(e, evidencias.length)}/>
                </label>
              )}
            </div>
          </div>


          {/* Servicios rápidos */}
          {rapidosList.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest mb-2">Agregar servicio rápido</div>
              <div className="flex flex-wrap gap-1.5">
                {rapidosList.map(s => (
                  <button key={s.nombre} onClick={() => addRapido(s)}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 hover:border-[#4E60A9]/40 hover:bg-blue-50/60 text-gray-600 font-medium transition-all">
                    {s.nombre} — <span className="text-[#4E60A9] font-bold">${s.precio.toLocaleString("es-MX")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">
                {tipo === "venta" ? "Productos / Equipos" : "Servicios"}
              </div>
              <button onClick={addItem}
                className="flex items-center gap-1 text-[11px] font-bold text-[#4E60A9] hover:bg-blue-50 px-2 py-1 rounded-lg transition-all">
                <Plus size={13}/> Agregar línea
              </button>
            </div>

            {/* Cabecera */}
            <div className="grid grid-cols-[1fr_60px_110px_90px_32px] gap-2 px-1 mb-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Descripción</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-center">Cant.</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-right">Precio Unit.</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-right">Importe</div>
              <div/>
            </div>

            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_60px_110px_90px_32px] gap-2 items-center">
                  <input
                    value={item.descripcion}
                    onChange={e => updateItem(item.id, "descripcion", e.target.value)}
                    placeholder={tipo === "venta" ? "Nombre del producto/equipo" : "Descripción del servicio"}
                    className={inp}/>
                  <input
                    type="number" min={1}
                    value={item.cantidad}
                    onChange={e => updateItem(item.id, "cantidad", Math.max(1, Number(e.target.value)))}
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-center focus:border-[#4E60A9]/40 bg-white w-full"/>
                  <input
                    type="number" min={0}
                    value={item.precioUnit || ""}
                    onChange={e => updateItem(item.id, "precioUnit", Number(e.target.value))}
                    placeholder="0"
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-right focus:border-[#4E60A9]/40 bg-white w-full"/>
                  <div className="text-[12px] font-bold text-[#4E60A9] text-right pr-1 tabular-nums">
                    {item.cantidad > 0 && item.precioUnit > 0
                      ? `$${(item.cantidad * item.precioUnit).toLocaleString("es-MX")}`
                      : <span className="text-gray-300 font-normal">—</span>}
                  </div>
                  <button onClick={() => removeItem(item.id)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={13}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Facturación */}
          <div className="px-6 py-4 border-b border-gray-100">
            <button onClick={() => setShowFact(p => !p)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">
              <span>Datos de facturación del cliente</span>
              {showFact ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </button>
            {showFact && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Razón Social">
                    <input value={facRazonSoc} onChange={e => setFacRazonSoc(e.target.value)} placeholder="Nombre o empresa" className={inp}/>
                  </Field>
                  <Field label="RFC">
                    <input value={facRFC} onChange={e => setFacRFC(e.target.value.toUpperCase())} placeholder="XXXX000000XX0" className={inp}/>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Régimen Fiscal">
                    <select value={facRegimen} onChange={e => setFacRegimen(e.target.value)} className={sel}>
                      {REGIMENES.map(r => <option key={r.clave} value={r.clave}>{r.clave} — {r.desc}</option>)}
                    </select>
                  </Field>
                  <Field label="Uso del CFDI">
                    <select value={facCFDI} onChange={e => setFacCFDI(e.target.value)} className={sel}>
                      {USOS_CFDI.map(u => <option key={u.clave} value={u.clave}>{u.clave} — {u.desc}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Correo para factura">
                    <input value={facCorreo} onChange={e => setFacCorreo(e.target.value)} placeholder="correo@ejemplo.com" className={inp}/>
                  </Field>
                  <Field label="Dirección fiscal">
                    <input value={facDirFiscal} onChange={e => setFacDirFiscal(e.target.value)} placeholder="Calle, colonia, CP" className={inp}/>
                  </Field>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0 bg-gray-50/60">
          <div className="flex items-center gap-4">
            <button onClick={() => setConIVA(p => !p)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${conIVA ? "bg-[#4E60A9] border-[#4E60A9] text-white" : "bg-white border-gray-200 text-gray-500"}`}>
              IVA 16%
            </button>
            <div className="flex items-center gap-2">
              <label className="text-[12px] font-bold text-gray-500">Descuento</label>
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                <input type="number" min={0} max={80} value={descuento}
                  onChange={e => setDescuento(Math.min(80, Math.max(0, Number(e.target.value))))}
                  className="w-10 text-[12px] font-bold text-center outline-none"/>
                <span className="text-[11px] text-gray-400 font-bold">%</span>
              </div>
            </div>
            <div className="flex-1"/>
            <div className="text-right">
              {descuento > 0 && <div className="text-[10px] text-gray-400 line-through">${subtotal.toLocaleString("es-MX")}</div>}
              {conIVA && <div className="text-[10px] text-gray-400">+ IVA ${iva.toLocaleString("es-MX")}</div>}
              <div className="text-[22px] font-extrabold text-[#4E60A9] tabular-nums">${total.toLocaleString("es-MX")}</div>
            </div>
          </div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Notas adicionales (opcional)…"
            className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-gray-400 focus:border-[#4E60A9]/30 transition-all"/>
          {/* Envío por correo */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailStatus("idle"); }}
                placeholder="correo@cliente.com"
                type="email"
                className="w-full text-[12px] border border-gray-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:border-[#0EA5E9]/50 bg-white"
              />
            </div>
            <button
              onClick={enviarPorCorreo}
              disabled={emailStatus === "sending" || !canGenerar || !emailTo.trim()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shrink-0 ${
                emailStatus === "ok"    ? "bg-[#059669] text-white" :
                emailStatus === "error" ? "bg-[#DC2626] text-white" :
                "bg-[#0EA5E9] hover:bg-[#0284C7] text-white disabled:opacity-40 disabled:cursor-not-allowed"
              }`}>
              {emailStatus === "sending" ? <><Mail size={13} className="animate-pulse"/>Enviando…</> :
               emailStatus === "ok"      ? <><Check size={13}/>Enviado</> :
               emailStatus === "error"   ? <><AlertCircle size={13}/>Error</> :
               <><Mail size={13}/>Enviar</>}
            </button>
          </div>
          {emailMsg && (
            <p className={`text-[11px] font-medium -mt-1 ${emailStatus === "ok" ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {emailMsg}
            </p>
          )}

          <button
            onClick={guardarEnExpediente}
            disabled={!leadId || saveStatus === "saving" || !canGenerar}
            title={!leadId ? "Vincula un cliente/lead para poder guardar el PDF en su expediente" : undefined}
            className={`w-full flex items-center justify-center gap-2 text-[12px] font-bold py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              saveStatus === "ok"    ? "bg-[#059669] text-white" :
              saveStatus === "error" ? "bg-[#DC2626] text-white" :
              "bg-white border border-[#4E60A9] text-[#4E60A9] hover:bg-[#EEF0F7]"
            }`}>
            {saveStatus === "saving" ? <><Save size={13} className="animate-pulse"/>Guardando…</> :
             saveStatus === "ok"     ? <><Check size={13}/>PDF guardado en expediente</> :
             saveStatus === "error"  ? <><AlertCircle size={13}/>Error al guardar</> :
             <><Save size={13}/>Guardar PDF en expediente</>}
          </button>

          <button onClick={generarPDF} disabled={!canGenerar}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-[#4E60A9] hover:bg-[#3d4e8a] py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Printer size={15}/>
            {!canGenerar ? "Completa nombre del cliente y al menos un servicio" : `Generar PDF · ${TIPO_LABELS[tipo]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
