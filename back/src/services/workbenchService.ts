import type { DatabaseSync } from 'node:sqlite';
import type { AuthUser } from '../types.ts';
import { getDb } from '../db/index.ts';
import { forbidden } from '../utils/errors.ts';
import { objectiveProgress } from '../utils/algorithms.ts';

// FR-10 部门工作台（纯规则聚合，无 AI）
// S1 价值标签 / S2 驾驶舱 / S4 趋势 / S5 人效 / S6 风险汇聚 / S7 大目标总览 / S3 总结报告

const VALUE_TAGS = ['降本增效', '风险防控', '质量提升', '创新探索', '合规保障', '支撑保障'];
const UNCLASSIFIED = '未分类';

interface MonthItem {
  item_id: string;
  title: string;
  type: string;
  objective_id: string | null;
  objective_name: string | null;
  member_id: string;
  member_name: string;
  weight: number;
  progress: number;
  due_date: string;
  value_tag: string | null;
  score: number | null;
}

function scopeGroup(user: AuthUser): string | null {
  if (user.role === 'center') return null;
  if (user.role === 'leader') return user.groupId;
  throw forbidden();
}

function fetchMonthItems(db: DatabaseSync, month: string, groupId: string | null): MonthItem[] {
  const sql = groupId === null
    ? `SELECT i.id AS item_id, i.title, i.type, i.objective_id, o.name AS objective_name, c.user_id AS member_id, u.name AS member_name,
         i.weight, i.progress, i.due_date, i.value_tag, i.score
       FROM contract_items i JOIN contracts c ON c.id=i.contract_id JOIN users u ON u.id=c.user_id LEFT JOIN objectives o ON o.id=i.objective_id
       WHERE c.month = ?`
    : `SELECT i.id AS item_id, i.title, i.type, i.objective_id, o.name AS objective_name, c.user_id AS member_id, u.name AS member_name,
         i.weight, i.progress, i.due_date, i.value_tag, i.score
       FROM contract_items i JOIN contracts c ON c.id=i.contract_id JOIN users u ON u.id=c.user_id LEFT JOIN objectives o ON o.id=i.objective_id
       WHERE c.month = ? AND u.group_id = ?`;
  return (groupId === null ? db.prepare(sql).all(month) : db.prepare(sql).all(month, groupId)) as unknown as MonthItem[];
}

function riskState(dueDate: string, progress: number): string {
  if (progress >= 100) return '正常';
  const today = new Date();
  const due = new Date(dueDate + 'T00:00:00');
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return '逾期';
  if (days <= 5) return '风险';
  return '正常';
}

function daysLeft(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate + 'T00:00:00');
  return Math.ceil((due.getTime() - today.getTime()) / 86400000);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

function normalizeTag(tag: string | null): string {
  return tag !== null && VALUE_TAGS.includes(tag) ? tag : UNCLASSIFIED;
}

function employeeCount(db: DatabaseSync, groupId: string | null): number {
  const sql = groupId === null ? `SELECT COUNT(*) AS n FROM users WHERE role = 'employee'` : `SELECT COUNT(*) AS n FROM users WHERE role = 'employee' AND group_id = ?`;
  const row = (groupId === null ? db.prepare(sql).get() : db.prepare(sql).get(groupId)) as { n: number };
  return row.n;
}

function monthlyAggregate(db: DatabaseSync, month: string, groupId: string | null): { total: number; completionRate: number; risk: number; avgLoad: number } {
  const items = fetchMonthItems(db, month, groupId);
  const total = items.length;
  const completed = items.filter((it) => it.progress >= 100).length;
  const risk = items.filter((it) => riskState(it.due_date, it.progress) !== '正常').length;
  const emp = employeeCount(db, groupId);
  const active = items.filter((it) => it.progress < 100).length;
  return {
    total,
    completionRate: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
    risk,
    avgLoad: emp > 0 ? Math.round((active / emp) * 10) / 10 : 0,
  };
}

