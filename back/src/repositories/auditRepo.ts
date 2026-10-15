import type { DatabaseSync } from 'node:sqlite';

export function insertAudit(db: DatabaseSync, entry: { id: string; operator: string; action: string; target: string; detail: string; createdAt: string }): void {
  db.prepare('INSERT INTO audit_logs (id, operator, action, target, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(entry.id, entry.operator, entry.action, entry.target, entry.detail, entry.createdAt);
}

export function listAudit(db: DatabaseSync, limit = 500): Array<{ operator: string; action: string; target: string; detail: string; createdAt: string }> {
  const rows = db.prepare('SELECT operator, action, target, detail, created_at FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit) as unknown as Array<{ operator: string; action: string; target: string; detail: string; created_at: string }>;
  return rows.map((r) => ({ operator: r.operator, action: r.action, target: r.target, detail: r.detail, createdAt: r.created_at }));
}