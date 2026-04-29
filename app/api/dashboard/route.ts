import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  const now = new Date();
  const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const inicioSemana = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const hace48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Métricas por estado
  const totales = db.prepare(`SELECT status_crm, COUNT(*) as cnt FROM leads GROUP BY status_crm`).all() as any[];
  const metrics: Record<string, number> = {};
  totales.forEach((r: any) => { metrics[r.status_crm] = r.cnt; });

  // Clientes cerrados este mes
  const cierresMes = (db.prepare(
    `SELECT COUNT(*) as cnt FROM leads WHERE status_crm = 'cliente' AND fecha_ultimo_cambio >= ?`
  ).get(inicioMes) as any).cnt;

  // Leer umbrales desde configuracion
  const cfgRows = db.prepare(`SELECT clave, valor FROM configuracion WHERE clave IN ('dias_alerta_seguimiento','dias_alerta_diagnostico')`).all() as any[];
  const cfg: Record<string,string> = {};
  cfgRows.forEach((r:any) => { cfg[r.clave] = r.valor; });
  const diasSeguimiento = parseInt(cfg['dias_alerta_seguimiento'] || '3', 10);
  const diasDiagnostico = parseInt(cfg['dias_alerta_diagnostico'] || '5', 10);
  const diasSeguimientoAlert = 7;

  // Auto-move: contactados sin movimiento por N días → seguimiento
  const autoMoveCutoff = new Date(now.getTime() - diasSeguimiento * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE leads SET status_crm = 'seguimiento', fecha_ultimo_cambio = ?
    WHERE status_crm = 'contactado'
      AND (fecha_ultimo_cambio < ? OR fecha_ultimo_cambio IS NULL)
  `).run(now.toISOString(), autoMoveCutoff);

  // 1. Top Priorities
  const topPriorities = db.prepare(`
    SELECT id, nombre, ciudad, nicho, score_potencial
    FROM leads WHERE status_crm = 'nuevo'
    ORDER BY score_potencial DESC, id DESC LIMIT 4
  `).all() as any[];

  // 2. Follow Ups
  const cutoffSeg = new Date(now.getTime() - diasSeguimiento * 24 * 60 * 60 * 1000).toISOString();
  const followUps = db.prepare(`
    SELECT id, nombre, ciudad, nicho, fecha_ultimo_cambio, status_crm, telefono
    FROM leads
    WHERE status_crm IN ('contactado', 'seguimiento')
      AND (fecha_ultimo_cambio < ? OR fecha_ultimo_cambio IS NULL)
    ORDER BY fecha_ultimo_cambio ASC LIMIT 4
  `).all(cutoffSeg) as any[];

  // 3. Seguimientos programados
  const proximosSeguimientos = db.prepare(`
    SELECT id, nombre, ciudad, nicho, status_crm, fecha_proximo_contacto, telefono
    FROM leads
    WHERE fecha_proximo_contacto IS NOT NULL
      AND fecha_proximo_contacto <= date('now', '+1 day')
      AND status_crm NOT IN ('cliente', 'descartado')
    ORDER BY fecha_proximo_contacto ASC LIMIT 6
  `).all() as any[];

  // 4. Alertas
  const cutoffSeguimiento7 = new Date(now.getTime() - diasSeguimientoAlert * 24 * 60 * 60 * 1000).toISOString();
  const alertsSeguimiento = db.prepare(`
    SELECT id, nombre, ciudad, nicho, fecha_ultimo_cambio FROM leads
    WHERE status_crm = 'seguimiento' AND (fecha_ultimo_cambio < ? OR fecha_ultimo_cambio IS NULL)
    ORDER BY fecha_ultimo_cambio ASC LIMIT 5
  `).all(cutoffSeguimiento7) as any[];

  const cutoffDiagnostico = new Date(now.getTime() - diasDiagnostico * 24 * 60 * 60 * 1000).toISOString();
  const alertsDiagnostico = db.prepare(`
    SELECT id, nombre, ciudad, nicho, fecha_ultimo_cambio FROM leads
    WHERE status_crm = 'diagnostico' AND (fecha_ultimo_cambio < ? OR fecha_ultimo_cambio IS NULL)
    ORDER BY fecha_ultimo_cambio ASC LIMIT 5
  `).all(cutoffDiagnostico) as any[];

  // 5. Leads calientes: actividad en últimas 48h (excluyendo los automovidos)
  const leadsCalientes = db.prepare(`
    SELECT id, nombre, ciudad, nicho, status_crm, fecha_ultimo_cambio
    FROM leads
    WHERE fecha_ultimo_cambio >= ?
      AND status_crm NOT IN ('descartado', 'sin_equipo', 'nuevo')
    ORDER BY fecha_ultimo_cambio DESC LIMIT 5
  `).all(hace48h) as any[];

  // 6. Conversión semanal: leads que avanzaron esta semana por etapa
  const convSemana = db.prepare(`
    SELECT status_crm, COUNT(*) as cnt FROM leads
    WHERE fecha_ultimo_cambio >= ?
      AND status_crm NOT IN ('nuevo', 'descartado', 'sin_equipo')
    GROUP BY status_crm
  `).all(inicioSemana) as any[];

  // 7. Ingresos del mes (OTs entregadas con precio_final)
  const ingresosMes = (db.prepare(`
    SELECT COALESCE(SUM(precio_final), 0) as total FROM ordenes_trabajo
    WHERE status = 'entregado' AND fecha_entrega >= ?
  `).get(inicioMes) as any).total || 0;

  // 8. OTs por cobrar: listas para entregar
  const otsPorCobrar = db.prepare(`
    SELECT o.id, o.folio, o.equipo_tipo, o.equipo_marca, o.precio_final, o.presupuesto,
           o.fecha_compromiso, o.status, l.nombre as lead_nombre
    FROM ordenes_trabajo o
    LEFT JOIN leads l ON o.lead_id = l.id
    WHERE o.status = 'listo'
    ORDER BY o.fecha_compromiso ASC LIMIT 6
  `).all() as any[];

  const totalPorCobrar = otsPorCobrar.reduce((sum: number, o: any) =>
    sum + (o.precio_final || o.presupuesto || 0), 0);

  // Taller métricas
  const tallerMetrics = {
    activas:  (db.prepare(`SELECT COUNT(*) as c FROM ordenes_trabajo WHERE status NOT IN ('entregado','cancelado')`).get() as any).c,
    listas:   (db.prepare(`SELECT COUNT(*) as c FROM ordenes_trabajo WHERE status = 'listo'`).get() as any).c,
    vencidas: (db.prepare(`SELECT COUNT(*) as c FROM ordenes_trabajo WHERE status NOT IN ('entregado','cancelado') AND fecha_compromiso < date('now') AND fecha_compromiso IS NOT NULL`).get() as any).c,
  };

  const ordenesActivas = db.prepare(`
    SELECT o.*, l.nombre as lead_nombre, l.telefono as lead_telefono
    FROM ordenes_trabajo o LEFT JOIN leads l ON o.lead_id = l.id
    WHERE o.status NOT IN ('entregado', 'cancelado')
    ORDER BY o.fecha_compromiso ASC LIMIT 6
  `).all() as any[];

  // Cotizaciones por tipo
  const cotRows = db.prepare(`SELECT tipo, COUNT(*) as cnt FROM cotizaciones GROUP BY tipo`).all() as any[];
  const cotPorTipo: Record<string, number> = {};
  cotRows.forEach((r: any) => { cotPorTipo[r.tipo] = r.cnt; });

  // Últimas búsquedas
  const busquedas = db.prepare(`SELECT * FROM busquedas ORDER BY fecha DESC LIMIT 4`).all() as any[];

  // IA pending — usa EXISTS en lugar de JOIN para evitar filas duplicadas por lead
  const iaPending = db.prepare(`
    SELECT id, nombre, nicho, score_potencial, decisor_nombre
    FROM leads
    WHERE status_crm NOT IN ('descartado', 'cliente', 'sin_equipo')
      AND (decisor_nombre IS NULL OR decisor_nombre = ''
           OR NOT EXISTS (SELECT 1 FROM scripts WHERE scripts.lead_id = leads.id))
    ORDER BY score_potencial DESC, id DESC LIMIT 4
  `).all() as any[];

  return NextResponse.json({
    metrics: {
      total: Object.values(metrics).reduce((a: number, b: number) => a + b, 0),
      nuevo: metrics['nuevo'] || 0,
      contactado: metrics['contactado'] || 0,
      seguimiento: metrics['seguimiento'] || 0,
      diagnostico: metrics['diagnostico'] || 0,
      cliente: cierresMes,
      descartado: metrics['descartado'] || 0,
      sin_equipo: metrics['sin_equipo'] || 0,
    },
    queues: { topPriorities, followUps, iaPending, proximosSeguimientos },
    alerts: { seguimiento7dias: alertsSeguimiento, diagnostico5dias: alertsDiagnostico },
    negocio: {
      ingresosMes,
      otsPorCobrar,
      totalPorCobrar,
      leadsCalientes,
      conversionSemanal: convSemana,
    },
    busquedas,
    taller: { metrics: tallerMetrics, ordenes: ordenesActivas },
    cotizaciones: cotPorTipo,
  });
}
