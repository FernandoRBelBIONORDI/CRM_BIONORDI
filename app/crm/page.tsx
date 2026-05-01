"use client";

import { useEffect, useState, Fragment, useRef } from "react";
import { useSession } from "next-auth/react";
import { Activity, Search, Download, MessageCircle, Sparkles, ChevronDown, ChevronUp, Copy, Check, ExternalLink, LayoutList, Kanban, Calendar, AlertTriangle, X, Trash2, SlidersHorizontal, UserPlus, FileText, UserCheck } from "lucide-react";
import NuevoLeadModal from "@/components/NuevoLeadModal";
import LeadModal from "@/components/LeadModal";
import QuoteModal from "@/components/QuoteModal";
import { waLink } from "@/lib/ui";

interface Lead {
  id:number; nombre:string; telefono?:string; whatsapp?:string; correo?:string; sitio_web?:string;
  direccion?:string; ciudad?:string; municipio?:string; estado_republica?:string;
  nicho?:string; tamano_estimado?:string; score_potencial?:number;
  status_crm:string; notas?:string; decisor_nombre?:string;
  decisor_cargo?:string; decisor_linkedin?:string; fecha_ultimo_cambio?:string;
  fecha_proximo_contacto?:string; asignado_a?:string;
}
interface Interaccion { id:number; tipo:string; contenido:string; fecha:string; resultado?:string; }
interface Scripts { profesional:string; directo:string; problema_solucion:string; }

const S: Record<string,{label:string; color:string; bg:string}> = {
  nuevo:       { label:"Nuevo",       color:"#5A85F1", bg:"#EEF3FC" },
  contactado:  { label:"Contactado",  color:"#D97706", bg:"#FFFBEB" },
  seguimiento: { label:"Seguimiento", color:"#EA580C", bg:"#FFF7ED" },
  diagnostico: { label:"Diagnóstico", color:"#7C3AED", bg:"#F5F3FF" },
  cliente:     { label:"Cliente",     color:"#34A853", bg:"#EEF9F1" },
  sin_equipo:  { label:"Sin equipo",  color:"#64748B", bg:"#F1F5F9" },
  descartado:  { label:"Descartado",  color:"#DC2626", bg:"#FEF2F2" },
};

const STATUS_OPTS = Object.entries(S).map(([k,v])=>({value:k, label:v.label}));
const KANBAN_COLS = ["nuevo","contactado","seguimiento","diagnostico","cliente"];

