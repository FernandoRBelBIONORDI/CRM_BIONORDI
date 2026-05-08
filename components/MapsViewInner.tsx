"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { waLink } from "@/lib/ui";

const STATUS_COLORS: Record<string, string> = {
  nuevo:       "#4F46E5",
  contactado:  "#D97706",
  seguimiento: "#EA580C",
  diagnostico: "#7C3AED",
  cliente:     "#059669",
  sin_equipo:  "#64748B",
  descartado:  "#DC2626",
};

function buildIcon(color: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:13px;height:13px;background:${color};border-radius:50%;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25)"></div>`,
    className: "",
    iconSize: [13, 13],
    iconAnchor: [6, 6],
  });
}

interface Lead {
  id: number;
  nombre: string;
  ciudad?: string;
  nicho?: string;
  telefono?: string;
  whatsapp?: string;
  score_potencial?: number;
  status_crm: string;
  direccion?: string;
}

interface Props {
  leads: Lead[];
  visibleStatus: Set<string>;
  heatmap: boolean;
}

const MEXICO_CENTER: [number, number] = [23.5, -102.0];

export default function MapsViewInner({ leads, visibleStatus, heatmap }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<L.LayerGroup | null>(null);

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

    const coordMap: Record<string, Lead[]> = {};

    for (const lead of leads) {
      if (!visibleStatus.has(lead.status_crm)) continue;

      const coords = getCoordsForCity(lead.ciudad);
      if (!coords) continue;

      const key = `${coords[0].toFixed(2)}_${coords[1].toFixed(2)}`;
      coordMap[key] = coordMap[key] || [];
      coordMap[key].push(lead);

      const idx   = coordMap[key].length - 1;
      const angle = idx * 137.508 * (Math.PI / 180);
      const r     = idx === 0 ? 0 : 0.01 + Math.floor(idx / 8) * 0.01;
      const pos: [number, number] = [coords[0] + r * Math.sin(angle), coords[1] + r * Math.cos(angle)];

      const color  = STATUS_COLORS[lead.status_crm] || "#6B7280";
      const icon   = buildIcon(color);
      const marker = L.marker(pos, { icon });

      const scoreBar = lead.score_potencial
        ? `<div style="margin-top:4px"><span style="color:${scoreColor(lead.score_potencial)};font-weight:bold">${lead.score_potencial}/10</span> potencial</div>`
        : "";

      marker.bindPopup(`
        <div style="font-family:monospace;font-size:12px;min-width:180px">
          <div style="font-weight:700;font-size:13px;margin-bottom:4px">${lead.nombre}</div>
          <div style="color:#9CA3AF">${lead.nicho || ""} · ${lead.ciudad || ""}</div>
          ${scoreBar}
          <div style="margin-top:8px;display:flex;gap:6px">
            ${waLink(lead.whatsapp || lead.telefono) ? `<a href="${waLink(lead.whatsapp || lead.telefono)}" 
              style="background:#22C55E;color:#fff;padding:3px 8px;border-radius:4px;text-decoration:none;font-size:11px">WA</a>` : ""}
            <a href="/clientes/${lead.id}" style="background:#0EA5E9;color:#fff;padding:3px 8px;border-radius:4px;text-decoration:none;font-size:11px">Ver lead</a>
          </div>
        </div>
      `, { maxWidth: 240 });

      if (heatmap) {
        L.circle(pos, {
          radius: 8000,
          color: color,
          fillColor: color,
          fillOpacity: 0.06,
          weight: 0,
        }).addTo(markersRef.current!);
      }

      markersRef.current?.addLayer(marker);
    }
  }, [leads, visibleStatus, heatmap]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
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

function scoreColor(s: number): string {
  if (s >= 7) return "#22C55E";
  if (s >= 4) return "#EAB308";
  return "#9CA3AF";
}
