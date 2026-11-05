/**
 * Migraciones versionadas. `user_version` de SQLite guarda la versión
 * aplicada; la aplicación la administra, SQLite no ejecuta nada por sí sola.
 *
 * Reglas del modelo (docs/especificacion/02 §9–10):
 * - Una configuración es inmutable una vez asociada con registros.
 * - Unicidad: dispositivo + capture_id externo; captura + sequence;
 *   configuración + código de posición; registro + canal.
 * - Una muestra solo referencia un canal de la configuración de su captura
 *   (trigger `sample_channel_matches_configuration`).
 * - status/raw_value coherentes: ok ⇒ entero; read_error ⇒ NULL.
 */

export interface Migration {
  readonly version: number;
  readonly description: string;
  readonly sql: string;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "Esquema inicial: usuario, dispositivo, configuración, canal, sesión, captura, registro, muestra, evento, diagnóstico",
    sql: `
CREATE TABLE user (
  id          TEXT PRIMARY KEY,
  remote_id   TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE device (
  id          TEXT PRIMARY KEY,
  model       TEXT,
  firmware    TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE configuration (
  id               TEXT PRIMARY KEY,
  device_id        TEXT NOT NULL REFERENCES device(id),
  source           TEXT NOT NULL CHECK (source IN ('simulated','physical')),
  raw_min          INTEGER NOT NULL,
  raw_max          INTEGER NOT NULL,
  resolution_bits  INTEGER NOT NULL,
  description      TEXT,
  created_at       TEXT NOT NULL,
  CHECK (raw_min < raw_max)
);

CREATE TABLE channel (
  installation_id   TEXT PRIMARY KEY,
  configuration_id  TEXT NOT NULL REFERENCES configuration(id),
  code              TEXT NOT NULL,
  foot              TEXT NOT NULL CHECK (foot IN ('left','right')),
  zone              TEXT NOT NULL,
  model             TEXT NOT NULL,
  unit              TEXT NOT NULL,
  UNIQUE (configuration_id, code)
);

CREATE TABLE session (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id),
  activity     TEXT NOT NULL,
  context      TEXT,
  source       TEXT NOT NULL CHECK (source IN ('simulated','physical')),
  state        TEXT NOT NULL CHECK (state IN ('prepared','recording','interrupted','finalizing','completed','incomplete')),
  started_at   TEXT NOT NULL,
  ended_at     TEXT,
  duration_ms  INTEGER,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE capture (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id           TEXT NOT NULL REFERENCES session(id),
  device_id            TEXT NOT NULL REFERENCES device(id),
  configuration_id     TEXT NOT NULL REFERENCES configuration(id),
  external_capture_id  TEXT NOT NULL,
  source               TEXT NOT NULL CHECK (source IN ('simulated','physical')),
  started_at           TEXT NOT NULL,
  UNIQUE (device_id, external_capture_id)
);
CREATE INDEX capture_session_idx ON capture(session_id);

CREATE TABLE record (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id      INTEGER NOT NULL REFERENCES capture(id),
  sequence        INTEGER NOT NULL CHECK (sequence >= 0),
  format_version  TEXT NOT NULL,
  received_at     TEXT NOT NULL,
  UNIQUE (capture_id, sequence)
);

CREATE TABLE sample (
  record_id                INTEGER NOT NULL REFERENCES record(id) ON DELETE CASCADE,
  channel_installation_id  TEXT NOT NULL REFERENCES channel(installation_id),
  channel_code             TEXT NOT NULL,
  time_us                  INTEGER NOT NULL CHECK (time_us >= 0),
  raw_value                INTEGER,
  unit                     TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN ('ok','read_error')),
  PRIMARY KEY (record_id, channel_code),
  CHECK ((status = 'ok' AND raw_value IS NOT NULL) OR (status = 'read_error' AND raw_value IS NULL))
) WITHOUT ROWID;
CREATE INDEX sample_channel_idx ON sample(channel_installation_id, record_id);

CREATE TRIGGER sample_channel_matches_configuration
BEFORE INSERT ON sample
BEGIN
  SELECT RAISE(ABORT, 'el canal no pertenece a la configuración de la captura')
  WHERE NOT EXISTS (
    SELECT 1
    FROM record r
    JOIN capture c ON c.id = r.capture_id
    JOIN channel ch ON ch.installation_id = NEW.channel_installation_id
    WHERE r.id = NEW.record_id
      AND ch.configuration_id = c.configuration_id
      AND ch.code = NEW.channel_code
  );
END;

CREATE TABLE event (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL REFERENCES session(id),
  capture_id   INTEGER REFERENCES capture(id),
  type         TEXT NOT NULL,
  at_us        INTEGER,
  received_at  TEXT NOT NULL,
  detail       TEXT
);
CREATE INDEX event_session_idx ON event(session_id, id);

CREATE TABLE diagnostic (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL REFERENCES session(id),
  received_at  TEXT NOT NULL,
  reason       TEXT NOT NULL,
  payload      TEXT NOT NULL
);
CREATE INDEX diagnostic_session_idx ON diagnostic(session_id, id);
`,
  },
  {
    version: 2,
    description: "Resultados: métricas descriptivas por canal y captura, con versión de algoritmo y cantidades",
    sql: `
CREATE TABLE result (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  capture_id             INTEGER NOT NULL REFERENCES capture(id),
  channel_code           TEXT NOT NULL,
  metric_version         TEXT NOT NULL,
  unit                   TEXT NOT NULL,
  n_received             INTEGER NOT NULL CHECK (n_received >= 0),
  n_valid                INTEGER NOT NULL CHECK (n_valid >= 0 AND n_valid <= n_received),
  n_invalid              INTEGER NOT NULL CHECK (n_invalid = n_received - n_valid),
  sample_mean            REAL,
  sample_max             REAL,
  sample_sd_population   REAL,
  calibration_id         TEXT,
  computed_at            TEXT NOT NULL,
  UNIQUE (capture_id, channel_code, metric_version),
  CHECK ((n_valid > 0 AND sample_mean IS NOT NULL AND sample_max IS NOT NULL AND sample_sd_population IS NOT NULL)
      OR (n_valid = 0 AND sample_mean IS NULL AND sample_max IS NULL AND sample_sd_population IS NULL))
);
CREATE INDEX result_capture_idx ON result(capture_id);
`,
  },
  {
    version: 3,
    description: "Complemento remoto: correo del usuario vinculado y estado de sincronización por sesión",
    sql: `
ALTER TABLE user ADD COLUMN email TEXT;
CREATE UNIQUE INDEX user_remote_idx ON user(remote_id) WHERE remote_id IS NOT NULL;

CREATE TABLE sync_state (
  session_id       TEXT PRIMARY KEY REFERENCES session(id),
  owner_remote_id  TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('pending','confirmed','failed')),
  attempts         INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  remote_counts    TEXT,
  last_error       TEXT,
  confirmed_at     TEXT,
  updated_at       TEXT NOT NULL,
  CHECK (status <> 'confirmed' OR (confirmed_at IS NOT NULL AND remote_counts IS NOT NULL))
);
`,
  },
  {
    version: 4,
    description: "Asistente explicativo (ADR 0012): registro local de cada intercambio con el modelo, para la evidencia; no se sincroniza",
    sql: `
CREATE TABLE assistant_exchange (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES user(id),
  session_id      TEXT REFERENCES session(id),
  asked_at        TEXT NOT NULL,
  question        TEXT NOT NULL,
  scope           TEXT NOT NULL CHECK (scope IN ('in_scope','out_of_scope_clinical','out_of_scope_other')),
  context_chars   INTEGER NOT NULL CHECK (context_chars >= 0),
  context_summary TEXT NOT NULL,
  server_url      TEXT,
  model           TEXT,
  answer          TEXT,
  error           TEXT,
  elapsed_ms      INTEGER,
  CHECK ((answer IS NOT NULL) OR (error IS NOT NULL))
);
CREATE INDEX assistant_exchange_user_idx ON assistant_exchange(user_id, asked_at DESC);
`,
  },
  {
    version: 5,
    description: "Asistente (ADR 0012, 4/11): modo con el que se respondió cada intercambio — 'cloud' (función gestionada con la clave en el backend) o 'local' (servidor propio, LM Studio)",
    sql: `
ALTER TABLE assistant_exchange ADD COLUMN mode TEXT NOT NULL DEFAULT 'local' CHECK (mode IN ('cloud','local'));
`,
  },
  {
    version: 6,
    description: "Rutinas y entrenamiento (ADR 0013, etapa 15): rutinas con ejercicios objetivo, entrenamientos con entradas declaradas por serie y vínculo sesión↔entrenamiento; lo declarado nunca se mezcla con lo medido",
    sql: `
CREATE TABLE routine (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES user(id),
  name              TEXT NOT NULL,
  goal              TEXT,
  origin            TEXT NOT NULL CHECK (origin IN ('own','professional')),
  professional_note TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  archived          INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1))
);
CREATE INDEX routine_user_idx ON routine(user_id, archived, updated_at DESC);

CREATE TABLE routine_item (
  id            TEXT PRIMARY KEY,
  routine_id    TEXT NOT NULL REFERENCES routine(id) ON DELETE CASCADE,
  item_order    INTEGER NOT NULL CHECK (item_order >= 0),
  kind          TEXT NOT NULL CHECK (kind IN ('strength','walk_run','other')),
  name          TEXT NOT NULL,
  target        TEXT NOT NULL,
  instructions  TEXT,
  rest_sec      INTEGER CHECK (rest_sec IS NULL OR rest_sec >= 0)
);
CREATE INDEX routine_item_routine_idx ON routine_item(routine_id, item_order);

CREATE TABLE workout (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id),
  routine_id  TEXT REFERENCES routine(id),
  date        TEXT NOT NULL,
  started_at  TEXT,
  ended_at    TEXT,
  state       TEXT NOT NULL CHECK (state IN ('planned','in_progress','completed')),
  notes       TEXT
);
CREATE INDEX workout_user_date_idx ON workout(user_id, date DESC);

CREATE TABLE workout_entry (
  id              TEXT PRIMARY KEY,
  workout_id      TEXT NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
  item_id         TEXT REFERENCES routine_item(id) ON DELETE SET NULL,
  item_name       TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('strength','walk_run','other')),
  set_index       INTEGER CHECK (set_index IS NULL OR set_index >= 1),
  reps            INTEGER CHECK (reps IS NULL OR reps >= 0),
  weight_kg       REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  duration_s      INTEGER CHECK (duration_s IS NULL OR duration_s >= 0),
  distance_m      REAL CHECK (distance_m IS NULL OR distance_m >= 0),
  rpe             INTEGER CHECK (rpe IS NULL OR (rpe BETWEEN 1 AND 10)),
  discomfort_note TEXT,
  notes           TEXT,
  recorded_at     TEXT NOT NULL
);
CREATE INDEX workout_entry_workout_idx ON workout_entry(workout_id, recorded_at);

CREATE TABLE session_link (
  session_id  TEXT PRIMARY KEY REFERENCES session(id),
  workout_id  TEXT NOT NULL REFERENCES workout(id) ON DELETE CASCADE,
  entry_id    TEXT REFERENCES workout_entry(id) ON DELETE SET NULL
);
CREATE INDEX session_link_workout_idx ON session_link(workout_id);
`,
  },
  {
    version: 7,
    description: "Actividad unificada (ADR 0013, ajuste 4/11): cada serie declarada puede guardar la sesión de plantillas durante la que se hizo (session_id), además del vínculo sesión↔entrenamiento",
    sql: `
ALTER TABLE workout_entry ADD COLUMN session_id TEXT REFERENCES session(id) ON DELETE SET NULL;
CREATE INDEX workout_entry_session_idx ON workout_entry(session_id);
`,
  },
  {
    version: 8,
    description: "Tipo de rutina opcional (pulido 4/11): routine.category y workout.category (copiado al iniciar, para filtrar el historial aunque la rutina cambie o el entrenamiento se restaure sin ella)",
    sql: `
ALTER TABLE routine ADD COLUMN category TEXT;
ALTER TABLE workout ADD COLUMN category TEXT;
`,
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;
