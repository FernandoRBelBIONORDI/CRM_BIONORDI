"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const STATUS_COLORS: Record<string, string> = {
  nuevo:       "#4F46E5",
  contactado:  "#D97706",
  seguimiento: "#EA580C",
  diagnostico: "#7C3AED",
  cliente:     "#059669",
  sin_equipo:  "#64748B",
  descartado:  "#DC2626",
};

const STATUS_BG: Record<string, string> = {
  nuevo:       "#EEF3FC",
  contactado:  "#FFFBEB",
  seguimiento: "#FFF7ED",
  diagnostico: "#F5F3FF",
  cliente:     "#ECFDF5",
  sin_equipo:  "#F1F5F9",
  descartado:  "#FEF2F2",
};

const STATUS_LABELS: Record<string, string> = {
  nuevo:       "Nuevo",
  contactado:  "Contactado",
  seguimiento: "Seguimiento",
  diagnostico: "Diagnóstico",
  cliente:     "Cliente",
  sin_equipo:  "Sin equipo",
  descartado:  "Descartado",
};

const TAMANO_LABELS: Record<string, string> = {
  consultorio: "Consultorio",
  clinica_p:   "Clínica pequeña",
  clinica_m:   "Clínica mediana",
  hospital:    "Hospital",
};

function buildIcon(color: string, precise: boolean): L.DivIcon {
  const size = precise ? 15 : 12;
  const ring = precise ? `box-shadow:0 0 0 3px ${color}33,0 2px 8px rgba(0,0,0,0.22)` : `box-shadow:0 2px 6px rgba(0,0,0,0.20)`;
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;border:2.5px solid #fff;${ring}"></div>`,
    className: "",
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function escHtml(s?: string | null): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function waHref(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const number = digits.startsWith("52") ? digits : `52${digits}`;
  return `https://wa.me/${number}`;
}

function scoreColor(s: number): string {
  if (s >= 7) return "#22C55E";
  if (s >= 4) return "#EAB308";
  return "#94A3B8";
}

function buildPopupHtml(lead: Lead): string {
  const sColor   = STATUS_COLORS[lead.status_crm] || "#6B7280";
  const sBg      = STATUS_BG[lead.status_crm]     || "#F1F5F9";
  const sLabel   = STATUS_LABELS[lead.status_crm] || lead.status_crm;
  const score    = lead.score_potencial;
  const scColor  = score ? scoreColor(score) : null;
  const precise  = lead.latitud != null && lead.longitud != null && lead.latitud !== 0 && lead.longitud !== 0;
  const wa       = waHref(lead.whatsapp || lead.telefono);
  const specialty= [lead.nicho, lead.sub_nicho].filter(Boolean).join(" · ");
  const location = [lead.ciudad, lead.estado_republica].filter(Boolean).join(", ");
  const tamano   = lead.tamano_estimado ? TAMANO_LABELS[lead.tamano_estimado] || lead.tamano_estimado : null;
  const agent    = lead.asignado_a;
  const lastContact = lead.fecha_ultimo_contacto ? lead.fecha_ultimo_contacto.slice(0, 10) : null;

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:260px;max-width:290px;padding:2px 0 0">

  <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px">
    <div style="font-weight:700;font-size:13.5px;color:#0F172A;line-height:1.3;flex:1">${escHtml(lead.nombre)}</div>
    <span style="background:${sBg};color:${sColor};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;white-space:nowrap;border:1px solid ${sColor}33;flex-shrink:0">${sLabel}</span>
  </div>

  ${score ? `
  <div style="background:#F8FAFC;border-radius:8px;padding:8px 10px;margin-bottom:10px;display:flex;align-items:center;gap:10px;border:1px solid #F1F5F9">
    <div style="font-size:22px;font-weight:900;color:${scColor};line-height:1;min-width:28px;text-align:center">${score}</div>
    <div style="flex:1">
      <div style="font-size:9px;color:#94A3B8;font-weight:700;letter-spacing:0.06em;margin-bottom:4px">SCORE POTENCIAL</div>
      <div style="background:#E2E8F0;border-radius:4px;height:5px;overflow:hidden">
        <div style="background:${scColor};width:${score * 10}%;height:5px;border-radius:4px"></div>
      </div>
    </div>
    ${tamano ? `<div style="font-size:10px;color:#94A3B8;font-weight:600;white-space:nowrap">${escHtml(tamano)}</div>` : ""}
  </div>
  ` : ""}

  <div style="font-size:11px;color:#475569;margin-bottom:8px;display:flex;flex-direction:column;gap:4px;background:#F8FAFC;padding:6px 10px;border-radius:8px;border:1px solid #F1F5F9">
    ${specialty ? `<div><span style="font-weight:600;color:#64748B">Especialidad:</span> <span style="color:#1E293B">${escHtml(specialty)}</span></div>` : ""}
    ${agent ? `<div><span style="font-weight:600;color:#64748B">Asignado a:</span> <span style="color:#1E293B">${escHtml(agent)}</span></div>` : ""}
    ${lastContact ? `<div><span style="font-weight:600;color:#64748B">Último contacto:</span> <span style="color:#1E293B">${lastContact}</span></div>` : ""}
  </div>

  ${lead.direccion ? `
  <div style="font-size:11.5px;color:#374151;margin-bottom:2px;display:flex;align-items:flex-start;gap:5px">
    <span style="font-size:13px;flex-shrink:0;margin-top:0px">${precise ? "📍" : "🗺️"}</span>
    <span style="line-height:1.4">${escHtml(lead.direccion)}</span>
  </div>
  ` : ""}

  ${location ? `<div style="font-size:11px;color:#94A3B8;margin-bottom:10px;padding-left:${lead.direccion ? "18px" : "0"}">${escHtml(location)}</div>` : `<div style="margin-bottom:10px"></div>`}

  ${lead.correo ? `<div style="font-size:11px;color:#64748B;margin-bottom:10px;display:flex;align-items:center;gap:5px;overflow:hidden"><span style="opacity:0.6">✉️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(lead.correo)}</span></div>` : ""}

  <div style="display:grid;grid-template-cols:1fr 1fr;gap:6px;padding-top:8px;border-top:1px solid #F1F5F9">
    ${wa ? `<a href="${wa}" target="_blank" rel="noreferrer" style="background:#22C55E;color:#fff;padding:6px;border-radius:8px;text-decoration:none;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 1px 2px rgba(34,197,94,0.2)">📱 WhatsApp</a>` : ""}
    <a href="/clientes/${lead.id}" style="background:#4F46E5;color:#fff;padding:6px;border-radius:8px;text-decoration:none;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(79,70,229,0.2)">👤 Ver expediente</a>
    <a href="/cotizar/venta?leadId=${lead.id}" style="background:#0F172A;color:#fff;padding:6px;border-radius:8px;text-decoration:none;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(15,23,42,0.2)">📄 Cotizar Venta</a>
    <a href="/cotizar/mantenimiento?leadId=${lead.id}" style="background:#475569;color:#fff;padding:6px;border-radius:8px;text-decoration:none;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(71,85,105,0.2)">🔧 Cotizar Manto.</a>
  </div>

</div>`.trim();
}

interface Lead {
  id: number;
  nombre: string;
  ciudad?: string;
  estado_republica?: string;
  municipio?: string;
  nicho?: string;
  sub_nicho?: string;
  telefono?: string;
  whatsapp?: string;
  correo?: string;
  score_potencial?: number;
  status_crm: string;
  direccion?: string;
  tamano_estimado?: string;
  latitud?: number | null;
  longitud?: number | null;
  asignado_a?: string;
  fecha_ultimo_contacto?: string;
}

interface Props {
  leads: Lead[];
  visibleStatus: Set<string>;
  heatmap: boolean;
  selectedLeadId: number | null;
}

const MEXICO_CENTER: [number, number] = [23.5, -102.0];

export default function MapsViewInner({ leads, visibleStatus, heatmap, selectedLeadId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Record<number, L.Marker>>({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MEXICO_CENTER,
      zoom: 5,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markersRef.current || !mapRef.current) return;
    markersRef.current.clearLayers();
    markersMapRef.current = {};

    // Spread algorithm only for city-level (non-geocoded) leads
    const citySlots: Record<string, number> = {};

    for (const lead of leads) {
      if (!visibleStatus.has(lead.status_crm)) continue;

      let pos: [number, number];
      const precise = lead.latitud != null && lead.longitud != null && lead.latitud !== 0 && lead.longitud !== 0;

      if (precise) {
        pos = [lead.latitud as number, lead.longitud as number];
      } else {
        const coords = getCoordsForCity(lead.ciudad);
        if (!coords) continue;

        const key = `${coords[0].toFixed(2)}_${coords[1].toFixed(2)}`;
        const idx = citySlots[key] ?? 0;
        citySlots[key] = idx + 1;

        const angle = idx * 137.508 * (Math.PI / 180);
        const r     = idx === 0 ? 0 : 0.01 + Math.floor(idx / 8) * 0.01;
        pos = [coords[0] + r * Math.sin(angle), coords[1] + r * Math.cos(angle)];
      }

      const color  = STATUS_COLORS[lead.status_crm] || "#6B7280";
      const icon   = buildIcon(color, precise);
      const marker = L.marker(pos, { icon });

      marker.bindPopup(buildPopupHtml(lead), { maxWidth: 320, className: "bionordi-popup" });

      if (heatmap) {
        L.circle(pos, {
          radius:      precise ? 3000 : 8000,
          color:       color,
          fillColor:   color,
          fillOpacity: 0.07,
          weight:      0,
        }).addTo(markersRef.current!);
      }

      markersRef.current?.addLayer(marker);
      markersMapRef.current[lead.id] = marker;
    }
  }, [leads, visibleStatus, heatmap]);

  // Effect to center the map and trigger popup on selection
  useEffect(() => {
    if (!mapRef.current || !selectedLeadId) return;
    const marker = markersMapRef.current[selectedLeadId];
    if (marker) {
      const pos = marker.getLatLng();
      mapRef.current.setView(pos, 15, { animate: true });
      setTimeout(() => {
        marker.openPopup();
      }, 300);
    }
  }, [selectedLeadId]);

  return (
    <>
      <style>{`
        .bionordi-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08);
          border: 1px solid #E2E8F0;
          padding: 0;
        }
        .bionordi-popup .leaflet-popup-content {
          margin: 14px 16px;
        }
        .bionordi-popup .leaflet-popup-tip-container {
          margin-top: -1px;
        }
      `}</style>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </>
  );
}

const CIUDAD_COORDS: Record<string, [number, number]> = {
  "ciudad de méxico": [19.43, -99.13],
  "cdmx":             [19.43, -99.13],
  "guadalajara":      [20.67, -103.35],
  "monterrey":        [25.67, -100.31],
  "puebla":           [19.04, -98.20],
  "tijuana":          [32.52, -117.04],
  "león":             [21.12, -101.68],
  "juárez":           [31.74, -106.49],
  "zapopan":          [20.72, -103.38],
  "mérida":           [20.97, -89.62],
  "cancún":           [21.17, -86.85],
  "querétaro":        [20.59, -100.39],
  "san luis potosí":  [22.16, -100.98],
  "aguascalientes":   [21.88, -102.29],
  "hermosillo":       [29.07, -110.96],
  "saltillo":         [25.43, -101.00],
  "mexicali":         [32.66, -115.47],
  "culiacán":         [24.80, -107.39],
  "acapulco":         [16.86, -99.88],
  "tepic":            [21.50, -104.90],
  "tuxtla gutiérrez": [16.75, -93.12],
  "toluca":           [19.29, -99.66],
  "morelia":          [19.70, -101.19],
  "oaxaca":           [17.07, -96.72],
  "veracruz":         [19.18, -96.15],
  "villahermosa":     [17.99, -92.93],
  "cuernavaca":       [18.92, -99.23],
  "durango":          [24.03, -104.67],
  "chihuahua":        [28.63, -106.07],
  "coatzacoalcos":    [18.15, -94.44],
  "xalapa":           [19.53, -96.92],
  "irapuato":         [20.68, -101.35],
  "celaya":           [20.52, -100.82],
  "mazatlán":         [23.24, -106.41],
  "ensenada":         [31.87, -116.60],
  "los cabos":        [22.89, -109.91],
  "la paz":           [24.15, -110.31],
  "campeche":         [19.85, -90.53],
  "chetumal":         [18.50, -88.30],
  "playa del carmen": [20.63, -87.08],
};

function cityHash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0x7fffffff;
  return h;
}

function getCoordsForCity(city?: string): [number, number] | null {
  if (!city) return [23.5, -102.0];
  const key = city.toLowerCase().trim();
  for (const [k, v] of Object.entries(CIUDAD_COORDS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  const h = cityHash(key);
  return [20 + (h % 700) / 100, -98 - (h % 1100) / 100];
}
