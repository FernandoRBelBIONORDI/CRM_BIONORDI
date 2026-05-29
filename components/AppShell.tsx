"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import SidebarNav from "@/components/SidebarNav";
import OnboardingTour from "@/components/OnboardingTour";

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
      <main className="flex-1 flex flex-col overflow-hidden relative md:pb-0">
        <Suspense fallback={null}><OnboardingTour /></Suspense>
        {children}
      </main>
    </SessionProvider>
  );
}
