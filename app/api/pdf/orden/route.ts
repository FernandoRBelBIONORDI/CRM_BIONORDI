// ⚠️  ARCHIVO PROTEGIDO — ver CLAUDE.md antes de modificar
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs, { existsSync, promises as fsPromises } from 'fs';
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

// Limpiador de perfiles temporales huérfanos de Chromium en /tmp para evitar llenar el disco
async function cleanOldTmpProfiles() {
  try {
    const tmpDir = '/tmp';
    if (!existsSync(tmpDir)) return;
    const files = await fsPromises.readdir(tmpDir);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutos de antigüedad máxima para perfiles inactivos

    for (const file of files) {
      if (file.startsWith('puppeteer_dev_profile-') || file.startsWith('.org.chromium.Chromium.')) {
        const fullPath = path.join(tmpDir, file);
        try {
          const stat = await fsPromises.stat(fullPath);
          if (now - stat.mtimeMs > maxAge) {
            await fsPromises.rm(fullPath, { recursive: true, force: true });
            console.log(`[pdf-orden] Limpiado perfil temporal huérfano: ${file}`);
          }
        } catch (e) {
          // Ignorar si el archivo ya no existe o no se puede borrar
        }
      }
    }
  } catch (err) {
    console.error('[pdf-orden] Error al limpiar perfiles temporales:', err);
  }
}

// Cola de concurrencia simple para evitar saturar la memoria RAM del contenedor en Railway
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

