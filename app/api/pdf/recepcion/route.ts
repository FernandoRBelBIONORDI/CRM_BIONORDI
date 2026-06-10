import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs, { existsSync } from 'fs';
import path from 'path';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

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

const CLAUSULAS_DEFAULT = `1. DIAGNÓSTICO: El cliente acepta que todo equipo ingresado para diagnóstico causa un honorario de $1,500.00 MXN (más IVA) si el presupuesto de reparación es rechazado. El tiempo estimado de diagnóstico es de 3 a 5 días hábiles a partir de la fecha de ingreso.
2. RESPALDO DE INFORMACIÓN: Bionordi no se hace responsable por la pérdida de datos, imágenes o configuraciones contenidas en la memoria del equipo. Es responsabilidad del cliente respaldar su información previamente.
3. ALMACENAMIENTO Y ABANDONO: Transcurridos 30 días naturales a partir del aviso de reparación o presupuesto sin que el cliente recoja el equipo, se cobrará una tarifa de almacenaje de $50.00 MXN diarios. A los 90 días naturales, el equipo se considerará abandonado, facultando a Bionordi a disponer de él para recuperar costos.
4. ENVÍOS Y TRASLADO: Bionordi no asume responsabilidad por daños, golpes o extravíos que sufra el equipo durante el transporte por paqueterías externas o transportistas contratados por el cliente.`;

