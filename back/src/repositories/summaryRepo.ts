/**
 * 团队周报快照仓储（team_summaries 表）
 * 需求依据：OVR-09（团队周报为生成时快照，不随成员后续修改自动更新）、OVR-08（导出）
 *
 * 设计补充说明：backend-design-v1.md §5 未定义该表，
 * 但 OVR-08/OVR-09 要求"导出"与"快照"语义 —— 若导出时重新调用 AI，
 * 既慢（20s）又违背快照语义，故落库保存生成结果。已在 back/README.md 记录该设计补充。
 */

import type { DatabaseSync } from 'node:sqlite';
import type { TeamSummary, TeamSummarySnapshot } from '../types.ts';

interface SummaryRow {
  week: string;
  payload: string;
  generated_at: string;
}

export function saveSummary(db: DatabaseSync, week: string, summary: TeamSummary, generatedAt: string): void {
  db.prepare(
    `INSERT INTO team_summaries (week, payload, generated_at) VALUES (?, ?, ?)
       ON CONFLICT(week) DO UPDATE SET payload = excluded.payload, generated_at = excluded.generated_at`,
  ).run(week, JSON.stringify(summary), generatedAt);
}

export function findSummary(db: DatabaseSync, week: string): TeamSummarySnapshot | null {
  const row = db
    .prepare('SELECT week, payload, generated_at FROM team_summaries WHERE week = ?')
    .get(week) as SummaryRow | undefined;
  if (row === undefined) return null;
  try {
    const summary = JSON.parse(row.payload) as TeamSummary;
    return { week: row.week, summary, generatedAt: row.generated_at };
  } catch {
    return null;
  }
}
