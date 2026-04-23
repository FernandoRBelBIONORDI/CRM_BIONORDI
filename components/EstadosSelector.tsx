"use client";

import { useState } from "react";
import { Search, MapPin, X, ChevronRight } from "lucide-react";
import municipiosData from "@/data/municipios_mexico.json";

const ESTADOS = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche",
  "Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango",
  "Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco",
  "Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla",
  "Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora",
  "Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

const REGIONES: { nombre: string; color: string; estados: string[] }[] = [
  { nombre:"Norte",   color:"#4F46E5", estados:["Baja California","Baja California Sur","Sonora","Chihuahua","Coahuila","Nuevo León","Tamaulipas","Durango","Sinaloa","Zacatecas"] },
  { nombre:"Centro",  color:"#059669", estados:["San Luis Potosí","Nayarit","Jalisco","Aguascalientes","Guanajuato","Querétaro","Michoacán","Colima","Estado de México","Ciudad de México","Hidalgo","Tlaxcala","Morelos"] },
  { nombre:"Sur",     color:"#D97706", estados:["Guerrero","Veracruz","Puebla","Oaxaca","Tabasco","Chiapas","Campeche","Yucatán","Quintana Roo"] },
];

interface Props {
  leadsPorEstado: Record<string, number>;
  estadoSeleccionado: string;
  municipioSeleccionado?: string;
  onEstadoSelect: (estado: string) => void;
  onMunicipioSelect?: (municipio: string) => void;
}

export default function EstadosSelector({ leadsPorEstado, estadoSeleccionado, municipioSeleccionado, onEstadoSelect, onMunicipioSelect }: Props) {
  const [search, setSearch] = useState("");

  const maxLeads = Math.max(...Object.values(leadsPorEstado), 1);
  const totalLeads = Object.values(leadsPorEstado).reduce((a, b) => a + b, 0);
  const estadosConLeads = Object.keys(leadsPorEstado).filter(k => leadsPorEstado[k] > 0).length;

  const municipios: string[] = estadoSeleccionado
    ? (municipiosData as Record<string, string[]>)[estadoSeleccionado] || []
    : [];

  const filtered = search
    ? ESTADOS.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : null;

  const renderEstado = (estado: string, regionColor: string) => {
    const count = leadsPorEstado[estado] || 0;
    const pct = count > 0 ? (count / maxLeads) * 100 : 0;
    const isSelected = estadoSeleccionado === estado;

    return (
      <div key={estado}>
        <button
          onClick={() => { onEstadoSelect(isSelected ? "" : estado); onMunicipioSelect?.(""); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left group ${
            isSelected
              ? "bg-[#EEF3FC] border border-[#427DFA]/20"
              : count > 0
                ? "hover:bg-[#F8FAFC] border border-transparent hover:border-gray-100"
                : "opacity-40 border border-transparent hover:opacity-60"
          }`}
        >
          <div className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: isSelected ? "#427DFA" : count > 0 ? regionColor : "#E2E8F4" }} />
          <div className="flex-1 min-w-0">
            <div className={`text-[12px] font-semibold leading-tight truncate ${isSelected ? "text-[#427DFA]" : "text-[#1E293B]"}`}>
              {estado}
            </div>
            {count > 0 && (
              <div className="w-full h-[3px] bg-gray-100 rounded-full mt-1 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: isSelected ? "#427DFA" : regionColor, opacity: 0.5 + pct / 200 }} />
              </div>
            )}
          </div>
          {count > 0 && (
            <span className={`text-[10px] font-bold shrink-0 tabular-nums px-1.5 py-0.5 rounded-full ${
              isSelected ? "bg-[#427DFA] text-white" : "bg-[#F1F5F9] text-[#64748B]"
            }`}>{count}</span>
          )}
          {municipios.length > 0 && isSelected
            ? <ChevronRight size={12} className="text-[#427DFA] shrink-0 rotate-90" />
            : isSelected ? null
            : null}
        </button>

        {/* Municipios desplegables */}
        {isSelected && municipios.length > 0 && (
          <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l-2 border-[#427DFA]/20 pl-2">
            <button
              onClick={() => onMunicipioSelect?.("")}
              className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                !municipioSeleccionado ? "text-[#427DFA] bg-[#EEF3FC]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              }`}
            >
              Todos los municipios
            </button>
            {municipios.map(m => (
              <button key={m}
                onClick={() => onMunicipioSelect?.(municipioSeleccionado === m ? "" : m)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                  municipioSeleccionado === m
                    ? "font-bold text-[#427DFA] bg-[#EEF3FC]"
                    : "font-medium text-gray-500 hover:text-[#1E293B] hover:bg-gray-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">

      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar estado..."
            className="w-full bg-[#F8FAFC] border border-gray-100 rounded-xl pl-8 pr-3 py-2 text-[12px] outline-none focus:border-[#427DFA]/40 focus:bg-white transition-all placeholder:text-gray-400" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Active filter banner */}
      {(estadoSeleccionado || municipioSeleccionado) && !search && (
        <div className="mx-3 mb-2 px-3 py-2 bg-[#EEF3FC] rounded-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-[#427DFA]" />
            <span className="text-[11px] font-bold text-[#427DFA]">
              {municipioSeleccionado || estadoSeleccionado}
            </span>
            {!municipioSeleccionado && leadsPorEstado[estadoSeleccionado] && (
              <span className="text-[10px] text-[#427DFA]/70">· {leadsPorEstado[estadoSeleccionado]} leads</span>
            )}
          </div>
          <button onClick={() => { onEstadoSelect(""); onMunicipioSelect?.(""); }}
            className="text-[#427DFA]/60 hover:text-[#427DFA] transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Estado list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered ? (
          <div className="space-y-0.5 pt-1">
            {filtered.length === 0
              ? <div className="py-8 text-center text-[12px] text-gray-400">Sin resultados</div>
              : filtered.map(estado => {
                  const region = REGIONES.find(r => r.estados.includes(estado));
                  return renderEstado(estado, region?.color || "#64748B");
                })}
          </div>
        ) : (
          REGIONES.map(region => (
            <div key={region.nombre} className="mb-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: region.color }} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{region.nombre}</span>
              </div>
              <div className="space-y-0.5">
                {region.estados.map(e => renderEstado(e, region.color))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 px-4 py-2.5 shrink-0 flex items-center justify-between">
        <span className="text-[11px] text-gray-400 font-medium">{estadosConLeads} estados con leads</span>
        <span className="text-[11px] font-bold text-[#427DFA]">{totalLeads} total</span>
      </div>
    </div>
  );
}
