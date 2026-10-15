import type { AuthUser, Report } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/reportRepo.ts';
import * as contractRepo from '../repositories/contractRepo.ts';
import { notFound, unprocessable } from '../utils/errors.ts';
import { newId, nowStamp } from '../utils/misc.ts';
import { parseReport as aiParse } from '../ai/service.ts';

export function uploadReport(user: AuthUser, kind: string, period: string, contentText: string | null, file: { originalname: string; filename: string } | null): Report {
  if (kind !== 'daily' && kind !== 'weekly') throw unprocessable('类型仅支持 daily / weekly');
  if (period.trim() === '') throw unprocessable('日期不能为空');
  const report: Report = {
    id: newId('rep'),
    userId: user.id,
    kind: kind as Report['kind'],
    period: period.trim(),
    contentRef: file !== null ? file.filename : (contentText ?? ''),
    aiSummary: null,
    linkedItemIds: null,
    version: 1,
  };
  repo.insertReport(getDb(), report);
  return report;
}

export async function parseReportContent(user: AuthUser, reportId: string): Promise<object> {
  const report = repo.findReport(getDb(), reportId);
  if (report === null) throw notFound('日报周报不存在');
  if (report.userId !== user.id) throw notFound('日报周报不存在');
  const text = report.contentRef;
  if (text === '' || text.length > 2000) throw unprocessable('仅支持 ≤2000 字的文本内容解析');
  return aiParse(text);
}

export function adoptReport(user: AuthUser, reportId: string, body: Record<string, unknown>): object {
  const report = repo.findReport(getDb(), reportId);
  if (report === null) throw notFound('日报周报不存在');
  if (report.userId !== user.id) throw notFound();
  const adoptions = Array.isArray(body.adoptions) ? body.adoptions : [];
  const db = getDb();
  const linked: string[] = [];
  for (const a of adoptions) {
    const r = a as Record<string, unknown>;
    const itemId = String(r.item_id ?? '');
    const delta = Math.round(Number(r.delta) || 0);
    const item = contractRepo.findItem(db, itemId);
    if (item === null) continue;
    const newProgress = Math.max(0, Math.min(100, item.progress + delta));
    contractRepo.updateItem(db, { ...item, progress: newProgress });
    linked.push(itemId);
  }
  const updated: Report = { ...report, linkedItemIds: JSON.stringify(linked), aiSummary: JSON.stringify({ adopted: linked }), version: report.version + 1 };
  repo.updateReport(db, updated);
  return updated;
}