"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import {
  Home, Search, Database, Wrench, FileText,
  Settings, ChevronLeft, ChevronRight, Layers, Users, MessageCircle, Map, FolderOpen, Mail, LogOut, UserCog, CalendarDays,
} from "lucide-react";

function Section({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-[#E2E8F4] mx-2.5 my-2" />;
  return (
    <div className="px-3.5 pt-3 pb-1">
      <span className="text-[9px] font-extrabold tracking-[0.12em] text-[#CBD5E1] uppercase">{label}</span>
    </div>
  );
}

function NavItem({
  href, icon: Icon, label, active, collapsed, badge, color = "#4E60A9", onClick,
}: {
  href?: string; icon: any; label: string; active: boolean; collapsed: boolean;
  badge?: number; color?: string; onClick?: () => void;
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
          className="absolute top-1.5 min-w-[16px] h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#F4F7FB] px-0.5"
          style={{ right: collapsed ? 4 : 8 }}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </>
  );

  const cls = `relative flex items-center w-full rounded-xl border-none cursor-pointer transition-all duration-[120ms] ${
    collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2.5"
  }`;

  if (onClick) {
    return (
      <button onClick={onClick} title={collapsed ? label : undefined}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        className={cls} style={{ background: bg, fontFamily: "inherit" }} suppressHydrationWarning>
        {inner}
      </button>
    );
  }
  return (
    <Link href={href!} title={collapsed ? label : undefined}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className={cls} style={{ background: bg }}>
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [crmBadge, setCrmBadge] = useState(0);
  const [tallerBadge, setTallerBadge] = useState(0);
  const [agenda, setAgenda] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem("sidebar-collapsed") === "true") setCollapsed(true);
    } catch {}
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
        className="hidden md:flex shrink-0 flex-col h-screen bg-white border-r border-[#E8EFF8] px-2 overflow-hidden"
        style={{ width: w, transition: mounted ? "width .22s cubic-bezier(.4,0,.2,1)" : "none" }}>

        {/* Logo + botón colapsar */}
        <div className={`flex items-center pt-5 pb-4 px-1 gap-2 ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/ISOTIPO.png" alt="Bionordi" className="w-8 h-8 shrink-0 object-contain" />
              <div className="min-w-0">
                <div className="text-[14px] font-extrabold text-[#1E293B] tracking-[-0.03em] leading-none">Bionordi</div>
                <div className="text-[9px] text-[#94A3B8] font-semibold tracking-[0.05em] mt-0.5">PLATAFORMA OPS</div>
              </div>
            </div>
          )}
          {collapsed && (
            <img src="/ISOTIPO.png" alt="Bionordi" className="w-8 h-8 shrink-0 object-contain" />
          )}
          <button onClick={toggle} suppressHydrationWarning
            className="w-6 h-6 rounded-md border border-[#E2E8F4] bg-[#F8FAFC] flex items-center justify-center text-[#94A3B8] hover:text-[#475569] transition-colors cursor-pointer shrink-0">
            {collapsed
              ? <ChevronRight size={12} strokeWidth={2.5} />
              : <ChevronLeft  size={12} strokeWidth={2.5} />}
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden pb-2">
          <NavItem href="/"           icon={Home}     label="Inicio"      active={is("/")}             collapsed={collapsed} />
          <Section label="Ventas"    collapsed={collapsed} />
          <NavItem href="/encontrar"  icon={Search}   label="Encontrar"   active={is("/encontrar")}    collapsed={collapsed} color="#4E60A9" />
          <NavItem href={crmBadge > 0 ? "/crm?status=seguimiento" : "/crm"} icon={Database} label="CRM" active={is("/crm")} collapsed={collapsed} color="#4E60A9" badge={crmBadge} />
          <NavItem href="/barridos"   icon={FolderOpen} label="Barridos"   active={is("/barridos")}     collapsed={collapsed} color="#4E60A9" />
          <NavItem href="/clientes"   icon={Users}      label="Clientes"   active={is("/clientes")}     collapsed={collapsed} color="#4E60A9" />
          <NavItem href="/agenda"     icon={CalendarDays} label="Agenda"    active={is("/agenda")}       collapsed={collapsed} color="#0EA5E9" badge={(() => { const hoy = new Date().toISOString().slice(0, 10); return agenda.filter(e => e.fecha_proximo_contacto?.slice(0,10) <= hoy).length || undefined; })()} />
          <NavItem href="/chat"       icon={MessageCircle} label="WhatsApp"   active={is("/chat")}         collapsed={collapsed} color="#25D366" />
          <NavItem href="/correo"     icon={Mail}          label="Correo"   active={is("/correo")}      collapsed={collapsed} color="#0EA5E9" />
          <Section label="Taller"    collapsed={collapsed} />
          <NavItem href="/taller"     icon={Wrench}   label="Servicios"     active={is("/taller")}       collapsed={collapsed} color="#7C3AED" badge={tallerBadge} />
          <Section label="Herramientas" collapsed={collapsed} />
          <NavItem href="/cotizar"    icon={FileText} label="Cotizar"      active={is("/cotizar")}      collapsed={collapsed} color="#059669" />
          <NavItem href="/catalogo"   icon={Layers}   label="Catálogo"    active={is("/catalogo")}     collapsed={collapsed} color="#059669" />
          <NavItem href="/maps"       icon={Map}      label="Mapa leads"  active={is("/maps")}         collapsed={collapsed} color="#0E7490" />
          <NavItem href="/configuracion" icon={Settings} label="Config"   active={is("/configuracion")} collapsed={collapsed} />
          {isAdmin && (
            <NavItem href="/usuarios" icon={UserCog} label="Usuarios" active={is("/usuarios")} collapsed={collapsed} />
          )}

          {/* Próximos seguimientos */}
          {!collapsed && agenda.length > 0 && (
            <div className="mt-3 mx-1 mb-1">
              <div className="px-2.5 pt-1 pb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-extrabold tracking-[0.12em] text-[#CBD5E1] uppercase">Próximos</span>
                <Link href="/agenda" className="text-[9px] font-bold text-[#4E60A9] hover:underline">Ver todo</Link>
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
                        <div className="text-[10px] font-bold text-[#334155] truncate">{ev.lead_nombre}</div>
                        <div className={`text-[9px] font-semibold ${vencido ? "text-red-400" : esHoy ? "text-[#4E60A9]" : "text-[#94A3B8]"}`}>
                          {esHoy ? "Hoy" : vencido ? "Vencido" : fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {agenda.length > 4 && (
                  <Link href="/agenda" className="block px-2.5 py-1.5 text-center text-[9px] font-bold text-[#4E60A9] hover:bg-[#EEF3FC] transition-colors">
                    +{agenda.length - 4} más
                  </Link>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Avatar + Logout */}
        <div className={`border-t border-[#E8EFF8] py-3 px-1 flex items-center gap-2 shrink-0 ${collapsed ? "justify-center flex-col" : "justify-between"}`}>
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
            title="Cerrar sesión"
            suppressHydrationWarning
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#EF4444] hover:bg-red-50 transition-colors cursor-pointer shrink-0">
            <LogOut size={14} strokeWidth={2} />
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-white border-t border-[#E8EFF8] flex justify-around items-center px-2 z-[60] shadow-[0_-4px_15px_-5px_rgba(0,0,0,0.05)] pb-safe">
        <Link href="/" className={`flex flex-col items-center justify-center w-full h-full gap-1 ${is("/") ? "text-[#4E60A9]" : "text-[#94A3B8]"}`}>
          <Home size={22} strokeWidth={is("/") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">Inicio</span>
        </Link>
        <Link href={crmBadge > 0 ? "/crm?status=seguimiento" : "/crm"} className={`relative flex flex-col items-center justify-center w-full h-full gap-1 ${is("/crm") ? "text-[#4E60A9]" : "text-[#94A3B8]"}`}>
          <Database size={22} strokeWidth={is("/crm") ? 2.5 : 2} />
          <span className="text-[10px] font-bold">CRM</span>
          {crmBadge > 0 && <span className="absolute top-1 right-2 w-4 h-4 rounded-full bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">{crmBadge > 9 ? "9+" : crmBadge}</span>}
        </Link>
        <Link href="/taller" className={`relative flex flex-col items-center justify-center w-full h-full gap-1 ${is("/taller") ? "text-[#7C3AED]" : "text-[#94A3B8]"}`}>
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
        <div className="md:hidden fixed inset-0 z-[65] bg-black/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute bottom-[70px] left-0 right-0 bg-white rounded-t-3xl overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-2" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3" />
            <div className="px-5 py-2 font-extrabold text-[#1E293B] text-[18px]">Menú Principal</div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <Link onClick={() => setMobileMenuOpen(false)} href="/encontrar" className="bg-[#EEF3FC] text-[#4E60A9] rounded-2xl p-4 flex flex-col gap-2"><Search size={22} /><span className="font-bold text-[13px]">Encontrar</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/barridos" className="bg-[#EEF3FC] text-[#4E60A9] rounded-2xl p-4 flex flex-col gap-2"><FolderOpen size={22} /><span className="font-bold text-[13px]">Barridos</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/clientes" className="bg-[#EEF3FC] text-[#4E60A9] rounded-2xl p-4 flex flex-col gap-2"><Users size={22} /><span className="font-bold text-[13px]">Clientes</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/agenda" className="bg-sky-50 text-sky-600 rounded-2xl p-4 flex flex-col gap-2"><CalendarDays size={22} /><span className="font-bold text-[13px]">Agenda</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/correo" className="bg-sky-50 text-sky-600 rounded-2xl p-4 flex flex-col gap-2"><Mail size={22} /><span className="font-bold text-[13px]">Correo</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/cotizar" className="bg-emerald-50 text-emerald-600 rounded-2xl p-4 flex flex-col gap-2"><FileText size={22} /><span className="font-bold text-[13px]">Cotizar</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/catalogo" className="bg-emerald-50 text-emerald-600 rounded-2xl p-4 flex flex-col gap-2"><Layers size={22} /><span className="font-bold text-[13px]">Catálogo</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/maps" className="bg-cyan-50 text-cyan-600 rounded-2xl p-4 flex flex-col gap-2"><Map size={22} /><span className="font-bold text-[13px]">Mapa leads</span></Link>
                <Link onClick={() => setMobileMenuOpen(false)} href="/configuracion" className="bg-gray-50 text-gray-600 rounded-2xl p-4 flex flex-col gap-2"><Settings size={22} /><span className="font-bold text-[13px]">Configuración</span></Link>
                {isAdmin && <Link onClick={() => setMobileMenuOpen(false)} href="/usuarios" className="bg-gray-50 text-gray-600 rounded-2xl p-4 flex flex-col gap-2"><UserCog size={22} /><span className="font-bold text-[13px]">Usuarios</span></Link>}
              </div>
              
              <div className="mt-6 border-t border-gray-100 pt-4 flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4E60A9] to-[#38AD64] flex items-center justify-center text-white text-[13px] font-extrabold shadow-sm">
                    {session?.user?.name?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-[#1E293B]">{session?.user?.name ?? "Usuario"}</div>
                    <div className="text-[11px] font-medium text-gray-400 capitalize">{(session?.user as any)?.role ?? "operador"}</div>
                  </div>
                </div>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="text-red-500 bg-red-50 p-2.5 rounded-xl hover:bg-red-100 transition-colors"><LogOut size={18} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