// S2 驾驶舱 6 项指标
export function overview(user: AuthUser, month: string): Record<string, unknown> {
  const groupId = scopeGroup(user);
  const db = getDb();
  const agg = monthlyAggregate(db, month, groupId);
  // 大目标达成度：进行中大目标加权进度均值
  const objectives = db.prepare(`SELECT o.id, o.name, o.status, o.is_key FROM objectives o`)
    .all() as unknown as Array<{ id: string; name: string; status: string; is_key: number }>;
  const inProgress = objectives.filter((o) => o.status === '进行中');
  const progresses = inProgress.map((o) => {
    const links = db.prepare(`SELECT i.progress, i.weight FROM contract_items i WHERE i.objective_id = ?`).all(o.id) as unknown as Array<{ progress: number; weight: number }>;
    return objectiveProgress(links);
  });
  const objectiveProgressAvg = progresses.length > 0 ? Math.round((progresses.reduce((s, p) => s + p, 0) / progresses.length) * 10) / 10 : 0;
  return {
    total: agg.total,
    completionRate: agg.completionRate,
    risk: agg.risk,
    objectiveProgress: objectiveProgressAvg,
    avgLoad: agg.avgLoad,
    valueDistribution: valueDistribution(user, month, 'count'),
  };
}

// S1 价值分布
export function valueDistribution(user: AuthUser, month: string, by: string): Array<Record<string, unknown>> {
  const groupId = scopeGroup(user);
  const items = fetchMonthItems(getDb(), month, groupId);
  const buckets = new Map<string, number>();
  let totalDenominator = 0;
  for (const it of items) {
    const tag = normalizeTag(it.value_tag);
    const val = by === 'weight' ? it.weight : 1;
    buckets.set(tag, (buckets.get(tag) ?? 0) + val);
    totalDenominator += val;
  }
  const result: Array<Record<string, unknown>> = [];
  for (const tag of VALUE_TAGS) {
    if (buckets.has(tag)) {
      result.push({ tag, count: buckets.get(tag), ratio: totalDenominator > 0 ? Math.round((buckets.get(tag)! / totalDenominator) * 1000) / 10 : 0 });
    }
  }
  if (buckets.has(UNCLASSIFIED)) {
    result.push({ tag: UNCLASSIFIED, count: buckets.get(UNCLASSIFIED), ratio: totalDenominator > 0 ? Math.round((buckets.get(UNCLASSIFIED)! / totalDenominator) * 1000) / 10 : 0 });
  }
  return result;
}

// S4 部门趋势（环比/同比）
export function trend(user: AuthUser, month: string): Record<string, unknown> {
  const groupId = scopeGroup(user);
  const db = getDb();
  return {
    month,
    current: monthlyAggregate(db, month, groupId),
    mom: { month: shiftMonth(month, -1), ...monthlyAggregate(db, shiftMonth(month, -1), groupId) },
    yoy: { month: shiftMonth(month, -12), ...monthlyAggregate(db, shiftMonth(month, -12), groupId) },
  };
}

// S5 人效与负荷
export function workload(user: AuthUser, month: string): Record<string, unknown> {
  const groupId = scopeGroup(user);
  const db = getDb();
  const items = fetchMonthItems(db, month, groupId);
  const emp = employeeCount(db, groupId);
  const completed = items.filter((it) => it.progress >= 100).length;

  const typeDist = new Map<string, number>();
  for (const it of items) typeDist.set(it.type, (typeDist.get(it.type) ?? 0) + 1);

  // 成员负荷
  const members = new Map<string, { name: string; activeCount: number }>();
  for (const it of items) {
    if (it.progress >= 100) continue;
    const cur = members.get(it.member_id) ?? { name: it.member_name, activeCount: 0 };
    cur.activeCount += 1;
    members.set(it.member_id, cur);
  }
  const activeList = [...members.values()].map((m) => m.activeCount);
  const mean = activeList.length > 0 ? activeList.reduce((s, n) => s + n, 0) / activeList.length : 0;
  const memberRows = [...members.entries()].map(([id, m]) => ({
    userId: id,
    name: m.name,
    activeCount: m.activeCount,
    flag: m.activeCount > mean + 2 ? '超负荷' : m.activeCount < mean - 2 ? '富余' : null,
  }));

  return {
    avgCompletion: emp > 0 ? Math.round((completed / emp) * 10) / 10 : 0,
    typeDistribution: Object.fromEntries(typeDist),
    mean: Math.round(mean * 10) / 10,
    members: memberRows,
  };
}

