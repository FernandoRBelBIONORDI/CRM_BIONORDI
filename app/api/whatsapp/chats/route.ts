import { NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';
const WA_KEY = process.env.WA_SERVER_KEY || 'bionordi2024';

export async function GET() {
  try {
    const res = await fetch(`${WA_URL}/chats`, {
      headers: { apikey: WA_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error || 'Error' }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Servidor WhatsApp no disponible' }, { status: 503 });
  }
}
