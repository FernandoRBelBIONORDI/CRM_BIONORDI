import { NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';
const WA_KEY = process.env.WA_SERVER_KEY || 'bionordi2024';

export async function POST(req: Request) {
  try {
    const { number, message } = await req.json();
    if (!number || !message) return NextResponse.json({ error: 'number y message requeridos' }, { status: 400 });

    const res = await fetch(`${WA_URL}/send`, {
      method: 'POST',
      headers: { apikey: WA_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number, message }),
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error || 'Error al enviar' }, { status: 500 });
    return NextResponse.json({ ok: true, messageId: data.messageId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
