import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs, { existsSync } from 'fs';
import path from 'path';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { CLAUSULAS_RECEPCION_DEFAULT } from '@/lib/recepcion';

const SYSTEM_CHROMIUM_PATHS = [
  process.env.CHROMIUM_PATH,
  '/run/current-system/sw/bin/chromium',  // Railway/Nixpacks
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];

async function getChromiumExecPath(): Promise<string> {
  for (const p of SYSTEM_CHROMIUM_PATHS) {
    if (p && existsSync(p)) return p;
  }
  return await chromium.executablePath();
}

// Cola de concurrencia simple
let activeRenders = 0;
const renderQueue: (() => void)[] = [];

async function acquireQueueSlot(): Promise<void> {
  if (activeRenders < 1) {
    activeRenders++;
    return;
  }
  return new Promise<void>((resolve) => {
    renderQueue.push(resolve);
  });
}

function releaseQueueSlot(): void {
  activeRenders--;
  if (renderQueue.length > 0) {
    activeRenders++;
    const next = renderQueue.shift();
    if (next) next();
  }
}

function formatearFecha(fecha: string) {
  if (!fecha) return '—';
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return fecha;
  return f.toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' });
}

function parseState(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    if (val.startsWith('[') && val.endsWith(']')) {
      try {
        return JSON.parse(val);
      } catch { /* ignore */ }
    }
    return [val];
  }
  return [];
}

const CLAUSULAS_DEFAULT = CLAUSULAS_RECEPCION_DEFAULT;

