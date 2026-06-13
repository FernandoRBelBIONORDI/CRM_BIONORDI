"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, Save, Plus, Trash2, Loader2, Upload, CheckCircle2, AlertCircle, Mail, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Image as ImageIcon } from "lucide-react";
import DocumentViewerModal from "@/components/DocumentViewerModal";
import { b64toBlobUrl, fetchBase64, generarPDFBase64, COTIZACION_PDF_CSS, PAGE_BREAK } from "@/lib/cotizacion-pdf";

interface BionordiCfg {
  razonSocial: string; rfc: string; banco: string; cuenta: string;
  clabe: string; direccionFiscal: string; correo: string;
  representante: string; cargo: string;
}

interface LineItem { id: string; descripcion: string; cantidad: number; precioUnit: number; }
interface Lead {
  id: number; nombre: string; telefono?: string; correo?: string;
  ciudad?: string; estado_republica?: string; direccion?: string;
  fac_razon_social?: string; fac_rfc?: string; fac_regimen?: string;
  fac_uso_cfdi?: string; fac_dir_fiscal?: string; fac_correo?: string;
}

function newItem(): LineItem {
  return { id: Math.random().toString(36).slice(2), descripcion: "", cantidad: 1, precioUnit: 0 };
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

export default function CotizarConsumiblesPageWrapper() {
  return <Suspense><CotizarConsumiblesPage /></Suspense>;
}

function CotizarConsumiblesPage() {
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

  // ── Ítems ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const addItem = () => setItems(p => [...p, newItem()]);
  const removeItem = (id: string) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof LineItem, value: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [field]: value } : i));

  // ── Imágenes (Galería de Productos) ──────────────────────────────────────
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

  const sigName = firmaUserId === "bionordi" ? bn.representante
    : usuariosList.find(u => u.id === firmaUserId)?.nombre || bn.representante;
  const sigRole = firmaUserId === "bionordi" ? bn.cargo
    : usuariosList.find(u => u.id === firmaUserId)?.cargo || "Ejecutivo";

  const fecha = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const getPolVigencia = () => polVigencia.trim() !== "" ? polVigencia : `15 días naturales (hasta el ${vigencia})`;
  const getPolPago = () => polPago.trim() !== "" ? polPago : `Contado 100% anticipado.`;
  const getPolEntrega = () => polEntrega.trim() !== "" ? polEntrega : `3 a 5 días hábiles a partir de la confirmación de pago y disponibilidad de stock.`;
  const getPolGarantia = () => polGarantia.trim() !== "" ? polGarantia : `Garantía de devolución de 7 días contra defectos de fabricación. Sin garantía de reparación posterior.`;

  // ── Efectos ──────────────────────────────────────────────────────────────
  useEffect(() => { savedCotRef.current = savedCot; }, [savedCot]);

  useEffect(() => { pdfB64Ref.current = null; },
    [cliNombre, cliContacto, cliTel, cliCorreo, cliDireccion,
      items, descuento, conIVA, notas, firmaUserId, evidencias, propuestaPDF,
      polVigencia, polPago, polEntrega, polGarantia, facRazonSoc, facRFC,
      facRegimen, facCFDI, facDirFiscal, facCorreo]);

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
                    if (m.descuento !== undefined) setDescuento(m.descuento);
                    if (m.conIVA !== undefined) setConIVA(m.conIVA);
                    if (m.firmaUserId !== undefined) setFirmaUserId(m.firmaUserId);
                    if (m.evidencias !== undefined) setEvidencias(m.evidencias || []);
                    if (m.propuestaPDF !== undefined) setPropuestaPDF(m.propuestaPDF || "");
                    if (m.polVigencia !== undefined) setPolVigencia(m.polVigencia || "");
                    if (m.polPago !== undefined) setPolPago(m.polPago || "");
                    if (m.polEntrega !== undefined) setPolEntrega(m.polEntrega || "");
                    if (m.polGarantia !== undefined) setPolGarantia(m.polGarantia || "");
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
      fetch("/api/cotizaciones?nextfolio=1&tipo=consumibles")
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

  const generarParrafoAlcance = (): string => {
    const nombres = validItems.map(i => i.descripcion.trim()).filter(Boolean);
    if (nombres.length === 0) return "";
    const lista = nombres.length === 1 ? nombres[0].toLowerCase()
      : nombres.slice(0, -1).map(n => n.toLowerCase()).join(", ") + " y " + nombres[nombres.length - 1].toLowerCase();
    return `La presente propuesta contempla el suministro de los siguientes consumibles y accesorios médicos: ${lista}. Todos nuestros insumos cumplen con estrictos estándares de calidad, sellado de fábrica y compatibilidad con las especificaciones clínicas requeridas. Se ofrece soporte de validación técnica y garantía de satisfacción directa.`;
  };

  // ── buildPDFHtml ─────────────────────────────────────────────────────────
  const buildPDFHtml = async (): Promise<{ html: string; folio: string }> => {
    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");

    let usedFolio = savedCotRef.current?.folio || folio;
    if (!usedFolio) {
      const r = await fetch("/api/cotizaciones?nextfolio=1&tipo=consumibles");
      const d = await r.json();
      usedFolio = d.folio as string;
      setFolio(usedFolio);
    }

    const propText = propuestaPDF.trim() || generarParrafoAlcance() || "Propuesta comercial para el suministro de consumibles y accesorios médicos.";
    const vigStr = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const fechaStr = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

    // Tabla estilizada de consumibles
    const tableHTML = `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
      <div class="card-title">Lista de Consumibles y Artículos</div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        <thead>
          <tr style="border-bottom:2px solid #E2E8F0;text-align:left;font-size:10px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:.5px;">
            <th style="padding:6px 8px;width:60px;">Cant.</th>
            <th style="padding:6px 8px;">Descripción</th>
            <th style="padding:6px 8px;text-align:right;width:110px;">P. Unitario</th>
            <th style="padding:6px 8px;text-align:right;width:110px;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${validItems.map(item => `
            <tr style="border-bottom:1px solid #F1F5F9;font-size:11px;">
              <td style="padding:8px;color:#4E60A9;font-weight:700;">${item.cantidad}</td>
              <td style="padding:8px;color:#1E293B;font-weight:500;">${item.descripcion}</td>
              <td style="padding:8px;text-align:right;color:#475569;">${$f(item.precioUnit)}</td>
              <td style="padding:8px;text-align:right;color:#1E293B;font-weight:600;">${$f(item.cantidad * item.precioUnit)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;

    const galleryHTML = evidencias.length > 0 ? `
    <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;page-break-inside:avoid;break-inside:avoid;">
      <div class="card-title">Galería de Productos</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;">
        ${evidencias.map((ev, i) => `
          <div style="flex:1;min-width:130px;max-width:200px;">
            <img src="${ev.b64}" alt="Producto ${i + 1}" style="max-width:100%;max-height:140px;width:auto;height:auto;border-radius:6px;border:1px solid #CBD5E1;display:block;margin:0 auto;" />
            <div style="margin-top:4px;font-size:9px;color:#475569;font-weight:600;text-align:center;">Foto ${i + 1}${ev.caption ? ` — ${ev.caption}` : ""}</div>
          </div>`).join("")}
      </div>
    </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/>
<title>Cotización ${usedFolio} · Bionordi</title>
<style>${COTIZACION_PDF_CSS}</style>
</head>
<body>
<div class="page">
<div class="hdr">
  <div><img src="${logoB64}" alt="Bionordi" style="height:52px;width:auto;display:block;" /></div>
  <div class="meta-box">
    <div class="doc-title">Venta de Consumibles</div>
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
${tableHTML}
${galleryHTML}
</div>
${PAGE_BREAK}
<div class="page-two">
<div class="tech-card avoid-break" style="margin-bottom:20px;border-left:4px solid #4E60A9;margin-top:0px;">
  <div class="card-title">Propuesta Comercial</div>
  <p style="font-size:11px;color:#334155;line-height:1.5;margin-bottom:10px;">${propText}</p>
  <div style="background:#EEF0F7;border:1px solid #C5CAE0;border-radius:10px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;">
    <div>
      <div style="font-size:9px;font-weight:800;color:#4E60A9;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Inversión Total</div>
      <div style="font-size:11px;color:#4E60A9;">Incluye suministro y validación técnica</div>
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
      tipo: "consumibles", folio: usedFolio, monto_total: total,
      items_json: {
        items: validItems.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, precioUnit: i.precioUnit })),
        meta: {
          cliContacto, cliTel, cliCorreo, cliDireccion,
          descuento, conIVA, firmaUserId,
          evidencias, propuestaPDF,
          polVigencia, polPago, polEntrega, polGarantia,
          facRazonSoc, facRFC, facRegimen, facCFDI, facDirFiscal, facCorreo,
        },
      },
      eq_tipo: null, eq_marca: null, eq_modelo: null, eq_serie: null, eq_descripcion: null,
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
    <h2 style="color:#4E60A9;">Venta de Consumibles ${f}</h2>
    <p>Estimado cliente,</p>
    <p>Le hacemos llegar la cotización correspondiente a la venta de consumibles y accesorios médicos.</p>
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
          subject: `Cotización ${f} — Venta de Consumibles · Bionordi`,
          html: emailHTML,
          attachments,
        }),
      });
      if (!res.ok) throw new Error();
      // El envío exitoso avanza la cotización a "enviada" en el pipeline
      if (savedCotRef.current) {
        await fetch(`/api/cotizaciones/${savedCotRef.current.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "enviada" }),
        });
      }
      setEmailStatus("ok");
      setTimeout(() => { setEmailStatus("idle"); setShowEmail(false); }, 3000);
    } catch { setEmailStatus("error"); setTimeout(() => setEmailStatus("idle"), 3000); }
  };

  const addEvidencia = (b64: string) => {
    setEvidencias(p => [...p, { b64, caption: "" }]);
  };
  const removeEvidencia = (idx: number) => {
    setEvidencias(p => p.filter((_, i) => i !== idx));
  };
  const updateEvidenciaCaption = (idx: number, val: string) => {
    setEvidencias(p => p.map((ev, i) => i === idx ? { ...ev, caption: val } : ev));
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
    <div className="flex-1 flex flex-row overflow-hidden" style={{ height: "100%", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#F4F7FB" }}>

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
          <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px" }}>Configura la cotización de consumibles</div>
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

          {/* Galería de productos */}
          <div style={floatingCard}>
            <div style={{ ...cardTitle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>Fotos del Producto</span>
              <button onClick={() => uploadImage(addEvidencia)} style={{ background: "none", border: "none", color: "#4E60A9", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 800 }}>
                <Plus size={12} /> Añadir
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {evidencias.map((ev, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", background: "#F8FAFC", padding: "8px", borderRadius: "8px", border: "1px dashed #CBD5E1" }}>
                  <img src={ev.b64} alt="" style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px", border: "1px solid #E2E8F0" }} />
                  <input value={ev.caption} onChange={e => updateEvidenciaCaption(i, e.target.value)} placeholder="Descripción foto..."
                    style={{ flex: 1, fontSize: "10px", border: "1px solid #CBD5E1", borderRadius: "4px", padding: "3px 6px" }} />
                  <button onClick={() => removeEvidencia(i)} style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}><Trash2 size={12} /></button>
                </div>
              ))}
              {evidencias.length === 0 && (
                <div style={{ textAlign: "center", padding: "12px", color: "#94A3B8", fontSize: "10px", border: "1px dashed #E2E8F0", borderRadius: "8px" }}>
                  Sin imágenes cargadas
                </div>
              )}
            </div>
          </div>

          {/* Editor de Servicios / Ítems */}
          <div style={floatingCard}>
            <div onClick={() => setCollItems(p => !p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
              <div style={{ ...cardTitle, marginBottom: 0, borderBottom: "none", paddingBottom: 0 }}>Consumibles / Conceptos</div>
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
                        <input value={item.descripcion} onChange={e => updateItem(item.id, "descripcion", e.target.value)} placeholder="Descripción del consumible..."
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
                  <input value={polEntrega} onChange={e => setPolEntrega(e.target.value)} placeholder="Ej. Inmediata"
                    style={{ width: "100%", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "5px 8px", fontSize: "10.5px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "8.5px", color: "#64748B", fontWeight: 700 }}>GARANTÍA</label>
                  <input value={polGarantia} onChange={e => setPolGarantia(e.target.value)} placeholder="Ej. Devolución de 7 días"
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
        <div style={{ height: "56px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", flexShrink: 0, zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
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
                    <div style={{ fontSize: "16px", fontWeight: 300, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "2px", marginBottom: "8px" }}>Venta de Consumibles</div>
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

                {/* Lista de Artículos (Tabla en Hoja 1) */}
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginTop: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Lista de Consumibles y Artículos</span>
                    <button onClick={() => expandCardOnly("items")} style={{ fontSize: "9px", color: "#4E60A9", fontWeight: 700, border: "1px solid #C5CAE0", background: "#EEF0F7", cursor: "pointer", padding: "2px 6px", borderRadius: "4px" }}>
                      📝 Editar Lista
                    </button>
                  </div>
                  
                  <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "8px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #E2E8F0", textAlign: "left", fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        <th style={{ padding: "6px 8px", width: "60px" }}>Cant.</th>
                        <th style={{ padding: "6px 8px" }}>Descripción</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", width: "110px" }}>P. Unitario</th>
                        <th style={{ padding: "6px 8px", textAlign: "right", width: "110px" }}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validItems.map((item, idx) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #F1F5F9", fontSize: "11px" }}>
                          <td style={{ padding: "8px", color: "#4E60A9", fontWeight: 700 }}>{item.cantidad}</td>
                          <td style={{ padding: "8px", color: "#1E293B", fontWeight: 500 }}>{item.descripcion}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#475569" }}>{$f(item.precioUnit)}</td>
                          <td style={{ padding: "8px", textAlign: "right", color: "#1E293B", fontWeight: 600 }}>{$f(item.cantidad * item.precioUnit)}</td>
                        </tr>
                      ))}
                      {validItems.length === 0 && (
                        <tr>
                          <td colSpan={4} style={{ padding: "12px", textAlign: "center", color: "#94A3B8", fontSize: "11px" }}>
                            Complete la lista de artículos en el panel lateral.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Galería de productos */}
                {evidencias.length > 0 && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "10px 14px", marginTop: "12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                      Galería de Productos
                    </div>
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "8px" }}>
                      {evidencias.map((ev, i) => (
                        <div key={i} style={{ flex: "1 1 120px", minWidth: "120px", maxWidth: "200px" }}>
                          <img src={ev.b64} alt="" style={{ maxWidth: "100%", maxHeight: "100px", width: "auto", height: "auto", borderRadius: "6px", border: "1px solid #CBD5E1", display: "block", margin: "0 auto" }} />
                          <div style={{ marginTop: "4px", fontSize: "9px", color: "#475569", fontWeight: 600, textAlign: "center" }}>
                            Foto {i + 1}{ev.caption ? ` — ${ev.caption}` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                  {/* Indicador visual: margen inferior @page 15mm = 57px */}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                    <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen inferior @page — 15 mm</span>
                  </div>
                </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "-25px", padding: "0 4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>PÁGINA 2 · VISTA PREVIA DE IMPRESIÓN (CARTA)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>área útil 939 px</span>
              </div>

              {/* HOJA 2 */}
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
                justifyContent: "flex-start",
                overflow: "hidden"
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "38px", background: "rgba(248,250,252,0.88)", borderBottom: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                  <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen superior @page — 10 mm</span>
                </div>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "57px", background: "rgba(248,250,252,0.88)", borderTop: "1px dashed #CBD5E1", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
                  <span style={{ fontSize: "8px", color: "#CBD5E1", fontWeight: 700, letterSpacing: "0.5px" }}>Margen inferior @page — 15 mm</span>
                </div>
                
                {/* Propuesta de Servicio */}
                <div style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderLeft: "4px solid #4E60A9", borderRadius: "12px", padding: "14px 16px", marginBottom: "15px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                    Propuesta Comercial
                  </div>
                  <div style={{ fontSize: "11px", color: "#334155", lineHeight: "1.6" }}>
                    <F value={propuestaPDF} onChange={setPropuestaPDF} placeholder={generarParrafoAlcance() || "Propuesta comercial para el suministro de consumibles y accesorios médicos."} multiline={true} rows={3} style={{ borderBottom: "none" }} />
                  </div>
                  
                  <div style={{ background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
                    <div>
                      <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>Inversión Total</div>
                      <div style={{ fontSize: "10.5px", color: "#4E60A9" }}>Suministro directo, validación técnica y garantía</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {descuento > 0 && <div style={{ fontSize: "11px", color: "#94A3B8", textDecoration: "line-through", marginBottom: "2px" }}>{$f(subtotal)}</div>}
                      <div style={{ fontSize: "24px", fontWeight: 900, color: "#4E60A9", letterSpacing: "-1px" }}>{$f(total)}</div>
                      {conIVA ? <div style={{ fontSize: "9px", color: "#38AD64", fontWeight: 700 }}>IVA incluido</div> : <div style={{ fontSize: "9px", color: "#64748B" }}>Más IVA</div>}
                    </div>
                  </div>
                </div>

                {notas && (
                  <div style={{ background: "#FFFBEB", borderLeft: "3px solid #F59E0B", padding: "9px 13px", marginBottom: "15px", fontSize: "11px", color: "#92400E", borderRadius: "0 4px 4px 0" }}>
                    <strong>Notas:</strong> {notas}
                  </div>
                )}

                <div style={{ display: "flex", gap: "20px", marginBottom: "15px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, background: "#EEF0F7", border: "1px solid #C5CAE0", borderRadius: "12px", padding: "12px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px", borderBottom: "1px solid #C5CAE0", paddingBottom: "4px" }}>
                      Instrucciones para Solicitar Factura
                    </div>
                    <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#4E60A9", marginBottom: "8px", lineHeight: "1.4" }}>
                      <span style={{ fontWeight: 800 }}>1.</span><div>Realice el pago total o anticipo a la cuenta CLABE indicada arriba.</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#4E60A9", marginBottom: "8px", lineHeight: "1.4" }}>
                      <span style={{ fontWeight: 800 }}>2.</span><div>Envíe un correo a <strong>{bn.correo}</strong> adjuntando el comprobante de pago y Constancia de Situación Fiscal.</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#4E60A9", marginBottom: "8px", lineHeight: "1.4" }}>
                      <span style={{ fontWeight: 800 }}>3.</span><div>Indique su <strong>Uso de CFDI</strong> en el correo.</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", fontSize: "10.5px", color: "#4E60A9", marginBottom: "0px", lineHeight: "1.4" }}>
                      <span style={{ fontWeight: 800 }}>4.</span><div>Su factura será procesada en un lapso no mayor a 24 horas hábiles.</div>
                    </div>
                  </div>

                  <div style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#64748B", marginBottom: "8px" }}>
                      <div>Subtotal</div>
                      <div style={{ fontWeight: 600, color: "#1E293B" }}>{$f(subtotal)}</div>
                    </div>
                    {descuento > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#64748B", marginBottom: "8px" }}>
                        <div>Descuento ({descuento}%)</div>
                        <div style={{ fontWeight: 600, color: "#EF4444" }}>−{$f(descMonto)}</div>
                      </div>
                    )}
                    {conIVA && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#64748B", marginBottom: "8px" }}>
                        <div>IVA (16%)</div>
                        <div style={{ fontWeight: 600, color: "#1E293B" }}>{$f(iva)}</div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "15px", fontWeight: 900, color: "#4E60A9", borderTop: "2px solid #E2E8F0", paddingTop: "10px", marginTop: "4px" }}>
                      <div>Total (MXN)</div>
                      <div>{$f(total)}</div>
                    </div>
                  </div>
                </div>

                {/* Políticas y Garantía */}
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                    Políticas Comerciales y Garantía
                  </div>
                  <ul style={{ listStyle: "none", padding: 0 }}>
                    <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "5px", lineHeight: "1.5" }}>
                      <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold" }}>•</span>
                      <strong>Vigencia:</strong> {getPolVigencia()}.
                    </li>
                    <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "5px", lineHeight: "1.5" }}>
                      <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold" }}>•</span>
                      <strong>Esquema de Pago:</strong> {getPolPago()}.
                    </li>
                    <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "5px", lineHeight: "1.5" }}>
                      <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold" }}>•</span>
                      <strong>Tiempo de Entrega:</strong> {getPolEntrega()}.
                    </li>
                    <li style={{ position: "relative", paddingLeft: "14px", fontSize: "10px", color: "#475569", marginBottom: "5px", lineHeight: "1.5" }}>
                      <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold" }}>•</span>
                      <strong>Garantía:</strong> {getPolGarantia()}.
                    </li>
                  </ul>
                </div>

                <div style={{ flex: 1 }}></div>

                {/* Firmas y pie de página */}
                <div className="signatures-wrapper">
                  
                  <div style={{ textAlign: "center", borderTop: "1px solid #E2E8F0", paddingTop: "8px", fontSize: "9.5px", color: "#94A3B8", lineHeight: "1.5" }}>
                    <strong>{bn.razonSocial}</strong> · {bn.direccionFiscal} · {bn.correo}<br/>
                    Documento generado digitalmente por el sistema de Gestión Bionordi.
                  </div>
                </div>

              </div>

            </div>
          )}
        </div>
      </div>

      {/* MODAL VISUALIZADOR DE DOCUMENTOS */}
      {previewUrl && (
        <DocumentViewerModal title={`Cotización — ${previewFolio}`} url={previewUrl} downloadName={`${previewFolio}.pdf`} onClose={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }} />
      )}
      {previewHtml && (
        <DocumentViewerModal title={`Cotización — ${previewFolio}`} html={previewHtml} downloadName={`${previewFolio}.pdf`} onClose={() => setPreviewHtml(null)} />
      )}

    </div>
  );
}
