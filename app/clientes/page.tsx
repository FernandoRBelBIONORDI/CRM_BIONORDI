"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Phone, Mail, MapPin, Star, Calendar, FileText, Wrench } from "lucide-react";
import { initials, avatarColor, fmtDate } from "@/lib/ui";

interface Lead {
  id: number;
  nombre: string;
  nicho: string;
  sub_nicho?: string;
  telefono?: string;
  correo?: string;
  ciudad?: string;
  estado_republica?: string;
  status_crm: string;
  score_potencial?: number;
  fecha_ultimo_contacto?: string;
  decisor_nombre?: string;
}

const STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  nuevo:        { bg: "#EEF3FC", text: "#5A85F1", label: "Nuevo" },
  contactado:   { bg: "#FFFBEB", text: "#D97706", label: "Contactado" },
  seguimiento:  { bg: "#FFF7ED", text: "#EA580C", label: "Seguimiento" },
  diagnostico:  { bg: "#F5F3FF", text: "#7C3AED", label: "Diagnóstico" },
  cliente:      { bg: "#EEF9F1", text: "#34A853", label: "Cliente" },
  sin_equipo:   { bg: "#F1F5F9", text: "#64748B", label: "Sin equipo" },
  descartado:   { bg: "#FEF2F2", text: "#DC2626", label: "Descartado" },
};


export default function ClientesPage() {
  const [leads, setLeads]     = useState<Lead[]>([]);
  const [query, setQuery]     = useState("");
  const [filtro, setFiltro]   = useState("cliente");
  const [loading, setLoading] = useState(true);

  // cotizaciones y ordenes por lead
  const [stats, setStats] = useState<Record<number, { cot: number; ord: number }>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/leads").then(r => r.json()),
      fetch("/api/cotizaciones").then(r => r.json()),
      fetch("/api/ordenes").then(r => r.json()),
    ]).then(([ld, ct, or]) => {
      setLeads(ld.leads || []);

      const s: Record<number, { cot: number; ord: number }> = {};
      for (const c of ct.cotizaciones || []) {
        if (c.lead_id) {
          s[c.lead_id] = s[c.lead_id] || { cot: 0, ord: 0 };
          s[c.lead_id].cot++;
        }
      }
      for (const o of or.ordenes || []) {
        if (o.lead_id) {
          s[o.lead_id] = s[o.lead_id] || { cot: 0, ord: 0 };
          s[o.lead_id].ord++;
        }
      }
      setStats(s);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = leads.filter(l => {
    if (filtro !== "todos" && l.status_crm !== filtro) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      l.nombre.toLowerCase().includes(q) ||
      (l.nicho || "").toLowerCase().includes(q) ||
      (l.ciudad || "").toLowerCase().includes(q) ||
      (l.telefono || "").includes(q) ||
      (l.decisor_nombre || "").toLowerCase().includes(q)
    );
  });

  const statusOptions = [
    "cliente", "interesado", "propuesta", "negociacion", "todos",
  ];

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#F4F7FB]">

      {/* Header */}
      <div className="bg-white border-b border-[#E8EFF8] px-8 py-5 shrink-0 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight">Clientes</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">Directorio de clientes activos — cotizaciones, órdenes e historial</p>
        </div>
        <span className="text-[12px] font-bold text-[#4E60A9] bg-[#EFF6FF] px-3 py-1 rounded-full">
          {filtered.length} {filtered.length === 1 ? "cliente" : "clientes"}
        </span>
      </div>

      {/* Filtros */}
      <div className="bg-white border-b border-[#E8EFF8] px-8 py-3 shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            data-tour="client-search-input"
            placeholder="Buscar por nombre, especialidad, ciudad..."
            className="w-full pl-8 pr-3 py-2 text-[12px] border border-gray-200 rounded-lg outline-none focus:border-[#4E60A9]/50 bg-white"
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statusOptions.map(s => {
            const cfg = s === "todos" ? { bg: "#F1F5F9", text: "#475569" } : (STATUS_COLOR[s] || { bg: "#F1F5F9", text: "#475569" });
            const active = filtro === s;
            return (
              <button
                key={s}
                onClick={() => setFiltro(s)}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all"
                style={{
                  background: active ? cfg.bg : "white",
                  color: active ? cfg.text : "#94A3B8",
                  borderColor: active ? cfg.text + "40" : "#E2E8F0",
                }}
              >
                {s === "todos" ? "Ver todos" : (STATUS_COLOR[s]?.label || s)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-[13px] text-gray-400">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-[13px] text-gray-400">No se encontraron registros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(l => {
              const st = STATUS_COLOR[l.status_crm] || STATUS_COLOR.nuevo;
              const sc = stats[l.id] || { cot: 0, ord: 0 };
              const color = avatarColor(l.nombre);
              return (
                <Link
                  key={l.id}
                  href={`/clientes/${l.id}`}
                  data-tour={l.nombre.includes("Tutorial") || l.nombre.includes("(Prueba)") ? "tour-client-card" : undefined}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex flex-col overflow-hidden"
                >
                  {/* Header card */}
                  <div className="p-4 flex items-start gap-3">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-[13px] font-extrabold shrink-0"
                      style={{ background: color }}
                    >
                      {initials(l.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[13px] font-extrabold text-[#1E293B] truncate leading-tight">{l.nombre}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{l.sub_nicho || l.nicho || "—"}</p>
                        </div>
                        <span
                          className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ background: st.bg, color: st.text }}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="px-4 pb-3 space-y-1.5">
                    {l.decisor_nombre && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <Star size={11} className="shrink-0 text-amber-400" />
                        <span className="truncate">{l.decisor_nombre}</span>
                      </div>
                    )}
                    {(l.ciudad || l.estado_republica) && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <MapPin size={11} className="shrink-0 text-gray-300" />
                        <span className="truncate">{[l.ciudad, l.estado_republica].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    {l.telefono && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <Phone size={11} className="shrink-0 text-gray-300" />
                        <span>{l.telefono}</span>
                      </div>
                    )}
                    {l.correo && (
                      <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <Mail size={11} className="shrink-0 text-gray-300" />
                        <span className="truncate">{l.correo}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer stats */}
                  <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <FileText size={11} className="text-[#4E60A9]" />
                        <span className="font-bold text-[#4E60A9]">{sc.cot}</span>
                        <span>cot.</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                        <Wrench size={11} className="text-[#7C3AED]" />
                        <span className="font-bold text-[#7C3AED]">{sc.ord}</span>
                        <span>órd.</span>
                      </div>
                    </div>
                    {l.fecha_ultimo_contacto && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <Calendar size={10} />
                        <span>{fmtDate(l.fecha_ultimo_contacto)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
