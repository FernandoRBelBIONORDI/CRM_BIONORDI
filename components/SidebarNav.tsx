"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Search, Send, MapIcon, Database, Activity, Settings, Wrench, ClipboardList } from "lucide-react";
import CotizacionManualModal from "./CotizacionManualModal";

const NAV = [
  { href: "/",          icon: Home,     title: "Inicio"      },
  { href: "/encontrar", icon: Search,   title: "Encontrar"   },
  { href: "/envio",     icon: Send,     title: "Prospección" },
  { href: "/crm",       icon: Database, title: "CRM"         },
  { href: "/taller",    icon: Wrench,   title: "Taller"      },
];

export default function SidebarNav() {
  const path = usePathname();
  const [alerts, setAlerts] = useState(0);
  const [tallerAlerts, setTallerAlerts] = useState(0);
  const [showCotizacion, setShowCotizacion] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then(d => {
        const proximos = d.queues?.proximosSeguimientos?.length || 0;
        const frios    = d.queues?.followUps?.length || 0;
        setAlerts(proximos + frios);
      })
      .catch(() => {});
    fetch("/api/ordenes")
      .then(r => r.json())
      .then(d => {
        const listas = (d.ordenes || []).filter((o: any) => o.status === "listo").length;
        setTallerAlerts(listas);
      })
      .catch(() => {});
  }, []);

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <>
    <aside className="w-[100px] shrink-0 flex flex-col items-center py-8 gap-10 border-none bg-transparent">
      {/* Logo */}
      <div className="font-bold text-[14px] flex flex-col items-center gap-1.5 text-[#2B355A]">
        <div className="w-[30px] h-[30px] bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
          <Activity size={18} strokeWidth={2.5}/>
        </div>
        Bionordi
      </div>

      <nav className="flex-1 flex flex-col items-center gap-3 mt-2 w-full px-3">
        {NAV.map(({ href, icon: Icon, title }) => {
          const active = isActive(href);
          const showBadge = (href === "/crm" && alerts > 0) || (href === "/taller" && tallerAlerts > 0);
          const badgeCount = href === "/taller" ? tallerAlerts : alerts;
          return (
            <Link key={href} href={href} title={title}
              className={`relative w-full h-[48px] flex flex-col items-center justify-center rounded-[18px] transition-all gap-0.5
                ${active
                  ? "bg-white shadow-[0_4px_14px_-3px_rgba(66,125,250,0.15)] text-[#427DFA]"
                  : "text-gray-400 hover:text-[#202538] hover:bg-white/60 hover:-translate-y-0.5"
                }`}>
              <Icon size={19} strokeWidth={active ? 2.5 : 2}/>
              <span className={`text-[9px] font-bold tracking-tight leading-none ${active ? "text-[#427DFA]" : "text-gray-400"}`}>
                {title}
              </span>
              {showBadge && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#EF4444] text-white text-[9px] font-bold flex items-center justify-center rounded-full border-2 border-[#EDF0F7]">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Cotización rápida */}
      <button onClick={() => setShowCotizacion(true)} title="Nueva Cotización"
        className="w-full h-[48px] flex flex-col items-center justify-center rounded-[18px] transition-all gap-0.5 text-gray-400 hover:text-[#427DFA] hover:bg-white/60 hover:-translate-y-0.5">
        <ClipboardList size={19} strokeWidth={2}/>
        <span className="text-[9px] font-bold tracking-tight leading-none text-gray-400">Cotizar</span>
      </button>

      {/* Bottom: Settings + Avatar */}
      <div className="flex flex-col items-center gap-3">
        <Link href="/configuracion" title="Configuración"
          className={`relative w-full h-[48px] flex flex-col items-center justify-center rounded-[18px] transition-all gap-0.5
            ${isActive("/configuracion")
              ? "bg-white shadow-[0_4px_14px_-3px_rgba(66,125,250,0.15)] text-[#427DFA]"
              : "text-gray-400 hover:text-[#202538] hover:bg-white/60"
            }`}>
          <Settings size={19} strokeWidth={isActive("/configuracion") ? 2.5 : 2}/>
          <span className={`text-[9px] font-bold tracking-tight leading-none ${isActive("/configuracion") ? "text-[#427DFA]" : "text-gray-400"}`}>
            Config
          </span>
        </Link>
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#3b82f6] to-[#60a5fa] flex items-center justify-center text-white text-[12px] font-bold shadow-sm border-2 border-white/50">
          FB
        </div>
      </div>
    </aside>

    {showCotizacion && <CotizacionManualModal onClose={() => setShowCotizacion(false)}/>}
    </>
  );
}
