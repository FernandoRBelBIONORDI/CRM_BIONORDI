# CLAUDE.md — Instrucciones para el asistente de código

## Archivos PROTEGIDOS — NO modificar sin aprobación explícita

Los siguientes archivos están en producción y funcionan correctamente.
**No los toques a menos que el usuario lo pida explícitamente y entiendas el impacto completo.**

| Archivo | Por qué está protegido |
|---|---|
| `app/api/pdf/route.ts` | Usa `puppeteer-core` + `@sparticuz/chromium`. Esta combinación específica resuelve el problema de Chromium en Railway. Cambiar la librería o los parámetros de launch rompe la generación de PDFs en producción. |
| `app/api/pdf/orden/route.ts` | Mismo motivo. |

## Reglas generales

- Antes de modificar cualquier API route de `/api/pdf*`, verifica que el cambio no afecte la compatibilidad con Railway.
- No cambiar `puppeteer-core` por `puppeteer` — `puppeteer` full falla en Railway porque no encuentra las librerías del sistema.
- No actualizar `@sparticuz/chromium` sin probar en staging primero.
- No agregar `executablePath` manual — `chromium.executablePath()` ya lo resuelve automáticamente.
