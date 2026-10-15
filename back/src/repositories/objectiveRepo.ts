import type { DatabaseSync } from 'node:sqlite';
import type { Objective } from '../types.ts';

interface Row { id: string; name: string; group_id: string | null; owner_id: string | null; start_date: string; end_date: string; status: string; is_key: number; }

function rowToObjective(row: Row): Objective {
  return { id: row.id, name: row.name, groupId: row.group_id, ownerId: row.owner_id, startDate: row.start_date, endDate: row.end_date, status: row.status, isKey: row.is_key };
}

const O = 'id, name, group_id, owner_id, start_date, end_date, status, is_key';

export function listObjectives(db: DatabaseSync): Objective[] {
  const rows = db.prepare('SELECT ' + O + ' FROM objectives ORDER BY id').all() as unknown as Row[];
  return rows.map(rowToObjective);
}

export function findObjective(db: DatabaseSync, id: string): Objective | null {
  const row = db.prepare('SELECT ' + O + ' FROM objectives WHERE id = ?').get(id) as Row | undefined;
  return row === undefined ? null : rowToObjective(row);
}

export function insertObjective(db: DatabaseSync, o: Objective): void {
  db.prepare('INSERT INTO objectives (id, name, group_id, owner_id, start_date, end_date, status, is_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(o.id, o.name, o.groupId, o.ownerId, o.startDate, o.endDate, o.status, o.isKey);
}

export function updateObjective(db: DatabaseSync, o: Objective): void {
  db.prepare('UPDATE objectives SET name = ?, group_id = ?, owner_id = ?, start_date = ?, end_date = ?, status = ?, is_key = ? WHERE id = ?').run(o.name, o.groupId, o.ownerId, o.startDate, o.endDate, o.status, o.isKey, o.id);
}

export function listItemLinksByObjective(db: DatabaseSync, objectiveId: string): Array<{ itemId: string; memberId: string; memberName: string; month: string; title: string; weight: number; progress: number; deliverableUploaded: number; }> {
  const rows = db.prepare(`
    SELECT i.id AS itemId, c.user_id AS memberId, u.name AS memberName, c.month AS month, i.title, i.weight, i.progress,
      (SELECT COUNT(*) FROM deliverables d WHERE d.item_id = i.id) AS deliverableUploaded
    FROM contract_items i
    JOIN contracts c ON c.id = i.contract_id
    JOIN users u ON u.id = c.user_id
    WHERE i.objective_id = ?
    ORDER BY c.month DESC, u.id
  `).all(objectiveId) as unknown as Array<{ itemId: string; memberId: string; memberName: string; month: string; title: string; weight: number; progress: number; deliverableUploaded: number; }>;
  return rows;
}
