"use client";

import { useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { Activity, Save, Check, Database, User, MapPin, Bell, CreditCard, Mail, Eye, EyeOff } from "lucide-react";

interface Config {
  nombre_representante:string; empresa:string; servicios:string;
  garantia:string; tiempo_entrega:string; ciudad_base:string;
  zonas_cobertura:string; metodologia_venta:string;
  dias_alerta_seguimiento:string; dias_alerta_diagnostico:string;
  // Facturación
  fact_razon_social:string; fact_rfc:string; fact_banco:string;
  fact_cuenta:string; fact_clabe:string; fact_direccion_fiscal:string;
  fact_correo_facturacion:string; fact_cargo_representante:string;
  // Resend
  resend_api_key:string;
  smtp_from_name:string; smtp_from_email:string;
}

const DEFAULTS:Config = {
  nombre_representante:"", empresa:"Bionordi",
  servicios:"Reparación de transductores de ultrasonido, mantenimiento de equipo médico",
  garantia:"12 meses", tiempo_entrega:"5-7 días hábiles",
  ciudad_base:"Ciudad de México", zonas_cobertura:"CDMX, EDOMEX, Querétaro, Puebla",
  metodologia_venta:"Problema-Agitación-Solución",
  dias_alerta_seguimiento:"3", dias_alerta_diagnostico:"5",
  // Facturación
  fact_razon_social:"Bionordi S.A. de C.V.", fact_rfc:"",
  fact_banco:"", fact_cuenta:"", fact_clabe:"",
  fact_direccion_fiscal:"Ciudad de México, CDMX",
  fact_correo_facturacion:"contacto@bionordi.mx",
  fact_cargo_representante:"",
  // Resend
  resend_api_key:"",
  smtp_from_name:"Bionordi", smtp_from_email:"",
};

export default function ConfiguracionPage() {
  const [config, setConfig]   = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [denueStatus, setDenueStatus] = useState<"idle"|"importing"|"done"|"error">("idle");
  const [denueMsg, setDenueMsg] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle"|"sending"|"ok"|"error">("idle");
  const [testMsg, setTestMsg] = useState("");

  useEffect(()=>{
    fetch("/api/config").then(r=>r.json()).then(d=>{
      if(d.config) setConfig(prev=>({...prev,...d.config}));
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch("/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(config)});
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(()=>setSaved(false),2000); }
    else { alert("Error al guardar la configuración. Intenta de nuevo."); }
  };

  const handleImportDENUE = async () => {
    setDenueStatus("importing"); setDenueMsg("Importando...");
    try {
      const res  = await fetch("/api/denue/import",{method:"POST"});
      const data = await res.json();
      if(data.success){ setDenueMsg(`${data.imported} registros importados`); setDenueStatus("done"); }
      else { setDenueMsg(data.error||"Error en importación"); setDenueStatus("error"); }
    } catch { setDenueMsg("Error — verifica data/denue_medico.csv"); setDenueStatus("error"); }
  };

  const handleTestEmail = async () => {
    setTestStatus("sending"); setTestMsg("");
    await fetch("/api/config", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(config) });
    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: config.smtp_from_email,
        subject: "✅ Prueba de correo — Bionordi CRM",
        html: `<div style="font-family:sans-serif;padding:32px;max-width:500px;">
          <h2 style="color:#4E60A9;">¡Correo funcionando!</h2>
          <p style="color:#475569;">El envío de correos está configurado correctamente en el CRM de Bionordi.</p>
          <p style="color:#94A3B8;font-size:12px;">Enviado vía Resend API</p>
        </div>`,
      }),
    });
    const data = await res.json();
    if (data.success) { setTestStatus("ok"); setTestMsg("Correo de prueba enviado a " + config.smtp_from_email); }
    else { setTestStatus("error"); setTestMsg(data.error || "Error desconocido"); }
  };

  const set = (k:keyof Config) => (e:ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) =>
    setConfig(p=>({...p,[k]:e.target.value}));

  if(loading) return (
    <div className="h-full flex items-center justify-center gap-2 text-sm text-[#94A3B8]">
      <Activity size={14} className="animate-spin"/>Cargando configuración...
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#F4F6FB]">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-lg font-bold text-[#0F172A]">Configuración</h1>
          <p className="text-xs text-[#94A3B8]">Parámetros usados en scripts generados por Claude</p>
        </div>
        <div className="ml-auto">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saved
              ? <><Check size={14}/>Guardado</>
              : saving
                ? <><Activity size={14} className="animate-spin"/>Guardando...</>
                : <><Save size={14}/>Guardar cambios</>}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-5">

          {/* Representante */}
          <Section icon={<User size={15} className="text-[#4F46E5]"/>} title="Representante · Empresa">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Tu nombre">
                <input value={config.nombre_representante} onChange={set("nombre_representante")} className="inp"/>
              </Field>
              <Field label="Empresa">
                <input value={config.empresa} onChange={set("empresa")} className="inp"/>
              </Field>
            </div>
            <Field label="Servicios que ofrece Bionordi">
              <textarea value={config.servicios} onChange={set("servicios")} rows={2}
                className="inp resize-none"/>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Garantía">
                <input value={config.garantia} onChange={set("garantia")} className="inp"/>
              </Field>
              <Field label="Tiempo de entrega">
                <input value={config.tiempo_entrega} onChange={set("tiempo_entrega")} className="inp"/>
              </Field>
            </div>
            <Field label="Metodología de venta">
              <input value={config.metodologia_venta} onChange={set("metodologia_venta")} className="inp"/>
            </Field>
          </Section>

          {/* Territorio */}
          <Section icon={<MapPin size={15} className="text-[#4F46E5]"/>} title="Territorio · Cobertura">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ciudad base">
                <input value={config.ciudad_base} onChange={set("ciudad_base")} className="inp"/>
              </Field>
              <Field label="Zonas de cobertura">
                <input value={config.zonas_cobertura} onChange={set("zonas_cobertura")} className="inp"/>
              </Field>
            </div>
          </Section>

          {/* Alertas */}
          <Section icon={<Bell size={15} className="text-[#F59E0B]"/>} title="Umbrales de Alerta CRM">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Días en 'Contactado' → alerta"
                hint="Después de estos días sin respuesta aparece alerta en dashboard">
                <div className="flex items-center gap-2">
                  <input value={config.dias_alerta_seguimiento} onChange={set("dias_alerta_seguimiento")}
                    type="number" min={1} max={30} className="inp w-24"/>
                  <span className="text-sm text-[#64748B] font-medium">días</span>
                </div>
              </Field>
              <Field label="Días en 'Diagnóstico' sin nota → alerta">
                <div className="flex items-center gap-2">
                  <input value={config.dias_alerta_diagnostico} onChange={set("dias_alerta_diagnostico")}
                    type="number" min={1} max={30} className="inp w-24"/>
                  <span className="text-sm text-[#64748B] font-medium">días</span>
                </div>
              </Field>
            </div>
          </Section>

          {/* Facturación */}
          <Section icon={<CreditCard size={15} className="text-[#059669]"/>} title="Datos de Facturación · Bionordi">
            <p className="text-xs text-[#94A3B8]">Estos datos aparecen en la columna derecha de cada cotización PDF.</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Razón Social">
                <input value={config.fact_razon_social} onChange={set("fact_razon_social")} className="inp"/>
              </Field>
              <Field label="RFC">
                <input value={config.fact_rfc} onChange={set("fact_rfc")} placeholder="XXXX000000XX0" className="inp"/>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Banco">
                <input value={config.fact_banco} onChange={set("fact_banco")} placeholder="BBVA, Banamex…" className="inp"/>
              </Field>
              <Field label="No. de Cuenta">
                <input value={config.fact_cuenta} onChange={set("fact_cuenta")} placeholder="0000000000" className="inp"/>
              </Field>
              <Field label="CLABE Interbancaria">
                <input value={config.fact_clabe} onChange={set("fact_clabe")} placeholder="18 dígitos" className="inp"/>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Correo de facturación">
                <input value={config.fact_correo_facturacion} onChange={set("fact_correo_facturacion")} placeholder="facturacion@bionordi.mx" className="inp"/>
              </Field>
              <Field label="Cargo del representante">
                <input value={config.fact_cargo_representante} onChange={set("fact_cargo_representante")} placeholder="Gerente Comercial" className="inp"/>
              </Field>
            </div>
            <Field label="Dirección fiscal">
              <input value={config.fact_direccion_fiscal} onChange={set("fact_direccion_fiscal")} placeholder="Calle, Col., C.P., Ciudad" className="inp"/>
            </Field>
          </Section>

          {/* Resend */}
          <Section icon={<Mail size={15} className="text-[#0EA5E9]"/>} title="Correo — Envío de Cotizaciones">
            <div className="flex items-start gap-3 p-3 bg-[#F0F9FF] rounded-xl border border-[#BAE6FD]">
              <Mail size={14} className="mt-0.5 text-[#0EA5E9] shrink-0"/>
              <div className="text-xs text-[#0369A1] leading-relaxed">
                El envío de correos usa <strong>Resend</strong> (gratis hasta 3,000 correos/mes).
                Para activarlo: <strong>1)</strong> Crea cuenta en <strong>resend.com</strong> →
                <strong> 2)</strong> Agrega y verifica tu dominio (ej: <em>bionordi.com</em>) →
                <strong> 3)</strong> Copia el API Key y pégalo abajo.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre del remitente">
                <input value={config.smtp_from_name} onChange={set("smtp_from_name")} placeholder="Bionordi" className="inp"/>
              </Field>
              <Field label="Correo remitente" hint="Debe ser del dominio verificado en Resend">
                <input value={config.smtp_from_email} onChange={set("smtp_from_email")} placeholder="cotizaciones@bionordi.mx" className="inp"/>
              </Field>
            </div>
            <Field label="API Key de Resend" hint="Empieza con re_...  —  la encuentras en resend.com → API Keys">
              <div className="relative">
                <input
                  value={config.resend_api_key}
                  onChange={set("resend_api_key")}
                  type={showPass ? "text" : "password"}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                  className="inp pr-9"/>
                <button type="button" onClick={() => setShowPass(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
                  {showPass ? <EyeOff size={13}/> : <Eye size={13}/>}
                </button>
              </div>
            </Field>
            <div className="flex items-center gap-3 pt-1">
              <button onClick={handleTestEmail} disabled={testStatus === "sending" || !config.resend_api_key || !config.smtp_from_email}
                className="flex items-center gap-2 px-4 py-2 bg-[#0EA5E9] hover:bg-[#0284C7] disabled:opacity-40 text-white text-[12px] font-bold rounded-xl transition-colors">
                {testStatus === "sending" ? <><Activity size={13} className="animate-spin"/>Enviando prueba…</> : <><Mail size={13}/>Enviar correo de prueba</>}
              </button>
              {testMsg && (
                <span className={`text-[12px] font-medium ${testStatus === "ok" ? "text-[#059669]" : "text-[#DC2626]"}`}>
                  {testStatus === "ok" ? "✓ " : "✗ "}{testMsg}
                </span>
              )}
            </div>
          </Section>

          {/* DENUE */}
          <Section icon={<Database size={15} className="text-[#4F46E5]"/>} title="Fuente DENUE (INEGI)">
            <p className="text-sm text-[#64748B]">
              Descarga el CSV desde <span className="text-[#4F46E5] font-medium">inegi.org.mx/app/descarga</span> → filtra
              SCIAN 621, 622, 623. Guarda el archivo como{" "}
              <code className="bg-[#F1F5F9] px-1.5 py-0.5 rounded text-xs font-mono text-[#374151]">data/denue_medico.csv</code>{" "}
              y presiona importar.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button onClick={handleImportDENUE} disabled={denueStatus==="importing"} className="btn-primary">
                {denueStatus==="importing"
                  ? <><Activity size={14} className="animate-spin"/>Importando...</>
                  : <><Database size={14}/>Importar CSV</>}
              </button>
              {denueMsg && (
                <span className={`text-sm font-medium ${denueStatus==="done"?"text-[#059669]":denueStatus==="error"?"text-[#DC2626]":"text-[#64748B]"}`}>
                  {denueStatus==="done"&&"✓ "}{denueMsg}
                </span>
              )}
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}

function Section({icon,title,children}:{icon:ReactNode;title:string;children:ReactNode}) {
  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-[#F1F5F9]">
        {icon}
        <h2 className="font-semibold text-[#0F172A]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#374151] uppercase tracking-wider">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}
