import { NextResponse } from 'next/server';

const WA_URL = process.env.WA_SERVER_URL || 'http://localhost:3100';
const WA_KEY = process.env.WA_SERVER_KEY || 'bionordi2024';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const number = searchParams.get('number');
  if (!number) return NextResponse.json({ error: 'number requerido' }, { status: 400 });

  try {
    const res = await fetch(`${WA_URL}/messages?number=${encodeURIComponent(number)}`, {
      headers: { apikey: WA_KEY },
      cache: 'no-store',
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.error || 'Error' }, { status: 500 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
