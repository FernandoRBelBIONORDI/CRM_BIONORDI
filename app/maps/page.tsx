"use client";

import { useEffect, useRef, useState } from "react";
import MapsView from "@/components/MapsView";
import { Layers, Map as MapIcon, LayoutGrid, MapPin, Search, Filter } from "lucide-react";

const CAPAS = [
  { key: "nuevo",       label: "Nuevo",       color: "#4F46E5", bg: "#EEF3FC" },
  { key: "contactado",  label: "Contactado",  color: "#D97706", bg: "#FFFBEB" },
  { key: "seguimiento", label: "Seguimiento", color: "#EA580C", bg: "#FFF7ED" },
  { key: "diagnostico", label: "Diagnóstico", color: "#7C3AED", bg: "#F5F3FF" },
  { key: "cliente",     label: "Cliente",     color: "#059669", bg: "#ECFDF5" },
  { key: "descartado",  label: "Descartado",  color: "#DC2626", bg: "#FEF2F2" },
];

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

export default function MapsPage() {
  const [leads, setLeads]                 = useState<any[]>([]);
  const [total, setTotal]                 = useState(0);
  const [visibleStatus, setVisibleStatus] = useState<Set<string>>(new Set(CAPAS.map(c => c.key)));
  const [heatmap, setHeatmap]             = useState(false);
  const [geocoding, setGeocoding]         = useState(0); // leads pendientes de geocodificar
  const geocodeStarted                    = useRef(false);

  // States para filtros interactivos
  const [searchTerm, setSearchTerm]       = useState("");
  const [selectedNiche, setSelectedNiche] = useState("todos");
  const [minScore, setMinScore]           = useState("todos");
  const [hasUltrasound, setHasUltrasound] = useState("todos");
  const [selectedAgent, setSelectedAgent] = useState("todos");
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [showFilters, setShowFilters]     = useState(false);

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

    // Solo geocodificar leads que tienen dirección pero lat/lng son null (no se han intentado)
    const pending = leads.filter(l => l.latitud == null && l.longitud == null && l.direccion);
    if (!pending.length) return;

    setGeocoding(pending.length);
    let cancelled = false;

    (async () => {
      for (let i = 0; i < pending.length; i++) {
        if (cancelled) break;

        // Nominatim permite 1 req/seg
        if (i > 0) await new Promise(r => setTimeout(r, 1250));
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
          } else {
            // Si Nominatim no encuentra dirección, se marca localmente como fallido para no reintentar
            setLeads(prev =>
              prev.map(l => l.id === pending[i].id ? { ...l, latitud: 0, longitud: 0 } : l)
            );
          }
        } catch {
          // Si hay error de red, marcar localmente temporalmente como 0 para evitar reintentar en bucle continuo
          setLeads(prev =>
            prev.map(l => l.id === pending[i].id ? { ...l, latitud: 0, longitud: 0 } : l)
          );
        }

        setGeocoding(prev => Math.max(0, prev - 1));
      }
    })();

    return () => { cancelled = true; };
  }, [leads.length]);

  const toggleStatus = (key: string) => setVisibleStatus(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  // Obtener valores únicos para filtros dinámicos
  const niches = Array.from(new Set(leads.map(l => l.nicho).filter(Boolean))) as string[];
  const agents = Array.from(new Set(leads.map(l => l.asignado_a).filter(Boolean))) as string[];

  // Filtro de leads combinando todas las opciones
  const filteredLeads = leads.filter(lead => {
    // 1. Etapa CRM
    if (!visibleStatus.has(lead.status_crm)) return false;

    // 2. Buscador por texto (nombre, ciudad, dirección, nicho)
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      const matchName = lead.nombre?.toLowerCase().includes(term);
      const matchCity = lead.ciudad?.toLowerCase().includes(term);
      const matchDir = lead.direccion?.toLowerCase().includes(term);
      const matchNicho = lead.nicho?.toLowerCase().includes(term);
      if (!matchName && !matchCity && !matchDir && !matchNicho) return false;
    }

    // 3. Nicho / Especialidad
    if (selectedNiche !== "todos" && lead.nicho !== selectedNiche) return false;

    // 4. Score potencial mínimo
    if (minScore !== "todos") {
      const scoreNum = Number(minScore);
      if (!lead.score_potencial || lead.score_potencial < scoreNum) return false;
    }

    // 5. Tiene ultrasonido
    if (hasUltrasound !== "todos") {
      const value = lead.tiene_ultrasonido ? String(lead.tiene_ultrasonido).toLowerCase().trim() : "";
      if (hasUltrasound === "si") {
        if (!value.startsWith("s") && value !== "yes" && value !== "true") return false;
      } else if (hasUltrasound === "no") {
        if (!value.startsWith("n") && value !== "false") return false;
      } else if (hasUltrasound === "sin_registrar") {
        if (value !== "" && value !== "null" && value !== "undefined") return false;
      }
    }

    // 6. Agente asignado
    if (selectedAgent !== "todos" && lead.asignado_a !== selectedAgent) return false;

    return true;
  });

  const visibles = filteredLeads;
  const geocoded = filteredLeads.filter(l => l.latitud != null && l.latitud !== 0).length;

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedNiche("todos");
    setMinScore("todos");
    setHasUltrasound("todos");
    setSelectedAgent("todos");
    setVisibleStatus(new Set(CAPAS.map(c => c.key)));
  };

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

        {/* Panel lateral de Búsqueda y Filtros */}
        <div className="w-[360px] shrink-0 card flex flex-col overflow-hidden bg-white shadow-md rounded-2xl border border-gray-100">

          {/* Buscador */}
          <div className="p-4 border-b border-gray-100 space-y-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Buscar lead, ciudad..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-8 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#4E60A9]/30 transition-all font-medium text-gray-700"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[14px]"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(p => !p)}
              className="flex items-center justify-between w-full text-[11px] text-[#4E60A9] font-bold hover:underline px-1 py-0.5"
            >
              <span className="flex items-center gap-1">
                <Filter size={12} />
                {showFilters ? "Ocultar filtros avanzados" : "Filtros avanzados"}
              </span>
              {(selectedNiche !== "todos" || minScore !== "todos" || hasUltrasound !== "todos" || selectedAgent !== "todos") && (
                <span className="w-2 h-2 rounded-full bg-[#EA580C]" />
              )}
            </button>

            {/* Panel de Filtros Avanzados */}
            {showFilters && (
              <div className="space-y-2.5 bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2 text-[12px] animate-fadeIn">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Especialidad (Nicho)</label>
                  <select
                    value={selectedNiche}
                    onChange={e => setSelectedNiche(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none"
                  >
                    <option value="todos">Todas</option>
                    {niches.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Score Mínimo</label>
                    <select
                      value={minScore}
                      onChange={e => setMinScore(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none"
                    >
                      <option value="todos">Todos</option>
                      <option value="4">≥ 4</option>
                      <option value="7">≥ 7</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ultrasonido</label>
                    <select
                      value={hasUltrasound}
                      onChange={e => setHasUltrasound(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none"
                    >
                      <option value="todos">Todos</option>
                      <option value="si">Tiene (Sí)</option>
                      <option value="no">No tiene (No)</option>
                      <option value="sin_registrar">Sin registrar</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Agente Asignado</label>
                  <select
                    value={selectedAgent}
                    onChange={e => setSelectedAgent(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none"
                  >
                    <option value="todos">Cualquiera</option>
                    {agents.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Etapas CRM */}
          <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-[#4E60A9]" />
              <span className="font-bold text-[12px] text-[#202538]">Etapas CRM</span>
            </div>
            <button
              onClick={() => setVisibleStatus(new Set(CAPAS.map(c => c.key)))}
              className="text-[10px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors"
            >
              Ver todas
            </button>
          </div>

          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5 shrink-0">
            {CAPAS.map(c => {
              const cnt = leads.filter(l => l.status_crm === c.key).length;
              const on  = visibleStatus.has(c.key);
              return (
                <button
                  key={c.key}
                  onClick={() => toggleStatus(c.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                    on
                      ? "border-transparent text-white"
                      : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                  style={on ? { backgroundColor: c.color } : undefined}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-white" : ""}`} style={!on ? { backgroundColor: c.color } : undefined} />
                  {c.label}
                  <span className={`text-[10px] font-bold ml-0.5 ${on ? "opacity-90" : "text-gray-300"}`}>{cnt}</span>
                </button>
              );
            })}
          </div>

          {/* Lista de Resultados de Leads */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#F8FAFC]">
            {filteredLeads.map(lead => {
              const precise = lead.latitud != null && lead.longitud != null && lead.latitud !== 0 && lead.longitud !== 0;
              const color = STATUS_COLORS[lead.status_crm] || "#6B7280";
              const bg = STATUS_BG[lead.status_crm] || "#F1F5F9";
              const label = STATUS_LABELS[lead.status_crm] || lead.status_crm;
              const isSelected = selectedLeadId === lead.id;

              return (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer bg-white ${
                    isSelected
                      ? "border-[#4E60A9] bg-[#4E60A9]/5 shadow-sm ring-1 ring-[#4E60A9]/20"
                      : "border-gray-200/60 hover:border-gray-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-semibold text-[13px] text-[#202538] leading-snug line-clamp-1 flex-1">
                      {lead.nombre}
                    </span>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase" style={{ backgroundColor: bg, color: color }}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                    <span className="truncate max-w-[170px]">
                      {[lead.ciudad, lead.estado_republica].filter(Boolean).join(", ") || "Ubicación sin registrar"}
                    </span>
                    {lead.score_potencial && (
                      <span className="font-bold text-[#EA580C] bg-[#FFF7ED] px-1.5 py-0.5 rounded text-[10px]">
                        Score: {lead.score_potencial}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100">
                    <span className="italic truncate max-w-[180px]">
                      {[lead.nicho, lead.sub_nicho].filter(Boolean).join(" · ") || "Sin especialidad"}
                    </span>
                    <span className="flex items-center gap-1 shrink-0 font-medium text-[9px]">
                      {precise ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-green-600 font-semibold">Exacta</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span className="text-amber-600 font-semibold">Aprox.</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-[12px] font-medium">
                No se encontraron leads
              </div>
            )}
          </div>

          {/* Opciones y Leyenda al pie */}
          <div className="border-t border-gray-100 p-4 space-y-2.5 shrink-0 bg-white">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#4E60A9]" />
                <span>Exacta</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Aproximada</span>
              </div>
              <button onClick={resetFilters} className="text-[#4E60A9] font-bold hover:underline">
                Limpiar filtros
              </button>
            </div>

            <button
              onClick={() => setHeatmap(p => !p)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl transition-all font-bold text-[12px] border ${
                heatmap
                  ? "bg-[#FFF7ED] text-[#EA580C] border-orange-200"
                  : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-white hover:text-[#202538]"
              }`}
            >
              <LayoutGrid size={14} /> {heatmap ? "Ocultar densidad (Heatmap)" : "Mostrar densidad (Heatmap)"}
            </button>
          </div>
        </div>

        {/* Mapa */}
        <div className="flex-1 card overflow-hidden relative bg-[#E5ECF6] rounded-2xl shadow-md border border-gray-100">

          {/* Badge de leads activos */}
          <div className="absolute top-4 left-4 z-[1000] pointer-events-none flex flex-col gap-2">
            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full font-bold text-[#202538] shadow-md border border-white/60 text-[12px] flex items-center gap-2">
              <MapIcon size={14} className="text-[#34A853]" />
              {visibles.length} leads activos
            </div>
            {geocoding > 0 && (
              <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-full text-[#7C3AED] shadow-md border border-purple-100/60 text-[11px] flex items-center gap-2 font-semibold">
                <MapPin size={12} className="animate-pulse" />
                Geocodificando {geocoding} direcciones…
              </div>
            )}
          </div>

          <MapsView leads={leads} visibleStatus={visibleStatus} heatmap={heatmap} selectedLeadId={selectedLeadId} />
        </div>
      </div>
    </div>
  );
}
