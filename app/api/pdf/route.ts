import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function POST(req: Request) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'html requerido' }, { status: 400 });

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
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
