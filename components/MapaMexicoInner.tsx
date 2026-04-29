"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  leadsPorEstado?: Record<string, number>;
  onEstadoSelect?: (nombre: string, id: string) => void;
  estadoSeleccionado?: string;
}

const MEXICO_CENTER: [number, number] = [23.5, -102.0];

export default function MapaMexicoInner({ leadsPorEstado = {}, onEstadoSelect, estadoSeleccionado }: Props) {
  const mapRef       = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const geoLayerRef  = useRef<L.GeoJSON | null>(null);
  const muniLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoData, setGeoData] = useState<any>(null);

  useEffect(() => {
    fetch("/geo/mexico_estados.geojson")
      .then(r => r.json())
      .then(setGeoData)
      .catch(e => console.error("Error cargando GeoJSON de estados:", e));
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: MEXICO_CENTER,
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: '© <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !geoData) return;

    if (geoLayerRef.current) {
      geoLayerRef.current.remove();
      geoLayerRef.current = null;
    }

    const map = mapRef.current;

    const geoLayer = L.geoJSON(geoData, {
      style: feature => getEstadoStyle(feature, estadoSeleccionado, leadsPorEstado),
      onEachFeature: (feature, layer) => {
        const nombre = feature.properties?.name as string;
        const id     = feature.properties?.id as string;
        const count  = leadsPorEstado[nombre] || 0;

        layer.bindTooltip(
          `<div style="font-family:var(--font-inter);font-size:12px;font-weight:600;padding:2px 4px;"><strong>${nombre}</strong>${count ? `<br/><span style="color:#5A85F1">${count} prospectos</span>` : ""}</div>`,
          { sticky: true, className: 'custom-tooltip' }
        );

        layer.on({
          mouseover(e) {
            const l = e.target as L.Path;
            l.setStyle({ fillOpacity: 0.85, weight: 2.5, color: "#4E60A9" });
          },
          mouseout() {
            geoLayer.resetStyle(layer);
          },
          click() {
            onEstadoSelect?.(nombre, id);
            const bounds = (layer as L.Polygon).getBounds();
            map.fitBounds(bounds, { padding: [30, 30] });

            if (id === "CMX") {
              loadMunicipios(map, muniLayerRef);
            } else {
              if (muniLayerRef.current) {
                muniLayerRef.current.remove();
                muniLayerRef.current = null;
              }
            }
          },
        });
      },
    }).addTo(map);

    geoLayerRef.current = geoLayer;
  }, [geoData, mapRef.current]);

  useEffect(() => {
    if (!geoLayerRef.current) return;
    geoLayerRef.current.setStyle((feature) =>
      getEstadoStyle(feature, estadoSeleccionado, leadsPorEstado)
    );
  }, [estadoSeleccionado, leadsPorEstado]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", borderRadius: "inherit" }} className="bg-transparent" />
  );
}

function getEstadoStyle(
  feature: any,
  seleccionado: string | undefined,
  leads: Record<string, number>
): L.PathOptions {
  const nombre     = feature?.properties?.name as string;
  const count      = leads[nombre] || 0;
  const isSelected = seleccionado === nombre;

  let fillColor = "#F8FAFC";
  if (count > 20)      fillColor = "#4E60A9";
  else if (count > 10) fillColor = "#5A82ED";
  else if (count > 5)  fillColor = "#8CAAF5";
  else if (count > 0)  fillColor = "#C9DBF9";

  return {
    color:       isSelected ? "#1E293B" : "#E2E8F4",
    weight:      isSelected ? 2 : 1.5,
    fillColor,
    fillOpacity: isSelected ? 0.95 : 0.8,
  };
}

async function loadMunicipios(
  map: L.Map,
  muniLayerRef: React.MutableRefObject<L.GeoJSON | null>
) {
  if (muniLayerRef.current) {
    muniLayerRef.current.remove();
    muniLayerRef.current = null;
  }
  try {
    const res  = await fetch("/geo/CDMX.geojson");
    const data = await res.json();

    const layer = L.geoJSON(data, {
      style: {
        color: "#5A85F1",
        weight: 1.5,
        fillColor: "#5A85F1",
        fillOpacity: 0.1,
      },
      onEachFeature: (feature, l) => {
        l.bindTooltip(
          `<span style="font-family:var(--font-inter);font-size:11px;font-weight:600">${feature.properties?.name}</span>`,
          { sticky: true }
        );
      },
    }).addTo(map);

    muniLayerRef.current = layer;
  } catch {
  }
}