export default function CRMPage() {
  const { data: session } = useSession();
  const myName = session?.user?.name || "";

  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [total, setTotal]         = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const tableRef    = useRef<HTMLDivElement>(null);
  const savedScroll = useRef<number | null>(null);
  const [q, setQ]                 = useState("");
  const [filterS, setFilterS]     = useState("todos");
  const [filterNicho, setFilterNicho] = useState("");
  const [filterScore, setFilterScore] = useState(0);
  const [filterMios, setFilterMios]   = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView]           = useState<"table"|"kanban">("table");
  const [expanded, setExpanded]   = useState<number|null>(null);
  const [ints, setInts]           = useState<Record<number,Interaccion[]>>({});
  const [scripts, setScripts]     = useState<Record<number,Scripts>>({});
  const [loadScr, setLoadScr]     = useState<number|null>(null);
  const [editNota, setEditNota]   = useState<Record<number,string>>({});
  const [newCont, setNewCont]     = useState("");
  const [newTipo, setNewTipo]     = useState("mensaje_wa");
  const [newRes, setNewRes]       = useState("sin_respuesta");
  const [linkedinOpen, setLinkedinOpen] = useState<number|null>(null);
  const [linkedinData, setLinkedinData] = useState<any>(null);
  const [copied, setCopied]       = useState<string|null>(null);
  const [copiedRow, setCopiedRow] = useState<number|null>(null);
  const [showNuevoLead, setShowNuevoLead] = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus]     = useState("");
  const [modalLead, setModalLead]       = useState<Lead|null>(null);
  const [pendingModal, setPendingModal] = useState<number|null>(null);
  const [quoteLead, setQuoteLead]       = useState<Lead|null>(null);

  useEffect(()=>{
    if(typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if(sp.has("status")) setFilterS(sp.get("status") || "todos");
      if(sp.has("q")) setQ(sp.get("q") || "");
      if(sp.has("expand")) {
        const eid = parseInt(sp.get("expand")!);
        setFilterS("todos");
        setPendingModal(eid);
      }
    }
  },[]);

  // Re-fetch cuando cambian filtros; debounce de 300ms solo para búsqueda de texto
  useEffect(()=>{
    let cancelled = false;
    const delay = q ? 300 : 0;
    const timer = setTimeout(async () => {
      setLoading(true);
      const p = new URLSearchParams();
      if (filterS !== 'todos') p.set('status', filterS);
      if (q.trim()) p.set('q', q.trim());
      if (filterNicho) p.set('nicho', filterNicho);
      if (filterScore > 0) p.set('min_score', String(filterScore));
      if (filterMios && myName) p.set('asignado_a', myName);
      p.set('limit', '75');
      const d = await fetch(`/api/leads?${p}`).then(r=>r.json());
      if (!cancelled && d.leads) {
        setLeads(d.leads);
        setTotal(d.total || 0);
        setPendingModal(prev=>{ if(prev){ const l=d.leads.find((x:Lead)=>x.id===prev); if(l) setModalLead(l); return null; } return prev; });
      }
      if (!cancelled) setLoading(false);
    }, delay);
    return ()=>{ cancelled=true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[filterS, q, filterNicho, filterScore, filterMios, myName]);

  const loadMore = async () => {
    if (loadingMore) return;
    savedScroll.current = tableRef.current?.scrollTop ?? null;
    setLoadingMore(true);
    const p = new URLSearchParams();
    if (filterS !== 'todos') p.set('status', filterS);
    if (q.trim()) p.set('q', q.trim());
    if (filterNicho) p.set('nicho', filterNicho);
    if (filterScore > 0) p.set('min_score', String(filterScore));
    if (filterMios && myName) p.set('asignado_a', myName);
    p.set('limit', '75');
    p.set('offset', String(leads.length));
    const d = await fetch(`/api/leads?${p}`).then(r=>r.json());
    if (d.leads) { setLeads(prev=>[...prev, ...d.leads]); setTotal(d.total || 0); }
    setLoadingMore(false);
  };

  useEffect(() => {
    if (savedScroll.current !== null && tableRef.current) {
      tableRef.current.scrollTop = savedScroll.current;
      savedScroll.current = null;
    }
  }, [leads]);

  const patchLead = async (id:number, upd:Record<string,any>) => {
    await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...upd})});
  };

  const loadInts = async (id:number) => {
    const d = await fetch(`/api/interactions?lead_id=${id}`).then(r=>r.json());
    setInts(p=>({...p,[id]:d.interacciones||[]}));
  };

  const addInt = async (lead_id:number) => {
    if(!newCont.trim()) return;
    await fetch("/api/interactions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead_id,tipo:newTipo,contenido:newCont,resultado:newRes})});
    setNewCont("");
    const d = await fetch(`/api/interactions?lead_id=${lead_id}`).then(r=>r.json());
    setInts(p=>({...p,[lead_id]:d.interacciones||[]}));
  };

  const genScript = async (lead:Lead) => {
    if(scripts[lead.id]) return;
    setLoadScr(lead.id);
    const d = await fetch("/api/script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:lead.id})}).then(r=>r.json());
    if(d.scripts) setScripts(p=>({...p,[lead.id]:d.scripts}));
    setLoadScr(null);
  };

  const searchLinkedin = async (lead:Lead) => {
    setLinkedinOpen(lead.id); setLinkedinData(null);
    const d = await fetch("/api/linkedin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead_id:lead.id,nombre_empresa:lead.nombre})}).then(r=>r.json());
    setLinkedinData(d);
  };

  const saveDecissor = async (lead_id:number, r:any) => {
    await fetch("/api/linkedin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead_id,...r})});
    setLeads(p=>p.map(l=>l.id===lead_id?{...l,decisor_nombre:r.nombre,decisor_cargo:r.cargo,decisor_linkedin:r.linkedin}:l));
    setLinkedinOpen(null);
  };

  const copyText = (key:string,text:string) => {
    navigator.clipboard.writeText(text);
    setCopied(key); setTimeout(()=>setCopied(null),1500);
  };

  const moveStatus = (lead_id:number, status:string) => {
    patchLead(lead_id, {status_crm:status});
    setLeads(p=>p.map(l=>l.id===lead_id?{...l,status_crm:status}:l));
  };

  const deleteLead = async (id:number, nombre:string) => {
    if(!window.confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await fetch("/api/leads",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    setLeads(p=>p.filter(l=>l.id!==id));
    if(expanded===id) setExpanded(null);
  };

  const toggleSelect = (id:number) => setSelectedIds(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleSelectAll = () => setSelectedIds(selectedIds.size===leads.length ? new Set() : new Set(leads.map(l=>l.id)));

  const bulkChangeStatus = async (status:string) => {
    if(!status) return;
    await Promise.all([...selectedIds].map(id=>patchLead(id,{status_crm:status})));
    setLeads(p=>p.map(l=>selectedIds.has(l.id)?{...l,status_crm:status}:l));
    setSelectedIds(new Set()); setBulkStatus("");
  };

  const bulkDelete = async () => {
    if(!window.confirm(`¿Eliminar ${selectedIds.size} leads? Esta acción no se puede deshacer.`)) return;
    await Promise.all([...selectedIds].map(id=>
      fetch("/api/leads",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})})
    ));
    setLeads(p=>p.filter(l=>!selectedIds.has(l.id)));
    setSelectedIds(new Set());
  };

  const nichosUnicos = [...new Set(leads.map(l=>l.nicho).filter(Boolean))] as string[];
  const activeFilters = (filterNicho ? 1 : 0) + (filterScore > 0 ? 1 : 0);

  return (
    <div className="h-full flex flex-col font-sans relative">

      {/* Header */}
      <div className="px-4 mb-2 space-y-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6 pl-4">
            <div>
              <h1 className="text-[28px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">CRM Central</h1>
              <p className="text-[#8B95A5] text-[13px] font-medium tracking-tight mt-0.5">
                {total} leads{leads.length < total ? ` · mostrando ${leads.length}` : ""}{activeFilters > 0 ? ` · ${activeFilters} filtro${activeFilters>1?"s":""} activo${activeFilters>1?"s":""}` : ""}
              </p>
            </div>
            <div className="h-8 w-[1.5px] bg-gray-200 ml-2"></div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Nombre o ciudad..."
                  className="inp pl-10 w-44 rounded-full py-[10px]" suppressHydrationWarning />
              </div>
              <select value={filterS} onChange={e=>setFilterS(e.target.value)} suppressHydrationWarning
                className="inp w-auto rounded-full py-[10px] bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 cursor-pointer text-gray-600 transition-all">
                <option value="todos">Todos</option>
                {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button onClick={()=>setShowFilters(p=>!p)} suppressHydrationWarning
                className={`flex items-center gap-1.5 px-4 py-[10px] rounded-full text-[12px] font-bold transition-all border ${showFilters || activeFilters > 0 ? "bg-[#EEF3FC] text-[#4E60A9] border-[#4E60A9]/20" : "bg-gray-50 text-gray-500 border-transparent hover:bg-white hover:border-gray-200"}`}>
                <SlidersHorizontal size={13}/>
                Filtros
                {activeFilters > 0 && <span className="w-4 h-4 bg-[#4E60A9] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeFilters}</span>}
              </button>
              <button onClick={()=>setFilterMios(p=>!p)} suppressHydrationWarning
                className={`flex items-center gap-1.5 px-4 py-[10px] rounded-full text-[12px] font-bold transition-all border ${filterMios ? "bg-[#EEF3FC] text-[#4E60A9] border-[#4E60A9]/20" : "bg-gray-50 text-gray-500 border-transparent hover:bg-white hover:border-gray-200"}`}>
                <UserCheck size={13}/> Mis leads
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 gap-1 shadow-sm">
              <button onClick={()=>setView("table")} suppressHydrationWarning
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${view==="table"?"bg-[#2D2F3C] text-white shadow-sm":"text-gray-400 hover:text-gray-600"}`}>
                <LayoutList size={13}/> Tabla
              </button>
              <button onClick={()=>setView("kanban")} suppressHydrationWarning
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all ${view==="kanban"?"bg-[#2D2F3C] text-white shadow-sm":"text-gray-400 hover:text-gray-600"}`}>
                <Kanban size={13}/> Kanban
              </button>
            </div>
            <button onClick={()=>setShowNuevoLead(true)} className="btn-primary" suppressHydrationWarning>
              <UserPlus size={14}/> Nuevo Lead
            </button>
            <button onClick={()=>{
              const ids = selectedIds.size > 0 ? [...selectedIds].join(",") : "";
              window.open(`/api/leads?format=csv${ids?`&ids=${ids}`:""}`, "_blank");
            }} className="btn-ghost" suppressHydrationWarning>
              <Download size={14}/> {selectedIds.size > 0 ? `CSV (${selectedIds.size})` : "CSV"}
            </button>
          </div>
        </div>

        {/* Filtros expandibles */}
        {showFilters && (
          <div className="pl-4 flex items-center gap-3 flex-wrap">
            <select value={filterNicho} onChange={e=>setFilterNicho(e.target.value)}
              className="inp w-auto rounded-full py-2 bg-white text-[12px] font-medium text-gray-600 border-gray-200">
              <option value="">Todos los nichos</option>
              {nichosUnicos.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2">
              <span className="text-[12px] font-medium text-gray-500">Score mín:</span>
              <input type="range" min={0} max={10} step={1} value={filterScore}
                onChange={e=>setFilterScore(Number(e.target.value))}
                className="w-24 accent-[#4E60A9]"/>
              <span className="text-[12px] font-bold text-[#4E60A9] w-6 text-center">{filterScore > 0 ? filterScore : "—"}</span>
            </div>
            {activeFilters > 0 && (
              <button onClick={()=>{ setFilterNicho(""); setFilterScore(0); }}
                className="flex items-center gap-1.5 text-[12px] font-bold text-red-400 hover:text-red-600 bg-red-50 px-3 py-2 rounded-full transition-colors">
                <X size={12}/> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {view === "table" ? (
        /* ── TABLE VIEW ── */
        <div className="flex-1 overflow-hidden p-6 pt-4 flex flex-col">
          <div ref={tableRef} className="card overflow-auto flex-1 p-2 pb-[40px]">
            <table className="t-table">
              <thead>
                <tr>
                  <th className="w-10 pl-4">
                    <input type="checkbox"
                      checked={leads.length>0 && selectedIds.size===leads.length}
                      onChange={toggleSelectAll}
                      className="rounded accent-[#4E60A9] w-3.5 h-3.5 cursor-pointer"/>
                  </th>
                  <th className="w-12">Ref</th>
                  <th>Razón Social</th>
                  <th className="w-40 text-center">Estado CRM</th>
                  <th className="w-20 text-center">Score</th>
                  <th>Nicho</th>
                  <th className="w-28 text-center">Próx. Contacto</th>
                  <th className="w-36 text-center">Decisor</th>
                  <th className="w-48 text-center">Notas rápidas</th>
                  <th className="w-32 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} className="py-32 text-center text-[13px] font-medium text-gray-400">
                    <Activity size={18} className="inline animate-spin mr-2 text-blue-500"/>Cargando pipeline...
                  </td></tr>
                )}
                {!loading && leads.map(lead=>{
                  const st    = S[lead.status_crm] || S.nuevo;
                  const isExp = expanded === lead.id;
                  const isSel = selectedIds.has(lead.id);
                  const nota  = editNota[lead.id] ?? lead.notas ?? "";
                  const proxFecha = lead.fecha_proximo_contacto ? new Date(lead.fecha_proximo_contacto) : null;
                  const hoy = new Date(); hoy.setHours(0,0,0,0);
                  const proxVencida = proxFecha && proxFecha < hoy;
                  const proxHoy = proxFecha && proxFecha.toDateString() === hoy.toDateString();
                  return (
                    <Fragment key={`f${lead.id}`}>
                      <tr onClick={()=>{ setExpanded(isExp?null:lead.id); if(!isExp) loadInts(lead.id); }}
                          className={`transition-colors group ${isExp?'bg-blue-50/20 shadow-[inset_4px_0_0_#4E60A9]':isSel?'bg-[#F0F5FF]':'hover:bg-gray-50/50'}`}>
                        <td className="pl-4" onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(lead.id)}
                            className="rounded accent-[#4E60A9] w-3.5 h-3.5 cursor-pointer"/>
                        </td>
                        <td className="mono text-[11px] font-medium text-gray-400 tracking-wider">#{String(lead.id).padStart(4,"0")}</td>
                        <td>
                          <button onClick={e=>{ e.stopPropagation(); setModalLead(lead); }}
                            className="text-left hover:text-[#4E60A9] transition-colors group/name">
                            <div className="font-bold text-[#1E293B] group-hover/name:text-[#4E60A9] tracking-tight text-[13px] transition-colors">{lead.nombre}</div>
                            <div className="text-[11px] text-gray-400 mt-0.5 max-w-sm truncate">{lead.ciudad||"—"}</div>
                          </button>
                        </td>
                        <td className="text-center" onClick={e=>e.stopPropagation()}>
                          <select value={lead.status_crm}
                            onChange={e=>moveStatus(lead.id, e.target.value)}
                            className="text-[11px] font-bold px-3 py-[6px] rounded-full outline-none cursor-pointer border-0 appearance-none text-center shadow-sm w-[110px]"
                            style={{color:st.color, backgroundColor:st.bg}}>
                            {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>
                        <td className="text-center">
                          {lead.score_potencial ? (
                            <span className="text-[14px] font-extrabold tabular-nums"
                              style={{color:lead.score_potencial>=7?"#34A853":lead.score_potencial>=4?"#F59E0B":"#94A3B8"}}>
                              {lead.score_potencial.toFixed(1)}
                            </span>
                          ) : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="text-[12px] font-medium text-[#64748B] max-w-[140px] truncate">{lead.nicho||"—"}</td>
                        <td className="text-center" onClick={e=>e.stopPropagation()}>
                          {proxFecha ? (
                            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${proxVencida?"bg-[#FEF2F2] text-[#DC2626]":proxHoy?"bg-[#EEF3FC] text-[#4E60A9]":"bg-gray-100 text-gray-500"}`}>
                              <Calendar size={10}/>
                              {proxFecha.toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}
                            </span>
                          ) : <span className="text-gray-300 text-[11px]">—</span>}
                        </td>
                        <td className="text-center" onClick={e=>e.stopPropagation()}>
                          {lead.decisor_nombre
                            ? <div className="text-[12px] text-[#202538] font-bold">{lead.decisor_nombre}</div>
                            : <button onClick={()=>searchLinkedin(lead)}
                                className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white px-3 py-1.5 rounded-full transition-colors">+ Inferir</button>}
                        </td>
                        <td className="text-center" onClick={e=>e.stopPropagation()}>
                          <div className="px-2">
                            <input value={nota}
                              onChange={e=>setEditNota(p=>({...p,[lead.id]:e.target.value}))}
                              onBlur={()=>patchLead(lead.id,{notas:nota})}
                              placeholder="Añadir seguimiento..."
                              className="w-full text-[12px] px-3 py-2 bg-gray-50 border border-gray-100 placeholder:text-gray-400 focus:bg-white focus:border-blue-300 rounded-lg outline-none text-[#202538] font-medium"
                              onClick={e=>e.stopPropagation()} />
                          </div>
                        </td>
                        <td onClick={e=>e.stopPropagation()} className="pb-4 pt-4 pr-1">
                          <div className="flex items-center justify-end gap-1 px-2">
                            {waLink(lead.whatsapp || lead.telefono) && (
                              <a href={waLink(lead.whatsapp || lead.telefono)!} target="whatsapp_web"
                                className="w-8 h-8 flex items-center justify-center rounded-full text-white bg-green-500 hover:bg-green-600 transition-all shadow-sm">
                                <MessageCircle size={14} strokeWidth={2.5}/>
                              </a>
                            )}
                            <button onClick={()=>{ genScript(lead); setExpanded(lead.id); }}
                              disabled={loadScr !== null}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                              {loadScr===lead.id ? <Activity size={14} className="animate-spin"/> : <Sparkles size={14} fill="currentColor"/>}
                            </button>
                            <button onClick={e=>{ e.stopPropagation(); setQuoteLead(lead); }}
                              title="Generar cotización"
                              className="w-8 h-8 flex items-center justify-center rounded-full text-[#4E60A9] bg-[#EEF3FC] hover:bg-[#4E60A9] hover:text-white transition-all shadow-sm">
                              <FileText size={14}/>
                            </button>
                            <button onClick={()=>setExpanded(isExp?null:lead.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-all ml-1">
                              {isExp ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                            </button>
                            <button onClick={()=>{
                              const parts=[lead.nombre,lead.telefono||"",lead.correo||"",lead.sitio_web||""].filter(Boolean);
                              navigator.clipboard.writeText(parts.join(" | "));
                              setCopiedRow(lead.id); setTimeout(()=>setCopiedRow(null),1500);
                            }} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-[#4E60A9] hover:bg-[#EEF3FC] transition-all ml-0.5 opacity-0 group-hover:opacity-100">
                              {copiedRow===lead.id?<Check size={13} className="text-[#34A853]"/>:<Copy size={13}/>}
                            </button>
                            <button onClick={()=>deleteLead(lead.id,lead.nombre)}
                              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-[#DC2626] transition-all ml-0.5 opacity-0 group-hover:opacity-100">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expansion Row */}
                      {isExp && (
                        <tr className="bg-[#FAFBFD] border-x-0 shadow-inner">
                          <td colSpan={10} className="p-0">
                            <div className="grid grid-cols-2 divide-x divide-gray-200">
                              <div className="p-8 py-6">
                                <h3 className="text-[13px] font-bold text-gray-400 uppercase tracking-widest mb-4">Registro de Interacciones</h3>
                                <div className="space-y-2 mb-6 max-h-[160px] overflow-y-auto pr-2">
                                  {(ints[lead.id]||[]).length===0 ? (
                                    <p className="text-[12px] italic text-gray-400 py-2">Sin registro para este prospecto.</p>
                                  ) : (ints[lead.id]||[]).map(i=>(
                                    <div key={i.id} className="flex gap-2.5 items-start p-2 rounded-lg bg-white border border-gray-100 shadow-sm">
                                      <span className="text-[10px] font-bold text-gray-400 shrink-0 pt-[2px] w-[35px] text-center bg-gray-50 rounded">
                                        {new Date(i.fecha).toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit"})}
                                      </span>
                                      <span className="text-[11px] font-bold bg-blue-50 text-blue-500 shrink-0 capitalize w-20 px-2 py-0.5 rounded-md text-center">{i.tipo.replace("_"," ")}</span>
                                      <span className="text-[12px] text-[#202538] font-medium flex-1 pt-0.5 truncate pr-2">{i.contenido}</span>
                                      {i.resultado && (
                                        <span className={`text-[10px] font-bold shrink-0 uppercase tracking-wider px-2 py-1 rounded bg-gray-50 ${(i.resultado.includes("positivo")||i.resultado==="cierre")?"text-[#34A853]":(i.resultado.includes("negativo")||i.resultado==="sin_respuesta")?"text-[#EF4444]":"text-gray-500"}`}>
                                          {i.resultado.replace(/_/g," ")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                {/* Próximo contacto */}
                                <div className="mb-4 p-3 bg-white border border-gray-100 rounded-xl flex items-center gap-3 shadow-sm">
                                  <Calendar size={14} className="text-[#4E60A9] shrink-0" />
                                  <div className="flex-1">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Próximo contacto</div>
                                    <input
                                      type="date"
                                      value={lead.fecha_proximo_contacto?.split("T")[0] || ""}
                                      onChange={e => {
                                        const val = e.target.value;
                                        patchLead(lead.id, { fecha_proximo_contacto: val || null });
                                        setLeads(p => p.map(l => l.id === lead.id ? { ...l, fecha_proximo_contacto: val } : l));
                                      }}
                                      className="text-[12px] font-bold text-[#1E293B] outline-none bg-transparent cursor-pointer"
                                    />
                                  </div>
                                  {lead.fecha_proximo_contacto && (
                                    <button onClick={() => {
                                      patchLead(lead.id, { fecha_proximo_contacto: null });
                                      setLeads(p => p.map(l => l.id === lead.id ? { ...l, fecha_proximo_contacto: undefined } : l));
                                    }} className="text-gray-300 hover:text-red-400 transition-colors">
                                      <X size={13} />
                                    </button>
                                  )}
                                </div>
                              <div className="flex gap-2">
                                  <select value={newTipo} onChange={e=>setNewTipo(e.target.value)} className="inp text-[12px] py-1.5 px-3 min-w-[120px]">
                                    {["mensaje_wa","llamada","visita","email","nota_interna"].map(t=><option key={t}>{t}</option>)}
                                  </select>
                                  <select value={newRes} onChange={e=>setNewRes(e.target.value)} className="inp text-[12px] py-1.5 px-3 min-w-[120px]">
                                    {["sin_respuesta","respondio_positivo","respondio_negativo","cita_agendada","cierre"].map(r=><option key={r}>{r}</option>)}
                                  </select>
                                </div>
                                <div className="flex gap-2 mt-2">
                                  <input value={newCont} onChange={e=>setNewCont(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addInt(lead.id)}
                                    placeholder="Nota de seguimiento rápido..." className="inp flex-1 text-[13px] py-2 bg-white" />
                                  <button onClick={()=>addInt(lead.id)} className="btn-primary py-2 text-[11px] tracking-wider">AÑADIR</button>
                                </div>
                              </div>

                              <div className="p-8 py-6">
                                <h3 className="text-[13px] font-bold text-[#4E60A9] uppercase tracking-widest mb-4 flex items-center gap-1.5">
                                  <Sparkles size={14} fill="currentColor"/> Script IA
                                </h3>
                                {!scripts[lead.id] ? (
                                  <button onClick={()=>genScript(lead)} disabled={loadScr===lead.id}
                                    className="w-full py-8 border-2 border-dashed border-[#8CAAF5]/50 bg-[#EEF3FC]/50 rounded-2xl text-[12px] text-[#4E60A9] font-bold hover:border-[#4E60A9] transition-all flex flex-col items-center justify-center gap-2">
                                    {loadScr===lead.id ? <><Activity size={24} className="animate-spin mb-1"/>Generando...</> : <><Sparkles size={24} fill="currentColor" className="mb-1"/>Generar script con IA</>}
                                  </button>
                                ) : (
                                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
                                    {Object.entries(scripts[lead.id]).map(([k,txt])=>(
                                      <div key={k} className="bg-white border border-gray-100 rounded-2xl p-4 relative group/s shadow-sm">
                                        <div className="text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">{k.replace("_"," ")}</div>
                                        <p className="text-[13px] leading-relaxed text-[#202538] font-medium whitespace-pre-wrap pr-16">{txt}</p>
                                        <div className="absolute top-4 right-4 flex flex-col gap-1.5 opacity-0 group-hover/s:opacity-100 transition-opacity">
                                          <button onClick={()=>copyText(k,txt)}
                                            className="w-8 h-8 flex items-center justify-center text-[#202538] bg-gray-50 border border-gray-100 rounded-full hover:bg-gray-100 shadow-sm transition-all">
                                            {copied===k?<Check size={12}/>:<Copy size={12}/>}
                                          </button>
                                          {waLink(lead.whatsapp || lead.telefono) && (
                                            <a href={waLink(lead.whatsapp || lead.telefono, txt)!}
                                              target="_blank" rel="noopener noreferrer"
                                              className="w-8 h-8 flex items-center justify-center text-white bg-green-500 rounded-full hover:bg-green-600 shadow-sm transition-all">
                                              <ExternalLink size={12}/>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {!loading && leads.length===0 && (
                  <tr><td colSpan={10} className="py-32 text-center text-[14px] font-medium text-gray-400">Sin resultados para la búsqueda actual.</td></tr>
                )}
                {!loading && leads.length < total && (
                  <tr>
                    <td colSpan={10} className="py-4 text-center border-t border-dashed border-gray-200">
                      <button onClick={loadMore} disabled={loadingMore}
                        className="text-[12px] font-bold text-gray-400 hover:text-[#4E60A9] transition-colors disabled:opacity-50">
                        {loadingMore
                          ? <span className="flex items-center justify-center gap-1.5"><Activity size={12} className="animate-spin"/>Cargando...</span>
                          : `↓ Cargar más · ${total - leads.length} restantes`}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── KANBAN VIEW ── */
        <div className="flex-1 overflow-x-auto p-6 pt-4">
          <div className="flex gap-3 h-full min-w-max">
            {KANBAN_COLS.map(col=>{
              const st = S[col];
              const colLeads = leads.filter(l=>l.status_crm===col);
              return (
                <div key={col} style={{width:252}} className="flex flex-col gap-2 shrink-0">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 rounded-[13px] border"
                    style={{backgroundColor: st.bg, borderColor: `${st.color}20`}}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{background: st.color}}/>
                      <span className="text-[12px] font-extrabold" style={{color:st.color}}>{st.label}</span>
                    </div>
                    <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-white/70" style={{color:st.color}}>{colLeads.length}</span>
                  </div>
                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pb-4" style={{maxHeight:"calc(100vh - 230px)"}}>
                    {colLeads.length===0 && (
                      <div className="py-8 text-center text-[11px] text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">Sin leads</div>
                    )}
                    {colLeads.map(lead=>{
                      const proxFecha = lead.fecha_proximo_contacto ? new Date(lead.fecha_proximo_contacto+"T00:00:00") : null;
                      const hoy = new Date(); hoy.setHours(0,0,0,0);
                      const venc = proxFecha && proxFecha < hoy;
                      const sc = lead.score_potencial;
                      const scoreColor = sc && sc>=7 ? "#059669" : sc && sc>=4 ? "#D97706" : "#94A3B8";
                      const scoreBg   = sc && sc>=7 ? "#ECFDF5" : sc && sc>=4 ? "#FFFBEB" : "#F1F5F9";
                      return (
                        <div key={lead.id}
                          onClick={()=>{ setModalLead(lead); loadInts(lead.id); }}
                          className="bg-white rounded-2xl p-3.5 cursor-pointer group transition-all duration-[130ms]"
                          style={{
                            border: `1.5px solid ${venc ? "#FECACA" : "#E8EFF8"}`,
                            boxShadow: "0 2px 8px -3px rgba(0,0,0,0.05)",
                          }}
                          onMouseEnter={e=>{
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 5px 18px -4px rgba(66,125,250,0.13)";
                            (e.currentTarget as HTMLElement).style.borderColor = "#BFDBFE";
                          }}
                          onMouseLeave={e=>{
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px -3px rgba(0,0,0,0.05)";
                            (e.currentTarget as HTMLElement).style.borderColor = venc ? "#FECACA" : "#E8EFF8";
                          }}>
                          {/* Nombre + score */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-bold text-[13px] text-[#1E293B] leading-snug flex-1">{lead.nombre}</div>
                            {sc && (
                              <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0"
                                style={{color: scoreColor, background: scoreBg}}>
                                {sc}/10
                              </span>
                            )}
                          </div>
                          {/* Nicho + ciudad */}
                          <div className="text-[11px] text-[#94A3B8] mb-2 truncate">{lead.nicho||"—"} · {lead.ciudad||"—"}</div>
                          {/* Decisor */}
                          {lead.decisor_nombre && (
                            <div className="text-[11px] font-semibold text-[#7C3AED] bg-[#F5F3FF] px-2 py-1 rounded-lg mb-2 truncate">
                              👤 {lead.decisor_nombre}
                            </div>
                          )}
                          {/* Notas preview */}
                          {lead.notas && (
                            <div className="text-[11px] text-[#64748B] bg-[#F8FAFC] px-2.5 py-1.5 rounded-lg mb-2 leading-snug"
                              style={{overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                              {lead.notas}
                            </div>
                          )}
                          {/* Footer: fecha + acciones */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-gray-100">
                            {proxFecha ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{color: venc ? "#DC2626" : "#4E60A9", background: venc ? "#FEF2F2" : "#EEF3FC"}}>
                                {venc ? <AlertTriangle size={9}/> : <Calendar size={9}/>}
                                {venc ? "Vencido" : proxFecha.toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}
                              </span>
                            ) : <span/>}
                            <div className="flex gap-1.5">
                              {waLink(lead.whatsapp || lead.telefono) && (
                                <a href={waLink(lead.whatsapp || lead.telefono)!} target="whatsapp_web"
                                  onClick={e=>e.stopPropagation()}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A] hover:bg-green-500 hover:text-white transition-colors">
                                  <MessageCircle size={11}/>
                                </a>
                              )}
                              <button onClick={e=>{e.stopPropagation();setQuoteLead(lead);}} title="Cotizar"
                                className="w-6 h-6 flex items-center justify-center rounded-full bg-[#EEF3FC] text-[#4E60A9] hover:bg-[#4E60A9] hover:text-white transition-colors">
                                <FileText size={11}/>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-[#1E293B] text-white px-5 py-3 rounded-2xl shadow-[0_8px_30px_-4px_rgba(0,0,0,0.3)] border border-white/10">
          <span className="text-[13px] font-bold text-white/80 pr-2 border-r border-white/20">
            {selectedIds.size} seleccionado{selectedIds.size>1?"s":""}
          </span>
          <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}
            className="text-[12px] font-bold bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 outline-none cursor-pointer text-white">
            <option value="">Cambiar estado...</option>
            {STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {bulkStatus && (
            <button onClick={()=>bulkChangeStatus(bulkStatus)}
              className="flex items-center gap-1.5 text-[12px] font-bold bg-[#4E60A9] px-4 py-1.5 rounded-xl hover:bg-[#3668d6] transition-colors">
              <Check size={13}/> Aplicar
            </button>
          )}
          <button onClick={bulkDelete}
            className="flex items-center gap-1.5 text-[12px] font-bold text-red-300 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-xl transition-colors">
            <Trash2 size={13}/> Eliminar
          </button>
          <button onClick={()=>setSelectedIds(new Set())}
            className="text-white/40 hover:text-white transition-colors ml-1">
            <X size={16}/>
          </button>
        </div>
      )}

      {/* Quote Modal */}
      {quoteLead && <QuoteModal lead={quoteLead} onClose={() => setQuoteLead(null)} />}

      {/* Lead Detail Modal */}
      <LeadModal
        lead={modalLead}
        onClose={()=>setModalLead(null)}
        onUpdate={(id, upd)=>setLeads(p=>p.map(l=>l.id===id?{...l,...upd}:l))}
        onDelete={(id)=>{ setLeads(p=>p.filter(l=>l.id!==id)); }}
      />

      {/* Nuevo Lead Modal */}
      {showNuevoLead && (
        <NuevoLeadModal
          onClose={()=>setShowNuevoLead(false)}
          onCreated={(lead)=>{ setLeads(p=>[lead,...p]); }}
        />
      )}

      {/* LinkedIn Modal */}
      {linkedinOpen!==null && (
        <div className="fixed inset-0 bg-white/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[28px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden border border-gray-100">
            <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100">
              <h3 className="font-bold text-[18px] text-[#202538] tracking-tight">Buscar Decisor</h3>
              <button onClick={()=>{setLinkedinOpen(null);setLinkedinData(null);}} className="text-gray-400 hover:text-red-500 text-lg transition-colors p-1">✕</button>
            </div>
            <div className="p-8 pb-10 bg-[#FAFCFF]">
              {!linkedinData ? (
                <div className="py-8 text-center text-[13px] font-medium text-gray-400 flex flex-col items-center gap-3">
                  <Activity size={24} className="animate-spin text-blue-500"/>Buscando en LinkedIn...
                </div>
              ) : (
                <div className="space-y-3">
                  {linkedinData.resultados?.length>0 ? linkedinData.resultados.map((r:any,i:number)=>(
                    <div key={i} className="flex items-start gap-4 p-4 bg-white border border-gray-100 shadow-sm rounded-2xl hover:border-blue-200 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#EEF3FC] flex items-center justify-center text-sm font-bold text-blue-500 shrink-0">{r.nombre?.[0]}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#1E293B] text-[14px]">{r.nombre}</div>
                        <div className="text-[12px] font-medium text-gray-500 mt-0.5">{r.cargo}</div>
                        <a href={r.linkedin} target="_blank" rel="noopener noreferrer" className="text-[11px] font-bold text-blue-500 hover:underline block truncate mt-1">{r.linkedin}</a>
                      </div>
                      <button onClick={()=>saveDecissor(linkedinOpen,r)} className="btn-primary px-4 py-2 font-bold text-[10px]">VINCULAR</button>
                    </div>
                  )) : <p className="text-[13px] text-gray-400 font-medium py-6 text-center italic bg-white rounded-xl">Sin resultados automáticos.</p>}
                  <a href={linkedinData.google_search_url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-bold text-[#4E60A9] hover:underline block mt-4 text-center">Abrir Google ↗</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
