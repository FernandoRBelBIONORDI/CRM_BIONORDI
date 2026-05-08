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
        className="shrink-0 flex flex-col h-screen bg-white border-r border-[#E8EFF8] px-2 overflow-hidden"
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
          <NavItem href="/taller"     icon={Wrench}   label="Órdenes"     active={is("/taller")}       collapsed={collapsed} color="#7C3AED" badge={tallerBadge} />
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

    </>
  );
}
