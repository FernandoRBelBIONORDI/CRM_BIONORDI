import { NextResponse } from 'next/server';
import fs from 'fs';
import { execSync } from 'child_process';

const CHROME_PATHS = [
  '/run/current-system/sw/bin/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

export async function GET() {
  const results: Record<string, any> = {
    env_PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || null,
    platform: process.platform,
    static_paths: {} as Record<string, boolean>,
    which_result: null as string | null,
    which_error: null as string | null,
  };

  for (const p of CHROME_PATHS) {
    results.static_paths[p] = fs.existsSync(p);
  }

  try {
    const found = execSync(
      'which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || echo "NOT_FOUND"',
      { stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000 }
    ).toString().trim();
    results.which_result = found;
  } catch (e: any) {
    results.which_error = e.message;
  }

  return NextResponse.json(results);
}
