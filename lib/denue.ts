import fs from 'fs';
import path from 'path';
import db from '@/lib/db';

// Códigos SCIAN exactos (6 dígitos) — fuente: INEGI DENUE
// Todos los establecimientos que pueden tener equipo de ultrasonido biomédico
const SCIAN_MEDICOS = [
  // LABORATORIOS Y GABINETES DE DIAGNÓSTICO (target principal)
  '621511', // Laboratorios médicos y de diagnóstico del sector privado (ultrasonido, rayos X, resonancia)
  '621512', // Laboratorios médicos y de diagnóstico del sector público

  // CONSULTORIOS DE ESPECIALIDADES (ginecología, cardiología, radiología, oncología, urología)
  '621113', // Consultorios de medicina especializada del sector privado
  '621114', // Consultorios de medicina especializada del sector público

  // CLÍNICAS MULTI-ESPECIALIDAD
  '621115', // Clínicas de consultorios médicos del sector privado
  '621116', // Clínicas de consultorios médicos del sector público

  // CONSULTORIOS DE MEDICINA GENERAL (algunos tienen ultrasonido básico)
  '621111', // Consultorios de medicina general del sector privado
  '621112', // Consultorios de medicina general del sector público

  // CENTROS DE ATENCIÓN MÉDICA AMBULATORIA (urgencias, centros de salud con imagen)
  '621411', // Centros de atención médica ambulatoria del sector privado
  '621412', // Centros de atención médica ambulatoria del sector público

  // OTROS SERVICIOS AMBULATORIOS (centros oncológicos, rehabilitación con imagen)
  '621991', // Otros servicios de atención médica ambulatoria del sector privado
  '621992', // Otros servicios de atención médica ambulatoria del sector público

  // HOSPITALES GENERALES
  '622111', // Hospitales generales del sector privado
  '622112', // Hospitales generales del sector público

  // HOSPITALES DE ESPECIALIDADES (cardiología, oncología, materno-infantil, etc.)
  '622311', // Hospitales de otras especialidades médicas del sector privado
  '622312', // Hospitales de otras especialidades médicas del sector público

  // HOSPITALES PSIQUIÁTRICOS Y ADICCIONES (algunos tienen ultrasonido para revisiones físicas)
  '622211', // Hospitales psiquiátricos y tratamiento por adicciones del sector privado
  '622212', // Hospitales psiquiátricos del sector público

  // RESIDENCIAS Y ASILOS CON ATENCIÓN MÉDICA (algunos tienen convenios con gabinetes)
  '623111', // Asilos y residencias para ancianos del sector privado
  '623112', // Asilos y residencias para ancianos del sector público
];

function ensureDenueTable() {
  db?.exec(`
    CREATE TABLE IF NOT EXISTS denue_leads (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nom_estab   TEXT,
      cod_act     TEXT,
      nombre_act  TEXT,
      per_ocu     TEXT,
      telefono    TEXT,
      e_mail      TEXT,
      www         TEXT,
      municipio   TEXT,
      entidad     TEXT,
      localidad   TEXT,
      latitud     REAL,
      longitud    REAL,
      importado   TEXT
    )
  `);
}

export function isDENUEImported(): boolean {
  ensureDenueTable();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM denue_leads').get() as any;
  return row.cnt > 0;
}

