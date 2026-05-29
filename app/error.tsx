'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-10 flex flex-col items-center gap-5 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-[#FEF2F2] flex items-center justify-center">
          <AlertTriangle size={26} className="text-[#DC2626]" />
        </div>
        <div>
          <h2 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight mb-1">
            Algo salió mal
          </h2>
          <p className="text-[13px] text-[#94A3B8]">
            Ocurrió un error inesperado. Podés intentar de nuevo o recargar la página.
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4E60A9] text-white text-[13px] font-bold rounded-[12px] hover:bg-[#3d4f8f] transition-colors"
        >
          <RefreshCw size={14} />
          Intentar de nuevo
        </button>
        {error.digest && (
          <p className="text-[10px] text-[#CBD5E1] font-mono">ref: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
