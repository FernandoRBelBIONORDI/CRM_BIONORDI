import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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
  `ALTER TABLE barridos ADD COLUMN fuente TEXT DEFAULT 'google'`,
  `ALTER TABLE barridos ADD COLUMN especialidad TEXT`,
  `ALTER TABLE barridos ADD COLUMN notas TEXT`,
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

db.exec(`
  CREATE TABLE IF NOT EXISTS catalogo_equipos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo          TEXT NOT NULL DEFAULT 'transductor',
    marca         TEXT,
    modelo        TEXT NOT NULL,
    descripcion   TEXT,
    imagen_path   TEXT,
    fotos_json    TEXT,
    brochure_path TEXT,
    notas         TEXT,
    activo        INTEGER DEFAULT 1,
    fecha_alta    TEXT
  )
`);

// Migrations para columnas nuevas del catálogo y cotizaciones
for (const col of [
  `ALTER TABLE catalogo_equipos ADD COLUMN fotos_json TEXT`,
  `ALTER TABLE catalogo_equipos ADD COLUMN brochure_path TEXT`,
  `ALTER TABLE cotizaciones ADD COLUMN pdf_path TEXT`,
]) { try { db.exec(col); } catch {} }

db.exec(`
  CREATE TABLE IF NOT EXISTS cotizaciones (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    tipo        TEXT NOT NULL,
    folio       TEXT,
    monto_total REAL DEFAULT 0,
    items_json  TEXT,
    eq_tipo     TEXT,
    eq_marca    TEXT,
    eq_modelo   TEXT,
    notas       TEXT,
    status      TEXT DEFAULT 'enviada',
    fecha       TEXT DEFAULT (datetime('now','localtime'))
  )
`);

// Tablas auxiliares — creadas aquí para garantizar existencia independientemente
// de si schema.sql fue ejecutado en la inicialización original
db.exec(`
  CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS busquedas (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    nicho             TEXT,
    ciudad            TEXT,
    estado_republica  TEXT,
    municipio         TEXT,
    fecha             TEXT,
    leads_encontrados INTEGER,
    filtros_json      TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS interacciones (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id   INTEGER NOT NULL,
    tipo      TEXT,
    contenido TEXT,
    resultado TEXT,
    fecha     TEXT DEFAULT (datetime('now','localtime'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id              INTEGER REFERENCES leads(id),
    version_profesional  TEXT,
    version_directa      TEXT,
    version_problema_sol TEXT,
    fecha_generacion     TEXT,
    version_usada        TEXT,
    enviado              INTEGER DEFAULT 0,
    fecha_envio          TEXT
  )
`);

// ── Tabla de usuarios (autenticación) ────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    rol           TEXT DEFAULT 'operador',
    activo        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  )
`);

// Seed: crear admin por defecto si no existe ningún usuario
const hayUsuarios = db.prepare("SELECT COUNT(*) as c FROM usuarios").get() as { c: number };
if (hayUsuarios.c === 0) {
  const defaultHash = bcrypt.hashSync("Bionordi2025!", 10);
  db.prepare(`
    INSERT OR IGNORE INTO usuarios (nombre, email, password_hash, rol)
    VALUES (?, ?, ?, ?)
  `).run("Administrador", "admin@bionordi.mx", defaultHash, "admin");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS wa_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    wamid       TEXT UNIQUE,
    phone       TEXT NOT NULL,
    direction   TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
    body        TEXT NOT NULL,
    timestamp   INTEGER NOT NULL,
    status      TEXT DEFAULT 'sent',
    lead_id     INTEGER REFERENCES leads(id) ON DELETE SET NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )
`);
try { db.exec(`CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages(phone)`); } catch {}

export default db;
