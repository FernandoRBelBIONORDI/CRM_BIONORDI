"use client";

import { useState, useEffect } from "react";
import { FileText, Search, Plus, X, Trash2, Activity, Check, Clock, Download, Eye, Edit3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/hooks/useConfirm";
import CotizacionManualModal from "@/components/CotizacionManualModal";
import DocumentViewerModal from "@/components/DocumentViewerModal";

interface Cotizacion {
  id: number;
  folio: string;
  tipo: string;
  lead_id?: number;
  lead_nombre?: string;
  monto_total: number;
  status: string;
  fecha: string;
  eq_tipo?: string;
  eq_marca?: string;
  eq_modelo?: string;
  notas?: string;
  pdf_path?: string;
}

const TIPO_INFO: Record<string, { label: string; color: string; bg: string }> = {
  reparacion:    { label: "Reparación",    color: "#4E60A9", bg: "#EEF3FC" },
  mantenimiento: { label: "Mantenimiento", color: "#059669", bg: "#ECFDF5" },
  venta:         { label: "Venta",         color: "#7C3AED", bg: "#F5F3FF" },
  consumibles:   { label: "Consumibles",   color: "#D97706", bg: "#FFFBEB" },
};

const STATUS_INFO: Record<string, { label: string; color: string; bg: string }> = {
  enviada:   { label: "Enviada",   color: "#4E60A9", bg: "#EEF3FC" },
  aprobada:  { label: "Aprobada",  color: "#059669", bg: "#ECFDF5" },
  rechazada: { label: "Rechazada", color: "#DC2626", bg: "#FEF2F2" },
  borrador:  { label: "Borrador",  color: "#94A3B8", bg: "#F1F5F9" },
};

function tipoInfo(t: string) { return TIPO_INFO[t] || { label: t, color: "#64748B", bg: "#F1F5F9" }; }
function statusInfo(s: string) { return STATUS_INFO[s] || { label: s, color: "#64748B", bg: "#F1F5F9" }; }

export default function CotizacionesPage() {
  const router = useRouter();
  const { confirm, ConfirmDialog } = useConfirm();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [selected, setSelected] = useState<Cotizacion | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [editingCotizacion, setEditingCotizacion] = useState<Cotizacion | null>(null);

  const handleEdit = (c: Cotizacion) => {
    router.push(`/cotizar/${c.tipo}?id=${c.id}`);
  };

  const fetchCotizaciones = async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/cotizaciones").then(r => r.json());
      setCotizaciones(d.cotizaciones || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchCotizaciones(); }, []);

  const filtered = cotizaciones.filter(c => {
    if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (q) {
      const txt = q.toLowerCase();
      return (
        c.folio?.toLowerCase().includes(txt) ||
        c.lead_nombre?.toLowerCase().includes(txt) ||
        c.eq_tipo?.toLowerCase().includes(txt) ||
        c.eq_marca?.toLowerCase().includes(txt)
      );
    }
    return true;
  });

  const changeStatus = async (id: number, status: string) => {
    setChangingStatus(true);
    await fetch(`/api/cotizaciones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(r => r.json()).then(d => {
      if (d.cotizacion) {
        setCotizaciones(p => p.map(c => c.id === id ? { ...c, status } : c));
        if (selected?.id === id) setSelected(p => p ? { ...p, status } : p);
      }
    }).catch(() => {});
    setChangingStatus(false);
  };

  const deleteCot = async (id: number) => {
    await fetch(`/api/cotizaciones/${id}`, { method: "DELETE" });
    setCotizaciones(p => p.filter(c => c.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const metrics = {
    total:     cotizaciones.length,
    enviadas:  cotizaciones.filter(c => c.status === "enviada").length,
    aprobadas: cotizaciones.filter(c => c.status === "aprobada").length,
    monto:     cotizaciones.filter(c => c.status === "aprobada").reduce((s, c) => s + (c.monto_total || 0), 0),
  };

  return (
    <div className="flex-1 flex flex-col font-sans overflow-hidden">
      <ConfirmDialog />
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 bg-white border-b border-[#E8EFF8] shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[22px] md:text-[26px] font-extrabold text-[#202538] leading-tight tracking-[-0.03em]">Cotizaciones</h1>
            <p className="text-[#8B95A5] text-[12px] font-medium mt-0.5">Historial y seguimiento de todas las propuestas</p>
          </div>
          <Link href="/cotizar"
            className="flex items-center gap-2 text-[12px] font-bold text-white bg-[#4E60A9] hover:bg-[#3B4F9A] px-4 py-2.5 rounded-xl transition-colors shrink-0">
            <Plus size={13} /> Nueva cotización
          </Link>
        </div>

        {/* Métricas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {[
            { label: "Total",     val: metrics.total,     color: "#4E60A9", bg: "#EEF3FC" },
            { label: "Enviadas",  val: metrics.enviadas,  color: "#0E7490", bg: "#ECFEFF" },
            { label: "Aprobadas", val: metrics.aprobadas, color: "#059669", bg: "#ECFDF5" },
            { label: "Facturado aprobado", val: `$${metrics.monto.toLocaleString("es-MX")}`, color: "#059669", bg: "#ECFDF5" },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-gray-100 bg-white shadow-sm shrink-0">
              <span className="text-[17px] font-extrabold tabular-nums" style={{ color: m.color }}>{m.val}</span>
              <span className="text-[10px] font-bold text-gray-400">{m.label}</span>
            </div>
          ))}
        </div>

        {/* Búsqueda + filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por folio, cliente, equipo…"
              className="w-full text-[12px] font-medium bg-gray-50 border border-gray-200 rounded-full pl-9 pr-3 py-2 outline-none focus:border-[#4E60A9]/40" />
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="text-[11px] font-bold bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-[#4E60A9]/40 cursor-pointer">
            <option value="todos">Todos los tipos</option>
            <option value="reparacion">Reparación</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="venta">Venta</option>
            <option value="consumibles">Consumibles</option>
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}
            className="text-[11px] font-bold bg-gray-50 border border-gray-200 rounded-full px-3 py-2 outline-none focus:border-[#4E60A9]/40 cursor-pointer">
            <option value="todos">Todos los estados</option>
            <option value="enviada">Enviadas</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
            <option value="borrador">Borradores</option>
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">

        {/* Lista */}
        <div className={`${selected ? "hidden md:flex" : "flex"} flex-col flex-1 overflow-y-auto`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Activity size={22} className="animate-spin text-[#4E60A9]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 py-20">
              <FileText size={36} className="text-gray-200" />
              <p className="text-[13px] font-bold">No hay cotizaciones{q ? " que coincidan" : " guardadas"}</p>
              <Link href="/cotizar" className="text-[12px] font-bold text-[#4E60A9] hover:underline">
                Crear primera cotización →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(c => {
                const ti = tipoInfo(c.tipo);
                const si = statusInfo(c.status);
                const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
                return (
                  <div key={c.id}
                    onClick={() => setSelected(c)}
                    className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${selected?.id === c.id ? "bg-[#EEF3FC]" : "hover:bg-gray-50"}`}>
                    {/* Tipo badge */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: ti.bg }}>
                      <FileText size={14} style={{ color: ti.color }} />
                    </div>

                    {/* Info principal */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[11px] font-black text-[#4E60A9] font-mono">{c.folio || "—"}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ color: ti.color, background: ti.bg }}>{ti.label}</span>
                      </div>
                      <div className="text-[13px] font-bold text-[#1E293B] truncate">
                        {c.lead_nombre || "Sin cliente"}
                      </div>
                      {(c.eq_tipo || c.eq_marca) && (
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">
                          {[c.eq_tipo, c.eq_marca, c.eq_modelo].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>

                    {/* Derecha */}
                    <div className="text-right shrink-0">
                      {c.monto_total > 0 && (
                        <div className="text-[13px] font-extrabold text-[#1E293B] tabular-nums">
                          ${c.monto_total.toLocaleString("es-MX")}
                        </div>
                      )}
                      <div className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                        style={{ color: si.color, background: si.bg }}>{si.label}</div>
                      <div className="text-[10px] text-gray-400 mt-1">{fecha}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panel lateral de detalle */}
        {selected && (
          <div className="w-full md:w-[380px] border-l border-gray-100 bg-white flex flex-col shrink-0 overflow-hidden">
            {/* Header panel */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black text-[#4E60A9] font-mono">{selected.folio || "—"}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: tipoInfo(selected.tipo).color, background: tipoInfo(selected.tipo).bg }}>
                    {tipoInfo(selected.tipo).label}
                  </span>
                </div>
                <h2 className="text-[16px] font-extrabold text-[#1E293B] leading-tight truncate">
                  {selected.lead_nombre || "Sin cliente"}
                </h2>
              </div>
              <button onClick={() => setSelected(null)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 transition-colors shrink-0">
                <X size={14} />
              </button>
            </div>

            {/* Scroll content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Monto */}
              {selected.monto_total > 0 && (
                <div className="bg-[#F8FAFC] rounded-xl border border-gray-100 px-4 py-3">
                  <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1">Monto total</div>
                  <div className="text-[24px] font-extrabold text-[#1E293B] tabular-nums">
                    ${selected.monto_total.toLocaleString("es-MX")}
                    <span className="text-[13px] font-medium text-gray-400 ml-1">MXN</span>
                  </div>
                </div>
              )}

              {/* Equipo */}
              {(selected.eq_tipo || selected.eq_marca) && (
                <div>
                  <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Equipo</div>
                  <div className="text-[13px] font-bold text-[#1E293B]">
                    {[selected.eq_tipo, selected.eq_marca, selected.eq_modelo].filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}

              {/* Notas */}
              {selected.notas && (
                <div>
                  <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Notas</div>
                  <p className="text-[12px] text-[#475569] leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                    {selected.notas}
                  </p>
                </div>
              )}

              {/* Fecha */}
              <div>
                <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Fecha</div>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#475569]">
                  <Clock size={12} className="text-gray-400" />
                  {selected.fecha ? new Date(selected.fecha).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
                </div>
              </div>

              {/* Cambiar status */}
              <div>
                <div className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-2">Estado</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(STATUS_INFO).map(([val, info]) => (
                    <button key={val}
                      disabled={changingStatus}
                      onClick={() => changeStatus(selected.id, val)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] font-bold transition-all ${selected.status === val ? "border-current" : "border-gray-100 hover:border-gray-200 bg-gray-50"}`}
                      style={selected.status === val ? { color: info.color, background: info.bg, borderColor: info.color + "40" } : {}}>
                      {selected.status === val && <Check size={10} />}
                      {info.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF */}
              <div className="flex gap-2">
                {selected.pdf_path ? (
                  <>
                    <button onClick={() => setPdfViewerUrl(`${selected.pdf_path}?t=${Date.now()}`)}
                      className="flex-1 flex items-center justify-center gap-2 text-[12px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] px-3 py-2.5 rounded-xl border border-[#4E60A9]/20 transition-colors">
                      <Eye size={13} /> Ver PDF
                    </button>
                    <a href={`${selected.pdf_path}?t=${Date.now()}`} download
                      className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 hover:bg-gray-100 px-3 py-2.5 rounded-xl border border-gray-200 transition-colors">
                      <Download size={13} />
                    </a>
                  </>
                ) : (
                  <button onClick={() => handleEdit(selected)}
                    className="flex-1 flex items-center justify-center gap-2 text-[12px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] px-3 py-2.5 rounded-xl border border-[#4E60A9]/20 transition-colors">
                    <Eye size={13} /> Generar / Ver PDF
                  </button>
                )}
              </div>
            </div>

            {/* Footer panel */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => {
                  confirm({
                    message: `¿Eliminar cotización ${selected.folio}?`,
                    onConfirm: () => deleteCot(selected.id)
                  });
                }}
                className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 hover:text-[#DC2626] hover:bg-[#FEF2F2] px-3 py-2 rounded-full transition-colors">
                <Trash2 size={12} /> Eliminar
              </button>
              <div className="flex gap-1.5">
                <button onClick={() => handleEdit(selected)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 hover:text-[#1E293B] hover:bg-gray-100 px-3 py-2 rounded-full transition-colors">
                  <Edit3 size={12} /> Editar
                </button>
                <Link href="/cotizar"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] px-3 py-2 rounded-full transition-colors">
                  <Plus size={12} /> Nueva
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PDF Viewer overlay */}
      {pdfViewerUrl && (
        <DocumentViewerModal
          title={`Cotización — ${selected?.folio || "Documento"}`}
          url={pdfViewerUrl}
          downloadName={`${selected?.folio || "cotizacion"}.pdf`}
          onClose={() => setPdfViewerUrl(null)}
          editAction={{
            label: "Editar",
            onClick: () => {
              if (selected) handleEdit(selected);
              setPdfViewerUrl(null);
            }
          }}
        />
      )}

      {/* Edit Modal */}
      {editingCotizacion && (
        <CotizacionManualModal
          initialCotizacion={editingCotizacion}
          onClose={() => {
            setEditingCotizacion(null);
            fetchCotizaciones();
          }}
          onSuccess={() => {
            fetchCotizaciones();
          }}
        />
      )}
    </div>
  );
}
