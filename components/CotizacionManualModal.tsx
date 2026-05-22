"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Printer, Plus, Trash2, ChevronDown, ChevronUp, Layers, Mail, Check, AlertCircle, Save, Loader2 } from "lucide-react";
import DocumentViewerModal from "@/components/DocumentViewerModal";

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
  { clave: "G03", desc: "Gastos en general" },
  { clave: "G01", desc: "Adquisición de mercancias" },
  { clave: "D01", desc: "Honorarios médicos" },
  { clave: "P01", desc: "Por definir" },
];

const REGIMENES = [
  { clave: "612", desc: "Personas Físicas con Act. Empresariales" },
  { clave: "601", desc: "General de Ley Personas Morales" },
  { clave: "626", desc: "Régimen Simplificado de Confianza" },
  { clave: "605", desc: "Sueldos y Salarios" },
];

const TIPOS_TRANSDUCTOR = [
  "Lineal", "Convex / Curvilíneo", "Sectorial / Phased Array",
  "Intracavitario / Endovaginal", "TEE (Transesofágico)", "3D/4D", "Microconvex", "Otro",
];

const TIPOS_EQUIPO = [
  "Ultrasonido",
  "Monitor de Signos Vitales",
  "Máquina de Anestesia",
  "Ventilador Mecánico",
  "Desfibrilador",
  "Electrocardiógrafo",
  "Incubadora",
  "Unidad de Electrocirugía",
  "Otro Equipo",
];

const SERVICIOS_RAPIDOS: Record<TipoCotizacion, { nombre: string; precio: number }[]> = {
  reparacion: [
    { nombre: "Diagnóstico técnico de transductor", precio: 1500 },
    { nombre: "Reparación transductor lineal", precio: 6500 },
    { nombre: "Reparación transductor convex", precio: 6500 },
    { nombre: "Reparación transductor sectorial", precio: 7500 },
    { nombre: "Reparación transductor intracavitario", precio: 8500 },
    { nombre: "Reparación transductor TEE", precio: 12000 },
    { nombre: "Reparación transductor 3D/4D", precio: 9500 },
    { nombre: "Cambio de cable del transductor", precio: 3200 },
    { nombre: "Reencapsulado (carcasa)", precio: 2800 },
  ],
  mantenimiento: [
    { nombre: "Mantenimiento preventivo", precio: 2500 },
    { nombre: "Limpieza y calibración", precio: 1800 },
    { nombre: "Revisión general de sistema", precio: 3500 },
    { nombre: "Mantenimiento correctivo", precio: 4500 },
  ],
  venta: [],
  consumibles: [
    { nombre: "Gel conductor de ultrasonido 1 L", precio: 150 },
    { nombre: "Gel conductor de ultrasonido 5 L", precio: 580 },
    { nombre: "Fundas desechables para transductor c/100", precio: 320 },
    { nombre: "Papel térmico para impresora de US (3 rollos)", precio: 95 },
    { nombre: "Alcohol isopropílico 1 L", precio: 120 },
    { nombre: "Solución limpiadora para transductores", precio: 280 },
    { nombre: "Bolsas esterilizables para transductor c/10", precio: 450 },
    { nombre: "Electrodos desechables c/50", precio: 180 },
    { nombre: "Paño absorbente/desechable c/100", precio: 95 },
  ],
};

const TIPO_LABELS: Record<TipoCotizacion, string> = {
  reparacion: "Reparación de Transductores",
  venta: "Venta de Equipo",
  mantenimiento: "Mantenimiento de Equipo",
  consumibles: "Venta de Consumibles",
};

const inp = "w-full text-[16px] md:text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";
const sel = "w-full text-[16px] md:text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white appearance-none";

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

