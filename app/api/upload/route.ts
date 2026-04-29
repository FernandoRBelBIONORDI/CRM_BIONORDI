import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const subfolder = (form.get('subfolder') as string) || 'equipos';
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const ALLOWED = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
    if (!ALLOWED.has(ext))
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 });

    // Límite de 20 MB
    if (file.size > 20 * 1024 * 1024)
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 20 MB)' }, { status: 400 });

    // Prevenir path traversal en subfolder
    const safeSubfolder = subfolder.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'equipos';

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeSubfolder);
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ path: `/uploads/${safeSubfolder}/${filename}`, isPdf: ext === 'pdf' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
