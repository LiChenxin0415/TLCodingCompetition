import type { DatabaseSync } from 'node:sqlite';
import type { AuthUser } from '../types.ts';
import { getDb } from '../db/index.ts';
import { forbidden } from '../utils/errors.ts';

interface ItemRow {
  item_id: string; title: string; type: string; objective_name: string | null; member_id: string; member_name: string;
  weight: number; progress: number; due_date: string; deliverable_uploaded: number; contract_status: string; score: number | null;
}

function fetchMonthItems(db: DatabaseSync, month: string, groupId: string | null): ItemRow[] {
  const sql = groupId === null
    ? `SELECT i.id AS item_id, i.title, i.type, o.name AS objective_name, c.user_id AS member_id, u.name AS member_name,
         i.weight, i.progress, i.due_date, (SELECT COUNT(*) FROM deliverables d WHERE d.item_id=i.id) AS deliverable_uploaded,
         c.status AS contract_status, i.score
       FROM contract_items i JOIN contracts c ON c.id=i.contract_id JOIN users u ON u.id=c.user_id LEFT JOIN objectives o ON o.id=i.objective_id
       WHERE c.month = ?`
    : `SELECT i.id AS item_id, i.title, i.type, o.name AS objective_name, c.user_id AS member_id, u.name AS member_name,
         i.weight, i.progress, i.due_date, (SELECT COUNT(*) FROM deliverables d WHERE d.item_id=i.id) AS deliverable_uploaded,
         c.status AS contract_status, i.score
       FROM contract_items i JOIN contracts c ON c.id=i.contract_id JOIN users u ON u.id=c.user_id LEFT JOIN objectives o ON o.id=i.objective_id
       WHERE c.month = ? AND u.group_id = ?`;
  return (groupId === null ? db.prepare(sql).all(month) : db.prepare(sql).all(month, groupId)) as unknown as ItemRow[];
}

function riskState(dueDate: string, progress: number): string {
  if (progress >= 100) return 'none';
  const today = new Date();
  const due = new Date(dueDate + 'T00:00:00');
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return '逾期';
  if (days <= 5) return '风险';
  return '正常';
}

export function metrics(user: AuthUser, month: string): Record<string, number> {
  if (user.role === 'employee') throw forbidden();
  const groupId = user.role === 'leader' ? user.groupId : null;
  const items = fetchMonthItems(getDb(), month, groupId);
  const risk = items.filter((it) => riskState(it.due_date, it.progress) !== 'none').length;
  const completed = items.filter((it) => it.progress >= 100).length;
  const contracts = new Set(items.map((it) => it.contract_status));
  const published = [...contracts].filter((s) => s === 'published').length;
  return { total: items.length, risk, completed, published };
}

export function drilldown(user: AuthUser, metric: string, month: string): Array<Record<string, unknown>> {
  if (user.role === 'employee') throw forbidden();
  const groupId = user.role === 'leader' ? user.groupId : null;
  let items = fetchMonthItems(getDb(), month, groupId);
  if (metric === 'risk') items = items.filter((it) => riskState(it.due_date, it.progress) !== 'none').sort((a, b) => (riskState(a.due_date, a.progress) === '逾期' ? -1 : 1));
  else if (metric === 'completed') items = items.filter((it) => it.progress >= 100);
  else if (metric === 'published') items = items.filter((it) => it.contract_status === 'published');
  return items.map((it) => ({
    member: it.member_name, title: it.title, type: it.type, objective: it.objective_name,
    weight: it.weight, progress: it.progress, dueDate: it.due_date, risk: riskState(it.due_date, it.progress),
    deliverableUploaded: it.deliverable_uploaded > 0, score: it.score,
  }));
}