import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const CATALOGO_SEED = [
  // ── TRANSDUCTORES ────────────────────────────────────────────────────────────
  { tipo: 'transductor', marca: 'SonoSite',  modelo: 'L38e',    descripcion: 'Transductor lineal 10-5 MHz. Ideal para partes blandas, vascular y musculoesquelético.', notas: '$17,400 MXN' },
  { tipo: 'transductor', marca: 'SonoSite',  modelo: 'P21x',    descripcion: 'Transductor phased array / sectorial 5-1 MHz. Cardiología y abdomen profundo.', notas: '$22,040 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L4s',    descripcion: 'Transductor lineal. Partes blandas, tiroides y vascular.', notas: '$34,800 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '2P-2s',   descripcion: 'Transductor phased array 2 MHz. Ecocardiografía y abdomen.', notas: '$31,320 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P4-2s',   descripcion: 'Transductor phased array 4-2 MHz. Cardiología pediátrica.', notas: '$40,600 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P4-2',    descripcion: 'Transductor phased array 4-2 MHz. Cardiología general.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'Sp5-1s',  descripcion: 'Transductor phased array 5-1 MHz. Ecocardiografía.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'P7-3s',   descripcion: 'Transductor phased array 7-3 MHz. Cardiología pediátrica avanzada.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-4P',   descripcion: 'Transductor lineal. Musculoesquelético y tejidos superficiales.', notas: '$32,480 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-5P',   descripcion: 'Transductor lineal de alta frecuencia. Vascular y partes blandas.', notas: '$32,481 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '3C-5A',   descripcion: 'Transductor convex 3-5 MHz. Abdomen general y obstetricia.', notas: '$52,200 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: '7L-4A',   descripcion: 'Transductor lineal. Accesos vasculares guiados por imagen.', notas: '$45,240 MXN' },
  { tipo: 'transductor', marca: 'Mindray',   modelo: 'L13-3',   descripcion: 'Transductor lineal de banda ancha 13-3 MHz. Alta resolución para partes blandas.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'EC3-10',  descripcion: 'Transductor endocavitario. Ginecología y urología.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'SC1-6H',  descripcion: 'Transductor convex. Abdomen y obstetricia general.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Alpinion',  modelo: 'L3-12H',  descripcion: 'Transductor lineal 3-12 MHz. Partes blandas y vascular.', notas: '$58,000 MXN' },
  { tipo: 'transductor', marca: 'Chison',    modelo: 'D3C60L',  descripcion: 'Transductor convex 3.5 MHz. Abdomen y obstetricia.', notas: '$23,200 MXN' },

  // ── EQUIPOS DE ULTRASONIDO ────────────────────────────────────────────────────
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M9',         descripcion: 'Ultrasonido portátil premium con sondas monocristal 3T. Pantalla LED 16", SSD 128GB.', notas: '$275,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'Z50',        descripcion: 'Ultrasonido de carrito de gama media. Abdomen, obstetricia y cardiología.', notas: '$195,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DC-60 Exp',  descripcion: 'Ultrasonido diagnóstico de alto desempeño con Doppler color avanzado.', notas: '$420,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DC-30',      descripcion: 'Ultrasonido de carrito compacto. General y obstetricia.', notas: '$148,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M5',         descripcion: 'Ultrasonido portátil compacto para urgencias y consultorios.', notas: '$128,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'M7',         descripcion: 'Ultrasonido portátil avanzado con Doppler color y modo M.', notas: '$168,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'MX7',        descripcion: 'Ultrasonido portátil de alta gama con inteligencia artificial.', notas: '$315,000 MXN' },
  { tipo: 'ultrasonido', marca: 'Mindray',   modelo: 'DP-50 Exp',  descripcion: 'Ultrasonido básico de carrito para consultorios generales.', notas: '$92,000 MXN' },
];

const dbFolderPath = path.join(process.cwd(), 'db');
const dbFilePath = path.join(dbFolderPath, 'bionordi.db');

let _db: Database.Database | null = null;

function initDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(dbFolderPath)) {
    fs.mkdirSync(dbFolderPath, { recursive: true });
  }

  _db = new Database(dbFilePath, { verbose: process.env.NODE_ENV === 'development' ? console.log : undefined });
  _db.pragma('busy_timeout = 30000');
  _db.pragma('journal_mode = WAL');

  _db.exec(`
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
    `ALTER TABLE leads ADD COLUMN asignado_a TEXT`,
    `ALTER TABLE interacciones ADD COLUMN usuario_id INTEGER`,
    `ALTER TABLE interacciones ADD COLUMN usuario_nombre TEXT`,
    `ALTER TABLE ordenes_trabajo ADD COLUMN cotizacion_id INTEGER`,
    `ALTER TABLE leads ADD COLUMN lat REAL`,
    `ALTER TABLE leads ADD COLUMN lng REAL`,
  ]) { try { _db.exec(sql); } catch { /* column already exists */ } }

  _db.exec(`
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

  _db.exec(`
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

  _db.exec(`
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

  _db.exec(`
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
  ]) { try { _db.exec(col); } catch {} }

  // Migración: desactivar productos retirados del inventario (ya no están en bionordi.com)
  _db.exec(`
    UPDATE catalogo_equipos SET activo = 0
    WHERE activo = 1 AND (
      tipo IN ('electrocardiografo', 'desfibrilador', 'electrocauterio', 'radiologia')
      OR (tipo = 'monitor'      AND modelo IN ('BC-30', 'Monitor Multiparamétrico'))
      OR (tipo = 'ultrasonido'  AND marca = 'GE Healthcare' AND modelo = 'Voluson 4D')
    )
  `);

  // Seed del catálogo — solo si está vacío
  const catCount = (_db.prepare("SELECT COUNT(*) as n FROM catalogo_equipos").get() as any).n;
  if (catCount === 0) {
    const insertCat = _db.prepare(`
      INSERT INTO catalogo_equipos (tipo, marca, modelo, descripcion, notas, activo, fecha_alta)
      VALUES (@tipo, @marca, @modelo, @descripcion, @notas, 1, date('now'))
    `);
    const seedCatalogo = _db.transaction(() => {
      for (const item of CATALOGO_SEED) insertCat.run(item);
    });
    seedCatalogo();
  }

  _db.exec(`
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

  _db.exec(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

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
    _db.prepare(`INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)`).run(clave, valor);
  }

  _db.exec(`
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

  _db.exec(`
    CREATE TABLE IF NOT EXISTS interacciones (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id   INTEGER NOT NULL,
      tipo      TEXT,
      contenido TEXT,
      resultado TEXT,
      fecha     TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  _db.exec(`
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

  _db.exec(`
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

  const hayUsuarios = _db.prepare("SELECT COUNT(*) as c FROM usuarios").get() as { c: number };
  if (hayUsuarios.c === 0) {
    const defaultHash = bcrypt.hashSync("Bionordi2025!", 10);
    _db.prepare(`INSERT OR IGNORE INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)`)
      .run("Administrador", "admin@bionordi.mx", defaultHash, "admin");
  }

  _db.exec(`
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
  try { _db.exec(`CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON wa_messages(phone)`); } catch {}

  return _db;
}

// Proxy lazy: la DB solo se abre en la primera consulta real, nunca al importar el módulo.
// Esto evita SQLITE_BUSY con los 31 workers del build de Next.js.
const db = new Proxy({} as Database.Database, {
  get(_, prop: string) {
    const database = initDb();
    const value = (database as any)[prop];
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export default db;
