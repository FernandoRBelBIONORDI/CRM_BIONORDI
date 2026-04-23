"use client";

import dynamic from "next/dynamic";

const MapaMexicoInner = dynamic(() => import("./MapaMexicoInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface text-foreground/40 font-mono text-sm">
      Cargando mapa…
    </div>
  ),
});

export default MapaMexicoInner;
