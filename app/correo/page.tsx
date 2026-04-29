"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Mail, Send, Search, Check, AlertCircle, Activity,
  Info, ChevronDown, X, User, RefreshCw,
} from "lucide-react";

// ── Variables del template ────────────────────────────────────────────────────
interface Vars {
  nombre_doctor: string;
  consultorio: string;
  ciudad: string;
  especialidad: string;
  mensaje_extra: string;
  nombre_remitente: string;
}

function applyVars(tpl: string, v: Vars, standalone = false): string {
  const extraBlock = v.mensaje_extra
    ? standalone
      ? `<p style="font-size:13px;color:rgba(255,255,255,0.72);font-style:italic;line-height:1.7;border-left:3px solid #38AD64;padding-left:14px;margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;">${v.mensaje_extra}</p>`
      : `<tr><td style="padding:0 40px 20px;"><p style="font-size:13px;color:#475569;line-height:1.8;margin:0;font-style:italic;border-left:3px solid #E2E8F0;padding-left:14px;">${v.mensaje_extra}</p></td></tr>`
    : "";
  return tpl
    .replace(/\{\{nombre_doctor\}\}/g,   v.nombre_doctor   || "Dr. [Nombre]")
    .replace(/\{\{consultorio\}\}/g,      v.consultorio     || "[Consultorio]")
    .replace(/\{\{ciudad\}\}/g,           v.ciudad          || "[Ciudad]")
    .replace(/\{\{especialidad\}\}/g,     v.especialidad    || "[Especialidad]")
    .replace(/\{\{nombre_remitente\}\}/g, v.nombre_remitente|| "Fernando")
    .replace(/\{\{mensaje_extra\}\}/g,    extraBlock);
}