export function importDENUECSV(csvPath: string): number {
  ensureDenueTable();
  if (!fs.existsSync(csvPath)) return 0;

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  if (lines.length < 2) return 0;

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/^"|"$/g,''));
  const idxNom    = headers.indexOf('nom_estab');
  const idxCod    = headers.indexOf('codigo_act') >= 0 ? headers.indexOf('codigo_act') : headers.indexOf('cod_act');
  const idxNomAct = headers.indexOf('nombre_act');
  const idxPerOcu = headers.indexOf('per_ocu');
  const idxTel    = headers.indexOf('telefono');
  const idxEmail  = headers.indexOf('correoelec') >= 0 ? headers.indexOf('correoelec') : headers.indexOf('e_mail');
  const idxWww    = headers.indexOf('www');
  const idxMun    = headers.indexOf('municipio');
  const idxEnt    = headers.indexOf('entidad');
  const idxLoc    = headers.indexOf('localidad');
  const idxLat    = headers.indexOf('latitud');
  const idxLon    = headers.indexOf('longitud');

  const stmt = db.prepare(`
    INSERT INTO denue_leads (nom_estab, cod_act, nombre_act, per_ocu, telefono, e_mail, www, municipio, entidad, localidad, latitud, longitud, importado)
    VALUES (@nom_estab, @cod_act, @nombre_act, @per_ocu, @telefono, @e_mail, @www, @municipio, @entidad, @localidad, @latitud, @longitud, @importado)
  `);

  const today = new Date().toISOString();
  let count = 0;

  const insertMany = db.transaction((rows: any[]) => {
    for (const row of rows) {
      stmt.run(row);
      count++;
    }
  });

  const batch: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) continue;
    const codAct = cols[idxCod] || '';
    if (!SCIAN_MEDICOS.some(s => codAct.startsWith(s))) continue;

    batch.push({
      nom_estab: cols[idxNom] || '',
      cod_act:   codAct,
      nombre_act: idxNomAct >= 0 ? cols[idxNomAct] || '' : '',
      per_ocu:   idxPerOcu >= 0 ? cols[idxPerOcu] || '' : '',
      telefono:  idxTel >= 0 ? cols[idxTel] || '' : '',
      e_mail:    idxEmail >= 0 ? cols[idxEmail] || '' : '',
      www:       idxWww >= 0 ? cols[idxWww] || '' : '',
      municipio: idxMun >= 0 ? cols[idxMun] || '' : '',
      entidad:   idxEnt >= 0 ? cols[idxEnt] || '' : '',
      localidad: idxLoc >= 0 ? cols[idxLoc] || '' : '',
      latitud:   idxLat >= 0 ? parseFloat(cols[idxLat]) || null : null,
      longitud:  idxLon >= 0 ? parseFloat(cols[idxLon]) || null : null,
      importado: today,
    });

    if (batch.length >= 500) {
      insertMany(batch.splice(0, 500));
    }
  }
  if (batch.length > 0) insertMany(batch);

  return count;
}

export interface DenueLead {
  nom_estab: string;
  cod_act: string;
  nombre_act: string;
  telefono: string;
  e_mail: string;
  www: string;
  municipio: string;
  entidad: string;
  latitud: number | null;
  longitud: number | null;
}

export function searchDENUE(ciudad: string, nicho?: string, limit = 60): DenueLead[] {
  ensureDenueTable();
  const ciudadNorm = ciudad.toLowerCase();
  // Priorizar: con teléfono, con email, luego por tamaño de personal ocupado
  const rows = db.prepare(`
    SELECT * FROM denue_leads
    WHERE LOWER(municipio) LIKE ? OR LOWER(entidad) LIKE ? OR LOWER(localidad) LIKE ?
    ORDER BY
      CASE WHEN telefono IS NOT NULL AND telefono != '' THEN 0 ELSE 1 END,
      CASE WHEN e_mail IS NOT NULL AND e_mail != '' THEN 0 ELSE 1 END,
      CAST(per_ocu AS INTEGER) DESC
    LIMIT ?
  `).all(`%${ciudadNorm}%`, `%${ciudadNorm}%`, `%${ciudadNorm}%`, limit) as DenueLead[];
  return rows;
}

// Jaccard similarity para cruzar nombres de empresas
export function nombreSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().replace(/[^a-záéíóúüñ0-9 ]/gi, '').split(/\s+/).filter(t => t.length > 2));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach(t => { if (setB.has(t)) intersection++; });
  return intersection / (setA.size + setB.size - intersection);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}
