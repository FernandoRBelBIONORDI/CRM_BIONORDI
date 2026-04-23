# Bionordi Leads — Prospección B2B Médica 🔬

Herramienta interna para prospección B2B, enriquecimiento de inteligencia artificial y gestión de ciclo de ventas de equipos médicos, todo alojado 100% en local usando Next.js y SQLite.

## 🚀 Setup en 5 Pasos (Mac o Windows) - Menos de 10 Minutos

**Paso 1:** Asegúrate de tener **Node.js** instalado (versión 18 o superior). [Descargarlo aquí](https://nodejs.org/).

**Paso 2:** Clona o abre este escritorio en tu terminal/VSCode, situándote en la carpeta `CRM_BIONORDI`.
```bash
cd ruta/a/CRM_BIONORDI
```

**Paso 3:** Instala las dependencias del proyecto.
```bash
npm install
```

**Paso 4:** Configura tus claves de API.
Crea un archivo local en la raíz del proyecto llamado `.env.local` y agrega tus credenciales:
```env
GOOGLE_PLACES_API_KEY=tu_clave_de_google_aqui
ANTHROPIC_API_KEY=tu_clave_de_claude_aqui
```

**Paso 5:** Inicializa el servidor local.
```bash
npm run dev
```

> **¡Listo!** Abre `http://localhost:3000` en tu navegador. La base de datos local SQLite (`db/bionordi.db`) se inicializará automáticamente con las tablas necesarias en el primer inicio.

---

## 🛠 Arquitectura Principal

* **Encontrar Clientes:** Motor geo-espacial que recupera datos de Google Places.
* **Envío Automático:** Sistema que integra el modelo "Problema-Agitación-Solución" para pre-generar scripts de contacto en frío hacia wa.me (evitando bloqueos de meta y APIs de pago).
* **CRM Bionordi:** Anillos cromáticos basados en la fase del cliente (desde "Contactado" hasta "En Diagnóstico" o "Cliente Activo").
* **Base de Datos Local:** SQLite. Sin Docker, sin configuraciones cloud complejas. Privacidad 100% asegurada.

## ⚠️ Notas Técnicas para Entorno Windows

Si experimentas problemas ejecutando `npm` al abrir un terminal PowerShell debido a la *Execution Policy* (Ej. `PSSecurityException`), puedes ejecutar temporalmente el servidor Next.js abriendo el **Símbolo de Sistema (cmd)** en vez de PowerShell, o corriendo:
```powershell
cmd /c npm run dev
```