// ── Cromado compartido header/footer ─────────────────────────────────────────
function chrome(body: string, remitente: string, origin = "") {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Bionordi</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-collapse:collapse;">

  <!-- Top accent bar -->
  <tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

  <!-- Logo header -->
  <tr><td style="background:#ffffff;padding:18px 40px 14px;border-bottom:1px solid #E8EDF4;">
    <img src="${origin}/LOGO_PRINCIPAL.png" alt="Bionordi Medical Technology" height="38" border="0" style="display:block;height:38px;width:auto;" />
  </td></tr>

  ${body}

  <!-- Footer -->
  <tr><td style="padding:20px 40px 24px;background:#F8FAFC;border-top:1px solid #E8EDF4;">
    <p style="font-size:11px;color:#94A3B8;line-height:1.7;margin:0;">
      <strong style="color:#64748B;">${remitente}</strong> · Bionordi S.A. de C.V.<br>
      Laboratorio especializado en reparación y mantenimiento de transductores de ultrasonido.<br>
      <span style="color:#CBD5E1;font-size:10px;">Si no desea recibir estos correos, por favor ignore este mensaje.</span>
    </p>
  </td></tr>

  <!-- Bottom accent bar -->
  <tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

</table>
</body></html>`;
}

// ── Definición de templates ───────────────────────────────────────────────────
const TPLS = {
  presentacion: {
    label: "Primer contacto",
    color: "#0C1630",
    standalone: true,
    defaultSubject: "Tecnología de ultrasonido para su consulta · Bionordi",
    body: `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Bionordi — Tecnología Médica</title></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff">
<tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>
<tr><td bgcolor="#ffffff" style="padding:18px 40px 14px;border-bottom:1px solid #E8EDF4;">
  <img src="{{origin}}/LOGO_PRINCIPAL.png" alt="Bionordi Medical Technology" height="40" border="0" style="display:block;height:40px;width:auto;" />
</td></tr>

<tr><td bgcolor="#0C1630" style="padding:32px 40px 46px;">
  <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:18px;"><tr>
    <td style="background:rgba(75,94,199,0.18);border:1px solid rgba(75,94,199,0.35);border-radius:100px;padding:5px 14px;font-size:11px;font-weight:700;color:#38AD64;text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;">&#9679; Diagnóstico por ultrasonido</td>
  </tr></table>
  <p style="font-size:15px;font-weight:600;color:rgba(255,255,255,0.7);margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">Estimado/a {{nombre_doctor}},</p>
  <p style="font-size:30px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;">Equipos listos para <span style="color:#38AD64;">diagnósticos</span> que no admiten dudas.</p>
  <p style="font-size:15px;color:rgba(255,255,255,0.62);line-height:1.65;margin:0;font-family:Arial,Helvetica,sans-serif;">Somos tu proveedor especializado en tecnología de ultrasonido médico. Venta, reparación y soporte técnico — todo bajo un mismo respaldo, para que tu consulta en <strong style="color:rgba(255,255,255,0.85);">{{consultorio}}</strong> en <strong style="color:rgba(255,255,255,0.85);">{{ciudad}}</strong> trabaje sin interrupciones.</p>
  {{mensaje_extra}}
</td></tr>

<tr><td bgcolor="#ffffff" style="height:10px;font-size:1px;line-height:1px;">&nbsp;</td></tr>

<tr><td bgcolor="#ffffff" style="padding:34px 40px 30px;">
  <p style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#4E60A9;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Nuestros productos</p>
  <p style="font-size:21px;font-weight:700;color:#0C1630;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.02em;">Ultrasonido de alta resolución, disponible cuando lo necesitas.</p>
  <p style="font-size:14px;color:#617090;line-height:1.6;margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;">Equipos para <strong>{{especialidad}}</strong> y más especialidades. Transductores con compatibilidad garantizada.</p>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7FC;border-radius:12px;border:1px solid #E5EAF4;margin-bottom:10px;"><tr>
    <td width="4" bgcolor="#4E60A9" style="border-radius:12px 0 0 12px;font-size:1px;line-height:1px;">&nbsp;</td>
    <td style="padding:14px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="68" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="60" height="60" bgcolor="#E5EAF4" align="center" valign="middle" style="border-radius:10px;">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="8" width="24" height="16" rx="3" stroke="#4E60A9" stroke-width="1.5" fill="none"/><path d="M9 19 Q11 14, 13 17 Q15 20, 17 13 Q19 6, 21 16 Q22 20, 25 16" stroke="#4E60A9" stroke-width="1.3" fill="none" stroke-linecap="round"/><rect x="13" y="24" width="8" height="2.5" rx="1.25" fill="#4E60A9" opacity="0.5"/></svg>
        </td></tr></table></td>
        <td valign="top" style="padding-left:14px;">
          <p style="font-size:14px;font-weight:700;color:#0C1630;margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;">Ultrasonido Portátil M9</p>
          <p style="font-size:12px;color:#617090;line-height:1.5;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Mindray M9 — sistema compacto de alto rendimiento. Doppler color, imagen 2D/3D. Ideal para consulta y urgencias.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td><span style="font-size:14px;font-weight:700;color:#0C1630;font-family:Arial,Helvetica,sans-serif;">$320,000 <span style="font-size:11px;font-weight:400;color:#617090;">MXN</span></span><br>
            <span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#ECF0FD;color:#4E60A9;font-family:Arial,Helvetica,sans-serif;">Nuevo</span>&nbsp;<span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#E8FAF1;color:#2A9D6A;font-family:Arial,Helvetica,sans-serif;">Envío gratis</span></td>
            <td align="right" valign="bottom"><a href="https://www.bionordi.com/venta/13" style="font-size:12px;font-weight:600;color:#4E60A9;text-decoration:none;font-family:Arial,Helvetica,sans-serif;" target="_blank">Ver equipo →</a></td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7FC;border-radius:12px;border:1px solid #E5EAF4;margin-bottom:10px;"><tr>
    <td width="4" bgcolor="#4E60A9" style="border-radius:12px 0 0 12px;font-size:1px;line-height:1px;">&nbsp;</td>
    <td style="padding:14px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="68" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="60" height="60" bgcolor="#E5EAF4" align="center" valign="middle" style="border-radius:10px;">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="26" height="18" rx="3" stroke="#4E60A9" stroke-width="1.5" fill="none"/><path d="M8 18 Q10 11, 12 15 Q14 19, 16 10 Q18 1, 20 12 Q21 17, 24 13 Q26 10, 27 14" stroke="#4E60A9" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>
        </td></tr></table></td>
        <td valign="top" style="padding-left:14px;">
          <p style="font-size:14px;font-weight:700;color:#0C1630;margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;">Ultrasonido 4D Voluson</p>
          <p style="font-size:12px;color:#617090;line-height:1.5;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Sistema obstétrico/ginecológico de alta gama. Imagen 4D en tiempo real, compatible con transductores volumétricos.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td><span style="font-size:14px;font-weight:700;color:#0C1630;font-family:Arial,Helvetica,sans-serif;">$850,000 <span style="font-size:11px;font-weight:400;color:#617090;">MXN</span></span><br>
            <span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#ECF0FD;color:#4E60A9;font-family:Arial,Helvetica,sans-serif;">4D · Doppler</span>&nbsp;<span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#E8FAF1;color:#2A9D6A;font-family:Arial,Helvetica,sans-serif;">Envío gratis</span></td>
            <td align="right" valign="bottom"><a href="https://www.bionordi.com/venta/9" style="font-size:12px;font-weight:600;color:#4E60A9;text-decoration:none;font-family:Arial,Helvetica,sans-serif;" target="_blank">Ver equipo →</a></td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F7FC;border-radius:12px;border:1px solid #E5EAF4;margin-bottom:22px;"><tr>
    <td width="4" bgcolor="#38AD64" style="border-radius:12px 0 0 12px;font-size:1px;line-height:1px;">&nbsp;</td>
    <td style="padding:14px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="68" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="60" height="60" bgcolor="#E5EAF4" align="center" valign="middle" style="border-radius:10px;">
          <svg width="30" height="30" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="13" y="6" width="8" height="16" rx="4" stroke="#38AD64" stroke-width="1.5" fill="none"/><path d="M17 22 L17 28" stroke="#38AD64" stroke-width="1.5" stroke-linecap="round"/><path d="M13 28 L21 28" stroke="#38AD64" stroke-width="1.5" stroke-linecap="round"/></svg>
        </td></tr></table></td>
        <td valign="top" style="padding-left:14px;">
          <p style="font-size:14px;font-weight:700;color:#0C1630;margin:0 0 3px;font-family:Arial,Helvetica,sans-serif;">Transductor Convex 3.5 MHz</p>
          <p style="font-size:12px;color:#617090;line-height:1.5;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;">Sonda convexa multipropósito para abdomen, obstetricia y ginecología. Compatible con las principales marcas del mercado.</p>
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td><span style="font-size:14px;font-weight:700;color:#0C1630;font-family:Arial,Helvetica,sans-serif;">$45,000 <span style="font-size:11px;font-weight:400;color:#617090;">MXN</span></span><br>
            <span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#E8FAF1;color:#2A9D6A;font-family:Arial,Helvetica,sans-serif;">Stock disponible</span>&nbsp;<span style="display:inline-block;margin-top:5px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:#E8FAF1;color:#2A9D6A;font-family:Arial,Helvetica,sans-serif;">Envío gratis</span></td>
            <td align="right" valign="bottom"><a href="https://www.bionordi.com/venta/10" style="font-size:12px;font-weight:600;color:#38AD64;text-decoration:none;font-family:Arial,Helvetica,sans-serif;" target="_blank">Ver sonda →</a></td>
          </tr></table>
        </td>
      </tr></table>
    </td>
  </tr></table>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0C1630;border-radius:14px;border:1px solid rgba(75,94,199,0.25);">
    <tr><td style="padding:20px 20px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="56" valign="top"><table cellpadding="0" cellspacing="0" border="0"><tr><td width="46" height="46" align="center" valign="middle" style="background:rgba(61,187,121,0.15);border-radius:12px;">
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="13" cy="13" r="7" stroke="#38AD64" stroke-width="1.5" fill="none" opacity="0.5"/><path d="M16 10 L21 5" stroke="#38AD64" stroke-width="1.8" stroke-linecap="round"/><circle cx="13" cy="13" r="2.5" fill="#38AD64" opacity="0.6"/></svg>
        </td></tr></table></td>
        <td valign="top" style="padding-left:14px;">
          <p style="font-size:15px;font-weight:700;color:#ffffff;margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;">Reparación de Transductores — Nivel componente</p>
          <p style="font-size:12.5px;color:rgba(255,255,255,0.55);line-height:1.55;margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;">Recuperamos el 98% de los transductores que otros declaran irrecuperables. Diagnóstico gratuito, entrega en 48h.</p>
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(61,187,121,0.15);color:#38AD64;border:1px solid rgba(61,187,121,0.2);font-family:Arial,Helvetica,sans-serif;">GE Healthcare</span>&nbsp;
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(61,187,121,0.15);color:#38AD64;border:1px solid rgba(61,187,121,0.2);font-family:Arial,Helvetica,sans-serif;">Philips</span>&nbsp;
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(61,187,121,0.15);color:#38AD64;border:1px solid rgba(61,187,121,0.2);font-family:Arial,Helvetica,sans-serif;">Siemens</span>&nbsp;
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(61,187,121,0.15);color:#38AD64;border:1px solid rgba(61,187,121,0.2);font-family:Arial,Helvetica,sans-serif;">Mindray</span>&nbsp;
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.5);font-family:Arial,Helvetica,sans-serif;">98% tasa de éxito</span>&nbsp;
          <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(255,255,255,0.07);color:rgba(255,255,255,0.5);font-family:Arial,Helvetica,sans-serif;">Diagnóstico gratis</span>
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<tr><td style="padding:0 40px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#E8ECF5" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>

