/**
 * 数据库初始化（SQLite）
 * 需求依据：6.1 数据模型与字段字典、backend-design §5 表结构
 *
 * 实现说明：使用 Node 24 内置的 node:sqlite（DatabaseSync），
 * 而不是 better-sqlite3 —— 同样是 SQLite 文件存储与同一套 SQL，
 * 但**无需任何原生编译**（比赛现场零构建风险）。见 back/README.md 与 ADR 变更记录。
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.ts';

/** back/ 目录（src/db/index.ts → ../../） */
export const BACK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function resolveDbFile(): string {
  return path.isAbsolute(config.dbFile) ? config.dbFile : path.resolve(BACK_ROOT, config.dbFile);
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('member','leader'))
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id),
  week           TEXT NOT NULL,
  week_done      TEXT NOT NULL,
  ongoing        TEXT NOT NULL,
  issues         TEXT NOT NULL,
  next_plan      TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('draft','submitted')),
  last_editor_id TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (user_id, week)
);

CREATE INDEX IF NOT EXISTS idx_reports_user_week ON weekly_reports (user_id, week);
CREATE INDEX IF NOT EXISTS idx_reports_week      ON weekly_reports (week);

-- 团队周报快照（OVR-09：生成时快照，不随成员后续修改自动更新）
CREATE TABLE IF NOT EXISTS team_summaries (
  week         TEXT PRIMARY KEY,
  payload      TEXT NOT NULL,
  generated_at TEXT NOT NULL
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db !== null) return db;

  const file = resolveDbFile();
  mkdirSync(path.dirname(file), { recursive: true });

  const opened = new DatabaseSync(file);
  opened.exec('PRAGMA journal_mode = WAL;');
  opened.exec('PRAGMA foreign_keys = ON;');
  opened.exec(SCHEMA);
  db = opened;
  return db;
}

export function closeDb(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}
