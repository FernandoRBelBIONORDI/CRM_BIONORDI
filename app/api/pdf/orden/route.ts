import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

function formatearFecha(fecha: string) {
  if (!fecha) return '—';
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return fecha;
  return f.toLocaleDateString("es-MX", { year: 'numeric', month: 'long', day: 'numeric' });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

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

    if (!orden) return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });

    const clienteNombre = orden.lead_nombre || "Sin nombre";
    const direccion = orden.direccion || orden.lead_direccion || "—";
    const telefono = orden.telefono || orden.lead_telefono || "—";
    const correo = orden.correo || orden.lead_correo || "—";

    const fechaIngreso = formatearFecha(orden.fecha_ingreso);
    const fechaEntrega = formatearFecha(orden.fecha_compromiso);

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Orden de Servicio ${orden.folio}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { font-family: 'Inter', sans-serif; font-size: 11px; color: #334155; margin: 0; padding: 0; background: #fff; line-height: 1.5; }
          .page { padding: 40px; box-sizing: border-box; width: 100%; max-width: 800px; margin: 0 auto; position: relative; }
          
          /* Header Corporativo */
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #4E60A9; padding-bottom: 15px; }
          .header .logo-area { display: flex; align-items: center; gap: 10px; }
          .header img { width: 45px; height: 45px; object-fit: contain; }
          .header .brand { font-size: 18px; font-weight: 800; color: #1E293B; letter-spacing: -0.03em; margin: 0; line-height: 1; }
          .header .brand span { font-size: 10px; color: #4E60A9; display: block; letter-spacing: 0.05em; font-weight: 700; margin-top: 4px; }
          
          .header .info-orden { text-align: right; }
          .header .info-orden h1 { font-size: 20px; font-weight: 800; color: #1E293B; margin: 0 0 5px 0; letter-spacing: -0.02em; }
          .header .info-orden .folio { font-size: 14px; font-weight: 700; color: #4E60A9; background: #EEF3FC; padding: 4px 10px; border-radius: 6px; display: inline-block; margin-bottom: 5px;}
          .header .info-orden p { margin: 2px 0; color: #64748B; font-size: 10px; font-weight: 500; }

          /* Secciones */
          .section { margin-bottom: 25px; }
          .section-title { font-size: 12px; font-weight: 800; color: #4E60A9; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; margin-bottom: 12px; }
          
          .grid { display: flex; flex-wrap: wrap; gap: 15px; }
          .col { flex: 1; min-width: 45%; }
          .col-full { flex: 0 0 100%; }
          
          .field { margin-bottom: 10px; }
          .field-label { font-size: 9px; font-weight: 700; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
          .field-value { font-size: 11px; font-weight: 600; color: #1E293B; }
          
          .box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; }
          .box.highlight { background: #EEF3FC; border-color: #CBD5E1; }
          
          /* Reporte Técnico */
          .reporte-text { font-size: 11px; color: #475569; white-space: pre-wrap; margin-top: 4px; }
          
          /* Footer / Firmas */
          .firmas { display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
          .firma-box { width: 45%; text-align: center; }
          .firma-line { border-bottom: 1px solid #1E293B; height: 40px; margin-bottom: 8px; }
          .firma-nombre { font-size: 11px; font-weight: 700; color: #1E293B; }
          .firma-cargo { font-size: 9px; font-weight: 600; color: #94A3B8; }
          
          .page-footer { margin-top: 30px; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 15px; font-size: 9px; color: #94A3B8; }
          .page-footer strong { color: #475569; }
        </style>
      </head>
      <body>
        <div class="page">
          
          <div class="header">
            <div class="logo-area">
              <img src="https://crm.bionordi.com/ISOTIPO.png" alt="Logo" onerror="this.style.display='none'" />
              <div class="brand">
                BIONORDI
                <span>MEDICAL TECHNOLOGY</span>
              </div>
            </div>
            <div class="info-orden">
              <h1>ORDEN DE SERVICIO</h1>
              <div class="folio">Folio: ${orden.folio}</div>
              <p>Fecha de Ingreso: ${fechaIngreso}</p>
              <p>Fecha Estimada: ${fechaEntrega}</p>
            </div>
          </div>

          <!-- Datos del Cliente -->
          <div class="section">
            <div class="section-title">Datos del Cliente e Institución</div>
            <div class="grid box">
              <div class="col">
                <div class="field"><div class="field-label">Cliente / Hospital</div><div class="field-value">${clienteNombre} ${orden.datos_hospital ? `(${orden.datos_hospital})` : ''}</div></div>
                <div class="field"><div class="field-label">Contacto / Teléfono</div><div class="field-value">${telefono}</div></div>
              </div>
              <div class="col">
                <div class="field"><div class="field-label">Dirección</div><div class="field-value">${direccion}</div></div>
                <div class="field"><div class="field-label">Correo Electrónico</div><div class="field-value">${correo}</div></div>
              </div>
            </div>
          </div>

          <!-- Datos del Equipo -->
          <div class="section">
            <div class="section-title">Información del Equipo Médico</div>
            <div class="grid box highlight">
              <div class="col">
                <div class="field"><div class="field-label">Tipo de Equipo</div><div class="field-value">${orden.equipo_tipo || '—'}</div></div>
                <div class="field"><div class="field-label">Marca y Modelo</div><div class="field-value">${orden.equipo_marca || '—'} / ${orden.equipo_modelo || '—'}</div></div>
                <div class="field"><div class="field-label">Número de Serie</div><div class="field-value">${orden.equipo_num_serie || '—'}</div></div>
              </div>
              <div class="col">
                <div class="field"><div class="field-label">Versión / Área Médica</div><div class="field-value">${orden.equipo_version || '—'} / ${orden.equipo_area_medica || '—'}</div></div>
                <div class="field"><div class="field-label">Año de Fabricación</div><div class="field-value">${orden.equipo_ano || '—'}</div></div>
                <div class="field"><div class="field-label">Accesorios Recibidos</div><div class="field-value">${orden.accesorios_recibidos || 'Ninguno'}</div></div>
              </div>
            </div>
          </div>

          <!-- Reporte Técnico -->
          <div class="section">
            <div class="section-title">Diagnóstico y Reporte Técnico</div>
            
            ${orden.falla_reportada ? `
            <div class="field">
              <div class="field-label">Falla Reportada por el Cliente</div>
              <div class="reporte-text">${orden.falla_reportada}</div>
            </div><br/>` : ''}
            
            ${orden.diagnostico ? `
            <div class="field">
              <div class="field-label">Diagnóstico Técnico</div>
              <div class="reporte-text">${orden.diagnostico}</div>
            </div><br/>` : ''}

            ${orden.actividades_realizadas ? `
            <div class="field">
              <div class="field-label">Mantenimiento y Actividades Realizadas</div>
              <div class="reporte-text">${orden.actividades_realizadas}</div>
            </div><br/>` : ''}

            ${orden.refacciones_utilizadas ? `
            <div class="field">
              <div class="field-label">Refacciones y Componentes Utilizados</div>
              <div class="reporte-text">${orden.refacciones_utilizadas}</div>
            </div><br/>` : ''}

            ${orden.pruebas_realizadas ? `
            <div class="field">
              <div class="field-label">Pruebas de Funcionamiento y Calibración</div>
              <div class="reporte-text">${orden.pruebas_realizadas}</div>
            </div><br/>` : ''}
            
            ${orden.reporte_tecnico_final ? `
            <div class="box highlight" style="margin-top: 10px;">
              <div class="field-label" style="color:#4E60A9;">Conclusión Técnica Final</div>
              <div class="reporte-text" style="color:#1E293B; font-weight:600;">${orden.reporte_tecnico_final}</div>
            </div>` : ''}
          </div>

          <!-- Recomendaciones y Garantía -->
          <div class="section" style="page-break-inside: avoid;">
            <div class="section-title">Recomendaciones y Garantía</div>
            <div class="grid">
              ${orden.recomendaciones ? `
              <div class="col-full field">
                <div class="field-label">Recomendaciones de Uso y Cuidados</div>
                <div class="reporte-text">${orden.recomendaciones}</div>
              </div>` : ''}
              
              ${orden.garantia ? `
              <div class="col-full field" style="margin-top: 5px;">
                <div class="field-label" style="color: #059669;">Cobertura de Garantía</div>
                <div class="field-value" style="font-size: 12px;">${orden.garantia}</div>
              </div>` : ''}
            </div>
          </div>

          <!-- Firmas -->
          <div class="firmas">
            <div class="firma-box">
              <div class="firma-line"></div>
              <div class="firma-nombre">${clienteNombre}</div>
              <div class="firma-cargo">Firma de Conformidad del Cliente</div>
            </div>
            <div class="firma-box">
              <div class="firma-line"></div>
              <div class="firma-nombre">${orden.tecnico || 'Bionordi Medical Technology'}</div>
              <div class="firma-cargo">Ingeniero Biomédico / Técnico Responsable</div>
            </div>
          </div>

          <div class="page-footer">
            <strong>Bionordi Medical Technology</strong> | Servicio Técnico Especializado<br/>
            Este documento certifica el servicio realizado al equipo médico especificado.<br/>
            Para dar seguimiento a esta orden visita: crm.bionordi.com/seguimiento/${orden.folio}
          </div>

        </div>
      </body>
      </html>
    `;

    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
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
      await browser.close();
    }
  } catch (e: any) {
    console.error('[pdf-orden]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
