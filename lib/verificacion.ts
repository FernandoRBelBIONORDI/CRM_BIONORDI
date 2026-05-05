export async function verifyContact(lead: {
  telefono?: string;
  correo?: string;
  sitio_web?: string;
}) {
  const result = {
    whatsapp_verificado: 0,
    sitio_activo: 0,
  };

  // 1. WhatsApp Proof of Life
  // Nota: Sin la API oficial de Meta, una forma básica es hacer parse del número.
  // Podríamos intentar un HEAD a wa.me, pero suele denegar el acceso.
  if (lead.telefono) {
    const cleanPhone = lead.telefono.replace(/\D/g, '');
    // Asumimos que si tiene 10 o 12 dígitos, es un WA válido como fallback
    if (cleanPhone.length >= 10) {
      result.whatsapp_verificado = 1;
    }
  }

  // 2. HTTP Status Check del sitio web
  if (lead.sitio_web && lead.sitio_web.length > 5) {
    try {
      let url = lead.sitio_web;
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }
      // Simple fetch test with a timeout
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
      clearTimeout(id);

      if (res.ok) {
        result.sitio_activo = 1;
      }
    } catch {
      // Ignorar errores, simplemente no está activo o bloquea bots
      result.sitio_activo = 0;
    }
  }

  return result;
}