<tr><td bgcolor="#ffffff" style="padding:34px 40px;">
  <p style="font-size:10px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#4E60A9;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Soporte técnico</p>
  <p style="font-size:21px;font-weight:700;color:#0C1630;margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.02em;">Tu equipo siempre operativo.</p>
  <p style="font-size:14px;color:#617090;line-height:1.6;margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;">Un equipo de ultrasonido fuera de servicio es un diagnóstico interrumpido. Por eso ofrecemos respaldo completo.</p>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="31%" valign="top" bgcolor="#0C1630" style="border-radius:12px;padding:16px 14px;">
      <p style="font-size:13px;font-weight:700;color:#ffffff;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Mantenimiento Preventivo</p>
      <p style="font-size:11.5px;color:rgba(255,255,255,0.5);line-height:1.55;margin:0;font-family:Arial,Helvetica,sans-serif;">Planes periódicos para mantener el rendimiento y prolongar la vida útil.</p>
    </td>
    <td width="3%">&nbsp;</td>
    <td width="31%" valign="top" bgcolor="#0C1630" style="border-radius:12px;padding:16px 14px;">
      <p style="font-size:13px;font-weight:700;color:#ffffff;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Reparación Especializada</p>
      <p style="font-size:11.5px;color:rgba(255,255,255,0.5);line-height:1.55;margin:0;font-family:Arial,Helvetica,sans-serif;">Diagnóstico técnico y reparación certificada de transductores y módulos.</p>
    </td>
    <td width="3%">&nbsp;</td>
    <td width="31%" valign="top" bgcolor="#0C1630" style="border-radius:12px;padding:16px 14px;">
      <p style="font-size:13px;font-weight:700;color:#ffffff;margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;">Asesoría y Capacitación</p>
      <p style="font-size:11.5px;color:rgba(255,255,255,0.5);line-height:1.55;margin:0;font-family:Arial,Helvetica,sans-serif;">Selección del equipo ideal y entrenamiento para tu personal clínico.</p>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:0 40px;"><table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" bgcolor="#E8ECF5" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table></td></tr>

