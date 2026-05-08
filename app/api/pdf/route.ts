import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import fs from 'fs';

const CHROME_PATHS = [
  // Linux (Railway / nixpacks chromium)
  '/run/current-system/sw/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findChrome(): string {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Chrome/Chromium no encontrado. Instala Chrome o Chromium.');
}

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'html requerido' }, { status: 400 });

    const executablePath = findChrome();

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

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
