import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Inicializar la base de datos
const dbFolderPath = path.join(process.cwd(), 'db');
const dbFilePath = path.join(dbFolderPath, 'bionordi.db');
const schemaFilePath = path.join(dbFolderPath, 'schema.sql');

if (!fs.existsSync(dbFolderPath)) {
  fs.mkdirSync(dbFolderPath, { recursive: true });
}

// Abrir la conexión SQLite
const db = new Database(dbFilePath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
db.pragma('journal_mode = WAL'); // Mejor rendimiento para Next.js

// Aplicar esquema si la base de datos está vacía
const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='leads';").get();
if (!tableCheck) {
  if (fs.existsSync(schemaFilePath)) {
    console.log('Inicializando esquema de base de datos desde schema.sql...');
    const schema = fs.readFileSync(schemaFilePath, 'utf8');
    db.exec(schema);
    console.log('Base de datos inicializada correctamente.');
  } else {
    console.error('No se encontró el archivo schema.sql en:', schemaFilePath);
  }
}

// Migrations — safe to re-run, try/catch handles "column already exists"
const migrations = [
  `ALTER TABLE leads ADD COLUMN fecha_proximo_contacto TEXT`,
  `ALTER TABLE leads ADD COLUMN prioridad INTEGER DEFAULT 0`,
  `ALTER TABLE scripts ADD COLUMN enviado INTEGER DEFAULT 0`,
  `ALTER TABLE scripts ADD COLUMN version_usada TEXT`,
  `ALTER TABLE scripts ADD COLUMN fecha_envio TEXT`,
  `ALTER TABLE leads ADD COLUMN barrido_id INTEGER`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS ordenes_trabajo (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    folio                 TEXT NOT NULL UNIQUE,
    lead_id               INTEGER REFERENCES leads(id),
    equipo_tipo           TEXT,
    equipo_marca          TEXT,
    equipo_modelo         TEXT,
    equipo_num_serie      TEXT,
    falla_reportada       TEXT,
    diagnostico           TEXT,
    notas_tecnicas        TEXT,
    tecnico               TEXT,
    presupuesto           REAL,
    presupuesto_aprobado  INTEGER DEFAULT 0,
    precio_final          REAL,
    status                TEXT DEFAULT 'recibido',
    fecha_ingreso         TEXT,
    fecha_compromiso      TEXT,
    fecha_entrega         TEXT,
    fecha_creacion        TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS equipos_cliente (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id     INTEGER NOT NULL,
    tipo        TEXT NOT NULL,
    marca       TEXT,
    modelo      TEXT,
    num_serie   TEXT,
    estado      TEXT DEFAULT 'activo',
    notas       TEXT,
    fecha_alta  TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS barridos (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre            TEXT NOT NULL,
    nicho             TEXT,
    estado            TEXT,
    zonas_json        TEXT,
    max_por_zona      INTEGER DEFAULT 60,
    total_encontrados INTEGER DEFAULT 0,
    total_nuevos      INTEGER DEFAULT 0,
    zonas_completadas INTEGER DEFAULT 0,
    fecha             TEXT,
    completado        INTEGER DEFAULT 0
  )
`);

export default db;
