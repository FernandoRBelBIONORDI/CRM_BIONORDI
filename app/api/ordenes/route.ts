import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

function generarFolio(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const last = db.prepare(
    `SELECT folio FROM ordenes_trabajo WHERE folio LIKE ? ORDER BY id DESC LIMIT 1`
  ).get(`OT-${ym}-%`) as any;
  const seq = last ? parseInt(last.folio.split('-')[2]) + 1 : 1;
  return `OT-${ym}-${String(seq).padStart(3, '0')}`;
}

const SELECT_BASE = `
  SELECT o.*,
         l.nombre  AS lead_nombre,
         l.telefono AS lead_telefono,
         l.ciudad  AS lead_ciudad,
         c.folio   AS cotizacion_folio,
         c.monto_total AS cotizacion_monto,
         c.tipo    AS cotizacion_tipo
  FROM ordenes_trabajo o
  LEFT JOIN leads       l ON o.lead_id       = l.id
  LEFT JOIN cotizaciones c ON o.cotizacion_id = c.id
`;

export async function GET(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const lead_id = searchParams.get('lead_id');
  const status  = searchParams.get('status');

  let rows: any[];
  if (lead_id) {
    rows = db.prepare(`${SELECT_BASE} WHERE o.lead_id = ? ORDER BY o.id DESC`).all(Number(lead_id));
  } else if (status) {
    rows = db.prepare(`${SELECT_BASE} WHERE o.status = ? ORDER BY o.fecha_ingreso DESC`).all(status);
  } else {
    rows = db.prepare(`${SELECT_BASE} ORDER BY o.id DESC`).all();
  }

  return NextResponse.json({ ordenes: rows });
}

