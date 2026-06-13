"use client";
import React, { useRef, useState, useEffect } from "react";
import { Eraser, X, Check, Trash2, Edit3 } from "lucide-react";

interface SignaturePadProps {
  label: string;
  defaultValue?: string;
  onSave: (b64: string) => void;
  onClear: () => void;
}

export default function SignaturePad({
  label,
  defaultValue,
  onSave,
  onClear,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Configura el contexto en coordenadas CSS con devicePixelRatio
  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1E293B"; // Color de tinta oscuro y sólido
    ctx.lineWidth = 2.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  // Inicializar canvas y dibujar firma si el modal se abre
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = setupCanvas(canvas);
        if (!ctx) return;

        if (defaultValue) {
          const img = new Image();
          img.onload = () => {
            const rect = canvas.getBoundingClientRect();
            // Centrar la imagen cargada proporcionalmente si es necesario, 
            // pero como ya viene recortada, la ajustamos al contenedor.
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
            setIsEmpty(false);
          };
          img.src = defaultValue;
        } else {
          setIsEmpty(true);
        }
      }, 60); // Retardo pequeño para asegurar montaje y render en el DOM
      return () => clearTimeout(timer);
    }
  }, [isModalOpen, defaultValue]);

  // Manejar el redimensionamiento del canvas mientras el modal esté abierto
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !isModalOpen) return;

      // Respaldar trazo
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      const ctx = setupCanvas(canvas);
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      ctx.drawImage(tempCanvas, 0, 0, rect.width, rect.height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isModalOpen]);

  const getCoords = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const widthFor = (e: PointerEvent | React.PointerEvent) =>
    e.pointerType === "pen" && e.pressure > 0
      ? Math.max(1.5, Math.min(5.0, 1.5 + e.pressure * 3.5))
      : 2.8;

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getCoords(e);
    ctx.lineWidth = widthFor(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Dibujar punto inicial visible
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    drawingRef.current = true;
    setIsEmpty(false);
    e.preventDefault();
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const native = e.nativeEvent as PointerEvent;
    const events: PointerEvent[] =
      typeof native.getCoalescedEvents === "function" && native.getCoalescedEvents().length > 0
        ? native.getCoalescedEvents()
        : [native];

    for (const ev of events) {
      const { x, y } = getCoords(ev);
      ctx.lineWidth = widthFor(ev);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
    e.preventDefault();
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (e) {
      try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch {}
    }
    e?.preventDefault();
  };

  // Algoritmo de recorte inteligente para remover márgenes transparentes/blancos de la firma.
  // Esto hace que la firma exportada ocupe solo el recuadro real del trazo,
  // escalándose proporcionalmente en los PDFs finales sin verse minúscula.
  const trimCanvas = (canvas: HTMLCanvasElement): HTMLCanvasElement | null => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let hasPixels = false;

    // Buscar bordes de los trazos reales
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        const red = data[idx + 0];
        const green = data[idx + 1];
        const blue = data[idx + 2];
        
        // Píxel es considerado trazo si no es transparente ni es color blanco de fondo
        const isTransparent = alpha === 0;
        const isWhite = red > 245 && green > 245 && blue > 245;
        
        if (!isTransparent && !isWhite) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          hasPixels = true;
        }
      }
    }

    if (!hasPixels) return null;

    // Agregar un margen de holgura (15px) para evitar cortes rústicos en los bordes
    const margin = 15;
    minX = Math.max(0, minX - margin);
    minY = Math.max(0, minY - margin);
    maxX = Math.min(width, maxX + margin);
    maxY = Math.min(height, maxY + margin);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const trimmedCanvas = document.createElement("canvas");
    trimmedCanvas.width = cropWidth;
    trimmedCanvas.height = cropHeight;
    const trimmedCtx = trimmedCanvas.getContext("2d");
    if (!trimmedCtx) return null;

    trimmedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return trimmedCanvas;
  };

  const handleAccept = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const trimmedCanvas = trimCanvas(canvas);
    if (trimmedCanvas) {
      const b64 = trimmedCanvas.toDataURL("image/png");
      onSave(b64);
    } else {
      // Fallback en caso de que esté vacío o falle el recorte
      const b64 = canvas.toDataURL("image/png");
      onSave(b64);
    }
    setIsModalOpen(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setIsEmpty(true);
    onClear();
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
        {label}
      </span>

      {/* Tarjeta de previsualización compacta */}
      {!defaultValue ? (
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full h-[75px] border-2 border-dashed border-gray-200 hover:border-[#4E60A9]/50 rounded-xl flex flex-col items-center justify-center gap-1 bg-slate-50/30 hover:bg-slate-50 transition-all group"
        >
          <Edit3 size={15} className="text-gray-400 group-hover:text-[#4E60A9] group-hover:scale-105 transition-all" />
          <span className="text-[11px] font-bold text-gray-400 group-hover:text-[#4E60A9]/80 transition-colors">
            Presione aquí para firmar
          </span>
        </button>
      ) : (
        <div 
          onClick={() => setIsModalOpen(true)}
          className="relative w-full h-[75px] border border-gray-200 hover:border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm transition-all group flex items-center justify-center p-3 cursor-pointer hover:shadow-md"
        >
          <img 
            src={defaultValue} 
            alt="Firma" 
            className="max-h-[55px] max-w-[90%] object-contain filter drop-shadow-sm transition-transform group-hover:scale-102" 
          />
          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clearCanvas();
              }}
              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg bg-white border border-gray-200 shadow-sm transition-colors"
              title="Eliminar firma"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      )}

      {/* Modal/Tarjeta emergente de firma de alta resolución */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)} 
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[520px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <h3 className="font-extrabold text-[13px] text-slate-700 uppercase tracking-wider">
                  {label}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Dibuje su firma con el dedo, stylus o mouse sobre el recuadro blanco
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Canvas Area */}
            <div className="p-6 bg-slate-50/50 flex flex-col items-center justify-center shrink-0">
              <div className="relative w-full h-[220px] bg-white border border-slate-200/80 rounded-xl shadow-inner overflow-hidden flex items-center justify-center">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full cursor-crosshair touch-none"
                  style={{
                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                    WebkitTouchCallout: "none",
                  }}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerCancel={stopDrawing}
                  onPointerLeave={() => { if (drawingRef.current) stopDrawing(); }}
                />
                {isEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="text-[12px] font-semibold text-slate-400 italic tracking-wider">
                      Lienzo de firma
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <button
                type="button"
                onClick={clearCanvas}
                className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-400 hover:text-red-500 hover:bg-red-50 hover:border-red-200 px-3.5 py-2 rounded-xl transition-all border border-slate-200 bg-white shadow-sm"
              >
                <Eraser size={12} />
                Limpiar Lienzo
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-700 px-4 py-2 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isEmpty}
                  className="flex items-center gap-1.5 text-[11px] font-extrabold text-white bg-[#4E60A9] hover:bg-[#3b4b8a] disabled:bg-[#4E60A9]/45 px-5 py-2.5 rounded-xl transition-all shadow-sm"
                >
                  <Check size={12} />
                  Guardar Firma
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
