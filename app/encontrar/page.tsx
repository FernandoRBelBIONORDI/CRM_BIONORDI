"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, Search, Download, Zap, MapPin, ArrowRight, UserPlus, Copy, Check,
         SlidersHorizontal, X, Globe, Square, CheckSquare, StopCircle, BookOpen,
         Trash2, Stethoscope } from "lucide-react";
import nichos from "@/data/nichos_medicos.json";
import municipiosData from "@/data/municipios_mexico.json";
import NuevoLeadModal from "@/components/NuevoLeadModal";
import { ESPECIALIDADES_DOCTORALIA } from "@/lib/doctoralia";
import Link from "next/link";

interface Lead {
  id:number; nombre:string; telefono?:string; whatsapp?:string; correo?:string; sitio_web?:string;
  direccion?:string; ciudad?:string; estado_republica?:string; nicho?:string;
  fuente?:string; confianza_fuente?:string; score_potencial?:number;
  razon_score?:string; tiene_ultrasonido?:string; tamano_estimado?:string;
  whatsapp_verificado?:number; sitio_activo?:number; status_crm?:string;
}

interface ZonaProgress {
  zona: string; encontrados: number; nuevos: number;
  status: "pending"|"running"|"done"|"cancelled";
}

type Fuente = "google" | "denue" | "doctoralia";

const CONF: Record<string,{label:string;color:string;bg:string}> = {
  alta:                 { label:"Alta",  color:"#059669", bg:"#ECFDF5" },
  "google_places+denue":{ label:"Alta",  color:"#059669", bg:"#ECFDF5" },
  media:                { label:"Media", color:"#D97706", bg:"#FFFBEB" },
  baja:                 { label:"Baja",  color:"#64748B", bg:"#F1F5F9" },
};

const FUENTE_LABEL: Record<string,string> = {
  "google_places+denue": "Google + DENUE",
  "google_places":       "Google Maps",
  "denue":               "DENUE",
  "doctoralia":          "Doctoralia",
};

const S: Record<string,{label:string;color:string;bg:string}> = {
  nuevo:       { label:"Nuevo",       color:"#5A85F1", bg:"#EEF3FC" },
  contactado:  { label:"Contactado",  color:"#D97706", bg:"#FFFBEB" },
  seguimiento: { label:"Seguimiento", color:"#EA580C", bg:"#FFF7ED" },
  diagnostico: { label:"Diagnóstico", color:"#7C3AED", bg:"#F5F3FF" },
  cliente:     { label:"Cliente",     color:"#34A853", bg:"#EEF9F1" },
  sin_equipo:  { label:"Sin equipo",  color:"#64748B", bg:"#F1F5F9" },
  descartado:  { label:"Descartado",  color:"#DC2626", bg:"#FEF2F2" },
};
const STATUS_OPTS = Object.entries(S).map(([k,v])=>({value:k,label:v.label}));

const REGIONES = [
  { nombre:"Norte",  color:"#4F46E5", estados:["Baja California","Baja California Sur","Sonora","Chihuahua","Coahuila","Nuevo León","Tamaulipas","Durango","Sinaloa","Zacatecas"] },
  { nombre:"Centro", color:"#059669", estados:["San Luis Potosí","Nayarit","Jalisco","Aguascalientes","Guanajuato","Querétaro","Michoacán","Colima","Estado de México","Ciudad de México","Hidalgo","Tlaxcala","Morelos"] },
  { nombre:"Sur",    color:"#D97706", estados:["Guerrero","Veracruz","Puebla","Oaxaca","Tabasco","Chiapas","Campeche","Yucatán","Quintana Roo"] },
];

const FUENTE_OPTS: { id: Fuente; label: string; color: string }[] = [
  { id:"google",      label:"Google Maps",  color:"#4E60A9" },
  { id:"denue",       label:"DENUE",        color:"#059669" },
  { id:"doctoralia",  label:"Doctoralia",   color:"#7C3AED" },
];

// Agrupamiento calculado una sola vez fuera del componente
const GRUPOS_ESP = (() => {
  const m = new Map<string, typeof ESPECIALIDADES_DOCTORALIA[0][]>();
  for (const e of ESPECIALIDADES_DOCTORALIA) {
    if (!m.has(e.grupo)) m.set(e.grupo, []);
    m.get(e.grupo)!.push(e);
  }
  return Array.from(m, ([grupo, items]) => ({ grupo, items }));
})();

