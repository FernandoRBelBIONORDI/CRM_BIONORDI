"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Save, Plus, Trash2, Loader2, Upload, CheckCircle2, AlertCircle, Mail, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react";
import DocumentViewerModal from "@/components/DocumentViewerModal";

interface BionordiCfg {
  razonSocial: string; rfc: string; banco: string; cuenta: string;
  clabe: string; direccionFiscal: string; correo: string;
  representante: string; cargo: string;
}

interface LineItem { id: string; descripcion: string; cantidad: number; precioUnit: number; }
interface CatalogoItem {
  id: number; tipo: string; marca: string; modelo: string;
  imagen_path: string; fotos_json: string | null;
  brochure_path: string | null; descripcion: string | null;
}
interface Lead {
  id: number; nombre: string; telefono?: string; correo?: string;
  ciudad?: string; estado_republica?: string; direccion?: string;
}

function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), descripcion: "", cantidad: 1, precioUnit: 0 };
}
function b64toBlobUrl(b64: string): string {
  const bin = window.atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
}
async function fetchBase64(path: string): Promise<string> {
  try {
    const res = await fetch(path);
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { return path; }
}

async function generarPDFBase64(htmlString: string): Promise<string> {
  // Primario: Puppeteer server-side
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
  } catch { /* fallback */ }

  // Fallback: html2canvas + jspdf en el browser
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

        const A4_HEIGHT = 1123;
        const elementsToCheck = doc.querySelectorAll('table, [style*="page-break-before:always"], [style*="page-break-before: always"], .avoid-break');

        elementsToCheck.forEach(el => {
          const rect = el.getBoundingClientRect();
          const isPageBreak = el.tagName === 'TABLE' || (el.getAttribute('style') || '').includes('page-break-before');

          if (isPageBreak) {
            const currentPos = rect.top;
            const pageNumber = Math.floor(currentPos / A4_HEIGHT);
            const nextPagePos = (pageNumber + 1) * A4_HEIGHT + 40;
            const pushAmount = nextPagePos - currentPos;
            if (pushAmount > 0 && (currentPos % A4_HEIGHT) > 50) {
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          } else {
            const topPage = Math.floor(rect.top / A4_HEIGHT);
            const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
            if (topPage !== bottomPage) {
              const nextPagePos = bottomPage * A4_HEIGHT + 40;
              const pushAmount = nextPagePos - rect.top;
              const currentMargin = parseFloat(doc.defaultView?.getComputedStyle(el as Element).marginTop || "0");
              (el as HTMLElement).style.marginTop = `${currentMargin + pushAmount}px`;
            }
          }
        });

        const sigEl = doc.querySelector('.signatures-wrapper') as HTMLElement;
        if (sigEl) {
          const rect = sigEl.getBoundingClientRect();
          const bottomPage = Math.floor(rect.bottom / A4_HEIGHT);
          const targetBottom = (bottomPage + 1) * A4_HEIGHT - 50;
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

const $f = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

// Input inline de plantilla del PDF
function F({ value, onChange, placeholder = "—", style = {}, multiline = false, rows = 2 }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  style?: React.CSSProperties; multiline?: boolean; rows?: number;
}) {
  const base: React.CSSProperties = {
    background: "transparent", border: "none", outline: "none",
    borderBottom: "1.5px dashed rgba(78,96,169,0.25)", fontFamily: "inherit",
    fontSize: "inherit", fontWeight: "inherit", color: "inherit",
    width: "100%", padding: "1px 2px", resize: "none", cursor: "text", lineHeight: "inherit", ...style,
  };
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={base} onClick={e => e.stopPropagation()} />
    : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onClick={e => e.stopPropagation()} />;
}

const TIPOS_TRANSDUCTOR = [
  "Lineal", "Convex / Curvilíneo", "Sectorial / Phased Array",
  "Intracavitario / Endovaginal", "TEE (Transesofágico)", "3D/4D", "Microconvex", "Otro",
];
const RAPIDOS_BRT = [
  { nombre: "Diagnóstico técnico de transductor", precio: 1500 },
  { nombre: "Reparación transductor lineal", precio: 6500 },
  { nombre: "Reparación transductor convex", precio: 6500 },
  { nombre: "Reparación transductor sectorial", precio: 7500 },
  { nombre: "Reparación transductor intracavitario", precio: 8500 },
  { nombre: "Reparación transductor TEE", precio: 12000 },
  { nombre: "Reparación transductor 3D/4D", precio: 9500 },
  { nombre: "Cambio de cable del transductor", precio: 3200 },
  { nombre: "Reencapsulado (carcasa)", precio: 2800 },
];

export default function CotizarReparacionPageWrapper() {
  return <Suspense><CotizarReparacionPage /></Suspense>;
}

function CotizarReparacionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Config Bionordi ──────────────────────────────────────────────────────
  const [bn, setBn] = useState<BionordiCfg>({
    razonSocial: "Bionordi S.A. de C.V.", rfc: "—", banco: "—", cuenta: "—",
    clabe: "—", direccionFiscal: "Ciudad de México, CDMX",
    correo: "contacto@bionordi.mx", representante: "", cargo: "",
  });

  // ── Cliente ──────────────────────────────────────────────────────────────
  const [leadId, setLeadId] = useState<number | null>(null);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [cliNombre, setCliNombre] = useState("");
  const [cliContacto, setCliContacto] = useState("");
  const [cliTel, setCliTel] = useState("");
  const [cliCorreo, setCliCorreo] = useState("");
  const [cliDireccion, setCliDireccion] = useState("");

  // ── Equipo ───────────────────────────────────────────────────────────────
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [equipoMode, setEquipoMode] = useState<"catalogo" | "manual">("catalogo");
  const [eqTipo, setEqTipo] = useState("");
  const [eqMarca, setEqMarca] = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie, setEqSerie] = useState("");
  const [eqFalla, setEqFalla] = useState("");
  const [eqBrochureB64, setEqBrochureB64] = useState<string | null>(null);

  // ── Ítems ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const addItem = () => setItems(p => [...p, newItem()]);
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  // ── Imágenes ─────────────────────────────────────────────────────────────
  const [imgTransductor, setImgTransductor] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<{ b64: string; caption: string }[]>([]);

  // ── Ajustes ──────────────────────────────────────────────────────────────
  const [descuento, setDescuento] = useState(0);
  const [conIVA, setConIVA] = useState(true);
  const [notas, setNotas] = useState("");
  const [propuestaPDF, setPropuestaPDF] = useState("");
  const [usuariosList, setUsuariosList] = useState<{ id: number; nombre: string; cargo?: string }[]>([]);
  const [firmaUserId, setFirmaUserId] = useState<number | "bionordi">("bionordi");

  // ── Email ────────────────────────────────────────────────────────────────
  const [emailTo, setEmailTo] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [showEmail, setShowEmail] = useState(false);

  // ── Persistencia / UI ────────────────────────────────────────────────────
  const [folio, setFolio] = useState("");
  const [savedCot, setSavedCot] = useState<{ id: number; folio: string } | null>(null);
  const savedCotRef = useRef<{ id: number; folio: string } | null>(null);
  const pdfB64Ref = useRef<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewFolio, setPreviewFolio] = useState("");
 
  // ── Estados de Colapso (Abatimiento) ──────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [collCliente, setCollCliente] = useState(false);
  const [collItems, setCollItems] = useState(false);
  const [collQuick, setCollQuick] = useState(false);
  const [collFirma, setCollFirma] = useState(false);
  const [collNotas, setCollNotas] = useState(true);
  const [collPoliticas, setCollPoliticas] = useState(true);
  const [polVigencia, setPolVigencia] = useState("");
  const [polPago, setPolPago] = useState("");
  const [polEntrega, setPolEntrega] = useState("");
  const [polGarantia, setPolGarantia] = useState("");

  const expandCardOnly = (cardName: "cliente" | "items" | "quick" | "firma" | "notas" | "propuesta") => {
    setSidebarCollapsed(false);
    setCollCliente(cardName !== "cliente");
    setCollItems(cardName !== "items" && cardName !== "propuesta");
    setCollQuick(cardName !== "quick" && cardName !== "propuesta");
    setCollFirma(cardName !== "firma");
    setCollNotas(cardName !== "notas");
  };

  // ── Derivados ────────────────────────────────────────────────────────────
  const validItems = items.filter(i => i.descripcion.trim() !== "");
  const subtotal = validItems.reduce((a, i) => a + i.cantidad * i.precioUnit, 0);
  const descMonto = Math.round(subtotal * descuento / 100);
  const baseNeta = subtotal - descMonto;
  const iva = conIVA ? Math.round(baseNeta * 0.16) : 0;
  const total = baseNeta + iva;

  const transductores = catalogo.filter(e => e.tipo === "transductor");
  const marcasUnicas = [...new Set(transductores.map(e => e.marca).filter(Boolean))].sort() as string[];
  const modelosPorMarca = transductores.filter(e => !eqMarca || e.marca === eqMarca);

  const sigName = firmaUserId === "bionordi" ? bn.representante
    : usuariosList.find(u => u.id === firmaUserId)?.nombre || bn.representante;
  const sigRole = firmaUserId === "bionordi" ? bn.cargo
    : usuariosList.find(u => u.id === firmaUserId)?.cargo || "Ejecutivo";

  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const getPolVigencia = () => polVigencia.trim() !== "" ? polVigencia : `15 días naturales (hasta el ${vigencia})`;
  const getPolPago = () => polPago.trim() !== "" ? polPago : `Contado 100% anticipado — o anticipo del 50% (${$f(Math.round(total / 2))}) y liquidación contra entrega.`;
  const getPolEntrega = () => polEntrega.trim() !== "" ? polEntrega : `5 a 7 días hábiles a partir del ingreso del equipo y validación de anticipo.`;
  const getPolGarantia = () => polGarantia.trim() !== "" ? polGarantia : `12 meses sobre la reparación. No cubre daños por caídas, tirones de cable o derrames posteriores a la entrega.`;

  // ── Efectos ──────────────────────────────────────────────────────────────
  useEffect(() => { savedCotRef.current = savedCot; }, [savedCot]);

  useEffect(() => { pdfB64Ref.current = null; },
    [cliNombre, cliContacto, cliTel, cliCorreo, cliDireccion,
      eqTipo, eqMarca, eqModelo, eqSerie, eqFalla, items, descuento, conIVA,
      notas, firmaUserId, imgTransductor, evidencias, propuestaPDF, eqBrochureB64,
      polVigencia, polPago, polEntrega, polGarantia]);

  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      const c = d.config || {};
      setBn({
        razonSocial: c.fact_razon_social || "Bionordi S.A. de C.V.",
        rfc: c.fact_rfc || "—", banco: c.fact_banco || "—",
        cuenta: c.fact_cuenta || "—", clabe: c.fact_clabe || "—",
        direccionFiscal: c.fact_direccion_fiscal || "Ciudad de México, CDMX",
        correo: c.fact_correo_facturacion || "contacto@bionordi.mx",
        representante: c.nombre_representante || "",
        cargo: c.fact_cargo_representante || "",
      });
    }).catch(() => {});

    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuariosList(d.usuarios || [])).catch(() => {});
    fetch("/api/leads").then(r => r.json()).then(d => setLeadsList(d.leads || [])).catch(() => {});
    fetch("/api/catalogo").then(r => r.json()).then(d => setCatalogo(d.equipos || [])).catch(() => {});

    // Cargar cotización o lead inicial
    const qId = searchParams.get("id");
    const qLeadId = searchParams.get("leadId");

    if (qId) {
      setLoadingQuote(true);
      fetch(`/api/cotizaciones/${qId}`).then(r => r.json()).then(d => {
        const c = d.cotizacion;
        if (c) {
          setSavedCot({ id: c.id, folio: c.folio });
          setFolio(c.folio);
          setLeadId(c.lead_id);
          setCliNombre(c.lead_nombre || "");
          setCliTel(c.lead_telefono || "");
          setCliCorreo(c.lead_correo || "");
          setEmailTo(c.lead_correo || "");
          setCliDireccion(c.lead_direccion || "");
          setEqTipo(c.eq_tipo || "");
          setEqMarca(c.eq_marca || "");
          setEqModelo(c.eq_modelo || "");
          setEqSerie(c.eq_serie || "");
          setEqFalla(c.eq_falla || "");
          setNotas(c.notas || "");

          if (c.items_json) {
            try {
              let parsed = typeof c.items_json === 'string' ? JSON.parse(c.items_json) : c.items_json;
              if (typeof parsed === 'string') {
                parsed = JSON.parse(parsed); // Double-stringification fix
              }
              if (parsed) {
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setItems(parsed.map((item: any) => ({
                    id: Math.random().toString(36).slice(2),
                    descripcion: item.descripcion || "",
                    cantidad: item.cantidad || 1,
                    precioUnit: item.precioUnit || 0
                  })));
                } else if (parsed.items && Array.isArray(parsed.items)) {
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
                    if (m.cliCorreo !== undefined) setCliCorreo(m.cliCorreo);
                    if (m.cliDireccion !== undefined) setCliDireccion(m.cliDireccion);
                    if (m.eqFalla !== undefined) setEqFalla(m.eqFalla);
                    if (m.eqSerie !== undefined) setEqSerie(m.eqSerie);
                    if (m.descuento !== undefined) setDescuento(m.descuento);
                    if (m.conIVA !== undefined) setConIVA(m.conIVA);
                    if (m.firmaUserId !== undefined) setFirmaUserId(m.firmaUserId);
                    if (m.evidencias !== undefined) setEvidencias(m.evidencias || []);
                    if (m.propuestaPDF !== undefined) setPropuestaPDF(m.propuestaPDF || "");
                    if (m.imgEquipoB64 !== undefined) setImgTransductor(m.imgEquipoB64 || null);
                    if (m.eqBrochureB64 !== undefined) setEqBrochureB64(m.eqBrochureB64 || null);
                    if (m.polVigencia !== undefined) setPolVigencia(m.polVigencia || "");
                    if (m.polPago !== undefined) setPolPago(m.polPago || "");
                    if (m.polEntrega !== undefined) setPolEntrega(m.polEntrega || "");
                    if (m.polGarantia !== undefined) setPolGarantia(m.polGarantia || "");
                  }
                }
              }
            } catch {}
          }
        }
      }).catch(() => {}).finally(() => setLoadingQuote(false));
    } else {
      fetch("/api/cotizaciones?nextfolio=1&tipo=reparacion")
        .then(r => r.json()).then(d => setFolio(d.folio || "")).catch(() => {});

      if (qLeadId) {
        fetch(`/api/leads/${qLeadId}`).then(r => r.json()).then(d => {
          const l = d.lead; if (!l) return;
          setLeadId(l.id);
          const fullAddress = [l.direccion, l.ciudad, l.estado_republica].filter(Boolean).join(", ");
          setCliNombre(l.nombre || "");
          setCliTel(l.telefono || "");
          setCliCorreo(l.correo || "");
          setEmailTo(l.correo || "");
          setCliDireccion(fullAddress);
        }).catch(() => {});
      }
    }
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const uploadImage = (setter: (b64: string) => void) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const seleccionarLead = (l: Lead) => {
    setLeadId(l.id); setLeadSearch("");
    const fullAddress = [l.direccion, l.ciudad, l.estado_republica].filter(Boolean).join(", ");
    setCliNombre(l.nombre || "");
    setCliTel(l.telefono || "");
    setCliCorreo(l.correo || "");
    setEmailTo(l.correo || "");
    setCliDireccion(fullAddress);
  };

  const seleccionarDelCatalogo = async (eq: CatalogoItem) => {
    setEqMarca(eq.marca || "");
    setEqModelo(eq.modelo || "");
    if (eq.imagen_path) {
      setImgTransductor(await fetchBase64(eq.imagen_path));
    } else {
      setImgTransductor(null);
    }
    if (eq.brochure_path && !eq.brochure_path.toLowerCase().endsWith(".pdf")) {
      setEqBrochureB64(await fetchBase64(eq.brochure_path));
    } else {
      setEqBrochureB64(null);
    }
  };

  const generarParrafoAlcance = (): string => {
    const nombres = validItems.map(i => i.descripcion.trim()).filter(Boolean);
    if (nombres.length === 0) return "";
    const equipoRef = [eqMarca, eqModelo].filter(Boolean).join(" ") || "el transductor";
    const lista = nombres.length === 1 ? nombres[0].toLowerCase()
      : nombres.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombres[nombres.length - 1].toLowerCase();
    const fallaFrase = eqFalla ? ` La falla reportada («${eqFalla}») ha sido evaluada y el plan de intervención contempla su resolución integral.` : "";
    const esp: Record<string, string> = {
      "Lineal": "El transductor lineal opera en rangos de alta frecuencia (5–18 MHz). La intervención contempla el reacondicionamiento del arreglo de cristales piezoeléctricos, asegurando la uniformidad del haz acústico y la resolución axial óptima.",
      "Convex / Curvilíneo": "El transductor convex opera en rangos de frecuencia media-baja (2–6 MHz). La intervención contempla el reacondicionamiento del arreglo curvilíneo de cristales, preservando la geometría del sector de imagen y la uniformidad del campo acústico.",
      "Sectorial / Phased Array": "La intervención incluye calibración del desfase electrónico entre canales, restauración del arreglo piezoeléctrico y verificación del cableado coaxial multi-conductor de alta precisión.",
      "Intracavitario / Endovaginal": "La intervención incluye verificación de hermeticidad, restitución del material acústico del lente distal, pruebas de aislamiento eléctrico y validación de la integridad del cable en toda su longitud.",
      "TEE (Transesofágico)": "La intervención abarca revisión del mecanismo de articulación multiplanar, restitución del encapsulado con materiales biocompatibles y pruebas de aislamiento conforme a IEC 60601-2-37.",
      "3D/4D": "La intervención contempla la revisión del sistema de barrido, restitución del polímero acústico del lente volumétrico y calibración del sistema de procesamiento de señal tridimensional.",
      "Microconvex": "La intervención contempla el reacondicionamiento del arreglo curvilíneo de pequeño radio con especial atención a la integridad del sellado hermético del lente acústico.",
    };
    const especifico = esp[eqTipo] || "El equipo ha sido evaluado mediante protocolos de diagnóstico automatizado, determinando con precisión el alcance de la intervención técnica necesaria para restablecer el rendimiento óptimo del transductor.";
    return `El presente presupuesto comprende la realización de los siguientes trabajos sobre ${equipoRef}: ${lista}.${fallaFrase} ${especifico} El servicio incluye mano de obra especializada, refacciones y materiales necesarios, pruebas de funcionamiento conforme a protocolos técnicos establecidos, y garantía escrita de 12 meses sobre la intervención realizada.`;
  };

  // ── buildPDFHtml ─────────────────────────────────────────────────────────
  const buildPDFHtml = async (): Promise<{ html: string; folio: string }> => {
    const imgTrans = await fetchBase64("/transductor.png");
    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");

    let usedFolio = savedCotRef.current?.folio || folio;
    if (!usedFolio) {
      const r = await fetch("/api/cotizaciones?nextfolio=1&tipo=reparacion");
      const d = await r.json();
      usedFolio = d.folio as string;
      setFolio(usedFolio);
    }

    const propText = propuestaPDF.trim() || generarParrafoAlcance() || "Servicio integral de reparación con diagnóstico técnico, materiales y garantía de 12 meses.";
    const vigStr = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const fechaStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    const equipoHTML = (eqTipo || eqMarca || eqModelo || eqSerie || eqFalla) ? `
    <div class="eq-card">
      <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Especificaciones del Equipo</div>
      <div class="eq-grid">
        <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie || "—"}</div></div>
        ${eqFalla ? `<div class="eq-full"><div class="eq-lbl" style="color:#B91C1C;">Falla Reportada / Síntoma</div><div class="eq-val" style="color:#7F1D1D;margin-top:2px;">${eqFalla.replace(/\n/g, "<br/>")}</div></div>` : ""}
      </div>
    </div>` : "";

    const evidenciaHTML = evidencias.length > 0 ? `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid;">
      <div class="card-title" style="color:#B91C1C;border-bottom-color:#FECACA;">Evidencia Fotográfica del Defecto</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        ${evidencias.map((ev, i) => `
          <div style="flex:1;min-width:130px;max-width:200px;">
            <img src="${ev.b64}" alt="Evidencia ${i + 1}" style="max-width:100%;max-height:140px;width:auto;height:auto;border-radius:6px;border:1px solid #FECACA;display:block;margin:0 auto;" />
            <div style="margin-top:4px;font-size:9px;color:#7F1D1D;font-weight:600;text-align:center;">Foto ${i + 1}${ev.caption ? ` — ${ev.caption}` : ""}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

    const brochureHTML = eqBrochureB64 ? `
    <div class="tech-card avoid-break" style="margin-bottom:20px;">
      <div class="card-title">Ficha Técnica del Equipo${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <img src="${eqBrochureB64}" alt="Ficha técnica" style="width:100%;max-height:220px;object-fit:contain;margin-top:10px;border-radius:6px;border:1px solid #E2E8F0;" />
    </div>` : "";

    // AJUSTE: Ocultar por completo la tabla de artículos en el PDF
    const tableHTML = ""; 

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/>
<title>Cotización ${usedFolio} · Bionordi</title>
<style>
  @page{margin:10mm 0 15mm 0}@page:first{margin-top:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{padding:30px 65px;max-width:816px;margin:0 auto;}
  .page-two{padding:30px 65px;max-width:816px;margin:0 auto;display:flex;flex-direction:column;min-height:244mm;}
  .page-spacer{flex:1;}.avoid-break{page-break-inside:avoid;break-inside:avoid;}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px}
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
  .dot{position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;}
  .diag-list{flex:1.2;display:flex;flex-direction:column;gap:12px}
  .d-item{display:flex;gap:10px;font-size:10.5px;color:#334155;line-height:1.4;align-items:flex-start}
  .d-num{width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;}
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
</style>
</head>
<body>
<div class="page">
<div class="hdr">
  <div><img src="${logoB64}" alt="Bionordi" style="height:52px;width:auto;display:block;" /></div>
  <div class="meta-box">
    <div class="doc-title">Reparación de Transductores</div>
    <div class="meta-grid">
      <div class="meta-lbl">Folio</div><div class="meta-val">${usedFolio}</div>
      <div class="meta-lbl">Fecha</div><div class="meta-val">${fechaStr}</div>
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
    <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${cliDireccion || "—"}</div></div>
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
<div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
  <div class="card-title">Alcance Técnico y Diagnóstico Integral${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
  <p class="diag-p" style="margin-bottom:8px;">Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>. Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.</p>
  <div class="diag-grid">
    <div style="flex:.8;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;height:148px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
      <div style="position:relative;display:inline-block;">
        <img src="${imgTrans}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Transductor"}" style="max-width:100%;max-height:140px;width:auto;height:auto;display:block;" />
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
      <div class="d-item"><div class="d-num">4</div><div><strong>Conector:</strong> Limpieza profunda de pines de contacto, verificación de continuidad en placa base and prueba de impedancia de señal en cada canal del arreglo piezoeléctrico.</div></div>
    </div>
  </div>
</div>
${evidenciaHTML}
</div>
<div style="page-break-before: always; break-before: always;"></div>
<div class="page-two">
${brochureHTML}
<div class="tech-card avoid-break" style="margin-bottom:20px;border-left:4px solid #4E60A9;margin-top:0px;">
  <div class="card-title">Propuesta Técnica de Servicio</div>
  <p style="font-size:11px;color:#334155;line-height:1.5;margin-bottom:10px;">${propText}</p>
  <div style="background:#EEF0F7;border:1px solid #C5CAE0;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inversión Total</div>
      <div style="font-size:11px;color:#4E60A9;">Incluye materiales, mano de obra y garantía de 12 meses</div>
    </div>
    <div style="text-align:right;">
      ${descuento > 0 ? `<div style="font-size:11px;color:#94A3B8;text-decoration:line-through;margin-bottom:2px;">${$f(subtotal)}</div>` : ""}
      <div style="font-size:28px;font-weight:900;color:#4E60A9;letter-spacing:-1px;">${$f(total)}</div>
      ${conIVA ? `<div style="font-size:9px;color:#38AD64;font-weight:700;">IVA incluido</div>` : `<div style="font-size:9px;color:#64748B;">Más IVA</div>`}
    </div>
  </div>
</div>
${notas ? `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:9px 13px;margin-bottom:20px;font-size:11px;color:#92400E;border-radius:0 4px 4px 0;"><strong>Notas:</strong> ${notas}</div>` : ""}
<div class="bottom-flex avoid-break" style="margin-top:15px;">
  <div class="billing-instructions">
    <div class="card-title">Instrucciones para Solicitar Factura</div>
    <div class="b-step"><span style="font-weight:800;">1.</span><div>Realice el pago total o anticipo a la cuenta CLABE indicada arriba.</div></div>
    <div class="b-step"><span style="font-weight:800;">2.</span><div>Envíe un correo a <strong>${bn.correo}</strong> adjuntando comprobante de pago y Constancia de Situación Fiscal.</div></div>
    <div class="b-step"><span style="font-weight:800;">3.</span><div>Indique su <strong>Uso de CFDI</strong> en el correo.</div></div>
    <div class="b-step"><span style="font-weight:800;">4.</span><div>Su factura será procesada en un lapso no mayor a 24 horas hábiles.</div></div>
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
    <li><strong>Vigencia:</strong> ${getPolVigencia()}.</li>
    <li><strong>Esquema de Pago:</strong> ${getPolPago()}.</li>
    <li><strong>Tiempo de Entrega:</strong> ${getPolEntrega()}.</li>
    <li><strong>Garantía:</strong> ${getPolGarantia()}.</li>
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
  <div class="footer"><strong>${bn.razonSocial}</strong> · ${bn.direccionFiscal} · ${bn.correo}<br/>Documento generado digitalmente por el sistema de Gestión Bionordi.</div>
</div>
</div>
</body></html>`;

    return { html, folio: usedFolio };
  };

  // ── Persistir en DB ──────────────────────────────────────────────────────
  const persistToDB = async (usedFolio: string) => {
    const body = {
      lead_id: leadId || null,
      tipo: "reparacion", folio: usedFolio, monto_total: total,
      items_json: {
        items: validItems.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
        meta: {
          cliContacto, cliTel, cliCorreo, cliDireccion,
          eqFalla, eqSerie, descuento, conIVA, firmaUserId,
          evidencias, propuestaPDF, imgEquipoB64: imgTransductor, eqBrochureB64,
          polVigencia, polPago, polEntrega, polGarantia,
        },
      },
      eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
      notas: notas || null, status: "guardada",
    };
    if (savedCotRef.current) {
      await fetch(`/api/cotizaciones/${savedCotRef.current.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
    } else {
      const res = await fetch("/api/cotizaciones", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.id) {
        const cot = { id: d.id, folio: usedFolio };
        savedCotRef.current = cot;
        setSavedCot(cot);
      }
    }
  };

  const generarPDF = async () => {
    setGenerating(true);
    try {
      const { html, folio: f } = await buildPDFHtml();
      setPreviewFolio(f);
      let b64 = pdfB64Ref.current;
      if (!b64) {
        try {
          b64 = await generarPDFBase64(html);
          pdfB64Ref.current = b64;
          setPreviewUrl(b64toBlobUrl(b64));
          setPreviewHtml(null);
        } catch {
          setPreviewHtml(html);
          setPreviewUrl(null);
        }
      } else {
        setPreviewUrl(b64toBlobUrl(b64));
      }
      await persistToDB(f);
    } finally { setGenerating(false); }
  };

  const guardar = async () => {
    setSaveStatus("saving");
    try {
      pdfB64Ref.current = null;
      const { folio: f } = await buildPDFHtml();
      await persistToDB(f);
      setSaveStatus("ok");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
  };

  const enviarEmail = async () => {
    if (!emailTo.trim()) return;
    setEmailStatus("sending");
    try {
      pdfB64Ref.current = null;
      const { html, folio: f } = await buildPDFHtml();
      let b64 = await generarPDFBase64(html);
      await persistToDB(f);
      const res = await fetch("/api/email/cotizacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo, folio: f, pdfBase64: b64, tipo: "reparacion", cliNombre }),
      });
      if (!res.ok) throw new Error();
      setEmailStatus("ok");
      setTimeout(() => { setEmailStatus("idle"); setShowEmail(false); }, 3000);
    } catch { setEmailStatus("error"); setTimeout(() => setEmailStatus("idle"), 3000); }
  };

  // ── Estilos del Panel Lateral de Control en Tema Claro del CRM ─────────────────
  const sidebarBg = "#FFFFFF";
  const sidebarHeaderBg = "#F8FAFC";
  const sidebarBorderColor = "#E2E8F0";
  const inputBg = "#FFFFFF";
  const inputBorder = "#CBD5E1";
  const inputTextColor = "#1E293B";

  const floatingCard: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 10px 25px -5px rgba(78,96,169,0.06), 0 8px 10px -6px rgba(78,96,169,0.04)",
    transition: "all 0.2s ease-in-out"
  };
  const cardInputStyle: React.CSSProperties = {
    width: "100%",
    fontSize: "11px",
    border: "1px solid #CBD5E1",
    borderRadius: "8px",
    padding: "6px 10px",
    outline: "none",
    background: "#FFFFFF",
    color: "#1E293B",
    marginTop: "2px",
    fontWeight: 500
  };

  const cardTitle: React.CSSProperties = { fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" };
  const iRow: React.CSSProperties = { display: "flex", marginBottom: "6px", fontSize: "11px", lineHeight: "1.4" };
  const iLbl: React.CSSProperties = { width: "85px", color: "#64748B", fontWeight: 700, flexShrink: 0 };
  const iVal: React.CSSProperties = { flex: 1, color: "#1E293B", fontWeight: 500 };
  const selStyle: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", outline: "none", fontSize: "11px", fontWeight: 600, color: "#1E293B", width: "100%", cursor: "pointer", fontFamily: "inherit", padding: "6px 10px" };

  // Lead suggestions
  const leadMatches = leadSearch.length > 1
    ? leadsList.filter(l => l.nombre.toLowerCase().includes(leadSearch.toLowerCase()) || (l.ciudad || "").toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="flex-1 flex flex-row overflow-hidden" style={{ height: "100vh", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#F4F7FB" }}>

      {/* ════════════ PANEL DE CONTROL DESLIZABLE (CAJÓN DE DETALLES - ANCHO AJUSTABLE) ════════════ */}
      <div style={{
        width: sidebarCollapsed ? "0px" : "340px",
        minWidth: sidebarCollapsed ? "0px" : "340px",
        maxWidth: sidebarCollapsed ? "0px" : "340px",
        height: "100%",
        background: sidebarBg,
        borderRight: sidebarCollapsed ? "none" : `1px solid ${sidebarBorderColor}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 110
      }}>
        {/* Título de la sección de control */}
        <div style={{ flexShrink: 0, padding: "16px", borderBottom: `1px solid ${sidebarBorderColor}`, background: sidebarHeaderBg }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>
            Panel de Control
          </div>
          <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px" }}>
            Selecciona un elemento en el PDF para configurarlo
          </div>
        </div>

        {/* Scrollable controls panel claro */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", background: "#F4F7FB" }}>
          
          {/* 1. Vinculación Lead CRM y Datos del Cliente */}
          <div style={floatingCard}>
            <div
              onClick={() => setCollCliente(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Buscador de Leads (CRM)</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center" }}>
                {collCliente ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            {!collCliente && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                
                {/* Selector / Vinculador CRM */}
                <div style={{ position: "relative" }}>
                  {leadId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {leadsList.find(l => l.id === leadId)?.nombre || cliNombre}
                        </div>
                        <div style={{ fontSize: "9px", color: "#64748B", marginTop: "1px" }}>vinculado al CRM</div>
                      </div>
                      <button onClick={() => { setLeadId(null); setLeadSearch(""); }} style={{ fontSize: "9px", color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px" }}>
                        <X size={10} /> Quitar
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={leadSearch}
                        onChange={e => setLeadSearch(e.target.value)}
                        placeholder="🔍 Buscar cliente en CRM..."
                        style={{ width: "100%", fontSize: "11px", border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "8px 12px", outline: "none", background: "#FFFFFF", color: inputTextColor }}
                      />
                      {leadMatches.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 110, overflow: "hidden", marginTop: "4px" }}>
                          {leadMatches.map(l => (
                            <button key={l.id} onClick={() => seleccionarLead(l)}
                              style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer", fontSize: "11px", color: "#1E293B", display: "block" }}>
                              <div style={{ fontWeight: 700 }}>{l.nombre}</div>
                              {l.ciudad && <div style={{ fontSize: "9px", color: "#64748B" }}>{l.ciudad}</div>}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>



              </div>
            )}
          </div>

          {/* 2. Editor de Servicios / Ítems */}
          <div style={floatingCard}>
            <div
              onClick={() => setCollItems(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Servicios / Ítems</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "8px" }}>
                {!collItems && (
                  <button
                    onClick={e => { e.stopPropagation(); addItem(); }}
                    style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: "#fff", background: "#4E60A9", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontWeight: 700 }}
                  >
                    <Plus size={10} /> Agregar
                  </button>
                )}
                {collItems ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            {!collItems && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px", marginBottom: "12px" }}>
                  {items.map((item, i) => (
                    <div key={item.id} style={{ display: "flex", gap: "4px", alignItems: "center", background: "#F8FAFC", padding: "6px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ width: "16px", height: "16px", background: "#CBD5E1", color: "#475569", borderRadius: "50%", fontSize: "8px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" } as any}>{i + 1}</div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input value={item.descripcion} onChange={e => updateItem(item.id, "descripcion", e.target.value)} placeholder="Descripción del servicio..."
                          style={{ fontSize: "10.5px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "4px 6px", outline: "none", color: "#1E293B", background: "#FFFFFF" }} />
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input type="number" value={item.cantidad} min={1} onChange={e => updateItem(item.id, "cantidad", parseInt(e.target.value) || 1)} placeholder="Cant" title="Cantidad"
                            style={{ width: "40px", fontSize: "10px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "3px", outline: "none", textAlign: "center", color: "#1E293B", background: "#FFFFFF" }} />
                          <input type="number" value={item.precioUnit || ""} onChange={e => updateItem(item.id, "precioUnit", parseFloat(e.target.value) || 0)} placeholder="Precio" title="Precio Unitario"
                            style={{ flex: 1, fontSize: "10px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "3px 6px", outline: "none", textAlign: "right", color: "#1E293B", background: "#FFFFFF" }} />
                          <span style={{ fontSize: "10px", color: "#4E60A9", fontWeight: 700, minWidth: "60px", textAlign: "right", alignSelf: "center" }}>{$f(item.cantidad * item.precioUnit)}</span>
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>

                {/* Impuestos & Descuentos */}
                <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "8px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px", color: "#4E60A9", fontWeight: 700, cursor: "pointer" }}>
                    <input type="checkbox" checked={conIVA} onChange={e => setConIVA(e.target.checked)} style={{ cursor: "pointer" }} /> IVA 16%
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
                    <span style={{ color: "#64748B", fontWeight: 600 }}>Desc (%)</span>
                    <input type="number" value={descuento} min={0} max={100} onChange={e => setDescuento(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      style={{ width: "42px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "2px 4px", fontSize: "10px", textAlign: "center", outline: "none", background: "#FFFFFF", color: "#1E293B" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Servicios Rápidos (Catálogo) */}
          <div style={floatingCard}>
            <div
              onClick={() => setCollQuick(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Servicios Rápidos (Un Clic)</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center" }}>
                {collQuick ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            {!collQuick && (
              <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr", gap: "5px", maxHeight: "150px", overflowY: "auto", paddingRight: "2px" }}>
                {RAPIDOS_BRT.map(s => (
                  <button
                    key={s.nombre}
                    onClick={() => {
                      if (items.find(i => i.descripcion === s.nombre)) return;
                      const limpio = items.filter(i => i.descripcion === "" && i.precioUnit === 0);
                      const resto = items.filter(i => i.descripcion !== "" || i.precioUnit !== 0);
                      setItems([...resto, { id: Math.random().toString(36).slice(2), descripcion: s.nombre, cantidad: 1, precioUnit: s.precio }]);
                    }}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", cursor: "pointer", fontSize: "10px", color: "#1E293B", textAlign: "left" }}
                  >
                    <span style={{ fontWeight: 600, maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.nombre}>{s.nombre}</span>
                    <span style={{ color: "#4E60A9", fontWeight: 700 }}>{$f(s.precio)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
 
          {/* 5. Notas Adicionales */}
          <div style={floatingCard}>
            <div
              onClick={() => setCollNotas(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Notas Adicionales</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center" }}>
                {collNotas ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            {!collNotas && (
              <div style={{ marginTop: "12px" }}>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={3}
                  placeholder="Escribe notas adicionales importantes aquí..."
                  style={{
                    width: "100%",
                    fontSize: "11px",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    outline: "none",
                    background: "#FFFFFF",
                    color: "#1E293B",
                    resize: "vertical",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            )}
          </div>



          {/* 4. Firmante de la Cotización */}
          <div style={floatingCard}>
            <div
              onClick={() => setCollFirma(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Personalización y Firma</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center" }}>
                {collFirma ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            
            {!collFirma && (
              <div style={{ marginTop: "12px" }}>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>REPRESENTANTE / EMPLEADO</label>
                <select value={String(firmaUserId)} onChange={e => setFirmaUserId(e.target.value === "bionordi" ? "bionordi" : parseInt(e.target.value))}
                  style={selStyle}>
                  <option value="bionordi">{bn.representante} — {bn.cargo}</option>
                  {usuariosList.map(u => <option key={u.id} value={String(u.id)}>{u.nombre} — {u.cargo || "Ejecutivo"}</option>)}
                </select>
              </div>
            )}
          </div>

        </div>
      </div>
      
      {/* ════════════ PREVISUALIZADOR LIVE PDF DERECHO (66% ancho) ════════════ */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", background: "#D8DDE4", overflow: "hidden" }}>
        
        {/* Horizontal Top Actions Bar */}
        <div style={{
          height: "56px",
          background: "#FFFFFF",
          borderBottom: "1px solid #E2E8F0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
          zIndex: 100,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
        }}>
          {/* Left: Volver, toggle sidebar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/cotizar")} 
              style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
              title="Volver al menú de cotizaciones">
              <ArrowLeft size={14} /> Volver
            </button>

            <button onClick={() => setSidebarCollapsed(p => !p)} 
              style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: sidebarCollapsed ? "#FFFFFF" : "#F1F5F9", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
              title={sidebarCollapsed ? "Mostrar panel de control" : "Ocultar panel de control"}>
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {sidebarCollapsed ? "Mostrar Ajustes" : "Ocultar Ajustes"}
            </button>
          </div>



          {/* Right: Guardar, Enviar, Generar PDF */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
            {saveStatus === "ok" && <span style={{ color: "#10B981", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> Guardado</span>}
            {saveStatus === "error" && <span style={{ color: "#EF4444", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={14} /> Error</span>}

            {/* Guardar */}
            <button onClick={guardar} disabled={saveStatus === "saving"} 
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#1E293B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
              title="Guardar cotización (Ctrl+S)">
              {saveStatus === "saving" ? <Loader2 size={14} className="animate-spin text-[#4E60A9]" /> : <Save size={14} className="text-[#64748B]" />}
              Guardar
            </button>

            {/* Enviar */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowEmail(p => !p)} 
                style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: showEmail ? "#F1F5F9" : "#FFFFFF", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
                title="Enviar cotización por correo electrónico">
                <Mail size={14} />
                Enviar
              </button>
              {showEmail && (
                <div style={{ position: "absolute", right: "0px", top: "42px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "12px", padding: "12px", width: "250px", zIndex: 130, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>Enviar por correo</div>
                  <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="destinatario@correo.com"
                    style={{ width: "100%", fontSize: "11px", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "6px 10px", outline: "none", background: "#FFFFFF", color: "#1E293B", marginBottom: "8px" }} />
                  <button onClick={enviarEmail} disabled={emailStatus === "sending" || !emailTo.trim()}
                    style={{ width: "100%", padding: "7px", borderRadius: "8px", border: "none", background: "#4E60A9", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                    {emailStatus === "sending" ? <><Loader2 size={12} className="animate-spin" /> Enviando…</>
                      : emailStatus === "ok" ? <><CheckCircle2 size={12} /> Enviado</>
                        : emailStatus === "error" ? "Error al enviar"
                          : <><Mail size={12} /> Enviar PDF</>}
                  </button>
                </div>
              )}
            </div>

            {/* Generar PDF */}
            <button onClick={generarPDF} disabled={generating} 
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "none", background: generating ? "#3B4DA0" : "#4E60A9", color: "#fff", cursor: generating ? "not-allowed" : "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700, boxShadow: "0 4px 10px rgba(78,96,169,0.2)" }} 
              title="Generar y descargar archivo PDF de la cotización">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generar PDF
            </button>
          </div>
        </div>

        {/* Document Scrollable Workspace */}
        <div style={{ flex: 1, overflowY: "auto", padding: "30px 20px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          {loadingQuote ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center", height: "80vh" }}>
              <Loader2 size={32} className="animate-spin text-[#4E60A9]" />
              <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 700 }}>Cargando cotización...</span>
            </div>
          ) : (
            <div style={{ width: "816px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "35px" }}>
              
              {/* Etiqueta Hoja 1 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-25px", padding: "0 4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>PÁGINA 1 · VISTA PREVIA DE IMPRESIÓN (CARTA)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>8.5" x 11" (816 x 1056 px) · área útil 939 px</span>
              </div>

              {/* ───── HOJA 1 ───── */}
              {/* paddingTop=30px (@page:first margin-top=0 + .page padding=30px) */}
              {/* paddingBottom=87px (30px CSS + 57px @page margin-bottom 15mm) → área útil=939px */}
              <div style={{
                background: "#fff",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                borderRadius: "4px",
                paddingTop: "30px",
                paddingRight: "65px",
                paddingBottom: "87px",
                paddingLeft: "65px",
                position: "relative",
                width: "816px",
                height: "1056px",
                minHeight: "1056px",
                maxHeight: "1056px",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                overflow: "hidden"
              }}>
              
              {/* Header de la Hoja */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
                <div><img src="/LOGO_PRINCIPAL.png" alt="Bionordi" style={{ height: "52px", width: "auto", display: "block" }} /></div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "16px", fontWeight: 300, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>Reparación de Transductores</div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 15px", justifyContent: "end", fontSize: "11px" }}>
                    <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folio</div>
                    <div style={{ color: "#1E293B", fontWeight: 700 }}>{savedCot?.folio || folio || "—"}</div>
                    <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha</div>
                    <div style={{ color: "#1E293B", fontWeight: 700 }}>{fecha}</div>
                  </div>
                </div>
              </div>
              
              <div style={{ height: "4px", background: "linear-gradient(90deg,#4E60A9,#38AD64,#E2E8F0)", borderRadius: "4px", marginBottom: "10px" }} />
              
              {/* Info Section */}
              <div style={{ display: "flex", gap: "20px", marginBottom: "8px" }}>
                {/* Datos Cliente (Editable inline) */}
                <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>Datos del Cliente</div>
                    <button
                      onClick={() => expandCardOnly("cliente")}
                      style={{ fontSize: "9px", color: "#4E60A9", fontWeight: 700, border: "1px solid #C5CAE0", background: "#EEF0F7", cursor: "pointer", padding: "2px 6px", borderRadius: "4px", fontFamily: "inherit" }}
                    >
                      🔍 Vincular CRM
                    </button>
                  </div>
                  <div style={iRow}>
                    <div style={iLbl}>Cliente</div>
                    <div style={iVal}><F value={cliNombre} onChange={setCliNombre} placeholder="Hospital / Clínica / Doctor" /></div>
                  </div>
                  <div style={iRow}>
                    <div style={iLbl}>Contacto</div>
                    <div style={iVal}><F value={cliContacto} onChange={setCliContacto} placeholder="Dr. Nombre Apellido" /></div>
                  </div>
                  <div style={iRow}>
                    <div style={iLbl}>Teléfono</div>
                    <div style={iVal}><F value={cliTel} onChange={setCliTel} placeholder="55 0000 0000" /></div>
                  </div>
                  <div style={iRow}>
                    <div style={iLbl}>Correo</div>
                    <div style={iVal}><F value={cliCorreo} onChange={setCliCorreo} placeholder="correo@ejemplo.com" /></div>
                  </div>
                  {/* AJUSTE: Entrada única para Dirección */}
                  <div style={iRow}>
                    <div style={iLbl}>Dirección</div>
                    <div style={iVal}><F value={cliDireccion} onChange={setCliDireccion} placeholder="Calle, Número, Ciudad, Estado" style={{ minWidth: "100%" }} /></div>
                  </div>
                </div>

                {/* Datos de Transferencia */}
                <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>Datos de Transferencia</div>
                  {[["Beneficiario", bn.razonSocial], ["RFC", bn.rfc], ["Banco", bn.banco], ["Cuenta", bn.cuenta], ["CLABE", bn.clabe]].map(([label, val]) => (
                    <div key={label} style={iRow}>
                      <div style={iLbl}>{label}</div>
                      <div style={{ ...iVal, color: "#64748B", fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Especificaciones del Equipo */}
              <div style={{ background: "#fff", border: "1px solid #CBD5E1", borderLeft: "4px solid #4E60A9", borderRadius: "12px", padding: "10px 14px", marginBottom: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>Especificaciones del Equipo</div>
                  {/* Selector rápido Catálogo / Manual */}
                  <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "8px" }}>
                    {(["catalogo", "manual"] as const).map(mode => (
                      <button key={mode} onClick={() => {
                        setEquipoMode(mode);
                        if (mode === "manual") { setEqMarca(""); setEqModelo(""); setImgTransductor(null); setEqBrochureB64(null); }
                      }}
                        style={{ padding: "3px 8px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, border: "none", cursor: "pointer", background: equipoMode === mode ? "#fff" : "transparent", color: equipoMode === mode ? "#4E60A9" : "#94A3B8", boxShadow: equipoMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                        {mode === "catalogo" ? "Catálogo" : "Manual"}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "15px" }}>
                  {/* Tipo */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipo</div>
                    <div>
                      <select value={eqTipo} onChange={e => setEqTipo(e.target.value)} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "11.5px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer" }}>
                        <option value="">— Seleccionar —</option>
                        {TIPOS_TRANSDUCTOR.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Marca */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Marca</div>
                    <div>
                      {equipoMode === "catalogo" && marcasUnicas.length > 0 ? (
                        <select value={eqMarca} onChange={e => { setEqMarca(e.target.value); setEqModelo(""); setImgTransductor(null); setEqBrochureB64(null); }} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "11.5px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer" }}>
                          <option value="">— Seleccionar —</option>
                          {marcasUnicas.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      ) : (
                        <F value={eqMarca} onChange={setEqMarca} placeholder="GE, Philips..." />
                      )}
                    </div>
                  </div>

                  {/* Modelo */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Modelo</div>
                    <div>
                      {equipoMode === "catalogo" && modelosPorMarca.length > 0 ? (
                        <select value={eqModelo} onChange={async e => {
                          const found = transductores.find(t => t.modelo === e.target.value && (!eqMarca || t.marca === eqMarca));
                          setEqModelo(e.target.value);
                          if (found) await seleccionarDelCatalogo(found); else { setImgTransductor(null); setEqBrochureB64(null); }
                        }} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "11.5px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer" }}>
                          <option value="">— Seleccionar —</option>
                          {modelosPorMarca.map(e => <option key={e.id} value={e.modelo}>{e.modelo}{e.imagen_path ? " ✓" : ""}</option>)}
                        </select>
                      ) : (
                        <F value={eqModelo} onChange={setEqModelo} placeholder="Modelo" />
                      )}
                    </div>
                  </div>

                  {/* No. Serie */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>No. de Serie</div>
                    <div>
                      <F value={eqSerie} onChange={setEqSerie} placeholder="SN-XXXXXX" style={{ fontWeight: 600 }} />
                    </div>
                  </div>
                </div>

                {/* Falla inline */}
                <div style={{ background: "#FEF2F2", padding: "8px 12px", borderRadius: "8px", borderLeft: "3px solid #EF4444", marginTop: "10px" }}>
                  <div style={{ fontSize: "9px", color: "#B91C1C", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Falla Reportada / Síntoma</div>
                  <div style={{ fontSize: "11.5px", color: "#7F1D1D", fontWeight: 600, marginTop: "2px" }}>
                    <F value={eqFalla} onChange={setEqFalla} placeholder="Escribe aquí el síntoma o la falla reportada por el cliente..." multiline rows={2}
                      style={{ color: "#7F1D1D", fontWeight: 600, borderBottom: "1.5px dashed rgba(185,28,28,0.25)" }} />
                  </div>
                </div>
              </div>

              {/* Alcance Técnico (Diagrama de 4 Puntos) */}
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginTop: "8px", marginBottom: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                  Alcance Técnico y Diagnóstico Integral{eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}
                </div>
                <p style={{ fontSize: "11px", color: "#475569", lineHeight: "1.5", marginBottom: "8px" }}>
                  Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>. Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.
                </p>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div 
                    style={{ flex: "0 0 auto", width: "170px", height: "148px", border: "1px solid #CBD5E1", borderRadius: "8px", background: "#fff", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <img src="/transductor.png" alt="Diagrama Transductor" style={{ maxWidth: "100%", maxHeight: "140px", objectFit: "contain" }} />
                    {[{ top: "25%", left: "39%", n: 1 }, { top: "20%", left: "55%", n: 2 }, { top: "68%", left: "30%", n: 3 }, { top: "88%", left: "82%", n: 4 }].map(({ top, left, n }) => (
                      <div key={n} style={{ position: "absolute", top, left, transform: "translate(-50%,-50%)", width: "20px", height: "20px", background: "#4E60A9", color: "#fff", borderRadius: "50%", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #fff" }}>{n}</div>
                    ))}
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {[
                      { n: 1, title: "Lente Acústico / Membrana:", text: "Retiro del material desgastado, descontaminación del arreglo de cristales e inyección de nuevo polímero acústico con curado térmico." },
                      { n: 2, title: "Carcasa y Sellado:", text: "Reencapsulado de uniones para evitar filtraciones de gel transmisor y proteger los componentes electrónicos internos." },
                      { n: 3, title: "Cableado:", text: "Revisión de micro-coaxiales, verificación de continuidad eléctrica y refuerzo estructural en zonas de flexión y estrés mecánico." },
                      { n: 4, title: "Conector:", text: "Limpieza profunda de pines de contacto y prueba de impedancia de señal en cada canal del arreglo piezoeléctrico." },
                    ].map(({ n, title, text }) => (
                      <div key={n} style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#334155", lineHeight: "1.4", alignItems: "flex-start" }}>
                        <div style={{ width: "18px", height: "18px", background: "#E5EAF7", color: "#4E60A9", borderRadius: "50%", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>{n}</div>
                        <div><strong>{title}</strong> {text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Evidencia Fotográfica */}
              <div style={{ background: "#F8FAFC", border: "1px solid #FECACA", borderRadius: "12px", padding: "10px 14px", marginTop: "8px" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#B91C1C", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #FECACA", paddingBottom: "4px" }}>Evidencia Fotográfica del Defecto</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
                  {evidencias.map((ev, i) => (
                    <div key={i} style={{ position: "relative", flex: "0 0 auto", width: "135px" }}>
                      <img src={ev.b64} alt={`ev${i}`} style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "6px", border: "1px solid #FECACA", display: "block" }} />
                      <button onClick={() => setEvidencias(p => p.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: "3px", right: "3px", width: "16px", height: "16px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>×</button>
                      <input value={ev.caption} onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                        placeholder={`Describir foto ${i + 1}...`}
                        style={{ width: "100%", marginTop: "4px", fontSize: "9px", border: "1px solid #FECACA", borderRadius: "4px", padding: "2px 4px", outline: "none", color: "#7F1D1D", background: "#FFF5F5" }} />
                    </div>
                  ))}
                  <button onClick={() => uploadImage(b64 => setEvidencias(p => [...p, { b64, caption: "" }]))}
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", width: "100px", height: "100px", border: "2px dashed #FECACA", borderRadius: "8px", background: "transparent", cursor: "pointer", color: "#B91C1C", fontSize: "9px", fontWeight: 700 }}>
                    <Plus size={14} /> Cargar foto
                  </button>
                </div>
              </div>

              {/* AJUSTE: Se eliminó la tabla del previsualizador de solo lectura del PDF */}

              {/* Indicador visual: margen inferior @page 15mm = 57px */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Margen inferior @page — 15 mm</span>
              </div>

            </div>

            {/* Etiqueta Hoja 2 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-25px", padding: "0 4px", marginTop: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>PÁGINA 2 · VISTA PREVIA DE IMPRESIÓN (CARTA)</span>
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>8.5" x 11" (816 x 1056 px) · área útil 863 px</span>
            </div>

            {/* ───── HOJA 2 ───── */}
            {/* paddingTop=68px (38px @page margin-top 10mm + 30px CSS padding) */}
            {/* paddingBottom=87px (57px @page margin-bottom 15mm + 30px CSS padding) → área útil=863px */}
            <div style={{
              background: "#fff",
              boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
              borderRadius: "4px",
              paddingTop: "68px",
              paddingRight: "65px",
              paddingBottom: "87px",
              paddingLeft: "65px",
              position: "relative",
              width: "816px",
              height: "1056px",
              minHeight: "1056px",
              maxHeight: "1056px",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              overflow: "hidden"
            }}>

              {/* Indicador visual: margen superior @page 10mm = 38px */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "38px", background: "rgba(248,250,252,0.88)", borderBottom: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Margen superior @page — 10 mm</span>
              </div>
              {/* Indicador visual: margen inferior @page 15mm = 57px */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>Margen inferior @page — 15 mm</span>
              </div>

              {/* Ficha técnica del catálogo */}
              {eqBrochureB64 && (
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px", position: "relative" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>Ficha Técnica del Equipo{eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
                  <img src={eqBrochureB64} alt="Ficha técnica" style={{ width: "100%", maxHeight: "220px", objectFit: "contain", borderRadius: "6px", border: "1px solid #E2E8F0" }} />
                  <button onClick={() => setEqBrochureB64(null)} style={{ position: "absolute", top: "10px", right: "10px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>×</button>
                </div>
              )}

              {/* Propuesta Técnica (Editable inline en el text area) */}
              <div 
                onClick={() => expandCardOnly("propuesta")}
                style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderLeft: "4px solid #4E60A9", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px", cursor: "pointer" }}
              >
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>Propuesta Técnica de Servicio</div>
                <textarea value={propuestaPDF} onChange={e => setPropuestaPDF(e.target.value)} rows={4}
                  placeholder="Puedes escribir aquí un texto personalizado de propuesta técnica. Si lo dejas vacío, el sistema generará automáticamente un desglose detallado basado en el tipo de transductor y servicios seleccionados..."
                  style={{ width: "100%", fontSize: "11px", color: "#334155", lineHeight: "1.5", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 10px", resize: "vertical", outline: "none", background: "#fff", fontFamily: "inherit", cursor: "text" }}
                  onClick={e => { e.stopPropagation(); expandCardOnly("propuesta"); }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <button 
                    onClick={e => { e.stopPropagation(); setPropuestaPDF(generarParrafoAlcance()); }} 
                    style={{ fontSize: "10px", color: "#4E60A9", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    ↺ Generar propuesta automática
                  </button>
                  <button 
                    onClick={e => { e.stopPropagation(); expandCardOnly("notas"); }} 
                    style={{ fontSize: "10px", color: "#B45309", background: "#FFFBEB", border: "1px solid #FCD34D", cursor: "pointer", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px", fontFamily: "inherit" }}
                  >
                    📝 Notas Adicionales
                  </button>
                </div>
                <div 
                  onClick={e => { e.stopPropagation(); expandCardOnly("items"); }}
                  style={{ background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", cursor: "pointer" }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>Inversión Total</div>
                      <button
                        onClick={e => { e.stopPropagation(); expandCardOnly("items"); }}
                        style={{ fontSize: "8.5px", color: "#4E60A9", fontWeight: 700, border: "1px solid #C5CAE0", background: "#FFFFFF", cursor: "pointer", padding: "1px 5px", borderRadius: "4px", fontFamily: "inherit" }}
                      >
                        ✏️ Editar ítems
                      </button>
                    </div>
                    <div style={{ fontSize: "11px", color: "#4E60A9", marginTop: "2px" }}>Incluye materiales, mano de obra y garantía de 12 meses</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {descuento > 0 && <div style={{ fontSize: "11px", color: "#94A3B8", textDecoration: "line-through", marginBottom: "2px" }}>{$f(subtotal)}</div>}
                    <div style={{ fontSize: "28px", fontWeight: 900, color: "#4E60A9", letterSpacing: "-1px" }}>{$f(total)}</div>
                    <div style={{ fontSize: "9px", color: conIVA ? "#38AD64" : "#64748B", fontWeight: 700 }}>{conIVA ? "IVA incluido" : "Más IVA"}</div>
                  </div>
                </div>
              </div>

              {/* Notas (Visualización estática en hoja) */}
              {notas.trim() !== "" && (
                <div 
                  onClick={() => expandCardOnly("notas")}
                  style={{ background: "#FFFBEB", borderLeft: "3px solid #F59E0B", padding: "9px 13px", marginBottom: "20px", fontSize: "11px", color: "#92400E", borderRadius: "0 4px 4px 0", cursor: "pointer" }}
                >
                  <strong>Notas:</strong> {notas}
                </div>
              )}

              {/* Billing + Totales */}
              <div style={{ display: "flex", gap: "20px", marginBottom: "16px", alignItems: "flex-start" }}>
                <div style={{ flex: 1, background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "12px", padding: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "1px solid #C5CAE0", paddingBottom: "4px" }}>Instrucciones para Solicitar Factura</div>
                  {["Realice el pago total o anticipo a la cuenta CLABE indicada arriba.",
                    `Envíe un correo a ${bn.correo} adjuntando comprobante de pago y CSF.`,
                    "Indique su Uso de CFDI en el correo.",
                    "Su factura será procesada en un lapso no mayor a 24 horas hábiles."].map((step, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#4E60A9", marginBottom: "8px", lineHeight: "1.4" }}>
                      <span style={{ fontWeight: 800 }}>{i + 1}.</span><div>{step}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px" }}>
                  {[["Subtotal", $f(subtotal)], ...(descuento > 0 ? [[`Descuento (${descuento}%)`, `−${$f(descMonto)}`]] : []), ...(conIVA ? [["IVA (16%)", $f(iva)]] : [])].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748B", marginBottom: "8px" }}>
                      <div>{label}</div>
                      <div style={{ fontWeight: 600, color: label?.startsWith("Desc") ? "#EF4444" : "#1E293B" }}>{val}</div>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "16px", fontWeight: 900, color: "#4E60A9", borderTop: "2px solid #E2E8F0", paddingTop: "12px", marginTop: "4px" }}>
                    <div>Total (MXN)</div><div>{$f(total)}</div>
                  </div>
                </div>
              </div>

              {/* Políticas */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>Políticas Comerciales y Garantía</div>
                <ul style={{ listStyle: "none", padding: 0 }}>
                  <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "6px", lineHeight: "1.5" }}>
                    <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold", fontSize: "14px", lineHeight: 1, top: "-1px" }}>•</span>
                    <strong>Vigencia:</strong> <F value={polVigencia} onChange={setPolVigencia} placeholder={`15 días naturales (hasta el ${vigencia})`} style={{ display: "inline-block", width: "auto", minWidth: "250px" }} />
                  </li>
                  <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "6px", lineHeight: "1.5" }}>
                    <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold", fontSize: "14px", lineHeight: 1, top: "-1px" }}>•</span>
                    <strong>Esquema de Pago:</strong> <F value={polPago} onChange={setPolPago} placeholder={`Contado 100% anticipado — o anticipo del 50% (${$f(Math.round(total / 2))}) y liquidación contra entrega.`} style={{ display: "inline-block", width: "auto", minWidth: "450px" }} />
                  </li>
                  <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "6px", lineHeight: "1.5" }}>
                    <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold", fontSize: "14px", lineHeight: 1, top: "-1px" }}>•</span>
                    <strong>Tiempo de Entrega:</strong> <F value={polEntrega} onChange={setPolEntrega} placeholder="5 a 7 días hábiles a partir del ingreso del equipo y validación de anticipo." style={{ display: "inline-block", width: "auto", minWidth: "400px" }} />
                  </li>
                  <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "6px", lineHeight: "1.5" }}>
                    <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold", fontSize: "14px", lineHeight: 1, top: "-1px" }}>•</span>
                    <strong>Garantía:</strong> <F value={polGarantia} onChange={setPolGarantia} placeholder="12 meses sobre la reparación. No cubre daños por caídas, tirones de cable o derrames posteriores a la entrega." style={{ display: "inline-block", width: "auto", minWidth: "450px" }} />
                  </li>
                </ul>
              </div>

              <div style={{ flex: 1 }} />

              {/* Firma */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div 
                  onClick={() => expandCardOnly("firma")}
                  style={{ text_align: "center", width: "240px", cursor: "pointer" } as any}
                >
                  <div style={{ borderTop: "2px solid #CBD5E1", paddingTop: "10px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#4E60A9" }}>{sigName}</div>
                    <div style={{ fontSize: "10px", fontWeight: 600, color: "#64748B", textTransform: "uppercase", marginTop: "2px" }}>{sigRole}</div>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", marginTop: "4px" }}>{bn.razonSocial}</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", borderTop: "1px solid #E2E8F0", paddingTop: "10px", marginTop: "10px", fontSize: "10px", color: "#94A3B8", lineHeight: "1.6" }}>
                <strong>{bn.razonSocial}</strong> · {bn.direccionFiscal} · {bn.correo}<br />
                Documento generado digitalmente por el sistema de Gestión Bionordi.
              </div>

            </div>

          </div>
        )}
        </div>
      </div>

      {/* Visor de Documentos */}
      {(previewUrl || previewHtml) && (
        <DocumentViewerModal
          title={`Cotización — ${previewFolio}`}
          url={previewUrl || undefined}
          html={previewHtml || undefined}
          downloadName={`${previewFolio}.pdf`}
          onClose={() => { setPreviewUrl(null); setPreviewHtml(null); }}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        input:focus, textarea:focus, select:focus { border-bottom-color: rgba(78,96,169,0.7) !important; }
      `}</style>
    </div>
  );
}
