import type { AuthUser } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as auditRepo from '../repositories/auditRepo.ts';
import { forbidden } from '../utils/errors.ts';

export function listAudit(user: AuthUser): Array<Record<string, string>> {
  if (user.role !== 'center') throw forbidden();
  return auditRepo.listAudit(getDb());
}

export function exportAuditText(user: AuthUser): string {
  const rows = listAudit(user);
  const header = ['时间', '操作人', '动作', '对象', '详情'];
  const lines = [header.join('\t')];
  for (const r of rows) lines.push([r.createdAt, r.operator, r.action, r.target, r.detail].join('\t'));
  return lines.join('\n');
}