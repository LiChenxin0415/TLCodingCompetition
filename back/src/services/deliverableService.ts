import type { AuthUser, Deliverable } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/contractRepo.ts';
import * as dlvRepo from '../repositories/deliverableRepo.ts';
import { insertAudit } from '../repositories/auditRepo.ts';
import { forbidden, notFound, unprocessable } from '../utils/errors.ts';
import { newId, nowStamp } from '../utils/misc.ts';

function assertItemAccess(user: AuthUser, item: { contractId: string; title: string }): { contract: { userId: string; status: string } } {
  const db = getDb();
  const contract = repo.findContract(db, item.contractId);
  if (contract === null) throw notFound('合约不存在');
  if (user.role === 'employee' && contract.userId !== user.id) throw forbidden('无权限访问');
  return { contract };
}

export function addDeliverableLink(user: AuthUser, itemId: string, url: string): Deliverable {
  const db = getDb();
  const item = repo.findItem(db, itemId);
  if (item === null) throw notFound('工作包不存在');
  const { contract } = assertItemAccess(user, item);
  if (contract.status === 'published') throw unprocessable('已发布合约不可上传交付物');
  if (url.trim() === '') throw unprocessable('链接不能为空');
  const d: Deliverable = { id: newId('dlv'), itemId, kind: 'link', fileType: null, url: url.trim(), uploader: user.id, uploadAt: nowStamp(), version: 1 };
  dlvRepo.insertDeliverable(db, d);
  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'upload_deliverable', target: itemId, detail: 'link:' + url, createdAt: nowStamp() });
  return d;
}

export function addDeliverableFile(user: AuthUser, itemId: string, file: { originalname: string; filename: string; path: string; size: number }): Deliverable {
  const db = getDb();
  const item = repo.findItem(db, itemId);
  if (item === null) throw notFound('工作包不存在');
  const { contract } = assertItemAccess(user, item);
  if (contract.status === 'published') throw unprocessable('已发布合约不可上传交付物');
  const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const d: Deliverable = { id: newId('dlv'), itemId, kind: 'file', fileType: ext, url: file.filename, uploader: user.id, uploadAt: nowStamp(), version: 1 };
  dlvRepo.insertDeliverable(db, d);
  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'upload_deliverable', target: itemId, detail: 'file:' + file.originalname, createdAt: nowStamp() });
  return d;
}

export function listDeliverables(user: AuthUser, itemId: string): Deliverable[] {
  const db = getDb();
  const item = repo.findItem(db, itemId);
  if (item === null) throw notFound('工作包不存在');
  assertItemAccess(user, item);
  return dlvRepo.listDeliverables(db, itemId);
}

export function deleteDeliverable(user: AuthUser, deliverableId: string): void {
  const db = getDb();
  const d = dlvRepo.findDeliverable(db, deliverableId);
  if (d === null) throw notFound('交付物不存在');
  const item = repo.findItem(db, d.itemId);
  if (item === null) throw notFound('工作包不存在');
  const { contract } = assertItemAccess(user, item);
  if (contract.status === 'published') throw unprocessable('已发布合约不可删除交付物');
  dlvRepo.deleteDeliverable(db, deliverableId);
  insertAudit(db, { id: newId('audit'), operator: user.id, action: 'delete_deliverable', target: deliverableId, detail: '', createdAt: nowStamp() });
}