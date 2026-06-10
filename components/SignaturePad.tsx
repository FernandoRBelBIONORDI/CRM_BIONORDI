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
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  // Inicializar canvas y dibujar firma por defecto si existe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ajustar resolución de canvas para pantallas retina
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.strokeStyle = "#202538"; // Color de trazo oscuro
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (defaultValue) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
      
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      
      // Respaldar lo dibujado
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) tempCtx.drawImage(canvas, 0, 0);

      // Redimensionar
      canvas.width = rect.width;
      canvas.height = rect.height;

      // Restaurar propiedades de dibujo
      ctx.strokeStyle = "#202538";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Dibujar de nuevo
      ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [defaultValue]);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    
    // Si es evento touch
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    
    // Si es evento de mouse
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setIsEmpty(false);

    // Evitar scroll en móviles
    if (e.cancelable) e.preventDefault();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    if (e.cancelable) e.preventDefault();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
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
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
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
