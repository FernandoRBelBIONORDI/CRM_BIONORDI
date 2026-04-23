"use client";

import { useState } from "react";
import { X, UserPlus, Activity } from "lucide-react";
import nichos from "@/data/nichos_medicos.json";

const ESTADOS = [
  "Aguascalientes","Baja California","Baja California Sur","Campeche",
  "Chiapas","Chihuahua","Ciudad de México","Coahuila","Colima","Durango",
  "Estado de México","Guanajuato","Guerrero","Hidalgo","Jalisco",
  "Michoacán","Morelos","Nayarit","Nuevo León","Oaxaca","Puebla",
  "Querétaro","Quintana Roo","San Luis Potosí","Sinaloa","Sonora",
  "Tabasco","Tamaulipas","Tlaxcala","Veracruz","Yucatán","Zacatecas",
];

interface Props {
  onClose: () => void;
  onCreated: (lead: any) => void;
}

export default function NuevoLeadModal({ onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: "", telefono: "", ciudad: "", estado_republica: "",
    nicho: nichos[0], notas: "", status_crm: "nuevo",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    const d = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(r => r.json());
    setSaving(false);
    if (d.lead) { onCreated(d.lead); onClose(); }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-[28px] shadow-[0_20px_60px_-12px_rgba(0,0,0,0.15)] w-full max-w-lg border border-gray-100"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-8 py-6 flex items-center justify-between border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#EEF3FC] flex items-center justify-center">
              <UserPlus size={18} className="text-[#427DFA]"/>
            </div>
            <div>
              <h3 className="font-bold text-[18px] text-[#202538] tracking-tight">Nuevo Lead Manual</h3>
              <p className="text-[12px] text-gray-400 font-medium">Agregar prospecto encontrado fuera del radar</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <X size={16}/>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nombre / Razón Social *</label>
            <input value={form.nombre} onChange={set("nombre")} required autoFocus
              placeholder="Ej: Clínica San Juan S.A. de C.V."
              className="inp w-full"/>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Teléfono</label>
              <input value={form.telefono} onChange={set("telefono")} placeholder="10 dígitos" className="inp w-full"/>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Ciudad</label>
              <input value={form.ciudad} onChange={set("ciudad")} placeholder="Ciudad de México" className="inp w-full"/>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Estado</label>
              <select value={form.estado_republica} onChange={set("estado_republica")} className="inp w-full">
                <option value="">Seleccionar</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nicho</label>
              <select value={form.nicho} onChange={set("nicho")} className="inp w-full">
                {nichos.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Estado CRM</label>
              <select value={form.status_crm} onChange={set("status_crm")} className="inp w-full">
                {[["nuevo","Nuevo"],["contactado","Contactado"],["seguimiento","Seguimiento"],["diagnostico","Diagnóstico"],["cliente","Cliente"]].map(([v,l])=>
                  <option key={v} value={v}>{l}</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Notas iniciales</label>
            <textarea value={form.notas} onChange={set("notas")} rows={2}
              placeholder="Cómo lo conociste, qué equipo tienen, próximos pasos..."
              className="inp w-full resize-none"/>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold text-gray-500 bg-gray-50 hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.nombre.trim()}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold text-white bg-[#427DFA] hover:bg-[#3668d6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-[#427DFA]/20">
              {saving ? <><Activity size={14} className="animate-spin"/>Guardando...</> : <><UserPlus size={14}/>Crear Lead</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
