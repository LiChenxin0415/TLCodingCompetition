/**
 * 周报仓储（weekly_reports 表）
 * 需求依据：6.1 WeeklyReport、(userId, week) 唯一（REP-03）、backend-design §5.2
 *
 * 说明：四字段以 JSON 文本落库（SQLite 无原生数组类型），读写层在本模块内序列化/反序列化。
 */

import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ReportFields, ReportStatus, WeeklyReport } from '../types.ts';

interface ReportRow {
  id: string;
  user_id: string;
  week: string;
  week_done: string;
  ongoing: string;
  issues: string;
  next_plan: string;
  status: ReportStatus;
  last_editor_id: string;
  updated_at: string;
}

const COLUMNS = `id, user_id, week, week_done, ongoing, issues, next_plan, status, last_editor_id, updated_at`;

function parseArray(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rowToReport(row: ReportRow): WeeklyReport {
  return {
    id: row.id,
    userId: row.user_id,
    week: row.week,
    weekDone: parseArray(row.week_done),
    ongoing: parseArray(row.ongoing),
    issues: parseArray(row.issues),
    nextPlan: parseArray(row.next_plan),
    status: row.status,
    lastEditorId: row.last_editor_id,
    updatedAt: row.updated_at,
  };
}

export function newReportId(): string {
  return `rpt_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export function findByUserAndWeek(db: DatabaseSync, userId: string, week: string): WeeklyReport | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM weekly_reports WHERE user_id = ? AND week = ?`)
    .get(userId, week) as ReportRow | undefined;
  return row === undefined ? null : rowToReport(row);
}

export function findById(db: DatabaseSync, id: string): WeeklyReport | null {
  const row = db.prepare(`SELECT ${COLUMNS} FROM weekly_reports WHERE id = ?`).get(id) as ReportRow | undefined;
  return row === undefined ? null : rowToReport(row);
}

/** 某人全部周报，按周次倒序（需求 4.4 列表） */
export function listByUser(db: DatabaseSync, userId: string): WeeklyReport[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM weekly_reports WHERE user_id = ? ORDER BY week DESC`)
    .all(userId) as unknown as ReportRow[];
  return rows.map(rowToReport);
}

/** 某周全部周报（团队总览 / AI 汇总数据源） */
export function listByWeek(db: DatabaseSync, week: string): WeeklyReport[] {
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM weekly_reports WHERE week = ? ORDER BY user_id ASC`)
    .all(week) as unknown as ReportRow[];
  return rows.map(rowToReport);
}

export function countByWeek(db: DatabaseSync, week: string): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM weekly_reports WHERE week = ?').get(week) as { c: number };
  return Number(row.c);
}

export interface SaveReportInput extends ReportFields {
  id: string;
  userId: string;
  week: string;
  status: ReportStatus;
  lastEditorId: string;
  updatedAt: string;
}

export function insertReport(db: DatabaseSync, input: SaveReportInput): void {
  db.prepare(
    `INSERT INTO weekly_reports
       (id, user_id, week, week_done, ongoing, issues, next_plan, status, last_editor_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.userId,
    input.week,
    JSON.stringify(input.weekDone),
    JSON.stringify(input.ongoing),
    JSON.stringify(input.issues),
    JSON.stringify(input.nextPlan),
    input.status,
    input.lastEditorId,
    input.updatedAt,
  );
}

/** 全字段覆盖更新（LEAD-04：最后写入优先，不做行锁） */
export function updateReport(db: DatabaseSync, id: string, input: SaveReportInput): void {
  db.prepare(
    `UPDATE weekly_reports
        SET week_done = ?, ongoing = ?, issues = ?, next_plan = ?,
            status = ?, last_editor_id = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    JSON.stringify(input.weekDone),
    JSON.stringify(input.ongoing),
    JSON.stringify(input.issues),
    JSON.stringify(input.nextPlan),
    input.status,
    input.lastEditorId,
    input.updatedAt,
    id,
  );
}
