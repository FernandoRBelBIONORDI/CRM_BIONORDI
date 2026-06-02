-- Leads generados y verificados
CREATE TABLE IF NOT EXISTS leads (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre                TEXT NOT NULL,
  telefono              TEXT,
  whatsapp              TEXT,
  whatsapp_verificado   INTEGER DEFAULT 0,   -- 0=no verificado, 1=activo, 2=inactivo
  correo                TEXT,
  sitio_web             TEXT,
  sitio_activo          INTEGER DEFAULT 0,
  direccion             TEXT,
  ciudad                TEXT,
  municipio             TEXT,
  estado_republica      TEXT,
  nicho                 TEXT,
  sub_nicho             TEXT,
  tamano_estimado       TEXT,                -- consultorio / clinica_p / clinica_m / hospital
  nivel_socioeconomico  TEXT,                -- AB / C+ / C / D+
  tiene_ultrasonido     TEXT,                -- si / probable / no
  score_potencial       INTEGER,             -- 1-10
  razon_score           TEXT,
  fuente                TEXT,                -- google_places / denue / siem / manual
  confianza_fuente      TEXT,                -- alta / media / baja
  google_place_id       TEXT UNIQUE,
  status_crm            TEXT DEFAULT 'nuevo',
  notas                 TEXT,
  decisor_nombre        TEXT,
  decisor_cargo         TEXT,
  decisor_linkedin      TEXT,
  fecha_extraccion      TEXT,
  fecha_ultimo_contacto TEXT,
  fecha_ultimo_cambio   TEXT
);

-- Historial de interacciones por lead
CREATE TABLE IF NOT EXISTS interacciones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER REFERENCES leads(id),
  tipo       TEXT,    -- mensaje_wa / llamada / visita / email / nota_interna
  contenido  TEXT,
  fecha      TEXT,
  resultado  TEXT     -- sin_respuesta / respondio_positivo / respondio_negativo / cita_agendada / cierre
);

-- Scripts generados por IA por lead
CREATE TABLE IF NOT EXISTS scripts (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id                 INTEGER REFERENCES leads(id),
  version_profesional     TEXT,
  version_directa         TEXT,
  version_problema_sol    TEXT,
  fecha_generacion        TEXT,
  version_usada           TEXT,   -- cual de las 3 se usó
  enviado                 INTEGER DEFAULT 0
);

-- Búsquedas guardadas para re-ejecutar
CREATE TABLE IF NOT EXISTS busquedas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nicho              TEXT,
  ciudad             TEXT,
  estado_republica   TEXT,
  municipio          TEXT,
  fecha              TEXT,
  leads_encontrados  INTEGER,
  filtros_json       TEXT
);

-- Configuración personal del usuario
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

-- Inserts iniciales de configuración (Ignorar si ya existen)
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('nombre_representante', '');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('empresa', 'Bionordi');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('servicios', 'Reparación de transductores de ultrasonido, mantenimiento de equipo médico');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('garantia', '6 meses');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('tiempo_entrega', '5-7 días hábiles');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('ciudad_base', 'Ciudad de México');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('zonas_cobertura', 'CDMX, EDOMEX, Querétaro, Puebla');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('metodologia_venta', 'Problema-Agitación-Solución');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('dias_alerta_seguimiento', '3');
INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('dias_alerta_diagnostico', '5');

-- WaSenderAPI Tablas
CREATE TABLE IF NOT EXISTS chats_wa (
  chat_id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  unread INTEGER DEFAULT 0,
  last_message TEXT,
  last_timestamp INTEGER
);

CREATE TABLE IF NOT EXISTS mensajes_wa (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats_wa(chat_id),
  from_me INTEGER,
  text TEXT,
  timestamp INTEGER,
  status TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat ON mensajes_wa(chat_id);