export default function EncontrarPage() {
  const [mounted, setMounted]       = useState(false);
  const [nicho, setNicho]           = useState(nichos[0]);
  const [loading, setLoading]       = useState(false);
  const [enrichId, setEnrichId]     = useState<number|null>(null);
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [estadoSel, setEstadoSel]   = useState("");
  const [lastRes, setLastRes]       = useState<{found:number;added:number}|null>(null);
  const [leadsByEstado, setLeadsByEstado] = useState<Record<string,number>>({});
  const [showNuevo, setShowNuevo]   = useState(false);
  const [copied, setCopied]         = useState<number|null>(null);
  const [filterTamano, setFilterTamano] = useState("");
  const [filterSitio, setFilterSitio]   = useState<""|"si"|"no">("");
  const [filterStatus, setFilterStatus] = useState("");

  // Panel lateral
  const [leftTab, setLeftTab]             = useState<"zona"|"historial">("zona");
  const [estadoExpanded, setEstadoExpanded] = useState("");
  const [selectedMunis, setSelectedMunis]   = useState<Set<string>>(new Set());
  const [zonaProgress, setZonaProgress]     = useState<ZonaProgress[]>([]);
  const [sweeping, setSweeping]             = useState(false);
  const cancelRef = useRef(false);
  const [barridoNombre, setBarridoNombre] = useState("");
  const [maxPaginas, setMaxPaginas]       = useState(3);
  const [barridos, setBarridos]           = useState<any[]>([]);
  const [barridoFiltro, setBarridoFiltro] = useState<number|null>(null);
  const [zonaSearch, setZonaSearch]       = useState("");

  // Fuente unificada
  const [fuente, setFuente]               = useState<Fuente>("google");
  const [docEspecialidad, setDocEspecialidad] = useState(ESPECIALIDADES_DOCTORALIA[0].slug);
  const [docPaginas, setDocPaginas]           = useState(2);

  const municipiosDelEstado: string[] = (municipiosData as Record<string,string[]>)[estadoExpanded] || [];

  useEffect(()=>{
    setMounted(true);
    const sp = new URLSearchParams(window.location.search);
    if(sp.has("nicho")) setNicho(sp.get("nicho") || nichos[0]);
    fetchLeads();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(()=>{ setSelectedMunis(new Set()); setZonaProgress([]); }, [estadoExpanded]);

  const fetchLeads = async () => {
    const [dl, br] = await Promise.all([
      fetch("/api/leads").then(r=>r.json()),
      fetch("/api/barridos").then(r=>r.json()),
    ]);
    if(dl.leads) {
      setLeads(dl.leads);
      const cnt:Record<string,number>={};
      for(const l of dl.leads) if(l.estado_republica) cnt[l.estado_republica]=(cnt[l.estado_republica]||0)+1;
      setLeadsByEstado(cnt);
    }
    if(br.barridos) setBarridos(br.barridos);
  };

  const handleSearch = async () => {
    setLoading(true); setLastRes(null);
    try {
      const ciudad = estadoSel || estadoExpanded || "México";
      if(fuente === "doctoralia") {
        const d = await fetch("/api/scrape-doctoralia",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ especialidad:docEspecialidad, ciudad, estado_republica:estadoSel||undefined, paginas:docPaginas })
        }).then(r=>r.json());
        if(!d.error) { setLastRes({found:d.scraped, added:d.new_added}); await fetchLeads(); }
      } else {
        const d = await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({nicho, ciudad, estado_republica:estadoSel||undefined})}).then(r=>r.json());
        if(d.success){ setLastRes({found:d.found_in_maps+(d.found_in_denue||0), added:d.new_added}); await fetchLeads(); }
      }
    } catch(e){ console.error(e); }
    setLoading(false);
  };

  const handleStartBarrido = async () => {
    const zonas = Array.from(selectedMunis);
    if(zonas.length === 0) return;
    cancelRef.current = false;
    setSweeping(true);
    setLastRes(null);

    const nombre = barridoNombre.trim() || `${estadoExpanded} · ${new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"numeric"})}`;

    if(fuente === "doctoralia") {
      const espLabel = ESPECIALIDADES_DOCTORALIA.find(e=>e.slug===docEspecialidad)?.label || docEspecialidad;
      const nomDoc = barridoNombre.trim() || `Doctoralia · ${espLabel} · ${estadoExpanded} · ${new Date().toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"2-digit"})}`;
      const { id: barridoId } = await fetch("/api/barridos",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ nombre:nomDoc, nicho:docEspecialidad, estado:estadoExpanded, zonas, max_por_zona:docPaginas*20, fuente:"doctoralia", especialidad:docEspecialidad })
      }).then(r=>r.json());

      const progress: ZonaProgress[] = zonas.map(z=>({ zona:z, encontrados:0, nuevos:0, status:"pending" as const }));
      setZonaProgress([...progress]);
      let totalFound=0; let totalAdded=0;

      for(let i=0; i<zonas.length; i++) {
        if(cancelRef.current){ progress[i].status="cancelled"; setZonaProgress([...progress]); break; }
        progress[i].status="running"; setZonaProgress([...progress]);
        try {
          const d = await fetch("/api/scrape-doctoralia",{method:"POST",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ especialidad:docEspecialidad, ciudad:zonas[i], estado_republica:estadoExpanded, municipio:zonas[i], paginas:docPaginas, barrido_id:barridoId })
          }).then(r=>r.json());
          const found=d.scraped||0; const added=d.new_added||0;
          progress[i]={ zona:zonas[i], encontrados:found, nuevos:added, status:"done" };
          totalFound+=found; totalAdded+=added;
          await fetch("/api/barridos",{method:"PATCH",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({ id:barridoId, total_encontrados:found, total_nuevos:added, zonas_completadas:i+1 })
          });
        } catch { progress[i].status="done"; }
        setZonaProgress([...progress]);
      }
      await fetch("/api/barridos",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ id:barridoId, total_encontrados:0, total_nuevos:0, zonas_completadas:zonas.length, completado:1 })
      });
      setLastRes({found:totalFound, added:totalAdded});
      setBarridoNombre(""); setSweeping(false);
      setBarridoFiltro(barridoId);
      await fetchLeads();
      return;
    }

    // Google / DENUE barrido
    const { id: barridoId } = await fetch("/api/barridos",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ nombre, nicho, estado: estadoExpanded, zonas, max_por_zona: maxPaginas * 20, fuente: fuente === "denue" ? "denue" : "google" })
    }).then(r=>r.json());

    const progress: ZonaProgress[] = zonas.map(z=>({ zona:z, encontrados:0, nuevos:0, status:"pending" as const }));
    setZonaProgress([...progress]);
    let totalFound=0; let totalAdded=0;

    for(let i=0; i<zonas.length; i++) {
      if(cancelRef.current){ progress[i].status="cancelled"; setZonaProgress([...progress]); break; }
      progress[i].status="running"; setZonaProgress([...progress]);
      try {
        const d = await fetch("/api/search",{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ nicho, ciudad:zonas[i], estado_republica:estadoExpanded, municipio:zonas[i], barrido_id:barridoId, max_paginas:maxPaginas })
        }).then(r=>r.json());
        const found=(d.found_in_maps||0)+(d.found_in_denue||0); const added=d.new_added||0;
        progress[i]={ zona:zonas[i], encontrados:found, nuevos:added, status:"done" };
        totalFound+=found; totalAdded+=added;
        await fetch("/api/barridos",{method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({ id:barridoId, total_encontrados:found, total_nuevos:added, zonas_completadas:i+1 })
        });
      } catch { progress[i].status="done"; }
      setZonaProgress([...progress]);
    }
    await fetch("/api/barridos",{method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ id:barridoId, total_encontrados:0, total_nuevos:0, zonas_completadas:zonas.length, completado:1 })
    });
    setLastRes({found:totalFound, added:totalAdded});
    setBarridoNombre(""); setSweeping(false);
    setBarridoFiltro(barridoId);
    await fetchLeads();
  };

  const handleCancel = () => { cancelRef.current = true; };

  const toggleMuni = (m: string) => setSelectedMunis(p=>{ const n=new Set(p); n.has(m)?n.delete(m):n.add(m); return n; });

  const handleEnrich = async (id:number) => {
    setEnrichId(id);
    await fetch("/api/enrich",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    await fetchLeads();
    setEnrichId(null);
  };

  const patchStatus = async (id:number, status:string) => {
    await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status_crm:status})});
    setLeads(p=>p.map(l=>l.id===id?{...l,status_crm:status}:l));
  };

  const visible = leads.filter((l:any)=>{
    if(barridoFiltro && l.barrido_id !== barridoFiltro) return false;
    if(estadoSel && l.estado_republica!==estadoSel && !l.ciudad?.toLowerCase().includes(estadoSel.toLowerCase())) return false;
    if(selectedMunis.size>0 && !barridoFiltro && !estadoSel) {
      const c=l.ciudad?.toLowerCase()||"";
      if(!Array.from(selectedMunis).some(m=>c.includes(m.toLowerCase()))) return false;
    }
    if(filterTamano && l.tamano_estimado!==filterTamano) return false;
    if(filterSitio==="si" && !l.sitio_activo) return false;
    if(filterSitio==="no" && l.sitio_activo)  return false;
    if(filterStatus && l.status_crm!==filterStatus) return false;
    return true;
  });

  const tamanosUnicos = Array.from(new Set(leads.map(l=>l.tamano_estimado).filter(Boolean))) as string[];
  const activeFilters = (filterTamano?1:0)+(filterSitio?1:0)+(filterStatus?1:0);
  const isRunning     = loading || sweeping;

  if(!mounted) return (
    <div className="h-full flex items-center justify-center">
      <Activity size={22} className="animate-spin text-[#4E60A9]"/>
    </div>
  );

  return (
    <div className="h-full flex flex-col font-sans">

      {/* Header */}
      <div className="flex justify-between items-center px-8 py-4 pb-2">
        <div className="flex items-center gap-5">
          <div>
            <h1 className="text-[26px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">Búsqueda Prospectiva</h1>
            <p className="text-[#8B95A5] text-[13px] font-medium tracking-tight mt-0.5">Extrae leads segmentados por zona y fuente.</p>
          </div>
          <div className="h-7 w-px bg-gray-200"/>
          <select value={nicho} onChange={e=>setNicho(e.target.value)}
            className="inp min-w-[260px] rounded-full py-2 bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 cursor-pointer text-gray-600 transition-all text-[13px]">
            {nichos.map(n=><option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {lastRes && (
            <span className="text-[12px] font-bold text-[#34A853] bg-[#EEF9F1] px-4 py-2 rounded-full tracking-tight">
              ✓ {lastRes.added} lead{lastRes.added!==1?"s":""} nuevo{lastRes.added!==1?"s":""}
              {lastRes.found>0 && <span className="font-medium text-[#64748B]"> · {lastRes.found} analizados</span>}
            </span>
          )}
          <button onClick={()=>setShowNuevo(true)} className="btn-ghost">
            <UserPlus size={14}/> Manual
          </button>
          <button onClick={handleSearch} disabled={isRunning} className="btn-primary">
            {loading ? <><Activity size={14} className="animate-spin"/>Procesando</>
                     : <><Search size={14}/>Barrido rápido</>}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden px-6 pb-6 pt-2 gap-5">

        {/* Panel lateral */}
        <div className="w-[272px] shrink-0 card flex flex-col overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            <button onClick={()=>setLeftTab("zona")}
              className={`flex-1 py-2.5 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${leftTab==="zona"?"text-[#4E60A9] border-b-2 border-[#4E60A9]":"text-gray-400 hover:text-gray-600"}`}>
              <MapPin size={12}/> Zona
            </button>
            <button onClick={()=>setLeftTab("historial")}
              className={`flex-1 py-2.5 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${leftTab==="historial"?"text-[#4E60A9] border-b-2 border-[#4E60A9]":"text-gray-400 hover:text-gray-600"}`}>
              <BookOpen size={12}/> Barridos
              {barridos.length>0 && <span className="w-4 h-4 bg-[#4E60A9] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{barridos.length}</span>}
            </button>
          </div>

          {/* Tab: Zona */}
          {leftTab==="zona" && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Búsqueda de estado */}
              <div className="px-3 pt-3 pb-2 shrink-0">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                  <input value={zonaSearch} onChange={e=>setZonaSearch(e.target.value)}
                    placeholder="Buscar estado o alcaldía..."
                    className="w-full bg-[#F8FAFC] border border-gray-100 rounded-xl pl-8 pr-3 py-2 text-[12px] outline-none focus:border-[#4E60A9]/40 focus:bg-white placeholder:text-gray-400 transition-all"/>
                  {zonaSearch && <button onClick={()=>setZonaSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"><X size={11}/></button>}
                </div>
              </div>

              {/* Lista de estados / municipios */}
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {REGIONES.map(region=>{
                  const estados=zonaSearch
                    ? region.estados.filter(e=>e.toLowerCase().includes(zonaSearch.toLowerCase()))
                    : region.estados;
                  if(estados.length===0) return null;
                  return (
                    <div key={region.nombre} className="mb-2">
                      <div className="flex items-center gap-1.5 px-3 py-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{backgroundColor:region.color}}/>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{region.nombre}</span>
                      </div>
                      <div className="space-y-0.5">
                        {estados.map(estado=>{
                          const count=leadsByEstado[estado]||0;
                          const isOpen=estadoExpanded===estado;
                          const munis=(municipiosData as Record<string,string[]>)[estado]||[];
                          const checkedInThis=munis.filter(m=>selectedMunis.has(m)).length;
                          return (
                            <div key={estado}>
                              <button suppressHydrationWarning
                                onClick={()=>{
                                  const next=isOpen?"":estado;
                                  setEstadoExpanded(next); setEstadoSel(next);
                                  if(!next) setSelectedMunis(new Set());
                                  setBarridoFiltro(null);
                                }}
                                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all ${
                                  isOpen?"bg-[#EEF3FC] border border-[#4E60A9]/20":count>0?"hover:bg-[#F8FAFC] border border-transparent hover:border-gray-100":"opacity-40 border border-transparent"
                                }`}>
                                <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:isOpen?"#4E60A9":count>0?region.color:"#E2E8F4"}}/>
                                <span className={`text-[12px] font-semibold flex-1 truncate ${isOpen?"text-[#4E60A9]":"text-[#1E293B]"}`}>{estado}</span>
                                {checkedInThis>0 && <span className="text-[10px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-1.5 py-0.5 rounded-full shrink-0">{checkedInThis}</span>}
                                {count>0&&checkedInThis===0 && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full shrink-0">{count}</span>}
                              </button>

                              {isOpen && munis.length>0 && (
                                <div className="ml-3 mt-1 mb-1 border-l-2 border-[#4E60A9]/20 pl-2 space-y-0.5">
                                  <div className="flex items-center gap-2 py-1 px-1">
                                    <button suppressHydrationWarning onClick={()=>setSelectedMunis(new Set(munis))}
                                      className="flex items-center gap-1 text-[10px] font-bold text-[#4E60A9] hover:underline">
                                      <CheckSquare size={10}/> Todos
                                    </button>
                                    <span className="text-gray-300">·</span>
                                    <button suppressHydrationWarning onClick={()=>setSelectedMunis(new Set())}
                                      className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:underline">
                                      <Square size={10}/> Ninguno
                                    </button>
                                    <span className="text-[10px] text-gray-400 ml-auto font-bold">{selectedMunis.size} sel.</span>
                                  </div>
                                  {munis.map(m=>{
                                    const checked=selectedMunis.has(m);
                                    const prog=zonaProgress.find(z=>z.zona===m);
                                    return (
                                      <button suppressHydrationWarning key={m}
                                        onClick={()=>!sweeping&&toggleMuni(m)} disabled={sweeping}
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${checked?"bg-[#EEF3FC]":"hover:bg-gray-50"}`}>
                                        <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${checked?"bg-[#4E60A9] border-[#4E60A9]":"border-gray-300"}`}>
                                          {checked && <Check size={9} className="text-white" strokeWidth={3}/>}
                                        </div>
                                        <span className={`text-[11px] font-medium flex-1 truncate ${checked?"text-[#4E60A9]":"text-gray-600"}`}>{m}</span>
                                        {prog && (
                                          <span className={`text-[10px] font-bold shrink-0 ${prog.status==="running"?"text-orange-400":prog.status==="cancelled"?"text-gray-400":"text-[#34A853]"}`}>
                                            {prog.status==="running"?"…":prog.status==="cancelled"?"✕":`+${prog.nuevos}`}
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Configuración de barrido */}
              {estadoExpanded && (
                <div className="border-t border-gray-100 p-3 shrink-0 space-y-2.5">

                  {/* Selector de fuente */}
                  <div>
                    <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Fuente de datos</p>
                    <div className="flex gap-1">
                      {FUENTE_OPTS.map(f=>(
                        <button suppressHydrationWarning key={f.id} onClick={()=>setFuente(f.id)}
                          className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border transition-all truncate px-1 ${fuente===f.id?"text-white border-transparent":"bg-white text-gray-400 border-gray-200 hover:border-gray-300"}`}
                          style={fuente===f.id?{backgroundColor:f.color,borderColor:f.color}:{}}>
                          {f.id==="doctoralia" ? <Stethoscope size={11} className="mx-auto"/> : f.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 font-medium">
                      {fuente==="google" && "Google Maps + cruce DENUE"}
                      {fuente==="denue" && "Padrón INEGI local (sin API)"}
                      {fuente==="doctoralia" && "Directorio médico Doctoralia MX"}
                    </p>
                  </div>

                  {/* Config por fuente */}
                  {fuente==="google" && (
                    <div className="flex gap-2">
                      <input value={barridoNombre} onChange={e=>setBarridoNombre(e.target.value)}
                        placeholder="Nombre del barrido..."
                        className="flex-1 text-[11px] font-medium bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-[#4E60A9]/40 focus:bg-white placeholder:text-gray-400 min-w-0"/>
                      <select value={maxPaginas} onChange={e=>setMaxPaginas(Number(e.target.value))}
                        className="text-[11px] font-bold bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 outline-none cursor-pointer text-gray-600 shrink-0">
                        <option value={1}>20</option>
                        <option value={2}>40</option>
                        <option value={3}>60</option>
                      </select>
                    </div>
                  )}

                  {fuente==="doctoralia" && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest">Especialidad</p>
                      {/* Lista scrollable de chips — max-h evita que desborde el sidebar */}
                      <div className="max-h-[170px] overflow-y-auto space-y-1.5 pr-0.5">
                        {GRUPOS_ESP.map(({ grupo, items }) => (
                          <div key={grupo}>
                            <p className="text-[8px] font-bold text-gray-300 uppercase tracking-widest mb-1 px-0.5">{grupo}</p>
                            <div className="flex flex-wrap gap-1">
                              {items.map(e => {
                                const sel = docEspecialidad === e.slug;
                                return (
                                  <button key={e.slug}
                                    onClick={ev => { ev.stopPropagation(); setDocEspecialidad(e.slug); }}
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all leading-none ${
                                      sel
                                        ? "bg-[#7C3AED] text-white border-[#7C3AED] shadow-sm"
                                        : "bg-white text-gray-500 border-gray-200 hover:border-[#7C3AED]/40 hover:text-[#7C3AED]"
                                    }`}>
                                    {e.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Páginas */}
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest shrink-0">Págs:</span>
                        {[1,2,3,5].map(n=>(
                          <button suppressHydrationWarning key={n} onClick={()=>setDocPaginas(n)}
                            className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${docPaginas===n?"bg-[#7C3AED] text-white border-[#7C3AED]":"bg-white text-gray-500 border-gray-200 hover:border-[#7C3AED]/40"}`}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Botón */}
                  {sweeping ? (
                    <button suppressHydrationWarning onClick={handleCancel}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FEF2F2] text-[#DC2626] font-bold text-[12px] hover:bg-red-100 transition-colors">
                      <StopCircle size={13}/> Cancelar
                    </button>
                  ) : (
                    <button suppressHydrationWarning onClick={handleStartBarrido}
                      disabled={selectedMunis.size===0||loading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-bold text-[12px] transition-colors disabled:opacity-40"
                      style={{backgroundColor: FUENTE_OPTS.find(f=>f.id===fuente)?.color||"#4E60A9"}}>
                      {fuente==="doctoralia" ? <Stethoscope size={13}/> : <Globe size={13}/>}
                      {selectedMunis.size===0
                        ? "Selecciona municipios"
                        : `Barrer ${selectedMunis.size} zona${selectedMunis.size>1?"s":""} · ${FUENTE_OPTS.find(f=>f.id===fuente)?.label}`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Barridos guardados */}
          {leftTab==="historial" && (
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {barridos.length===0 ? (
                <div className="py-10 text-center text-[12px] text-gray-400 font-medium">Sin barridos guardados todavía.</div>
              ) : (
                <>
                  {barridoFiltro && (
                    <button suppressHydrationWarning onClick={()=>setBarridoFiltro(null)}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] py-2 rounded-xl hover:bg-[#4E60A9] hover:text-white transition-colors">
                      <X size={11}/> Ver todos los leads
                    </button>
                  )}
                  {barridos.map((b:any)=>{
                    const isActive=barridoFiltro===b.id;
                    const fecha=b.fecha?new Date(b.fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"short",year:"2-digit"}):"";
                    return (
                      <div key={b.id}
                        className={`rounded-xl border p-3 cursor-pointer transition-all ${isActive?"border-[#4E60A9] bg-[#EEF3FC]":"border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"}`}
                        onClick={()=>setBarridoFiltro(isActive?null:b.id)}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`text-[12px] font-bold truncate ${isActive?"text-[#4E60A9]":"text-[#1E293B]"}`}>{b.nombre}</div>
                            <div className="text-[10px] text-gray-400 font-medium mt-0.5">{fecha} · {b.estado||"—"}</div>
                          </div>
                          <button suppressHydrationWarning onClick={e=>{
                            e.stopPropagation();
                            if(!confirm(`¿Eliminar "${b.nombre}"?`)) return;
                            fetch("/api/barridos",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.id})})
                              .then(()=>{ if(barridoFiltro===b.id) setBarridoFiltro(null); fetchLeads(); });
                          }} className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0">
                            <Trash2 size={11}/>
                          </button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] font-bold text-[#34A853]">{b.leads_actuales??b.total_nuevos} leads</span>
                          {b.completado
                            ? <span className="ml-auto text-[9px] font-bold text-[#34A853] bg-[#EEF9F1] px-2 py-0.5 rounded-full uppercase">Completo</span>
                            : <span className="ml-auto text-[9px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase">Parcial</span>}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Tabla de leads */}
        <div className="flex-1 card flex flex-col overflow-hidden px-7 py-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-[18px] text-[#202538] tracking-tight">Resultados del Radar</h3>
              {visible.length>0 && (
                <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">{visible.length} leads</span>
              )}
              {barridoFiltro && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-2.5 py-1 rounded-full">
                  {barridos.find(b=>b.id===barridoFiltro)?.nombre||"Barrido"}
                  <button suppressHydrationWarning onClick={()=>setBarridoFiltro(null)} className="hover:text-red-400"><X size={10}/></button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Link href="/crm" className="text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-3 py-1.5 rounded-full hover:bg-[#4E60A9] hover:text-white transition-all flex items-center gap-1.5">
                Abrir CRM <ArrowRight size={12}/>
              </Link>
              <button suppressHydrationWarning onClick={()=>window.open("/api/leads?format=csv","_blank")}
                className="text-[12px] font-bold text-gray-400 bg-gray-50 border border-transparent px-3 py-1.5 rounded-full hover:bg-white hover:border-gray-200 transition-colors flex items-center gap-1.5">
                <Download size={14}/> CSV
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <SlidersHorizontal size={13} className={activeFilters>0?"text-[#4E60A9]":"text-gray-300"}/>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 cursor-pointer text-gray-500 outline-none transition-all">
              <option value="">Todos los estados</option>
              {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {tamanosUnicos.length>0 && (
              <select value={filterTamano} onChange={e=>setFilterTamano(e.target.value)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 cursor-pointer text-gray-500 outline-none transition-all">
                <option value="">Todos los tamaños</option>
                {tamanosUnicos.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <select value={filterSitio} onChange={e=>setFilterSitio(e.target.value as ""|"si"|"no")}
              className="text-[11px] font-bold px-3 py-1.5 rounded-full border bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 cursor-pointer text-gray-500 outline-none transition-all">
              <option value="">Con o sin sitio web</option>
              <option value="si">Con sitio web</option>
              <option value="no">Sin sitio web</option>
            </select>
            {activeFilters>0 && (
              <button suppressHydrationWarning onClick={()=>{setFilterTamano("");setFilterSitio("");setFilterStatus("");}}
                className="flex items-center gap-1 text-[11px] font-bold text-red-400 hover:text-red-600 bg-red-50 px-3 py-1.5 rounded-full transition-colors">
                <X size={11}/> Limpiar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {visible.length===0 && (
              <div className="h-full flex flex-col items-center justify-center gap-4 py-20">
                {isRunning ? (
                  <><Activity size={28} className="animate-spin text-[#4E60A9]"/>
                    <span className="text-[13px] font-medium text-gray-400">Extrayendo información territorial...</span></>
                ) : leads.length===0 ? (
                  <>
                    <div className="w-16 h-16 rounded-full bg-[#EEF3FC] flex items-center justify-center">
                      <Search size={24} className="text-[#4E60A9]"/>
                    </div>
                    <div className="text-center">
                      <p className="text-[15px] font-bold text-[#1E293B] mb-1">Base de datos vacía</p>
                      <p className="text-[13px] text-gray-400 font-medium">Selecciona una zona y ejecuta un barrido.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-gray-400">Sin leads para el filtro actual.</p>
                    <button suppressHydrationWarning onClick={()=>{setFilterStatus("");setFilterTamano("");setFilterSitio("");setEstadoSel("");}}
                      className="text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-4 py-2 rounded-full hover:bg-[#4E60A9] hover:text-white transition-all">
                      Ver todos
                    </button>
                  </>
                )}
              </div>
            )}

            {visible.length>0 && (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 p-1 pb-4">
                {visible.map(lead=>{
                  const st=S[lead.status_crm||"nuevo"]||S.nuevo;
                  const conf=CONF[lead.confianza_fuente||"baja"]||CONF.baja;
                  const fuenteLabel=FUENTE_LABEL[lead.fuente||""]||(lead.fuente||"").toUpperCase();
                  const scoreColor=lead.score_potencial
                    ? lead.score_potencial>=7?"#34A853":lead.score_potencial>=4?"#F59E0B":"#94A3B8"
                    : "#CBD5E1";
                  const scoreBg=lead.score_potencial
                    ? lead.score_potencial>=7?"#EEF9F1":lead.score_potencial>=4?"#FFFBEB":"#F1F5F9"
                    : "#F8FAFC";

                  return (
                    <div key={lead.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all flex flex-col">
                      <div className="px-4 pt-4 pb-3 border-b border-gray-50">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-gray-300 mono">#{String(lead.id).padStart(4,"0")}</span>
                            {fuenteLabel && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                                style={{color:conf.color,backgroundColor:conf.bg}}>{fuenteLabel}</span>
                            )}
                          </div>
                          {lead.score_potencial ? (
                            <span className="text-[12px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                              style={{color:scoreColor,backgroundColor:scoreBg}}>★ {lead.score_potencial}/10</span>
                          ) : null}
                        </div>
                        <h4 className="font-bold text-[#1E293B] text-[14px] tracking-tight leading-snug">{lead.nombre}</h4>
                        {(lead.direccion||lead.ciudad) && (
                          <p className="text-[11px] text-gray-400 font-medium mt-0.5 truncate">{lead.direccion||lead.ciudad}</p>
                        )}
                        {lead.razon_score && (
                          <p className="text-[10px] text-gray-400 mt-1 leading-snug line-clamp-2">{lead.razon_score}</p>
                        )}
                      </div>

                      <div className="px-4 py-3 space-y-2 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-bold text-gray-300 shrink-0">Tel</span>
                            <span className="text-[12px] font-semibold text-[#1E293B] truncate">{lead.telefono||"—"}</span>
                          </div>
                          {(lead.whatsapp || lead.telefono) && (
                            <a href={`https://wa.me/52${(lead.whatsapp || lead.telefono)!.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 hover:bg-green-500 hover:text-white px-2 py-1 rounded-full transition-colors">
                              <ArrowRight size={9}/> WA
                            </a>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[11px] font-bold text-gray-300 shrink-0">Email</span>
                            <span className="text-[11px] font-medium text-[#1E293B] truncate">{lead.correo||"—"}</span>
                          </div>
                          <button suppressHydrationWarning onClick={()=>{
                            const parts=[lead.nombre,lead.telefono||"",lead.correo||"",lead.sitio_web||""].filter(Boolean);
                            navigator.clipboard.writeText(parts.join(" | "));
                            setCopied(lead.id); setTimeout(()=>setCopied(null),1500);
                          }} className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-[#4E60A9] hover:bg-[#EEF3FC] transition-all">
                            {copied===lead.id?<Check size={10} className="text-[#34A853]"/>:<Copy size={10}/>}
                          </button>
                        </div>
                        {lead.sitio_web && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-gray-300 shrink-0">Web</span>
                            <a href={lead.sitio_web.startsWith("http")?lead.sitio_web:`https://${lead.sitio_web}`}
                              target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-medium text-[#4E60A9] hover:underline truncate">{lead.sitio_web}</a>
                          </div>
                        )}
                        {lead.tiene_ultrasonido && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-bold text-gray-300 shrink-0">Equipo</span>
                            <span className={`text-[11px] font-bold ${lead.tiene_ultrasonido==="sí"?"text-[#34A853]":lead.tiene_ultrasonido==="probable"?"text-[#F59E0B]":"text-gray-400"}`}>
                              {lead.tiene_ultrasonido.charAt(0).toUpperCase()+lead.tiene_ultrasonido.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="px-4 pb-4 flex items-center justify-between gap-2">
                        <select value={lead.status_crm||"nuevo"} onChange={e=>patchStatus(lead.id,e.target.value)}
                          className="text-[11px] font-bold px-3 py-1.5 rounded-full outline-none cursor-pointer border-0 appearance-none shadow-sm flex-1 max-w-[120px] text-center"
                          style={{color:st.color,backgroundColor:st.bg}}>
                          {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button suppressHydrationWarning onClick={()=>handleEnrich(lead.id)} disabled={enrichId===lead.id}
                          className="flex items-center gap-1.5 text-[11px] font-bold bg-[#EEF3FC] text-[#4E60A9] hover:bg-[#4E60A9] hover:text-white px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 shrink-0">
                          {enrichId===lead.id?<Activity size={11} className="animate-spin"/>:<Zap size={11} fill="currentColor"/>}
                          Perfil AI
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {showNuevo && (
        <NuevoLeadModal
          onClose={()=>setShowNuevo(false)}
          onCreated={(lead)=>{ setLeads(p=>[lead,...p]); setShowNuevo(false); }}
        />
      )}
    </div>
  );
}
