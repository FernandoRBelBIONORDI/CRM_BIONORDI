"use client";

import React, { useState, useRef } from "react";
import { X, Download, Printer, Loader2, FileText } from "lucide-react";

interface DocumentViewerModalProps {
  title: string;
  url?: string;
  html?: string;
  onClose: () => void;
  downloadName?: string;
  hidePrint?: boolean;
  hideDownload?: boolean;
  editAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function DocumentViewerModal({
  title,
  url,
  html,
  onClose,
  downloadName,
  hidePrint = false,
  hideDownload = false,
  editAction,
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } catch (err) {
        console.error("No se pudo gatillar la impresión en el iframe:", err);
        // Fallback en caso de error de cross-origin (no aplicable aquí por ser same-origin)
        window.print();
      }
    }
  };

  // Convertir HTML a un object URL si es necesario para evitar límites de srcdoc, o usar srcdoc directamente
  const hasContent = !!(url || html);

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-md transition-all duration-300" 
        onClick={onClose} 
      />

      {/* Main Container */}
      <div className="relative w-full max-w-5xl h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" data-tour="doc-viewer-modal">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <FileText size={15} />
            </div>
            <div>
              <span className="text-[14px] sm:text-[15px] font-extrabold text-slate-100 tracking-wide">
                {title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {editAction && (
              <button 
                onClick={editAction.onClick}
                className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl transition-all border border-slate-700 shadow-sm"
              >
                {editAction.label}
              </button>
            )}

            {/* Print Button (Inline) */}
            {!hidePrint && (
              <button
                onClick={handlePrint}
                disabled={loading || !hasContent}
                className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:text-emerald-400 disabled:hover:bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl transition-all shadow-sm"
                title="Imprimir documento sin abrir ventanas emergentes"
              >
                <Printer size={14} />
                <span className="hidden xs:inline">Imprimir</span>
              </button>
            )}

            {/* Download Button */}
            {!hideDownload && url && (
              <a
                href={url}
                download={downloadName || "documento.pdf"}
                className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-500 px-3 py-2 rounded-xl transition-all border border-indigo-500/20 shadow-sm"
              >
                <Download size={14} />
                <span className="hidden xs:inline">Descargar</span>
              </a>
            )}

            {/* Close Button */}
            <button 
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Panel */}
        <div className="flex-1 w-full bg-slate-950 relative flex items-center justify-center">
          {/* Loading Indicator */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-10 gap-3">
              <Loader2 size={36} className="text-indigo-500 animate-spin" />
              <p className="text-[12px] font-bold text-slate-400 tracking-widest uppercase">
                Cargando Documento...
              </p>
            </div>
          )}

          {/* IFrame */}
          {hasContent ? (
            <iframe
              ref={iframeRef}
              src={url}
              srcDoc={html}
              onLoad={() => setLoading(false)}
              className="w-full h-full border-0 bg-slate-950 rounded-b-2xl transition-all duration-200"
              title={title}
            />
          ) : (
            <div className="text-center p-6 text-slate-500 text-[13px]">
              No hay contenido disponible para este documento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
