import type { DatabaseSync } from 'node:sqlite';
import type { Deliverable, ProgressLog } from '../types.ts';

interface DRow { id: string; item_id: string; kind: string; file_type: string | null; url: string; uploader: string; upload_at: string; version: number; }
interface PRow { id: string; item_id: string; operator: string; raw_text: string; ai_result: string | null; delta: number; created_at: string; }

export function listDeliverables(db: DatabaseSync, itemId: string): Deliverable[] {
  const rows = db.prepare('SELECT id, item_id, kind, file_type, url, uploader, upload_at, version FROM deliverables WHERE item_id = ? ORDER BY upload_at DESC').all(itemId) as unknown as DRow[];
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, kind: r.kind as Deliverable['kind'], fileType: r.file_type, url: r.url, uploader: r.uploader, uploadAt: r.upload_at, version: r.version }));
}

export function countDeliverables(db: DatabaseSync, itemId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM deliverables WHERE item_id = ?').get(itemId) as { c: number };
  return Number(row.c);
}

export function insertDeliverable(db: DatabaseSync, d: Deliverable): void {
  db.prepare('INSERT INTO deliverables (id, item_id, kind, file_type, url, uploader, upload_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(d.id, d.itemId, d.kind, d.fileType, d.url, d.uploader, d.uploadAt, d.version);
}

export function deleteDeliverable(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(id);
}

export function findDeliverable(db: DatabaseSync, id: string): Deliverable | null {
  const row = db.prepare('SELECT id, item_id, kind, file_type, url, uploader, upload_at, version FROM deliverables WHERE id = ?').get(id) as DRow | undefined;
  return row === undefined ? null : { id: row.id, itemId: row.item_id, kind: row.kind as Deliverable['kind'], fileType: row.file_type, url: row.url, uploader: row.uploader, uploadAt: row.upload_at, version: row.version };
}

export function insertProgressLog(db: DatabaseSync, log: ProgressLog): void {
  db.prepare('INSERT INTO progress_logs (id, item_id, operator, raw_text, ai_result, delta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(log.id, log.itemId, log.operator, log.rawText, log.aiResult, log.delta, log.createdAt);
}

export function listProgressLogs(db: DatabaseSync, itemId: string): ProgressLog[] {
  const rows = db.prepare('SELECT id, item_id, operator, raw_text, ai_result, delta, created_at FROM progress_logs WHERE item_id = ? ORDER BY created_at DESC').all(itemId) as unknown as PRow[];
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, operator: r.operator, rawText: r.raw_text, aiResult: r.ai_result, delta: r.delta, createdAt: r.created_at }));
}