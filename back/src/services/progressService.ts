import type { AuthUser, ChangeLog, ProgressLog } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/contractRepo.ts';
import * as dlvRepo from '../repositories/deliverableRepo.ts';
import { insertAudit } from '../repositories/auditRepo.ts';
import { forbidden, notFound, unprocessable } from '../utils/errors.ts';
import { currentMonth } from '../utils/month.ts';
import { newId, nowStamp } from '../utils/misc.ts';
import { parseProgress as aiParse } from '../ai/service.ts';

function assertItemAccess(user: AuthUser, item: { contractId: string }): void {
  const db = getDb();
  const contract = repo.findContract(db, item.contractId);
  if (contract === null) throw notFound('合约不存在');
  if (user.role === 'employee' && contract.userId !== user.id) throw forbidden();
  if (user.role === 'leader') {
    const member = repo.findContract(db, item.contractId);
    if (member === null || member.userId === user.id) return;
  }
}

export async function parseProgressText(user: AuthUser, text: unknown, _itemId: unknown) {
  if (typeof text !== 'string' || text.trim() === '') throw unprocessable('请输入进展描述');
  const db = getDb();
  const contract = repo.findContractByUserMonth(db, user.id, currentMonth());
  const items = contract === null ? [] : repo.listItemsByContract(db, contract.id);
  const active = items.filter((i) => i.progress < 100);
  return aiParse(text.trim(), active.map((i) => ({ id: i.id, title: i.title, progress: i.progress })));
}

export function confirmProgress(user: AuthUser, body: Record<string, unknown>): { item: object; log: ProgressLog } {
  const db = getDb();
  const itemId = String(body.item_id ?? '');
  const item = repo.findItem(db, itemId);
  if (item === null) throw notFound('工作包不存在');
  assertItemAccess(user, item);
  const contract = repo.findContract(db, item.contractId);
  if (contract === null || contract.status === 'published') throw unprocessable('已发布合约不可更新进度');

  const newProgress = Math.max(0, Math.min(100, Math.round(Number(body.new_progress) || 0)));
  const reason = String(body.reason ?? '').trim();
  if (newProgress < item.progress && reason === '') throw unprocessable('进度回退需填写原因');

  const delta = newProgress - item.progress;
  const rawText = String(body.raw_text ?? '').trim();
  const aiResult = body.ai_result !== undefined ? JSON.stringify(body.ai_result) : null;

  const updated = { ...item, progress: newProgress };
  repo.updateItem(db, updated);

  const log: ProgressLog = { id: newId('plog'), itemId, operator: user.id, rawText, aiResult, delta, createdAt: nowStamp() };
  dlvRepo.insertProgressLog(db, log);

  const change: ChangeLog = { id: newId('clog'), itemId, field: 'progress', oldValue: String(item.progress), newValue: String(newProgress), reason: reason || null as unknown as string, note: rawText, operator: user.id, createdAt: nowStamp() };
  repo.insertChangeLog(db, change);

  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'update_progress', target: itemId, detail: item.progress + '->' + newProgress, createdAt: nowStamp() });
  return { item: updated, log };
}