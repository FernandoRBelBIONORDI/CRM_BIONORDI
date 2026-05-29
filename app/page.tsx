"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, Sparkles, ChevronRight, Play, Activity,
  AlertTriangle, Calendar, Clock, MessageCircle, Wrench,
  TrendingUp, DollarSign, Flame, CheckCircle2, Database, FileText, HelpCircle,
} from "lucide-react";
import CotizacionManualModal from "@/components/CotizacionManualModal";
import OnboardingTour from "@/components/OnboardingTour";
import { waLink } from "@/lib/ui";

interface DashData {
  metrics: { total:number; nuevo:number; contactado:number; seguimiento:number; diagnostico:number; cliente:number; descartado:number; };
  queues: { topPriorities:any[]; followUps:any[]; iaPending:any[]; proximosSeguimientos:any[]; };
  alerts: { seguimiento7dias:any[]; diagnostico5dias:any[]; };
  negocio: {
    ingresosMes: number;
    otsPorCobrar: any[];
    totalPorCobrar: number;
    leadsCalientes: any[];
    conversionSemanal: any[];
  };
  busquedas: any[];
  taller: { metrics: { activas:number; listas:number; vencidas:number }; ordenes:any[]; };
  cotizaciones: { reparacion?:number; venta?:number; mantenimiento?:number; consumibles?:number; };
}

const STATUS_COLORS: Record<string,{color:string;bg:string;label:string}> = {
  recibido:              { color:"#5A85F1", bg:"#EEF3FC",  label:"Recibido" },
  en_diagnostico:        { color:"#7C3AED", bg:"#F5F3FF",  label:"Diagnóstico" },
  en_reparacion:         { color:"#D97706", bg:"#FFFBEB",  label:"Reparación" },
  en_espera_refacciones: { color:"#EA580C", bg:"#FFF7ED",  label:"Esp. refacciones" },
  listo:                 { color:"#059669", bg:"#ECFDF5",  label:"Listo" },
};

const STATUS_LABEL: Record<string,string> = {
  contactado: "Contactado", seguimiento: "Seguimiento",
  diagnostico: "Diagnóstico", cliente: "Cliente",
};

function fmt(n: number) {
  return new Intl.NumberFormat("es-MX", { style:"currency", currency:"MXN", maximumFractionDigits:0 }).format(n);
}