// S6 风险汇聚
export function risks(user: AuthUser, month: string): Record<string, unknown> {
  const groupId = scopeGroup(user);
  const db = getDb();
  const items = fetchMonthItems(db, month, groupId);
  const riskItems = items
    .filter((it) => riskState(it.due_date, it.progress) !== '正常')
    .sort((a, b) => {
      const ra = riskState(a.due_date, a.progress);
      const rb = riskState(b.due_date, b.progress);
      if (ra === '逾期' && rb !== '逾期') return -1;
      if (rb === '逾期' && ra !== '逾期') return 1;
      return daysLeft(a.due_date) - daysLeft(b.due_date);
    })
    .map((it) => ({
      member: it.member_name,
      title: it.title,
      risk: riskState(it.due_date, it.progress),
      dueDate: it.due_date,
      daysLeft: daysLeft(it.due_date),
    }));

  // 风险月度趋势（近 6 个月风险数）
  const trendRows: Array<{ month: string; risk: number }> = [];
  for (let i = 0; i >= -5; i--) {
    const m = shiftMonth(month, i);
    const its = fetchMonthItems(db, m, groupId);
    trendRows.push({ month: m, risk: its.filter((it) => riskState(it.due_date, it.progress) !== '正常').length });
  }

  return { list: riskItems, trend: trendRows };
}

// S7 大目标总览（含年度重点）
export function objectiveOverview(user: AuthUser): Array<Record<string, unknown>> {
  scopeGroup(user);
  const db = getDb();
  const objectives = db.prepare('SELECT id, name, status, is_key FROM objectives ORDER BY id').all() as unknown as Array<{ id: string; name: string; status: string; is_key: number }>;
  return objectives.map((o) => {
    const links = db.prepare(`SELECT i.progress, i.weight, i.due_date FROM contract_items i WHERE i.objective_id = ?`).all(o.id) as unknown as Array<{ progress: number; weight: number; due_date: string }>;
    const progress = objectiveProgress(links);
    const contractSet = new Set((db.prepare(`SELECT DISTINCT c.id AS cid FROM contract_items i JOIN contracts c ON c.id=i.contract_id WHERE i.objective_id = ?`).all(o.id) as unknown as Array<{ cid: string }>).map((r) => r.cid));
    const riskCount = links.filter((l) => riskState(l.due_date, l.progress) !== '正常').length;
    return {
      id: o.id,
      name: o.name,
      status: o.status,
      progress,
      contractCount: contractSet.size,
      riskCount,
      isKey: o.is_key === 1,
    };
  });
}

// S3 总结报告四段
export function summaryReport(user: AuthUser, month: string): Record<string, unknown> {
  const groupId = scopeGroup(user);
  const db = getDb();
  const agg = monthlyAggregate(db, month, groupId);
  const objectives = objectiveOverview(user);
  return {
    month,
    // 一、本期工作全景
    panorama: {
      ...agg,
      objectiveProgress: (overview(user, month) as { objectiveProgress: number }).objectiveProgress,
    },
    // 二、价值产出
    value: valueDistribution(user, month, 'count'),
    // 三、风险与问题
    problems: risks(user, month).list,
    // 四、下期计划（进行中大目标）
    plan: objectives.filter((o) => o.status === '进行中').map((o) => ({ id: o.id, name: o.name, progress: o.progress, isKey: o.isKey })),
  };
}