export async function POST(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const data = await req.json();
    const now = new Date().toISOString();
    const folio = generarFolio();

    const { lastInsertRowid } = db.prepare(`
      INSERT INTO ordenes_trabajo (
        folio, lead_id, cotizacion_id,
        datos_fiscales, datos_hospital, direccion, correo, telefono,
        equipo_tipo, equipo_marca, equipo_modelo, equipo_num_serie, equipo_version, equipo_ano, equipo_area_medica, accesorios_recibidos,
        falla_reportada, diagnostico, actividades_realizadas, mantenimiento_realizado, refacciones_utilizadas, pruebas_realizadas, notas_tecnicas, observaciones, recomendaciones, garantia, fotografias_json, firmas_json, tiempos_servicio_json, reporte_tecnico_final, tecnico,
        presupuesto, presupuesto_aprobado, precio_final,
        status, fecha_ingreso, fecha_compromiso, fecha_entrega, fecha_creacion
      ) VALUES (
        @folio, @lead_id, @cotizacion_id,
        @datos_fiscales, @datos_hospital, @direccion, @correo, @telefono,
        @equipo_tipo, @equipo_marca, @equipo_modelo, @equipo_num_serie, @equipo_version, @equipo_ano, @equipo_area_medica, @accesorios_recibidos,
        @falla_reportada, @diagnostico, @actividades_realizadas, @mantenimiento_realizado, @refacciones_utilizadas, @pruebas_realizadas, @notas_tecnicas, @observaciones, @recomendaciones, @garantia, @fotografias_json, @firmas_json, @tiempos_servicio_json, @reporte_tecnico_final, @tecnico,
        @presupuesto, @presupuesto_aprobado, @precio_final,
        @status, @fecha_ingreso, @fecha_compromiso, @fecha_entrega, @fecha_creacion
      )
    `).run({
      folio,
      lead_id:              data.lead_id        || null,
      cotizacion_id:        data.cotizacion_id  || null,
      datos_fiscales:       data.datos_fiscales || null,
      datos_hospital:       data.datos_hospital || null,
      direccion:            data.direccion      || null,
      correo:               data.correo         || null,
      telefono:             data.telefono       || null,
      equipo_tipo:          data.equipo_tipo     || null,
      equipo_marca:         data.equipo_marca    || null,
      equipo_modelo:        data.equipo_modelo   || null,
      equipo_num_serie:     data.equipo_num_serie || null,
      equipo_version:       data.equipo_version || null,
      equipo_ano:           data.equipo_ano     || null,
      equipo_area_medica:   data.equipo_area_medica || null,
      accesorios_recibidos: data.accesorios_recibidos || null,
      falla_reportada:      data.falla_reportada  || null,
      diagnostico:          data.diagnostico      || null,
      actividades_realizadas: data.actividades_realizadas || null,
      mantenimiento_realizado: data.mantenimiento_realizado || null,
      refacciones_utilizadas: data.refacciones_utilizadas || null,
      pruebas_realizadas:   data.pruebas_realizadas || null,
      notas_tecnicas:       data.notas_tecnicas   || null,
      observaciones:        data.observaciones  || null,
      recomendaciones:      data.recomendaciones || null,
      garantia:             data.garantia       || null,
      fotografias_json:     data.fotografias_json || null,
      firmas_json:          data.firmas_json    || null,
      tiempos_servicio_json: data.tiempos_servicio_json || null,
      reporte_tecnico_final: data.reporte_tecnico_final || null,
      tecnico:              data.tecnico          || null,
      presupuesto:          data.presupuesto      || null,
      presupuesto_aprobado: data.presupuesto_aprobado || 0,
      precio_final:         data.precio_final     || null,
      status:               data.status          || 'recibido',
      fecha_ingreso:        data.fecha_ingreso   || now.slice(0, 10),
      fecha_compromiso:     data.fecha_compromiso || null,
      fecha_entrega:        data.fecha_entrega    || null,
      fecha_creacion:       now,
    });

    const orden = db.prepare(`${SELECT_BASE} WHERE o.id = ?`).get(Number(lastInsertRowid));

    return NextResponse.json({ success: true, orden });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const COLS = new Set([
      'cotizacion_id',
      'datos_fiscales', 'datos_hospital', 'direccion', 'correo', 'telefono',
      'equipo_tipo','equipo_marca','equipo_modelo','equipo_num_serie', 'equipo_version', 'equipo_ano', 'equipo_area_medica', 'accesorios_recibidos',
      'falla_reportada','diagnostico', 'actividades_realizadas', 'mantenimiento_realizado', 'refacciones_utilizadas', 'pruebas_realizadas',
      'notas_tecnicas', 'observaciones', 'recomendaciones', 'garantia', 'fotografias_json', 'firmas_json', 'tiempos_servicio_json', 'reporte_tecnico_final',
      'tecnico',
      'presupuesto','presupuesto_aprobado','precio_final','status',
      'fecha_compromiso','fecha_entrega',
    ]);
    const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => COLS.has(k)));
    if (Object.keys(safe).length === 0) return NextResponse.json({ success: true });

    // Obtener orden anterior para ver si cambió de estado
    const oldOrden: any = db.prepare(`
      SELECT o.status, o.folio, o.correo, l.correo as lead_correo 
      FROM ordenes_trabajo o
      LEFT JOIN leads l ON o.lead_id = l.id
      WHERE o.id = ?
    `).get(id);

    const setStr = Object.keys(safe).map(k => `${k} = @${k}`).join(', ');
    db.prepare(`UPDATE ordenes_trabajo SET ${setStr} WHERE id = @id`).run({ ...safe, id });

    // Notificar al cliente si el estado cambió
    if (safe.status && oldOrden && oldOrden.status !== safe.status) {
      const emailTo = oldOrden.correo || oldOrden.lead_correo;
      if (emailTo) {
        const ESTADOS: Record<string, string> = {
          recibido: "Recibido / En cola",
          diagnostico: "En diagnóstico",
          cotizacion: "Esperando cotización",
          reparacion: "En reparación",
          listo: "Listo para entrega",
          entregado: "Entregado / Finalizado",
          cancelado: "Cancelado / Rechazado",
        };
        const stLabel = ESTADOS[safe.status as string] || safe.status;
        const html = `
          <div style="font-family:sans-serif;color:#333;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;padding:20px;">
            <h2 style="color:#4E60A9;margin-top:0;">Actualización de Servicio</h2>
            <p style="font-size:14px;">Hola,</p>
            <p style="font-size:14px;line-height:1.5;">El estado de tu equipo en servicio (Orden <strong>${oldOrden.folio}</strong>) ha cambiado a: <strong style="color:#4E60A9;text-transform:uppercase;">${stLabel}</strong>.</p>
            <p style="font-size:14px;line-height:1.5;">Puedes dar seguimiento en tiempo real y ver todos los detalles en tu portal de cliente:</p>
            <div style="text-align:center;margin-top:25px;margin-bottom:10px;">
              <a href="https://crm.bionordi.com/seguimiento/${oldOrden.folio}" style="display:inline-block;padding:12px 24px;background:#4E60A9;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px;">Ver Estado de mi Orden</a>
            </div>
          </div>
        `;
        
        // Enviar de forma asíncrona (sin await para no bloquear la respuesta al cliente)
        const protocol = req.headers.get('x-forwarded-proto') || 'http';
        const host = req.headers.get('host');
        fetch(`${protocol}://${host}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') || '' },
          body: JSON.stringify({
            to: emailTo,
            subject: `Actualización de Orden de Servicio ${oldOrden.folio}`,
            html
          })
        }).catch(err => console.error("Error enviando email de estado", err));
      }
    }

    const orden = db.prepare(`${SELECT_BASE} WHERE o.id = ?`).get(id);

    return NextResponse.json({ success: true, orden });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { unauth } = await requireAuth();
  if (unauth) return unauth;

  try {
    const { id } = await req.json();
    db.prepare(`DELETE FROM ordenes_trabajo WHERE id = ?`).run(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