export async function GET(req: Request) {
  // La hoja contiene datos personales del cliente — requiere sesión
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  await acquireQueueSlot();

  let browser: any = null;
  let page: any = null;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      // releaseQueueSlot lo hace el finally — liberar aquí duplicaría el slot
      return NextResponse.json({ error: 'Falta id' }, { status: 400 });
    }

    const orden: any = db.prepare(`
      SELECT o.*,
             l.nombre  AS lead_nombre,
             l.telefono AS lead_telefono,
             l.correo  AS lead_correo,
             l.ciudad  AS lead_ciudad,
             l.direccion AS lead_direccion
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.id = ?
    `).get(id);

    if (!orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    // Folio propio de la Hoja de Recepción. Las órdenes creadas antes de existir
    // esta serie no lo tienen: caen al folio de la orden para no alterar
    // documentos ya emitidos.
    const folioRecepcion = orden.folio_recepcion || orden.folio;

    const clienteNombre = orden.lead_nombre || "Sin nombre";
    const direccion = orden.direccion || orden.lead_direccion || "—";
    const telefono = orden.telefono || orden.lead_telefono || "—";
    const correo = orden.correo || orden.lead_correo || "—";

    const fechaIngreso = formatearFecha(orden.fecha_ingreso);
    const fechaCompromiso = formatearFecha(orden.fecha_compromiso);

    const logoPath = path.join(process.cwd(), 'public', 'LOGO_PRINCIPAL.png');
    let logoB64 = '';
    try {
      logoB64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
    } catch { /* ignore */ }



    // Cargar firmas y estados de checklist
    let firmaCliente = '';
    let firmaTecnico = '';
    let entregadoPor = orden.entregado_por || clienteNombre;
    let recibidoPor = orden.recibido_por || orden.tecnico || 'Bionordi';
    const costoDiagnostico = typeof orden.costo_diagnostico === 'number' ? orden.costo_diagnostico : 1500;

    let conectorState: string[] = [];
    let carcasaState: string[] = [];
    let cableState: string[] = [];
    let cristalesState: string[] = [];
    let observacionesAdicionales = '';
    let motivoIngreso = '';
    let motivoOtro = '';
    let accesoriosEntregados: string[] = [];
    let accesoriosOtro = '';
    let firmaUserId: string | number = 'bionordi';

    if (orden.firmas_json) {
      try {
        const parsed = JSON.parse(orden.firmas_json);
        firmaCliente = parsed.entrega || '';
        firmaTecnico = parsed.recibe || '';
        if (parsed.entregado_por) entregadoPor = parsed.entregado_por;
        if (parsed.recibido_por) recibidoPor = parsed.recibido_por;
        if (parsed.firmaUserId) firmaUserId = parsed.firmaUserId;
        if (parsed.conector) conectorState = parseState(parsed.conector);
        if (parsed.carcasa) carcasaState = parseState(parsed.carcasa);
        if (parsed.cable) cableState = parseState(parsed.cable);
        if (parsed.cristales) cristalesState = parseState(parsed.cristales);
        if (parsed.observacionesAdicionales !== undefined) observacionesAdicionales = parsed.observacionesAdicionales;
        if (parsed.motivoIngreso !== undefined) motivoIngreso = parsed.motivoIngreso;
        if (parsed.motivoOtro !== undefined) motivoOtro = parsed.motivoOtro;
        if (parsed.accesoriosEntregados) accesoriosEntregados = parsed.accesoriosEntregados;
        if (parsed.accesoriosOtro !== undefined) accesoriosOtro = parsed.accesoriosOtro;
      } catch { /* ignore */ }
    }

    // Cargar imágenes de evidencia de recepción (si existen en actividades)
    function readFotoB64(filePath: string): string {
      try {
        const diskPath = path.join(process.cwd(), 'db', 'uploads', filePath.replace('/api/file/', ''));
        const buf = fs.readFileSync(diskPath);
        const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch { return ''; }
    }

    let fotosRecepcion: string[] = [];
    if (orden.fotografias_json) {
      try {
        const parsed = JSON.parse(orden.fotografias_json);
        fotosRecepcion = (parsed.actividades || []).slice(0, 4).map(readFotoB64).filter(Boolean);
      } catch { /* ignore */ }
    }

    // Preparar cláusulas
    const clausulasRaw = orden.clausulas_recepcion || CLAUSULAS_DEFAULT;
    const clausulasHTML = clausulasRaw
      .split('\n')
      .filter((line: string) => line.trim() !== '')
      .map((line: string) => `<li>${line}</li>`)
      .join('');

    const eqTipoNormalizado = (orden.equipo_tipo || "").toLowerCase();
    const esTransductor = ["lineal", "convex", "sectorial", "intracavitario", "tee", "3d", "4d", "microconvex", "transductor"].some(t => eqTipoNormalizado.includes(t));

    let fotosRecepcionHTML = "";
    if (fotosRecepcion.length > 0) {
      fotosRecepcionHTML = `
        <div class="tech-card avoid-break" style="margin-top: 10px; margin-bottom: 10px;">
          <div class="card-title" style="color: #B91C1C; border-bottom-color: #FECACA;">Evidencia Fotográfica de Recepción</div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
            ${fotosRecepcion.map((b64, i) => `
              <div style="flex: 1; min-width: 100px; max-width: 140px; text-align: center;">
                <img src="${b64}" alt="Evidencia ${i + 1}" style="width: 100%; height: 80px; object-fit: contain; background: white; border: 1px solid #E2E8F0; border-radius: 6px;" />
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }



    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Hoja de Recepción ${folioRecepcion}</title>
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
            /* Carta = 279.4mm − márgenes @page (15+10mm) = 254.4mm útiles.
               Debe quedar POR DEBAJO de ese límite: con 255mm cada página se
               derramaba 0.6mm y generaba hojas fantasma / cortes corridos.
               Debe coincidir con el preview del editor en app/taller/recepcion/page.tsx. */
            min-height: 250mm;
            box-sizing: border-box;
          }
          .page-break {
            page-break-before: always;
            break-before: page;
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
          .avoid-break {
            page-break-inside: avoid;
            break-inside: avoid;
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
            border-bottom: 1px solid #C7D6F5;
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
            border: 1px solid #D5DBEA;
            border-radius: 10px;
            padding: 8px 12px;
            margin-bottom: 8px;
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
            border: 1px solid #E4E7F1;
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
          
          .tech-card {
            background: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 10px;
            padding: 8px 12px;
            margin-top: 8px;
            margin-bottom: 8px;
          }
          .inspect-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-top: 6px;
          }
          .inspect-card {
            background: #ffffff;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 8px 10px;
            display: flex;
            flex-direction: column;
          }
          .inspect-title {
            font-size: 8.5px;
            font-weight: 800;
            color: #4E60A9;
            text-transform: uppercase;
            letter-spacing: .5px;
            margin-bottom: 5px;
            border-bottom: 1px solid #F1F5F9;
            padding-bottom: 2px;
          }
          .pill-group {
            display: flex;
            flex-direction: column;
            gap: 3px;
            flex-grow: 1;
          }
          .pill {
            display: flex;
            align-items: center;
            font-size: 8px;
            padding: 3px 6px;
            border-radius: 4px;
            border: 1px solid #E8EAF2;
            color: #94A3B8;
            font-weight: 500;
          }
          .pill.active {
            font-weight: 700;
          }
          .pill.active.green {
            background: #ECFDF5;
            border-color: #A7F3D0;
            color: #065F46;
          }
          .pill.active.amber {
            background: #FFFBEB;
            border-color: #FDE68A;
            color: #92400E;
          }
          .pill.active.red {
            background: #FEF2F2;
            border-color: #FCA5A5;
            color: #991B1B;
          }
          .pill.active.slate {
            background: #F1F5F9;
            border-color: #E2E8F0;
            color: #334155;
          }
          .chk-box {
            display: inline-block;
            width: 8px;
            height: 8px;
            border: 1px solid #CBD5E1;
            border-radius: 2px;
            margin-right: 4px;
            position: relative;
            flex-shrink: 0;
          }
          .active .chk-box {
            background-color: currentColor;
            border-color: currentColor;
          }
          .active .chk-box::after {
            content: "";
            position: absolute;
            left: 2.2px;
            top: 0.5px;
            width: 1.8px;
            height: 3.5px;
            border: solid white;
            border-width: 0 1px 1px 0;
            transform: rotate(45deg);
          }
          .motivo-list, .accesorios-list {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 4px;
            margin-top: 4px;
          }
          .diag-p {
            font-size: 10px;
            color: #475569;
            line-height: 1.4;
            margin-bottom: 8px;
          }
          .signatures-wrapper {
            margin-top: auto;
            padding-top: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
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
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .sig-img-container {
            height: 80px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            width: 100%;
          }
          .sig-img {
            max-height: 78px;
            max-width: 220px;
            object-fit: contain;
            display: block;
          }
          .sig-line {
            width: 100%;
            border-top: 1.5px solid #CBD5E1;
            margin-top: 4px;
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
        <!-- PÁGINA 1: DATOS Y RECEPCIÓN -->
        <div class="page">
          
          <div class="hdr">
            <div>
              <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:44px; width:auto; display:block;" />
            </div>
            <div class="doc-title-container">
              <div class="doc-title">HOJA DE RECEPCIÓN</div>
              <div class="meta-grid">
                <div class="meta-lbl">Folio</div><div class="meta-val">${folioRecepcion}</div>
                <div class="meta-lbl">Ingreso</div><div class="meta-val">${fechaIngreso}</div>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>

          <div class="info-section avoid-break">
            <div class="info-card">
              <div class="card-title">Datos del Cliente</div>
              <div class="i-row"><div class="i-lbl">Institución</div><div class="i-val">${orden.datos_hospital || orden.datos_fiscales || clienteNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Atención a</div><div class="i-val">${orden.lead_nombre || clienteNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Teléfono</div><div class="i-val">${telefono}</div></div>
              <div class="i-row"><div class="i-lbl">Correo</div><div class="i-val">${correo}</div></div>
              <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${direccion}</div></div>
            </div>
            
            <div class="info-card">
              <div class="card-title">Información de Recepción</div>
              <div class="i-row"><div class="i-lbl">Recepción</div><div class="i-val">${recibidoPor || "—"}</div></div>
              <div class="i-row"><div class="i-lbl">Entregado por</div><div class="i-val">${entregadoPor || "—"}</div></div>
              <div class="i-row"><div class="i-lbl">Estatus Inicial</div><div class="i-val"><span style="display:inline-block; font-weight:700; font-size:8px; color:#4E60A9; background:#EEF3FC; border:1px solid #C7D6F5; padding:1px 8px; border-radius:10px; text-transform:uppercase; letter-spacing:.4px;">Equipo recibido</span></div></div>
            </div>
          </div>

          <div class="eq-card avoid-break">
            <div class="card-title" style="border:none; padding:0; margin-bottom:6px;">Especificaciones del Equipo</div>
            <div class="eq-grid">
              <div class="eq-item"><div class="eq-lbl">Equipo / Sonda</div><div class="eq-val">${orden.equipo_tipo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Marca</div><div class="eq-val">${orden.equipo_marca || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Modelo</div><div class="eq-val">${orden.equipo_modelo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Número de Serie</div><div class="eq-val" style="font-family: monospace;">${orden.equipo_num_serie || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Versión / SW</div><div class="eq-val">${orden.equipo_version || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Año Fab.</div><div class="eq-val">${orden.equipo_ano || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Área Médica</div><div class="eq-val">${orden.equipo_area_medica || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Técnico Resp.</div><div class="eq-val">${orden.tecnico || '—'}</div></div>
            </div>
          </div>

          <!-- ESTADO FÍSICO AL MOMENTO DE RECEPCIÓN -->
          <div class="tech-card avoid-break" style="margin-top: 8px; margin-bottom: 8px;">
            <div class="card-title" style="color: #4E60A9; border-bottom-color: #C7D6F5; margin-bottom: 6px;">Estado Físico al Momento de Recepción</div>
            <p style="font-size: 8px; color: #64748B; margin-bottom: 8px; font-style: italic; line-height: 1.3;">
              El personal de Bionordi declara haber recibido el equipo con las siguientes condiciones observadas a simple vista:
            </p>
            <div class="inspect-grid">
              <!-- Conector -->
              <div class="inspect-card">
                <div class="inspect-title">Conector</div>
                <div class="pill-group">
                  <div class="pill ${conectorState.includes('sin_danio') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Sin daño visible
                  </div>
                  <div class="pill ${conectorState.includes('danio_fisico') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Daño físico
                  </div>
                  <div class="pill ${conectorState.includes('cables_expuestos') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Cables expuestos
                  </div>
                </div>
              </div>
              
              <!-- Carcasa -->
              <div class="inspect-card">
                <div class="inspect-title">Carcasa</div>
                <div class="pill-group">
                  <div class="pill ${carcasaState.includes('sin_danio') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Sin daño visible
                  </div>
                  <div class="pill ${carcasaState.includes('grietas') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Grietas
                  </div>
                  <div class="pill ${carcasaState.includes('golpes') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Golpes
                  </div>
                  <div class="pill ${carcasaState.includes('desgaste') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Desgaste
                  </div>
                </div>
              </div>
              
              <!-- Cable -->
              <div class="inspect-card">
                <div class="inspect-title">Cable de transductor</div>
                <div class="pill-group">
                  <div class="pill ${cableState.includes('sin_danio') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Sin daño visible
                  </div>
                  <div class="pill ${cableState.includes('doblado_torcido') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Doblado/torcido
                  </div>
                  <div class="pill ${cableState.includes('pelado') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Pelado
                  </div>
                </div>
              </div>
              
              <!-- Cristales / Face -->
              <div class="inspect-card">
                <div class="inspect-title">Cristales / Face</div>
                <div class="pill-group">
                  <div class="pill ${cristalesState.includes('sin_danio') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Sin daño visible
                  </div>
                  <div class="pill ${cristalesState.includes('burbujas') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Burbujas
                  </div>
                  <div class="pill ${cristalesState.includes('astillado') ? 'active slate' : ''}">
                    <span class="chk-box"></span> Astillado
                  </div>
                  <div class="pill ${cristalesState.includes('no_evaluable') ? 'active slate' : ''}">
                    <span class="chk-box"></span> No evaluable
                  </div>
                </div>
              </div>
            </div>
            
            <div style="margin-top: 8px; border-top: 1px solid #ECEEF4; padding-top: 6px;">
              <div style="font-size: 8.5px; font-weight: 700; color: #4E60A9; text-transform: uppercase;">Observaciones adicionales:</div>
              <div style="font-size: 9px; color: #334155; line-height: 1.35; margin-top: 2px;">${observacionesAdicionales || 'Sin observaciones adicionales.'}</div>
            </div>
          </div>

          <!-- MOTIVO DE INGRESO Y ACCESORIOS -->
          <div class="tech-card avoid-break" style="margin-top: 8px; margin-bottom: 8px;">
            <div style="display: flex; gap: 20px;">
              <div style="flex: 1;">
                <div class="card-title" style="color: #4E60A9; border-bottom-color: #C7D6F5; margin-bottom: 4px;">Motivo de Ingreso</div>
                <div class="motivo-list">
                  <div class="pill ${motivoIngreso === 'diagnostico' ? 'active slate' : ''}"><span class="chk-box"></span> Diagnóstico</div>
                  <div class="pill ${motivoIngreso === 'reparacion' ? 'active slate' : ''}"><span class="chk-box"></span> Reparación</div>
                  <div class="pill ${motivoIngreso === 'mantenimiento' ? 'active slate' : ''}"><span class="chk-box"></span> Mantenimiento preventivo</div>
                  <div class="pill ${motivoIngreso === 'otro' ? 'active slate' : ''}"><span class="chk-box"></span> Otro${motivoIngreso === 'otro' && motivoOtro ? `: ${motivoOtro}` : ''}</div>
                </div>
                <div style="font-size: 8px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-top: 8px;">Descripción del problema reportado:</div>
                <div class="recep-p" style="margin-top: 3px;">${(orden.falla_reportada || 'Sin falla especificada').replace(/\n/g, '<br/>')}</div>
              </div>
              <div style="flex: 1; border-left: 1px solid #ECEEF4; padding-left: 20px;">
                <div class="card-title" style="color: #4E60A9; border-bottom-color: #C7D6F5; margin-bottom: 4px;">Accesorios y Elementos Entregados</div>
                <div class="accesorios-list">
                  <div class="pill ${accesoriosEntregados.includes('transductor') ? 'active slate' : ''}"><span class="chk-box"></span> Transductor</div>
                  <div class="pill ${accesoriosEntregados.includes('estuche_funda') ? 'active slate' : ''}"><span class="chk-box"></span> Estuche/funda</div>
                  <div class="pill ${accesoriosEntregados.includes('cable_extension') ? 'active slate' : ''}"><span class="chk-box"></span> Extensión</div>
                  <div class="pill ${accesoriosEntregados.includes('otro') ? 'active slate' : ''}"><span class="chk-box"></span> Otro${accesoriosEntregados.includes('otro') && accesoriosOtro ? `: ${accesoriosOtro}` : ''}</div>
                </div>
                <div style="font-size: 8px; color: #64748B; font-weight: 800; text-transform: uppercase; margin-top: 8px;">Otros accesorios / Checklist:</div>
                <div class="recep-p" style="margin-top: 3px;">${orden.accesorios_recibidos || 'Ninguno adicional.'}</div>
              </div>
            </div>
          </div>

          ${fotosRecepcionHTML}
        </div>

        <!-- PÁGINA 2: TÉRMINOS Y FIRMAS -->
        <div class="page page-break">
          <div class="hdr" style="margin-bottom: 4px;">
            <div>
              <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:32px; width:auto; display:block;" />
            </div>
            <div style="text-align: right; font-size: 9px; color: #64748B;">
              <div>Hoja de Recepción | Folio: <strong>${folioRecepcion}</strong></div>
              <div>Términos y Condiciones del Servicio</div>
            </div>
          </div>
          <div class="divider" style="margin-bottom: 6px;"></div>

          <div class="cond-section avoid-break" style="padding: 10px 14px; margin-bottom: 10px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px;">
            <div class="card-title" style="color: #4E60A9; border-bottom: 2px solid #C7D6F5; padding-bottom: 4px; margin-bottom: 8px;">Términos y Condiciones del Servicio de Reparación y Mantenimiento</div>
            <p style="font-size: 8px; color: #475569; margin-bottom: 8px; font-style: italic; line-height: 1.35;">
              Al firmar el presente documento, el cliente declara haber leído, comprendido y aceptado en su totalidad los siguientes términos y condiciones, los cuales regulan la relación de servicio entre el cliente y Bionordi S.A. de C.V.
            </p>
            <ul class="cond-list" style="font-size: 7.8px; line-height: 1.35; display: flex; flex-direction: column; gap: 4px;">
              ${clausulasHTML}
            </ul>
          </div>

          <div class="signatures-wrapper" style="border-top: 1px solid #E2E8F0; padding-top: 8px;">
            <p style="font-size: 8.2px; color: #475569; text-align: center; margin-bottom: 8px; line-height: 1.3;">
              <strong>FIRMAS DE CONFORMIDAD:</strong> El cliente declara haber leído y aceptado los términos anteriores, y confirma que el estado físico descrito corresponde al equipo entregado en esta fecha.
            </p>
            <div class="signatures">
              <div class="sig-box">
                <div class="sig-img-container">
                  ${firmaCliente ? `<img src="${firmaCliente}" alt="Firma Cliente" class="sig-img" />` : ''}
                </div>
                <div class="sig-line"></div>
                <div class="sig-name">${entregadoPor}</div>
                <div class="sig-role">Entrega (Cliente / Representante)</div>
              </div>
              
              <div class="sig-box">
                <div class="sig-img-container">
                  ${firmaTecnico ? `<img src="${firmaTecnico}" alt="Firma Técnico" class="sig-img" />` : ''}
                </div>
                <div class="sig-line"></div>
                <div class="sig-name">${recibidoPor}</div>
                <div class="sig-role">Recibe (Bionordi)</div>
              </div>
            </div>

            <div class="footer" style="margin-top: 5px;">
              <strong>Bionordi S.A. de C.V.</strong> · Mariano Matamoros 59, San Mateo, 52140 Metepec, México · contacto@bionordi.mx · www.bionordi.com<br/>
              Este documento de dos páginas certifica de conformidad la recepción y los términos del servicio técnico.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const executablePath = await getChromiumExecPath();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Hoja_Recepcion_${folioRecepcion}.pdf"`,
        },
      });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {}
      }
      if (browser) {
        try {
          const closeTimeout = setTimeout(() => {
            try {
              browser.process()?.kill('SIGKILL');
            } catch {}
          }, 5000);
          await browser.close();
          clearTimeout(closeTimeout);
        } catch {
          try {
            browser.process()?.kill('SIGKILL');
          } catch {}
        }
      }
    }
  } catch (e: any) {
    console.error('[pdf-recepcion] Error en GET:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    releaseQueueSlot();
  }
}
