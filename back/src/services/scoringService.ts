import type { AuthUser } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/contractRepo.ts';
import * as dlvRepo from '../repositories/deliverableRepo.ts';
import * as userRepo from '../repositories/userRepo.ts';
import { insertAudit } from '../repositories/auditRepo.ts';
import { forbidden, notFound, unprocessable } from '../utils/errors.ts';
import { monthlyScore, scoreBand } from '../utils/algorithms.ts';
import { newId, nowStamp } from '../utils/misc.ts';

export function scoreItem(user: AuthUser, itemId: string, body: Record<string, unknown>): object {
  if (user.role !== 'leader' && user.role !== 'center') throw forbidden();
  const db = getDb();
  const item = repo.findItem(db, itemId);
  if (item === null) throw notFound('工作包不存在');
  const contract = repo.findContract(db, item.contractId);
  if (contract === null) throw notFound('合约不存在');
  if (user.role === 'leader') {
    const member = userRepo.findUserById(db, contract.userId);
    if (member === null || member.groupId !== user.groupId) throw forbidden('无权限访问');
  }

  const score = Math.round(Number(body.score));
  if (!Number.isFinite(score) || score < 80 || score > 120) throw unprocessable('评分需为 80—120 的整数');
  const basis = String(body.basis ?? '').trim();
  const overrideReason = String(body.override_reason ?? '').trim();

  if (score !== 100 && basis === '') throw unprocessable('偏离 100 分须说明依据');
  const hasDeliverable = dlvRepo.countDeliverables(db, itemId) > 0;
  if (!hasDeliverable && score >= 96 && overrideReason === '') throw unprocessable('交付物未上传，最高 95 分；强行打 ' + score + ' 分需二次确认并填写理由');
  if (!hasDeliverable && score >= 96) {
    // 二次确认：理由已填，放行但留痕
  } else if (!hasDeliverable && score > 95) {
    throw unprocessable('交付物未上传，最高 95 分');
  }

  repo.updateItem(db, { ...item, score });
  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'score_item', target: itemId, detail: String(score) + '/' + scoreBand(score) + '/' + basis, createdAt: nowStamp() });
  return { ...item, score, band: scoreBand(score) };
}

export function submitRating(user: AuthUser, contractId: string): object {
  if (user.role !== 'leader' && user.role !== 'center') throw forbidden();
  const db = getDb();
  const contract = repo.findContract(db, contractId);
  if (contract === null) throw notFound('合约不存在');
  const items = repo.listItemsByContract(db, contractId);
  const unscored = items.filter((it) => it.score === null);
  if (unscored.length > 0) throw unprocessable('存在 ' + unscored.length + ' 个未评分工作包，不能提交评分');
  repo.updateContractStatus(db, contractId, 'rated', { checkBy: user.id });
  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'submit_rating', target: contractId, detail: '', createdAt: nowStamp() });
  return { ...contract, status: 'rated' };
}

export function calibration(user: AuthUser, month: string): Array<Record<string, unknown>> {
  if (user.role !== 'center') throw forbidden();
  const db = getDb();
  const contracts = repo.listContractsByMonth(db, month, null);
  const rows: Array<Record<string, unknown>> = [];
  for (const c of contracts) {
    const member = userRepo.findUserById(db, c.userId);
    if (member === null) continue;
    const items = repo.listItemsByContract(db, c.id);
    const score = monthlyScore(items.map((it) => ({ score: it.score, weight: it.weight })));
    if (score === null) continue;
    rows.push({ userId: member.id, name: member.name, groupId: member.groupId, score, contractId: c.id });
  }
  const mean = rows.length > 0 ? rows.reduce((s, r) => s + (r.score as number), 0) / rows.length : 0;
  return rows.map((r) => ({
    ...r,
    groupMean: Math.round(mean * 10) / 10,
    deviation: Math.round(((r.score as number) - mean) * 10) / 10,
    flag: Math.abs((r.score as number) - mean) >= 3 ? ((r.score as number) < mean ? '偏严' : '偏松') : null,
  }));
}

export function publish(user: AuthUser, month: string): { published: number; errors: string[] } {
  if (user.role !== 'center') throw forbidden();
  const db = getDb();
  const contracts = repo.listContractsByMonth(db, month, null);
  const errors: string[] = [];
  let published = 0;

  for (const c of contracts) {
    const items = repo.listItemsByContract(db, c.id);
    const weightSum = items.reduce((s, it) => s + it.weight, 0);
    if (weightSum !== 100) { errors.push(c.id + ' 权重合计 ' + weightSum + '% ≠ 100%'); continue; }
    if (c.status !== 'rated') { errors.push(c.id + ' 状态 ' + c.status + '（需已评分）'); continue; }
    const badDue = items.filter((it) => !it.dueDate.startsWith(month));
    if (badDue.length > 0) { errors.push(c.id + ' 存在截止日不在合约月份内的工作包'); continue; }
    repo.updateContractStatus(db, c.id, 'published', { publishAt: nowStamp() });
    published += 1;
  }

  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'publish', target: month, detail: '发布 ' + published + ' 份，异常 ' + errors.length, createdAt: nowStamp() });
  return { published, errors };
}