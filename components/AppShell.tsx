"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import SidebarNav from "@/components/SidebarNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/login";

  if (isAuth) {
    return (
      <SessionProvider>
        <div className="flex-1 w-full h-full overflow-auto">
          {children}
        </div>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider>
      <SidebarNav />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </main>
    </SessionProvider>
  );
}
