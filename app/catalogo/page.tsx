"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, X, ImageIcon, Search, FileText, ExternalLink, Camera, Upload, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

interface Equipo {
  id: number;
  tipo: string;
  marca: string;
  modelo: string;
  descripcion: string;
  imagen_path: string;
  fotos_json: string | null;
  brochure_path: string | null;
  notas: string;
}

function parseFotos(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const TIPOS = ["transductor", "ultrasonido", "equipo_movil", "monitor", "otro"];
const TIPO_LABELS: Record<string, string> = {
  transductor: "Transductor",
  ultrasonido: "Ultrasonido",
  equipo_movil: "Equipo Móvil",
  monitor: "Monitor",
  otro: "Otro",
};
const TIPO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  transductor: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
  ultrasonido: { bg: "bg-cyan-50", text: "text-cyan-700", dot: "bg-cyan-400" },
  equipo_movil: { bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  monitor: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400" },
  otro: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";
const sel = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white appearance-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  );
}

async function uploadFile(file: File, subfolder = "equipos"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("subfolder", subfolder);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  const data = await res.json();
  return data.path || "";
}

// ─── Modal de edición ────────────────────────────────────────────────────────

function EquipoModal({ equipo, onSave, onClose }: {
  equipo?: Equipo;
  onSave: (e: Equipo) => void;
  onClose: () => void;
}) {
  const [tipo, setTipo] = useState(equipo?.tipo || "transductor");
  const [marca, setMarca] = useState(equipo?.marca || "");
  const [modelo, setModelo] = useState(equipo?.modelo || "");
  const [descripcion, setDescripcion] = useState(equipo?.descripcion || "");
  const [notas, setNotas] = useState(equipo?.notas || "");
  const [imgPath, setImgPath] = useState(equipo?.imagen_path || "");
  const [imgPreview, setImgPreview] = useState(equipo?.imagen_path || "");
  const [fotos, setFotos] = useState<string[]>(parseFotos(equipo?.fotos_json ?? null));
  const [brochure, setBrochure] = useState(equipo?.brochure_path || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const diagramaRef = useRef<HTMLInputElement>(null);
  const fotosRef = useRef<HTMLInputElement>(null);
  const brochureRef = useRef<HTMLInputElement>(null);

  const handleDiagrama = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImgPreview(URL.createObjectURL(file));
    setUploading(true);
    setImgPath(await uploadFile(file));
    setUploading(false);
  };

  const handleFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    const paths = await Promise.all(files.map(f => uploadFile(f)));
    setFotos(prev => [...prev, ...paths.filter(Boolean)]);
    setUploading(false);
    e.target.value = "";
  };

  const handleBrochure = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    setBrochure(await uploadFile(file, "brochures"));
    setUploading(false);
  };

  const removeFoto = (idx: number) => setFotos(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!modelo.trim()) return;
    setSaving(true);
    const body = { tipo, marca, modelo, descripcion, imagen_path: imgPath, fotos_json: fotos, brochure_path: brochure, notas };
    const res = equipo
      ? await fetch(`/api/catalogo/${equipo.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/catalogo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (data.equipo) onSave(data.equipo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-[620px] max-h-[92vh] flex flex-col overflow-hidden">

        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-[15px] text-[#1E293B]">
            {equipo ? "Editar equipo" : "Agregar al catálogo"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Básicos */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo *">
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={sel}>
                {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="GE, Philips, Mindray…" className={inp} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo *">
              <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="C1-6, L12-4, S5-1…" className={inp} />
            </Field>
            <Field label="Descripción breve">
              <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Transductor convex abdominal" className={inp} />
            </Field>
          </div>

          {/* Diagrama técnico */}
          <div>
            <div className="text-[11px] font-bold text-gray-500 mb-0.5">Diagrama técnico</div>
            <div className="text-[10px] text-gray-400 mb-2">Se usa en el PDF de cotización de reparación (con hotspots). No aparece en la tarjeta del catálogo.</div>
            <div className="flex gap-3 items-center">
              <div onClick={() => diagramaRef.current?.click()}
                className="w-28 h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-[#4E60A9]/40 shrink-0">
                {imgPreview
                  ? <img src={imgPreview} alt="diagrama" className="w-full h-full object-contain p-1" />
                  : <ImageIcon size={20} className="text-gray-300" />}
              </div>
              <div className="flex-1 space-y-1.5">
                <input ref={diagramaRef} type="file" accept="image/*" className="hidden" onChange={handleDiagrama} />
                <button onClick={() => diagramaRef.current?.click()}
                  className="w-full text-[11px] font-medium py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:border-[#4E60A9]/40 hover:bg-blue-50/40 transition-all">
                  {imgPreview ? "Cambiar diagrama" : "Subir diagrama"}
                </button>
                {imgPreview && (
                  <button onClick={() => { setImgPath(""); setImgPreview(""); }}
                    className="w-full text-[11px] text-red-400 hover:text-red-600 font-medium py-1">Quitar</button>
                )}
              </div>
            </div>
          </div>

          {/* Fotos del producto */}
          <div>
            <div className="text-[11px] font-bold text-gray-500 mb-0.5">Fotos del producto</div>
            <div className="text-[10px] text-gray-400 mb-2">La primera foto es la imagen principal de la tarjeta. Se usan también en cotizaciones de venta.</div>
            <div className="flex flex-wrap gap-2 mb-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative w-20 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                  <img src={f} alt={`foto${i}`} className="w-full h-full object-cover" />
                  <button onClick={() => removeFoto(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 size={12} className="text-white" />
                  </button>
                </div>
              ))}
              <button onClick={() => fotosRef.current?.click()}
                className="w-20 h-16 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 hover:border-[#4E60A9]/40 hover:bg-blue-50/30 cursor-pointer transition-all">
                <Camera size={14} className="text-gray-400" />
                <span className="text-[9px] text-gray-400 font-medium">Agregar</span>
              </button>
              <input ref={fotosRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            </div>
          </div>

          {/* Brochure */}
          <div>
            <div className="text-[11px] font-bold text-gray-500 mb-2">Brochure / Ficha técnica</div>
            <div className="flex items-center gap-3">
              {brochure ? (
                <div className="flex items-center gap-2 flex-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <FileText size={14} className="text-blue-600 shrink-0" />
                  <span className="text-[11px] text-blue-700 font-medium flex-1 truncate">
                    {brochure.split("/").pop()}
                  </span>
                  <a href={brochure} target="_blank" className="text-blue-500 hover:text-blue-700"><ExternalLink size={12} /></a>
                  <button onClick={() => setBrochure("")} className="text-red-400 hover:text-red-600"><X size={12} /></button>
                </div>
              ) : (
                <button onClick={() => brochureRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg text-[11px] font-medium text-gray-500 hover:border-[#4E60A9]/40 hover:bg-blue-50/30 transition-all">
                  <Upload size={13} /> Subir PDF o imagen
                </button>
              )}
              <input ref={brochureRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleBrochure} />
            </div>
          </div>

          <Field label="Notas internas">
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
              placeholder="Compatibilidades, versiones, observaciones…"
              className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white resize-none" />
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 shrink-0">
          <button onClick={handleSave} disabled={!modelo.trim() || saving || uploading}
            className="w-full py-2.5 bg-[#4E60A9] hover:bg-[#1e40af] text-white text-[13px] font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {uploading ? "Subiendo archivos…" : saving ? "Guardando…" : equipo ? "Guardar cambios" : "Agregar al catálogo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

type SyncResult = { activados: number; desactivados: number; insertados: number; actualizados: number; fuente: string };

export default function CatalogoPage() {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"new" | Equipo | null>(null);
  const [query, setQuery] = useState("");
  const [tipoFilt, setTipoFilt] = useState("todos");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/catalogo");
    const data = await res.json();
    setEquipos(data.equipos || []);
    setLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await fetch("/api/catalogo/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al sincronizar");
      setSyncResult(data);
      await load();
    } catch (e: any) {
      setSyncError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = (e: Equipo) => {
    setEquipos(prev => {
      const idx = prev.findIndex(x => x.id === e.id);
      return idx >= 0 ? prev.map(x => x.id === e.id ? e : x) : [...prev, e];
    });
    setModal(null);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este equipo del catálogo?")) return;
    await fetch(`/api/catalogo/${id}`, { method: "DELETE" });
    setEquipos(prev => prev.filter(e => e.id !== id));
  };

  const filtered = equipos.filter(e => {
    const q = query.toLowerCase();
    const matchQ = !q || e.marca?.toLowerCase().includes(q) || e.modelo.toLowerCase().includes(q) || e.descripcion?.toLowerCase().includes(q);
    const matchT = tipoFilt === "todos" || e.tipo === tipoFilt;
    return matchQ && matchT;
  });

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F4F7FB]">

      {/* Header */}
      <div className="bg-white border-b border-[#E8EFF8] px-8 py-5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight">Catálogo de Equipos</h1>
          <p className="text-[11px] text-gray-400 mt-0.5">{equipos.length} equipos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 hover:border-[#4E60A9]/40 hover:text-[#4E60A9] text-[12px] font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white">
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando…" : "Sincronizar sitio"}
          </button>
          <button onClick={() => setModal("new")}
            className="flex items-center gap-2 px-4 py-2 bg-[#4E60A9] hover:bg-[#1e40af] text-white text-[12px] font-bold rounded-xl transition-colors">
            <Plus size={14} /> Agregar equipo
          </button>
        </div>
      </div>

      {/* Banner resultado sync */}
      {syncResult && (
        <div className="mx-8 mt-3 flex items-center gap-3 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-[11px] text-green-700 shrink-0">
          <CheckCircle size={14} className="shrink-0" />
          <span>
            Sincronizado con <strong>bionordi.com</strong> —{" "}
            {syncResult.insertados > 0 && <span>{syncResult.insertados} nuevos · </span>}
            {syncResult.activados > 0 && <span>{syncResult.activados} activados · </span>}
            {syncResult.desactivados > 0 && <span>{syncResult.desactivados} desactivados · </span>}
            {syncResult.actualizados > 0 && <span>{syncResult.actualizados} precios actualizados</span>}
            {syncResult.fuente === 'fallback' && <span className="ml-1 text-green-500">(inventario local)</span>}
          </span>
          <button onClick={() => setSyncResult(null)} className="ml-auto text-green-400 hover:text-green-600"><X size={12} /></button>
        </div>
      )}
      {syncError && (
        <div className="mx-8 mt-3 flex items-center gap-3 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 shrink-0">
          <AlertCircle size={14} className="shrink-0" />
          <span>{syncError}</span>
          <button onClick={() => setSyncError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={12} /></button>
        </div>
      )}

      {/* Filtros */}
      <div className="px-8 py-3 flex gap-3 items-center border-b border-[#E8EFF8] bg-white shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar marca o modelo…"
            className="pl-8 pr-3 py-1.5 text-[12px] border border-gray-200 rounded-lg bg-white outline-none focus:border-[#4E60A9]/40 w-52" />
        </div>
        <div className="flex gap-1.5">
          {["todos", ...TIPOS].map(t => (
            <button key={t} onClick={() => setTipoFilt(t)}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${tipoFilt === t ? "bg-[#4E60A9] text-white border-[#4E60A9]" : "bg-white text-gray-500 border-gray-200 hover:border-[#4E60A9]/30"}`}>
              {t === "todos" ? "Todos" : TIPO_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-[12px] text-gray-400">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-3 text-gray-400">
            <ImageIcon size={32} strokeWidth={1.5} />
            <p className="text-[12px] font-medium">
              {query || tipoFilt !== "todos" ? "Sin resultados" : "El catálogo está vacío"}
            </p>
            {!query && tipoFilt === "todos" && (
              <button onClick={() => setModal("new")}
                className="mt-1 px-4 py-2 bg-[#4E60A9] text-white text-[12px] font-bold rounded-xl">
                Agregar primer equipo
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map(eq => {
              const tc = TIPO_COLORS[eq.tipo] || TIPO_COLORS.otro;
              const fotos = parseFotos(eq.fotos_json);
              return (
                <div key={eq.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden group flex flex-col">

                  {/* Foto del producto (imagen principal de la tarjeta) */}
                  <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden shrink-0">
                    {fotos.length > 0
                      ? <img src={fotos[0]} alt={eq.modelo} className="h-full w-full object-cover" />
                      : <div className="flex flex-col items-center gap-1.5 text-gray-300">
                        <ImageIcon size={24} strokeWidth={1.5} />
                        <span className="text-[9px] font-medium">Sin foto</span>
                      </div>
                    }

                    {/* Acciones hover */}
                    <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setModal(eq)}
                        className="w-6 h-6 rounded-md bg-white/90 shadow border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#4E60A9]">
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => handleDelete(eq.id)}
                        className="w-6 h-6 rounded-md bg-white/90 shadow border border-gray-200 flex items-center justify-center text-gray-500 hover:text-red-500">
                        <Trash2 size={10} />
                      </button>
                    </div>

                    {/* Badge tipo */}
                    <div className={`absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md ${tc.bg} ${tc.text}`}>
                      {TIPO_LABELS[eq.tipo] || eq.tipo}
                    </div>

                    {/* Indicador diagrama disponible */}
                    {eq.imagen_path && (
                      <div className="absolute bottom-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded bg-black/50 text-white">
                        Diagrama ✓
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3 flex-1 flex flex-col">
                    {eq.marca && <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wide leading-none mb-0.5">{eq.marca}</div>}
                    <div className="text-[13px] font-bold text-[#1E293B] leading-tight">{eq.modelo}</div>
                    {eq.descripcion && (
                      <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{eq.descripcion}</p>
                    )}

                    {/* Botón brochure prominente */}
                    {eq.brochure_path ? (
                      <a href={eq.brochure_path} target="_blank"
                        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[#4E60A9] hover:bg-[#1e40af] text-white text-[11px] font-bold transition-colors">
                        <FileText size={12} /> Ver Brochure
                      </a>
                    ) : (
                      <button onClick={() => setModal(eq)}
                        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-dashed border-gray-200 text-gray-400 text-[10px] font-medium hover:border-gray-300 transition-colors">
                        <FileText size={11} /> Sin brochure — agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && (
        <EquipoModal
          equipo={modal === "new" ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
