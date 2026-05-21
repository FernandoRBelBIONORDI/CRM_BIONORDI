"use client";

import { useState, useEffect } from "react";
import { X, Printer, FileText, ChevronDown, ChevronUp } from "lucide-react";
import DocumentViewerModal from "@/components/DocumentViewerModal";

interface BionordiCfg {
  razonSocial: string; rfc: string; banco: string; cuenta: string;
  clabe: string; direccionFiscal: string; correo: string;
  representante: string; cargo: string;
}

const TIPOS_TRANSDUCTOR = [
  "Lineal", "Convex / Curvilíneo", "Sectorial / Phased Array",
  "Intracavitario / Endovaginal", "TEE (Transesofágico)", "3D/4D",
  "Microconvex", "Otro",
];

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

interface Lead {
  id: number; nombre: string; telefono?: string; whatsapp?: string; correo?: string;
  ciudad?: string; municipio?: string; estado_republica?: string; direccion?: string;
  decisor_nombre?: string; decisor_cargo?: string; nicho?: string;
}

const SERVICIOS = [
  { id: "diag", cat: "Diagnóstico", nombre: "Diagnóstico técnico de transductor", precio: 1500 },
  { id: "rep_lin", cat: "Reparación", nombre: "Reparación transductor lineal", precio: 6500 },
  { id: "rep_con", cat: "Reparación", nombre: "Reparación transductor convex", precio: 6500 },
  { id: "rep_sec", cat: "Reparación", nombre: "Reparación transductor sectorial", precio: 7500 },
  { id: "rep_int", cat: "Reparación", nombre: "Reparación transductor intracavitario", precio: 8500 },
  { id: "rep_tee", cat: "Reparación", nombre: "Reparación transductor TEE", precio: 12000 },
  { id: "rep_3d", cat: "Reparación", nombre: "Reparación transductor 3D/4D", precio: 9500 },
  { id: "mant", cat: "Mantenimiento", nombre: "Mantenimiento preventivo", precio: 2500 },
  { id: "cable", cat: "Componentes", nombre: "Cambio de cable del transductor", precio: 3200 },
  { id: "shell", cat: "Componentes", nombre: "Reencapsulado (carcasa)", precio: 2800 },
];

const CATS = ["Diagnóstico", "Reparación", "Mantenimiento", "Componentes"];

interface Props { lead: Lead; onClose: () => void; }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";
const sel = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white appearance-none";

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
          width: 794, windowWidth: 794, logging: false,
        });
        const pdf = new jsPDF({ format: "a4", unit: "mm", orientation: "portrait" });
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

