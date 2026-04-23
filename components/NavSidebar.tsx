"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Send, Map, Users, Settings } from "lucide-react";

const NAV = [
  { href: "/",            label: "Dashboard",  icon: LayoutDashboard },
  { href: "/encontrar",   label: "Encontrar",  icon: Search          },
  { href: "/envio",       label: "Envío",      icon: Send            },
  { href: "/maps",        label: "Mapa",       icon: Map             },
  { href: "/crm",         label: "CRM",        icon: Users           },
];

export default function NavSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 flex flex-col bg-white border-r border-[#E5E9F2]">

      {/* Brand */}
      <div className="px-5 py-5 border-b border-[#E5E9F2]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">B</span>
          </div>
          <div>
            <div className="text-sm font-bold text-[#0F172A] leading-tight">Bionordi</div>
            <div className="text-[10px] text-[#94A3B8] leading-tight">Leads System</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="px-2 mb-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Módulos
        </div>
        {NAV.map(item => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        <div className="px-2 pt-4 mb-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
          Sistema
        </div>
        <NavItem href="/configuracion" label="Configuración" icon={Settings} active={pathname === "/configuracion"} />
      </nav>

      {/* Footer */}
      <div className="border-t border-[#E5E9F2] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" />
          <span className="text-xs text-[#64748B]">Sistema activo</span>
        </div>
        <div className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">Claude Sonnet 4</div>
      </div>
    </aside>
  );
}

function NavItem({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: any; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-100
        ${active
          ? "bg-[#EEF2FF] text-[#4F46E5]"
          : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        }
      `}
    >
      <Icon size={16} className={active ? "text-[#4F46E5]" : "text-[#94A3B8]"} />
      {label}
    </Link>
  );
}
