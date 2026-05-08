import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';

/** Verifica sesión activa. Retorna la sesión o lanza una respuesta 401. */
export async function requireAuth(): Promise<{ session: any; unauth: null }>;
export async function requireAuth(): Promise<any> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { session: null, unauth: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }
  return { session, unauth: null };
}

/** Uso: const { unauth } = await requireAuth(); if (unauth) return unauth; */
