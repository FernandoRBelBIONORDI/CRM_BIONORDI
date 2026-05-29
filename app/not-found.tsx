import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="h-full flex items-center justify-center p-6">
      <div className="bg-white rounded-[24px] shadow-[0_8px_30px_-6px_rgba(0,0,0,0.06)] p-10 flex flex-col items-center gap-5 max-w-sm w-full text-center">
        <div className="w-14 h-14 rounded-full bg-[#EEF3FC] flex items-center justify-center">
          <SearchX size={26} className="text-[#4E60A9]" />
        </div>
        <div>
          <h2 className="text-[18px] font-extrabold text-[#1E293B] tracking-tight mb-1">
            Página no encontrada
          </h2>
          <p className="text-[13px] text-[#94A3B8]">
            La página que buscás no existe o fue movida.
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-[#4E60A9] text-white text-[13px] font-bold rounded-[12px] hover:bg-[#3d4f8f] transition-colors"
        >
          <Home size={14} />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
