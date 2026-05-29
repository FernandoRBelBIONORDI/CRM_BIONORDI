interface Entry { count: number; resetAt: number }

const store = new Map<string, Entry>();

// Limpia entradas expiradas cada 5 minutos para evitar memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60_000);

/**
 * Retorna true si la solicitud está permitida, false si supera el límite.
 * @param key    Identificador único (ej: "whatsapp:user@email.com")
 * @param max    Máximo de solicitudes permitidas en la ventana
 * @param windowMs Duración de la ventana en milisegundos
 */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) return false;

  entry.count++;
  return true;
}
