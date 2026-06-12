"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Calendar, User, MapPin } from "lucide-react";
import { LEAD_STATUS } from "@/lib/estados";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const S_COLOR: Record<string, string> =
  Object.fromEntries(Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.color]));
const S_LABEL: Record<string, string> =
  Object.fromEntries(Object.entries(LEAD_STATUS).map(([k, v]) => [k, v.label]));

// Fecha local (NO toISOString: convierte a UTC y por la tarde-noche en México
// desplazaba "hoy" y los rangos de consulta un día hacia adelante)
function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOf(d: Date): Date {
  const c = new Date(d);
  const day = c.getDay();
  c.setDate(c.getDate() - (day === 0 ? 6 : day - 1));
  c.setHours(0, 0, 0, 0);
  return c;
}

function getWeekDays(anchor: Date): Date[] {
  const mon = mondayOf(anchor);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function getMonthGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  let startDow = first.getDay(); // 0=Sun
  const pad = startDow === 0 ? 6 : startDow - 1; // days from prev month

  const days: Date[] = [];
  for (let i = pad - 1; i >= 0; i--) {
    days.push(new Date(year, month, -i));
  }
  const dim = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= dim; i++) days.push(new Date(year, month, i));
  while (days.length % 7 !== 0) days.push(new Date(year, month + 1, days.length - pad - dim + 1));

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  // drop trailing week if entirely outside month
  while (weeks.length > 4 && weeks[weeks.length - 1].every(d => d.getMonth() !== month)) {
    weeks.pop();
  }
  return weeks;
}

type View = "Mes" | "Semana" | "Día";

interface AgendaEvent {
  lead_id: number;
  lead_nombre: string;
  status_crm: string;
  fecha_proximo_contacto: string;
  asignado_a?: string;
  ciudad?: string;
  nicho?: string;
}

function EventPill({ ev, compact = false }: { ev: AgendaEvent; compact?: boolean }) {
  const color = S_COLOR[ev.status_crm] || "#94A3B8";
  return (
    <a
      href={`/clientes/${ev.lead_id}`}
      className={`block rounded-lg truncate leading-none font-bold hover:opacity-80 transition-opacity ${compact ? "text-[9.5px] px-1.5 py-0.5 mb-0.5" : "text-[11px] px-2 py-1 mb-1"}`}
      style={{ backgroundColor: color + "18", color }}
      title={ev.lead_nombre}
    >
      {ev.lead_nombre}
    </a>
  );
}

