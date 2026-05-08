"use client";

import { useEffect, useState } from "react";
import MapsView from "@/components/MapsView";
import { Layers, Map as MapIcon, LayoutGrid, Navigation, CheckCircle } from "lucide-react";

const CAPAS = [
  { key:"nuevo",       label:"Nuevo",       color:"#5A85F1", bg:"#EEF3FC" },
  { key:"contactado",  label:"Contactado",  color:"#D97706", bg:"#FFFBEB" },
  { key:"seguimiento", label:"Seguimiento", color:"#EA580C", bg:"#FFF7ED" },
  { key:"diagnostico", label:"Diagnóstico", color:"#7C3AED", bg:"#F5F3FF" },
  { key:"cliente",     label:"Cliente",     color:"#34A853", bg:"#EEF9F1" },
  { key:"descartado",  label:"Descartado",  color:"#DC2626", bg:"#FEF2F2" },
];

export default function MapsPage() {
  const [leads, setLeads]                 = useState<any[]>([]);
  const [visibleStatus, setVisibleStatus] = useState<Set<string>>(new Set(CAPAS.map(c=>c.key)));
  const [heatmap, setHeatmap]             = useState(false);
  const [geocoding, setGeocoding]         = useState(false);
  const [geoResult, setGeoResult]         = useState<{ok:number;fail:number;total:number}|null>(null);

  const loadLeads = () =>
    fetch("/api/leads").then(r=>r.json()).then(d=>{ if(d.leads) setLeads(d.leads); });

  useEffect(()=>{ loadLeads(); },[]);

  const geocodeAll = async () => {
    setGeocoding(true); setGeoResult(null);
    const res = await fetch("/api/geocode", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ all: true }) });
    const data = await res.json();
    setGeoResult(data);
    setGeocoding(false);
    await loadLeads(); // refrescar marcadores
  };

  const toggleStatus = (key:string) => setVisibleStatus(prev=>{
    const n=new Set(prev); n.has(key)?n.delete(key):n.add(key); return n;
  });

  const visibles = leads.filter(l=>visibleStatus.has(l.status_crm));
  const total    = leads.length;

  return (
    <div className="h-full flex flex-col font-sans">

      {/* Header */}
      <div className="flex items-center gap-6 px-8 mb-2">
        <div>
          <h1 className="text-[28px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">Mapa de Territorio</h1>
          <p className="text-[#8B95A5] text-[13px] font-medium tracking-tight mt-0.5">
            {visibles.length} de {total} leads visibles en el mapa
          </p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 pt-4 gap-[24px]">

        {/* Panel lateral */}
        <div className="w-[260px] shrink-0 card flex flex-col overflow-hidden">

          {/* Capas */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <Layers size={14} className="text-[#4E60A9]"/>
            <span className="font-bold text-[13px] text-[#202538]">Etapas CRM</span>
          </div>
          <div className="flex-1 p-3 space-y-1.5 overflow-auto">
            {CAPAS.map(c=>{
              const cnt = leads.filter(l=>l.status_crm===c.key).length;
              const on  = visibleStatus.has(c.key);
              return (
                <button key={c.key} onClick={()=>toggleStatus(c.key)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all border ${on?"border-transparent":"border-transparent opacity-40 hover:opacity-60"}`}
                  style={on?{backgroundColor:c.bg}:{backgroundColor:"#F8FAFC"}}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:c.color}}/>
                    <span className="text-[13px] font-semibold" style={{color:on?c.color:"#94A3B8"}}>
                      {c.label}
                    </span>
                  </div>
                  <span className="text-[11px] font-bold tabular-nums" style={{color:on?c.color:"#CBD5E1"}}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Opciones */}
          <div className="border-t border-gray-100 p-4 space-y-2 shrink-0">
            <button onClick={geocodeAll} disabled={geocoding}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all font-bold text-[12px] border bg-[#EEF3FC] text-[#4E60A9] border-[#4E60A9]/20 hover:bg-[#4E60A9] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed">
              <Navigation size={14} className={geocoding ? "animate-pulse" : ""} />
              {geocoding ? "Geocodificando…" : "Geocodificar todos"}
            </button>
            {geoResult && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-700 bg-green-50 rounded-lg px-2.5 py-1.5">
                <CheckCircle size={11} />
                {geoResult.ok} geocodificados · {geoResult.fail} sin resultado de {geoResult.total}
              </div>
            )}
            <button onClick={()=>setHeatmap(p=>!p)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl transition-all font-bold text-[12px] border ${heatmap?"bg-[#FFF7ED] text-[#EA580C] border-orange-200":"bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:text-[#202538]"}`}>
              <LayoutGrid size={14}/> {heatmap ? "Ocultar heatmap" : "Mostrar heatmap"}
            </button>
            <button onClick={()=>setVisibleStatus(new Set(CAPAS.map(c=>c.key)))}
              className="w-full text-[11px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors py-1.5 text-center">
              Mostrar todas las etapas
            </button>
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 card overflow-hidden relative bg-[#E5ECF6]">
          <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full font-bold text-[#202538] shadow-sm border border-white/60 text-[12px] flex items-center gap-2">
              <MapIcon size={14} className="text-[#34A853]"/>
              {visibles.length} leads activos
            </div>
          </div>
          <MapsView leads={leads} visibleStatus={visibleStatus} heatmap={heatmap} />
        </div>
      </div>
    </div>
  );
}
