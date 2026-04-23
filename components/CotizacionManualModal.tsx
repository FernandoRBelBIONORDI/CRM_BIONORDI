"use client";

import { useState, useEffect } from "react";
import { X, Printer, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type TipoCotizacion = "reparacion" | "venta" | "mantenimiento";

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
};

const TIPO_LABELS: Record<TipoCotizacion, string> = {
  reparacion:    "Reparación de Transductores",
  venta:         "Venta de Equipo",
  mantenimiento: "Mantenimiento de Equipo",
};

const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1E3A8A]/40 bg-white";
const sel = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#1E3A8A]/40 bg-white appearance-none";

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

export default function CotizacionManualModal({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<TipoCotizacion>("reparacion");
  const [bn, setBn] = useState<BionordiCfg>({
    razonSocial:"Bionordi S.A. de C.V.", rfc:"—", banco:"—", cuenta:"—",
    clabe:"—", direccionFiscal:"Ciudad de México, CDMX",
    correo:"contacto@bionordi.mx", representante:"Fernando Rosas", cargo:"Director General",
  });

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
    });
  }, []);

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

  // Ajustes
  const [descuento, setDescuento] = useState(0);
  const [conIVA,    setConIVA]    = useState(true);
  const [notas,     setNotas]     = useState("");
  const [showFact,  setShowFact]  = useState(false);

  // Facturación
  const [facRazonSoc,  setFacRazonSoc]  = useState("");
  const [facRFC,       setFacRFC]       = useState("");
  const [facRegimen,   setFacRegimen]   = useState("612");
  const [facCFDI,      setFacCFDI]      = useState("G03");
  const [facDirFiscal, setFacDirFiscal] = useState("");
  const [facCorreo,    setFacCorreo]    = useState("");

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

  const generarPDF = async () => {
    let imgTransductor = "/transductor.png";
    let imgFront       = "/equipo_movil_front.png";
    let imgBack        = "/equipo_movil_back.png.png";

    if (tipo === "reparacion") {
      imgTransductor = await fetchBase64("/transductor.png");
    }
    if (tipo === "mantenimiento" || tipo === "venta") {
      [imgFront, imgBack] = await Promise.all([
        fetchBase64("/equipo_movil_front.png"),
        fetchBase64("/equipo_movil_back.png.png"),
      ]);
    }

    const fecha    = new Date().toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });
    const folio    = `BNRD-${new Date().getFullYear().toString().slice(-2)}-${tipo === "venta" ? "V" : tipo === "mantenimiento" ? "M" : "C"}-${Date.now().toString().slice(-4)}`;
    const vigencia = new Date(Date.now() + 15 * 86400000).toLocaleDateString("es-MX", { day:"2-digit", month:"long", year:"numeric" });

    const rows = validItems.map((s, i) => `
      <tr>
        <td class="c text-muted">${i + 1}</td>
        <td><div class="s-name">${s.descripcion}</div></td>
        <td class="c">${s.cantidad}</td>
        <td class="r">${$f(s.precioUnit)}</td>
        <td class="r b">${$f(s.cantidad * s.precioUnit)}</td>
      </tr>`).join("");

    const diagramaHTML = tipo === "reparacion" ? `
    <div class="tech-card avoid-break">
      <div class="card-title">Alcance Técnico y Diagnóstico Integral</div>
      <p class="diag-p">
        Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>.
        Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.
      </p>
      <div class="diag-grid">
        <div class="img-container">
          <img src="${imgTransductor}" alt="Diagrama Transductor" style="width:100%;height:160px;object-fit:contain;background:white;" />
          <div class="dot" style="top:25%;left:39%;">1</div>
          <div class="dot" style="top:20%;left:55%;">2</div>
          <div class="dot" style="bottom:12%;right:18%;">3</div>
        </div>
        <div class="diag-list">
          <div class="d-item"><div class="d-num">1</div><div><strong>Lente Acústico / Membrana:</strong> Retiro del material desgastado, descontaminación del arreglo de cristales e inyección de nuevo polímero acústico con curado térmico.</div></div>
          <div class="d-item"><div class="d-num">2</div><div><strong>Carcasa y Sellado:</strong> Reencapsulado de uniones para evitar filtraciones de gel transmisor y proteger los componentes electrónicos internos.</div></div>
          <div class="d-item"><div class="d-num">3</div><div><strong>Cableado y Conector:</strong> Revisión de micro-coaxiales, refuerzo en zonas de flexión y limpieza profunda de pines de contacto en la placa base.</div></div>
        </div>
      </div>
    </div>`
    : (tipo === "mantenimiento" || tipo === "venta") ? `
    <div class="tech-card avoid-break">
      <div class="card-title">${tipo === "mantenimiento" ? "Alcance del Mantenimiento — Equipo Móvil" : "Características del Equipo — Vista de Referencia"}</div>
      <p class="diag-p">
        ${tipo === "mantenimiento"
          ? "Se realiza inspección completa de la unidad cubriendo panel frontal, conectores, sistema de enfriamiento y puertos traseros. Cada punto es documentado antes y después del servicio."
          : "Equipo portátil de ultrasonido. Se incluyen vistas frontal y posterior para referencia de especificaciones y puntos de inspección en recepción."
        }
      </p>
      <div style="display:flex;gap:16px;margin-top:4px;">
        <!-- Vista frontal -->
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
        <!-- Vista trasera -->
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
    </div>` : "";

    const equipoHTML = (tipo === "reparacion" || tipo === "mantenimiento") && (eqTipo || eqMarca || eqModelo || eqSerie || eqFalla) ? `
    <div class="eq-card">
      <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Especificaciones del Equipo</div>
      <div class="eq-grid">
        <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${eqTipo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || "—"}</div></div>
        <div class="eq-item"><div class="eq-lbl">No. de Serie</div><div class="eq-val">${eqSerie || "—"}</div></div>
        ${eqFalla ? `<div class="eq-full"><div class="eq-lbl" style="color:#B91C1C;">Falla Reportada / Síntoma</div><div class="eq-val" style="color:#7F1D1D;margin-top:2px;">${eqFalla}</div></div>` : ""}
      </div>
    </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/>
<title>Cotización ${folio} · Bionordi</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .page{padding:40px 50px;max-width:850px;margin:0 auto}
  .avoid-break{page-break-inside:avoid}
  .text-muted{color:#94A3B8}.b{font-weight:700}.c{text-align:center}.r{text-align:right}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:25px}
  .logo{font-size:34px;font-weight:900;color:#1E3A8A;letter-spacing:-1px;line-height:1}
  .logo span{color:#3B82F6}
  .logo-sub{font-size:10px;font-weight:600;color:#64748B;margin-top:4px;letter-spacing:.5px;text-transform:uppercase}
  .meta-box{text-align:right}
  .doc-title{font-size:18px;font-weight:300;color:#94A3B8;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px}
  .meta-grid{display:grid;grid-template-columns:auto auto;gap:4px 15px;justify-content:end;font-size:11px}
  .meta-lbl{font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px}
  .meta-val{color:#1E293B;font-weight:600}
  .divider{height:4px;background:linear-gradient(90deg,#1E3A8A,#3B82F6,#E2E8F0);border-radius:4px;margin-bottom:25px}
  .info-section{display:flex;gap:20px;margin-bottom:20px}
  .info-card{flex:1;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px}
  .card-title{font-size:10px;font-weight:800;color:#1E3A8A;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #E2E8F0;padding-bottom:6px}
  .i-row{display:flex;margin-bottom:5px;font-size:11px;line-height:1.4}
  .i-lbl{width:85px;color:#64748B;font-weight:700}
  .i-val{flex:1;color:#1E293B;font-weight:500}
  .eq-card{background:#fff;border:1px solid #CBD5E1;border-radius:12px;padding:16px;margin-bottom:20px;border-left:4px solid #1E3A8A}
  .eq-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:15px}
  .eq-item{display:flex;flex-direction:column;gap:4px}
  .eq-lbl{font-size:9px;color:#64748B;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
  .eq-val{font-size:12px;color:#0F172A;font-weight:600}
  .eq-full{grid-column:span 4;background:#FEF2F2;padding:10px 14px;border-radius:8px;border-left:3px solid #EF4444;margin-top:5px}
  .tech-card{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:16px;margin-bottom:20px}
  .diag-p{font-size:11px;color:#475569;line-height:1.5;margin-bottom:15px}
  .diag-grid{display:flex;gap:20px;align-items:center}
  .img-container{flex:.8;position:relative;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .dot{position:absolute;width:18px;height:18px;background:#3B82F6;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.3);border:2px solid #fff}
  .diag-list{flex:1.2;display:flex;flex-direction:column;gap:12px}
  .d-item{display:flex;gap:10px;font-size:10.5px;color:#334155;line-height:1.4;align-items:flex-start}
  .d-num{width:18px;height:18px;background:#DBEAFE;color:#1D4ED8;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
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
  .t-row.final{border-top:2px solid #E2E8F0;padding-top:12px;margin-top:4px;font-size:16px;font-weight:900;color:#1E3A8A}
  .t-row.final .t-val{color:#1E3A8A}
  .billing-instructions{flex:1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:16px}
  .billing-instructions .card-title{color:#1D4ED8;border-bottom-color:#BFDBFE}
  .b-step{display:flex;gap:8px;font-size:10.5px;color:#1E3A8A;margin-bottom:8px;line-height:1.4}
  .b-step strong{font-weight:800}
  .b-icon{font-weight:bold;color:#3B82F6}
  .cond-section{margin-bottom:20px;page-break-inside:avoid}
  .cond-title{font-size:11px;font-weight:800;color:#1E3A8A;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
  .cond-list{list-style:none;padding:0}
  .cond-list li{position:relative;padding-left:14px;font-size:10px;color:#475569;margin-bottom:6px;line-height:1.5}
  .cond-list li::before{content:"•";position:absolute;left:0;color:#3B82F6;font-weight:bold;font-size:14px;line-height:1;top:-1px}
  .signatures{margin-top:40px;display:flex;justify-content:flex-end;page-break-inside:avoid}
  .sig-box{text-align:center;width:240px}
  .sig-line{border-top:2px solid #CBD5E1;margin-bottom:10px;padding-top:10px}
  .sig-name{font-size:13px;font-weight:800;color:#1E3A8A}
  .sig-role{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;margin-top:2px}
  .footer{text-align:center;border-top:1px solid #E2E8F0;padding-top:15px;margin-top:30px;font-size:10px;color:#94A3B8;line-height:1.6}
  @media print{body{padding:0}.page{padding:20px}}
</style>
</head>
<body><div class="page">

<div class="hdr">
  <div>
    <div class="logo">BIO<span>NORDI</span></div>
    <div class="logo-sub">Laboratorio Especializado en Transductores</div>
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

<table>
  <thead><tr>
    <th class="c" style="width:50px;">Item</th>
    <th>Descripción</th>
    <th class="c" style="width:60px;">Cant.</th>
    <th class="r" style="width:120px;">Precio Unit.</th>
    <th class="r" style="width:120px;">Importe</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

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
    ${tipo === "reparacion" ? `<li><strong>Garantía:</strong> 6 meses sobre la reparación. No cubre daños por caídas, tirones de cable o derrames posteriores.</li>` : ""}
    ${tipo === "mantenimiento" ? `<li><strong>Garantía:</strong> 3 meses sobre el servicio de mantenimiento realizado.</li>` : ""}
  </ul>
</div>

<div class="signatures">
  <div class="sig-box">
    <div class="sig-line">
      <div class="sig-name">${bn.representante}</div>
      <div class="sig-role">${bn.cargo}</div>
      <div class="sig-role" style="color:#1E3A8A;font-weight:800;margin-top:4px;">${bn.razonSocial}</div>
    </div>
  </div>
</div>

<div class="footer">
  <strong>${bn.razonSocial}</strong> · ${bn.direccionFiscal} · ${bn.correo}<br/>
  Documento generado digitalmente por el sistema de Gestión Bionordi.
</div>

</div></body></html>`;

    const blob = new Blob([html], { type:"text/html;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const w    = window.open(url, "_blank");
    if (w) w.addEventListener("load", () => setTimeout(() => { w.focus(); w.print(); }, 300));
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const showEquipo = tipo === "reparacion" || tipo === "mantenimiento";
  const rapidosList = SERVICIOS_RAPIDOS[tipo];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-[700px] max-h-[94vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-[#1E293B] text-[15px] leading-tight">Nueva Cotización</h3>
            <p className="text-[11px] text-gray-400 font-medium">Llenado manual — sin lead</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X size={15}/>
          </button>
        </div>

        {/* Tipo selector */}
        <div className="px-6 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest mb-2">Tipo de cotización</div>
          <div className="flex gap-2">
            {(["reparacion","venta","mantenimiento"] as TipoCotizacion[]).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                className={`flex-1 py-2 rounded-xl text-[11px] font-bold border transition-all ${tipo === t ? "bg-[#1E3A8A] text-white border-[#1E3A8A]" : "bg-white text-gray-500 border-gray-200 hover:border-[#1E3A8A]/30"}`}>
                {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* Cliente */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest mb-3">Datos del cliente</div>
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
              <div className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest mb-3">
                {tipo === "reparacion" ? "Equipo a reparar" : "Equipo a dar mantenimiento"}
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Tipo de equipo / transductor">
                  {tipo === "reparacion"
                    ? <select value={eqTipo} onChange={e => setEqTipo(e.target.value)} className={sel}>
                        <option value="">— Seleccionar —</option>
                        {TIPOS_TRANSDUCTOR.map(t => <option key={t}>{t}</option>)}
                      </select>
                    : <input value={eqTipo} onChange={e => setEqTipo(e.target.value)} placeholder="Ultrasonido, Monitor…" className={inp}/>
                  }
                </Field>
                <Field label="Marca">
                  <input value={eqMarca} onChange={e => setEqMarca(e.target.value)} placeholder="GE, Philips, Mindray…" className={inp}/>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <Field label="Modelo">
                  <input value={eqModelo} onChange={e => setEqModelo(e.target.value)} placeholder="Modelo" className={inp}/>
                </Field>
                <Field label="No. de Serie">
                  <input value={eqSerie} onChange={e => setEqSerie(e.target.value)} placeholder="SN-XXXXXX" className={inp}/>
                </Field>
                <Field label="Falla / Síntoma">
                  <input value={eqFalla} onChange={e => setEqFalla(e.target.value)} placeholder="Sin imagen, cable dañado…" className={inp}/>
                </Field>
              </div>
            </div>
          )}

          {/* Servicios rápidos */}
          {rapidosList.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest mb-2">Agregar servicio rápido</div>
              <div className="flex flex-wrap gap-1.5">
                {rapidosList.map(s => (
                  <button key={s.nombre} onClick={() => addRapido(s)}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-gray-200 hover:border-[#1E3A8A]/40 hover:bg-blue-50/60 text-gray-600 font-medium transition-all">
                    {s.nombre} — <span className="text-[#1E3A8A] font-bold">${s.precio.toLocaleString("es-MX")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest">
                {tipo === "venta" ? "Productos / Equipos" : "Servicios"}
              </div>
              <button onClick={addItem}
                className="flex items-center gap-1 text-[11px] font-bold text-[#1E3A8A] hover:bg-blue-50 px-2 py-1 rounded-lg transition-all">
                <Plus size={13}/> Agregar línea
              </button>
            </div>

            {/* Cabecera */}
            <div className="grid grid-cols-[1fr_60px_110px_32px] gap-2 px-1 mb-1">
              <div className="text-[10px] font-bold text-gray-400 uppercase">Descripción</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-center">Cant.</div>
              <div className="text-[10px] font-bold text-gray-400 uppercase text-right">Precio Unit.</div>
              <div/>
            </div>

            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="grid grid-cols-[1fr_60px_110px_32px] gap-2 items-center">
                  <input
                    value={item.descripcion}
                    onChange={e => updateItem(item.id, "descripcion", e.target.value)}
                    placeholder={tipo === "venta" ? "Nombre del producto/equipo" : "Descripción del servicio"}
                    className={inp}/>
                  <input
                    type="number" min={1}
                    value={item.cantidad}
                    onChange={e => updateItem(item.id, "cantidad", Math.max(1, Number(e.target.value)))}
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-center focus:border-[#1E3A8A]/40 bg-white w-full"/>
                  <input
                    type="number" min={0}
                    value={item.precioUnit || ""}
                    onChange={e => updateItem(item.id, "precioUnit", Number(e.target.value))}
                    placeholder="0"
                    className="text-[12px] border border-gray-200 rounded-lg px-2 py-2 outline-none text-right focus:border-[#1E3A8A]/40 bg-white w-full"/>
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
              className="w-full flex items-center justify-between text-[10px] font-bold text-[#1E3A8A] uppercase tracking-widest">
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
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${conIVA ? "bg-[#1E3A8A] border-[#1E3A8A] text-white" : "bg-white border-gray-200 text-gray-500"}`}>
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
              <div className="text-[22px] font-extrabold text-[#1E3A8A] tabular-nums">${total.toLocaleString("es-MX")}</div>
            </div>
          </div>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Notas adicionales (opcional)…"
            className="w-full text-[12px] font-medium bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-gray-400 focus:border-[#1E3A8A]/30 transition-all"/>
          <button onClick={generarPDF} disabled={!canGenerar}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-white bg-[#1E3A8A] hover:bg-[#1e40af] py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
            <Printer size={15}/>
            {!canGenerar ? "Completa nombre del cliente y al menos un servicio" : `Generar PDF · ${TIPO_LABELS[tipo]}`}
          </button>
        </div>
      </div>
    </div>
  );
}
