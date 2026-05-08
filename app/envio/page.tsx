"use client";

import { useEffect, useState } from "react";
import { waLink as buildWaLink } from "@/lib/ui";
import { Activity, Sparkles, Copy, Check, ExternalLink, RefreshCw, Send, CheckCircle2, Search, Calendar, ChevronRight } from "lucide-react";

interface Lead { id:number; nombre:string; telefono?:string; ciudad?:string; nicho?:string; decisor_nombre?:string; status_crm:string; notas?:string; }
interface Scripts { profesional:string; directo:string; problema_solucion:string; }

const S_OPTS = ["nuevo","contactado","seguimiento","diagnostico"];
const SCRL: Record<string,string> = { profesional:"Tono Técnico Profesional", directo:"Contacto Directo", problema_solucion:"Metodología P.A.S." };

export default function EnvioPage() {
  const [leads, setLeads]           = useState<Lead[]>([]);
  const [filterS, setFilterS]       = useState("nuevo");
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [activeLead, setActiveLead] = useState<Lead|null>(null);
  const [scripts, setScripts]       = useState<Scripts|null>(null);
  const [loadingScr, setLoadingScr] = useState(false);
  const [copied, setCopied]         = useState<string|null>(null);
  const [editedScripts, setEditedScripts] = useState<Record<string,string>>({});
  const [editing, setEditing]       = useState<string|null>(null);
  // Sent tracking: lead_id ? { sent, followUpDate }
  const [sent, setSent]             = useState<Record<number,{done:boolean;date:string}>>({});

  useEffect(()=>{ fetchLeads(); },[filterS]);

  const fetchLeads = async () => {
    const d = await fetch(`/api/leads?status=${filterS}`).then(r=>r.json());
    if(d.leads) setLeads(d.leads);
    setSelected(new Set());
  };

  const toggle = (id:number) => setSelected(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n; });
  const toggleAll = () => setSelected(selected.size===leads.length?new Set():new Set(leads.map(l=>l.id)));

  const genScripts = async (lead:Lead) => {
    setActiveLead(lead); setScripts(null); setLoadingScr(true);
    const d = await fetch("/api/script",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:lead.id})}).then(r=>r.json());
    if(d.scripts) setScripts(d.scripts);
    setLoadingScr(false);
  };

  const waLink = (lead:Lead, text:string) => buildWaLink(lead.telefono, text) ?? "#";

  const markSent = async (lead:Lead, followUpDate?:string) => {
    await fetch("/api/leads",{method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:lead.id, status_crm:"contactado", ...(followUpDate?{fecha_proximo_contacto:followUpDate}:{})})});
    setSent(p=>({...p,[lead.id]:{done:true,date:followUpDate||""}}));
    setLeads(p=>p.map(l=>l.id===lead.id?{...l,status_crm:"contactado"}:l));
  };

  const selLeads = leads.filter(l=>selected.has(l.id));
  const defaultMsg = `Hola, soy Fernando de Bionordi. Nos especializamos en reparación de transductores de ultrasonido biomédico. ¿Tienen equipo que requiera servicio técnico en este momento?`;

  return (
    <div className="h-full flex flex-col font-sans">

      {/* Header */}
      <div className="flex justify-between items-center px-4 mb-2">
        <div className="flex items-center gap-6 pl-4">
          <div>
            <h1 className="text-[28px] font-medium text-[#202538] leading-tight tracking-[-0.03em]">Motor de Prospección IA</h1>
            <p className="text-[#8B95A5] text-[13px] font-medium tracking-tight mt-0.5">Genera scripts y envía WhatsApp sin riesgo de bloqueo.</p>
          </div>
          <div className="h-8 w-[1.5px] bg-gray-200 ml-2"></div>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-bold text-gray-400 uppercase tracking-widest">Etapa:</span>
            <select value={filterS} onChange={e=>setFilterS(e.target.value)}
              className="inp w-auto rounded-full py-[10px] bg-gray-50 border-transparent hover:bg-white hover:border-gray-200 font-bold text-gray-600 transition-all shadow-sm">
              {S_OPTS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[12px] font-bold text-gray-400">
          <span className="bg-gray-100 px-3 py-1.5 rounded-full">{leads.length} leads en esta etapa</span>
          {selected.size > 0 && <span className="bg-[#EEF3FC] text-[#4E60A9] px-3 py-1.5 rounded-full">{selected.size} seleccionados</span>}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden p-6 pt-4 gap-[24px]">

        {/* 01  Selección */}
        <div className="w-[320px] shrink-0 card flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-[14px] text-[#202538] flex items-center gap-2">
              <span className="w-5 h-5 bg-[#EEF3FC] text-[#4E60A9] rounded-md flex items-center justify-center text-[10px] font-bold">1</span>
              Selección
            </h3>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-gray-400 font-bold hover:text-gray-600 transition-colors">
              <input type="checkbox" checked={selected.size===leads.length&&leads.length>0} onChange={toggleAll}
                className="rounded outline-none accent-[#5A82ED] w-3.5 h-3.5" />
              Todo
            </label>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {leads.map(lead=>(
              <div key={lead.id} onClick={()=>toggle(lead.id)}
                className={`flex items-center gap-3 p-3 cursor-pointer rounded-xl transition-all border ${selected.has(lead.id)?"bg-[#EEF3FC] border-[#4E60A9]/20":"border-gray-100 hover:bg-gray-50 hover:border-gray-200"} ${sent[lead.id]?.done?"opacity-60":""}`}>
                <input type="checkbox" checked={selected.has(lead.id)} onChange={()=>{}} className="rounded outline-none accent-[#5A82ED] w-4 h-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[#1E293B] truncate">{lead.nombre}</div>
                  <div className="text-[11px] text-gray-400 mt-0.5 truncate">{lead.nicho} · {lead.ciudad}</div>
                  {sent[lead.id]?.done && (
                    <span className="text-[10px] font-bold text-[#34A853] flex items-center gap-1 mt-0.5"><CheckCircle2 size={10}/> Enviado</span>
                  )}
                </div>
                <button onClick={e=>{e.stopPropagation();genScripts(lead);}}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition-all shrink-0 ${activeLead?.id===lead.id?"bg-[#4E60A9] text-white shadow-md":"text-[#4E60A9] bg-white border border-blue-100 hover:bg-[#4E60A9] hover:text-white"}`}>
                  <Sparkles size={13} fill="currentColor"/>
                </button>
              </div>
            ))}
            {leads.length===0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
                <Search size={24} className="text-gray-300"/>
                <p className="text-[12px] text-gray-400 font-medium">Sin leads en esta etapa.</p>
              </div>
            )}
          </div>
        </div>

        {/* 02  Scripts IA */}
        <div className="flex-1 card flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-[14px] text-[#202538] flex items-center gap-2">
              <span className="w-5 h-5 bg-[#EEF3FC] text-[#4E60A9] rounded-md flex items-center justify-center text-[10px] font-bold">2</span>
              Script IA
              {activeLead && <span className="text-[12px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-3 py-1 rounded-full ml-1">{activeLead.nombre}</span>}
            </h3>
            {activeLead && (
              <button onClick={()=>genScripts(activeLead)} className="btn-ghost text-[11px] px-3 py-1.5">
                <RefreshCw size={12}/> Regenerar
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#FAFCFF]">
            {loadingScr && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-[#4E60A9]">
                <Activity size={28} className="animate-spin"/>
                <span className="text-[12px] font-bold text-gray-400">Claude generando script personalizado...</span>
              </div>
            )}
            {!loadingScr && !scripts && (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-40">
                <div className="w-16 h-16 rounded-[20px] bg-[#EEF3FC] flex items-center justify-center">
                  <Sparkles size={28} className="text-[#4E60A9]" fill="currentColor"/>
                </div>
                <p className="text-[13px] font-bold text-[#202538]">Selecciona un lead y presiona ? para generar su script.</p>
              </div>
            )}
            {scripts && Object.entries(scripts).map(([k,txt])=>{
              const current = editedScripts[k] ?? txt;
              const isEditing = editing === k;
              return (
              <div key={k} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden hover:border-blue-200 transition-all group/s">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-[#F8FAFC]">
                  <span className="text-[11px] font-bold text-[#2B355A] uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={11} className="text-[#4E60A9]"/>{SCRL[k]||k}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={()=>setEditing(isEditing?null:k)}
                      className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-3 py-1.5 transition-all border ${isEditing?"bg-[#4E60A9] text-white border-[#4E60A9]":"bg-white border-gray-200 text-gray-500 hover:text-[#4E60A9] hover:border-blue-200"}`}>
                      {isEditing ? "Listo" : "Editar"}
                    </button>
                    <button onClick={()=>{navigator.clipboard.writeText(current);setCopied(k);setTimeout(()=>setCopied(null),1500);}}
                      className="flex items-center gap-1.5 text-[11px] font-bold bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-500 hover:text-[#4E60A9] hover:border-blue-200 transition-all">
                      {copied===k ? <><Check size={11} className="text-green-500"/>Copiado</> : <><Copy size={11}/>Copiar</>}
                    </button>
                    {activeLead?.telefono && (
                      <a href={waLink(activeLead,current)} 
                        onClick={()=>fetch("/api/script",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({lead_id:activeLead!.id,tipo:k})})}
                        className="flex items-center gap-1.5 text-[11px] font-bold bg-white border border-green-200 rounded-full px-3 py-1.5 text-green-600 hover:bg-green-50 transition-all">
                        <ExternalLink size={11}/>Abrir WA
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-5">
                  {isEditing
                    ? <textarea value={current} onChange={e=>setEditedScripts(p=>({...p,[k]:e.target.value}))}
                        className="w-full text-[13px] leading-relaxed text-[#374151] font-medium bg-[#F8FAFF] border border-blue-200 rounded-xl p-3 outline-none resize-none focus:border-[#4E60A9] transition-colors"
                        rows={6}/>
                    : <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-[#374151] font-medium">{current}</p>
                  }
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* 03  Envío + Cierre */}
        <div className="w-[300px] shrink-0 card flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
            <h3 className="font-bold text-[14px] text-[#202538] flex items-center gap-2">
              <span className="w-5 h-5 bg-[#EEF3FC] text-[#4E60A9] rounded-md flex items-center justify-center text-[10px] font-bold">3</span>
              Envío y Cierre
            </h3>
            {selLeads.length > 0 && (
              <span className="text-[10px] font-bold text-green-600 bg-[#EEF9F1] px-2 py-1 rounded-full">
                {selLeads.filter(l=>l.telefono).length} con WA
              </span>
            )}
          </div>

          {selLeads.length===0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
              <Send size={24} className="text-gray-200"/>
              <p className="text-[12px] font-medium text-gray-400">Selecciona leads en el panel 1 para ver sus links de envío.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {selLeads.map(lead=>{
                const ph = lead.telefono?.replace(/\D/g,"");
                const scrText = scripts && activeLead?.id===lead.id ? scripts.directo : defaultMsg;
                const isSent = sent[lead.id]?.done;
                return (
                  <div key={lead.id} className={`rounded-2xl border p-4 transition-all ${isSent?"bg-[#EEF9F1] border-green-100":"bg-white border-gray-100"}`}>
                    <div className="text-[13px] font-bold text-[#1E293B] truncate mb-0.5">{lead.nombre}</div>
                    <div className="text-[11px] text-gray-400 mb-3">{ph ? `+52 ${ph}` : "Sin teléfono"}</div>

                    {isSent ? (
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#34A853]">
                        <CheckCircle2 size={13}/> Contactado
                        {sent[lead.id].date && <span className="text-gray-400 ml-1">· {new Date(sent[lead.id].date).toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}</span>}
                      </div>
                    ) : ph ? (
                      <div className="space-y-2">
                        {/* WA links */}
                        <div className="flex gap-1.5">
                          <a href={buildWaLink(lead.telefono, defaultMsg) ?? "#"}
                            target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-center text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-200 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                            WA Genérico
                          </a>
                          {scripts && activeLead?.id===lead.id && (
                            <a href={buildWaLink(lead.telefono, scrText) ?? "#"}
                              target="_blank" rel="noopener noreferrer"
                              className="flex-1 text-center text-[11px] font-bold text-white bg-[#34A853] py-1.5 rounded-lg hover:bg-[#2E964A] transition-colors flex items-center justify-center gap-1 shadow-sm">
                              <Sparkles size={10} fill="currentColor"/> Script
                            </a>
                          )}
                        </div>
                        {/* Mark sent + follow-up */}
                        <MarkSentRow lead={lead} onMark={markSent}/>
                      </div>
                    ) : (
                      <span className="text-[11px] font-bold text-red-400 bg-red-50 px-2 py-1 rounded-lg w-full text-center block">Sin teléfono</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarkSentRow({ lead, onMark }: { lead:Lead; onMark:(l:Lead,d?:string)=>void }) {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState("");
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+3);
  const defaultDate = tomorrow.toISOString().split("T")[0];

  return expanded ? (
    <div className="bg-[#F8FAFF] border border-blue-100 rounded-xl p-3 space-y-2">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
        <Calendar size={11}/> Programar seguimiento
      </div>
      <input type="date" defaultValue={defaultDate} onChange={e=>setDate(e.target.value)}
        className="w-full text-[12px] font-bold text-[#1E293B] bg-white border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-[#4E60A9]/40"/>
      <div className="flex gap-1.5">
        <button onClick={()=>onMark(lead, date||defaultDate)}
          className="flex-1 text-[11px] font-bold bg-[#4E60A9] text-white py-1.5 rounded-lg hover:bg-[#3668d6] transition-colors flex items-center justify-center gap-1">
          <CheckCircle2 size={11}/> Confirmar
        </button>
        <button onClick={()=>onMark(lead)} className="text-[11px] font-bold text-gray-400 bg-white border border-gray-200 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
          Sin fecha
        </button>
      </div>
    </div>
  ) : (
    <button onClick={()=>setExpanded(true)}
      className="w-full text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] py-1.5 rounded-lg hover:bg-[#4E60A9] hover:text-white transition-all flex items-center justify-center gap-1.5">
      <CheckCircle2 size={11}/> Marcar como enviado
    </button>
  );
}