<tr><td bgcolor="#0C1630" style="padding:42px 40px;text-align:center;">
  <p style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;">¿Listo para el siguiente paso?</p>
  <p style="font-size:14px;color:rgba(255,255,255,0.55);margin:0 0 26px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">Cuéntanos qué necesitas — cotización, soporte técnico o asesoría.<br>Respondemos rápido, sin rodeos.</p>
  <a href="https://wa.me/525570075222?text=Hola%20Bionordi%2C%20me%20interesa%20conocer%20m%C3%A1s%20sobre%20sus%20equipos%20de%20ultrasonido." target="_blank" style="display:inline-block;background:#25D366;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:100px;">&#128172; Escribir por WhatsApp</a>
</td></tr>

<tr><td bgcolor="#ffffff" style="padding:24px 40px 28px;border-top:1px solid #E8EDF4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr>
    <td><img src="{{origin}}/LOGO_PRINCIPAL.png" alt="Bionordi" height="28" border="0" style="display:block;height:28px;width:auto;" /></td>
    <td align="right">
      <a href="https://www.bionordi.com" style="font-size:11px;color:#94A3B8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;" target="_blank">Sitio web</a>&nbsp;&nbsp;
      <a href="mailto:contacto@bionordi.mx" style="font-size:11px;color:#94A3B8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Email</a>&nbsp;&nbsp;
      <a href="#" style="font-size:11px;color:#94A3B8;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">Catálogo</a>
    </td>
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;"><tr><td height="1" bgcolor="#E8EDF4" style="font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="font-size:11px;color:#94A3B8;line-height:1.7;font-family:Arial,Helvetica,sans-serif;">© 2025 Bionordi Medical Technology.<br>Tecnología de ultrasonido para profesionales de la salud.</td>
    <td align="right" style="font-size:11px;color:#94A3B8;line-height:1.7;font-family:Arial,Helvetica,sans-serif;"><a href="https://www.bionordi.com" style="color:#94A3B8;text-decoration:none;" target="_blank">www.bionordi.com</a><br>+52 (55) 7007-5222<br>Ciudad de México</td>
  </tr></table>
  <p style="font-size:10.5px;color:#CBD5E1;margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;">Enviado por {{nombre_remitente}} · Bionordi S.A. de C.V. · Si no deseas recibir estos correos, ignora este mensaje.</p>
</td></tr>

<!-- Bottom accent bar -->
<tr><td height="5" style="background:linear-gradient(90deg,#4E60A9,#38AD64);font-size:1px;line-height:5px;">&nbsp;</td></tr>