export async function GET(req: Request) {
  await acquireQueueSlot();

  let browser: any = null;
  let page: any = null;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      releaseQueueSlot();
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
      releaseQueueSlot();
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

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

    // Cargar firmas
    let firmaCliente = '';
    let firmaTecnico = '';
    let entregadoPor = orden.entregado_por || clienteNombre;
    let recibidoPor = orden.recibido_por || orden.tecnico || 'Bionordi';

    if (orden.firmas_json) {
      try {
        const parsed = JSON.parse(orden.firmas_json);
        firmaCliente = parsed.entrega || '';
        firmaTecnico = parsed.recibe || '';
        if (parsed.entregado_por) entregadoPor = parsed.entregado_por;
        if (parsed.recibido_por) recibidoPor = parsed.recibido_por;
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
        // Usamos las fotos iniciales (actividades) como evidencia de recepción
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

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Hoja de Recepción ${orden.folio}</title>
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
            min-height: 255mm; /* Para obligar a ocupar casi todo el alto carta */
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
          .recep-item:last-child {
            margin-bottom: 0;
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
            flex-grow: 1; /* Permite que esta sección llene el espacio disponible */
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
          
          .evidencias-container {
            margin-bottom: 8px;
          }
          .evidencias-grid {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 4px;
          }
          .evidencia-img {
            flex: 1;
            min-width: 100px;
            max-width: 140px;
            height: 80px;
            object-fit: contain;
            background: white;
            border: 1px solid #E2E8F0;
            border-radius: 6px;
          }
          
          .signatures-wrapper {
            margin-top: auto; /* Empuja las firmas al final de la página */
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
            margin-top: 35px; /* Espacio para la firma manual */
            padding-top: 4px;
            position: relative;
          }
          .sig-img {
            height: 45px;
            max-width: 180px;
            object-fit: contain;
            margin-bottom: -40px;
            margin-top: -45px;
            z-index: 10;
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
        <div class="page">
          
          <!-- Encabezado -->
          <div class="hdr">
            <div>
              <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:44px; width:auto; display:block;" />
            </div>
            <div class="doc-title-container">
              <div class="doc-title">HOJA DE RECEPCIÓN</div>
              <div class="meta-grid">
                <div class="meta-lbl">Folio</div><div class="meta-val">${orden.folio}</div>
                <div class="meta-lbl">Ingreso</div><div class="meta-val">${fechaIngreso}</div>
                <div class="meta-lbl">Entrega Est.</div><div class="meta-val">${fechaCompromiso}</div>
              </div>
            </div>
          </div>
          
          <div class="divider"></div>

          <div class="info-section">
            <!-- Datos del Cliente -->
            <div class="info-card">
              <div class="card-title">Datos del Cliente</div>
              <div class="i-row"><div class="i-lbl">Institución</div><div class="i-val">${orden.datos_hospital || clienteNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Atención a</div><div class="i-val">${clienteNombre}</div></div>
              <div class="i-row"><div class="i-lbl">Teléfono</div><div class="i-val">${telefono}</div></div>
              <div class="i-row"><div class="i-lbl">Correo</div><div class="i-val">${correo}</div></div>
              <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${direccion}</div></div>
            </div>
            
            <!-- Datos de Servicio -->
            <div class="info-card">
              <div class="card-title">Información de Recepción</div>
              <div class="i-row"><div class="i-lbl">Recepción</div><div class="i-val">${recibidoPor}</div></div>
              <div class="i-row"><div class="i-lbl">Entregado por</div><div class="i-val">${entregadoPor}</div></div>
              <div class="i-row">
                <div class="i-lbl">Costo Diag.</div>
                <div class="i-val b" style="color: #4E60A9;">
                  ${orden.costo_diagnostico ? `$${orden.costo_diagnostico.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN` : '$1,500.00 MXN'}
                </div>
              </div>
              <div class="i-row"><div class="i-lbl">Estatus Inicial</div><div class="i-val"><span style="font-weight: 700; color: #5A85F1; text-transform: uppercase;">EQUIPO RECIBIDO</span></div></div>
            </div>
          </div>

          <!-- Especificaciones del Equipo -->
          <div class="eq-card">
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
              
              ${orden.accesorios_recibidos ? `
                <div class="eq-full" style="border-left-color: #4E60A9;">
                  <div class="eq-lbl">Accesorios Recibidos / Checklist</div>
                  <div class="eq-val" style="margin-top: 1px; font-weight: 500;">${orden.accesorios_recibidos}</div>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Detalles de Recepción -->
          <div class="recep-card">
            <div class="card-title">Falla Reportada y Estado Físico</div>
            <div class="recep-grid">
              <div class="recep-item">
                <div class="eq-lbl">Falla Reportada por el Cliente</div>
                <div class="recep-p">${(orden.falla_reportada || 'Sin falla especificada').replace(/\n/g, '<br/>')}</div>
              </div>
              <div class="recep-item">
                <div class="eq-lbl">Estado Físico / Estético Visible de Recepción</div>
                <div class="recep-p">${(orden.condicion_recepcion || 'Sin observaciones estéticas. El equipo presenta condiciones normales de uso.').replace(/\n/g, '<br/>')}</div>
              </div>
            </div>
          </div>

          <!-- Evidencia Fotográfica de Ingreso (si hay) -->
          ${fotosRecepcion.length > 0 ? `
            <div class="evidencias-container">
              <div class="eq-lbl" style="margin-bottom: 2px;">Evidencia Fotográfica de Ingreso</div>
              <div class="evidencias-grid">
                ${fotosRecepcion.map((b64, i) => `
                  <img src="${b64}" alt="Evidencia ${i + 1}" class="evidencia-img" />
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Cláusulas y Términos -->
          <div class="cond-section">
            <div class="card-title">Términos y Condiciones del Servicio de Recepción</div>
            <ul class="cond-list">
              ${clausulasHTML}
            </ul>
          </div>

          <!-- Firmas -->
          <div class="signatures-wrapper">
            <div class="signatures">
              <div class="sig-box">
                ${firmaCliente ? `<img src="${firmaCliente}" alt="Firma Cliente" class="sig-img" />` : ''}
                <div class="sig-line"></div>
                <div class="sig-name">${entregadoPor}</div>
                <div class="sig-role">Entrega (Cliente / Representante)</div>
              </div>
              
              <div class="sig-box">
                ${firmaTecnico ? `<img src="${firmaTecnico}" alt="Firma Técnico" class="sig-img" />` : ''}
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
          'Content-Disposition': `inline; filename="Hoja_Recepcion_${orden.folio}.pdf"`,
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
