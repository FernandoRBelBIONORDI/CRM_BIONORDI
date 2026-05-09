import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const UPLOAD_ROOT = path.join(process.cwd(), 'db', 'uploads');

export async function GET() {
  const result: Record<string, any> = {
    cwd: process.cwd(),
    upload_root: UPLOAD_ROOT,
    db_dir_exists: false,
    uploads_dir_exists: false,
    brochures_dir_exists: false,
    write_test: null,
    write_error: null,
    db_dir_contents: [] as string[],
  };

  try {
    result.db_dir_exists = fs.existsSync(path.join(process.cwd(), 'db'));
    result.uploads_dir_exists = fs.existsSync(UPLOAD_ROOT);
    result.brochures_dir_exists = fs.existsSync(path.join(UPLOAD_ROOT, 'brochures'));

    if (result.db_dir_exists) {
      result.db_dir_contents = fs.readdirSync(path.join(process.cwd(), 'db'));
    }

    // Test write
    const testDir = path.join(UPLOAD_ROOT, 'brochures');
    fs.mkdirSync(testDir, { recursive: true });
    const testFile = path.join(testDir, '_writetest.txt');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    result.write_test = 'ok';
  } catch (e: any) {
    result.write_error = e.message;
  }

  return NextResponse.json(result);
}
