"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Activity, CheckCircle, Clock, Check, FileText, AlertTriangle, ShieldCheck, Wrench, ThermometerSun, AlertCircle } from "lucide-react";

export default function SeguimientoPage() {
  const { folio } = useParams();
  const [orden, setOrden] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/seguimiento/${folio}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setOrden(d.orden);
        setLoading(false);
      })
      .catch(err => {
        setError("Error de conexión");
        setLoading(false);
      });
  }, [folio]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans">
        <Activity size={32} className="text-[#4E60A9] animate-spin mb-4" />
        <p className="text-[#64748B] font-medium animate-pulse">Obteniendo información del servicio...</p>
      </div>
    );
  }

  if (error || !orden) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-sm text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">No encontrado</h1>
          <p className="text-gray-500 text-sm">{error || "La orden de servicio no existe."}</p>
        </div>
      </div>
    );
  }

  const steps = [
    { id: "recibido", label: "Equipo Recibido", desc: "El equipo está en nuestras instalaciones." },
    { id: "en_diagnostico", label: "Evaluación Técnica", desc: "Nuestros ingenieros evalúan el estado del equipo." },
    { id: "en_reparacion", label: "Servicio en Proceso", desc: "Realizando mantenimientos y correcciones." },
    { id: "en_espera_refacciones", label: "Espera de Refacciones", desc: "Piezas o componentes en tránsito.", isWarning: true },
    { id: "en_pruebas", label: "Pruebas de Funcionamiento", desc: "Verificación de calidad y calibración." },
    { id: "listo", label: "Servicio Finalizado", desc: "El equipo está listo para entrega." },
    { id: "entregado", label: "Entregado", desc: "Servicio concluido exitosamente." },
  ];

  let currentStepIndex = steps.findIndex(s => s.id === orden.status);
  if (currentStepIndex === -1 && orden.status === "cancelado") {
    currentStepIndex = 0; // Mostrar todo gris o algo diferente
  }

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const comprFecha = orden.fecha_compromiso ? new Date(orden.fecha_compromiso + "T00:00:00") : null;
  const diasRestantes = comprFecha ? Math.ceil((comprFecha.getTime() - hoy.getTime()) / 86400000) : null;

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans pb-20">
      {/* Navbar/Header Corporativo */}
      <header className="bg-white border-b border-[#E8EFF8] py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/ISOTIPO.png" alt="Bionordi" className="w-8 h-8 object-contain" />
            <div>
              <div className="text-[15px] font-extrabold text-[#1E293B] tracking-[-0.03em] leading-none">BIONORDI</div>
              <div className="text-[9px] text-[#4E60A9] font-bold tracking-[0.05em] mt-0.5">MEDICAL TECHNOLOGY</div>
            </div>
          </div>
          <a href={`/api/pdf/orden?id=${orden.id}`} target="_blank" className="flex items-center gap-2 bg-[#4E60A9] hover:bg-[#3B4C93] text-white px-4 py-2 rounded-xl text-[12px] font-bold transition-colors shadow-sm">
            <FileText size={14} />
            Descargar Reporte PDF
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        
        {/* Banner de Estado Principal */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#4E60A9]/5 to-transparent rounded-bl-full pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[12px] font-extrabold text-[#4E60A9] bg-[#EEF3FC] px-3 py-1 rounded-full uppercase tracking-wider">Folio: {orden.folio}</span>
              {orden.status === "cancelado" && <span className="text-[12px] font-extrabold text-[#DC2626] bg-[#FEF2F2] px-3 py-1 rounded-full uppercase tracking-wider">CANCELADO</span>}
            </div>
            <h1 className="text-3xl font-extrabold text-[#1E293B] tracking-tight mb-2">
              Seguimiento de Servicio
            </h1>
            <p className="text-[#64748B] text-sm max-w-md">
              A través de este portal, puedes monitorear en tiempo real el estado técnico y progreso de tu equipo médico.
            </p>
          </div>

          <div className="flex flex-col md:items-end justify-center gap-2 shrink-0">
            {comprFecha && orden.status !== "entregado" && orden.status !== "cancelado" && (
              <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-2xl p-4 min-w-[200px]">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1.5"><Clock size={12} /> Entrega Estimada</div>
                <div className="text-lg font-extrabold text-[#1E293B]">
                  {comprFecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
                </div>
                {diasRestantes !== null && diasRestantes >= 0 && (
                  <div className={`text-[11px] font-bold mt-1 ${diasRestantes <= 2 ? "text-[#D97706]" : "text-[#059669]"}`}>
                    {diasRestantes === 0 ? "Entrega programada para HOY" : `Faltan ${diasRestantes} días`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Dos columnas layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Columna Izquierda (Datos y Detalles) */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Info del Equipo */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#EEF3FC] rounded-full flex items-center justify-center opacity-50">
                <Wrench size={24} className="text-[#4E60A9] translate-x-[-4px] translate-y-[4px]" />
              </div>
              <h3 className="text-[11px] font-extrabold text-[#94A3B8] uppercase tracking-widest mb-4">Información del Equipo</h3>
              
              <div className="space-y-4">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Equipo y Marca</div>
                  <div className="font-bold text-[#1E293B] mt-0.5">
                    {orden.equipo_tipo || "Equipo Médico"} {orden.equipo_marca ? `- ${orden.equipo_marca}` : ""}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Modelo</div>
                    <div className="font-semibold text-[#475569] mt-0.5">{orden.equipo_modelo || "N/D"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">No. Serie</div>
                    <div className="font-mono text-[13px] font-semibold text-[#4E60A9] mt-0.5 bg-[#EEF3FC] px-2 py-0.5 rounded-md inline-block">{orden.equipo_num_serie || "N/D"}</div>
                  </div>
                </div>
                {(orden.equipo_area_medica || orden.equipo_version) && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-50">
                    {orden.equipo_area_medica && (
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Área Médica</div>
                        <div className="text-sm font-medium text-[#475569] mt-0.5">{orden.equipo_area_medica}</div>
                      </div>
                    )}
                    {orden.equipo_version && (
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wide">Versión / SW</div>
                        <div className="text-sm font-medium text-[#475569] mt-0.5">{orden.equipo_version}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Garantía */}
            {orden.garantia && (
              <div className="bg-gradient-to-br from-[#059669] to-[#047857] rounded-3xl p-6 shadow-sm border border-emerald-800/20 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={18} className="text-emerald-200" />
                  <h3 className="text-[11px] font-extrabold text-emerald-100 uppercase tracking-widest">Cobertura de Garantía</h3>
                </div>
                <div className="text-lg font-bold leading-snug">{orden.garantia}</div>
              </div>
            )}
          </div>

          {/* Columna Derecha (Timeline y Reporte) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Timeline de Progreso */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-[11px] font-extrabold text-[#94A3B8] uppercase tracking-widest mb-6 flex items-center gap-2">
                <Activity size={14} /> Progreso del Servicio
              </h3>
              
              <div className="relative pl-4 space-y-6">
                {/* Línea vertical de fondo */}
                <div className="absolute top-2 bottom-2 left-[19px] w-[2px] bg-[#F1F5F9]" />
                
                {steps.map((step, idx) => {
                  const isCompleted = currentStepIndex >= idx;
                  const isCurrent = currentStepIndex === idx;
                  const isPending = currentStepIndex < idx;
                  
                  // Ocultar "Espera de refacciones" si no es actual y no hemos pasado por ella explícitamente?
                  // Por ahora la mostramos siempre en el timeline.
                  
                  let iconBg = "bg-white border-[#E2E8F0] border-2";
                  let iconColor = "text-transparent";
                  let lineClass = "";

                  if (isCompleted && !isCurrent) {
                    iconBg = "bg-[#4E60A9] border-[#4E60A9]";
                    iconColor = "text-white";
                    lineClass = "absolute top-4 left-[15px] w-[2px] bg-[#4E60A9] -bottom-8";
                  } else if (isCurrent) {
                    iconBg = step.isWarning ? "bg-[#EA580C] border-[#EA580C] shadow-[0_0_0_4px_rgba(234,88,12,.1)]" : "bg-[#4E60A9] border-[#4E60A9] shadow-[0_0_0_4px_rgba(78,96,169,.1)]";
                    iconColor = "text-white";
                  }

                  return (
                    <div key={step.id} className="relative flex items-start gap-4">
                      {isCompleted && !isCurrent && idx < steps.length - 1 && (
                        <div className="absolute top-6 left-[19px] w-[2px] bg-[#4E60A9] -bottom-6 z-0" />
                      )}
                      
                      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${iconBg}`}>
                        {isCompleted && !isCurrent ? <Check size={14} className={iconColor} strokeWidth={3} /> : 
                         isCurrent ? <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" /> : 
                         null}
                      </div>
                      
                      <div className={`flex-1 pb-2 ${isPending ? "opacity-50" : ""}`}>
                        <h4 className={`font-bold text-[15px] ${isCurrent ? (step.isWarning ? "text-[#EA580C]" : "text-[#4E60A9]") : "text-[#1E293B]"}`}>
                          {step.label}
                        </h4>
                        <p className="text-sm text-[#64748B] mt-0.5">{step.desc}</p>
                        
                        {/* Si es el estado actual y hay un reporte/nota técnica, lo mostramos aquí como "Última actualización" */}
                        {isCurrent && (orden.diagnostico || orden.notas_tecnicas) && (
                          <div className="mt-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-[13px] text-[#475569] leading-relaxed">
                            <span className="font-bold text-[#334155] block mb-1">Última actualización:</span>
                            {orden.diagnostico || orden.notas_tecnicas}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detalles Técnicos */}
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100">
              <h3 className="text-[11px] font-extrabold text-[#94A3B8] uppercase tracking-widest mb-5">Reporte Detallado</h3>
              
              <div className="space-y-5">
                {orden.falla_reportada && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" /> Falla Reportada
                    </h4>
                    <p className="text-[13.5px] text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-100">{orden.falla_reportada}</p>
                  </div>
                )}
                
                {orden.diagnostico && currentStepIndex >= 1 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Diagnóstico Técnico
                    </h4>
                    <p className="text-[13.5px] text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-100">{orden.diagnostico}</p>
                  </div>
                )}

                {orden.actividades_realizadas && currentStepIndex >= 2 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Actividades Realizadas
                    </h4>
                    <p className="text-[13.5px] text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-100 whitespace-pre-wrap">{orden.actividades_realizadas}</p>
                  </div>
                )}

                {orden.pruebas_realizadas && currentStepIndex >= 4 && (
                  <div>
                    <h4 className="text-[12px] font-bold text-[#1E293B] mb-1.5 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> Pruebas de Calidad
                    </h4>
                    <p className="text-[13.5px] text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-gray-100 whitespace-pre-wrap">{orden.pruebas_realizadas}</p>
                  </div>
                )}

                {orden.reporte_tecnico_final && currentStepIndex >= 5 && (
                  <div className="pt-2">
                    <h4 className="text-[12px] font-bold text-emerald-700 mb-1.5 flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-500" /> Conclusión Técnica Final
                    </h4>
                    <p className="text-[13.5px] text-emerald-900 leading-relaxed bg-emerald-50 p-4 rounded-xl border border-emerald-100 font-medium whitespace-pre-wrap">{orden.reporte_tecnico_final}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-4 mt-12 text-center text-[11px] text-gray-400 font-medium">
        <p>© {new Date().getFullYear()} Bionordi Medical Technology. Todos los derechos reservados.</p>
        <p className="mt-1">Si tienes dudas sobre el servicio, por favor contacta a tu asesor Bionordi o ingeniero a cargo.</p>
      </footer>
    </div>
  );
}