function b64toBlobUrl(b64: string, type: string = "application/pdf"): string {
  const bin = window.atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type });
  return URL.createObjectURL(blob);
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
      width: "816px", height: "1056px", border: "none", opacity: "0", pointerEvents: "none",
    });
    document.body.appendChild(iframe);
    const cleanup = () => { try { document.body.removeChild(iframe); } catch { } };

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

        // Push .signatures-wrapper to the bottom of its page
        const sigEl = doc.querySelector('.signatures-wrapper') as HTMLElement;
        if (sigEl) {
          const rect = sigEl.getBoundingClientRect();
          const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
          const targetBottom = (bottomPage + 1) * A4_HEIGHT - 50; // 50px margin from bottom
          const pushAmount = targetBottom - rect.bottom;
          if (pushAmount > 0) {
            const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(sigEl).marginTop || "0");
            sigEl.style.marginTop = `${currentMargin + pushAmount}px`;
          }
        }

        const canvas = await html2canvas(doc.documentElement, {
          scale: 4, useCORS: true, allowTaint: true,
          width: 816, windowWidth: 816, logging: false,
        });
        const pdf = new jsPDF({ format: "letter", unit: "mm", orientation: "portrait" });
        const pdfW = pdf.internal.pageSize.getWidth();
        const pdfH = pdf.internal.pageSize.getHeight();
        const imgH = (canvas.height * pdfW) / canvas.width;
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
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
  initialCotizacion,
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
  initialCotizacion?: any; // any for simplicity, contains the cotizacion object
}) {
  // ── Estado ────────────────────────────────────────────────────────────────
  const [tipo, setTipo] = useState<TipoCotizacion>(initialCotizacion?.tipo || initialTipo);
  const [bn, setBn] = useState<BionordiCfg>({
    razonSocial: "Bionordi S.A. de C.V.", rfc: "—", banco: "—", cuenta: "—",
    clabe: "—", direccionFiscal: "Ciudad de México, CDMX",
    correo: "contacto@bionordi.mx", representante: "Fernando Rosas", cargo: "Director General",
  });

  // Cliente
  const [cliNombre, setCliNombre] = useState("");
  const [cliContacto, setCliContacto] = useState("");
  const [cliTel, setCliTel] = useState("");
  const [cliCorreo, setCliCorreo] = useState("");
  const [cliDireccion, setCliDireccion] = useState("");
  const [cliCiudad, setCliCiudad] = useState("");
  const [cliEstado, setCliEstado] = useState("");

  // Equipo (reparacion / mantenimiento)
  const [eqTipo, setEqTipo] = useState("");
  const [eqMarca, setEqMarca] = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie, setEqSerie] = useState("");
  const [eqFalla, setEqFalla] = useState("");

  // Items
  const [items, setItems] = useState<LineItem[]>([newItem()]);

  // Vincular con lead existente
  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadsList, setLeadsList] = useState<{ id: number; nombre: string; ciudad?: string; nicho?: string; telefono?: string; correo?: string; direccion?: string; estado_republica?: string }[]>([]);
  const [usuariosList, setUsuariosList] = useState<{ id: number; nombre: string; cargo?: string }[]>([]);
  const [firmaUserId, setFirmaUserId] = useState<number | "bionordi">("bionordi");

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
  const [eqFotos, setEqFotos] = useState<string[]>([]);
  const [eqBrochureB64, setEqBrochureB64] = useState<string | null>(null);

  // Imagen del transductor (diagrama) y evidencias fotográficas
  const [imgEquipoB64, setImgEquipoB64] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<{ b64: string; caption: string }[]>([]);

  // Ajustes
  const [descuento, setDescuento] = useState(0);
  const [conIVA, setConIVA] = useState(true);
  const [notas, setNotas] = useState("");
  const [showFact, setShowFact] = useState(false);
  const [showPropuesta, setShowPropuesta] = useState(false);
  const [propuestaPDF, setPropuestaPDF] = useState("");

  // Email
  const [emailTo, setEmailTo] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [emailMsg, setEmailMsg] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFolio, setPreviewFolio] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  // Cotización ya guardada en esta sesión — evita duplicados entre Generar, Guardar y Enviar
  const [savedCot, setSavedCot] = useState<{ id: number; folio: string } | null>(null);
  const savedCotRef = useRef<{ id: number; folio: string } | null>(null);

  useEffect(() => {
    savedCotRef.current = savedCot;
  }, [savedCot]);

  // Facturación
  const [facRazonSoc, setFacRazonSoc] = useState("");
  const [facRFC, setFacRFC] = useState("");
  const [facRegimen, setFacRegimen] = useState("612");
  const [facCFDI, setFacCFDI] = useState("G03");
  const [facDirFiscal, setFacDirFiscal] = useState("");
  const [facCorreo, setFacCorreo] = useState("");

  const pdfB64Ref = useRef<string | null>(null);

  // Invalidate PDF cache and clean up browser blob URL on any input change
  useEffect(() => {
    pdfB64Ref.current = null;
    if (previewPdfUrl) {
      URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
  }, [
    tipo, cliNombre, cliContacto, cliTel, cliCorreo, cliDireccion, cliCiudad, cliEstado,
    eqTipo, eqMarca, eqModelo, eqSerie, eqFalla, items, eqDescripcion, descuento, conIVA,
    notas, firmaUserId, imgEquipoB64, evidencias, facRazonSoc, facRFC, facRegimen, facCFDI,
    facDirFiscal, facCorreo
  ]);

  // ── Efectos ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/catalogo").then(r => r.json()).then(d => setCatalogo(d.equipos || [])).catch(() => { });
    fetch("/api/leads").then(r => r.json()).then(d => setLeadsList(d.leads || [])).catch(() => { });
    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuariosList(d.usuarios || [])).catch(() => { });
  }, []);

  useEffect(() => {
    if (initialCotizacion) {
      setLeadId(initialCotizacion.lead_id || null);
      if (initialCotizacion.lead_nombre) {
        setCliNombre(initialCotizacion.lead_nombre);
      } else if (initialLead) {
        setCliNombre(initialLead.nombre || "");
      }
      setEqTipo(initialCotizacion.eq_tipo || "");
      setEqMarca(initialCotizacion.eq_marca || "");
      setEqModelo(initialCotizacion.eq_modelo || "");
      setEqDescripcion(initialCotizacion.eq_descripcion || "");
      setNotas(initialCotizacion.notas || "");
      setSavedCot({ id: initialCotizacion.id, folio: initialCotizacion.folio });
      if (initialCotizacion.items_json) {
        try {
          const parsed = JSON.parse(initialCotizacion.items_json);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed.map((item: any) => ({
              id: Math.random().toString(36).slice(2),
              descripcion: item.descripcion || "",
              cantidad: item.cantidad || 1,
              precioUnit: item.precioUnit || 0
            })));
          } else if (parsed && parsed.items && Array.isArray(parsed.items)) {
            setItems(parsed.items.map((item: any) => ({
              id: item.id || Math.random().toString(36).slice(2),
              descripcion: item.descripcion || "",
              cantidad: item.cantidad || 1,
              precioUnit: item.precioUnit || 0
            })));
            if (parsed.meta) {
              const m = parsed.meta;
              if (m.cliContacto !== undefined) setCliContacto(m.cliContacto);
              if (m.cliTel !== undefined) setCliTel(m.cliTel);
              if (m.cliCorreo !== undefined) {
                setCliCorreo(m.cliCorreo);
                setEmailTo(prev => prev || m.cliCorreo || "");
              }
              if (m.cliDireccion !== undefined) setCliDireccion(m.cliDireccion);
              if (m.cliCiudad !== undefined) setCliCiudad(m.cliCiudad);
              if (m.cliEstado !== undefined) setCliEstado(m.cliEstado);
              if (m.eqFalla !== undefined) setEqFalla(m.eqFalla);
              if (m.eqSerie !== undefined) setEqSerie(m.eqSerie);
              if (m.descuento !== undefined) setDescuento(m.descuento);
              if (m.conIVA !== undefined) setConIVA(m.conIVA);
              if (m.firmaUserId !== undefined) setFirmaUserId(m.firmaUserId);
              if (m.facRazonSoc !== undefined) setFacRazonSoc(m.facRazonSoc);
              if (m.facRFC !== undefined) setFacRFC(m.facRFC);
              if (m.facRegimen !== undefined) setFacRegimen(m.facRegimen);
              if (m.facCFDI !== undefined) setFacCFDI(m.facCFDI);
              if (m.facDirFiscal !== undefined) setFacDirFiscal(m.facDirFiscal);
              if (m.facCorreo !== undefined) setFacCorreo(m.facCorreo);
              // Campos cargados para edición de fotos y propuestas personalizadas
              if (m.evidencias !== undefined) setEvidencias(m.evidencias || []);
              if (m.propuestaPDF !== undefined) {
                setPropuestaPDF(m.propuestaPDF || "");
                if (m.propuestaPDF) setShowPropuesta(true); // Mostrar el panel si tiene propuesta personalizada
              }
              if (m.imgEquipoB64 !== undefined) setImgEquipoB64(m.imgEquipoB64 || null);
              if (m.eqBrochureB64 !== undefined) setEqBrochureB64(m.eqBrochureB64 || null);
            }
          }
        } catch { }
      }
    } else if (initialLead) {
      setLeadId(initialLead.id);
      setCliNombre(initialLead.nombre || "");
      setCliTel(initialLead.telefono || "");
      setCliCorreo(initialLead.correo || "");
      setCliCiudad(initialLead.ciudad || "");
      setCliEstado(initialLead.estado_republica || "");
      setCliDireccion(initialLead.direccion || "");
      if (initialLead.correo) setEmailTo(initialLead.correo);
    }
  }, [initialCotizacion, initialLead]);

  // Hook automático para resolver datos del lead cuando leadsList termine de cargarse
  useEffect(() => {
    if (leadId && !cliNombre && leadsList.length > 0) {
      const found = leadsList.find(l => l.id === leadId);
      if (found) {
        setCliNombre(found.nombre);
        if (found.telefono) setCliTel(found.telefono);
        if (found.correo) {
          setCliCorreo(found.correo);
          setEmailTo(prev => prev || found.correo || "");
        }
        if (found.ciudad) setCliCiudad(found.ciudad);
        if (found.estado_republica) setCliEstado(found.estado_republica);
        if (found.direccion) setCliDireccion(found.direccion);
      }
    }
  }, [leadId, cliNombre, leadsList]);

  useEffect(() => {
    if (initialCotizacion && catalogo.length > 0 && eqMarca) {
      const found = catalogo.find(c => c.marca === eqMarca && c.modelo === eqModelo);
      if (found) {
        if (found.fotos_json) {
          try { setEqFotos(JSON.parse(found.fotos_json)); } catch { }
        }
        if (found.imagen_path) {
          fetchBase64(found.imagen_path).then(b64 => {
            setImgEquipoB64(prev => prev || b64);
          });
        }
      }
    }
  }, [initialCotizacion, catalogo, eqMarca, eqModelo]);


  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      const c = d.config || {};
      setBn({
        razonSocial: c.fact_razon_social || "Bionordi S.A. de C.V.",
        rfc: c.fact_rfc || "—",
        banco: c.fact_banco || "—",
        cuenta: c.fact_cuenta || "—",
        clabe: c.fact_clabe || "—",
        direccionFiscal: c.fact_direccion_fiscal || "Ciudad de México, CDMX",
        correo: c.fact_correo_facturacion || "contacto@bionordi.mx",
        representante: c.nombre_representante || "Fernando Rosas",
        cargo: c.fact_cargo_representante || "Director General",
      });
    }).catch(() => { });
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
  const subtotal = validItems.reduce((a, i) => a + i.cantidad * i.precioUnit, 0);
  const descMonto = Math.round(subtotal * descuento / 100);
  const baseNeta = subtotal - descMonto;
  const iva = conIVA ? Math.round(baseNeta * 0.16) : 0;
  const total = baseNeta + iva;
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
    if (eq.fotos_json) { try { fotos = JSON.parse(eq.fotos_json); } catch { } }
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

  const VENTA_FEATURES: Record<string, string[]> = {
    "M9": [
      "<strong>Tecnología Premium</strong>: Ultrasonido portátil con sondas monocristal 3T, pantalla LED 16\" y SSD 128 GB. Incluye Echo Boost™, Smart OB, Smart NT y opción Stress Echo.",
      "<strong>Sondas Monocristal 3T</strong>: Triple capa de matching que proporciona mayor sensibilidad, ancho de banda más amplio y mejor relación señal/ruido.",
      "<strong>Echo Boost™</strong>: Procesamiento adaptativo de señal específico para imagen cardíaca, suprimiendo el ruido en las cámaras y reforzando el endocardio.",
      "<strong>Biometría Fetal Automática</strong>: Smart OB™ y Smart NT™ realizan mediciones automáticas con un solo clic, reduciendo variabilidad entre operadores."
    ],
    "Z50": [
      "<strong>Tecnología Versátil</strong>: Ultrasonido portátil todo-en-uno con pantalla de 15\", 500 GB y batería de 1.5 h. Incluye 3D/4D, iLive, Smart OB™ y Smart Face™.",
      "<strong>3D/4D con iLive™ y Smart Face™</strong>: Captura volúmenes fetales simulando iluminación natural para obtener imágenes realistas con apariencia de piel.",
      "<strong>Smart OB™</strong>: Detecta y mide automáticamente los parámetros de biometría fetal, calculando edad gestacional al instante.",
      "<strong>iScape™ y Auto IMT</strong>: Genera imagen panorámica en tiempo real y realiza medición automática del espesor íntima-media carotídea."
    ],
    "DC-60 Exp": [
      "<strong>Alto Desempeño</strong>: Consola de alta gama con motor de imagen X-Engine (GPU+CPU, 3–4× más rápido). Incluye 4D en tiempo real, STIC y AutoEF.",
      "<strong>X-Engine</strong>: Integra procesamiento GPU y CPU en paralelo, acelerando de forma masiva el pipeline de imagen.",
      "<strong>4D Real-time + STIC</strong>: Adquisición 4D en tiempo real con Smart Volume, Color 3D e iLive para evaluar detalladamente cardiopatías.",
      "<strong>Suite Cardíaca Completa</strong>: AutoEF, Stress Echo y LVO para calcular fracción de eyección y permitir protocolos avanzados de estrés."
    ],
    "DC-30": [
      "<strong>Equilibrio y Calidad</strong>: Consola de gama media con pantalla LED 15\"/17\" y batería integrada. Incluye 3D/4D, Elastografía, TDI y Contraste.",
      "<strong>Diagnóstico Avanzado</strong>: Imagen 3D/4D en tiempo real para obstetricia y Elastografía Natural Touch que mapea la rigidez tisular.",
      "<strong>TDI y UWN Contraste</strong>: Mide velocidad miocárdica y habilita estudios de perfusión con agente de contraste microburbuja.",
      "<strong>FCI e iBeam™</strong>: Combinación de frecuencias y compuesto espacial multi-ángulo para reducir el ruido y homogeneizar la imagen."
    ],
    "M5": [
      "<strong>Punto de Atención Rápido</strong>: Ultrasonido portátil compacto con LCD 15\" y batería de 2 horas. Modos B, M, Color, Power y Doppler Pulsado.",
      "<strong>iTouch</strong>: Optimización automática de imagen (ganancia y parámetros) con un solo toque para agilizar estudios en urgencias.",
      "<strong>Alta Portabilidad</strong>: Peso ligero de 4.5 kg y diseño reforzado, ideal para acompañar en rondas hospitalarias intensivas.",
      "<strong>Compatibilidad de Sondas</strong>: Acepta transductores convex abdominal, lineal vascular, phased array cardíaco y endocavitario."
    ],
    "M7": [
      "<strong>Diagnóstico a Bordo</strong>: Portátil a color con LCD 15\", HDD 320 GB y batería de 1.5 h. Incluye iNeedle™, TDI, 4D y Auto IMT.",
      "<strong>iNeedle™</strong>: Realce avanzado de la aguja en procedimientos guiados, amplificando los ecos de retorno para máxima visibilidad.",
      "<strong>Tissue Doppler Imaging (TDI)</strong>: Paquete completo para medir velocidad de movimiento miocárdico y evaluar función diastólica.",
      "<strong>iBeam™ + THI + PSH</strong>: Compuesto espacial y armónicas para entregar una imagen de alta definición incluso en pacientes difíciles."
    ],
    "MX7": [
      "<strong>Innovación Ultrafina</strong>: Ultrasonido de 44 mm de grosor y 3 kg, con plataforma ZST+, panel principal 15.6\", panel táctil 12.3\" y U-Bank.",
      "<strong>ZST+ (Zone Sonography)</strong>: Plataforma de beamforming virtual que transmite zonas completas, logrando tasas de cuadros ultrarrápidas.",
      "<strong>HD Scope™</strong>: Mejora extrema de la resolución de contraste y la definición de bordes tisulares en partes pequeñas y cardíaco.",
      "<strong>Batería U-Bank</strong>: Autonomía de hasta 8 horas de escaneo continuo para cubrir guardias sin interrupción."
    ],
    "DP-50 Exp": [
      "<strong>Escencial y Confiable</strong>: Consola portátil B/W con pantalla LCD 15\", batería > 2 h. Incluye THI, iBeam™, iClear™ e iScape™.",
      "<strong>THI + TSI</strong>: Armónica tisular que elimina reverberaciones y ajusta el procesamiento según el órgano específico a explorar.",
      "<strong>Compuesto Espacial iBeam™</strong>: Elimina sombras acústicas y reduce el moteado sin comprometer la nitidez de los bordes anatómicos.",
      "<strong>Productividad</strong>: Mediciones Auto IMT, imagen panorámica y gestión integrada de estudios con iStation™."
    ]
  };

  const getVentaFeatures = (modelo: string | undefined, desc: string | undefined) => {
    const foundKey = modelo ? Object.keys(VENTA_FEATURES).find(k => modelo.toLowerCase().includes(k.toLowerCase())) : null;
    if (foundKey) return VENTA_FEATURES[foundKey];
    if (desc) return desc.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4);
    return ["Excelente equipo médico con altos estándares de calidad y precisión diagnóstica."];
  };
  const currentFeatures = getVentaFeatures(eqModelo, eqDescripcion);

  const MANTENIMIENTO_FEATURES: Record<string, string[]> = {
    "ultrasonido": [
      "<strong>Diagnóstico General:</strong> Revisión sistemática de todos los componentes del equipo y pruebas de funcionamiento inicial.",
      "<strong>Limpieza y Calibración:</strong> Limpieza profunda interior y exterior, ajuste de parámetros de imagen según especificaciones del fabricante.",
      "<strong>Revisión Eléctrica:</strong> Verificación de voltajes, corrientes y sistema de tierra física. Prueba de puertos de transductores.",
      "<strong>Reporte de Estado:</strong> Entrega de informe técnico con hallazgos y recomendaciones para mantenimiento preventivo futuro."
    ],
    "monitor": [
      "<strong>Diagnóstico General:</strong> Revisión de módulos de medición (ECG, SpO2, PNI, Temp) y pruebas de alarmas visuales/auditivas.",
      "<strong>Limpieza y Desinfección:</strong> Limpieza de carcasa, pantalla y conectores con agentes seguros para grado médico.",
      "<strong>Revisión Eléctrica y Batería:</strong> Prueba de autonomía de la batería interna, revisión de fuente de poder y aislamiento eléctrico.",
      "<strong>Calibración y Reporte:</strong> Verificación de parámetros con simulador de paciente y entrega de informe técnico."
    ],
    "anestesia": [
      "<strong>Diagnóstico General:</strong> Inspección de circuitos neumáticos, vaporizadores y sistema de ventilación mecánica.",
      "<strong>Pruebas de Fuga y Calibración:</strong> Verificación de hermeticidad del sistema, calibración de sensores de flujo y O2.",
      "<strong>Revisión Eléctrica y Neumática:</strong> Inspección de electroválvulas, batería de respaldo y alarmas de seguridad.",
      "<strong>Mantenimiento Preventivo:</strong> Reemplazo de empaques internos (si aplica) y entrega de informe técnico de operatividad."
    ],
    "desfibrilador": [
      "<strong>Diagnóstico General:</strong> Revisión de circuito de descarga, palas, marcapasos y módulos de monitoreo.",
      "<strong>Prueba de Descarga:</strong> Verificación de energía entregada real vs configurada utilizando analizador de desfibriladores.",
      "<strong>Batería y Seguridad Eléctrica:</strong> Evaluación de vida útil de la batería, corriente de fuga y cableado paciente.",
      "<strong>Limpieza y Reporte:</strong> Limpieza integral, calibración y emisión de informe técnico certificado."
    ],
    "electrocardiografo": [
      "<strong>Diagnóstico General:</strong> Revisión de cables de paciente, impresor térmico, pantalla y botones de control.",
      "<strong>Prueba de Señal:</strong> Validación de adquisición de señal ECG, filtros de ruido e impresión con simulador.",
      "<strong>Mantenimiento Preventivo:</strong> Limpieza de cabezal térmico, ajuste de rodillos y revisión de fuente de alimentación.",
      "<strong>Reporte de Estado:</strong> Entrega de informe técnico garantizando la precisión del trazado electrocardiográfico."
    ]
  };

  const getMantenimientoFeatures = (tipo: string | undefined) => {
    const t = (tipo || "ultrasonido").toLowerCase();
    if (t.includes("monitor")) return MANTENIMIENTO_FEATURES["monitor"];
    if (t.includes("anestesia") || t.includes("ventilador")) return MANTENIMIENTO_FEATURES["anestesia"];
    if (t.includes("desfibrilador")) return MANTENIMIENTO_FEATURES["desfibrilador"];
    if (t.includes("electro")) return MANTENIMIENTO_FEATURES["electrocardiografo"];
    if (t.includes("ultrasonido") || t.includes("transductor")) return MANTENIMIENTO_FEATURES["ultrasonido"];

    return [
      "<strong>Diagnóstico General:</strong> Revisión sistemática de componentes físicos, electrónicos y pruebas de encendido.",
      "<strong>Limpieza Preventiva:</strong> Descontaminación interior y exterior, retiro de polvo y lubricación de partes móviles.",
      "<strong>Revisión Eléctrica:</strong> Verificación de fuente de alimentación, voltajes internos y sistemas de seguridad del equipo.",
      "<strong>Pruebas de Funcionamiento:</strong> Validación de operatividad y entrega de reporte técnico detallado."
    ];
  };
  const currentMantenimiento = getMantenimientoFeatures(eqTipo);

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

  const getPropuestaInfo = () => {
    const nombres = validItems.map(i => i.descripcion.trim()).filter(Boolean);
    const listaTexto = nombres.length === 0 ? "los servicios/insumos solicitados"
      : nombres.length === 1 ? nombres[0].toLowerCase()
        : nombres.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombres[nombres.length - 1].toLowerCase();

    const equipoRef = [eqMarca, eqModelo].filter(Boolean).join(" ");
    const sobreEquipo = equipoRef ? ` sobre el equipo ${equipoRef}` : "";

    let titulo = "";
    let subtituloTotal = "";
    let parrafoPDF = "";
    let parrafoEmail = "";

    if (tipo === "reparacion") {
      titulo = "Propuesta Técnica de Servicio";
      subtituloTotal = "Incluye materiales, mano de obra y garantía de 12 meses";
      parrafoPDF = generarParrafoAlcance();
      const falla = eqFalla ? ` La falla reportada («${eqFalla}») será atendida de manera integral.` : "";
      parrafoEmail = `Nos complace presentarle la siguiente propuesta técnica para la realización de: ${listaTexto}${sobreEquipo}.${falla} El servicio comprende diagnóstico técnico, mano de obra calificada y refacciones, con garantía escrita de 12 meses. El detalle completo se encuentra en el documento adjunto.`;
    }
    else if (tipo === "mantenimiento") {
      titulo = "Propuesta Técnica de Mantenimiento";
      subtituloTotal = "Incluye refacciones preventivas, mano de obra y reporte técnico";
      const cleanFeatures = currentMantenimiento.map(f => {
        let txt = f.replace(/<strong>.*?<\/strong>:\s*/g, '');
        return txt.charAt(0).toLowerCase() + txt.slice(1);
      }).join(' ');
      parrafoPDF = `El presente presupuesto comprende la realización del mantenimiento preventivo integral: ${listaTexto}${sobreEquipo}. El alcance del servicio incluye: ${cleanFeatures} El servicio se realiza bajo estrictos estándares de calidad, incluyendo pruebas de seguridad eléctrica y entrega de un reporte técnico detallado conforme a la normativa vigente.`;
      parrafoEmail = `Nos complace presentarle la propuesta para el mantenimiento preventivo de: ${listaTexto}${sobreEquipo}. El servicio garantiza el óptimo funcionamiento de su unidad clínica. El detalle completo de la intervención y condiciones comerciales se encuentra en el documento adjunto.`;
    }
    else if (tipo === "venta") {
      titulo = "Propuesta Comercial";
      subtituloTotal = "Incluye garantía directa y soporte técnico especializado";
      const cleanFeatures = currentFeatures.map(f => {
        let txt = f.replace(/<strong>.*?<\/strong>:\s*/g, '');
        if (!txt.endsWith('.')) txt += '.';
        return txt;
      }).join(' ');
      parrafoPDF = `La presente propuesta comercial contempla el suministro de: ${listaTexto}. ${cleanFeatures} El equipo incluye garantía directa contra defectos de fábrica, soporte técnico especializado y capacitación operativa para asegurar su óptimo aprovechamiento en el entorno clínico.`;
      parrafoEmail = `Nos complace presentarle nuestra propuesta comercial para el suministro de: ${listaTexto}. Estamos seguros de que nuestra tecnología cumplirá con sus más altas exigencias clínicas. Los detalles, precio final y especificaciones se encuentran en el documento adjunto.`;
    }
    else {
      titulo = "Propuesta Comercial";
      subtituloTotal = "Precios sujetos a disponibilidad de inventario";
      parrafoPDF = `La presente cotización comprende el suministro de: ${listaTexto}. Todos nuestros consumibles e insumos médicos cumplen con los más altos estándares de calidad y caducidad vigente, garantizando un desempeño óptimo en su uso clínico.`;
      parrafoEmail = `Nos complace presentarle la cotización correspondiente al suministro de consumibles médicos: ${listaTexto}. El detalle completo de la inversión se encuentra en el documento adjunto.`;
    }
    return { titulo, subtituloTotal, parrafoPDF, parrafoEmail };
  };

  const buildPDFHtml = async (folioOverride?: string): Promise<{ html: string; folio: string }> => {
    const isTwoPages = true;

    let imgTransductor = "/transductor.png";
    let imgFront = "/equipo_movil_front.png";
    let imgBack = "/equipo_movil_back.png.png";

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

    let sigName = bn.representante;
    let sigRole = bn.cargo;
    if (firmaUserId !== "bionordi") {
      const u = usuariosList.find(u => u.id === firmaUserId);
      if (u) {
        sigName = u.nombre;
        sigRole = u.cargo || "Ejecutivo";
      }
    }

    // Fotos del catálogo para venta (se necesita b64 para funcionar en el blob HTML)
    const eqFotosB64: string[] = tipo === "venta" && eqFotos.length > 0
      ? await Promise.all(eqFotos.slice(0, 4).map(f => fetchBase64(f)))
      : [];

    const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    let folio = folioOverride;
    if (!folio) {
      const res = await fetch(`/api/cotizaciones?nextfolio=1&tipo=${tipo}`);
      const data = await res.json();
      folio = data.folio as string;
    }
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");

    const propInfo = getPropuestaInfo();

    const rows = validItems.map((s, i) => `
      <tr>
        <td class="c text-muted">${i + 1}</td>
        <td><div class="s-name">${s.descripcion}</div></td>
        <td class="c">${s.cantidad}</td>
        <td class="r">${$f(s.precioUnit)}</td>
        <td class="r b">${$f(s.cantidad * s.precioUnit)}</td>
      </tr>`).join("");

    const tableHTML = tipo === "consumibles" ? `
    <div class="tech-card" style="margin-top:10px;margin-bottom:10px;border-left:4px solid #D97706;page-break-inside:avoid;">
      <div class="card-title" style="color:#D97706;border-bottom-color:#FDE68A;">Descripción del Servicio</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
        ${validItems.map((item, i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#FFFBEB;border-radius:8px;border:1px solid #FDE68A;">
            <div style="display:flex;gap:10px;align-items:center;flex:1;">
              <div style="width:20px;height:20px;background:#D97706;color:#fff;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</div>
              <div style="font-size:11px;font-weight:600;color:#1E293B;flex:1;">${item.descripcion}</div>
              ${item.cantidad > 1 ? `<div style="font-size:10px;color:#64748B;margin-left:4px;">×${item.cantidad}</div>` : ""}
            </div>
            <div style="font-size:11px;font-weight:700;color:#D97706;min-width:70px;text-align:right;">${$f(item.cantidad * item.precioUnit)}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

    const techCardBreak = tipo === "consumibles" ? "avoid" : "always";
    const techCardMargin = tipo === "consumibles" ? "10px" : "20px";

    const diagramaHTML = tipo === "reparacion" ? `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
      <div class="card-title">Alcance Técnico y Diagnóstico Integral${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <p class="diag-p" style="margin-bottom:8px;">
        Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>.
        Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.
      </p>
      <div class="diag-grid">
        <div style="flex:.8;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;height:148px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <div style="position:relative;display:inline-block;">
            <img src="${imgTransductor}" alt="${eqMarca || "Transductor"} ${eqModelo || ""}" style="max-width:100%;max-height:140px;width:auto;height:auto;display:block;" />
            <div class="dot" style="top:25%;left:39%;margin-top:-10px;margin-left:-10px;">1</div>
            <div class="dot" style="top:20%;left:55%;margin-top:-10px;margin-left:-10px;">2</div>
            <div class="dot" style="top:68%;left:30%;margin-top:-10px;margin-left:-10px;">3</div>
            <div class="dot" style="top:88%;left:82%;margin-top:-10px;margin-left:-10px;">4</div>
          </div>
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
            <img src="${imgEquipoB64}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ")}" style="max-width:100%;max-height:192px;width:auto;height:auto;background:white;" />
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;padding-top:4px;">
          ${currentMantenimiento.map((feat, i) => `<div class="d-item"><div class="d-num">${i + 1}</div><div>${feat}</div></div>`).join("")}
        </div>
      </div>
    </div>` : "")
        : tipo === "venta" ? (eqFotosB64.length > 0 ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Galería del Equipo — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Producto"}</div>
      <div style="display:flex;gap:20px;align-items:flex-start;margin-top:8px;">
        <div style="flex:0 0 280px;">
          <div class="img-container" style="height:190px;padding:10px;">
            <img src="${eqFotosB64[0]}" alt="Foto Principal" style="max-width:100%;max-height:170px;width:auto;height:auto;background:white;" />
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px;padding-top:4px;">
          ${currentFeatures.map((feat, i) => `
            <div class="d-item"><div class="d-num">${i + 1}</div><div>${feat}</div></div>
          `).join("")}
        </div>
      </div>
    </div>` : imgEquipoB64 ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Galería del Equipo — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Producto"}</div>
      <div style="display:flex;gap:20px;align-items:flex-start;margin-top:8px;">
        <div style="flex:0 0 280px;">
          <div class="img-container" style="height:190px;padding:10px;">
            <img src="${imgEquipoB64}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ")}" style="max-width:100%;max-height:170px;width:auto;height:auto;background:white;" />
          </div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:12px;padding-top:4px;">
          ${currentFeatures.map((feat, i) => `
            <div class="d-item"><div class="d-num">${i + 1}</div><div>${feat}</div></div>
          `).join("")}
        </div>
      </div>
    </div>` : "") : "";

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
            <img src="${ev.b64}" alt="Evidencia ${i + 1}" style="max-width:100%;max-height:140px;width:auto;height:auto;background:white;border-radius:6px;border:1px solid ${evidenciaImgBorder};display:block;margin:0 auto;" />
            <div style="margin-top:4px;font-size:9px;color:${evidenciaTextColor};font-weight:600;text-align:center;">
              Foto ${i + 1}${ev.caption ? ` — ${ev.caption}` : ""}
            </div>
          </div>`).join("")}
      </div>
    </div>` : "";

    // Ficha técnica embebida (brochure como imagen del catálogo)
    const brochureHTML = eqBrochureB64 ? `
    <div class="tech-card avoid-break" style="margin-bottom:20px;">
      <div class="card-title">Ficha Técnica del Equipo${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <img src="${eqBrochureB64}" alt="Ficha técnica" style="width:100%;max-height:220px;object-fit:contain;margin-top:10px;border-radius:6px;border:1px solid #E2E8F0;" />
    </div>` : "";

    const equipoHTML = (tipo === "reparacion" || tipo === "mantenimiento") && (eqTipo || eqMarca || eqModelo || eqSerie || eqFalla) ? `
    <div class="eq-card">
      <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Especificaciones del Equipo</div>
      <div class="eq-grid">
        <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie || "—"}</div></div>
        ${eqDescripcion && tipo !== "reparacion" ? `<div class="eq-full"><div class="eq-lbl">Descripción</div><div class="eq-val" style="margin-top:2px;line-height:1.4;">${eqDescripcion.replace(/\n/g, '<br/>')}</div></div>` : ""}
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
  /* PROTECCIÓN DE ALTURA FÍSICA: min-height de 488mm garantiza exactamente 2 páginas Letter en Chromium sin desbordes. NO REDUCIR NI ELIMINAR */
  .page{padding:30px 65px;max-width:816px;margin:0 auto;display:flex;flex-direction:column;min-height:${isTwoPages ? "488mm" : "244mm"}}
  /* EMPUJE ELÁSTICO DE FIRMAS: flex:1 y min-height de 5px empujan dinámicamente el pie de página al borde inferior sin romper el layout. NO ELIMINAR */
  .page-spacer{flex:1;min-height:5px}
  .avoid-break{page-break-inside:avoid}
  .text-muted{color:#94A3B8}.b{font-weight:700}.c{text-align:center}.r{text-align:right}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px}
  .logo{font-size:34px;font-weight:900;color:#4E60A9;letter-spacing:-1px;line-height:1}
  .logo span{color:#38AD64}
  .logo-sub{font-size:10px;font-weight:600;color:#64748B;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}
  .meta-box{text-align:right}
  .doc-title{font-size:18px;font-weight:300;color:#94A3B8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
  .meta-grid{display:grid;grid-template-columns:auto auto;gap:4px 15px;justify-content:end;font-size:11px}
  .meta-lbl{font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px}
  .meta-val{color:#1E293B;font-weight:600}
  .divider{height:4px;background:linear-gradient(90deg,#4E60A9,#38AD64,#E2E8F0);border-radius:4px;margin-bottom:10px}
  .info-section{display:flex;gap:20px;margin-bottom:8px}
  .info-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px}
  .card-title{font-size:10px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #E2E8F0;padding-bottom:6px}
  .i-row{display:flex;margin-bottom:5px;font-size:11px;line-height:1.4}
  .i-lbl{width:85px;color:#64748B;font-weight:700}
  .i-val{flex:1;color:#1E293B;font-weight:500}
  .eq-card{background:#fff;border:1px solid #CBD5E1;border-radius:12px;padding:10px 14px;margin-bottom:8px;border-left:4px solid #4E60A9}
  .eq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
  .eq-item{display:flex;flex-direction:column;gap:4px}
  .eq-lbl{font-size:9px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
  .eq-val{font-size:12px;color:#0F172A;font-weight:600}
  .eq-full{grid-column:span 4;background:#FEF2F2;padding:8px 12px;border-radius:8px;border-left:3px solid #EF4444;margin-top:5px}
  .tech-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:10px 14px;margin-top:8px;margin-bottom:8px}
  .diag-p{font-size:11px;color:#475569;line-height:1.5;margin-bottom:10px}
  .diag-grid{display:flex;gap:20px;align-items:center}
  .img-container{flex:.8;position:relative;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  /* CENTRADO VERTICAL DE NUMERACIÓN EN IMAGEN (DIAGRAMA): width/height de 20px requiere line-height exacto de 16px con display:block y bordes de 2px para alineación perfecta de glifo. */
  .dot{position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:block;text-align:center;line-height:16px;border:2px solid #fff;box-sizing:border-box;margin:0;}
  .diag-list{flex:1.2;display:flex;flex-direction:column;gap:12px}
  .d-item{display:flex;gap:10px;font-size:10.5px;color:#334155;line-height:1.4;align-items:flex-start}
  /* CENTRADO VERTICAL DE NUMERACIÓN EN LISTA: width/height de 18px requiere line-height exacto de 18px con display:block y sin padding para centrado absoluto. */
  .d-num{width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:block;text-align:center;line-height:18px;flex-shrink:0;margin-top:1px;box-sizing:border-box;margin-left:0;margin-right:0;padding:0;}
  table{width:100%;border-collapse:separate;border-spacing:0;margin-bottom:20px;page-break-before:always}
  th{background:#F1F5F9;color:#475569;font-size:10px;font-weight:800;text-transform:uppercase;padding:10px 15px;text-align:left;letter-spacing:1px;border-bottom:2px solid #CBD5E1}
  th:first-child{border-top-left-radius:8px;border-bottom-left-radius:8px}
  th:last-child{border-top-right-radius:8px;border-bottom-right-radius:8px}
  td{padding:12px 15px;font-size:12px;color:#1E293B;border-bottom:1px solid #E2E8F0;vertical-align:middle}
  .s-name{font-weight:600;color:#0F172A}
  .bottom-flex{display:flex;gap:20px;margin-bottom:15px;align-items:flex-start}
  .totals-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:12px}
  .t-row{display:flex;justify-content:space-between;font-size:12px;color:#64748B;margin-bottom:8px}
  .t-row .t-val{font-weight:600;color:#1E293B}
  .t-row.final{border-top:2px solid #E2E8F0;padding-top:12px;margin-top:4px;font-size:16px;font-weight:900;color:#4E60A9}
  .t-row.final .t-val{color:#4E60A9}
  .billing-instructions{flex:1;background:#EEF0F7;border:1px solid #C5CAE0;border-radius:12px;padding:12px}
  .billing-instructions .card-title{color:#4E60A9;border-bottom-color:#C5CAE0}
  .b-step{display:flex;gap:8px;font-size:10.5px;color:#4E60A9;margin-bottom:8px;line-height:1.4}
  .b-step strong{font-weight:800}
  .b-icon{font-weight:bold;color:#4E60A9}
  .cond-section{margin-bottom:12px;page-break-inside:avoid}
  .cond-title{font-size:11px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .cond-list{list-style:none;padding:0}
  .cond-list li{position:relative;padding-left:14px;font-size:10px;color:#475569;margin-bottom:6px;line-height:1.5}
  .cond-list li::before{content:"•";position:absolute;left:0;color:#38AD64;font-weight:bold;font-size:14px;line-height:1;top:-1px}
  .signatures{margin-top:8px;display:flex;justify-content:flex-end;page-break-inside:avoid}
  .sig-box{text-align:center;width:240px}
  .sig-line{border-top:2px solid #CBD5E1;margin-bottom:10px;padding-top:10px}
  .sig-name{font-size:13px;font-weight:800;color:#4E60A9}
  .sig-role{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;margin-top:2px}
  .footer{text-align:center;border-top:1px solid #E2E8F0;padding-top:10px;margin-top:10px;font-size:10px;color:#94A3B8;line-height:1.6}
  @media print{body{padding:0}.page{padding:30px 65px}.cond-section{page-break-after:avoid;break-after:avoid}.signatures-wrapper{page-break-before:avoid;break-before:avoid;page-break-inside:avoid;break-inside:avoid}}
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
${tableHTML}

<div class="tech-card avoid-break" style="margin-bottom:20px;border-left:4px solid #4E60A9;page-break-before:${techCardBreak};margin-top:${techCardMargin};">
  <div class="card-title">${propInfo.titulo}</div>
  <p style="font-size:11px;color:#334155;line-height:1.5;margin-bottom:10px;">${propuestaPDF.trim() || propInfo.parrafoPDF}</p>
  <div style="background:#EEF0F7;border:1px solid #C5CAE0;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inversión Total</div>
      <div style="font-size:11px;color:#4E60A9;">${propInfo.subtituloTotal}</div>
    </div>
    <div style="text-align:right;">
      ${descuento > 0 ? `<div style="font-size:11px;color:#94A3B8;text-decoration:line-through;margin-bottom:2px;">${$f(subtotal)}</div>` : ""}
      <div style="font-size:28px;font-weight:900;color:#4E60A9;letter-spacing:-1px;">${$f(total)}</div>
      ${conIVA ? `<div style="font-size:9px;color:#38AD64;font-weight:700;">IVA incluido</div>` : `<div style="font-size:9px;color:#64748B;">Más IVA</div>`}
    </div>
  </div>
</div>

${notas ? `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:9px 13px;margin-bottom:20px;font-size:11px;color:#92400E;border-radius:0 4px 4px 0;"><strong>Notas:</strong> ${notas}</div>` : ""}

<div class="bottom-flex avoid-break" style="page-break-before: ${tipo === "consumibles" ? "always" : "avoid"}; margin-top: ${tipo === "consumibles" ? "20px" : "15px"};">
  <div class="billing-instructions">
    <div class="card-title">Instrucciones para Solicitar Factura</div>
    <div class="b-step"><span class="b-icon">1.</span><div>Realice el pago total o anticipo a la cuenta CLABE indicada arriba.</div></div>
    <div class="b-step"><span class="b-icon">2.</span><div>Envíe un correo a <strong>${bn.correo}</strong> adjuntando comprobante de pago y Constancia de Situación Fiscal.</div></div>
    <div class="b-step"><span class="b-icon">3.</span><div>Indique su <strong>Uso de CFDI</strong> (${facCFDI || "G03"}) en el correo.</div></div>
    <div class="b-step"><span class="b-icon">4.</span><div>Su factura será procesada en un lapso no mayor a 24 horas hábiles.</div></div>
  </div>
  <div class="totals-card">
    <div class="t-row"><div>Subtotal</div><div class="t-val">${$f(subtotal)}</div></div>
    ${descuento > 0 ? `<div class="t-row"><div>Descuento (${descuento}%)</div><div class="t-val" style="color:#EF4444;">−${$f(descMonto)}</div></div>` : ""}
    ${conIVA ? `<div class="t-row"><div>IVA (16%)</div><div class="t-val">${$f(iva)}</div></div>` : ""}
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

<div class="page-spacer"></div>
<div class="signatures-wrapper">
  <div class="signatures">
    <div class="sig-box">
      <div class="sig-line">
        <div class="sig-name">${sigName}</div>
        <div class="sig-role">${sigRole}</div>
        <div class="sig-role" style="color:#4E60A9;font-weight:800;margin-top:4px;">${bn.razonSocial}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <strong>${bn.razonSocial}</strong> · ${bn.direccionFiscal} · ${bn.correo}<br/>
    Documento generado digitalmente por el sistema de Gestión Bionordi.
  </div>
</div>
</div></body></html>`;

    return { html, folio };
  };

  const persistToDB = async (folioGenerado: string) => {
    const body = {
      lead_id: leadId || null, tipo, folio: folioGenerado, monto_total: total,
      items_json: {
        items: validItems.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
        meta: {
          cliContacto, cliTel, cliCorreo, cliDireccion, cliCiudad, cliEstado,
          eqFalla, eqSerie,
          descuento, conIVA, firmaUserId,
          facRazonSoc, facRFC, facRegimen, facCFDI, facDirFiscal, facCorreo,
          // Preservar fotos y propuestas técnicas personalizadas
          evidencias,
          propuestaPDF,
          imgEquipoB64,
          eqBrochureB64
        }
      },
      eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
      eq_descripcion: eqDescripcion || null,
      notas: notas || null, status: savedCotRef.current ? undefined : "guardada",
    };
    if (savedCotRef.current) {
      const patchRes = await fetch(`/api/cotizaciones/${savedCotRef.current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!patchRes.ok) {
        const err = await patchRes.json().catch(() => ({}));
        throw new Error(err.error || `Error al actualizar cotización (${patchRes.status})`);
      }
      return savedCotRef.current.id;
    } else {
      const dbRes = await fetch("/api/cotizaciones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!dbRes.ok) {
        const err = await dbRes.json().catch(() => ({}));
        throw new Error(err.error || `Error al crear cotización (${dbRes.status})`);
      }
      const data = await dbRes.json();
      if (data.id) {
        const newCot = { id: data.id, folio: folioGenerado };
        savedCotRef.current = newCot;
        setSavedCot(newCot);
      }
      return data.id;
    }
  };

  const generarPDF = async () => {
    setGenerating(true);
    try {
      const { html, folio } = await buildPDFHtml(savedCotRef.current?.folio);
      setPreviewFolio(folio);

      try {
        let pdfB64 = pdfB64Ref.current;
        if (!pdfB64) {
          pdfB64 = await generarPDFBase64(html);
          pdfB64Ref.current = pdfB64;
        }
        const url = b64toBlobUrl(pdfB64);
        setPreviewPdfUrl(url);
      } catch (pdfErr) {
        console.warn("[cotizacion] Falló la generación de PDF para previsualizar, usando HTML fallback:", pdfErr);
        setPreviewHtml(html);
      }

      await persistToDB(folio);
    } catch (err) {
      console.error("[cotizacion] Error en generarPDF:", err);
    } finally {
      setGenerating(false);
    }
  };

  const guardarEnExpediente = async () => {
    if (!canGenerar) return;
    setSaveStatus("saving");
    try {
      const { html, folio } = await buildPDFHtml(savedCotRef.current?.folio);

      // 1. Guardar cotizacion en DB (siempre — es el paso crítico)
      const cotizacionId = await persistToDB(folio);
      if (!cotizacionId) throw new Error("No se pudo guardar la cotización");

      // 2. Intentar generar PDF (no-fatal: si falla, la cotización ya está guardada)
      try {
        let pdfB64 = pdfB64Ref.current;
        if (!pdfB64) {
          pdfB64 = await generarPDFBase64(html);
          pdfB64Ref.current = pdfB64;
        }
        await fetch("/api/expediente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, folio, pdfBase64: pdfB64, cotizacionId }),
        });
      } catch (pdfErr) {
        console.warn("[cotizacion] PDF no generado (no fatal):", pdfErr);
      }

      setSaveStatus("ok");
      setEmailStatus(p => p === "sending" ? "idle" : p);
      onSuccess?.(folio);
      setTimeout(() => setSaveStatus("idle"), 4000);
    } catch (err: any) {
      console.error("[cotizacion] error fatal al guardar:", err?.message);
      setSaveError(err?.message || "Error desconocido");
      setSaveStatus("error");
      setTimeout(() => { setSaveStatus("idle"); setSaveError(""); }, 5000);
    }
  };

  const enviarPorCorreo = async () => {
    if (!emailTo.trim() || !canGenerar) return;
    setEmailStatus("sending"); setEmailMsg("");

    const origin = "https://raw.githubusercontent.com/FernandoRBelBIONORDI/BIONORDI_IMAGENES/main/IMAGENES";
    const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    let folio = savedCotRef.current?.folio;
    if (!folio) {
      const res = await fetch(`/api/cotizaciones?nextfolio=1&tipo=${tipo}`);
      const data = await res.json();
      folio = data.folio as string;
    }
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    const propInfoEmail = getPropuestaInfo();

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
      ${eqDescripcion && tipo !== "reparacion" ? `<tr><td colspan="2" style="padding:8px 0 0;font-size:11px;color:#64748B;">${eqDescripcion}</td></tr>` : ""}
      ${eqFalla ? `<tr><td colspan="2" style="padding-top:8px;"><table cellpadding="8" cellspacing="0" border="0" width="100%" style="border-left:3px solid #EF4444;background:#FEF2F2;border-collapse:collapse;"><tr><td style="font-size:12px;color:#7F1D1D;"><strong>Falla reportada:</strong> ${eqFalla}</td></tr></table></td></tr>` : ""}
    </table>
  </td></tr>` : ""}

  <tr><td style="padding:20px 36px;border-bottom:1px solid #E2E8F0;">
    <p style="margin:0 0 12px;font-size:9px;color:#4E60A9;font-weight:800;text-transform:uppercase;letter-spacing:2px;">${propInfoEmail.titulo}</p>
    <p style="margin:0;font-size:13px;color:#334155;line-height:1.8;">${propInfoEmail.parrafoEmail}</p>
  </td></tr>
  <tr><td style="padding:20px 36px;background:#EEF0F7;border-top:2px solid #C5CAE0;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td valign="bottom">
          <p style="margin:0 0 6px;font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;">Inversi&#243;n Total (MXN)</p>
          <p style="margin:0;font-size:32px;font-weight:900;color:#4E60A9;letter-spacing:-1px;">${$f(total)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748B;">${propInfoEmail.subtituloTotal}</p>
        </td>
        <td align="right" valign="bottom">
          <p style="margin:0;font-size:12px;color:#64748B;">Subtotal: <strong style="color:#1E293B;">${$f(subtotal)}</strong></p>
          ${descuento > 0 ? `<p style="margin:4px 0 0;font-size:12px;color:#64748B;">Descuento: <strong style="color:#EF4444;">-${$f(descMonto)}</strong></p>` : ""}
          ${conIVA ? `<p style="margin:4px 0 0;font-size:12px;color:#64748B;">IVA (16%): <strong style="color:#1E293B;">${$f(iva)}</strong></p>` : ""}
        </td>
      </tr>
    </table>
  </td></tr>

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

    // Generar adjunto PDF, guardar en Base de Datos y almacenar en expediente del Lead
    let attachments: { filename: string; content: string; type: string }[] = [];
    let pdfB64 = "";
    let cotizacionId: number | null = null;
    try {
      const { html: pdfHtml, folio: finalFolio } = await buildPDFHtml(folio);
      folio = finalFolio;

      // 1. Guardar cotización en la base de datos (paso crítico)
      cotizacionId = await persistToDB(folio);

      // 2. Generar el archivo PDF
      pdfB64 = pdfB64Ref.current || "";
      if (!pdfB64) {
        pdfB64 = await generarPDFBase64(pdfHtml);
        pdfB64Ref.current = pdfB64;
      }
      attachments = [{ filename: `${folio}.pdf`, content: pdfB64, type: "application/pdf" }];

      // 3. Subir PDF al expediente del lead para habilitar el visualizador exacto
      if (cotizacionId && leadId) {
        await fetch("/api/expediente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leadId, folio, pdfBase64: pdfB64, cotizacionId }),
        }).catch(err => console.warn("[cotizacion] No se pudo guardar en el expediente:", err));
      }
    } catch (pdfErr) {
      console.warn("[cotizacion] Error persistiendo o generando PDF:", pdfErr);
    }

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
      if (data.success) {
        setEmailStatus("ok"); setEmailMsg(`Enviado a ${emailTo}`);
        if (leadId) {
          fetch("/api/interactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lead_id: Number(leadId),
              tipo: "email",
              contenido: `Cotización ${folio} enviada por correo — ${TIPO_LABELS[tipo]} · ${$f(total)} a ${emailTo.trim()}`,
              resultado: "sin_respuesta",
            }),
          }).catch(() => { });
        }
      } else { setEmailStatus("error"); setEmailMsg(data.error || "Error al enviar"); }
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

  const anyLoading = generating || saveStatus === "saving" || emailStatus === "sending";

  const handleClose = () => {
    if (savedCotRef.current) {
      onSuccess?.(savedCotRef.current.folio);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:w-[700px] sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-[#1E293B] text-[15px] leading-tight">{TIPO_LABELS[tipo]}</h3>
            <p className="text-[11px] text-gray-400 font-medium">
              {initialCotizacion ? `Editando cotización · Folio: ${initialCotizacion.folio}` : "Nueva cotización"}
            </p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Cliente */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest mb-3">Datos del cliente</div>

            {/* Vincular con lead existente */}
            <div className="mb-4">
              {leadId ? (() => {
                const lead = leadsList.find(l => l.id === leadId) || initialLead;
                return (
                  <div className="flex items-center gap-3 p-3 bg-[#EEF0F7] border border-[#C5CAE0] rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-[#4E60A9] truncate">{lead?.nombre}</p>
                      {lead?.ciudad && <p className="text-[10px] text-[#4E60A9]">{lead.ciudad}</p>}
                    </div>
                    {!initialLead && (
                      <button
                        onClick={() => { setLeadId(null); setLeadSearch(""); }}
                        className="text-[10px] text-[#4E60A9] hover:text-[#4E60A9] font-semibold shrink-0"
                      >
                        Cambiar
                      </button>
                    )}
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
                <input value={cliNombre} onChange={e => setCliNombre(e.target.value)} placeholder="Hospital / Clínica / Nombre" className={inp} />
              </Field>
              <Field label="Contacto / Dr.">
                <input value={cliContacto} onChange={e => setCliContacto(e.target.value)} placeholder="Dr. Nombre Apellido" className={inp} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Teléfono">
                <input value={cliTel} onChange={e => setCliTel(e.target.value)} placeholder="55 0000 0000" className={inp} />
              </Field>
              <Field label="Correo">
                <input value={cliCorreo} onChange={e => setCliCorreo(e.target.value)} placeholder="correo@ejemplo.com" className={inp} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Dirección">
                <input value={cliDireccion} onChange={e => setCliDireccion(e.target.value)} placeholder="Calle y número" className={inp} />
              </Field>
              <Field label="Ciudad / Municipio">
                <input value={cliCiudad} onChange={e => setCliCiudad(e.target.value)} placeholder="Ciudad" className={inp} />
              </Field>
              <Field label="Estado">
                <input value={cliEstado} onChange={e => setCliEstado(e.target.value)} placeholder="CDMX" className={inp} />
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
                        : tipo === "mantenimiento" || tipo === "venta"
                          ? <select value={eqTipo} onChange={e => setEqTipo(e.target.value)} className={sel}>
                            <option value="">— Seleccionar tipo —</option>
                            {TIPOS_EQUIPO.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          : <input value={eqTipo} onChange={e => setEqTipo(e.target.value)} placeholder="Ultrasonido, Monitor…" className={inp} />
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
                          placeholder="GE, Philips, Mindray…" className={inp} />
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
                          placeholder="Modelo" className={inp} />
                      )}
                    </Field>

                    <Field label="No. de Serie">
                      <input value={eqSerie} onChange={e => setEqSerie(e.target.value)} placeholder="SN-XXXXXX" className={inp} />
                    </Field>
                    {tipo !== "venta" && (
                      <Field label="Falla / Síntoma">
                        <input value={eqFalla} onChange={e => setEqFalla(e.target.value)} placeholder="Sin imagen, cable dañado…" className={inp} />
                      </Field>
                    )}
                  </div>

                  {tipo !== "reparacion" && (
                    <div className="mb-3">
                      <Field label="Características / Descripción (máx. 4 puntos)">
                        <div className="space-y-2 mt-1">
                          {eqDescripcion.split('\n').map((carac, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <span className="text-[10px] text-gray-400 font-bold w-4 text-right">{i + 1}.</span>
                              <input
                                value={carac}
                                onChange={e => {
                                  const arr = eqDescripcion.split('\n');
                                  arr[i] = e.target.value;
                                  setEqDescripcion(arr.join('\n'));
                                }}
                                placeholder={i === 0 ? "Ej: Pantalla de alta resolución..." : "..."}
                                className={inp}
                                maxLength={90}
                              />
                              {eqDescripcion.split('\n').length > 1 && (
                                <button onClick={() => {
                                  const arr = eqDescripcion.split('\n');
                                  arr.splice(i, 1);
                                  setEqDescripcion(arr.join('\n'));
                                }} className="text-red-400 hover:text-red-600 px-1 font-bold text-[14px]">×</button>
                              )}
                            </div>
                          ))}
                          {eqDescripcion.split('\n').length < 4 && (
                            <button onClick={() => setEqDescripcion(eqDescripcion + '\n')}
                              className="text-[10px] text-[#4E60A9] font-bold mt-1 ml-6 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                              <Plus size={12} /> Agregar punto
                            </button>
                          )}
                        </div>
                      </Field>
                    </div>
                  )}

                  {/* Subida de foto/diagrama para venta y mantenimiento en modo manual */}
                  {tipo !== "reparacion" && (
                    <div className="mt-1">
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        {tipo === "venta" ? "Foto / Diagrama del equipo" : "Foto del equipo"}
                      </label>
                      {imgEquipoB64 ? (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <img src={imgEquipoB64} alt="diagrama" className="h-8 w-12 object-contain rounded border border-blue-200 bg-white shrink-0" />
                          <span className="text-[10px] text-blue-700 font-medium flex-1">Imagen cargada — aparecerá en el PDF</span>
                          <button onClick={() => setImgEquipoB64(null)} className="text-[10px] text-blue-400 hover:text-blue-600">Quitar</button>
                        </div>
                      ) : (
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-blue-200 hover:border-[#4E60A9] text-[11px] text-[#4E60A9] font-medium transition-all bg-blue-50/40 hover:bg-blue-50">
                          <Plus size={12} />
                          Subir imagen
                          <input type="file" accept="image/*" className="hidden" onChange={handleImgEquipo} />
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
                <img src={imgEquipoB64} alt="diagrama" className="h-8 w-12 object-contain rounded border border-blue-200 bg-white shrink-0" />
                <span className="text-[10px] text-blue-700 font-medium flex-1">Diagrama cargado desde catálogo</span>
                <button onClick={() => setImgEquipoB64(null)} className="text-[10px] text-blue-400 hover:text-blue-600">Quitar</button>
              </div>
            )}
            <div className="space-y-2">
              {evidencias.map((ev, i) => (
                <div key={i} className="flex items-center gap-2">
                  <img src={ev.b64} alt={`ev${i}`} className={`h-10 w-16 object-cover rounded shrink-0 ${tipo === "reparacion" ? "border border-red-200" : "border border-blue-200"}`} />
                  <input
                    value={ev.caption}
                    onChange={e => setEvidenciaCaption(i, e.target.value)}
                    placeholder={tipo === "reparacion" ? "Descripción del defecto (opcional)" : "Descripción (opcional)"}
                    className="flex-1 text-[11px] border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4E60A9]/40" />
                  <button onClick={() => removeEvidencia(i)} className={`w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 ${tipo === "reparacion" ? "text-red-300 hover:text-red-500" : "text-gray-300 hover:text-red-400"}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {evidencias.length < 4 && (
                <label className={`cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed text-[11px] font-medium transition-all ${tipo === "reparacion"
                    ? "border-red-200 hover:border-red-400 text-red-500 bg-red-50/40 hover:bg-red-50"
                    : "border-blue-200 hover:border-[#4E60A9] text-[#4E60A9] bg-blue-50/40 hover:bg-blue-50"
                  }`}>
                  <Plus size={12} />
                  {tipo === "reparacion" ? "Agregar foto de defecto" :
                    tipo === "mantenimiento" ? "Agregar foto del mantenimiento" :
                      tipo === "venta" ? "Agregar foto del equipo" :
                        "Agregar foto de producto"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => handleEvidencia(e, evidencias.length)} />
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
                <Plus size={13} /> Agregar línea
              </button>
            </div>

            {/* Cabecera */}
            <div className="grid grid-cols-[1fr_60px_110px_90px_32px] gap-2 px-1 mb-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Descripción</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-center">Cant.</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-right">Precio Unit.</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-right">Importe</div>
              <div />
            </div>

            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_60px_110px_90px_32px] gap-2 items-center">
                  <input
                    value={item.descripcion}
                    onChange={e => updateItem(item.id, "descripcion", e.target.value)}
                    placeholder={tipo === "venta" ? "Nombre del producto/equipo" : "Descripción del servicio"}
                    className={inp} />
                  <input
                    type="number" min={1}
                    value={item.cantidad}
                    onChange={e => updateItem(item.id, "cantidad", Math.max(1, Number(e.target.value)))}
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-center focus:border-[#4E60A9]/40 bg-white w-full" />
                  <input
                    type="number" min={0}
                    value={item.precioUnit || ""}
                    onChange={e => updateItem(item.id, "precioUnit", Number(e.target.value))}
                    placeholder="0"
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-right focus:border-[#4E60A9]/40 bg-white w-full" />
                  <div className="text-[12px] font-bold text-[#4E60A9] text-right pr-1 tabular-nums">
                    {item.cantidad > 0 && item.precioUnit > 0
                      ? `$${(item.cantidad * item.precioUnit).toLocaleString("es-MX")}`
                      : <span className="text-gray-300 font-normal">—</span>}
                  </div>
                  <button onClick={() => removeItem(item.id)}
                    className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Texto de la propuesta técnica */}
          <div className="px-6 py-4 border-b border-gray-100">
            <button onClick={() => setShowPropuesta(p => !p)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">
              <span>Texto de la propuesta en el PDF</span>
              {showPropuesta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showPropuesta && (
              <div className="mt-3">
                <div className="flex justify-end mb-1.5">
                  <button
                    onClick={() => setPropuestaPDF(getPropuestaInfo().parrafoPDF)}
                    className="text-[10px] text-[#4E60A9] font-bold hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                    ↺ Generar automáticamente
                  </button>
                </div>
                <textarea
                  value={propuestaPDF}
                  onChange={e => setPropuestaPDF(e.target.value)}
                  placeholder="Deja vacío para generar automáticamente según el equipo y servicios, o escribe un texto personalizado aquí…"
                  rows={6}
                  className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none resize-y placeholder:text-gray-400 focus:border-[#4E60A9]/30 transition-all leading-relaxed"
                />
              </div>
            )}
          </div>

          {/* Facturación */}
          <div className="px-6 py-4 border-b border-gray-100">
            <button onClick={() => setShowFact(p => !p)}
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">
              <span>Datos de facturación del cliente</span>
              {showFact ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showFact && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Razón Social">
                    <input value={facRazonSoc} onChange={e => setFacRazonSoc(e.target.value)} placeholder="Nombre o empresa" className={inp} />
                  </Field>
                  <Field label="RFC">
                    <input value={facRFC} onChange={e => setFacRFC(e.target.value.toUpperCase())} placeholder="XXXX000000XX0" className={inp} />
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
                    <input value={facCorreo} onChange={e => setFacCorreo(e.target.value)} placeholder="correo@ejemplo.com" className={inp} />
                  </Field>
                  <Field label="Dirección fiscal">
                    <input value={facDirFiscal} onChange={e => setFacDirFiscal(e.target.value)} placeholder="Calle, colonia, CP" className={inp} />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-3 shrink-0 bg-gray-50/60">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={() => setConIVA(p => !p)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${conIVA ? "bg-[#4E60A9] border-[#4E60A9] text-white" : "bg-white border-gray-200 text-gray-500"}`}>
                IVA 16%
              </button>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-bold text-gray-500">Descuento</label>
                <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                  <input type="number" min={0} max={80} value={descuento}
                    onChange={e => setDescuento(Math.min(80, Math.max(0, Number(e.target.value))))}
                    className="w-10 text-[12px] font-bold text-center outline-none" />
                  <span className="text-[11px] text-gray-400 font-bold">%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[12px] font-bold text-gray-500">Generado por</label>
                <select
                  value={firmaUserId}
                  onChange={e => setFirmaUserId(e.target.value === "bionordi" ? "bionordi" : Number(e.target.value))}
                  className="text-[12px] bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#4E60A9]/30"
                >
                  <option value="bionordi">{bn.representante} ({bn.cargo})</option>
                  {usuariosList.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.cargo ? `(${u.cargo})` : ""}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="text-right">
              {descuento > 0 && <div className="text-[10px] text-gray-400 line-through">${subtotal.toLocaleString("es-MX")}</div>}
              {conIVA && <div className="text-[10px] text-gray-400">+ IVA ${iva.toLocaleString("es-MX")}</div>}
              <div className="text-[22px] font-extrabold text-[#4E60A9] tabular-nums">${total.toLocaleString("es-MX")}</div>
            </div>
          </div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Notas adicionales (opcional)…"
            className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-gray-400 focus:border-[#4E60A9]/30 transition-all" />
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                enviarPorCorreo();
              }}
              disabled={anyLoading || !canGenerar || !emailTo.trim()}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shrink-0 ${emailStatus === "ok" ? "bg-[#059669] text-white" :
                  emailStatus === "error" ? "bg-[#DC2626] text-white" :
                    "bg-[#0EA5E9] hover:bg-[#0284C7] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                }`}>
              {emailStatus === "sending" ? <><Mail size={13} className="animate-pulse" />Enviando…</> :
                emailStatus === "ok" ? <><Check size={13} />Enviado</> :
                  emailStatus === "error" ? <><AlertCircle size={13} />Error</> :
                    <><Mail size={13} />Enviar</>}
            </button>
          </div>
          {emailMsg && (
            <p className={`text-[11px] font-medium -mt-1 ${emailStatus === "ok" ? "text-[#059669]" : "text-[#DC2626]"}`}>
              {emailMsg}
            </p>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              guardarEnExpediente();
            }}
            disabled={anyLoading || !canGenerar}
            className={`w-full flex items-center justify-center gap-2 text-[12px] font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              saveStatus === "ok" ? "bg-[#059669] text-white" :
              saveStatus === "error" ? "bg-[#DC2626] text-white" :
              initialCotizacion 
                ? "bg-[#38AD64] hover:bg-[#2e9354] text-white shadow-sm hover:shadow" 
                : "bg-white border border-[#4E60A9] text-[#4E60A9] hover:bg-[#EEF0F7]"
            }`}>
            {saveStatus === "saving" ? (
              <><Save size={13} className="animate-pulse" />{initialCotizacion ? "Guardando cambios…" : "Guardando…"}</>
            ) : saveStatus === "ok" ? (
              <><Check size={13} />{initialCotizacion ? "Cambios guardados en cotización" : "PDF guardado en expediente"}</>
            ) : saveStatus === "error" ? (
              <><AlertCircle size={13} />{saveError ? `Error: ${saveError}` : "Error al guardar"}</>
            ) : (
              <><Save size={13} />{initialCotizacion ? "Guardar cambios en cotización" : "Guardar PDF en expediente"}</>
            )}
          </button>

          {/* Botón de reenvío premium si la cotización ya existe o fue guardada */}
          {(initialCotizacion || savedCot) && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                enviarPorCorreo();
              }}
              disabled={anyLoading || !canGenerar || !emailTo.trim()}
              className={`w-full flex items-center justify-center gap-2 text-[12px] font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                emailStatus === "ok" ? "bg-[#059669] text-white" :
                emailStatus === "error" ? "bg-[#DC2626] text-white" :
                "bg-white border border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#F0F9FF]"
              }`}>
              {emailStatus === "sending" ? (
                <><Mail size={13} className="animate-pulse" />Reenviando cotización…</>
              ) : emailStatus === "ok" ? (
                <><Check size={13} />Cotización reenviada con éxito</>
              ) : emailStatus === "error" ? (
                <><AlertCircle size={13} />Error al reenviar cotización</>
              ) : (
                <><Mail size={13} />Reenviar cotización por correo</>
              )}
            </button>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              generarPDF();
            }}
            disabled={!canGenerar || anyLoading}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-[#4E60A9] hover:bg-[#3d4e8a] py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                <span>Generando...</span>
              </>
            ) : (
              <>
                <Printer size={15} />
                <span>{!canGenerar ? "Completa nombre del cliente y al menos un servicio" : `Generar PDF · ${TIPO_LABELS[tipo]}`}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {(previewPdfUrl || previewHtml) && (
        <DocumentViewerModal
          title={`Cotización — ${previewFolio}`}
          url={previewPdfUrl || undefined}
          html={previewHtml || undefined}
          downloadName={`${previewFolio}.pdf`}
          onClose={() => {
            if (previewPdfUrl) {
              URL.revokeObjectURL(previewPdfUrl);
              setPreviewPdfUrl(null);
            }
            setPreviewHtml(null);
          }}
          hidePrint={!previewPdfUrl}
          hideDownload={!previewPdfUrl}
        />
      )}
    </div>
  );
}
