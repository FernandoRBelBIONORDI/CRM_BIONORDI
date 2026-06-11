// Fuente única de verdad para los estados del CRM y del taller.
// Cualquier pantalla que muestre etapas de leads u órdenes debe importar de aquí
// para que labels y colores sean coherentes en toda la app.

export interface EstadoCfg {
  label: string;
  color: string;
  bg: string;
}

// ── Etapas del pipeline de leads (CRM) ────────────────────────────────────────
// Mismo orden que el embudo: nuevo → contactado → seguimiento → diagnostico → cliente.
// sin_equipo y descartado son estados terminales fuera del embudo.
export const LEAD_STATUS: Record<string, EstadoCfg> = {
  nuevo:       { label: "Nuevo",       color: "#5A85F1", bg: "#EEF3FC" },
  contactado:  { label: "Contactado",  color: "#D97706", bg: "#FFFBEB" },
  seguimiento: { label: "Seguimiento", color: "#EA580C", bg: "#FFF7ED" },
  diagnostico: { label: "Diagnóstico", color: "#7C3AED", bg: "#F5F3FF" },
  cliente:     { label: "Cliente",     color: "#34A853", bg: "#EEF9F1" },
  sin_equipo:  { label: "Sin equipo",  color: "#64748B", bg: "#F1F5F9" },
  descartado:  { label: "Descartado",  color: "#DC2626", bg: "#FEF2F2" },
};

// Etapas del embudo en orden de avance (para filtros y promoción automática).
export const LEAD_FUNNEL = ["nuevo", "contactado", "seguimiento", "diagnostico", "cliente"] as const;

// ── Estados de órdenes de servicio (taller) ───────────────────────────────────
// Mismos labels que el Kanban del taller y el selector de OrdenModal.
export const ORDEN_STATUS: Record<string, EstadoCfg> = {
  recibido:              { label: "Equipo recibido",           color: "#5A85F1", bg: "#EEF3FC" },
  en_diagnostico:        { label: "Evaluación técnica",        color: "#7C3AED", bg: "#F5F3FF" },
  en_reparacion:         { label: "Servicio en proceso",       color: "#D97706", bg: "#FFFBEB" },
  en_espera_refacciones: { label: "Espera refacciones",        color: "#EA580C", bg: "#FFF7ED" },
  en_pruebas:            { label: "Pruebas de funcionamiento", color: "#0E7490", bg: "#ECFEFF" },
  listo:                 { label: "Servicio finalizado",       color: "#059669", bg: "#ECFDF5" },
  entregado:             { label: "Entregado",                 color: "#34A853", bg: "#EEF9F1" },
  cancelado:             { label: "Cancelado",                 color: "#DC2626", bg: "#FEF2F2" },
};

// Columnas del Kanban del taller (sin cancelado).
export const ORDEN_KANBAN_COLS = [
  "recibido",
  "en_diagnostico",
  "en_reparacion",
  "en_espera_refacciones",
  "en_pruebas",
  "listo",
  "entregado",
] as const;

export const ordenStatusList = (values: readonly string[]) =>
  values.map(v => ({ value: v, ...ORDEN_STATUS[v] }));
