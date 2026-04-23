"use client";

import dynamic from "next/dynamic";

const MapsViewInner = dynamic(() => import("./MapsViewInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface text-foreground/40 font-mono text-sm">
      Cargando mapa…
    </div>
  ),
});

export default MapsViewInner;
