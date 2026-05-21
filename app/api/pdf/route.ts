// ⚠️  ARCHIVO PROTEGIDO — ver CLAUDE.md antes de modificar
// puppeteer-core + Chromium del sistema (nixpacks.toml) para Railway.
// NO cambiar a 'puppeteer' ni modificar los parámetros de launch.
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { existsSync, promises as fsPromises } from 'fs';
import path from 'path';

const SYSTEM_CHROMIUM_PATHS = [
  process.env.CHROMIUM_PATH,
  '/run/current-system/sw/bin/chromium',  // Railway/Nixpacks
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

async function getChromiumExecPath(): Promise<string> {
  for (const p of SYSTEM_CHROMIUM_PATHS) {
    if (p && existsSync(p)) return p;
  }
  return await chromium.executablePath(); // fallback @sparticuz
}

// Limpiador de perfiles temporales huérfanos de Chromium en /tmp para evitar llenar el disco
async function cleanOldTmpProfiles() {
  try {
    const tmpDir = '/tmp';
    if (!existsSync(tmpDir)) return;
    const files = await fsPromises.readdir(tmpDir);
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutos de antigüedad máxima para perfiles inactivos

    for (const file of files) {
      if (file.startsWith('puppeteer_dev_profile-') || file.startsWith('.org.chromium.Chromium.')) {
        const fullPath = path.join(tmpDir, file);
        try {
          const stat = await fsPromises.stat(fullPath);
          if (now - stat.mtimeMs > maxAge) {
            await fsPromises.rm(fullPath, { recursive: true, force: true });
            console.log(`[pdf] Limpiado perfil temporal huérfano: ${file}`);
          }
        } catch (e) {
          // Ignorar si el archivo ya no existe o no se puede borrar
        }
      }
    }
  } catch (err) {
    console.error('[pdf] Error al limpiar perfiles temporales:', err);
  }
}

// Cola de concurrencia simple para evitar saturar la memoria RAM del contenedor en Railway
let activeRenders = 0;
const renderQueue: (() => void)[] = [];

async function acquireQueueSlot(): Promise<void> {
  if (activeRenders < 1) {
    activeRenders++;
    return;
  }
  return new Promise<void>((resolve) => {
    renderQueue.push(resolve);
  });
}

function releaseQueueSlot(): void {
  activeRenders--;
  if (renderQueue.length > 0) {
    activeRenders++;
    const next = renderQueue.shift();
    if (next) next();
  }
}

export async function POST(req: Request) {
  // Disparar limpieza en segundo plano sin bloquear la petición actual
  cleanOldTmpProfiles().catch(() => {});

  await acquireQueueSlot();

  let browser: any = null;
  let page: any = null;

  try {
    const { html } = await req.json();
    if (!html) {
      releaseQueueSlot();
      return NextResponse.json({ error: 'html requerido' }, { status: 400 });
    }

    const executablePath = await getChromiumExecPath();
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
    });

    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      const base64 = Buffer.from(pdf).toString('base64');
      return NextResponse.json({ base64 });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          console.error('[pdf] Error cerrando página:', e);
        }
      }
      if (browser) {
        try {
          // Seguro contra cuelgues: si browser.close() tarda más de 5s, matar el proceso del OS
          const closeTimeout = setTimeout(() => {
            console.warn('[pdf] browser.close() colgado, forzando kill SIGKILL...');
            try {
              browser.process()?.kill('SIGKILL');
            } catch (err) {
              console.error('[pdf] Falló al intentar matar proceso Chromium:', err);
            }
          }, 5000);

          await browser.close();
          clearTimeout(closeTimeout);
        } catch (err) {
          console.error('[pdf] Error cerrando navegador, forzando kill:', err);
          try {
            browser.process()?.kill('SIGKILL');
          } catch (kErr) {}
        }
      }
    }
  } catch (e: any) {
    console.error('[pdf] Error en POST:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  } finally {
    releaseQueueSlot();
  }
}
