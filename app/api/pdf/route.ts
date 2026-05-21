// ⚠️  ARCHIVO PROTEGIDO — ver CLAUDE.md antes de modificar
// puppeteer-core + Chromium del sistema (nixpacks.toml) para Railway.
// NO cambiar a 'puppeteer' ni modificar los parámetros de launch.
import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { existsSync } from 'fs';

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

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'html requerido' }, { status: 400 });

    const executablePath = await getChromiumExecPath();
    const browser = await puppeteer.launch({
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
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 30000 });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      const base64 = Buffer.from(pdf).toString('base64');
      return NextResponse.json({ base64 });
    } finally {
      await browser.close();
    }
  } catch (e: any) {
    console.error('[pdf]', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
