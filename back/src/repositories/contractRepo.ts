import type { DatabaseSync } from 'node:sqlite';
import type { ChangeLog, Contract, ContractItem } from '../types.ts';

interface CRow { id: string; user_id: string; month: string; status: string; submit_at: string | null; check_by: string | null; publish_at: string | null; }
interface IRow { id: string; contract_id: string; objective_id: string | null; type: string; priority: string; title: string; target_desc: string; deliverable_type: string; deliverable_desc: string; weight: number; due_date: string; progress: number; source: string; checked: number; score: number | null; value_tag: string | null; }

function rowToContract(row: CRow): Contract {
  return { id: row.id, userId: row.user_id, month: row.month, status: row.status as Contract['status'], submitAt: row.submit_at, checkBy: row.check_by, publishAt: row.publish_at };
}
function rowToItem(row: IRow): ContractItem {
  return { id: row.id, contractId: row.contract_id, objectiveId: row.objective_id, type: row.type as ContractItem['type'], priority: row.priority as ContractItem['priority'], title: row.title, targetDesc: row.target_desc, deliverableType: row.deliverable_type, deliverableDesc: row.deliverable_desc, weight: row.weight, dueDate: row.due_date, progress: row.progress, source: row.source as ContractItem['source'], checked: row.checked, score: row.score, valueTag: row.value_tag };
}

const C = 'id, user_id, month, status, submit_at, check_by, publish_at';
const I = 'id, contract_id, objective_id, type, priority, title, target_desc, deliverable_type, deliverable_desc, weight, due_date, progress, source, checked, score, value_tag';

export function findContract(db: DatabaseSync, id: string): Contract | null {
  const row = db.prepare('SELECT ' + C + ' FROM contracts WHERE id = ?').get(id) as CRow | undefined;
  return row === undefined ? null : rowToContract(row);
}

export function findContractByUserMonth(db: DatabaseSync, userId: string, month: string): Contract | null {
  const row = db.prepare('SELECT ' + C + ' FROM contracts WHERE user_id = ? AND month = ?').get(userId, month) as CRow | undefined;
  return row === undefined ? null : rowToContract(row);
}

export function listContractsByUser(db: DatabaseSync, userId: string): Contract[] {
  const rows = db.prepare('SELECT ' + C + ' FROM contracts WHERE user_id = ? ORDER BY month DESC').all(userId) as unknown as CRow[];
  return rows.map(rowToContract);
}

export function listContractsByMonth(db: DatabaseSync, month: string, groupId: string | null): Contract[] {
  const sql = groupId === null
    ? 'SELECT c.id, c.user_id, c.month, c.status, c.submit_at, c.check_by, c.publish_at FROM contracts c JOIN users u ON u.id = c.user_id WHERE c.month = ? ORDER BY u.id'
    : 'SELECT c.id, c.user_id, c.month, c.status, c.submit_at, c.check_by, c.publish_at FROM contracts c JOIN users u ON u.id = c.user_id WHERE c.month = ? AND u.group_id = ? ORDER BY u.id';
  const rows = (groupId === null ? db.prepare(sql).all(month) : db.prepare(sql).all(month, groupId)) as unknown as CRow[];
  return rows.map(rowToContract);
}

export function insertContract(db: DatabaseSync, c: Contract): void {
  db.prepare('INSERT INTO contracts (id, user_id, month, status, submit_at, check_by, publish_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(c.id, c.userId, c.month, c.status, c.submitAt, c.checkBy, c.publishAt);
}

export function updateContractStatus(db: DatabaseSync, id: string, status: string, extra: { submitAt?: string; checkBy?: string; publishAt?: string }): void {
  db.prepare('UPDATE contracts SET status = ?, submit_at = COALESCE(?, submit_at), check_by = COALESCE(?, check_by), publish_at = COALESCE(?, publish_at) WHERE id = ?').run(status, extra.submitAt ?? null, extra.checkBy ?? null, extra.publishAt ?? null, id);
}

export function listItemsByContract(db: DatabaseSync, contractId: string): ContractItem[] {
  const rows = db.prepare('SELECT ' + I + ' FROM contract_items WHERE contract_id = ? ORDER BY weight DESC').all(contractId) as unknown as IRow[];
  return rows.map(rowToItem);
}

export function findItem(db: DatabaseSync, id: string): ContractItem | null {
  const row = db.prepare('SELECT ' + I + ' FROM contract_items WHERE id = ?').get(id) as IRow | undefined;
  return row === undefined ? null : rowToItem(row);
}

export function insertItem(db: DatabaseSync, it: ContractItem): void {
  db.prepare('INSERT INTO contract_items (' + I + ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(it.id, it.contractId, it.objectiveId, it.type, it.priority, it.title, it.targetDesc, it.deliverableType, it.deliverableDesc, it.weight, it.dueDate, it.progress, it.source, it.checked, it.score, it.valueTag);
}

export function updateItem(db: DatabaseSync, it: ContractItem): void {
  db.prepare('UPDATE contract_items SET objective_id=?, type=?, priority=?, title=?, target_desc=?, deliverable_type=?, deliverable_desc=?, weight=?, due_date=?, progress=?, source=?, checked=?, score=?, value_tag=? WHERE id=?').run(it.objectiveId, it.type, it.priority, it.title, it.targetDesc, it.deliverableType, it.deliverableDesc, it.weight, it.dueDate, it.progress, it.source, it.checked, it.score, it.valueTag, it.id);
}

export function deleteItem(db: DatabaseSync, id: string): void {
  db.prepare('DELETE FROM contract_items WHERE id = ?').run(id);
}

export function insertChangeLog(db: DatabaseSync, log: ChangeLog): void {
  db.prepare('INSERT INTO change_logs (id, item_id, field, old_value, new_value, reason, note, operator, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(log.id, log.itemId, log.field, log.oldValue, log.newValue, log.reason, log.note, log.operator, log.createdAt);
}

export function listChangeLogsByItem(db: DatabaseSync, itemId: string): ChangeLog[] {
  const rows = db.prepare('SELECT id, item_id, field, old_value, new_value, reason, note, operator, created_at FROM change_logs WHERE item_id = ? ORDER BY created_at DESC').all(itemId) as unknown as Array<{ id: string; item_id: string; field: string; old_value: string; new_value: string; reason: string | null; note: string | null; operator: string; created_at: string }>;
  return rows.map((r) => ({ id: r.id, itemId: r.item_id, field: r.field, oldValue: r.old_value, newValue: r.new_value, reason: r.reason ?? '', note: r.note ?? '', operator: r.operator, createdAt: r.created_at }));
}