</table>
</body></html>`,
    plain: (v: Vars) => `Estimado/a ${v.nombre_doctor},\n\nSomos Bionordi, proveedor especializado en tecnología de ultrasonido médico para consultorios de ${v.especialidad} en ${v.ciudad}.\n\n${v.mensaje_extra ? v.mensaje_extra + "\n\n" : ""}NUESTROS EQUIPOS:\n• Ultrasonido Portátil Mindray M9 — $320,000 MXN\n• Ultrasonido 4D Voluson — $850,000 MXN\n• Transductor Convex 3.5 MHz — $45,000 MXN\n\nREPARACIÓN DE TRANSDUCTORES:\nRecuperamos el 98% de los transductores declarados irrecuperables.\nGE Healthcare, Philips, Siemens, Mindray, Toshiba, Samsung.\nDiagnóstico gratuito · Entrega en 48h.\n\nSERVICIOS:\n• Mantenimiento Preventivo\n• Reparación Especializada\n• Asesoría y Capacitación\n\nEscríbenos por WhatsApp: https://wa.me/525570075222\n\nAtentamente,\n${v.nombre_remitente}\nBionordi — www.bionordi.com · +52 (55) 7007-5222`,
  },

  seguimiento: {
    label: "Seguimiento",
    color: "#7C3AED",
    defaultSubject: "¿Puedo resolver alguna duda? · Bionordi",
    body: `
  <tr><td style="padding:32px 40px 20px;">
    <p style="font-size:15px;font-weight:700;color:#1E293B;margin:0 0 16px;">Estimado/a {{nombre_doctor}},</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 14px;">Hace unos días le escribí sobre nuestros servicios de reparación de transductores en <strong>Bionordi</strong>. Quería hacer un breve seguimiento por si tiene alguna pregunta, o si desea una valoración sin compromiso para su equipo en <strong>{{consultorio}}</strong>.</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 20px;">Entendemos que su agenda es apretada, por eso el proceso es muy simple: usted nos envía el transductor, nosotros emitimos el diagnóstico en 24 horas y usted decide si autoriza la reparación. Sin cargos ocultos.</p>
  </td></tr>
  <tr><td style="padding:0 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F3FF;border-radius:12px;">
      <tr><td style="padding:18px 24px;font-size:13px;color:#5B21B6;line-height:1.8;">
        <strong>Tiempo de reparación:</strong> 5 a 7 días hábiles<br>
        <strong>Garantía:</strong> 6 meses por escrito<br>
        <strong>Diagnóstico:</strong> Sin cargo si autoriza la reparación
      </td></tr>
    </table>
  </td></tr>
  {{mensaje_extra}}
  <tr><td style="padding:20px 40px 28px;">
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0;">Quedo atento a cualquier consulta.<br><br>Atentamente,<br><strong style="color:#1E293B;">{{nombre_remitente}}</strong><br><span style="color:#64748B;font-size:12px;">Bionordi — Laboratorio de Transductores</span></p>
  </td></tr>`,
    plain: (v: Vars) => `Estimado/a ${v.nombre_doctor},\n\nHago seguimiento a mi mensaje anterior sobre Bionordi y reparación de transductores.\n\nEl proceso es sencillo: envía el equipo → diagnóstico en 24 h → usted decide. Sin cargos ocultos.\n\nTiempo de reparación: 5-7 días hábiles. Garantía: 6 meses.\n\n${v.mensaje_extra ? v.mensaje_extra + "\n\n" : ""}Quedo a sus órdenes.\n\nAtentamente,\n${v.nombre_remitente}\nBionordi`,
  },

  diagnostico: {
    label: "Diagnóstico gratis",
    color: "#059669",
    defaultSubject: "Diagnóstico sin costo para su transductor · Bionordi",
    body: `
  <tr><td style="padding:32px 40px 20px;">
    <p style="font-size:15px;font-weight:700;color:#1E293B;margin:0 0 16px;">Estimado/a {{nombre_doctor}},</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 20px;">Antes de tomar cualquier decisión sobre su equipo, usted necesita información técnica precisa. Por eso en <strong>Bionordi</strong> le ofrecemos un <strong>diagnóstico técnico sin costo</strong> para su transductor de ultrasonido.</p>
  </td></tr>
  <tr><td style="padding:0 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ECFDF5;border-radius:12px;border:1px solid #A7F3D0;">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:10px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;">El diagnóstico gratuito incluye</div>
        <p style="font-size:13px;color:#064E3B;margin:0 0 8px;"><span style="color:#10B981;font-weight:700;margin-right:8px;">→</span> Prueba de cristales piezoeléctricos</p>
        <p style="font-size:13px;color:#064E3B;margin:0 0 8px;"><span style="color:#10B981;font-weight:700;margin-right:8px;">→</span> Análisis de lente acústico y sellado</p>
        <p style="font-size:13px;color:#064E3B;margin:0 0 8px;"><span style="color:#10B981;font-weight:700;margin-right:8px;">→</span> Revisión de cable y conector</p>
        <p style="font-size:13px;color:#064E3B;margin:0;"><span style="color:#10B981;font-weight:700;margin-right:8px;">→</span> Reporte técnico detallado por escrito</p>
      </td></tr>
    </table>
  </td></tr>
  {{mensaje_extra}}
  <tr><td style="padding:0 40px 28px;">
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 16px;">Si decide autorizar la reparación, el costo del diagnóstico se aplica como descuento. Si prefiere no proceder, le devolvemos el equipo sin cargo alguno.</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0;">Atentamente,<br><strong style="color:#1E293B;">{{nombre_remitente}}</strong><br><span style="color:#64748B;font-size:12px;">Bionordi — Laboratorio de Transductores</span></p>
  </td></tr>`,
    plain: (v: Vars) => `Estimado/a ${v.nombre_doctor},\n\nBionordi le ofrece un diagnóstico técnico SIN COSTO para su transductor.\n\nIncluye:\n- Prueba de cristales piezoeléctricos\n- Análisis de lente acústico\n- Revisión de cable y conector\n- Reporte técnico por escrito\n\n${v.mensaje_extra ? v.mensaje_extra + "\n\n" : ""}Si autoriza la reparación, el diagnóstico se descuenta. Si no, devolvemos el equipo sin cargo.\n\nAtentamente,\n${v.nombre_remitente}\nBionordi`,
  },

  mantenimiento: {
    label: "Mantenimiento",
    color: "#D97706",
    defaultSubject: "Mantenga su equipo en condiciones óptimas · Bionordi",
    body: `
  <tr><td style="padding:32px 40px 20px;">
    <p style="font-size:15px;font-weight:700;color:#1E293B;margin:0 0 16px;">Estimado/a {{nombre_doctor}},</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 14px;">El mantenimiento preventivo de su equipo de ultrasonido no solo prolonga su vida útil, sino que garantiza la calidad de imagen necesaria para un diagnóstico preciso en <strong>{{consultorio}}</strong>.</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 20px;">En <strong>Bionordi</strong> ofrecemos un programa de mantenimiento diseñado para consultorios de <strong>{{especialidad}}</strong>:</p>
  </td></tr>
  <tr><td style="padding:0 40px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="48%" style="background:#FEF3C7;border-radius:10px;padding:16px 20px;vertical-align:top;">
          <div style="font-size:10px;font-weight:800;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Básico · Cada 6 meses</div>
          <p style="font-size:12px;color:#78350F;line-height:1.6;margin:0;">Limpieza profunda, calibración de imagen y reporte de estado del equipo.</p>
        </td>
        <td width="4%"></td>
        <td width="48%" style="background:#FEF3C7;border-radius:10px;padding:16px 20px;vertical-align:top;border:2px solid #F59E0B;">
          <div style="font-size:10px;font-weight:800;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">⭐ Completo · Anual</div>
          <p style="font-size:12px;color:#78350F;line-height:1.6;margin:0;">Revisión eléctrica, verificación de transductores, limpieza interna y garantía de 3 meses.</p>
        </td>
      </tr>
    </table>
  </td></tr>
  {{mensaje_extra}}
  <tr><td style="padding:20px 40px 28px;">
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0 0 16px;">Realizamos el servicio en su consultorio o recibimos el equipo en nuestro laboratorio, según su conveniencia.</p>
    <p style="font-size:13px;color:#475569;line-height:1.8;margin:0;">Quedo a sus órdenes.<br><br>Atentamente,<br><strong style="color:#1E293B;">{{nombre_remitente}}</strong><br><span style="color:#64748B;font-size:12px;">Bionordi — Laboratorio de Transductores</span></p>
  </td></tr>`,
    plain: (v: Vars) => `Estimado/a ${v.nombre_doctor},\n\nEl mantenimiento preventivo garantiza calidad de imagen y prolonga la vida de su equipo.\n\nBionordi ofrece:\n- Básico (cada 6 meses): limpieza, calibración, reporte\n- Completo (anual): revisión eléctrica + transductores + garantía 3 meses\n\n${v.mensaje_extra ? v.mensaje_extra + "\n\n" : ""}Servicio en su consultorio o en nuestro laboratorio.\n\nAtentamente,\n${v.nombre_remitente}\nBionordi`,
  },
} as const;