function DayCard({ ev }: { ev: AgendaEvent }) {
  const color = S_COLOR[ev.status_crm] || "#94A3B8";
  return (
    <a href={`/clientes/${ev.lead_id}`}
      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-[#4E60A9]/30 hover:shadow-sm transition-all">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-bold text-[#1E293B] truncate">{ev.lead_nombre}</div>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color + "18", color }}>
            {S_LABEL[ev.status_crm] || ev.status_crm}
          </span>
          {ev.ciudad && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium">
              <MapPin size={9} /> {ev.ciudad}
            </span>
          )}
          {ev.asignado_a && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-medium">
              <User size={9} /> {ev.asignado_a}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default function AgendaPage() {
  const [view, setView]       = useState<View>("Mes");
  const [anchor, setAnchor]   = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [events, setEvents]   = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const todayKey = toKey(new Date());

  const fetchEvents = useCallback((from: string, to: string) => {
    setLoading(true);
    fetch(`/api/agenda?from=${from}&to=${to}`)
      .then(r => r.json())
      .then(d => setEvents(d.agenda || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let from: string, to: string;
    if (view === "Mes") {
      from = toKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
      to   = toKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0));
    } else if (view === "Semana") {
      const week = getWeekDays(anchor);
      from = toKey(week[0]);
      to   = toKey(week[6]);
    } else {
      from = to = toKey(anchor);
    }
    fetchEvents(from, to);
  }, [anchor, view, fetchEvents]);

  const byDate = events.reduce<Record<string, AgendaEvent[]>>((acc, ev) => {
    const key = ev.fecha_proximo_contacto?.slice(0, 10);
    if (!key) return acc;
    (acc[key] ??= []).push(ev);
    return acc;
  }, {});

  const navigate = (dir: number) => {
    const d = new Date(anchor);
    if (view === "Mes")    d.setMonth(d.getMonth() + dir);
    else if (view === "Semana") d.setDate(d.getDate() + dir * 7);
    else                   d.setDate(d.getDate() + dir);
    setAnchor(d);
  };

  const goToday = () => { const d = new Date(); d.setHours(0,0,0,0); setAnchor(d); };

  const title = (() => {
    if (view === "Mes") return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (view === "Semana") {
      const w = getWeekDays(anchor);
      const same = w[0].getMonth() === w[6].getMonth();
      return same
        ? `${w[0].getDate()} – ${w[6].getDate()} de ${MONTHS[w[6].getMonth()]} ${w[6].getFullYear()}`
        : `${w[0].getDate()} ${MONTHS[w[0].getMonth()]} – ${w[6].getDate()} ${MONTHS[w[6].getMonth()]} ${w[6].getFullYear()}`;
    }
    return anchor.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  const monthGrid = view === "Mes"    ? getMonthGrid(anchor.getFullYear(), anchor.getMonth()) : [];
  const weekDays  = view === "Semana" ? getWeekDays(anchor) : [];

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <Calendar size={18} className="text-[#4E60A9]" />
          <h1 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight">Agenda</h1>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-0.5">
          {(["Mes", "Semana", "Día"] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-[12px] font-bold px-3.5 py-1.5 rounded-lg transition-all ${
                view === v ? "bg-white text-[#4E60A9] shadow-sm" : "text-gray-400 hover:text-gray-600"
              }`}>
              {v}
            </button>
          ))}
        </div>

        {/* Nav */}
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={goToday}
            className="text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-1.5 rounded-lg transition-colors">
            Hoy
          </button>
          <div className="flex items-center gap-0.5">
            <button onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <span className="text-[14px] font-bold text-[#1E293B] capitalize w-[260px] text-center select-none">
              {title}
            </span>
            <button onClick={() => navigate(1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
          {loading && (
            <div className="w-3.5 h-3.5 border-2 border-[#4E60A9] border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {/* ── Month view ── */}
      {view === "Mes" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em]">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 grid overflow-y-auto" style={{ gridTemplateRows: `repeat(${monthGrid.length}, 1fr)` }}>
            {monthGrid.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 min-h-[110px]">
                {week.map((day, di) => {
                  const key    = toKey(day);
                  const evs    = byDate[key] || [];
                  const isToday   = key === todayKey;
                  const isCurMo   = day.getMonth() === anchor.getMonth();
                  const MAX_SHOW  = 3;
                  return (
                    <div key={di}
                      className={`border-b border-r border-gray-100 p-1.5 overflow-hidden ${
                        isToday   ? "bg-[#EEF3FC]" :
                        isCurMo   ? "bg-white hover:bg-gray-50/80" :
                        "bg-gray-50/50"
                      } transition-colors`}>
                      {/* Day number */}
                      <div className="mb-1">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold ${
                          isToday  ? "bg-[#4E60A9] text-white" :
                          isCurMo  ? "text-[#1E293B]" :
                          "text-gray-300"
                        }`}>
                          {day.getDate()}
                        </span>
                      </div>
                      {/* Events */}
                      {evs.slice(0, MAX_SHOW).map((ev, i) => (
                        <EventPill key={i} ev={ev} compact />
                      ))}
                      {evs.length > MAX_SHOW && (
                        <div className="text-[9px] font-bold text-gray-400 pl-1">
                          +{evs.length - MAX_SHOW} más
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Week view ── */}
      {view === "Semana" && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 shrink-0">
            {weekDays.map((day, i) => {
              const key     = toKey(day);
              const isToday = key === todayKey;
              const count   = (byDate[key] || []).length;
              return (
                <div key={i} className={`py-3 text-center border-r border-gray-100 ${isToday ? "bg-[#EEF3FC]" : ""}`}>
                  <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-[0.1em]">{DAYS[i]}</div>
                  <div className={`text-[22px] font-extrabold mt-0.5 leading-none ${isToday ? "text-[#4E60A9]" : "text-[#1E293B]"}`}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <div className={`mt-1 text-[9px] font-bold ${isToday ? "text-[#4E60A9]" : "text-gray-400"}`}>
                      {count} evento{count > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Columns */}
          <div className="grid grid-cols-7 flex-1 overflow-y-auto divide-x divide-gray-100">
            {weekDays.map((day, i) => {
              const key  = toKey(day);
              const evs  = byDate[key] || [];
              const isToday = key === todayKey;
              return (
                <div key={i} className={`p-2 overflow-hidden ${isToday ? "bg-[#EEF3FC]/40" : ""}`}>
                  {evs.length === 0 ? (
                    <div className="h-full flex items-start justify-center pt-8 text-[11px] text-gray-200 select-none">—</div>
                  ) : (
                    evs.map((ev, j) => {
                      const color = S_COLOR[ev.status_crm] || "#94A3B8";
                      return (
                        <div key={j} className="mb-2 p-2 rounded-xl bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                          <div className="text-[11px] font-bold text-[#1E293B] truncate mb-1">{ev.lead_nombre}</div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: color + "18", color }}>
                            {S_LABEL[ev.status_crm] || ev.status_crm}
                          </span>
                          {ev.asignado_a && (
                            <div className="flex items-center gap-0.5 mt-1 text-[9px] text-gray-400">
                              <User size={8} /> {ev.asignado_a}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Day view ── */}
      {view === "Día" && (
        <div className="flex-1 overflow-y-auto p-6">
          {(() => {
            const key = toKey(anchor);
            const evs = byDate[key] || [];
            if (evs.length === 0) return (
              <div className="text-center py-24 text-gray-400">
                <Calendar size={40} className="mx-auto mb-4 opacity-20" />
                <p className="text-[15px] font-semibold">Sin eventos para este día</p>
                <p className="text-[12px] mt-1">Navega a otra fecha o agrega seguimientos desde el CRM.</p>
              </div>
            );
            return (
              <div className="max-w-2xl mx-auto space-y-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                  {evs.length} seguimiento{evs.length > 1 ? "s" : ""} programado{evs.length > 1 ? "s" : ""}
                </p>
                {evs.map((ev, i) => <DayCard key={i} ev={ev} />)}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