function SubCard({
  icon: Icon, title, sub, color, bg, stats, cta, href, onClick, tourId,
}: {
  icon: any; title: string; sub: string; color: string; bg: string;
  stats: { v: string|number; l: string; good?: boolean; urgent?: boolean }[];
  cta: string; href?: string; onClick?: () => void; tourId?: string;
}) {
  const [hov, setHov] = useState(false);
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-[13px] flex items-center justify-center border"
          style={{ background: bg, borderColor: `${color}20` }}>
          <Icon size={20} strokeWidth={2} style={{ color }} />
        </div>
        <ChevronRight size={16} style={{ color: hov ? color : "#CBD5E1", transition: "color .15s" }} />
      </div>
      <div>
        <div className="text-[15px] font-extrabold text-[#1E293B] tracking-[-0.02em] leading-tight mb-0.5">{title}</div>
        <div className="text-[11px] text-[#94A3B8]">{sub}</div>
      </div>
      <div className="flex gap-4 flex-wrap">
        {stats.map((st, i) => (
          <div key={i}>
            <div className="text-[21px] font-black leading-none tracking-[-0.04em]"
              style={{ color: st.urgent ? "#DC2626" : st.good ? "#059669" : color }}>
              {st.v}
            </div>
            <div className="text-[10px] text-[#94A3B8] font-semibold mt-0.5">{st.l}</div>
          </div>
        ))}
      </div>
      <div className="text-[12px] font-bold px-3 py-1.5 rounded-[10px] w-fit transition-all duration-150"
        style={{ background: hov ? color : bg, color: hov ? "#fff" : color }}>
        {cta}
      </div>
    </>
  );
  const cls = `flex-1 rounded-[20px] p-5 flex flex-col gap-3.5 cursor-pointer transition-all duration-[180ms] border ${
    hov ? "shadow-lg" : "shadow-[0_2px_10px_-3px_rgba(0,0,0,0.04)]"
  }`;
  const style = {
    background: hov ? bg : "#fff",
    borderColor: hov ? `${color}30` : "#E8EFF8",
    boxShadow: hov ? `0 8px 28px -6px ${color}22` : undefined,
  };
  if (onClick) return (
    <div className={cls} style={style} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick} data-tour={tourId}>
      {inner}
    </div>
  );
  return (
    <Link href={href!} className={cls} style={style} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} data-tour={tourId}>
      {inner}
    </Link>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [data, setData] = useState<DashData|null>(null);
  const [loading, setLoading] = useState(true);
  const [showCotizacion, setShowCotizacion] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Ejecutar auto-move como acción explícita, no como efecto secundario del GET
      await fetch("/api/dashboard/automove", { method: "POST" });
      setData(await (await fetch("/api/dashboard")).json());
    } catch(e) {
      console.error("Error cargando dashboard:", e);
    }
    setLoading(false);
  };

  const startTour = () => {
    router.push("/?runTour=true");
  };

  useEffect(() => { load(); }, []);

  const m  = data?.metrics  || { total:0, nuevo:0, contactado:0, seguimiento:0, diagnostico:0, cliente:0, descartado:0 };
  const q  = data?.queues   || { topPriorities:[], followUps:[], iaPending:[], proximosSeguimientos:[] };
  const al = data?.alerts   || { seguimiento7dias:[], diagnostico5dias:[] };
  const ng = data?.negocio  || { ingresosMes:0, otsPorCobrar:[], totalPorCobrar:0, leadsCalientes:[], conversionSemanal:[] };
  const taller = data?.taller || { metrics:{ activas:0, listas:0, vencidas:0 }, ordenes:[] };
  const cot = data?.cotizaciones || {};

  const totalConvSemana = ng.conversionSemanal.reduce((s:number, r:any) => s + r.cnt, 0);

  return (
    <div className="h-full flex flex-col gap-4 font-sans overflow-y-auto pb-6">

      {/* -- Welcome -- */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end px-4 md:px-5 mt-3 gap-2 md:gap-0">
        <div className="flex items-start justify-between md:block">
          <div>
            <h1 className="text-[26px] md:text-[38px] font-medium text-[#202538] leading-tight tracking-[-1px]">Bienvenido, {session?.user?.name?.split(" ")[0] ?? ""}.</h1>
            <p className="text-[#8B95A5] text-[12px] md:text-[13px] mt-0.5 md:mt-1 font-medium tracking-tight">Panel de prospección y gestión de equipo biomédico.</p>
          </div>
          
          <div className="flex items-center gap-2 md:hidden">
            {/* Botón tutorial en móvil */}
            <button onClick={startTour} title="Ver Tutorial"
              className="w-10 h-10 bg-[#EEF3FC] text-[#4E60A9] rounded-full flex items-center justify-center shadow-sm transition-all shrink-0">
              <Play size={15} strokeWidth={2.5}/>
            </button>
            {/* Refresh solo visible en móvil aquí */}
            <button onClick={load} title="Actualizar"
              className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-[#4E60A9] transition-all shrink-0 ${loading ? "animate-spin text-blue-400" : ""}`}>
              <Activity size={17} strokeWidth={2}/>
            </button>
          </div>
        </div>

        {/* Stats rápidos en móvil */}
        <div className="flex md:hidden gap-2 overflow-x-auto pb-1">
          <div className="bg-[#EEF9F1] rounded-2xl flex items-center gap-2 px-4 py-2.5 border border-green-100 shrink-0">
            <TrendingUp size={13} className="text-[#059669]" />
            <div>
              <div className="text-[12px] font-bold text-[#059669] leading-tight">{fmt(ng.ingresosMes)}</div>
              <div className="text-[10px] text-green-600/70">Ingresos mes</div>
            </div>
          </div>
          {ng.totalPorCobrar > 0 && (
            <div className="bg-[#FFFBEB] rounded-2xl flex items-center gap-2 px-4 py-2.5 border border-amber-200 shrink-0">
              <DollarSign size={13} className="text-[#D97706]" />
              <div>
                <div className="text-[12px] font-bold text-[#D97706] leading-tight">{fmt(ng.totalPorCobrar)}</div>
                <div className="text-[10px] text-amber-600/70">{ng.otsPorCobrar.length} OT{ng.otsPorCobrar.length !== 1 ? "s" : ""} por cobrar</div>
              </div>
            </div>
          )}
          <Link href="/crm" className="bg-white rounded-2xl flex items-center gap-2 px-4 py-2.5 border border-gray-100 shrink-0">
            <div className="text-[12px] font-bold text-[#1E293B]">{m.diagnostico}</div>
            <div className="text-[10px] text-gray-400">En diagnóstico</div>
          </Link>
        </div>

        {/* Pills escritorio */}
        <div className="hidden md:flex items-center gap-3">
          {/* Botón tutorial en escritorio */}
          <button onClick={startTour} title="Ver Tutorial Didáctico"
            className="w-10 h-10 bg-[#EEF3FC] text-[#4E60A9] hover:bg-[#4E60A9] hover:text-white rounded-full flex items-center justify-center shadow-sm hover:scale-105 transition-all">
            <Play size={15} strokeWidth={2.5}/>
          </button>
          <button onClick={load} title="Actualizar"
            className={`w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-[#4E60A9] hover:scale-105 transition-all ${loading ? "animate-spin text-blue-400" : ""}`}>
            <Activity size={17} strokeWidth={2}/>
          </button>
          <Link href="/encontrar" className="h-[56px] w-[48px] bg-[#3B3E4B] rounded-[18px] flex items-center justify-center text-white shadow-md hover:bg-[#202538] transition-colors">
            <Search size={20} strokeWidth={2.5}/>
          </Link>
          <div className="h-[56px] bg-[#EEF9F1] rounded-[18px] flex items-center justify-between px-5 w-[200px] border border-green-100">
            <div>
              <div className="text-[14px] font-bold text-[#059669] tracking-tight flex items-center gap-1.5">
                {fmt(ng.ingresosMes)} <TrendingUp size={12}/>
              </div>
              <div className="text-[11px] text-green-600/70 font-medium">Ingresos del mes</div>
            </div>
          </div>
          <div className={`h-[56px] rounded-[18px] flex items-center justify-between px-5 w-[185px] border ${ng.totalPorCobrar > 0 ? "bg-[#FFFBEB] border-amber-200" : "bg-white border-gray-100"}`}>
            <div>
              <div className={`text-[14px] font-bold tracking-tight flex items-center gap-1.5 ${ng.totalPorCobrar > 0 ? "text-[#D97706]" : "text-gray-300"}`}>
                {fmt(ng.totalPorCobrar)} <DollarSign size={12}/>
              </div>
              <div className={`text-[11px] font-medium ${ng.totalPorCobrar > 0 ? "text-amber-600/70" : "text-gray-300"}`}>
                {ng.otsPorCobrar.length > 0 ? `${ng.otsPorCobrar.length} OT${ng.otsPorCobrar.length > 1 ? "s" : ""} por cobrar` : "Sin OTs listas"}
              </div>
            </div>
          </div>
          <Link href="/crm" className="h-[56px] bg-white/70 backdrop-blur-md rounded-[18px] shadow-sm flex items-center justify-between px-5 w-[165px] group hover:bg-white transition-colors border border-white/60">
            <div>
              <div className="text-[14px] font-bold text-[#1E293B] tracking-tight">{m.diagnostico} Leads</div>
              <div className="text-[11px] text-gray-400 font-medium">En diagnóstico</div>
            </div>
            <ChevronRight size={15} strokeWidth={2.5} className="text-gray-300 group-hover:text-gray-500 transition-colors"/>
          </Link>
        </div>
      </div>

      {/* -- Sub-app cards -- */}
      <div className="px-4 md:px-5 flex flex-col md:flex-row gap-3 md:gap-4">
        <SubCard
          icon={Database} title="Ventas & CRM" sub="Pipeline, prospectos y seguimiento"
          color="#4E60A9" bg="#EEF3FC" href="/crm"
          stats={[
            { v: m.total,       l: "Leads" },
            { v: m.diagnostico, l: "En diagnóstico" },
            { v: m.cliente,     l: "Clientes", good: true },
          ]}
          cta="Abrir CRM"
          tourId="crm-card"
        />
        <SubCard
          icon={Wrench} title="Taller & Reparaciones" sub="Órdenes de trabajo activas"
          color="#7C3AED" bg="#F5F3FF" href="/taller"
          stats={[
            { v: taller.metrics.activas, l: "Activas" },
            { v: taller.metrics.listas,  l: "Listas",   good: taller.metrics.listas > 0 },
            { v: taller.metrics.vencidas,l: "Vencidas",  urgent: taller.metrics.vencidas > 0 },
          ]}
          cta="Ver órdenes"
          tourId="taller-card"
        />
        <SubCard
          icon={FileText} title="Cotizaciones" sub="Genera propuestas técnicas en PDF"
          color="#059669" bg="#ECFDF5"
          stats={[
            { v: cot.reparacion  ?? 0, l: "Reparación" },
            { v: cot.venta       ?? 0, l: "Venta" },
            { v: cot.mantenimiento ?? 0, l: "Mantenimiento" },
          ]}
          cta="Nueva cotización"
          onClick={() => setShowCotizacion(true)}
          tourId="cotizaciones-card"
        />
      </div>

      {showCotizacion && <CotizacionManualModal onClose={() => setShowCotizacion(false)} />}

      {/* -- Pipeline Funnel -- */}
      <div className="px-4 md:px-5" data-tour="pipeline-funnel">
        <div className="bg-white rounded-[18px] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] px-3 md:px-6 py-3 md:py-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max md:min-w-0">
          {[
            { key:"nuevo",       label:"Nuevos",      color:"#5A85F1", bg:"#EEF3FC" },
            { key:"contactado",  label:"Contactados", color:"#D97706", bg:"#FFFBEB" },
            { key:"seguimiento", label:"Seguimiento", color:"#EA580C", bg:"#FFF7ED" },
            { key:"diagnostico", label:"Diagnóstico", color:"#7C3AED", bg:"#F5F3FF" },
            { key:"cliente",     label:"Clientes",    color:"#34A853", bg:"#EEF9F1" },
          ].map((stage, i, arr) => {
            const count = m[stage.key as keyof typeof m] as number || 0;
            const prev  = i > 0 ? (m[arr[i-1].key as keyof typeof m] as number || 0) : null;
            const pct   = prev && prev > 0 ? Math.round((count / prev) * 100) : null;
            return (
              <div key={stage.key} className="flex items-center gap-1 flex-1">
                <Link href={`/crm?status=${stage.key}`} className="flex-1 flex flex-col items-center py-2 px-3 rounded-xl hover:opacity-80 transition-opacity" style={{backgroundColor:stage.bg}}>
                  <span className="text-[22px] font-extrabold tracking-tight" style={{color:stage.color}}>{count}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{color:stage.color}}>{stage.label}</span>
                </Link>
                {i < arr.length - 1 && (
                  <div className="flex flex-col items-center shrink-0 px-1">
                    <ChevronRight size={15} className="text-gray-200"/>
                    {pct !== null && <span className="text-[9px] font-bold text-gray-300 mt-0.5">{pct}%</span>}
                  </div>
                )}
              </div>
            );
          })}
          <div className="ml-4 pl-4 border-l border-gray-100 flex flex-col items-center shrink-0">
            <span className="text-[22px] font-extrabold text-[#1E293B] tracking-tight">{m.total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-0.5">Total</span>
          </div>
        </div>
        </div>
      </div>

      {/* -- Alertas -- */}
      {(al.seguimiento7dias.length > 0 || al.diagnostico5dias.length > 0) && (
        <div className="px-4 md:px-5 flex flex-col md:flex-row gap-2 md:gap-3">
          {al.seguimiento7dias.length > 0 && (
            <Link href="/crm?status=seguimiento" className="flex-1 flex items-center gap-3 bg-[#FFF7ED] border border-orange-200 rounded-2xl px-5 py-2.5 hover:bg-orange-50 transition-colors">
              <AlertTriangle size={15} className="text-[#EA580C] shrink-0"/>
              <span className="text-[12px] font-bold text-[#EA580C]">{al.seguimiento7dias.length} en Seguimiento sin movimiento +7 días</span>
              <span className="text-[11px] text-orange-400 ml-auto truncate max-w-[200px]">{al.seguimiento7dias.slice(0,2).map((l:any)=>l.nombre).join(", ")}</span>
            </Link>
          )}
          {al.diagnostico5dias.length > 0 && (
            <Link href="/crm?status=diagnostico" className="flex-1 flex items-center gap-3 bg-[#F5F3FF] border border-purple-200 rounded-2xl px-5 py-2.5 hover:bg-purple-50 transition-colors">
              <AlertTriangle size={15} className="text-[#7C3AED] shrink-0"/>
              <span className="text-[12px] font-bold text-[#7C3AED]">{al.diagnostico5dias.length} en Diagnóstico sin nota +5 días</span>
              <span className="text-[11px] text-purple-400 ml-auto truncate max-w-[200px]">{al.diagnostico5dias.slice(0,2).map((l:any)=>l.nombre).join(", ")}</span>
            </Link>
          )}
        </div>
      )}

      {/* -- Grid 3 cols -- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 px-4 md:px-5">

        {/* Agenda de Hoy */}
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"300px"}} data-tour="agenda-hoy">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[16px] text-[#202538] tracking-tight">Agenda de Hoy</h3>
              {q.proximosSeguimientos.length > 0
                ? <span className="bg-[#EEF9F1] text-[#34A853] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">{q.proximosSeguimientos.length} prog.</span>
                : q.followUps.length > 0
                  ? <span className="bg-[#FEF2F2] text-[#DC2626] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">{q.followUps.length} fríos</span>
                  : null}
            </div>
            <Link href="/crm" className="text-[11px] font-bold text-[#4E60A9] hover:underline">Ver CRM ?</Link>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {q.proximosSeguimientos.length === 0 && q.followUps.length === 0 ? (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-[#EEF9F1] flex items-center justify-center">
                  <Calendar size={15} className="text-[#34A853]"/>
                </div>
                <p className="text-gray-400 text-[12px] font-medium text-center">Sin pendientes para hoy.<br/>Agrega fechas en el CRM.</p>
              </div>
            ) : (
              <>
                {q.proximosSeguimientos.map((l: any) => {
                  const fecha = l.fecha_proximo_contacto ? new Date(l.fecha_proximo_contacto) : null;
                  const hoy = new Date(); hoy.setHours(0,0,0,0);
                  const vencido = fecha && fecha < hoy;
                  return (
                    <Link key={`p${l.id}`} href={`/crm?expand=${l.id}`} className="flex items-center justify-between p-3 px-4 border border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${vencido ? "bg-[#FEF2F2] text-[#DC2626]" : "bg-[#EEF3FC] text-[#4E60A9]"}`}>
                          {vencido ? <AlertTriangle size={13}/> : <Calendar size={13}/>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-[#1E293B] text-[12px] tracking-tight truncate">{l.nombre}</div>
                          <div className={`text-[10px] font-bold ${vencido ? "text-[#DC2626]" : "text-[#4E60A9]"}`}>
                            {vencido ? "Vencido" : "Hoy"} · {fecha?.toLocaleDateString("es-MX",{day:"2-digit",month:"short"}) || ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {waLink(l.whatsapp || l.telefono) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.location.href = waLink(l.whatsapp || l.telefono)!; }}
                            aria-label={`Contactar a ${l.nombre} por WhatsApp`}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-500 hover:text-white transition-colors">
                            <MessageCircle size={14}/>
                          </button>
                        )}
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-[#4E60A9] transition-colors"/>
                      </div>
                    </Link>
                  );
                })}
                {q.proximosSeguimientos.length === 0 && q.followUps.map((l: any) => (
                  <Link key={`f${l.id}`} href={`/crm?expand=${l.id}`} className="flex items-center justify-between p-3 px-4 border border-gray-100 rounded-2xl hover:border-orange-200 hover:bg-orange-50/50 transition-all group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FEF2F2] text-[#DC2626] shrink-0">
                        <Clock size={13}/>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[#1E293B] text-[12px] tracking-tight truncate">{l.nombre}</div>
                        <div className="text-[10px] text-[#DC2626] font-bold">Sin contacto reciente</div>
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-gray-300 group-hover:text-[#DC2626] transition-colors shrink-0 ml-2"/>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Top Prospectos */}
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"300px"}}>
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[16px] text-[#202538] tracking-tight">Top Prospectos</h3>
              <span className="bg-[#EEF3FC] text-[#5A82ED] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase">Por Abordar</span>
            </div>
            <Link href="/crm?status=nuevo" className="text-[11px] font-bold text-[#4E60A9] hover:underline">Ver todos ?</Link>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {q.topPriorities.length === 0 ? (
              <div className="h-full min-h-[120px] flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search size={15} className="text-gray-400"/>
                </div>
                <p className="text-gray-400 text-[12px] font-medium text-center">Sin prospectos nuevos.<br/>Haz un barrido para empezar.</p>
                <Link href="/encontrar" className="text-[11px] font-bold text-[#4E60A9] bg-[#EEF3FC] px-4 py-1.5 rounded-full hover:bg-[#4E60A9] hover:text-white transition-all mt-1">Buscar leads ?</Link>
              </div>
            ) : q.topPriorities.map((l: any) => (
              <Link key={l.id} href={`/crm?expand=${l.id}`} className="flex items-center justify-between p-3 px-4 border border-gray-100 rounded-2xl hover:border-[#5A82ED]/30 hover:bg-[#F8FAFF] transition-all group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-[11px] shrink-0 ${l.score_potencial >= 7 ? "bg-[#EEF9F1] text-[#34A853]" : "bg-[#FFFBEB] text-[#D97706]"}`}>
                    {l.score_potencial || "?"}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[#1E293B] text-[12px] tracking-tight truncate">{l.nombre}</div>
                    <div className="text-gray-400 text-[10px] font-medium truncate">{l.nicho || "Sector Médico"} · {l.ciudad || ""}</div>
                  </div>
                </div>
                <ChevronRight size={13} className="text-gray-300 group-hover:text-[#5A82ED] transition-colors shrink-0 ml-2"/>
              </Link>
            ))}
          </div>
        </div>

        {/* Taller */}
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"300px"}}>
          <div className="flex justify-between items-center mb-3 shrink-0">
            <h3 className="font-bold text-[16px] text-[#202538] tracking-tight flex items-center gap-2">
              <Wrench size={14} className="text-[#7C3AED]"/> Taller
            </h3>
            <Link href="/taller" className="text-[11px] font-bold text-[#4E60A9] hover:underline">Ver taller ?</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 shrink-0">
            <div className="bg-[#EEF3FC] rounded-xl p-2.5 text-center">
              <div className="text-[18px] font-extrabold text-[#5A85F1]">{taller.metrics.activas}</div>
              <div className="text-[9px] font-bold text-[#5A85F1] uppercase tracking-wide mt-0.5">Activas</div>
            </div>
            <div className={`rounded-xl p-2.5 text-center ${taller.metrics.listas > 0 ? "bg-[#ECFDF5]" : "bg-gray-50"}`}>
              <div className={`text-[18px] font-extrabold ${taller.metrics.listas > 0 ? "text-[#059669]" : "text-gray-300"}`}>{taller.metrics.listas}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${taller.metrics.listas > 0 ? "text-[#059669]" : "text-gray-300"}`}>Listas</div>
            </div>
            <div className={`rounded-xl p-2.5 text-center ${taller.metrics.vencidas > 0 ? "bg-[#FEF2F2]" : "bg-gray-50"}`}>
              <div className={`text-[18px] font-extrabold ${taller.metrics.vencidas > 0 ? "text-[#DC2626]" : "text-gray-300"}`}>{taller.metrics.vencidas}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${taller.metrics.vencidas > 0 ? "text-[#DC2626]" : "text-gray-300"}`}>Vencidas</div>
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {taller.ordenes.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-4">
                <div className="w-9 h-9 rounded-full bg-[#F5F3FF] flex items-center justify-center">
                  <Wrench size={14} className="text-[#7C3AED]"/>
                </div>
                <p className="text-gray-400 text-[12px] font-medium text-center">Sin órdenes activas.</p>
                <Link href="/taller" className="text-[11px] font-bold text-[#7C3AED] bg-[#F5F3FF] px-3 py-1.5 rounded-full hover:bg-[#7C3AED] hover:text-white transition-all">Crear OT ?</Link>
              </div>
            ) : taller.ordenes.map((o: any) => {
              const hoy = new Date(); hoy.setHours(0,0,0,0);
              const comp = o.fecha_compromiso ? new Date(o.fecha_compromiso + "T00:00:00") : null;
              const vencida = comp && comp < hoy;
              const diasRest = comp ? Math.ceil((comp.getTime() - hoy.getTime()) / 86400000) : null;
              const urgente = diasRest !== null && diasRest <= 1 && !vencida;
              const sc = STATUS_COLORS[o.status] || STATUS_COLORS.recibido;
              return (
                <Link key={o.id} href="/taller"
                  className={`flex items-center gap-3 p-3 px-4 rounded-2xl border transition-all hover:shadow-sm ${vencida ? "border-red-200 bg-[#FEF9F9]" : urgente ? "border-orange-200 bg-[#FFFDF7]" : "border-gray-100 hover:border-gray-200"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-bold text-[12px] text-[#1E293B] truncate">{o.lead_nombre || "Sin cliente"}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{color:sc.color, backgroundColor:sc.bg}}>{sc.label}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 truncate">{o.equipo_tipo || ""}{o.equipo_marca ? ` · ${o.equipo_marca}` : ""}</span>
                      {comp && (
                        <span className={`text-[9px] font-bold flex items-center gap-0.5 shrink-0 ${vencida ? "text-[#DC2626]" : urgente ? "text-[#D97706]" : "text-gray-400"}`}>
                          {vencida && <AlertTriangle size={8}/>}
                          {comp.toLocaleDateString("es-MX",{day:"2-digit",month:"short"})}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* -- Leads Calientes -- */}
        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"260px"}}>
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h3 className="font-bold text-[16px] text-[#202538] tracking-tight flex items-center gap-2">
              <Flame size={14} className="text-[#EA580C]"/> Leads Calientes
            </h3>
            <span className="text-[10px] text-gray-400 font-medium">Últimas 48h</span>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {ng.leadsCalientes.length === 0 ? (
              <div className="min-h-[100px] flex flex-col items-center justify-center gap-2">
                <div className="w-9 h-9 rounded-full bg-[#FFF7ED] flex items-center justify-center">
                  <Flame size={14} className="text-[#EA580C]"/>
                </div>
                <p className="text-gray-400 text-[12px] font-medium text-center">Sin actividad reciente.<br/>Contacta a tus leads de hoy.</p>
              </div>
            ) : ng.leadsCalientes.map((l: any) => {
              const hace = l.fecha_ultimo_cambio ? Math.floor((Date.now() - new Date(l.fecha_ultimo_cambio).getTime()) / 3600000) : null;
              return (
                <Link key={l.id} href={`/crm?expand=${l.id}`} className="flex items-center justify-between p-3 px-4 border border-orange-100 rounded-2xl bg-[#FFFBF7] hover:border-orange-200 hover:bg-orange-50/50 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#FFF7ED] text-[#EA580C] shrink-0">
                      <Flame size={13}/>
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[#1E293B] text-[12px] tracking-tight truncate">{l.nombre}</div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{color: STATUS_COLORS[l.status_crm]?.color || "#666", backgroundColor: STATUS_COLORS[l.status_crm]?.bg || "#f0f0f0"}}>
                          {STATUS_LABEL[l.status_crm] || l.status_crm}
                        </span>
                        {hace !== null && <span className="text-[10px] text-gray-400">hace {hace < 1 ? "<1h" : `${hace}h`}</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-gray-300 group-hover:text-[#EA580C] transition-colors shrink-0 ml-2"/>
                </Link>
              );
            })}
          </div>
        </div>

        {/* -- OTs por Cobrar + Conversión Semanal (2 cols) -- */}
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">

          {/* OTs por cobrar */}
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"260px"}}>
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[16px] text-[#202538] tracking-tight flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#059669]"/> Por Cobrar
                </h3>
                {ng.totalPorCobrar > 0 && (
                  <span className="bg-[#ECFDF5] text-[#059669] px-2.5 py-0.5 rounded-full text-[10px] font-bold">{fmt(ng.totalPorCobrar)}</span>
                )}
              </div>
              <Link href="/taller" className="text-[11px] font-bold text-[#4E60A9] hover:underline">Taller ?</Link>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {ng.otsPorCobrar.length === 0 ? (
                <div className="min-h-[100px] flex flex-col items-center justify-center gap-1">
                  <div className="w-9 h-9 rounded-full bg-[#ECFDF5] flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-[#059669]"/>
                  </div>
                  <p className="text-gray-400 text-[12px] font-medium text-center mt-1">Sin OTs listas para entrega.</p>
                </div>
              ) : ng.otsPorCobrar.map((o: any) => (
                <Link key={o.id} href="/taller" className="flex items-center justify-between p-3 px-4 border border-green-100 rounded-2xl bg-[#FAFFFE] hover:border-green-200 hover:bg-green-50/30 transition-all group">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-[#1E293B] text-[12px] truncate">{o.lead_nombre || "Sin cliente"}</div>
                    <div className="text-[10px] text-gray-400 truncate">{o.equipo_tipo || ""}{o.equipo_marca ? ` · ${o.equipo_marca}` : ""}</div>
                  </div>
                  <div className="shrink-0 ml-3 text-right">
                    <div className="text-[12px] font-bold text-[#059669]">
                      {o.precio_final ? fmt(o.precio_final) : o.presupuesto ? fmt(o.presupuesto) : ""}
                    </div>
                    <div className="text-[9px] text-gray-300 font-mono">{o.folio}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Conversión semanal */}
          <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.04)] p-6 flex flex-col" style={{minHeight:"260px"}}>
            <div className="flex justify-between items-center mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[16px] text-[#202538] tracking-tight flex items-center gap-2">
                  <TrendingUp size={14} className="text-[#4E60A9]"/> Esta Semana
                </h3>
                {totalConvSemana > 0 && (
                  <span className="bg-[#EEF3FC] text-[#4E60A9] px-2.5 py-0.5 rounded-full text-[10px] font-bold">{totalConvSemana} movimientos</span>
                )}
              </div>
              <Link href="/crm" className="text-[11px] font-bold text-[#4E60A9] hover:underline">CRM ?</Link>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              {ng.conversionSemanal.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <div className="w-9 h-9 rounded-full bg-[#EEF3FC] flex items-center justify-center">
                    <TrendingUp size={14} className="text-[#4E60A9]"/>
                  </div>
                  <p className="text-gray-400 text-[12px] font-medium text-center">Sin avances esta semana.<br/>Mueve leads en el funnel.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { key:"contactado",  label:"Contactados", color:"#D97706", bg:"#FFFBEB" },
                    { key:"seguimiento", label:"Seguimiento",  color:"#EA580C", bg:"#FFF7ED" },
                    { key:"diagnostico", label:"Diagnóstico",  color:"#7C3AED", bg:"#F5F3FF" },
                    { key:"cliente",     label:"Clientes",     color:"#34A853", bg:"#EEF9F1" },
                  ].map(stage => {
                    const row = ng.conversionSemanal.find((r:any) => r.status_crm === stage.key);
                    const cnt = row?.cnt || 0;
                    const maxCnt = Math.max(...ng.conversionSemanal.map((r:any) => r.cnt), 1);
                    const pct = Math.round((cnt / maxCnt) * 100);
                    return (
                      <Link key={stage.key} href={`/crm?status=${stage.key}`} className="flex items-center gap-3 group hover:opacity-80 transition-opacity">
                        <div className="w-[80px] text-[11px] font-bold shrink-0" style={{color: cnt > 0 ? stage.color : "#CBD5E1"}}>{stage.label}</div>
                        <div className="flex-1 h-6 rounded-full overflow-hidden" style={{backgroundColor: cnt > 0 ? stage.bg : "#F8FAFC"}}>
                          <div className="h-full rounded-full transition-all duration-500" style={{width:`${pct}%`, backgroundColor: cnt > 0 ? stage.color : "#E2E8F0", opacity: cnt > 0 ? 1 : 0.3}}/>
                        </div>
                        <div className="w-6 text-right text-[12px] font-extrabold shrink-0" style={{color: cnt > 0 ? stage.color : "#CBD5E1"}}>{cnt}</div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
