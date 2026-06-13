"use client";

import React, { useRef, useState, useEffect } from "react";
import { Eraser } from "lucide-react";

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
  const [isEmpty, setIsEmpty] = useState(true);

  // Configura el contexto en coordenadas CSS con respaldo retina (devicePixelRatio)
  const setupCanvas = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#202538";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  // Inicializar canvas y dibujar firma por defecto si existe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;

    if (defaultValue) {
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
        setIsEmpty(false);
      };
      img.src = defaultValue;
    }
  }, [defaultValue]);

  // Manejar el redimensionamiento del canvas al cambiar el tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas || defaultValue) return; // Si hay firma cargada, no redimensionar para evitar borrarla

      // Respaldar lo dibujado
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
  }, [defaultValue]);

  const getCoords = (e: PointerEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Grosor según presión: Apple Pencil reporta presión real (0–1); dedo/mouse usan el grosor base
  const widthFor = (e: PointerEvent | React.PointerEvent) =>
    e.pointerType === "pen" && e.pressure > 0
      ? Math.max(1.2, Math.min(4.5, 1.2 + e.pressure * 3))
      : 2.5;

  // Pointer Events: unifican mouse, dedo y Apple Pencil. setPointerCapture
  // evita que iPadOS robe el trazo (Scribble / scroll) a mitad de la firma.
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
    // Punto inicial visible aunque sea un toque sin arrastre
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

    // getCoalescedEvents entrega las muestras intermedias del Apple Pencil
    // (120Hz) para trazos suaves; si no existe, se usa el evento normal.
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
    saveSignature();
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const b64 = canvas.toDataURL("image/png");
    onSave(b64);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onClear();
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
        {label}
      </span>
      <div className="relative border border-gray-200 hover:border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm transition-colors group">
        <canvas
          ref={canvasRef}
          className="w-full h-[140px] cursor-crosshair touch-none bg-slate-50/20"
          style={{
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            // Evita que iPadOS active Scribble (escritura a texto) sobre el lienzo
            WebkitTouchCallout: "none",
          }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={() => { if (drawingRef.current) stopDrawing(); }}
        />

        {/* Guía visual */}
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <span className="text-[12px] font-medium text-gray-400 italic">Firmar aquí</span>
          </div>
        )}

        {/* Acciones */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          <button
            type="button"
            onClick={clearCanvas}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 px-2 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 bg-white transition-all shadow-sm"
            title="Limpiar firma"
          >
            <Eraser size={11} />
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
