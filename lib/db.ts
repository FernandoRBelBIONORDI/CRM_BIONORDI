import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const dbFolderPath = path.join(process.cwd(), 'db');
const dbFilePath = path.join(dbFolderPath, 'bionordi.db');

if (!fs.existsSync(dbFolderPath)) {
  fs.mkdirSync(dbFolderPath, { recursive: true });
}

const db = new Database(dbFilePath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Durante el build de Next.js (31 workers en paralelo) no escribimos nada en la DB.
// Toda la inicialización ocurre en runtime, cuando solo hay un proceso.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

if (!isBuild) {
  // Tabla principal — creada directamente para no depender de schema.sql
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre                TEXT NOT NULL,
      telefono              TEXT,
      whatsapp              TEXT,
      whatsapp_verificado   INTEGER DEFAULT 0,
      correo                TEXT,
      sitio_web             TEXT,
      sitio_activo          INTEGER DEFAULT 0,
      direccion             TEXT,
      ciudad                TEXT,
      municipio             TEXT,
      estado_republica      TEXT,
      nicho                 TEXT,
      sub_nicho             TEXT,
      tamano_estimado       TEXT,
      nivel_socioeconomico  TEXT,
      tiene_ultrasonido     TEXT,
      score_potencial       INTEGER,
      razon_score           TEXT,
      fuente                TEXT,
      confianza_fuente      TEXT,
      google_place_id       TEXT UNIQUE,
      status_crm            TEXT DEFAULT 'nuevo',
      notas                 TEXT,
      decisor_nombre        TEXT,
      decisor_cargo         TEXT,
      decisor_linkedin      TEXT,
      fecha_extraccion      TEXT,
      fecha_ultimo_contacto TEXT,
      fecha_ultimo_cambio   TEXT
    )
  `);

  // Migrations — safe to re-run
  for (const sql of [
    `ALTER TABLE leads ADD COLUMN fecha_proximo_contacto TEXT`,
    `ALTER TABLE leads ADD COLUMN prioridad INTEGER DEFAULT 0`,
    `ALTER TABLE scripts ADD COLUMN enviado INTEGER DEFAULT 0`,
    `ALTER TABLE scripts ADD COLUMN version_usada TEXT`,
    `ALTER TABLE scripts ADD COLUMN fecha_envio TEXT`,
    `ALTER TABLE leads ADD COLUMN barrido_id INTEGER`,
    `ALTER TABLE barridos ADD COLUMN fuente TEXT DEFAULT 'google'`,
    `ALTER TABLE barridos ADD COLUMN especialidad TEXT`,
    `ALTER TABLE barridos ADD COLUMN notas TEXT`,
  ]) { try { db.exec(sql); } catch { /* column already exists */ } }

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

  db.exec(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

  // Seeds de configuración inicial
  for (const [clave, valor] of [
    ['nombre_representante', 'Fernando'],
    ['empresa', 'Bionordi'],
    ['servicios', 'Reparación de transductores de ultrasonido, mantenimiento de equipo médico'],
    ['garantia', '6 meses'],
    ['tiempo_entrega', '5-7 días hábiles'],
    ['ciudad_base', 'Ciudad de México'],
    ['zonas_cobertura', 'CDMX, EDOMEX, Querétaro, Puebla'],
    ['metodologia_venta', 'Problema-Agitación-Solución'],
    ['dias_alerta_seguimiento', '3'],
    ['dias_alerta_diagnostico', '5'],
  ]) {
    db.prepare(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)`).run(clave, valor);
  }

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
}

export default db;