export default function QuoteModal({ lead, onClose }: Props) {
  const [bn, setBn] = useState<BionordiCfg>({
    razonSocial: "Bionordi S.A. de C.V.", rfc: "—", banco: "—", cuenta: "—",
    clabe: "—", direccionFiscal: "Ciudad de México, CDMX",
    correo: "contacto@bionordi.mx", representante: "Fernando Rosas", cargo: "Director General",
  });

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
    });
  }, []);

  const [usuariosList, setUsuariosList] = useState<{ id: number; nombre: string; cargo?: string }[]>([]);
  const [firmaUserId, setFirmaUserId] = useState<number | "bionordi">("bionordi");

  useEffect(() => {
    fetch("/api/usuarios").then(r => r.json()).then(d => setUsuariosList(d.usuarios || [])).catch(() => {});
  }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [descuento, setDescuento] = useState(0);
  const [conIVA, setConIVA] = useState(true);
  const [notas, setNotas] = useState("");
  const [showFact, setShowFact] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewFolio, setPreviewFolio] = useState<string>("");

  // Equipo
  const [eqTipo, setEqTipo] = useState("");
  const [eqMarca, setEqMarca] = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie, setEqSerie] = useState("");
  const [eqFalla, setEqFalla] = useState("");

  // Facturación
  const [facContacto, setFacContacto] = useState(lead.decisor_nombre || "");
  const [facRazonSoc, setFacRazonSoc] = useState(lead.nombre);
  const [facRFC, setFacRFC] = useState("");
  const [facRegimen, setFacRegimen] = useState("612");
  const [facCFDI, setFacCFDI] = useState("G03");
  const [facDirFiscal, setFacDirFiscal] = useState(lead.direccion || "");
  const [facCorreo, setFacCorreo] = useState(lead.correo || "");

  const toggle = (id: string) =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const items = SERVICIOS.filter(s => selected.has(s.id));
  const subtotal = items.reduce((a, s) => a + s.precio, 0);
  const descMonto = Math.round(subtotal * descuento / 100);
  const baseNeta = subtotal - descMonto;
  const iva = conIVA ? Math.round(baseNeta * 0.16) : 0;
  const total = baseNeta + iva;
  const $f = (n: number) => `$${n.toLocaleString("es-MX")}`;

  const isRepair = items.some(i => i.cat === "Reparación" || i.cat === "Diagnóstico");

  const generarPDF = async () => {
    setGenerating(true);
    try {
    let imgSrc = "/transductor.png";
    try {
      const res = await fetch("/transductor.png");
      const blob = await res.blob();
      imgSrc = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch { /* usa ruta relativa si falla */ }

    const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const folio = `BNRD-${new Date().getFullYear().toString().slice(-2)}-C-${Date.now().toString().slice(-4)}`;
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    let sigName = bn.representante;
    let sigRole = bn.cargo;
    if (firmaUserId !== "bionordi") {
      const u = usuariosList.find(u => u.id === firmaUserId);
      if (u) {
        sigName = u.nombre;
        sigRole = u.cargo || "Ejecutivo";
      }
    }

    const rows = items.map((s, i) => `
      <tr>
        <td class="c text-muted">${i + 1}</td>
        <td>
          <div class="ctag">${s.cat}</div>
          <div class="s-name">${s.nombre}</div>
        </td>
        <td class="c">1</td>
        <td class="r">${$f(s.precio)}</td>
        <td class="r b">${$f(s.precio)}</td>
      </tr>`).join("");

    const diagramaHTML = isRepair ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Alcance Técnico y Diagnóstico Integral</div>
      <p class="diag-p">
        Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>.
        Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas (Corriente de Fuga) para garantizar la seguridad del paciente y la resolución óptima de imagen.
      </p>
      <div class="diag-grid">
        <div class="img-container">
          <div style="position:relative;display:inline-block;">
            <img src="${imgSrc}" alt="Diagrama Transductor" style="max-width:100%; max-height:155px; width:auto; height:auto; background:white; display:block;" />
            <div class="dot" style="top: 25%; left: 39%; margin-top:-9px; margin-left:-9px;">1</div>
            <div class="dot" style="top: 20%; left: 55%; margin-top:-9px; margin-left:-9px;">2</div>
            <div class="dot" style="bottom: 12%; right: 18%; margin-bottom:-9px; margin-right:-9px;">3</div>
          </div>
        </div>
        <div class="diag-list">
          <div class="d-item">
            <div class="d-num">1</div>
            <div><strong>Lente Acústico / Membrana:</strong> Retiro del material desgastado, descontaminación del arreglo de cristales e inyección de nuevo polímero acústico con curado térmico.</div>
          </div>
          <div class="d-item">
            <div class="d-num">2</div>
            <div><strong>Carcasa y Sellado:</strong> Reencapsulado de uniones para evitar filtraciones de gel transmisor y proteger los componentes electrónicos internos.</div>
          </div>
          <div class="d-item">
            <div class="d-num">3</div>
            <div><strong>Cableado y Conector:</strong> Revisión de micro-coaxiales, refuerzo en zonas de flexión (alivio de tensión) y limpieza profunda de pines de contacto en la placa base.</div>
          </div>
        </div>
      </div>
    </div>
    ` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Propuesta Técnica ${folio} · Bionordi</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #334155; background: #fff; font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 40px 50px; max-width: 850px; margin: 0 auto; background: #fff; display: flex; flex-direction: column; min-height: 262mm; }
  .page-spacer { flex: 1; min-height: 5px; }
  .avoid-break { page-break-inside: avoid; }
  .text-muted { color: #94A3B8; }
  .b { font-weight: 700; }
  .c { text-align: center; }
  .r { text-align: right; }
  .hdr { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 25px; }
  .logo { font-size: 34px; font-weight: 900; color: #4E60A9; letter-spacing: -1px; line-height: 1; }
  .logo span { color: #3B82F6; }
  .logo-sub { font-size: 10px; font-weight: 600; color: #64748B; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase; }
  .meta-box { text-align: right; }
  .doc-title { font-size: 20px; font-weight: 300; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
  .meta-grid { display: grid; grid-template-columns: auto auto; gap: 4px 15px; justify-content: end; font-size: 11px; }
  .meta-lbl { font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-val { color: #1E293B; font-weight: 600; }
  .divider { height: 4px; background: linear-gradient(90deg, #4E60A9, #3B82F6, #E2E8F0); border-radius: 4px; margin-bottom: 25px; }
  .info-section { display: flex; gap: 20px; margin-bottom: 20px; }
  .info-card { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
  .card-title { font-size: 10px; font-weight: 800; color: #4E60A9; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px; }
  .i-row { display: flex; margin-bottom: 5px; font-size: 11px; line-height: 1.4; }
  .i-lbl { width: 85px; color: #64748B; font-weight: 700; }
  .i-val { flex: 1; color: #1E293B; font-weight: 500; }
  .eq-card { background: #fff; border: 1px solid #CBD5E1; border-radius: 12px; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02); border-left: 4px solid #4E60A9; }
  .eq-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
  .eq-item { display: flex; flex-direction: column; gap: 4px; }
  .eq-lbl { font-size: 9px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .eq-val { font-size: 12px; color: #0F172A; font-weight: 600; }
  .eq-full { grid-column: span 4; background: #FEF2F2; padding: 10px 14px; border-radius: 8px; border-left: 3px solid #EF4444; margin-top: 5px; }
  .tech-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
  .diag-p { font-size: 11px; color: #475569; line-height: 1.5; margin-bottom: 15px; }
  .diag-grid { display: flex; gap: 20px; align-items: center; }
  .img-container { flex: 0.8; position: relative; border: 1px solid #CBD5E1; border-radius: 8px; background:#fff; padding: 4px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  .dot { position: absolute; width: 18px; height: 18px; background: #3B82F6; color: #fff; border-radius: 50%; font-size: 10px; font-weight: 800; display: block; text-align: center; line-height: 14px; border: 2px solid #fff; box-sizing: border-box; margin: 0; }
  .diag-list { flex: 1.2; display: flex; flex-direction: column; gap: 12px; }
  .d-item { display: flex; gap: 10px; font-size: 10.5px; color: #334155; line-height: 1.4; align-items: flex-start; }
  .d-num { width: 18px; height: 18px; background: #DBEAFE; color: #1D4ED8; border-radius: 50%; font-size: 9px; font-weight: 800; display: block; text-align: center; line-height: 18px; flex-shrink: 0; margin-top: 1px; box-sizing: border-box; margin-left: 0; margin-right: 0; padding: 0; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 20px; }
  th { background: #F1F5F9; color: #475569; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 10px 15px; text-align: left; letter-spacing: 1px; border-bottom: 2px solid #CBD5E1; }
  th:first-child { border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
  th:last-child { border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
  td { padding: 12px 15px; font-size: 12px; color: #1E293B; border-bottom: 1px solid #E2E8F0; vertical-align: middle; }
  .s-name { font-weight: 600; color: #0F172A; margin-top: 4px; }
  .ctag { display: inline-block; padding: 3px 8px; background: #DBEAFE; color: #1D4ED8; font-size: 9px; font-weight: 800; border-radius: 100px; text-transform: uppercase; letter-spacing: 0.5px; }
  .bottom-flex { display: flex; gap: 20px; margin-bottom: 25px; align-items: flex-start; }
  .totals-card { flex: 1; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; }
  .t-row { display: flex; justify-content: space-between; font-size: 12px; color: #64748B; margin-bottom: 8px; }
  .t-row .t-val { font-weight: 600; color: #1E293B; }
  .t-row.final { border-top: 2px solid #E2E8F0; padding-top: 12px; margin-top: 4px; font-size: 16px; font-weight: 900; color: #4E60A9; }
  .t-row.final .t-val { color: #4E60A9; }
  .billing-instructions { flex: 1; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; padding: 16px; }
  .billing-instructions .card-title { color: #1D4ED8; border-bottom-color: #BFDBFE; }
  .b-step { display: flex; gap: 8px; font-size: 10.5px; color: #4E60A9; margin-bottom: 8px; line-height: 1.4; }
  .b-step strong { font-weight: 800; }
  .b-icon { font-weight: bold; color: #3B82F6; }
  .cond-section { margin-bottom: 20px; page-break-inside: avoid; }
  .cond-title { font-size: 11px; font-weight: 800; color: #4E60A9; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
  .cond-list { list-style: none; padding: 0; }
  .cond-list li { position: relative; padding-left: 14px; font-size: 10px; color: #475569; margin-bottom: 6px; line-height: 1.5; }
  .cond-list li::before { content: "•"; position: absolute; left: 0; color: #3B82F6; font-weight: bold; font-size: 14px; line-height: 1; top: -1px; }
  .signatures { margin-top: 15px; display: flex; justify-content: flex-end; page-break-inside: avoid; }
  .sig-box { text-align: center; width: 240px; }
  .sig-line { border-top: 2px solid #CBD5E1; margin-bottom: 10px; padding-top: 10px; }
  .sig-name { font-size: 13px; font-weight: 800; color: #4E60A9; }
  .sig-role { font-size: 10px; font-weight: 600; color: #64748B; text-transform: uppercase; margin-top: 2px; }
  .footer { text-align: center; border-top: 1px solid #E2E8F0; padding-top: 15px; margin-top: 15px; font-size: 10px; color: #94A3B8; line-height: 1.6; }
  @media print { body { padding: 0; } .page { padding: 20px; box-shadow: none; } .cond-section { page-break-after: avoid; break-after: avoid; } .signatures-wrapper { page-break-before: avoid; break-before: avoid; page-break-inside: avoid; break-inside: avoid; } }
</style>
</head>
<body>
<div class="page">

<div class="hdr">
  <div>
    <div class="logo">BIONORDI</div>
    <div class="logo-sub">Medical Technology</div>
  </div>
  <div class="meta-box">
    <div class="doc-title">Propuesta Técnica</div>
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
    <div class="i-row"><div class="i-lbl">Cliente</div><div class="i-val">${lead.nombre}</div></div>
    <div class="i-row"><div class="i-lbl">Contacto</div><div class="i-val">${facContacto || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Ubicación</div><div class="i-val">${[lead.direccion, lead.municipio || lead.ciudad, lead.estado_republica].filter(Boolean).join(", ") || "—"}</div></div>
    <div class="i-row"><div class="i-lbl">Teléfono</div><div class="i-val">${lead.whatsapp || lead.telefono || "—"}</div></div>
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

<div class="eq-card">
  <div class="card-title" style="border:none; padding:0; margin-bottom:12px;">Especificaciones del Equipo</div>
  <div class="eq-grid">
    <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo || "Transductor de ultrasonido"}</div></div>
    <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || "—"}</div></div>
    <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || "—"}</div></div>
    <div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie || "—"}</div></div>
    ${eqFalla ? `<div class="eq-full"><div class="eq-lbl" style="color:#B91C1C;">Falla Reportada / Síntoma</div><div class="eq-val" style="color:#7F1D1D; margin-top:2px;">${eqFalla}</div></div>` : ""}
  </div>
</div>

${diagramaHTML}

<table style="page-break-before: always;">
  <thead>
    <tr>
      <th class="c" style="width:50px;">Item</th>
      <th>Descripción del Servicio</th>
      <th class="c" style="width:60px;">Cant.</th>
      <th class="r" style="width:120px;">Precio Unit.</th>
      <th class="r" style="width:120px;">Importe</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

${notas ? `<div style="background:#FFFBEB;border-left:3px solid #F59E0B;padding:9px 13px;margin-bottom:20px;font-size:11px;color:#92400E;border-radius:0 4px 4px 0;"><strong>Notas:</strong> ${notas}</div>` : ""}

<div class="bottom-flex avoid-break">
  <div class="billing-instructions">
    <div class="card-title">Instrucciones para Solicitar Factura</div>
    <div class="b-step"><span class="b-icon">1.</span><div>Realice el pago total o anticipo a la cuenta CLABE indicada arriba.</div></div>
    <div class="b-step"><span class="b-icon">2.</span><div>Envíe un correo a <strong>${bn.correo}</strong> adjuntando: <br/>• Comprobante de pago (PDF o Foto)<br/>• Constancia de Situación Fiscal actualizada</div></div>
    <div class="b-step"><span class="b-icon">3.</span><div>Indique en el cuerpo del correo su <strong>Uso de CFDI</strong> (${facCFDI || "G03"}).</div></div>
    <div class="b-step"><span class="b-icon">4.</span><div>Su factura será procesada y enviada en un lapso no mayor a 24 horas hábiles.</div></div>
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
    <li><strong>Vigencia de cotización:</strong> 15 días naturales (hasta el ${vigencia}).</li>
    <li><strong>Esquema de Pago:</strong> Opción 1: Contado 100% anticipado. Opción 2: Anticipo del 50% (${$f(Math.round(total / 2))}) para inicio de trabajos, y liquidación contra entrega.</li>
    <li><strong>Tiempo de Entrega:</strong> 5 a 7 días hábiles a partir del ingreso físico del equipo y validación de anticipo.</li>
    <li><strong>Cobertura de Garantía:</strong> 6 meses de garantía directa sobre la reparación efectuada. No cubre daños incidentales posteriores por caídas, tirones de cable, mordeduras o derrames de líquidos internos.</li>
  </ul>
</div>

<div class="page-spacer"></div>
<div class="signatures-wrapper">
<div class="signatures">
  <div class="sig-box">
    <div class="sig-line">
      <div class="sig-name">${sigName}</div>
      <div class="sig-role">${sigRole}</div>
      <div class="sig-role" style="color:#4E60A9; font-weight:800; margin-top:4px;">${bn.razonSocial}</div>
    </div>
  </div>
</div>

<div class="footer">
  <strong>${bn.razonSocial}</strong> · ${bn.direccionFiscal} · Contacto: ${bn.correo}<br/>
  Documento generado digitalmente por el sistema de Gestión Bionordi.
</div>
</div>

</div>
</body>
</html>`;

    setPreviewFolio(folio);
    try {
      const pdfB64 = await generarPDFBase64(html);
      const url = b64toBlobUrl(pdfB64);
      setPreviewPdfUrl(url);
    } catch (pdfErr) {
      console.warn("[cotizacion] Falló la generación de PDF para previsualizar, usando HTML fallback:", pdfErr);
      setPreviewHtml(html);
    }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[660px] max-h-[92vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#EEF3FC] flex items-center justify-center">
              <FileText size={16} className="text-[#4E60A9]" />
            </div>
            <div>
              <h3 className="font-bold text-[#1E293B] text-[15px] leading-tight">Generar Cotización</h3>
              <p className="text-[11px] text-gray-400 font-medium">{lead.nombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Equipo ── */}
          <div className="px-6 pt-5 pb-4 border-b border-gray-100">
            <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest mb-3">Equipo a reparar / valorar</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Field label="Contacto / Dr.">
                <input value={facContacto} onChange={e => setFacContacto(e.target.value)} placeholder="Dr. Nombre Apellido" className={inp} />
              </Field>
              <Field label="Tipo de transductor">
                <select value={eqTipo} onChange={e => setEqTipo(e.target.value)} className={sel}>
                  <option value="">— Seleccionar —</option>
                  {TIPOS_TRANSDUCTOR.map(t => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Field label="Marca">
                <input value={eqMarca} onChange={e => setEqMarca(e.target.value)} placeholder="Mindray, GE, Philips…" className={inp} />
              </Field>
              <Field label="Modelo">
                <input value={eqModelo} onChange={e => setEqModelo(e.target.value)} placeholder="C1-5, L12-4…" className={inp} />
              </Field>
              <Field label="No. de Serie">
                <input value={eqSerie} onChange={e => setEqSerie(e.target.value)} placeholder="SN-XXXXXX" className={inp} />
              </Field>
            </div>
            <Field label="Falla reportada">
              <input value={eqFalla} onChange={e => setEqFalla(e.target.value)} placeholder="Imagen con artefactos, sin imagen, cable dañado…" className={inp} />
            </Field>
          </div>

          {/* ── Servicios ── */}
          <div className="px-6 py-4 space-y-4 border-b border-gray-100">
            <div className="text-[10px] font-bold text-[#4E60A9] uppercase tracking-widest">Servicios</div>
            {CATS.map(cat => (
              <div key={cat}>
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">{cat}</div>
                <div className="space-y-1.5">
                  {SERVICIOS.filter(s => s.cat === cat).map(s => {
                    const on = selected.has(s.id);
                    return (
                      <button key={s.id} onClick={() => toggle(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${on ? "border-[#4E60A9] bg-blue-50/60" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${on ? "bg-[#4E60A9] border-[#4E60A9]" : "border-gray-300"}`}>
                          {on && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                        </div>
                        <span className={`flex-1 text-[12px] font-medium ${on ? "text-[#1E293B]" : "text-gray-600"}`}>{s.nombre}</span>
                        <span className={`text-[12px] font-bold tabular-nums ${on ? "text-[#4E60A9]" : "text-gray-400"}`}>${s.precio.toLocaleString("es-MX")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Facturación (colapsable) ── */}
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
          <button onClick={generarPDF} disabled={selected.size === 0 || generating}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-[#4E60A9] hover:bg-[#1e40af] py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Printer size={15} />
            {generating ? "Generando…" : selected.size === 0 ? "Selecciona al menos un servicio" : `Generar PDF · ${selected.size} servicio${selected.size > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
      {(previewPdfUrl || previewHtml) && (
        <DocumentViewerModal
          title={`Propuesta Técnica — ${previewFolio}`}
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
