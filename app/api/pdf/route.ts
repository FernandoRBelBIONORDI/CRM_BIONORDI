import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'html requerido' }, { status: 400 });

    const chromePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    let executablePath = chromePaths[0];
    for (const p of chromePaths) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(p)) { executablePath = p; break; }
      } catch {}
    }

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