type TplKey = keyof typeof TPLS;
type Mode = TplKey | "personalizado";

// ── Página ────────────────────────────────────────────────────────────────────

export default function CorreoPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Config del remitente
  const [remitente, setRemitente] = useState("Fernando");

  // Template activo
  const [tpl, setTpl] = useState<Mode>("presentacion");

  // HTML personalizado
  const [customHtml, setCustomHtml] = useState("");

  // Variables
  const [vars, setVars] = useState<Vars>({
    nombre_doctor: "", consultorio: "", ciudad: "",
    especialidad: "", mensaje_extra: "", nombre_remitente: "",
  });

  // Destinatario
  const [toInput, setToInput]     = useState("");
  const [leadQuery, setLeadQuery] = useState("");
  const [leads, setLeads]         = useState<{ id: number; nombre: string; correo?: string; ciudad?: string; nicho?: string }[]>([]);
  const [showLeads, setShowLeads] = useState(false);

  // Asunto
  const [subject, setSubject] = useState<string>(TPLS.presentacion.defaultSubject);

  // Envío
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg]       = useState("");

  // Anti-spam tip
  const [tipDismissed, setTipDismissed] = useState(false);

  // Cargar config del remitente
  useEffect(() => {
    fetch("/api/config").then(r => r.json()).then(d => {
      const c = d.config || {};
      const name = c.smtp_from_name || c.nombre_representante || "Fernando";
      setRemitente(name);
      setVars(p => ({ ...p, nombre_remitente: name }));
    });
    fetch("/api/leads").then(r => r.json()).then(d => setLeads(d.leads || []));
  }, []);

  // Cambiar template — preservar asunto si el usuario lo modificó
  const changeTpl = (key: Mode) => {
    if (key !== "personalizado") {
      const oldDefault = tpl !== "personalizado" ? TPLS[tpl as TplKey].defaultSubject : null;
      if (subject === oldDefault || tpl === "personalizado") {
        setSubject(TPLS[key as TplKey].defaultSubject);
      }
    }
    setTpl(key);
  };

  // Generar HTML final
  const buildHTML = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (tpl === "personalizado") return customHtml || "<p style='color:#94A3B8;font-family:sans-serif;padding:40px;text-align:center;'>Pega tu HTML aquí para ver la vista previa</p>";
    const activeTpl = TPLS[tpl as TplKey];
    const v = { ...vars, nombre_remitente: vars.nombre_remitente || remitente };
    if ((activeTpl as any).standalone) {
      return applyVars(activeTpl.body, v, true).replace(/\{\{origin\}\}/g, origin);
    }
    const body = applyVars(activeTpl.body, v);
    return chrome(body, v.nombre_remitente, origin);
  }, [vars, tpl, remitente, customHtml]);

  // Preview en vivo
  useEffect(() => {
    if (!iframeRef.current) return;
    iframeRef.current.srcdoc = buildHTML();
  }, [buildHTML]);

  // Buscar lead
  const matchedLeads = leads.filter(l => {
    const q = leadQuery.toLowerCase();
    return q.length > 0 && (
      l.nombre.toLowerCase().includes(q) ||
      (l.correo || "").toLowerCase().includes(q) ||
      (l.ciudad || "").toLowerCase().includes(q)
    );
  }).slice(0, 6);

  const selectLead = (l: typeof leads[0]) => {
    setToInput(l.correo || "");
    setVars(p => ({
      ...p,
      nombre_doctor: l.nombre,
      ciudad: l.ciudad || p.ciudad,
      especialidad: l.nicho || p.especialidad,
      consultorio: p.consultorio || l.nombre,
    }));
    setLeadQuery("");
    setShowLeads(false);
  };

  const enviar = async () => {
    if (!toInput.trim() || status === "sending") return;
    setStatus("sending"); setMsg("");

    const v = { ...vars, nombre_remitente: vars.nombre_remitente || remitente };
    const html = buildHTML();
    const text = tpl === "personalizado"
      ? customHtml.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim()
      : TPLS[tpl as TplKey].plain(v);

    const res = await fetch("/api/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toInput.trim(), subject, html, text }),
    });
    const data = await res.json();
    if (data.success) {
      setStatus("ok"); setMsg(`Enviado a ${toInput}`);
      setTimeout(() => setStatus("idle"), 5000);
    } else {
      setStatus("error"); setMsg(data.error || "Error desconocido");
    }
  };

  const inp = "w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white";

  return (
    <div className="h-full flex flex-col bg-[#F4F7FB] font-sans overflow-hidden">

      {/* Header */}
      <div className="px-8 py-4 bg-white border-b border-[#E8EFF8] shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#1E293B] tracking-tight">Correo Electrónico</h1>
          <p className="text-[12px] text-[#94A3B8] font-medium mt-0.5">Redacta y envía correos HTML profesionales a tus leads</p>
        </div>
      </div>

      {/* Anti-spam tip */}
      {!tipDismissed && (
        <div className="mx-6 mt-4 shrink-0 flex items-start gap-3 px-4 py-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl text-[11px] text-[#92400E]">
          <Info size={14} className="text-[#F59E0B] shrink-0 mt-0.5" />
          <p className="flex-1 leading-relaxed">
            <strong>Para evitar la carpeta de spam:</strong> el remitente debe ser un correo del dominio <strong>@bionordi.mx</strong> (no Gmail personal) con registros <strong>SPF y DKIM</strong> configurados en tu DNS. Alternativa: usa <strong>Resend.com</strong> o <strong>SendGrid</strong> — servicios especializados en entrega de correo con excelente reputación. Estos se configuran en <strong>Configuración → SMTP</strong>.
          </p>
          <button onClick={() => setTipDismissed(true)} className="text-[#D97706] hover:text-[#92400E] shrink-0">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Body: compose + preview */}
      <div className="flex-1 flex gap-0 overflow-hidden p-5 gap-4">

        {/* ── Panel izquierdo: Redacción ─────────────────────────────────── */}
        <div className="w-[400px] shrink-0 flex flex-col gap-3 overflow-y-auto">

          {/* Templates */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Plantilla</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TPLS) as [TplKey, typeof TPLS[TplKey]][]).map(([k, t]) => (
                <button key={k} onClick={() => changeTpl(k)}
                  className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-left transition-all border ${
                    tpl === k
                      ? "text-white border-transparent shadow-sm"
                      : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                  }`}
                  style={tpl === k ? { background: t.color, borderColor: t.color } : {}}>
                  {t.label}
                </button>
              ))}
              <button onClick={() => changeTpl("personalizado")}
                className={`px-3 py-2.5 rounded-xl text-[11px] font-bold text-left transition-all border col-span-2 ${
                  tpl === "personalizado"
                    ? "text-white border-transparent shadow-sm bg-[#0F172A]"
                    : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                }`}>
                {"</>"} Mi HTML personalizado
              </button>
            </div>
          </div>

          {/* Panel HTML personalizado */}
          {tpl === "personalizado" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Tu HTML</p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Pega aquí tu HTML completo. Se enviará tal cual, sin modificar.
              </p>
              <textarea
                value={customHtml}
                onChange={e => setCustomHtml(e.target.value)}
                rows={14}
                placeholder={"<!DOCTYPE html>\n<html>...\n</html>"}
                className="w-full text-[11px] font-mono border border-gray-200 rounded-lg px-3 py-2.5 outline-none focus:border-[#4E60A9]/40 bg-[#F8FAFC] resize-none placeholder:text-gray-300"
              />
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-gray-400">{customHtml.length.toLocaleString()} caracteres</span>
                {customHtml && (
                  <button onClick={() => setCustomHtml("")}
                    className="text-[10px] text-red-400 hover:text-red-600 font-medium">
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Destinatario */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Destinatario</p>

            {/* Buscar lead */}
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={leadQuery}
                onChange={e => { setLeadQuery(e.target.value); setShowLeads(true); }}
                onFocus={() => setShowLeads(true)}
                placeholder="Buscar en CRM por nombre, ciudad..."
                className="w-full text-[12px] border border-gray-200 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-[#F8FAFC]"
              />
              {showLeads && matchedLeads.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                  {matchedLeads.map(l => (
                    <button key={l.id} onClick={() => selectLead(l)}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] border-b border-gray-50 last:border-0 transition-colors">
                      <p className="text-[12px] font-semibold text-[#1E293B]">{l.nombre}</p>
                      <p className="text-[10px] text-gray-400">{[l.correo, l.ciudad].filter(Boolean).join(" · ")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email manual */}
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Correo destino</label>
              <div className="relative">
                <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={toInput}
                  onChange={e => setToInput(e.target.value)}
                  placeholder="doctor@clinica.mx"
                  type="email"
                  className="w-full text-[12px] border border-gray-200 rounded-lg pl-8 pr-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Variables del template */}
          {tpl !== "personalizado" && <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Datos del correo</p>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Asunto</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Doctor / Nombre</label>
                <input value={vars.nombre_doctor} onChange={e => setVars(p => ({ ...p, nombre_doctor: e.target.value }))}
                  placeholder="Dr. García" className={inp} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Consultorio</label>
                <input value={vars.consultorio} onChange={e => setVars(p => ({ ...p, consultorio: e.target.value }))}
                  placeholder="Clínica Santa Fe" className={inp} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Ciudad</label>
                <input value={vars.ciudad} onChange={e => setVars(p => ({ ...p, ciudad: e.target.value }))}
                  placeholder="Monterrey" className={inp} />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Especialidad</label>
                <input value={vars.especialidad} onChange={e => setVars(p => ({ ...p, especialidad: e.target.value }))}
                  placeholder="Ginecología" className={inp} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Remitente (tú)</label>
              <input value={vars.nombre_remitente || remitente}
                onChange={e => setVars(p => ({ ...p, nombre_remitente: e.target.value }))}
                placeholder="Fernando" className={inp} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Mensaje personalizado <span className="text-gray-300 font-normal normal-case">(opcional — aparece en cursiva)</span>
              </label>
              <textarea value={vars.mensaje_extra}
                onChange={e => setVars(p => ({ ...p, mensaje_extra: e.target.value }))}
                rows={3}
                placeholder="Añade un párrafo personalizado para este destinatario..."
                className="w-full text-[12px] border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#4E60A9]/40 bg-white resize-none placeholder:text-gray-400" />
            </div>
          </div>}

          {/* Enviar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <button
              onClick={enviar}
              disabled={status === "sending" || !toInput.trim()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all ${
                status === "ok"      ? "bg-[#059669] text-white" :
                status === "error"   ? "bg-[#DC2626] text-white" :
                status === "sending" ? "bg-[#4E60A9]/70 text-white cursor-not-allowed" :
                "bg-[#4E60A9] hover:bg-[#1D4ED8] text-white disabled:opacity-40 disabled:cursor-not-allowed"
              }`}>
              {status === "sending" ? <><Activity size={14} className="animate-spin" />Enviando…</> :
               status === "ok"      ? <><Check size={14} />Enviado correctamente</> :
               status === "error"   ? <><AlertCircle size={14} />Error al enviar</> :
               <><Send size={14} />Enviar correo</>}
            </button>
            {msg && (
              <p className={`text-[11px] font-medium text-center mt-2 ${status === "ok" ? "text-[#059669]" : "text-[#DC2626]"}`}>
                {msg}
              </p>
            )}
          </div>
        </div>

        {/* ── Panel derecho: Vista previa ────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 shrink-0 flex items-center justify-between bg-[#F8FAFC]">
            <div>
              <p className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest">Vista previa</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[400px]">
                <span className="font-semibold text-gray-500">{subject}</span>
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full text-white"
              style={{ background: tpl === "personalizado" ? "#0F172A" : TPLS[tpl as TplKey].color }}>
              {tpl === "personalizado" ? "Mi HTML" : TPLS[tpl as TplKey].label}
            </span>
          </div>
          <iframe
            ref={iframeRef}
            className="flex-1 w-full border-0"
            sandbox="allow-same-origin"
            title="Vista previa del correo"
          />
        </div>

      </div>
    </div>
  );
}
