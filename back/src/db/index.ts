import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.ts';

export const BACK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function resolveDbFile(): string {
  return path.isAbsolute(config.dbFile) ? config.dbFile : path.resolve(BACK_ROOT, config.dbFile);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS groups (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('employee','leader','center')),
  group_id   TEXT REFERENCES groups(id),
  join_month TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS objectives (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  group_id   TEXT REFERENCES groups(id),
  owner_id   TEXT REFERENCES users(id),
  start_date TEXT NOT NULL,
  end_date   TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('进行中','已达成','已关闭')),
  is_key     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS contracts (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id),
  month      TEXT NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('draft','submitted','confirmed','rejected','rated','published')),
  submit_at  TEXT,
  check_by   TEXT,
  publish_at TEXT,
  UNIQUE (user_id, month)
);

CREATE TABLE IF NOT EXISTS contract_items (
  id               TEXT PRIMARY KEY,
  contract_id      TEXT NOT NULL REFERENCES contracts(id),
  objective_id     TEXT REFERENCES objectives(id),
  type             TEXT NOT NULL,
  priority         TEXT NOT NULL,
  title            TEXT NOT NULL,
  target_desc      TEXT NOT NULL,
  deliverable_type TEXT NOT NULL,
  deliverable_desc TEXT NOT NULL,
  weight           INTEGER NOT NULL,
  due_date         TEXT NOT NULL,
  progress         INTEGER NOT NULL DEFAULT 0,
  source           TEXT NOT NULL DEFAULT 'manual',
  checked          INTEGER NOT NULL DEFAULT 0,
  score            INTEGER,
  value_tag        TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_contract  ON contract_items (contract_id);
CREATE INDEX IF NOT EXISTS idx_items_objective ON contract_items (objective_id);

CREATE TABLE IF NOT EXISTS deliverables (
  id        TEXT PRIMARY KEY,
  item_id   TEXT NOT NULL REFERENCES contract_items(id),
  kind      TEXT NOT NULL CHECK (kind IN ('file','link')),
  file_type TEXT,
  url       TEXT NOT NULL,
  uploader  TEXT NOT NULL,
  upload_at TEXT NOT NULL,
  version   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS progress_logs (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL REFERENCES contract_items(id),
  operator   TEXT NOT NULL,
  raw_text   TEXT NOT NULL,
  ai_result  TEXT,
  delta      INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  kind            TEXT NOT NULL CHECK (kind IN ('daily','weekly')),
  period          TEXT NOT NULL,
  content_ref     TEXT NOT NULL,
  ai_summary      TEXT,
  linked_item_ids TEXT,
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS change_logs (
  id         TEXT PRIMARY KEY,
  item_id    TEXT NOT NULL,
  field      TEXT NOT NULL,
  old_value  TEXT NOT NULL,
  new_value  TEXT NOT NULL,
  reason     TEXT,
  note       TEXT,
  operator   TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_tags (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id),
  tag_name          TEXT NOT NULL,
  score             REAL NOT NULL,
  evidence_item_ids TEXT,
  updated_at        TEXT NOT NULL,
  hidden            INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id         TEXT PRIMARY KEY,
  operator   TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL
);
`;

let db: DatabaseSync | null = null;

function ensureColumn(database: DatabaseSync, table: string, column: string, ddl: string): void {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

/** 增量迁移：为已存在的数据库文件补齐 FR-10 新增列（幂等） */
function migrate(database: DatabaseSync): void {
  ensureColumn(database, 'objectives', 'is_key', 'is_key INTEGER NOT NULL DEFAULT 0');
  ensureColumn(database, 'contract_items', 'value_tag', 'value_tag TEXT');
}

export function getDb(): DatabaseSync {
  if (db !== null) return db;
  const file = resolveDbFile();
  mkdirSync(path.dirname(file), { recursive: true });
  const opened = new DatabaseSync(file);
  opened.exec('PRAGMA journal_mode = WAL;');
  opened.exec('PRAGMA foreign_keys = ON;');
  opened.exec(SCHEMA);
  migrate(opened);
  db = opened;
  return db;
}

export function closeDb(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}