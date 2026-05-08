export function initials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0] || "").join("").toUpperCase() || "#";
}

export function avatarColor(name: string) {
  const colors = ["#1E3A8A", "#6D28D9", "#065F46", "#92400E", "#1E40AF", "#5B21B6", "#047857", "#B45309"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

// Abre el chat interno del CRM en lugar de WhatsApp Web
export function waLink(phone?: string | null, text?: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const number = digits.startsWith("52") ? digits : `52${digits}`;
  const chatId = `${number}@s.whatsapp.net`;
  // Podrías pasar el text como parámetro adicional si el chat interno lo soporta: &text=...
  return `/chat?chatId=${encodeURIComponent(chatId)}`;
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDatetime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
