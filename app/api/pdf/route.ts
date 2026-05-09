import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import fs from 'fs';
import { execSync } from 'child_process';

const CHROME_PATHS = [
  // Linux (Railway / nixpacks chromium)
  '/run/current-system/sw/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/snap/bin/chromium',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findChrome(): string {
  // 1. Env var override (set PUPPETEER_EXECUTABLE_PATH in Railway)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    if (fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH))
      return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Try `which` to find chromium in PATH (works on nixpacks Railway)
  try {
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || true',
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 3000 }
    ).toString().trim().split('\n')[0];
    if (found && fs.existsSync(found)) return found;
  } catch { /* ignore */ }

  // 3. Known static paths
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium no encontrado. Configura PUPPETEER_EXECUTABLE_PATH en las variables de entorno de Railway.');
}

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'html requerido' }, { status: 400 });

    const executablePath = findChrome();
    console.log('[pdf] usando Chrome:', executablePath);

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
