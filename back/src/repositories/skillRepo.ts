import type { DatabaseSync } from 'node:sqlite';
import type { SkillTag } from '../types.ts';

interface Row { id: string; user_id: string; tag_name: string; score: number; evidence_item_ids: string | null; updated_at: string; hidden: number; }

export function listSkillTags(db: DatabaseSync, userId: string): SkillTag[] {
  const rows = db.prepare('SELECT id, user_id, tag_name, score, evidence_item_ids, updated_at, hidden FROM skill_tags WHERE user_id = ? AND hidden = 0 ORDER BY score DESC').all(userId) as unknown as Row[];
  return rows.map((r) => ({ id: r.id, userId: r.user_id, tagName: r.tag_name, score: r.score, evidenceItemIds: r.evidence_item_ids, updatedAt: r.updated_at, hidden: r.hidden }));
}

export function upsertSkillTag(db: DatabaseSync, tag: SkillTag): void {
  db.prepare('INSERT INTO skill_tags (id, user_id, tag_name, score, evidence_item_ids, updated_at, hidden) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET score=excluded.score, evidence_item_ids=excluded.evidence_item_ids, updated_at=excluded.updated_at').run(tag.id, tag.userId, tag.tagName, tag.score, tag.evidenceItemIds, tag.updatedAt, tag.hidden);
}

export function hideSkillTag(db: DatabaseSync, id: string): void {
  db.prepare('UPDATE skill_tags SET hidden = 1 WHERE id = ?').run(id);
}