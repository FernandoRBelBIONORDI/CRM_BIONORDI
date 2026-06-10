"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Wrench,
  User,
  Plus,
  Trash2,
  Save,
  Printer,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from "lucide-react";
import SignaturePad from "@/components/SignaturePad";
import DocumentViewerModal from "@/components/DocumentViewerModal";

interface Lead {
  id: number;
  nombre: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  estado_republica?: string;
  direccion?: string;
}

interface CatalogoItem {
  id: number;
  tipo: string;
  marca: string;
  modelo: string;
  descripcion: string | null;
}

const ACCESORIOS_PRESET = [
  "Cable de alimentación",
  "Estuche rígido de transporte",
  "Funda protectora",
  "Impresora térmica",
  "Transductor acoplado",
  "Manual de usuario",
  "Gel conductor",
  "Adaptador de corriente"
];

const CLAUSULAS_DEFAULT = `1. DIAGNÓSTICO: El cliente acepta que todo equipo ingresado para diagnóstico causa un honorario de $1,500.00 MXN (más IVA) si el presupuesto de reparación es rechazado. El tiempo estimado de diagnóstico es de 3 a 5 días hábiles a partir de la fecha de ingreso.
2. RESPALDO DE INFORMACIÓN: Bionordi no se hace responsable por la pérdida de datos, imágenes o configuraciones contenidas en la memoria del equipo. Es responsabilidad del cliente respaldar su información previamente.
3. ALMACENAMIENTO Y ABANDONO: Transcurridos 30 días naturales a partir del aviso de reparación o presupuesto sin que el cliente recoja el equipo, se cobrará una tarifa de almacenaje de $50.00 MXN diarios. A los 90 días naturales, el equipo se considerará abandonado, facultando a Bionordi a disponer de él para recuperar costos.
4. ENVÍOS Y TRASLADO: Bionordi no asume responsabilidad por daños, golpes o extravíos que sufra el equipo durante el transporte por paqueterías externas o transportistas contratados por el cliente.`;

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
  const res = await fetch("/api/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: htmlString }),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.base64) return data.base64;
  }
  throw new Error("Error al generar PDF en el servidor");
}

// Input inline de plantilla del PDF (Dashed inputs)
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

export default function RecepcionPageWrapper() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center bg-[#F4F7FB]">
        <Loader2 className="animate-spin text-[#4E60A9]" size={32} />
      </div>
    }>
      <RecepcionPage />
    </Suspense>
  );
}

function RecepcionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // Estados de carga e ID de la orden
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [folio, setFolio] = useState("");

  // Mapeo de Leads
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [leadId, setLeadId] = useState<number | null>(null);

  // Catálogo
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([]);
  const [catalogoSearch, setCatalogoSearch] = useState("");
  const [equipoMode, setEquipoMode] = useState<"catalogo" | "manual">("catalogo");

  // Formulario principal
  const [cliNombre, setCliNombre] = useState("");
  const [cliContacto, setCliContacto] = useState("");
  const [cliTel, setCliTel] = useState("");
  const [cliCorreo, setCliCorreo] = useState("");
  const [cliDireccion, setCliDireccion] = useState("");
  const [cliDatosFiscales, setCliDatosFiscales] = useState("");

  const [eqTipo, setEqTipo] = useState("");
  const [eqMarca, setEqMarca] = useState("");
  const [eqModelo, setEqModelo] = useState("");
  const [eqSerie, setEqSerie] = useState("");
  const [eqVersion, setEqVersion] = useState("");
  const [eqAno, setEqAno] = useState("");
  const [eqArea, setEqArea] = useState("");
  const [eqTecnico, setEqTecnico] = useState("");
  const [eqAccesorios, setEqAccesorios] = useState<string[]>([]);
  const [eqAccesoriosManual, setEqAccesoriosManual] = useState("");

  const [fallaReportada, setFallaReportada] = useState("");
  const [condicionRecepcion, setCondicionRecepcion] = useState("");
  const [costoDiagnostico, setCostoDiagnostico] = useState(1500);
  const [entregadoPor, setEntregadoPor] = useState("");
  const [recibidoPor, setRecibidoPor] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState(new Date().toISOString().slice(0, 10));
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [clausulas, setClausulas] = useState(CLAUSULAS_DEFAULT);

  const [firmas, setFirmas] = useState({
    entrega: "",
    recibe: ""
  });

  // Evidencias (fotos de ingreso) y fotos de resultado (para preservar al guardar)
  const [evidencias, setEvidencias] = useState<{ b64: string; caption: string }[]>([]);
  const [fotosResultado, setFotosResultado] = useState<string[]>([]);

  // Usuarios del CRM y firmante técnico
  const [usuariosList, setUsuariosList] = useState<{ id: number; nombre: string; cargo?: string }[]>([]);
  const [firmaUserId, setFirmaUserId] = useState<number | "bionordi">("bionordi");

  // UI state
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "ok" | "error">("idle");
  const [emailTo, setEmailTo] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [showEmail, setShowEmail] = useState(false);

  // Secciones colapsables y barra lateral
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [collCliente, setCollCliente] = useState(false);
  const [collEquipo, setCollEquipo] = useState(false);
  const [collRecepcion, setCollRecepcion] = useState(false);
  const [collClausulas, setCollClausulas] = useState(true);
  const [collFirmas, setCollFirmas] = useState(false);

  const expandCardOnly = (cardName: "cliente" | "equipo" | "recepcion" | "clausulas" | "firmas") => {
    setSidebarCollapsed(false);
    setCollCliente(cardName !== "cliente");
    setCollEquipo(cardName !== "equipo");
    setCollRecepcion(cardName !== "recepcion");
    setCollClausulas(cardName !== "clausulas");
    setCollFirmas(cardName !== "firmas");
  };

  const eqTipoNormalizado = (eqTipo || "").toLowerCase();
  const esTransductor = ["lineal", "convex", "sectorial", "intracavitario", "tee", "3d", "4d", "microconvex", "transductor"].some(t => eqTipoNormalizado.includes(t));

  const catalogoFiltrado = catalogo.filter(e => {
    if (esTransductor) return e.tipo === "transductor";
    if (eqTipoNormalizado.includes("ultrasonido") || eqTipoNormalizado.includes("sistema")) return e.tipo === "ultrasonido";
    return true;
  });

  const marcasUnicas = [...new Set(catalogoFiltrado.map(e => e.marca).filter(Boolean))].sort() as string[];
  const modelosPorMarca = catalogoFiltrado.filter(e => !eqMarca || e.marca === eqMarca);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Cargar catálogos iniciales
  useEffect(() => {
    fetch("/api/leads")
      .then(r => r.json())
      .then(d => setLeadsList(d.leads || []))
      .catch(() => {});

    fetch("/api/catalogo")
      .then(r => r.json())
      .then(d => setCatalogo(d.equipos || []))
      .catch(() => {});

    fetch("/api/usuarios")
      .then(r => r.json())
      .then(d => setUsuariosList(d.usuarios || []))
      .catch(() => {});

    if (session?.user?.name) {
      setRecibidoPor(session.user?.name || "");
      setEqTecnico(session.user?.name || "");
    }
  }, [session]);

  // Cargar orden de trabajo si hay ID en la URL
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (!idParam) {
      // Generar nuevo folio temporal
      fetch("/api/ordenes")
        .then(r => r.json())
        .then(d => {
          // Asumir secuencia simple para previsualización
          const nextIndex = (d.ordenes?.length || 0) + 1;
          const yy = new Date().getFullYear().toString().slice(-2);
          const mm = String(new Date().getMonth() + 1).padStart(2, '0');
          const dd = String(new Date().getDate()).padStart(2, '0');
          setFolio(`BRT-${mm}${dd}${yy}-${String(nextIndex).padStart(3, "0")}`);
        })
        .catch(() => {});
      return;
    }

    setLoadingQuote(true);
    fetch(`/api/ordenes?id=${idParam}`)
      .then(r => r.json())
      .then(d => {
        const o = d.orden;
        if (o) {
          setOrderId(o.id);
          setFolio(o.folio);

          // Datos del cliente
          setLeadId(o.lead_id || null);
          setCliNombre(o.lead_nombre || "");
          setCliContacto(o.lead_nombre || "");
          setCliDireccion(o.direccion || "");
          setCliTel(o.telefono || "");
          setCliCorreo(o.correo || "");
          setEmailTo(o.correo || "");
          setCliDatosFiscales(o.datos_fiscales || "");

          // Datos del equipo
          let accs: string[] = [];
          let accsManual = "";
          if (o.accesorios_recibidos) {
            const splitted = o.accesorios_recibidos.split(", ");
            accs = splitted.filter((a: string) => ACCESORIOS_PRESET.includes(a));
            const manuals = splitted.filter((a: string) => !ACCESORIOS_PRESET.includes(a));
            accsManual = manuals.join(", ");
          }

          setEqTipo(o.equipo_tipo || "");
          setEqMarca(o.equipo_marca || "");
          setEqModelo(o.equipo_modelo || "");
          setEqSerie(o.equipo_num_serie || "");
          setEqVersion(o.equipo_version || "");
          setEqAno(o.equipo_ano || "");
          setEqArea(o.equipo_area_medica || "");
          setEqTecnico(o.tecnico || "");
          setEqAccesorios(accs);
          setEqAccesoriosManual(accsManual);

          // Determinar modo de equipo (si el modelo está en catálogo)
          if (o.equipo_modelo) {
            const exists = (d.equipos || []).some((e: any) => e.modelo === o.equipo_modelo);
            setEquipoMode(exists ? "catalogo" : "manual");
          }

          // Datos de recepción
          setFallaReportada(o.falla_reportada || "");
          setCondicionRecepcion(o.condicion_recepcion || "");
          setCostoDiagnostico(o.costo_diagnostico || 1500);
          setEntregadoPor(o.entregado_por || o.lead_nombre || "");
          setRecibidoPor(o.recibido_por || o.tecnico || "");
          setFechaIngreso(o.fecha_ingreso || new Date().toISOString().slice(0, 10));
          setFechaCompromiso(o.fecha_compromiso || "");
          setClausulas(o.clausulas_recepcion || CLAUSULAS_DEFAULT);

          // Fotografías
          if (o.fotografias_json) {
            try {
              const parsed = JSON.parse(o.fotografias_json);
              const acts = parsed.actividades || [];
              setEvidencias(acts.map((path: string) => ({ b64: path, caption: "" })));
              setFotosResultado(parsed.resultado || []);
            } catch {}
          }

          // Firmas
          if (o.firmas_json) {
            try {
              const parsed = JSON.parse(o.firmas_json);
              setFirmas({
                entrega: parsed.entrega || "",
                recibe: parsed.recibe || ""
              });
              if (parsed.firmaUserId) {
                setFirmaUserId(parsed.firmaUserId);
              }
            } catch {}
          }
        }
      })
      .catch(() => setToast({ msg: "Error al cargar la orden de trabajo.", ok: false }))
      .finally(() => setLoadingQuote(false));
  }, [searchParams]);

  // Vincular Lead del CRM
  const seleccionarLead = (l: Lead) => {
    setLeadId(l.id);
    setLeadSearch("");
    const address = [l.direccion, l.ciudad, l.estado_republica].filter(Boolean).join(", ");
    setCliNombre(l.nombre);
    setCliContacto(l.nombre);
    setCliTel(l.telefono || "");
    setCliCorreo(l.correo || "");
    setEmailTo(l.correo || "");
    setCliDireccion(address);
    setEntregadoPor(l.nombre);
  };

  // Seleccionar del catálogo de Bionordi
  const seleccionarDelCatalogo = (eq: CatalogoItem) => {
    setEqTipo(eq.tipo === "transductor" ? "Transductor" : eq.tipo === "ultrasonido" ? "Sistema de Ultrasonido" : eq.tipo);
    setEqMarca(eq.marca || "");
    setEqModelo(eq.modelo);
    setCatalogoSearch("");
  };

  // Ayudante de carga de imágenes (sube al servidor a /api/upload)
  const uploadImage = (setter: (path: string) => void) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      setSaving(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(`/api/upload?subfolder=ordenes&filename=${encodeURIComponent(file.name)}`, {
          method: "POST",
          body: fd
        }).then(r => r.json());
        if (res.path) {
          setter(res.path);
        } else if (res.error) {
          setToast({ msg: `Error al subir imagen: ${res.error}`, ok: false });
        }
      } catch (err: any) {
        setToast({ msg: `Error al subir imagen: ${err.message}`, ok: false });
      } finally {
        setSaving(false);
      }
    };
    input.click();
  };

  // Manejar cambio de firmante
  const handleFirmaUserChange = (val: string) => {
    setFirmaUserId(val === "bionordi" ? "bionordi" : Number(val));
    if (val === "bionordi") {
      setRecibidoPor(session?.user?.name || "");
      setEqTecnico(session?.user?.name || "");
    } else {
      const u = usuariosList.find(x => x.id === Number(val));
      if (u) {
        setRecibidoPor(u.nombre);
        setEqTecnico(u.nombre);
      }
    }
  };

  // Manejar accesorios checklist
  const toggleAccesorio = (acc: string) => {
    const isSelected = eqAccesorios.includes(acc);
    const next = isSelected
      ? eqAccesorios.filter(a => a !== acc)
      : [...eqAccesorios, acc];
    setEqAccesorios(next);
  };

  // Concatenar accesorios
  const getAccesoriosString = () => {
    const list = [...eqAccesorios];
    if (eqAccesoriosManual.trim()) {
      list.push(eqAccesoriosManual.trim());
    }
    return list.join(", ");
  };

  // Generar HTML para Puppeteer
  const buildPDFHtml = async (): Promise<{ html: string; folio: string }> => {
    const logoB64 = await fetchBase64("/LOGO_PRINCIPAL.png");
    
    // Formatear firmas
    let firmaClienteHTML = firmas.entrega ? `<img src="${firmas.entrega}" style="height: 45px; max-width: 180px; object-fit: contain; margin-bottom: -40px; margin-top: -45px; z-index: 10;" />` : '';
    let firmaTecnicoHTML = firmas.recibe ? `<img src="${firmas.recibe}" style="height: 45px; max-width: 180px; object-fit: contain; margin-bottom: -40px; margin-top: -45px; z-index: 10;" />` : '';

    const formatLongFecha = (fechaStr: string) => {
      if (!fechaStr) return '—';
      const f = new Date(fechaStr + "T00:00:00");
      if (isNaN(f.getTime())) return fechaStr;
      return f.toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const clausulasHTML = clausulas
      .split('\n')
      .filter((line: string) => line.trim() !== '')
      .map((line: string) => `<li>${line}</li>`)
      .join('');

    // Cargar evidencias fotográficas en base64 para Puppeteer
    let fotosRecepcionHTML = "";
    if (evidencias.length > 0) {
      const b64Evidencias = await Promise.all(
        evidencias.map(async (ev) => {
          try {
            const b64 = await fetchBase64(ev.b64);
            return b64;
          } catch {
            return ev.b64;
          }
        })
      );
      fotosRecepcionHTML = `
        <div class="tech-card avoid-break" style="margin-top: 10px; margin-bottom: 10px;">
          <div class="card-title" style="color: #B91C1C; border-bottom-color: #FECACA;">Evidencia Fotográfica de Recepción</div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
            ${b64Evidencias.map((b64, i) => `
              <div style="flex: 1; min-width: 100px; max-width: 140px; text-align: center;">
                <img src="${b64}" alt="Evidencia ${i + 1}" style="width: 100%; height: 80px; object-fit: contain; background: white; border: 1px solid #E2E8F0; border-radius: 6px;" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    let diagramaHTML = "";
    if (esTransductor) {
      const imgTrans = await fetchBase64("/transductor.png");
      diagramaHTML = `
        <div class="tech-card avoid-break" style="margin-top:10px;margin-bottom:10px;">
          <div class="card-title">Alcance Técnico y Diagnóstico Integral${eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}</div>
          <p class="diag-p" style="margin-bottom:8px;">Todo equipo ingresado a laboratorio es sometido a un <strong>diagnóstico técnico automatizado</strong>. Realizamos pruebas de pulso-eco, medición de capacitancia, análisis de cristales piezoeléctricos y revisión de fugas eléctricas para garantizar la seguridad del paciente y la resolución óptima de imagen.</p>
          <div style="display:flex;gap:20px;align-items:center;">
            <div style="flex:.8;border:1px solid #CBD5E1;border-radius:8px;background:#fff;padding:4px;height:148px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
              <div style="position:relative;display:inline-block;">
                <img src="${imgTrans}" alt="${[eqMarca, eqModelo].filter(Boolean).join(" ") || "Transductor"}" style="max-width:100%;max-height:140px;width:auto;height:auto;display:block;" />
                <div style="position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;top:25%;left:39%;margin-top:-10px;margin-left:-10px;">1</div>
                <div style="position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;top:20%;left:55%;margin-top:-10px;margin-left:-10px;">2</div>
                <div style="position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;top:68%;left:30%;margin-top:-10px;margin-left:-10px;">3</div>
                <div style="position:absolute;width:20px;height:20px;background:#4E60A9;color:#fff;border-radius:50%;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff;box-sizing:border-box;margin:0;top:88%;left:82%;margin-top:-10px;margin-left:-10px;">4</div>
              </div>
            </div>
            <div style="flex:1.2;display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;gap:8px;font-size:10px;color:#334155;line-height:1.4;align-items:flex-start;"><div style="width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;">1</div><div><strong>Lente Acústico / Membrana:</strong> Retiro del material desgastado, descontaminación del arreglo de cristales e inyección de nuevo polímero acústico con curado térmico.</div></div>
              <div style="display:flex;gap:8px;font-size:10px;color:#334155;line-height:1.4;align-items:flex-start;"><div style="width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;">2</div><div><strong>Carcasa y Sellado:</strong> Reencapsulado de uniones para evitar filtraciones de gel transmisor y proteger los componentes electrónicos internos.</div></div>
              <div style="display:flex;gap:8px;font-size:10px;color:#334155;line-height:1.4;align-items:flex-start;"><div style="width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;">3</div><div><strong>Cableado:</strong> Revisión de micro-coaxiales, verificación de continuidad eléctrica y refuerzo estructural en zonas de flexión y estrés mecánico.</div></div>
              <div style="display:flex;gap:8px;font-size:10px;color:#334155;line-height:1.4;align-items:flex-start;"><div style="width:18px;height:18px;background:#E5EAF7;color:#4E60A9;border-radius:50%;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;box-sizing:border-box;padding:0;">4</div><div><strong>Conector:</strong> Limpieza profunda de pines de contacto y prueba de impedancia de señal.</div></div>
            </div>
          </div>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Hoja de Recepción ${folio}</title>
        <style>
          @page { margin: 15mm 0 10mm 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #334155;
            background: #fff;
            font-size: 11px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            padding: 20px 55px;
            max-width: 816px;
            margin: 0 auto;
            display: flex;
            flex-direction: column;
            min-height: 255mm;
          }
          .text-muted { color: #94A3B8; }
          .b { font-weight: 700; }
          .c { text-align: center; }
          .r { text-align: right; }
          
          .hdr {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 8px;
          }
          .doc-title-container {
            text-align: right;
          }
          .doc-title {
            font-size: 16px;
            font-weight: 800;
            color: #4E60A9;
            letter-spacing: 1px;
            margin-bottom: 4px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: auto auto;
            gap: 2px 10px;
            justify-content: end;
            font-size: 10px;
          }
          .meta-lbl {
            font-weight: 700;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: .5px;
          }
          .meta-val {
            color: #1E293B;
            font-weight: 700;
          }
          
          .divider {
            height: 3px;
            background: linear-gradient(90deg, #4E60A9, #38AD64, #E2E8F0);
            border-radius: 3px;
            margin-bottom: 10px;
          }
          
          .info-section {
            display: flex;
            gap: 15px;
            margin-bottom: 8px;
          }
          .info-card {
            flex: 1;
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 12px;
          }
          .card-title {
            font-size: 9px;
            font-weight: 800;
            color: #4E60A9;
            text-transform: uppercase;
            letter-spacing: .8px;
            margin-bottom: 6px;
            border-bottom: 1.5px solid #E2E8F0;
            padding-bottom: 3px;
          }
          .i-row {
            display: flex;
            margin-bottom: 3px;
            font-size: 10px;
          }
          .i-lbl {
            width: 75px;
            color: #64748B;
            font-weight: 700;
          }
          .i-val {
            flex: 1;
            color: #1E293B;
            font-weight: 500;
          }
          
          .eq-card {
            background: #fff;
            border: 1px solid #CBD5E1;
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 8px;
            border-left: 3.5px solid #4E60A9;
          }
          .eq-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px 12px;
          }
          .eq-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .eq-lbl {
            font-size: 8px;
            color: #64748B;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .3px;
          }
          .eq-val {
            font-size: 10px;
            color: #0F172A;
            font-weight: 600;
          }
          .eq-full {
            grid-column: span 4;
            background: #F8FAFC;
            padding: 6px 10px;
            border-radius: 6px;
            border-left: 2px solid #64748B;
            margin-top: 3px;
          }
          
          .recep-card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 8px;
          }
          .recep-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }
          .recep-item {
            margin-bottom: 6px;
          }
          .recep-p {
            font-size: 10px;
            color: #475569;
            background: #fff;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
            padding: 6px 8px;
            margin-top: 2px;
            min-height: 24px;
          }
          
          .cond-section {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 8px;
            flex-grow: 1;
          }
          .cond-list {
            list-style: none;
            padding: 0;
            font-size: 8.5px;
            color: #475569;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .cond-list li {
            position: relative;
            padding-left: 12px;
            line-height: 1.3;
          }
          .cond-list li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #38AD64;
            font-weight: bold;
            font-size: 12px;
            top: -1px;
          }
          
          .signatures-wrapper {
            margin-top: auto;
            padding-top: 10px;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            gap: 40px;
            margin-bottom: 12px;
          }
          .sig-box {
            text-align: center;
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .sig-line {
            width: 100%;
            border-top: 1.5px solid #CBD5E1;
            margin-top: 35px;
            padding-top: 4px;
            position: relative;
          }
          .sig-name {
            font-size: 11px;
            font-weight: 800;
            color: #4E60A9;
          }
          .sig-role {
            font-size: 8.5px;
            font-weight: 600;
            color: #64748B;
            text-transform: uppercase;
            margin-top: 1px;
          }
          
          .tech-card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 12px;
            margin-top: 8px;
            margin-bottom: 8px;
          }
          .diag-p {
            font-size: 10px;
            color: #475569;
            line-height: 1.4;
            margin-bottom: 8px;
          }
          .footer {
            text-align: center;
            border-top: 1px solid #E2E8F0;
            padding-top: 6px;
            font-size: 8.5px;
            color: #94A3B8;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="page">
          
          <div class="hdr">
            <div>
              <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:44px; width:auto; display:block;" />
            </div>
            <div class="doc-title-container">
              <div class="doc-title">HOJA DE RECEPCIÓN</div>
              <div class="meta-grid">
                <div class="meta-lbl">Folio</div><div class="meta-val">${folio}</div>
                <div class="meta-lbl">Ingreso</div><div class="meta-val">${formatLongFecha(fechaIngreso)}</div>
                <div class="meta-lbl">Entrega Est.</div><div class="meta-val">${formatLongFecha(fechaCompromiso)}</div>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>

          <div class="info-section">
            <div class="info-card">
              <div class="card-title">Datos del Cliente</div>
              <div class="i-row"><div class="i-lbl">Institución</div><div class="i-val">${cliDatosFiscales || cliNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Atención a</div><div class="i-val">${cliContacto || cliNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Teléfono</div><div class="i-val">${cliTel}</div></div>
              <div class="i-row"><div class="i-lbl">Correo</div><div class="i-val">${cliCorreo}</div></div>
              <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${cliDireccion}</div></div>
            </div>
            
            <div class="info-card">
              <div class="card-title">Información de Recepción</div>
              <div class="i-row"><div class="i-lbl">Recepción</div><div class="i-val">${recibidoPor || "—"}</div></div>
              <div class="i-row"><div class="i-lbl">Entregado por</div><div class="i-val">${entregadoPor || "—"}</div></div>
              <div class="i-row">
                <div class="i-lbl">Costo Diag.</div>
                <div class="i-val b" style="color: #4E60A9;">
                  $${costoDiagnostico.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
                </div>
              </div>
              <div class="i-row"><div class="i-lbl">Estatus Inicial</div><div class="i-val"><span style="font-weight: 700; color: #5A85F1; text-transform: uppercase;">EQUIPO RECIBIDO</span></div></div>
            </div>
          </div>

          <div class="eq-card">
            <div class="card-title" style="border:none; padding:0; margin-bottom:6px;">Especificaciones del Equipo</div>
            <div class="eq-grid">
              <div class="eq-item"><div class="eq-lbl">Equipo / Sonda</div><div class="eq-val">${eqTipo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${eqMarca || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${eqModelo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Número de Serie</div><div class="eq-val" style="font-family: monospace;">${eqSerie || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Versión / SW</div><div class="eq-val">${eqVersion || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Año Fab.</div><div class="eq-val">${eqAno || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Área Médica</div><div class="eq-val">${eqArea || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Técnico Resp.</div><div class="eq-val">${eqTecnico || '—'}</div></div>
              
              ${getAccesoriosString() ? `
                <div class="eq-full" style="border-left-color: #4E60A9;">
                  <div class="eq-lbl">Accesorios Recibidos / Checklist</div>
                  <div class="eq-val" style="margin-top: 1px; font-weight: 500;">${getAccesoriosString()}</div>
                </div>
              ` : ''}
            </div>
          </div>

          <div class="recep-card">
            <div class="card-title">Falla Reportada y Estado Físico</div>
            <div class="recep-grid">
              <div class="recep-item">
                <div class="eq-lbl">Falla Reportada por el Cliente</div>
                <div class="recep-p">${(fallaReportada || 'Sin falla especificada').replace(/\n/g, '<br/>')}</div>
              </div>
              <div class="recep-item">
                <div class="eq-lbl">Estado Físico / Estético Visible de Recepción</div>
                <div class="recep-p">${(condicionRecepcion || 'Sin observaciones estéticas. El equipo presenta condiciones normales de uso.').replace(/\n/g, '<br/>')}</div>
              </div>
            </div>
          </div>

          ${diagramaHTML}
          
          ${fotosRecepcionHTML}

          <div class="cond-section">
            <div class="card-title">Términos y Condiciones del Servicio de Recepción</div>
            <ul class="cond-list">
              ${clausulasHTML}
            </ul>
          </div>

          <div class="signatures-wrapper">
            <div class="signatures">
              <div class="sig-box">
                ${firmaClienteHTML}
                <div class="sig-line"></div>
                <div class="sig-name">${entregadoPor}</div>
                <div class="sig-role">Entrega (Cliente / Representante)</div>
              </div>
              
              <div class="sig-box">
                ${firmaTecnicoHTML}
                <div class="sig-line"></div>
                <div class="sig-name">${recibidoPor}</div>
                <div class="sig-role">Recibe (Bionordi)</div>
              </div>
            </div>

            <div class="footer">
              <strong>Bionordi S.A. de C.V.</strong> | Reparación y Mantenimiento de Equipos de Ultrasonido y Transductores<br/>
              Este documento certifica el recibo del equipo en las condiciones estéticas y físicas detalladas.<br/>
              Bionordi · Ciudad de México · contacto@bionordi.mx
            </div>
          </div>

        </div>
      </body>
      </html>
    `;

    return { html, folio };
  };

  // Guardar en base de datos
  const persistToDB = async (usedFolio: string) => {
    const payload = {
      lead_id: leadId || null,
      datos_hospital: cliDatosFiscales || cliNombre || null,
      lead_nombre: cliContacto || cliNombre || null,
      direccion: cliDireccion || null,
      correo: cliCorreo || null,
      telefono: cliTel || null,
      datos_fiscales: cliDatosFiscales || null,

      equipo_tipo: eqTipo || null,
      equipo_marca: eqMarca || null,
      equipo_modelo: eqModelo || null,
      equipo_num_serie: eqSerie || null,
      equipo_version: eqVersion || null,
      equipo_ano: eqAno || null,
      equipo_area_medica: eqArea || null,
      tecnico: eqTecnico || null,
      accesorios_recibidos: getAccesoriosString() || null,

      falla_reportada: fallaReportada || null,
      condicion_recepcion: condicionRecepcion || null,
      costo_diagnostico: Number(costoDiagnostico) || 0,
      entregado_por: entregadoPor || null,
      recibido_por: recibidoPor || null,
      fecha_ingreso: fechaIngreso || null,
      fecha_compromiso: fechaCompromiso || null,
      clausulas_recepcion: clausulas || null,

      fotografias_json: JSON.stringify({
        actividades: evidencias.map(ev => ev.b64),
        resultado: fotosResultado
      }),

      firmas_json: JSON.stringify({
        entrega: firmas.entrega,
        recibe: firmas.recibe,
        entregado_por: entregadoPor,
        recibido_por: recibidoPor,
        firmaUserId
      }),
      status: "recibido",
      tipo_orden: "reparacion"
    };

    if (orderId) {
      await fetch("/api/ordenes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, ...payload })
      });
    } else {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folio: usedFolio, ...payload })
      });
      const d = await res.json();
      if (d.orden) {
        setOrderId(d.orden.id);
        setFolio(d.orden.folio);
        router.replace(`/taller/recepcion?id=${d.orden.id}`, { scroll: false });
      }
    }
  };

  const guardar = async () => {
    setSaveStatus("saving");
    try {
      await persistToDB(folio);
      setSaveStatus("ok");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  const generarPDF = async () => {
    setGenerating(true);
    try {
      const { html, folio: f } = await buildPDFHtml();
      await persistToDB(f);
      const b64 = await generarPDFBase64(html);
      setPdfViewerUrl(b64toBlobUrl(b64));
    } catch (err: any) {
      setToast({ msg: `Error al generar PDF: ${err.message}`, ok: false });
    } finally {
      setGenerating(false);
    }
  };

  const enviarEmail = async () => {
    if (!emailTo.trim()) {
      setToast({ msg: "Escribe un correo electrónico.", ok: false });
      return;
    }
    setEmailStatus("sending");
    try {
      const { html, folio: f } = await buildPDFHtml();
      await persistToDB(f);
      
      const mailHtml = `
        <h3>Estimado(a) ${cliContacto || cliNombre},</h3>
        <p>Confirmamos la recepción de su equipo médico en nuestro laboratorio de Bionordi.</p>
        <p>Adjunto a este correo encontrará su <b>Hoja de Recepción</b> con el número de folio <b>${folio}</b>, que detalla las especificaciones del equipo, los accesorios entregados, la falla reportada y las firmas correspondientes.</p>
        <p>Nuestro equipo de ingenieros biomédicos procederá con la evaluación técnica para enviarle un presupuesto de servicio a la brevedad.</p>
        <br/>
        <p>Atentamente,</p>
        <p><b>Bionordi Medical Technology</b><br/>contacto@bionordi.mx · CDMX</p>
      `;

      const response = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          subject: `Hoja de Recepción - Folio ${folio} | Bionordi`,
          html: mailHtml
        })
      });

      const d = await response.json();
      if (d.error) throw new Error(d.error);
      
      setEmailStatus("ok");
      setToast({ msg: `Correo enviado a ${emailTo}`, ok: true });
      setTimeout(() => setEmailStatus("idle"), 3000);
    } catch (err: any) {
      setEmailStatus("error");
      setToast({ msg: `Error al enviar correo: ${err.message}`, ok: false });
      setTimeout(() => setEmailStatus("idle"), 3000);
    }
  };

  // Sugerencias de Leads y Catálogo
  const leadsMatches = leadSearch.length > 1
    ? leadsList.filter(l => l.nombre.toLowerCase().includes(leadSearch.toLowerCase()) || (l.ciudad || "").toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 6)
    : [];

  const catalogoMatches = catalogoSearch.length > 1
    ? catalogo.filter(c => c.modelo.toLowerCase().includes(catalogoSearch.toLowerCase()) || (c.marca || "").toLowerCase().includes(catalogoSearch.toLowerCase())).slice(0, 6)
    : [];

  const formatShortFecha = (fechaStr: string) => {
    if (!fechaStr) return '—';
    const f = new Date(fechaStr + "T00:00:00");
    if (isNaN(f.getTime())) return fechaStr;
    return f.toLocaleDateString("es-MX", { day: '2-digit', month: 'short' });
  };

  return (
    <div className="flex-1 flex flex-row overflow-hidden" style={{ height: "100vh", fontFamily: "'Helvetica Neue',Helvetica,Arial,sans-serif", background: "#F4F7FB" }}>
      
      {/* ════════════ PANEL DE CONTROL IZQUIERDO ════════════ */}
      <div style={{
        width: sidebarCollapsed ? "0px" : "340px",
        minWidth: sidebarCollapsed ? "0px" : "340px",
        maxWidth: sidebarCollapsed ? "0px" : "340px",
        height: "100%",
        background: "#FFFFFF",
        borderRight: sidebarCollapsed ? "none" : "1px solid #E2E8F0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "width 0.3s ease, min-width 0.3s ease, max-width 0.3s ease",
        zIndex: 110
      }}>
        {/* Header control */}
        <div style={{ flexShrink: 0, padding: "16px", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          <div style={{ fontSize: "11px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>
            Panel de Control
          </div>
          <div style={{ fontSize: "9px", color: "#64748B", marginTop: "2px" }}>
            Edita los campos aquí o directamente en el formato de papel.
          </div>
        </div>

        {/* Scrollable controls */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "16px", background: "#F4F7FB" }}>
          
          {/* 1. Datos del Cliente */}
          <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div
              onClick={() => setCollCliente(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>1. Buscador de Clientes</div>
              <div style={{ color: "#64748B" }}>
                {collCliente ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            {!collCliente && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ position: "relative" }}>
                  {leadId ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", background: "#EEF3FC", border: "1px solid #C7D6F5", borderRadius: "8px" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{cliNombre}</div>
                        <div style={{ fontSize: "9px", color: "#64748B", marginTop: "1px" }}>Vinculado al CRM</div>
                      </div>
                      <button onClick={() => { setLeadId(null); setLeadSearch(""); }} style={{ fontSize: "9px", color: "#EF4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Desvincular</button>
                    </div>
                  ) : (
                    <>
                      <input
                        value={leadSearch}
                        onChange={e => setLeadSearch(e.target.value)}
                        placeholder="🔍 Buscar cliente en CRM..."
                        style={{ width: "100%", fontSize: "11px", border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "8px 12px", outline: "none", background: "#FFFFFF", color: "#1E293B" }}
                      />
                      {leadsMatches.length > 0 && (
                        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 110, overflow: "hidden", marginTop: "4px" }}>
                          {leadsMatches.map(l => (
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

          {/* 2. Buscador del Catálogo */}
          <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div
              onClick={() => setCollEquipo(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>2. Catálogo de Equipos</div>
              <div style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "6px" }}>
                {collEquipo ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            {!collEquipo && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {/* Mode toggle */}
                <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "2px", borderRadius: "8px" }}>
                  {(["catalogo", "manual"] as const).map(mode => (
                    <button key={mode} onClick={() => {
                      setEquipoMode(mode);
                      if (mode === "manual") { setEqMarca(""); setEqModelo(""); }
                    }}
                      style={{ flex: 1, padding: "4px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, border: "none", cursor: "pointer", background: equipoMode === mode ? "#FFFFFF" : "transparent", color: equipoMode === mode ? "#4E60A9" : "#94A3B8", boxShadow: equipoMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                      {mode === "catalogo" ? "Catálogo" : "Manual"}
                    </button>
                  ))}
                </div>

                {equipoMode === "catalogo" && (
                  <div style={{ position: "relative" }}>
                    <input
                      value={catalogoSearch}
                      onChange={e => setCatalogoSearch(e.target.value)}
                      placeholder="🔍 Buscar modelo en Catálogo..."
                      style={{ width: "100%", fontSize: "11px", border: "1px dashed #CBD5E1", borderRadius: "8px", padding: "8px 12px", outline: "none", background: "#FFFFFF", color: "#1E293B" }}
                    />
                    {catalogoMatches.length > 0 && (
                      <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 110, overflow: "hidden", marginTop: "4px" }}>
                        {catalogoMatches.map(c => (
                          <button key={c.id} onClick={() => seleccionarDelCatalogo(c)}
                            style={{ width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", borderBottom: "1px solid #F1F5F9", cursor: "pointer", fontSize: "11px", color: "#1E293B", display: "block" }}>
                            <div style={{ fontWeight: 700 }}>{c.marca} {c.modelo}</div>
                            <div style={{ fontSize: "9px", color: "#64748B" }}>{c.tipo}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Accesorios predefinidos */}
                <div style={{ marginTop: "6px" }}>
                  <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "6px" }}>CHECKLIST DE ACCESORIOS</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "5px" }}>
                    {ACCESORIOS_PRESET.map(acc => {
                      const isSelected = eqAccesorios.includes(acc);
                      return (
                        <label key={acc} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "#334155", background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "5px 8px", borderRadius: "6px", cursor: "pointer" }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleAccesorio(acc)} className="accent-[#4E60A9]" />
                          <span>{acc}</span>
                        </label>
                      );
                    })}
                  </div>
                  <input
                    value={eqAccesoriosManual}
                    onChange={e => setEqAccesoriosManual(e.target.value)}
                    placeholder="Otros accesorios (manual)..."
                    style={{ width: "100%", fontSize: "10.5px", border: "1px solid #CBD5E1", borderRadius: "6px", padding: "6px 8px", marginTop: "8px", outline: "none", color: "#1E293B" }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 3. Evidencia Fotográfica */}
          <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div
              onClick={() => setCollRecepcion(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>3. Evidencia de Recepción</div>
              <div style={{ color: "#64748B" }}>
                {collRecepcion ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            {!collRecepcion && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {evidencias.map((ev, i) => (
                    <div key={i} style={{ position: "relative", width: "70px", height: "70px", border: "1px solid #E2E8F0", borderRadius: "6px", overflow: "hidden" }}>
                      <img src={ev.b64} alt="ev" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => setEvidencias(p => p.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: "2px", right: "2px", width: "14px", height: "14px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>×</button>
                    </div>
                  ))}
                  <button onClick={() => uploadImage(path => setEvidencias(p => [...p, { b64: path, caption: "" }]))}
                    style={{ width: "70px", height: "70px", border: "2px dashed #CBD5E1", borderRadius: "6px", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Condiciones y Cláusulas */}
          <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div
              onClick={() => setCollClausulas(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>4. Cláusulas del Contrato</div>
              <div style={{ color: "#64748B" }}>
                {collClausulas ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            {!collClausulas && (
              <div style={{ marginTop: "12px" }}>
                <textarea
                  value={clausulas}
                  onChange={e => setClausulas(e.target.value)}
                  rows={8}
                  style={{ width: "100%", fontSize: "10px", lineHeight: "1.4", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "8px", outline: "none", background: "#FFFFFF", color: "#334155", resize: "none", fontFamily: "inherit" }}
                />
              </div>
            )}
          </div>

          {/* 5. Firmas Digitales */}
          <div style={{ background: "#FFFFFF", padding: "14px", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" }}>
            <div
              onClick={() => setCollFirmas(p => !p)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ fontSize: "10.5px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "1px" }}>5. Firmas Digitales</div>
              <div style={{ color: "#64748B" }}>
                {collFirmas ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
            </div>

            {!collFirmas && (
              <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ marginBottom: "6px" }}>
                  <label style={{ fontSize: "9px", color: "#64748B", fontWeight: 700, display: "block", marginBottom: "4px" }}>REPRESENTANTE / EMPLEADO</label>
                  <select value={String(firmaUserId)} onChange={e => handleFirmaUserChange(e.target.value)}
                    style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: "6px", outline: "none", fontSize: "11px", fontWeight: 600, color: "#1E293B", width: "100%", cursor: "pointer", fontFamily: "inherit", padding: "6px 10px" }}>
                    <option value="bionordi">{session?.user?.name || "Representante Bionordi"}</option>
                    {usuariosList.map(u => <option key={u.id} value={String(u.id)}>{u.nombre} — {u.cargo || "Ejecutivo"}</option>)}
                  </select>
                </div>
                <SignaturePad
                  label={`Firma Cliente: ${entregadoPor || "Entrega"}`}
                  defaultValue={firmas.entrega}
                  onSave={b64 => setFirmas(p => ({ ...p, entrega: b64 }))}
                  onClear={() => setFirmas(p => ({ ...p, entrega: "" }))}
                />
                <SignaturePad
                  label={`Firma Bionordi: ${recibidoPor || "Recibe"}`}
                  defaultValue={firmas.recibe}
                  onSave={b64 => setFirmas(p => ({ ...p, recibe: b64 }))}
                  onClear={() => setFirmas(p => ({ ...p, recibe: "" }))}
                />
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ════════════ PREVISUALIZADOR LIVE DERECHO (HOJA DE PAPEL DIGITAL) ════════════ */}
      <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", background: "#D8DDE4", overflow: "hidden" }}>
        
        {/* Action Top Bar */}
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
          {/* Volver / Sidebar */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={() => router.push("/taller")} 
              style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
            >
              <ArrowLeft size={14} /> Volver a Taller
            </button>

            <button onClick={() => setSidebarCollapsed(p => !p)} 
              style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #E2E8F0", background: sidebarCollapsed ? "#FFFFFF" : "#F1F5F9", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              {sidebarCollapsed ? "Mostrar Ajustes" : "Ocultar Ajustes"}
            </button>
          </div>

          {/* Guardar, Enviar, PDF */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>
            {saveStatus === "ok" && <span style={{ color: "#10B981", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> Guardado</span>}
            {saveStatus === "error" && <span style={{ color: "#EF4444", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}><AlertCircle size={14} /> Error</span>}

            <button onClick={guardar} disabled={saveStatus === "saving"} 
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#1E293B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
            >
              {saveStatus === "saving" ? <Loader2 size={14} className="animate-spin text-[#4E60A9]" /> : <Save size={14} className="text-[#64748B]" />}
              Guardar Recepción
            </button>

            {/* Enviar por correo */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowEmail(p => !p)} 
                style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "1px solid #CBD5E1", background: showEmail ? "#F1F5F9" : "#FFFFFF", color: "#64748B", cursor: "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700 }} 
              >
                <Mail size={14} /> Enviar
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

            <button onClick={generarPDF} disabled={generating} 
              style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px", borderRadius: "8px", border: "none", background: generating ? "#3B4DA0" : "#4E60A9", color: "#fff", cursor: generating ? "not-allowed" : "pointer", transition: "all 0.2s", fontSize: "11px", fontWeight: 700, boxShadow: "0 4px 10px rgba(78,96,169,0.2)" }} 
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Paper scrollable workspace */}
        <div style={{ flex: 1, overflowY: "auto", padding: "30px 20px 80px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          
          {loadingQuote ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", justifyContent: "center", height: "80vh" }}>
              <Loader2 size={32} className="animate-spin text-[#4E60A9]" />
              <span style={{ fontSize: "13px", color: "#64748B", fontWeight: 700 }}>Cargando Hoja de Recepción...</span>
            </div>
          ) : (
            <div style={{ width: "816px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "12px" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#4E60A9", letterSpacing: "0.5px" }}>VISTA PREVIA INTERACTIVA (HOJA DE INGRESO)</span>
                <span style={{ fontSize: "10px", fontWeight: 600, color: "#94A3B8" }}>Carta 8.5" x 11" · Edición inline directa</span>
              </div>

              {/* ───── HOJA CARTA (Dinámica y auto-expandible) ───── */}
              <div style={{
                background: "#fff",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                borderRadius: "4px",
                paddingTop: "30px",
                paddingRight: "65px",
                paddingBottom: "50px",
                paddingLeft: "65px",
                position: "relative",
                width: "816px",
                minHeight: "1056px",
                height: "auto",
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start"
              }}>
                
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "8px" }}>
                  <div><img src="/LOGO_PRINCIPAL.png" alt="Bionordi" style={{ height: "44px", width: "auto", display: "block" }} /></div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#4E60A9", letterSpacing: "1px", marginBottom: "4px" }}>HOJA DE RECEPCIÓN</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "2px 10px", justifyContent: "end", fontSize: "10px" }}>
                      <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Folio</div>
                      <div style={{ color: "#1E293B", fontWeight: 700 }}>{folio}</div>
                      <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Ingreso</div>
                      <div style={{ color: "#1E293B", fontWeight: 500 }}>
                        <F value={fechaIngreso} onChange={setFechaIngreso} placeholder="YYYY-MM-DD" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "none" }} />
                      </div>
                      <div style={{ fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px" }}>Entrega Est.</div>
                      <div style={{ color: "#1E293B", fontWeight: 500 }}>
                        <F value={fechaCompromiso} onChange={setFechaCompromiso} placeholder="Seleccionar fecha" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "none" }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ height: "3px", background: "linear-gradient(90deg, #4E60A9, #38AD64, #E2E8F0)", borderRadius: "3px", marginBottom: "10px" }} />

                {/* Cliente / Datos recepción */}
                <div style={{ display: "flex", gap: "15px", marginBottom: "8px" }}>
                  
                  {/* Datos Cliente */}
                  <div 
                    onClick={() => expandCardOnly("cliente")}
                    style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 12px", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px", borderBottom: "1.5px solid #E2E8F0", paddingBottom: "3px" }}>Datos del Cliente</div>
                    
                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Institución</div>
                      <div style={{ flex: 1 }}><F value={cliDatosFiscales} onChange={setCliDatosFiscales} placeholder="Nombre del hospital o clínica" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>
                    
                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Atención a</div>
                      <div style={{ flex: 1 }}><F value={cliContacto} onChange={setCliContacto} placeholder="Contacto administrativo" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>
                    
                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Teléfono</div>
                      <div style={{ flex: 1 }}><F value={cliTel} onChange={setCliTel} placeholder="Número telefónico" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>

                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Correo</div>
                      <div style={{ flex: 1 }}><F value={cliCorreo} onChange={setCliCorreo} placeholder="Correo electrónico" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>

                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Dirección</div>
                      <div style={{ flex: 1 }}><F value={cliDireccion} onChange={setCliDireccion} placeholder="Dirección completa" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>
                  </div>

                  {/* Datos de Recepción */}
                  <div 
                    onClick={() => expandCardOnly("firmas")}
                    style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 12px", cursor: "pointer" }}
                  >
                    <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px", borderBottom: "1.5px solid #E2E8F0", paddingBottom: "3px" }}>Información de Recepción</div>
                    
                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Recepción</div>
                      <div style={{ flex: 1 }}><F value={recibidoPor} onChange={setRecibidoPor} placeholder="Nombre de quien recibe" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>

                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Entregado por</div>
                      <div style={{ flex: 1 }}><F value={entregadoPor} onChange={setEntregadoPor} placeholder="Nombre de quien entrega" style={{ borderBottom: "1px dashed rgba(78,96,169,0.15)" }} /></div>
                    </div>

                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Costo Diag.</div>
                      <div style={{ flex: 1, color: "#4E60A9", fontWeight: 700, display: "flex", gap: "2px" }}>
                        <span>$</span>
                        <input
                          type="number"
                          value={costoDiagnostico}
                          onChange={e => setCostoDiagnostico(Number(e.target.value) || 0)}
                          onClick={e => e.stopPropagation()}
                          style={{ border: "none", outline: "none", fontSize: "10px", fontWeight: 700, background: "transparent", color: "inherit", width: "80px", borderBottom: "1px dashed rgba(78,96,169,0.15)" }}
                        />
                        <span>MXN</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", marginBottom: "3px", fontSize: "10px" }}>
                      <div style={{ width: "75px", color: "#64748B", fontWeight: 700 }}>Estatus</div>
                      <div style={{ flex: 1, fontWeight: 700, color: "#5A85F1", textTransform: "uppercase" }}>EQUIPO RECIBIDO</div>
                    </div>
                  </div>
                </div>

                {/* Especificaciones Equipo */}
                <div 
                  onClick={() => expandCardOnly("equipo")}
                  style={{ background: "#fff", border: "1px solid #CBD5E1", borderRadius: "10px", padding: "8px 12px", marginBottom: "8px", borderLeft: "3.5px solid #4E60A9", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px" }}>Especificaciones del Equipo</div>
                    {/* Selector rápido Catálogo / Manual */}
                    <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "6px" }} onClick={e => e.stopPropagation()}>
                      {(["catalogo", "manual"] as const).map(mode => (
                        <button key={mode} onClick={() => {
                          setEquipoMode(mode);
                          if (mode === "manual") { setEqMarca(""); setEqModelo(""); }
                        }}
                          style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "8px", fontWeight: 700, border: "none", cursor: "pointer", background: equipoMode === mode ? "#fff" : "transparent", color: equipoMode === mode ? "#4E60A9" : "#94A3B8", boxShadow: equipoMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                          {mode === "catalogo" ? "Catálogo" : "Manual"}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px 12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Equipo / Sonda</div>
                      <div>
                        <select value={eqTipo} onChange={e => { setEqTipo(e.target.value); setEqMarca(""); setEqModelo(""); }} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "10px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer", fontFamily: "inherit" }}>
                          <option value="">— Seleccionar —</option>
                          {["Transductor Lineal", "Transductor Convex", "Transductor Sectorial", "Transductor Intracavitario", "Transductor TEE", "Transductor 3D/4D", "Transductor Microconvex", "Sistema de Ultrasonido", "Otro"].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Marca</div>
                      <div>
                        {equipoMode === "catalogo" && marcasUnicas.length > 0 ? (
                          <select value={eqMarca} onChange={e => { setEqMarca(e.target.value); setEqModelo(""); }} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "10px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer", fontFamily: "inherit" }}>
                            <option value="">— Seleccionar —</option>
                            {marcasUnicas.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (
                          <F value={eqMarca} onChange={setEqMarca} placeholder="GE, Philips..." />
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Modelo</div>
                      <div>
                        {equipoMode === "catalogo" && modelosPorMarca.length > 0 ? (
                          <select value={eqModelo} onChange={e => {
                            const found = catalogoFiltrado.find(t => t.modelo === e.target.value && (!eqMarca || t.marca === eqMarca));
                            setEqModelo(e.target.value);
                            if (found) seleccionarDelCatalogo(found);
                          }} style={{ background: "transparent", border: "none", borderBottom: "1.5px dashed rgba(78,96,169,0.25)", outline: "none", fontSize: "10px", fontWeight: 600, color: "#0F172A", width: "100%", cursor: "pointer", fontFamily: "inherit" }}>
                            <option value="">— Seleccionar —</option>
                            {modelosPorMarca.map(e => <option key={e.id} value={e.modelo}>{e.modelo}</option>)}
                          </select>
                        ) : (
                          <F value={eqModelo} onChange={setEqModelo} placeholder="Modelo" />
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>No. Serie</div>
                      <div><F value={eqSerie} onChange={setEqSerie} placeholder="No. de Serie" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "1px dashed rgba(0,0,0,0.1)", fontFamily: "monospace" }} /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Versión / SW</div>
                      <div><F value={eqVersion} onChange={setEqVersion} placeholder="Ej. v1.2" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "1px dashed rgba(0,0,0,0.1)" }} /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Año Fab.</div>
                      <div><F value={eqAno} onChange={setEqAno} placeholder="Año de Fab." style={{ fontSize: "10px", fontWeight: 600, borderBottom: "1px dashed rgba(0,0,0,0.1)" }} /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Área Médica</div>
                      <div><F value={eqArea} onChange={setEqArea} placeholder="Ej. Cardiología" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "1px dashed rgba(0,0,0,0.1)" }} /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Técnico Resp.</div>
                      <div><F value={eqTecnico} onChange={setEqTecnico} placeholder="Técnico" style={{ fontSize: "10px", fontWeight: 600, borderBottom: "1px dashed rgba(0,0,0,0.1)" }} /></div>
                    </div>
                    
                    <div style={{ gridColumn: "span 4", background: "#F8FAFC", padding: "6px 10px", borderRadius: "6px", borderLeft: "2px solid #64748B", marginTop: "3px" }}>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Accesorios Recibidos / Checklist</div>
                      <div style={{ fontSize: "10px", fontWeight: 500, color: "#0F172A", marginTop: "1px" }}>
                        {getAccesoriosString() || "— (Ninguno seleccionado. Edítalos en el panel de control o checklist)"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalles Diagnostico */}
                <div 
                  onClick={() => expandCardOnly("recepcion")}
                  style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 12px", marginBottom: "8px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Falla Reportada y Estado Físico</div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Falla Reportada por el Cliente</div>
                      <F value={fallaReportada} onChange={setFallaReportada} placeholder="Escribe la falla que describe el doctor..." multiline={true} rows={2} style={{ fontSize: "10px", borderBottom: "none", background: "#FFFFFF", padding: "6px 8px", border: "1px solid #E2E8F0", borderRadius: "6px", marginTop: "2px" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "8px", color: "#64748B", fontWeight: 800, textTransform: "uppercase" }}>Estado Físico / Estético Visible de Recepción</div>
                      <F value={condicionRecepcion} onChange={setCondicionRecepcion} placeholder="Escribe observaciones cosméticas (ej. lente rayado, grietas en mango)..." multiline={true} rows={2} style={{ fontSize: "10px", borderBottom: "none", background: "#FFFFFF", padding: "6px 8px", border: "1px solid #E2E8F0", borderRadius: "6px", marginTop: "2px" }} />
                    </div>
                  </div>
                </div>

                {/* Diagrama Técnico (Si es Transductor) */}
                {esTransductor && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px", borderBottom: "2px solid #E2E8F0", paddingBottom: "4px" }}>
                      Alcance Técnico y Diagnóstico Integral{eqMarca || eqModelo ? ` — ${[eqMarca, eqModelo].filter(Boolean).join(" ")}` : ""}
                    </div>
                    <p style={{ fontSize: "10px", color: "#475569", lineHeight: "1.4", marginBottom: "8px" }}>
                      Todo transductor ingresado es diagnosticado en lente, carcasa, cableado y conector para garantizar la integridad acústica y seguridad eléctrica.
                    </p>
                    <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                      <div style={{ flex: "0 0 auto", width: "150px", height: "130px", border: "1px solid #CBD5E1", borderRadius: "8px", background: "#fff", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <img src="/transductor.png" alt="Diagrama Transductor" style={{ maxWidth: "100%", maxHeight: "120px", objectFit: "contain" }} />
                        {[{ top: "25%", left: "39%", n: 1 }, { top: "20%", left: "55%", n: 2 }, { top: "68%", left: "30%", n: 3 }, { top: "88%", left: "82%", n: 4 }].map(({ top, left, n }) => (
                          <div key={n} style={{ position: "absolute", top, left, transform: "translate(-50%,-50%)", width: "16px", height: "16px", background: "#4E60A9", color: "#fff", borderRadius: "50%", fontSize: "9px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #fff" }}>{n}</div>
                        ))}
                      </div>
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                        {[
                          { n: 1, title: "Lente Acústico:", text: "Protección e integridad del haz piezoeléctrico." },
                          { n: 2, title: "Carcasa / Sellado:", text: "Evita filtración de gel y aisla corrientes." },
                          { n: 3, title: "Cable coaxial:", text: "Verificación de continuidad en multiconductores." },
                          { n: 4, title: "Conector y Pines:", text: "Limpieza y descarte de ruido en canales." },
                        ].map(({ n, title, text }) => (
                          <div key={n} style={{ display: "flex", gap: "6px", fontSize: "9.5px", color: "#334155", lineHeight: "1.3", alignItems: "flex-start" }}>
                            <div style={{ width: "14px", height: "14px", background: "#E5EAF7", color: "#4E60A9", borderRadius: "50%", fontSize: "8px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>{n}</div>
                            <div><strong>{title}</strong> {text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidencia Fotográfica (Editable inline) */}
                <div 
                  onClick={() => expandCardOnly("recepcion")}
                  style={{ background: "#F8FAFC", border: "1px solid #FECACA", borderRadius: "10px", padding: "8px 12px", marginBottom: "8px", cursor: "pointer" }}
                >
                  <div style={{ fontSize: "9px", fontWeight: 800, color: "#B91C1C", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Evidencia Fotográfica de Recepción</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
                    {evidencias.map((ev, i) => (
                      <div key={i} style={{ position: "relative", flex: "0 0 auto", width: "135px" }} onClick={e => e.stopPropagation()}>
                        <img src={ev.b64} alt={`ev${i}`} style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "6px", border: "1px solid #FECACA", display: "block" }} />
                        <button onClick={(e) => { e.stopPropagation(); setEvidencias(p => p.filter((_, j) => j !== i)); }}
                          style={{ position: "absolute", top: "3px", right: "3px", width: "16px", height: "16px", background: "#EF4444", color: "#fff", border: "none", borderRadius: "50%", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>×</button>
                        <input value={ev.caption} onChange={e => setEvidencias(p => p.map((x, j) => j === i ? { ...x, caption: e.target.value } : x))}
                          placeholder={`Describir foto ${i + 1}...`}
                          style={{ width: "100%", marginTop: "4px", fontSize: "9px", border: "1px solid #FECACA", borderRadius: "4px", padding: "2px 4px", outline: "none", color: "#7F1D1D", background: "#FFF5F5" }} />
                      </div>
                    ))}
                    <button onClick={(e) => { e.stopPropagation(); uploadImage(path => setEvidencias(p => [...p, { b64: path, caption: "" }])); }}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", width: "100px", height: "100px", border: "2px dashed #FECACA", borderRadius: "8px", background: "transparent", cursor: "pointer", color: "#B91C1C", fontSize: "9px", fontWeight: 700 }}>
                      <Plus size={14} /> Cargar foto
                    </button>
                  </div>
                </div>

                {/* Clausulas */}
                <div 
                  onClick={() => expandCardOnly("clausulas")}
                  style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 12px", marginBottom: "8px", flexGrow: 1, display: "flex", flexDirection: "column", cursor: "pointer" }}
                >
                  <div style={{ fontSize: "9px", fontWeight: 800, color: "#4E60A9", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>Términos y Condiciones del Servicio de Recepción</div>
                  <ul style={{ listStyle: "none", padding: 0, fontSize: "8px", color: "#475569", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {clausulas.split('\n').filter(l => l.trim() !== '').map((line, idx) => (
                      <li key={idx} style={{ position: "relative", paddingLeft: "12px", lineHeight: "1.3" }}>
                        <span style={{ position: "absolute", left: 0, color: "#38AD64", fontWeight: "bold" }}>•</span>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Firmas */}
                <div 
                  onClick={() => expandCardOnly("firmas")}
                  style={{ marginTop: "auto", paddingTop: "5px", cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "40px", marginBottom: "6px" }}>
                    <div style={{ alignSelf: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {firmas.entrega ? <img src={firmas.entrega} alt="Firma entrega" style={{ height: "45px", maxWidth: "180px", objectFit: "contain", marginBottom: "-40px", marginTop: "-15px", zIndex: 10 }} /> : <div style={{ height: "30px" }} />}
                      <div style={{ width: "100%", borderTop: "1.5px solid #CBD5E1", marginTop: "10px", paddingTop: "4px", textAlign: "center" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9" }}>{entregadoPor || "—"}</div>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Entrega (Cliente / Representante)</div>
                      </div>
                    </div>

                    <div style={{ alignSelf: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      {firmas.recibe ? <img src={firmas.recibe} alt="Firma recibe" style={{ height: "45px", maxWidth: "180px", objectFit: "contain", marginBottom: "-40px", marginTop: "-15px", zIndex: 10 }} /> : <div style={{ height: "30px" }} />}
                      <div style={{ width: "100%", borderTop: "1.5px solid #CBD5E1", marginTop: "10px", paddingTop: "4px", textAlign: "center" }}>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "#4E60A9" }}>{recibidoPor || "—"}</div>
                        <div style={{ fontSize: "8px", fontWeight: 600, color: "#64748B", textTransform: "uppercase" }}>Recibe (Bionordi)</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", borderTop: "1px solid #E2E8F0", paddingTop: "6px", fontSize: "8px", color: "#94A3B8", lineHeight: "1.4" }}>
                    <strong>Bionordi S.A. de C.V.</strong> | Reparación y Mantenimiento de Equipos de Ultrasonido y Transductores<br/>
                    Este documento certifica el recibo del equipo en las condiciones estéticas y físicas detalladas. CDMX
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* PDF Viewer overlay */}
      {pdfViewerUrl && (
        <DocumentViewerModal
          title={`Hoja de Recepción — ${folio}`}
          url={pdfViewerUrl}
          downloadName={`Recepcion_${folio}.pdf`}
          onClose={() => setPdfViewerUrl(null)}
        />
      )}

    </div>
  );
}
