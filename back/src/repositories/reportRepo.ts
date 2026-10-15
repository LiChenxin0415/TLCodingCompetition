import type { DatabaseSync } from 'node:sqlite';
import type { Report } from '../types.ts';

interface Row { id: string; user_id: string; kind: string; period: string; content_ref: string; ai_summary: string | null; linked_item_ids: string | null; version: number; }

export function listReportsByUser(db: DatabaseSync, userId: string): Report[] {
  const rows = db.prepare('SELECT id, user_id, kind, period, content_ref, ai_summary, linked_item_ids, version FROM reports WHERE user_id = ? ORDER BY period DESC').all(userId) as unknown as Row[];
  return rows.map((r) => ({ id: r.id, userId: r.user_id, kind: r.kind as Report['kind'], period: r.period, contentRef: r.content_ref, aiSummary: r.ai_summary, linkedItemIds: r.linked_item_ids, version: r.version }));
}

export function findReport(db: DatabaseSync, id: string): Report | null {
  const row = db.prepare('SELECT id, user_id, kind, period, content_ref, ai_summary, linked_item_ids, version FROM reports WHERE id = ?').get(id) as Row | undefined;
  return row === undefined ? null : { id: row.id, userId: row.user_id, kind: row.kind as Report['kind'], period: row.period, contentRef: row.content_ref, aiSummary: row.ai_summary, linkedItemIds: row.linked_item_ids, version: row.version };
}

export function insertReport(db: DatabaseSync, r: Report): void {
  db.prepare('INSERT INTO reports (id, user_id, kind, period, content_ref, ai_summary, linked_item_ids, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.userId, r.kind, r.period, r.contentRef, r.aiSummary, r.linkedItemIds, r.version);
}

export function updateReport(db: DatabaseSync, r: Report): void {
  db.prepare('UPDATE reports SET content_ref=?, ai_summary=?, linked_item_ids=?, version=? WHERE id=?').run(r.contentRef, r.aiSummary, r.linkedItemIds, r.version, r.id);
}