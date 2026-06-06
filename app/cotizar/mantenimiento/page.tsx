"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Save, Plus, Trash2, Loader2, Upload, CheckCircle2, AlertCircle, Mail, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
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
  fac_razon_social?: string; fac_rfc?: string; fac_regimen?: string;
  fac_uso_cfdi?: string; fac_dir_fiscal?: string; fac_correo?: string;
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
  } catch { }

  // Fallback client-side
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

const MANTENIMIENTO_FEATURES: Record<string, string[]> = {
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
    "<strong>Mantenimiento Preventivo:</strong> Reemplazo de empaques internos y entrega de informe técnico de operatividad."
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
  ],
  "ultrasonido": [
    "<strong>Diagnóstico General:</strong> Revisión sistemática de todos los componentes del equipo y pruebas de funcionamiento inicial.",
    "<strong>Limpieza y Calibración:</strong> Limpieza profunda interior y exterior, ajuste de parámetros de imagen según especificaciones del fabricante.",
    "<strong>Revisión Eléctrica:</strong> Verificación de voltajes, corrientes y sistema de tierra física. Prueba de puertos de transductores.",
    "<strong>Reporte de Estado:</strong> Entrega de informe técnico con hallazgos y recomendaciones para mantenimiento preventivo futuro."
  ]
};

export default function CotizarMantenimientoPageWrapper() {
  return <Suspense><CotizarMantenimientoPage /></Suspense>;
}

