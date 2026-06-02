"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Home, Search, Database, Wrench, FileText, Play,
  Settings, ChevronLeft, ChevronRight, Layers, Users, MessageCircle, Map, FolderOpen, Mail, LogOut, UserCog, CalendarDays, ClipboardList,
} from "lucide-react";

function Section({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-[#E2E8F4] mx-2.5 my-2" />;
  return (
    <div className="px-3.5 pt-3 pb-1">
      <span className="text-[11px] font-extrabold tracking-[0.1em] text-[#94A3B8] uppercase">{label}</span>
    </div>
  );
}

function NavItem({
  href, icon: Icon, label, active, collapsed, badge, color = "#4E60A9", onClick, tourId,
}: {
  href?: string; icon: any; label: string; active: boolean; collapsed: boolean;
  badge?: number; color?: string; onClick?: () => void; tourId?: string;
}) {
  const [hov, setHov] = useState(false);
  const bg = active ? `${color}18` : hov ? "#F1F5F9" : "transparent";
  const iconColor = active ? color : hov ? "#475569" : "#94A3B8";

  const inner = (
    <>
      <Icon size={17} strokeWidth={active ? 2.5 : 2} style={{ color: iconColor, flexShrink: 0 }} />
      {!collapsed && (
        <span className="flex-1 text-left text-[13px] leading-none tracking-[-0.01em]"
          style={{ fontWeight: active ? 700 : 500, color: active ? color : hov ? "#475569" : "#64748B" }}>
          {label}
        </span>
      )}
      {!collapsed && active && (
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      )}
      {badge != null && badge > 0 && (
        <span
          className="absolute min-w-[16px] h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#F4F7FB] px-0.5"
          style={{
            top: collapsed ? -3 : 6,
            right: collapsed ? -3 : 8
          }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </>
  );

  const cls = `relative flex items-center rounded-xl border-none cursor-pointer transition-all duration-[120ms] ${
    collapsed ? "w-10 h-10 justify-center mx-auto" : "w-full gap-2.5 px-3 py-2.5"
  }`;

  if (onClick) {
    return (
      <button onClick={onClick} title={collapsed ? label : undefined}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        className={cls} style={{ background: bg, fontFamily: "inherit" }}
        data-tour={tourId} suppressHydrationWarning>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href!} title={collapsed ? label : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={cls} style={{ background: bg }} data-tour={tourId}>
      {inner}
    </Link>
  );
}

export default function SidebarNav() {
  const path = usePathname();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [crmBadge, setCrmBadge] = useState(0);
  const [tallerBadge, setTallerBadge] = useState(0);
  const [agenda, setAgenda] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);
    } catch {}
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = () => setCollapsed(p => {
    try { localStorage.setItem("sidebar-collapsed", String(!p)); } catch {}
    return !p;
  });

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => {
        const proximos = d.queues?.proximosSeguimientos?.length || 0;
        const frios    = d.queues?.followUps?.length || 0;
        setCrmBadge(proximos + frios);
      }).catch(() => {});
    fetch("/api/ordenes")
      .then(r => r.json())
      .then(d => {
        const listas = (d.ordenes || []).filter((o: any) => o.status === "listo").length;
        setTallerBadge(listas);
      }).catch(() => {});
    fetch("/api/agenda?days=14")
      .then(r => r.json())
      .then(d => setAgenda(d.agenda || []))
      .catch(() => {});
  }, []);

  const is = (href: string) => href === "/" ? path === "/" : path.startsWith(href);

  // Evita hydration mismatch usando el valor del servidor (no colapsado)
  const w = mounted ? (collapsed ? 68 : 240) : 240;

  return (
    <>
      <aside
        data-tour="sidebar-nav"
        className="relative hidden md:flex shrink-0 flex-col h-screen bg-white border-r border-[#E8EFF8] px-2"
        style={{ width: w, transition: mounted && !reducedMotion ? "width .22s cubic-bezier(.4,0,.2,1)" : "none" }}>

        {/* Header con Logo */}
        <div className={`flex items-center pt-5 pb-4 px-1 min-w-0 relative ${collapsed ? "justify-center" : ""}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/ISOTIPO.png" alt="Bionordi" className="w-8 h-8 shrink-0 object-contain" />
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold text-[#1E293B] tracking-[-0.03em] leading-none">Bionordi</div>
                <div className="text-[9px] text-[#94A3B8] font-semibold tracking-[0.05em] mt-0.5">PLATAFORMA OPS</div>
              </div>
            )}
          </div>
          
          {/* Botón flotante para colapsar/expandir */}
          <button onClick={toggle} suppressHydrationWarning
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-expanded={!collapsed}
            className="absolute -right-5 top-[26px] w-6 h-6 rounded-full border border-[#E2E8F4] bg-white flex items-center justify-center text-[#94A3B8] hover:text-[#475569] shadow-sm hover:shadow transition-all cursor-pointer z-50">
            {collapsed
              ? <ChevronRight size={10} strokeWidth={3} />
              : <ChevronLeft  size={10} strokeWidth={3} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className={`flex-1 flex flex-col ${collapsed ? "gap-2" : "gap-0.5"} overflow-y-auto overflow-x-hidden pb-2`}>
          <NavItem href="/"           icon={Home}     label="Inicio"      active={is("/")}             collapsed={collapsed} />
          <Section label="Ventas"    collapsed={collapsed} />
          <NavItem href="/encontrar"  icon={Search}   label="Encontrar"   active={is("/encontrar")}    collapsed={collapsed} color="#4E60A9" />
          <NavItem href={crmBadge > 0 ? "/crm?status=seguimiento" : "/crm"} icon={Database} label="CRM" active={is("/crm")} collapsed={collapsed} color="#4E60A9" badge={crmBadge} tourId="nav-crm" />
          <NavItem href="/barridos"   icon={FolderOpen} label="Barridos"   active={is("/barridos")}     collapsed={collapsed} color="#4E60A9" />
          <NavItem href="/clientes"   icon={Users}      label="Clientes"   active={is("/clientes")}     collapsed={collapsed} color="#4E60A9" tourId="nav-clientes" />
          <NavItem href="/agenda"     icon={CalendarDays} label="Agenda"    active={is("/agenda")}       collapsed={collapsed} color="#0EA5E9" badge={(() => { const hoy = new Date().toISOString().slice(0, 10); return agenda.filter(e => e.fecha_proximo_contacto?.slice(0,10) <= hoy).length || undefined; })()} />
          <NavItem href="/chat"       icon={MessageCircle} label="WhatsApp"   active={is("/chat")}         collapsed={collapsed} color="#25D366" />
          <NavItem href="/correo"     icon={Mail}          label="Correo"   active={is("/correo")}      collapsed={collapsed} color="#0EA5E9" />
          <Section label="Taller"    collapsed={collapsed} />
          <NavItem href="/taller"     icon={Wrench}   label="Servicios"     active={is("/taller")}       collapsed={collapsed} color="#7C3AED" badge={tallerBadge} tourId="nav-taller" />
          <Section label="Herramientas" collapsed={collapsed} />
          <NavItem href="/cotizar"       icon={FileText} label="Cotizar"       active={is("/cotizar")}       collapsed={collapsed} color="#059669" />
          <NavItem href="/cotizaciones"  icon={ClipboardList} label="Cotizaciones" active={is("/cotizaciones")} collapsed={collapsed} color="#059669" />
          <NavItem href="/catalogo"      icon={Layers}   label="Catálogo"      active={is("/catalogo")}      collapsed={collapsed} color="#059669" />
          <NavItem href="/maps"       icon={Map}      label="Mapa leads"  active={is("/maps")}         collapsed={collapsed} color="#0E7490" />
          <NavItem href="/configuracion" icon={Settings} label="Config"   active={is("/configuracion")} collapsed={collapsed} />
          <NavItem href="/?runTour=true" icon={Play} label="Tutorial" active={false} collapsed={collapsed} color="#4E60A9" />
          {isAdmin && (
            <NavItem href="/usuarios" icon={UserCog} label="Usuarios" active={is("/usuarios")} collapsed={collapsed} />
          )}

          {/* Próximos seguimientos */}
          {!collapsed && agenda.length > 0 && (
            <div className="mt-3 mx-1 mb-1">
              <div className="px-2.5 pt-1 pb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-extrabold tracking-[0.08em] text-[#94A3B8] uppercase">Próximos</span>
                <Link href="/agenda" className="text-[11px] font-bold text-[#4E60A9] hover:underline">Ver todo</Link>
              </div>
              <div className="rounded-xl border border-[#E8EFF8] bg-[#F8FAFC] overflow-hidden divide-y divide-[#E8EFF8]">
                {agenda.slice(0, 4).map((ev, i) => {
                  const fecha   = new Date(ev.fecha_proximo_contacto + "T00:00:00");
                  const hoy     = new Date(); hoy.setHours(0, 0, 0, 0);
                  const esHoy   = fecha.toDateString() === hoy.toDateString();
                  const vencido = fecha < hoy;
                  return (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${vencido ? "bg-red-400" : esHoy ? "bg-[#4E60A9]" : "bg-[#94A3B8]"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-bold text-[#334155] truncate">{ev.lead_nombre}</div>
                        <div className={`text-[11px] font-semibold ${vencido ? "text-red-400" : esHoy ? "text-[#4E60A9]" : "text-[#94A3B8]"}`}>
                          {esHoy ? "Hoy" : vencido ? "Vencido" : fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {agenda.length > 4 && (
                  <Link href="/agenda" className="block px-2.5 py-1.5 text-center text-[11px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] transition-colors">
                    +{agenda.length - 4} más
                  </Link>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Avatar + Logout */}
        <div className={`border-t border-[#E8EFF8] px-1 flex items-center shrink-0 ${collapsed ? "justify-center flex-col gap-3 py-4" : "justify-between py-3 gap-2"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4E60A9] to-[#38AD64] flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 border-2 border-white shadow-sm">
              {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-[12px] font-bold text-[#1E293B] tracking-[-0.01em] truncate">{session?.user?.name ?? "Usuario"}</div>
                <div className="text-[10px] text-[#94A3B8] capitalize">{(session?.user as any)?.role ?? "operador"}</div>
              </div>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            aria-label="Cerrar sesión"
            suppressHydrationWarning
            className={`rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-50 transition-colors cursor-pointer shrink-0 ${
              collapsed ? "w-10 h-10 mx-auto" : "min-w-[44px] min-h-[44px]"
            }`}>
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-[#E8EFF8] flex justify-around items-center px-2 z-[60] shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] pb-safe">
        <Link href="/agenda" className={`relative flex flex-col items-center justify-center w-full h-full gap-1 ${is("/agenda") ? "text-[#0284C7]" : "text-[#94A3B8]"}`}>
          <CalendarDays size={22} strokeWidth={is("/agenda") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Agenda</span>
          {(() => { const hoy = new Date().toISOString().slice(0, 10); const badge = agenda.filter(e => e.fecha_proximo_contacto?.slice(0,10) <= hoy).length; return badge > 0 ? <span className="absolute top-1 right-1.5 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">{badge > 9 ? "9+" : badge}</span> : null; })()}
        </Link>
        <Link href="/cotizar" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${is("/cotizar") ? "text-[#059669]" : "text-[#94A3B8]"}`}>
          <FileText size={22} strokeWidth={is("/cotizar") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Cotizar</span>
        </Link>
        <Link href="/taller" data-tour="nav-taller" className={`relative flex flex-col items-center justify-center w-full h-full gap-1 ${is("/taller") ? "text-[#7C3AED]" : "text-[#94A3B8]"}`}>
          <Wrench size={22} strokeWidth={is("/taller") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Servicios</span>
          {tallerBadge > 0 && <span className="absolute top-1 right-1.5 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">{tallerBadge > 9 ? "9+" : tallerBadge}</span>}
        </Link>
        <Link href="/chat" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${is("/chat") ? "text-[#25D366]" : "text-[#94A3B8]"}`}>
          <MessageCircle size={22} strokeWidth={is("/chat") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Chat</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(true)} className="flex flex-col items-center justify-center w-full h-full gap-1 text-[#94A3B8] hover:text-[#475569]">
          <Layers size={22} strokeWidth={2} />
          <span className="text-[10px] font-bold">Más</span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute bottom-[70px] left-0 right-0 bg-white rounded-t-[32px] overflow-hidden flex flex-col max-h-[85vh] motion-safe:animate-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-300 motion-safe:ease-out shadow-[0_-10px_40px_rgba(0,0,0,0.1)]" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2" />
            <div className="px-6 py-2">
              <h2 className="font-extrabold text-[#1E293B] text-[20px] tracking-tight">Menú Principal</h2>
              <p className="text-[12px] font-medium text-[#64748B]">Todas las herramientas de Bionordi</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6">
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Link onClick={() => setMobileMenuOpen(false)} href="/" className="bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Home size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Inicio</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href={crmBadge > 0 ? "/crm?status=seguimiento" : "/crm"} className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl p-4 flex flex-col gap-2.5 relative transition-all active:scale-[0.98]">
                  <Database size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">CRM</span>
                  {crmBadge > 0 && <span className="absolute top-3 right-3 w-[22px] h-[22px] rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center border-2 border-indigo-50 shadow-sm">{crmBadge > 9 ? "9+" : crmBadge}</span>}
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/agenda" className="bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-2xl p-4 flex flex-col gap-2.5 relative transition-all active:scale-[0.98]">
                  <CalendarDays size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Agenda</span>
                  {(() => { const hoy = new Date().toISOString().slice(0, 10); const badge = agenda.filter(e => e.fecha_proximo_contacto?.slice(0,10) <= hoy).length; return badge > 0 ? <span className="absolute top-3 right-3 w-[22px] h-[22px] rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center border-2 border-sky-50 shadow-sm">{badge > 9 ? "9+" : badge}</span> : null; })()}
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/clientes" className="bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Users size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Clientes</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/encontrar" className="bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Search size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Encontrar</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/barridos" className="bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <FolderOpen size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Barridos</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/correo" className="bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Mail size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Correo</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/catalogo" className="bg-teal-50 text-teal-600 hover:bg-teal-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Layers size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Catálogo</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/cotizar" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <FileText size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Cotizar</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/cotizaciones" className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <ClipboardList size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Cotizaciones</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/maps" className="bg-cyan-50 text-cyan-600 hover:bg-cyan-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Map size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Mapa leads</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/configuracion" className="bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Settings size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Configuración</span>
                </Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/?runTour=true" className="bg-[#EEF3FC] text-[#4E60A9] hover:bg-[#4E60A9] hover:text-white rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]">
                  <Play size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Tutorial</span>
                </Link>
                {isAdmin && <Link onClick={() => setMobileMenuOpen(false)} href="/usuarios" className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl p-4 flex flex-col gap-2.5 transition-all active:scale-[0.98]"><UserCog size={24} strokeWidth={2.5} /><span className="font-bold text-[13px]">Usuarios</span></Link>}
              </div>
              
              <div className="mt-6 border-t border-[#E8EFF8] pt-5 flex items-center justify-between px-1">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#4E60A9] to-[#38AD64] flex items-center justify-center text-white text-[14px] font-extrabold shadow-md border-2 border-white ring-2 ring-gray-50">
                    {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <div className="text-[15px] font-extrabold text-[#1E293B] tracking-tight">{session?.user?.name ?? "Usuario"}</div>
                    <div className="text-[12px] font-semibold text-[#94A3B8] capitalize">{(session?.user as any)?.role ?? "operador"}</div>
                  </div>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-[#EF4444] bg-[#FEF2F2] p-3 rounded-2xl hover:bg-[#FEE2E2] transition-colors active:scale-[0.95]">
                  <LogOut size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