export async function GET(req: Request) {
  // Disparar limpieza en segundo plano sin bloquear la petición actual
  cleanOldTmpProfiles().catch(() => {});

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
    const fechaEntrega = formatearFecha(orden.fecha_compromiso);

    const logoPath = path.join(process.cwd(), 'public', 'LOGO_PRINCIPAL.png');
    let logoB64 = '';
    try {
      logoB64 = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64');
    } catch { /* ignore */ }

    function readFotoB64(filePath: string): string {
      try {
        const diskPath = path.join(process.cwd(), 'db', 'uploads', filePath.replace('/api/file/', ''));
        const buf = fs.readFileSync(diskPath);
        const ext = (filePath.split('.').pop() || 'jpg').toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch { return ''; }
    }

    let fotosActB64: string[] = [];
    let fotosResB64: string[] = [];
    if (orden.fotografias_json) {
      try {
        const parsed = JSON.parse(orden.fotografias_json);
        fotosActB64 = (parsed.actividades || []).slice(0, 4).map(readFotoB64).filter(Boolean);
        fotosResB64 = (parsed.resultado   || []).slice(0, 4).map(readFotoB64).filter(Boolean);
      } catch { /* ignore */ }
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Orden de Servicio ${orden.folio}</title>
        <style>
          @page{margin:20mm 0 15mm 0}
          @page:first{margin-top:0}
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#334155;background:#fff;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
          .page{padding:40px 70px;max-width:850px;margin:0 auto}
          .avoid-break{page-break-inside:avoid}
          .text-muted{color:#94A3B8}.b{font-weight:700}.c{text-align:center}.r{text-align:right}
          .hdr{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:15px}
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
          .diag-p{font-size:11px;color:#475569;line-height:1.5;margin-bottom:5px}
          .signatures{margin-top:40px;display:flex;justify-content:flex-end;page-break-inside:avoid}
          .sig-box{text-align:center;width:240px}
          .sig-line{border-top:2px solid #CBD5E1;margin-bottom:10px;padding-top:10px}
          .sig-name{font-size:13px;font-weight:800;color:#4E60A9}
          .sig-role{font-size:10px;font-weight:600;color:#64748B;text-transform:uppercase;margin-top:2px}
          .footer{text-align:center;border-top:1px solid #E2E8F0;padding-top:15px;margin-top:30px;font-size:10px;color:#94A3B8;line-height:1.6}
          @media print{body{padding:0}.page{padding:40px 70px}}
        </style>
      </head>
      <body>
        <div class="page">
          
          <div class="hdr">
            <div>
              <img src="${logoB64}" alt="Bionordi Medical Technology" style="height:52px;width:auto;display:block;" />
            </div>
            <div class="meta-box">
              <div class="doc-title">ORDEN DE SERVICIO</div>
              <div class="meta-grid">
                <div class="meta-lbl">Folio</div><div class="meta-val">${orden.folio}</div>
                <div class="meta-lbl">F. Ingreso</div><div class="meta-val">${fechaIngreso}</div>
                <div class="meta-lbl">F. Estimada</div><div class="meta-val">${fechaEntrega}</div>
              </div>
            </div>
          </div>
          <div class="divider"></div>

          <!-- Datos del Cliente -->
          <div class="info-section">
            <div class="info-card">
              <div class="card-title">Datos del Cliente</div>
              <div class="i-row"><div class="i-lbl">Cliente / Hosp.</div><div class="i-val">${clienteNombre} ${orden.datos_hospital ? `(${orden.datos_hospital})` : ''}</div></div>
              <div class="i-row"><div class="i-lbl">Contacto</div><div class="i-val">${telefono}</div></div>
              <div class="i-row"><div class="i-lbl">Dirección</div><div class="i-val">${direccion}</div></div>
              <div class="i-row"><div class="i-lbl">Correo</div><div class="i-val">${correo}</div></div>
            </div>
          </div>

          <!-- Datos del Equipo -->
          <div class="eq-card">
            <div class="card-title" style="border:none;padding:0;margin-bottom:12px;">Especificaciones del Equipo Médico</div>
            <div class="eq-grid">
              <div class="eq-item"><div class="eq-lbl">Tipo</div><div class="eq-val">${orden.equipo_tipo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Marca y Modelo</div><div class="eq-val">${orden.equipo_marca || '—'} / ${orden.equipo_modelo || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Número de Serie</div><div class="eq-val">${orden.equipo_num_serie || '—'}</div></div>
              <div class="eq-item"><div class="eq-lbl">Área Médica</div><div class="eq-val">${orden.equipo_area_medica || '—'}</div></div>
              ${orden.accesorios_recibidos ? `<div class="eq-full" style="background:#F8FAFC;border-left-color:#4E60A9;"><div class="eq-lbl">Accesorios Recibidos</div><div class="eq-val" style="margin-top:2px;">${orden.accesorios_recibidos}</div></div>` : ""}
            </div>
          </div>

          <!-- Reporte Técnico: falla, diagnóstico, actividades, fotos actividades, refacciones, pruebas -->
          <div class="tech-card">
            <div class="card-title">Diagnóstico y Reporte Técnico</div>

            ${orden.falla_reportada ? `
            <div style="margin-bottom:12px;">
              <div class="eq-lbl">Falla Reportada por el Cliente</div>
              <div class="diag-p">${orden.falla_reportada}</div>
            </div>` : ''}

            ${orden.diagnostico ? `
            <div style="margin-bottom:12px;">
              <div class="eq-lbl">Diagnóstico Técnico</div>
              <div class="diag-p">${orden.diagnostico}</div>
            </div>` : ''}

            ${orden.actividades_realizadas ? `
            <div style="margin-bottom:12px;">
              <div class="eq-lbl">Actividades Realizadas</div>
              <div class="diag-p">${orden.actividades_realizadas}</div>
            </div>` : ''}

            ${fotosActB64.length > 0 ? `
            <div style="margin-bottom:12px;page-break-inside:avoid;break-inside:avoid;">
              <div class="eq-lbl" style="margin-bottom:8px;">Evidencia Fotográfica — Actividades Realizadas</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${fotosActB64.map((b64, i) => `
                <div style="flex:1;min-width:130px;max-width:200px;">
                  <img src="${b64}" alt="Foto ${i+1}" style="width:100%;max-height:140px;object-fit:contain;background:white;border-radius:6px;border:1px solid #E2E8F0;" />
                  <div style="margin-top:4px;font-size:9px;color:#475569;font-weight:600;text-align:center;">Foto ${i+1}</div>
                </div>`).join('')}
              </div>
            </div>` : ''}

            ${orden.refacciones_utilizadas ? `
            <div style="margin-bottom:12px;">
              <div class="eq-lbl">Refacciones Utilizadas</div>
              <div class="diag-p">${orden.refacciones_utilizadas}</div>
            </div>` : ''}

            ${orden.pruebas_realizadas ? `
            <div style="margin-bottom:0;">
              <div class="eq-lbl">Pruebas y Calibración</div>
              <div class="diag-p" style="margin-bottom:0;">${orden.pruebas_realizadas}</div>
            </div>` : ''}
          </div>

          <!-- Conclusión técnica final + fotos resultado: tarjeta independiente, nunca se parte -->
          ${orden.reporte_tecnico_final || fotosResB64.length > 0 ? `
          <div class="tech-card avoid-break" style="border-left:4px solid #4E60A9;">
            <div class="card-title" style="color:#4E60A9;">Conclusión Técnica Final</div>

            ${orden.reporte_tecnico_final ? `
            <div style="margin-bottom:${fotosResB64.length > 0 ? '16px' : '0'};">
              <div class="diag-p" style="color:#1E293B;font-weight:600;">${orden.reporte_tecnico_final}</div>
            </div>` : ''}

            ${fotosResB64.length > 0 ? `
            <div>
              <div class="eq-lbl" style="color:#059669;margin-bottom:8px;">Evidencia Fotográfica — Estado Final del Equipo</div>
              <div style="display:flex;gap:10px;flex-wrap:wrap;">
                ${fotosResB64.map((b64, i) => `
                <div style="flex:1;min-width:130px;max-width:200px;">
                  <img src="${b64}" alt="Foto ${i+1}" style="width:100%;max-height:140px;object-fit:contain;background:white;border-radius:6px;border:1px solid #D1FAE5;" />
                  <div style="margin-top:4px;font-size:9px;color:#047857;font-weight:600;text-align:center;">Foto ${i+1}</div>
                </div>`).join('')}
              </div>
            </div>` : ''}
          </div>` : ''}

          <!-- Recomendaciones y Garantía -->
          ${orden.recomendaciones || orden.garantia ? `
          <div class="tech-card avoid-break">
            <div class="card-title">Recomendaciones y Garantía</div>
            ${orden.recomendaciones ? `
            <div style="margin-bottom: ${orden.garantia ? '12px' : '0'};">
              <div class="eq-lbl">Recomendaciones de Uso y Cuidados</div>
              <div class="diag-p">${orden.recomendaciones}</div>
            </div>` : ''}
            
            ${orden.garantia ? `
            <div>
              <div class="eq-lbl" style="color: #059669;">Cobertura de Garantía</div>
              <div class="diag-p" style="font-weight: 600;">${orden.garantia}</div>
            </div>` : ''}
          </div>` : ''}

          <!-- Firmas -->
          <div class="signatures">
            <div class="sig-box" style="margin-right:40px;text-align:left;">
              <div class="sig-line"></div>
              <div class="sig-name">${clienteNombre}</div>
              <div class="sig-role">Firma de Conformidad del Cliente</div>
            </div>
            <div class="sig-box" style="text-align:left;">
              <div class="sig-line"></div>
              <div class="sig-name">${orden.tecnico || 'Bionordi Medical Technology'}</div>
              <div class="sig-role">Ingeniero Biomédico / Técnico Responsable</div>
            </div>
          </div>

          <div class="footer">
            <strong>Bionordi Medical Technology</strong> | Servicio Técnico Especializado<br/>
            Este documento certifica el servicio realizado al equipo médico especificado.<br/>
            Para cualquier consulta, comuníquese directamente con su asesor Bionordi o con el ingeniero a cargo.
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
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      return new NextResponse(pdfBuffer as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="Orden_Servicio_${orden.folio}.pdf"`,
        },
      });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('[pdf-orden] Error cerrando página:', e);
        }
      }
      if (browser) {
        try {
          // Seguro contra cuelgues: si browser.close() tarda más de 5s, matar el proceso del OS
          const closeTimeout = setTimeout(() => {
            console.warn('[pdf-orden] browser.close() colgado, forzando kill SIGKILL...');
            try {
              browser.process()?.kill('SIGKILL');
            } catch (err) {
              console.error('[pdf-orden] Falló al intentar matar proceso Chromium:', err);
            }
          }, 5000);

          await browser.close();
          clearTimeout(closeTimeout);
        } catch (err) {
          console.error('[pdf-orden] Error cerrando navegador, forzando kill:', err);
          try {
            browser.process()?.kill('SIGKILL');
          } catch (kErr) {}
        }
      }
    }
  } catch (e: any) {
    console.error('[pdf-orden] Error en GET:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    releaseQueueSlot();
  }
}