function CotizarMantenimientoPage() {
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

  // Facturación
  const [facRazonSoc, setFacRazonSoc] = useState("");
  const [facRFC, setFacRFC] = useState("");
  const [facRegimen, setFacRegimen] = useState("612");
  const [facCFDI, setFacCFDI] = useState("G03");
  const [facDirFiscal, setFacDirFiscal] = useState("");
  const [facCorreo, setFacCorreo] = useState("");

  // ── Equipo ───────────────────────────────────────────────────────────────
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [equipoMode, setEquipoMode] = useState<"catalogo" | "manual">("catalogo");
  const [eqTipo, setEqTipo] = useState("");
  const [eqMarca, setEqMarca] = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie, setEqSerie] = useState("");
  const [eqFalla, setEqFalla] = useState("");
  const [eqDescripcion, setEqDescripcion] = useState("");
  const [eqBrochureB64, setEqBrochureB64] = useState<string | null>(null);
  const [eqFotos, setEqFotos] = useState<string[]>([]);

  // ── Ítems ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const addItem = () => setItems(p => [...p, newItem()]);
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  // ── Imágenes ─────────────────────────────────────────────────────────────
  const [imgTransductor, setImgTransductor] = useState<string | null>(null);
  const [evidencias, setEvidencias] = useState<{ b64: string; caption: string }[]>([]);

  // Características / Puntos del Mantenimiento
  const [features, setFeatures] = useState<string[]>([
    "Diagnóstico General: Revisión sistemática de componentes físicos, electrónicos y pruebas de encendido.",
    "Limpieza Preventiva: Descontaminación interior y exterior, retiro de polvo y lubricación.",
    "Revisión Eléctrica: Verificación de voltajes internos y sistemas de seguridad del equipo.",
    "Pruebas de Funcionamiento: Validación de operatividad y entrega de reporte técnico."
  ]);

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

  // ── Estados de Colapso ──────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [collCliente, setCollCliente] = useState(false);
  const [collItems, setCollItems] = useState(false);
  const [collFirma, setCollFirma] = useState(false);
  const [collNotas, setCollNotas] = useState(true);
  const [collPoliticas, setCollPoliticas] = useState(true);
  const [polVigencia, setPolVigencia] = useState("");
  const [polPago, setPolPago] = useState("");
  const [polEntrega, setPolEntrega] = useState("");
  const [polGarantia, setPolGarantia] = useState("");

  const expandCardOnly = (cardName: "cliente" | "items" | "firma" | "notas" | "propuesta") => {
    setSidebarCollapsed(false);
    setCollCliente(cardName !== "cliente");
    setCollItems(cardName !== "items" && cardName !== "propuesta");
    setFirmaUserId(firmaUserId);
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

  const marcasUnicas = [...new Set(catalogo.map(e => e.marca).filter(Boolean))].sort() as string[];
  const modelosPorMarca = catalogo.filter(e => !eqMarca || e.marca === eqMarca);

  const sigName = firmaUserId === "bionordi" ? bn.representante
    : usuariosList.find(u => u.id === firmaUserId)?.nombre || bn.representante;
  const sigRole = firmaUserId === "bionordi" ? bn.cargo
    : usuariosList.find(u => u.id === firmaUserId)?.cargo || "Ejecutivo";

  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const getPolVigencia = () => polVigencia.trim() !== "" ? polVigencia : `15 días naturales (hasta el ${vigencia})`;
  const getPolPago = () => polPago.trim() !== "" ? polPago : `Contado 100% anticipado — o anticipo del 50% (${$f(Math.round(total / 2))}) y liquidación contra entrega.`;
  const getPolEntrega = () => polEntrega.trim() !== "" ? polEntrega : `5 a 7 días hábiles a partir del ingreso del equipo y validación de anticipo.`;
  const getPolGarantia = () => polGarantia.trim() !== "" ? polGarantia : `3 meses sobre el servicio de mantenimiento realizado.`;

  // ── Efectos ──────────────────────────────────────────────────────────────
  useEffect(() => { savedCotRef.current = savedCot; }, [savedCot]);

  useEffect(() => { pdfB64Ref.current = null; },
    [cliNombre, cliContacto, cliTel, cliCorreo, cliDireccion,
      eqTipo, eqMarca, eqModelo, eqSerie, eqFalla, items, descuento, conIVA,
      notas, firmaUserId, imgTransductor, evidencias, propuestaPDF, eqBrochureB64,
      polVigencia, polPago, polEntrega, polGarantia, features, facRazonSoc, facRFC,
      facRegimen, facCFDI, facDirFiscal, facCorreo]);

  // Autopopulate features when eqTipo changes
  useEffect(() => {
    const t = eqTipo.toLowerCase();
    let key = "ultrasonido";
    if (t.includes("monitor")) key = "monitor";
    else if (t.includes("anestesia") || t.includes("ventilador")) key = "anestesia";
    else if (t.includes("desfibrilador")) key = "desfibrilador";
    else if (t.includes("electro")) key = "electrocardiografo";

    const defaultFeats = MANTENIMIENTO_FEATURES[key] || MANTENIMIENTO_FEATURES["ultrasonido"];
    setFeatures(defaultFeats.map(f => f.replace(/<[^>]+>/g, "")));
  }, [eqTipo]);

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
    }).catch(() => { });

    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuariosList(d.usuarios || [])).catch(() => { });
    fetch("/api/leads").then(r => r.json()).then(d => setLeadsList(d.leads || [])).catch(() => { });
    fetch("/api/catalogo").then(r => r.json()).then(d => setCatalogo(d.equipos || [])).catch(() => { });

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
                parsed = JSON.parse(parsed);
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
                    if (m.features !== undefined) setFeatures(m.features || []);
                    if (m.facRazonSoc !== undefined) setFacRazonSoc(m.facRazonSoc);
                    if (m.facRFC !== undefined) setFacRFC(m.facRFC);
                    if (m.facRegimen !== undefined) setFacRegimen(m.facRegimen);
                    if (m.facCFDI !== undefined) setFacCFDI(m.facCFDI);
                    if (m.facDirFiscal !== undefined) setFacDirFiscal(m.facDirFiscal);
                    if (m.facCorreo !== undefined) setFacCorreo(m.facCorreo);
                  }
                }
              }
            } catch { }
          }
        }
      }).catch(() => { }).finally(() => setLoadingQuote(false));
    } else {
      fetch("/api/cotizaciones?nextfolio=1&tipo=mantenimiento")
        .then(r => r.json()).then(d => setFolio(d.folio || "")).catch(() => { });

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
          if (l.fac_razon_social) setFacRazonSoc(l.fac_razon_social);
          if (l.fac_rfc) setFacRFC(l.fac_rfc);
          if (l.fac_regimen) setFacRegimen(l.fac_regimen);
          if (l.fac_uso_cfdi) setFacCFDI(l.fac_uso_cfdi);
          if (l.fac_dir_fiscal) setFacDirFiscal(l.fac_dir_fiscal);
          if (l.fac_correo) setFacCorreo(l.fac_correo);
        }).catch(() => { });
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
    if (l.fac_razon_social) setFacRazonSoc(l.fac_razon_social);
    if (l.fac_rfc) setFacRFC(l.fac_rfc);
    if (l.fac_regimen) setFacRegimen(l.fac_regimen);
    if (l.fac_uso_cfdi) setFacCFDI(l.fac_uso_cfdi);
    if (l.fac_dir_fiscal) setFacDirFiscal(l.fac_dir_fiscal);
    if (l.fac_correo) setFacCorreo(l.fac_correo);
  };

  const seleccionarDelCatalogo = async (eq: CatalogoItem) => {
    setEqMarca(eq.marca || "");
    setEqModelo(eq.modelo || "");
    setEqDescripcion(eq.descripcion || "");
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
    const equipoRef = [eqMarca, eqModelo].filter(Boolean).join(" ") || "el equipo";
    const lista = nombres.length === 1 ? nombres[0].toLowerCase()
      : nombres.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombres[nombres.length - 1].toLowerCase();
    const cleanFeatures = features.filter(Boolean).map(f => {
      let txt = f.replace(/<strong>.*?<\/strong>:\s*/g, '');
      if (!txt.endsWith('.')) txt += '.';
      return txt;
    }).join(' ');
    return `El presente presupuesto comprende la realización del mantenimiento preventivo integral: ${lista} sobre ${equipoRef}. El alcance del servicio incluye: ${cleanFeatures} El servicio se realiza bajo estrictos estándares de calidad, incluyendo pruebas de seguridad eléctrica y entrega de un reporte técnico detallado conforme a la normativa vigente.`;
  };

  // ── buildPDFHtml ─────────────────────────────────────────────────────────
  const buildPDFHtml = async (): Promise<{ html: string; folio: string }> => {
    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");

    let usedFolio = savedCotRef.current?.folio || folio;
    if (!usedFolio) {
      const r = await fetch("/api/cotizaciones?nextfolio=1&tipo=mantenimiento");
      const d = await r.json();
      usedFolio = d.folio as string;
      setFolio(usedFolio);
    }

    const propText = propuestaPDF.trim() || generarParrafoAlcance() || "Servicio integral de mantenimiento preventivo y correctivo para equipos médicos con reporte técnico.";
    const vigStr = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const fechaStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    const equipoHTML = (eqMarca || eqModelo || eqTipo || eqSerie || eqFalla) ? `
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
      <div class="card-title">Evidencia Fotográfica del Equipo</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        ${evidencias.map((ev, i) => `
          <div style="flex:1;min-width:130px;max-width:200px;">
            <img src="${ev.b64}" alt="Evidencia ${i + 1}" style="max-width:100%;max-height:140px;width:auto;height:auto;border-radius:6px;border:1px solid #CBD5E1;display:block;margin:0 auto;" />
            <div style="margin-top:4px;font-size:9px;color:#475569;font-weight:600;text-align:center;">Foto ${i + 1}${ev.caption ? ` — ${ev.caption}` : ""}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

    const brochureHTML = eqBrochureB64 ? `
    <div class="tech-card avoid-break" style="margin-bottom:20px;">
      <div class="card-title">Ficha Técnica del Equipo${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
      <img src="${eqBrochureB64}" alt="Ficha técnica" style="width:100%;max-height:220px;object-fit:contain;margin-top:10px;border-radius:6px;border:1px solid #E2E8F0;" />
    </div>` : "";

    const scopeHTML = `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
      <div class="card-title">Alcance del Mantenimiento — ${[eqMarca, eqModelo].filter(Boolean).join(" ") || eqTipo || "Equipo"}</div>
      <div style="display:flex;gap:20px;align-items:flex-start;margin-top:8px;">
        ${imgTransductor ? `<div style="flex:0 0 220px;"><div class="img-container" style="height:180px;padding:4px;border:1px solid #CBD5E1;border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;"><img src="${imgTransductor}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ")}" style="max-width:100%;max-height:172px;width:auto;height:auto;background:white;" /></div></div>` : ""}
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;padding-top:4px;">
          ${features.filter(Boolean).map((feat, i) => `
            <div class="d-item">
              <div class="d-num">${i + 1}</div>
              <div>${feat}</div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/>
<title>Cotización ${usedFolio} · Bionordi</title>
<style>
  @page{margin:10mm 0 15mm 0}@page:first{margin-top:0}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{padding:30px 65px;max-width:816px;margin:0 auto;}
  .page-two{padding:30px 65px;max-width:816px;margin:0 auto;display:flex;flex-direction:column;min-height:244mm;page-break-before:always;break-before:always;}
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
    <div class="doc-title">Mantenimiento de Equipo</div>
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
${scopeHTML}
${evidenciaHTML}
</div>
<div class="page-two">
${brochureHTML}
<div class="tech-card avoid-break" style="margin-bottom:20px;border-left:4px solid #059669;margin-top:0px;">
  <div class="card-title" style="color:#059669;border-bottom-color:#A7F3D0;">Propuesta Técnica de Mantenimiento</div>
  <p style="font-size:11px;color:#334155;line-height:1.5;margin-bottom:10px;">${propText}</p>
  <div style="background:#EEF0F7;border:1px solid #C5CAE0;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:9px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inversión Total</div>
      <div style="font-size:11px;color:#059669;">Incluye refacciones preventivas, mano de obra y reporte técnico</div>
    </div>
    <div style="text-align:right;">
      ${descuento > 0 ? `<div style="font-size:11px;color:#94A3B8;text-decoration:line-through;margin-bottom:2px;">${$f(subtotal)}</div>` : ""}
      <div style="font-size:28px;font-weight:900;color:#059669;letter-spacing:-1px;">${$f(total)}</div>
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
    <div class="b-step"><span style="font-weight:800;">3.</span><div>Indique su <strong>Uso de CFDI</strong> (${facCFDI || "G03"}) en el correo.</div></div>
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
      tipo: "mantenimiento", folio: usedFolio, monto_total: total,
      items_json: {
        items: validItems.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
        meta: {
          cliContacto, cliTel, cliCorreo, cliDireccion, eqFalla,
          descuento, conIVA, firmaUserId,
          evidencias, propuestaPDF, imgEquipoB64: imgTransductor, eqBrochureB64,
          polVigencia, polPago, polEntrega, polGarantia, features,
          facRazonSoc, facRFC, facRegimen, facCFDI, facDirFiscal, facCorreo,
        },
      },
      eq_tipo: eqTipo || null, eq_marca: eqMarca || null, eq_modelo: eqModelo || null,
      eq_descripcion: eqDescripcion || null,
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

      const emailHTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Cotización ${f}</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;border:1px solid #E2E8F0;">
    <h2 style="color:#059669;">Propuesta de Mantenimiento ${f}</h2>
    <p>Estimado cliente,</p>
    <p>Le hacemos llegar la propuesta técnica correspondiente al servicio de mantenimiento de equipo médico.</p>
    <p><strong>Detalle de la inversión:</strong></p>
    <ul>
      <li>Subtotal: ${$f(subtotal)}</li>
      ${descuento > 0 ? `<li>Descuento: -${$f(descMonto)}</li>` : ""}
      ${conIVA ? `<li>IVA: ${$f(iva)}</li>` : ""}
      <li><strong>Total: ${$f(total)}</strong></li>
    </ul>
    <p>Consulte las especificaciones completas en el PDF adjunto.</p>
    <p>Atentamente,<br/><strong>${sigName}</strong><br/>${sigRole}<br/>Bionordi</p>
  </div>
</body>
</html>`;

      const attachments = [{ filename: `${f}.pdf`, content: b64, type: "application/pdf" }];

      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: `Cotización ${f} — Propuesta de Mantenimiento · Bionordi`,
          html: emailHTML,
          attachments,
        }),
      });
      if (!res.ok) throw new Error();
      setEmailStatus("ok");
      setTimeout(() => { setEmailStatus("idle"); setShowEmail(false); }, 3000);
    } catch { setEmailStatus("error"); setTimeout(() => setEmailStatus("idle"), 3000); }
  };

  const sidebarBg = "#FFFFFF";
  const sidebarHeaderBg = "#F8FAFC";
  const sidebarBorderColor = "#E2E8F0";

  const floatingCard: React.CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 10px 25px -5px rgba(78,96,169,0.06), 0 8px 10px -6px rgba(78,96,169,0.04)"
  };
  const cardTitle: React.CSSProperties = { fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "12px", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" };
  const iRow: React.CSSProperties = { display: "flex", marginBottom: "6px", fontSize: "11px", lineHeight: "1.4" };
  const iLbl: React.CSSProperties = { width: "85px", color: "#64748B", fontWeight: 700, flexShrink: 0 };
  const iVal: React.CSSProperties = { flex: 1, color: "#1E293B", fontWeight: 500 };
  const selStyle: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", outline: "none", fontSize: "11px", fontWeight: 600, color: "#1E293B", width: "100%", cursor: "pointer", fontFamily: "inherit", padding: "6px 10px" };

  const leadMatches = leadSearch.length > 1
    ? leadsList.filter(l => l.nombre.toLowerCase().includes(leadSearch.toLowerCase()) || (l.ciudad || "").toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 6)
    : [];

  return (
    <div className="flex-1 flex flex-row overflow-hidden" style={{ height: "100vh", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#F4F7FB" }}>

      {/* PANEL DE CONTROL LATERAL */}
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
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 110
      }}>
        <div style={{ flexShrink: 0, padding: "16px", borderBottom: `1px solid ${sidebarBorderColor}`, background: sidebarHeaderBg }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>Panel de Control</div>
          <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px" }}>Configura los datos de mantenimiento</div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", background: "#F4F7FB" }}>
          
          {/* Vinculación Leads */}
          <div style={floatingCard}>
            <div onClick={() => setCollCliente(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Cliente (CRM)</div>
              {collCliente ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
            {!collCliente && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ position: "relative" }}>
                  {leadId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#F1F5F9", border: "1px solid #CBD5E1", borderRadius: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {leadsList.find(l => l.id === leadId)?.nombre || cliNombre}
                        </div>
                      </div>
                      <button onClick={() => { setLeadId(null); setLeadSearch(""); }} style={{ fontSize: "9px", color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Quitar</button>
                    </div>
                  ) : (
                    <>
                      <input value={leadSearch} onChange={e => setLeadSearch(e.target.value)} placeholder="🔍 Buscar cliente..."
                        style={{ width: "100%", fontSize: "11px", border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "8px 12px", outline: "none", background: "#FFFFFF", color: "#1E293B" }} />
                      {leadMatches.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 110, overflow: "hidden", marginTop: "4px" }}>
                          {leadMatches.map(l => (
                            <button key={l.id} onClick={() => seleccionarLead(l)}
                              style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer", fontSize: "11px", display: "block" }}>
                              <div style={{ fontWeight: 700 }}>{l.nombre}</div>
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

          {/* Editor de Equipos */}
          <div style={floatingCard}>
            <div style={{ ...cardTitle, borderBottom: "none", paddingBottom: "2px", marginBottom: "8px" }}>Especificaciones del Equipo</div>
            <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "8px", marginBottom: "10px" }}>
              {(["catalogo", "manual"] as const).map(mode => (
                <button key={mode} onClick={() => { setEquipoMode(mode); if (mode === "manual") { setEqMarca(""); setEqModelo(""); setImgTransductor(null); setEqBrochureB64(null); } }}
                  style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", fontSize: "9px", fontWeight: 700, border: "none", cursor: "pointer", background: equipoMode === mode ? "#fff" : "transparent", color: equipoMode === mode ? "#4E60A9" : "#94A3B8" }}>
                  {mode === "catalogo" ? "Catálogo" : "Manual"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>TIPO DE EQUIPO</label>
                <input value={eqTipo} onChange={e => setEqTipo(e.target.value)} placeholder="Ej. Ultrasonido, Monitor..."
                  style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 10px", fontSize: "11px" }} />
              </div>
              <div>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>MARCA</label>
                {equipoMode === "catalogo" ? (
                  <select value={eqMarca} onChange={e => { setEqMarca(e.target.value); setEqModelo(""); setImgTransductor(null); setEqBrochureB64(null); }} style={selStyle}>
                    <option value="">— Seleccionar —</option>
                    {marcasUnicas.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={eqMarca} onChange={e => setEqMarca(e.target.value)} placeholder="Ej. Mindray"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 10px", fontSize: "11px" }} />
                )}
              </div>
              <div>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>MODELO</label>
                {equipoMode === "catalogo" ? (
                  <select value={eqModelo} onChange={async e => {
                    const found = catalogo.find(t => t.modelo === e.target.value && (!eqMarca || t.marca === eqMarca));
                    setEqModelo(e.target.value);
                    if (found) await seleccionarDelCatalogo(found); else { setImgTransductor(null); setEqBrochureB64(null); }
                  }} style={selStyle}>
                    <option value="">— Seleccionar —</option>
                    {modelosPorMarca.map(e => <option key={e.id} value={e.modelo}>{e.modelo}</option>)}
                  </select>
                ) : (
                  <input value={eqModelo} onChange={e => setEqModelo(e.target.value)} placeholder="Ej. Z50"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 10px", fontSize: "11px" }} />
                )}
              </div>
              <div>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>NO. SERIE</label>
                <input value={eqSerie} onChange={e => setEqSerie(e.target.value)} placeholder="Ej. SN-XXXX"
                  style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 10px", fontSize: "11px" }} />
              </div>
              <div>
                <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>FALLA REPORTADA</label>
                <textarea value={eqFalla} onChange={e => setEqFalla(e.target.value)} placeholder="Falla..." rows={2}
                  style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontFamily: "inherit" }} />
              </div>
            </div>
          </div>

          {/* Características del mantenimiento (Alcance) */}
          <div style={floatingCard}>
            <div style={cardTitle}>Puntos del Mantenimiento</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {features.map((feat, i) => (
                <div key={i}>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>PUNTO {i + 1}</label>
                  <input value={feat} onChange={e => setFeatures(p => p.map((x, j) => j === i ? e.target.value : x))} placeholder={`Actividad ${i + 1}...`}
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Editor de Servicios / Ítems */}
          <div style={floatingCard}>
            <div onClick={() => setCollItems(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Servicios / Conceptos</div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={e => { e.stopPropagation(); addItem(); }} style={{ fontSize: "10px", color: "#fff", background: "#4E60A9", border: "none", borderRadius: "6px", padding: "3px 8px", cursor: "pointer" }}><Plus size={10} /></button>
                {collItems ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>
            {!collItems && (
              <div style={{ marginTop: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", marginBottom: "12px" }}>
                  {items.map((item, i) => (
                    <div key={item.id} style={{ display: "flex", gap: "4px", background: "#F8FAFC", padding: "6px", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input value={item.descripcion} onChange={e => updateItem(item.id, "descripcion", e.target.value)} placeholder="Descripción del mantenimiento..."
                          style={{ fontSize: "10.5px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "4px 6px" }} />
                        <div style={{ display: "flex", gap: "4px" }}>
                          <input type="number" value={item.cantidad} min={1} onChange={e => updateItem(item.id, "cantidad", parseInt(e.target.value) || 1)}
                            style={{ width: "40px", fontSize: "10px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "3px", textAlign: "center" }} />
                          <input type="number" value={item.precioUnit || ""} onChange={e => updateItem(item.id, "precioUnit", parseFloat(e.target.value) || 0)}
                            style={{ flex: 1, fontSize: "10px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "3px 6px", textAlign: "right" }} />
                        </div>
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ color: "#94A3B8", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "12px", borderTop: "1px solid #E2E8F0", paddingTop: "8px", alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px", color: "#4E60A9", fontWeight: 700 }}>
                    <input type="checkbox" checked={conIVA} onChange={e => setConIVA(e.target.checked)} /> IVA 16%
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10.5px" }}>
                    <span style={{ color: "#64748B" }}>Desc (%)</span>
                    <input type="number" value={descuento} min={0} max={100} onChange={e => setDescuento(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      style={{ width: "42px", border: "1px solid #CBD5E1", borderRadius: "4px", textAlign: "center" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Políticas */}
          <div style={floatingCard}>
            <div onClick={() => setCollPoliticas(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Políticas Comerciales</div>
              {collPoliticas ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
            {!collPoliticas && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>VIGENCIA</label>
                  <input value={polVigencia} onChange={e => setPolVigencia(e.target.value)} placeholder="Ej. 15 días naturales"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>PAGO</label>
                  <input value={polPago} onChange={e => setPolPago(e.target.value)} placeholder="Ej. Contado 100%"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>ENTREGA</label>
                  <input value={polEntrega} onChange={e => setPolEntrega(e.target.value)} placeholder="Ej. 5 a 7 días hábiles"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>GARANTÍA</label>
                  <input value={polGarantia} onChange={e => setPolGarantia(e.target.value)} placeholder="Ej. 3 meses"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
              </div>
            )}
          </div>

          {/* Firmante */}
          <div style={floatingCard}>
            <div onClick={() => setCollFirma(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Firma</div>
              {collFirma ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
            {!collFirma && (
              <div style={{ marginTop: "12px" }}>
                <select value={String(firmaUserId)} onChange={e => setFirmaUserId(e.target.value === "bionordi" ? "bionordi" : parseInt(e.target.value))} style={selStyle}>
                  <option value="bionordi">{bn.representante} — {bn.cargo}</option>
                  {usuariosList.map(u => <option key={u.id} value={String(u.id)}>{u.nombre} — {u.cargo || "Ejecutivo"}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Notas */}
          <div style={floatingCard}>
            <div onClick={() => setCollNotas(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Notas</div>
              {collNotas ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>
            {!collNotas && (
              <div style={{ marginTop: "12px" }}>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={3} placeholder="Notas en la cotización..."
                  style={{ width: "100%", fontSize: "11px", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "8px 10px", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* PREVISUALIZADOR LIVE PDF DERECHO */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", background: "#D8DDE4", overflow: "hidden" }}>
        
        {/* Top actions bar */}
        <div style={{ height: "56px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/cotizar")} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              <ArrowLeft size={14} /> Volver
            </button>
            <button onClick={() => setSidebarCollapsed(p => !p)} style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: sidebarCollapsed ? "#FFFFFF" : "#F1F5F9", color: "#64748B", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {sidebarCollapsed ? "Mostrar Ajustes" : "Ocultar Ajustes"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
            {saveStatus === "ok" && <span style={{ color: "#10B981", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> Guardado</span>}
            {saveStatus === "error" && <span style={{ color: "#EF4444", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={14} /> Error</span>}

            <button onClick={guardar} disabled={saveStatus === "saving"} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#1E293B", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
              {saveStatus === "saving" ? <Loader2 size={14} className="animate-spin text-[#4E60A9]" /> : <Save size={14} className="text-[#64748B]" />}
              Guardar
            </button>

            <div style={{ position: "relative" }}>
              <button onClick={() => setShowEmail(p => !p)} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: showEmail ? "#F1F5F9" : "#FFFFFF", color: "#64748B", cursor: "pointer", fontSize: "11px", fontWeight: 700 }}>
                <Mail size={14} /> Enviar
              </button>
              {showEmail && (
                <div style={{ position: "absolute", right: "0px", top: "42px", background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "12px", padding: "12px", width: "250px", zIndex: 130, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
                  <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>Enviar por correo</div>
                  <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="destinatario@correo.com"
                    style={{ width: "100%", fontSize: "11px", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "6px 10px", outline: "none", background: "#FFFFFF", color: "#1E293B", marginBottom: "8px" }} />
                  <button onClick={enviarEmail} disabled={emailStatus === "sending" || !emailTo.trim()}
                    style={{ width: "100%", padding: "7px", borderRadius: "8px", border: "none", background: "#4E60A9", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
                    {emailStatus === "sending" ? <><Loader2 size={12} className="animate-spin" /> Enviando…</> : <><Mail size={12} /> Enviar PDF</>}
                  </button>
                </div>
              )}
            </div>

            <button onClick={generarPDF} disabled={generating} style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "none", background: "#4E60A9", color: "#fff", cursor: "pointer", fontSize: "11px", fontWeight: 700, boxShadow: "0 4px 10px rgba(78,96,169,0.2)" }}>
              {generating ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Generar PDF
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div style={{ flex: 1, overflowY: "auto", padding: "30px 20px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          {loadingQuote ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center", height: "80vh" }}>
              <Loader2 size={32} className="animate-spin text-[#4E60A9]" />
              <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 700 }}>Cargando cotización...</span>
            </div>
          ) : (
            <div style={{ width: "816px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "35px" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-25px", padding: "0 4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>PÁGINA 1 · VISTA PREVIA DE IMPRESIÓN (CARTA)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>8.5" x 11" (816 x 1056 px) · área útil 939 px</span>
              </div>

              {/* HOJA 1 */}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "12px" }}>
                  <div><img src="/LOGO_PRINCIPAL.png" alt="Bionordi" style={{ height: "52px", width: "auto", display: "block" }} /></div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: 300, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>Mantenimiento de Equipo</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 15px", justifyContent: "end", fontSize: "11px" }}>
                      <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folio</div>
                      <div style={{ color: "#1E293B", fontWeight: 700 }}>{savedCot?.folio || folio || "—"}</div>
                      <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha</div>
                      <div style={{ color: "#1E293B", fontWeight: 700 }}>{fecha}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ height: "4px", background: "linear-gradient(90deg,#4E60A9,#38AD64,#E2E8F0)", borderRadius: "4px", marginBottom: "10px" }} />
                
                <div style={{ display: "flex", gap: "20px", marginBottom: "8px" }}>
                  <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>Datos del Cliente</div>
                      <button onClick={() => expandCardOnly("cliente")}
                        style={{ fontSize: "9px", color: "#4E60A9", fontWeight: 700, border: "1px solid #C5CAE0", background: "#EEF0F7", cursor: "pointer", padding: "2px 6px", borderRadius: "4px" }}>
                        🔍 Vincular CRM
                      </button>
                    </div>
                    <div style={iRow}>
                      <div style={iLbl}>Cliente</div>
                      <div style={iVal}><F value={cliNombre} onChange={setCliNombre} placeholder="Hospital / Clínica" /></div>
                    </div>
                    <div style={iRow}>
                      <div style={iLbl}>Contacto</div>
                      <div style={iVal}><F value={cliContacto} onChange={setCliContacto} placeholder="Contacto" /></div>
                    </div>
                    <div style={iRow}>
                      <div style={iLbl}>Teléfono</div>
                      <div style={iVal}><F value={cliTel} onChange={setCliTel} placeholder="Teléfono" /></div>
                    </div>
                    <div style={iRow}>
                      <div style={iLbl}>Correo</div>
                      <div style={iVal}><F value={cliCorreo} onChange={setCliCorreo} placeholder="Correo" /></div>
                    </div>
                    <div style={iRow}>
                      <div style={iLbl}>Dirección</div>
                      <div style={iVal}><F value={cliDireccion} onChange={setCliDireccion} placeholder="Dirección" style={{ minWidth: "100%" }} /></div>
                    </div>
                  </div>

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
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "15px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tipo</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0F172A" }}><F value={eqTipo} onChange={setEqTipo} placeholder="Ultrasonido" /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Marca</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0F172A" }}><F value={eqMarca} onChange={setEqMarca} placeholder="Brand" /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Modelo</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0F172A" }}><F value={eqModelo} onChange={setEqModelo} placeholder="Model" /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "9px", color: "#64748B", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>No. de Serie</div>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0F172A" }}><F value={eqSerie} onChange={setEqSerie} placeholder="SN-XXXX" /></div>
                    </div>
                  </div>
                  {eqFalla && (
                    <div style={{ background: "#FEF2F2", padding: "8px 12px", borderRadius: "8px", borderLeft: "3px solid #EF4444", marginTop: "10px" }}>
                      <div style={{ fontSize: "9px", color: "#B91C1C", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>Falla Reportada / Síntoma</div>
                      <div style={{ fontSize: "11.5px", color: "#7F1D1D", fontWeight: 600, marginTop: "2px" }}>{eqFalla}</div>
                    </div>
                  )}
                </div>

                {/* Alcance del Mantenimiento */}
                <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: "12px", padding: "10px 14px", marginTop: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #CBD5E1", paddingBottom: "4px" }}>
                    Alcance del Mantenimiento — {[eqMarca, eqModelo].filter(Boolean).join(" ") || eqTipo || "Equipo"}
                  </div>
                  <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                    {imgTransductor ? (
                      <div style={{ flex: "0 0 auto", width: "170px", height: "148px", border: "1px solid #CBD5E1", borderRadius: "8px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={imgTransductor} alt="Equipo" style={{ maxWidth: "100%", maxHeight: "140px", objectFit: "contain" }} />
                      </div>
                    ) : evidencias.length > 0 ? (
                      <div style={{ flex: "0 0 auto", width: "170px", height: "148px", border: "1px solid #CBD5E1", borderRadius: "8px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src={evidencias[0].b64} alt="Equipo" style={{ maxWidth: "100%", maxHeight: "140px", objectFit: "contain" }} />
                      </div>
                    ) : (
                      <div style={{ flex: "0 0 auto", width: "170px", height: "148px", border: "1px dashed #CBD5E1", borderRadius: "8px", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: "9px" }}>
                        <ImageIcon size={20} style={{ marginBottom: "4px" }} /> Sin imagen
                      </div>
                    )}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                      {features.filter(Boolean).map((feat, i) => (
                        <div key={i} style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#334155", lineHeight: "1.4", alignItems: "flex-start" }}>
                          <div style={{ width: "18px", height: "18px", background: "#E5EAF7", color: "#4E60A9", borderRadius: "50%", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>{i + 1}</div>
                          <div>{feat}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Subir Imágenes */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginTop: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>Fotos del Servicio</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {evidencias.map((ev, i) => (
                      <div key={i} style={{ position: "relative", flex: "0 0 auto", width: "100px" }}>
                        <img src={ev.b64} alt={`ev${i}`} style={{ width: "100%", height: "70px", objectFit: "cover", borderRadius: "6px", border: "1px solid #E2E8F0" }} />
                        <button onClick={() => setEvidencias(p => p.filter((_, j) => j !== i))}
                          style={{ position: "absolute", top: "2px", right: "2px", width: "14px", height: "14px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    ))}
                    <button onClick={() => uploadImage(b64 => setEvidencias(p => [...p, { b64, caption: "" }]))}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "70px", height: "70px", border: "2px dashed #CBD5E1", borderRadius: "8px", background: "transparent", cursor: "pointer", color: "#64748B", fontSize: "9px" }}>
                      <Plus size={12} /> Subir foto
                    </button>
                    <button onClick={() => uploadImage(b64 => setImgTransductor(b64))}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "70px", height: "70px", border: "2px dashed #059669", borderRadius: "8px", background: "transparent", cursor: "pointer", color: "#059669", fontSize: "9px" }}>
                      <Plus size={12} /> Foto Ppal
                    </button>
                  </div>
                </div>

                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                  <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen inferior @page — 15 mm</span>
                </div>
              </div>

              {/* HOJA 2 */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-25px", padding: "0 4px", marginTop: "10px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>PÁGINA 2 · VISTA PREVIA DE IMPRESIÓN (CARTA)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>8.5" x 11" (816 x 1056 px) · área útil 863 px</span>
              </div>

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
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "38px", background: "rgba(248,250,252,0.88)", borderBottom: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                  <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen superior @page — 10 mm</span>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                  <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen inferior @page — 15 mm</span>
                </div>

                <div>
                  {eqBrochureB64 && (
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginBottom: "16px", position: "relative" }}>
                      <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Ficha Técnica del Equipo</div>
                      <img src={eqBrochureB64} alt="Brochure" style={{ width: "100%", maxHeight: "160px", objectFit: "contain", borderRadius: "6px" }} />
                      <button onClick={() => setEqBrochureB64(null)}
                        style={{ position: "absolute", top: "10px", right: "10px", width: "20px", height: "20px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  )}

                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderLeft: "4px solid #059669", borderRadius: "12px", padding: "10px 14px", marginBottom: "12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "6px" }}>Propuesta Técnica de Mantenimiento</div>
                    <div style={{ fontSize: "11.5px", color: "#334155", lineHeight: "1.5" }}>
                      <F value={propuestaPDF} onChange={setPropuestaPDF} placeholder={generarParrafoAlcance() || "Descripción del alcance del mantenimiento preventivo..."} multiline rows={4} />
                    </div>

                    <div style={{ background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
                      <div>
                        <div style={{ fontSize: "9px", fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: "1px" }}>Inversión Total</div>
                        <div style={{ fontSize: "11px", color: "#059669" }}>Incluye refacciones preventivas y mano de obra</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        {descuento > 0 && <div style={{ fontSize: "11px", color: "#94A3B8", textDecoration: "line-through" }}>{$f(subtotal)}</div>}
                        <div style={{ fontSize: "24px", fontWeight: 900, color: "#059669", letterSpacing: "-1px" }}>{$f(total)}</div>
                        <div style={{ fontSize: "9px", color: conIVA ? "#38AD64" : "#64748B", fontWeight: 700 }}>{conIVA ? "IVA incluido" : "Más IVA"}</div>
                      </div>
                    </div>
                  </div>

                  {notas && (
                    <div style={{ background: "#FFFBEB", borderLeft: "3px solid #F59E0B", padding: "8px 12px", marginBottom: "12px", fontSize: "11px", color: "#92400E", borderRadius: "0 4px 4px 0" }}>
                      <strong>Notas:</strong> {notas}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
                    <div style={{ flex: 1, background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "12px", padding: "10px" }}>
                      <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "1px solid #C5CAE0", paddingBottom: "4px" }}>Instrucciones de Facturación</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <div style={iRow}><span style={{ fontWeight: 800, marginRight: "4px" }}>1.</span><div>Realice transferencia a la CLABE de Bionordi.</div></div>
                        <div style={iRow}><span style={{ fontWeight: 800, marginRight: "4px" }}>2.</span><div>Envíe comprobante y Constancia a <strong>{bn.correo}</strong>.</div></div>
                        <div style={iRow}><span style={{ fontWeight: 800, marginRight: "4px" }}>3.</span><div>Uso CFDI: <strong>{facCFDI || "G03"}</strong>.</div></div>
                      </div>
                    </div>
                    <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px" }}>
                      <div style={iRow}><div>Subtotal</div><div style={{ marginLeft: "auto", fontWeight: 600 }}>{$f(subtotal)}</div></div>
                      {descuento > 0 && <div style={iRow}><div>Descuento</div><div style={{ marginLeft: "auto", color: "#EF4444" }}>−{$f(descMonto)}</div></div>}
                      {conIVA && <div style={iRow}><div>IVA 16%</div><div style={{ marginLeft: "auto" }}>{$f(iva)}</div></div>}
                      <div style={{ ...iRow, borderTop: "1px solid #CBD5E1", paddingTop: "6px", fontSize: "14px", fontWeight: 900, color: "#4E60A9" }}><div>Total (MXN)</div><div style={{ marginLeft: "auto" }}>{$f(total)}</div></div>
                    </div>
                  </div>

                  <div style={{ fontSize: "10.5px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: "6px" }}>Políticas Comerciales</div>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      <li style={{ position: "relative", paddingLeft: "12px", fontSize: "9.5px", color: "#475569", marginBottom: "3px" }}><strong>Vigencia:</strong> <F value={polVigencia} onChange={setPolVigencia} placeholder={`15 días naturales (hasta el ${vigencia})`} /></li>
                      <li style={{ position: "relative", paddingLeft: "12px", fontSize: "9.5px", color: "#475569", marginBottom: "3px" }}><strong>Esquema de Pago:</strong> <F value={polPago} onChange={setPolPago} placeholder={`Contado 100% anticipado — o 50% anticipo y 50% contra entrega.`} /></li>
                      <li style={{ position: "relative", paddingLeft: "12px", fontSize: "9.5px", color: "#475569", marginBottom: "3px" }}><strong>Tiempo de Entrega:</strong> <F value={polEntrega} onChange={setPolEntrega} placeholder={`5 a 7 días hábiles.`} /></li>
                      <li style={{ position: "relative", paddingLeft: "12px", fontSize: "9.5px", color: "#475569", marginBottom: "3px" }}><strong>Garantía:</strong> <F value={polGarantia} onChange={setPolGarantia} placeholder="3 meses de garantía sobre el servicio." /></li>
                    </ul>
                  </div>
                </div>

                <div style={{ flexGrow: 1 }} />

                <div className="signatures-wrapper">
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "15px" }}>
                    <div style={{ width: "220px", textAlign: "center" }}>
                      <div style={{ borderTop: "2.5px solid #CBD5E1", paddingTop: "6px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 800, color: "#4E60A9" }}>{sigName}</div>
                        <div style={{ fontSize: "9.5px", color: "#64748B", textTransform: "uppercase", fontWeight: 600 }}>{sigRole}</div>
                        <div style={{ fontSize: "9.5px", color: "#4E60A9", fontWeight: 800, marginTop: "2px" }}>{bn.razonSocial}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "center", borderTop: "1px solid #E2E8F0", paddingTop: "8px", fontSize: "9.5px", color: "#94A3B8" }}>
                    <strong>{bn.razonSocial}</strong> · {bn.direccionFiscal} · {bn.correo}<br />Documento generado digitalmente por el sistema de Gestión Bionordi.
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {previewUrl && (
        <DocumentViewerModal title={`Cotización — ${previewFolio}`} url={previewUrl} downloadName={`${previewFolio}.pdf`} onClose={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} />
      )}
      {previewHtml && (
        <DocumentViewerModal title={`Cotización — ${previewFolio}`} html={previewHtml} downloadName={`${previewFolio}.pdf`} onClose={() => setPreviewHtml(null)} />
      )}
    </div>
  );
}
