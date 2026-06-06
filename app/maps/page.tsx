"use client";

import { useEffect, useRef, useState } from "react";
import MapsView from "@/components/MapsView";
import { Layers, Map as MapIcon, LayoutGrid, MapPin } from "lucide-react";

const CAPAS = [
  { key:"nuevo",       label:"Nuevo",       color:"#4F46E5", bg:"#EEF3FC" },
  { key:"contactado",  label:"Contactado",  color:"#D97706", bg:"#FFFBEB" },
  { key:"seguimiento", label:"Seguimiento", color:"#EA580C", bg:"#FFF7ED" },
  { key:"diagnostico", label:"Diagnóstico", color:"#7C3AED", bg:"#F5F3FF" },
  { key:"cliente",     label:"Cliente",     color:"#059669", bg:"#ECFDF5" },
  { key:"descartado",  label:"Descartado",  color:"#DC2626", bg:"#FEF2F2" },
];

export default function MapsPage() {
  const [leads, setLeads]                 = useState<any[]>([]);
  const [total, setTotal]                 = useState(0);
  const [visibleStatus, setVisibleStatus] = useState<Set<string>>(new Set(CAPAS.map(c => c.key)));
  const [heatmap, setHeatmap]             = useState(false);
  const [geocoding, setGeocoding]         = useState(0); // leads pendientes de geocodificar
  const geocodeStarted                    = useRef(false);

  // Carga todos los leads (sin límite)
  useEffect(() => {
    fetch("/api/leads?limit=9999")
      .then(r => r.json())
      .then(d => {
        if (d.leads) {
          setLeads(d.leads);
          setTotal(d.total ?? d.leads.length);
        }
      });
  }, []);

  // Geocodificación automática en background — se ejecuta una sola vez al cargar leads
  useEffect(() => {
    if (!leads.length || geocodeStarted.current) return;
    geocodeStarted.current = true;

    const pending = leads.filter(l => l.latitud == null && l.longitud == null);
    if (!pending.length) return;

    setGeocoding(pending.length);
    let cancelled = false;

    (async () => {
      for (let i = 0; i < pending.length; i++) {
        if (cancelled) break;

        // Nominatim permite 1 req/seg
        if (i > 0) await new Promise(r => setTimeout(r, 1200));
        if (cancelled) break;

        try {
          const res = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lead_id: pending[i].id }),
          });

          if (res.ok) {
            const { lat, lng } = await res.json();
            setLeads(prev =>
              prev.map(l => l.id === pending[i].id ? { ...l, latitud: lat, longitud: lng } : l)
            );
          }
        } catch {}

        setGeocoding(prev => Math.max(0, prev - 1));
      }
    })();

    return () => { cancelled = true; };
  }, [leads.length]);

  const toggleStatus = (key: string) => setVisibleStatus(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  const visibles   = leads.filter(l => visibleStatus.has(l.status_crm));
  const geocoded   = leads.filter(l => l.latitud != null).length;

  return (
    <div className="h-full flex flex-col font-sans">

      {/* Header */}
      <div className="flex items-center gap-6 px-8 mb-2">
        <div>
          <h1 className="text-[28px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">Mapa de Territorio</h1>
          <p className="text-[#8B95A5] text-[13px] font-medium tracking-tight mt-0.5">
            {visibles.length} de {total} leads visibles
            {geocoded > 0 && (
              <span className="ml-2 text-[#059669]">
                · {geocoded} con ubicación exacta
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 pt-4 gap-[24px]">

        {/* Panel lateral */}
        <div className="w-[260px] shrink-0 card flex flex-col overflow-hidden">

          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <Layers size={14} className="text-[#4E60A9]"/>
            <span className="font-bold text-[13px] text-[#202538]">Etapas CRM</span>
          </div>

          <div className="flex-1 p-3 space-y-1.5 overflow-auto">
            {CAPAS.map(c => {
              const cnt = leads.filter(l => l.status_crm === c.key).length;
              const on  = visibleStatus.has(c.key);
              return (
                <button key={c.key} onClick={() => toggleStatus(c.key)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border ${on ? "border-transparent" : "border-transparent opacity-40 hover:opacity-60"}`}
                  style={on ? { backgroundColor: c.bg } : { backgroundColor: "#F8FAFC" }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }}/>
                    <span className="text-[13px] font-semibold" style={{ color: on ? c.color : "#94A3B8" }}>
                      {c.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: on ? c.color : "#CBD5E1" }}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Leyenda de precisión */}
          <div className="px-4 py-3 border-t border-gray-100 space-y-1.5 shrink-0">
            <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
              <div className="w-3.5 h-3.5 rounded-full bg-[#4F46E5] border-2 border-white ring-2 ring-[#4F46E533] shrink-0"/>
              <span>Ubicación exacta (geocodificada)</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
              <div className="w-2.5 h-2.5 rounded-full bg-[#94A3B8] border-2 border-white shrink-0"/>
              <span>Ubicación aproximada (ciudad)</span>
            </div>
          </div>

          {/* Opciones */}
          <div className="border-t border-gray-100 p-4 space-y-2 shrink-0">
            <button onClick={() => setHeatmap(p => !p)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all font-bold text-[12px] border ${heatmap ? "bg-[#FFF7ED] text-[#EA580C] border-orange-200" : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:text-[#202538]"}`}>
              <LayoutGrid size={14}/> {heatmap ? "Ocultar heatmap" : "Mostrar heatmap"}
            </button>
            <button onClick={() => setVisibleStatus(new Set(CAPAS.map(c => c.key)))}
              className="w-full text-[11px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors py-1.5 text-center">
              Mostrar todas las etapas
            </button>
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 card overflow-hidden relative bg-[#E5ECF6]">

          {/* Badge de leads activos */}
          <div className="absolute top-4 left-4 z-[1000] pointer-events-none flex flex-col gap-2">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full font-bold text-[#202538] shadow-sm border border-white/60 text-[12px] flex items-center gap-2">
              <MapIcon size={14} className="text-[#34A853]"/>
              {visibles.length} leads activos
            </div>
            {geocoding > 0 && (
              <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full text-[#7C3AED] shadow-sm border border-purple-100/60 text-[11px] flex items-center gap-2 font-semibold">
                <MapPin size={12} className="animate-pulse"/>
                Geocodificando {geocoding} leads…
              </div>
            )}
          </div>

          <MapsView leads={leads} visibleStatus={visibleStatus} heatmap={heatmap} />
        </div>
      </div>
    </div>
  );
}
