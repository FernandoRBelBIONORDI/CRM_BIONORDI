import { NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';
const WA_KEY = process.env.WA_SERVER_KEY || 'bionordi2024';

export async function GET() {
  try {
    const res = await fetch(`${WA_URL}/status`, {
      headers: { apikey: WA_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ connected: false, status: 'error' });
  }
}
