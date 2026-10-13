/**
 * 周报服务（REP-01/02/03、LEAD-01~04、AUTH-02/05）
 * 需求依据：4.4 个人周报管理、4.5 负责人周报管理、6.1 数据字典、api-spec 第四节
 */

import { getDb } from '../db/index.ts';
import {
  findByUserAndWeek,
  findById,
  insertReport,
  listByUser,
  listByWeek,
  newReportId,
  updateReport,
} from '../repositories/reportRepo.ts';
import type { SaveReportInput } from '../repositories/reportRepo.ts';
import { listUsers } from '../repositories/userRepo.ts';
import { badRequest, forbidden, notFound } from '../utils/errors.ts';
import { currentWeek, formatDateTimeFull, isValidWeek } from '../utils/isoWeek.ts';
import { parseReportFields, parseStatus } from '../utils/validate.ts';
import type { AuthUser, ReportStatus, TeamReportItem, WeeklyReport } from '../types.ts';

/** 周次解析：缺省取服务端当前周（1.5 用户不可修改） */
export function resolveWeek(rawWeek: unknown): string {
  if (rawWeek === undefined || rawWeek === null || String(rawWeek).trim() === '') {
    return currentWeek();
  }
  const week = String(rawWeek).trim();
  if (!isValidWeek(week)) {
    throw badRequest(`周次格式错误：${week}，应为 YYYY-Www`);
  }
  return week;
}

/** 我的周报列表（仅本人，AUTH-02；含预置历史，REP-04） */
export function getMine(user: AuthUser): WeeklyReport[] {
  return listByUser(getDb(), user.id);
}

/** AUTH-02：非本人且非负责人 → 403 */
function assertCanAccess(user: AuthUser, report: WeeklyReport): void {
  if (report.userId !== user.id && user.role !== 'leader') {
    throw forbidden('无权限访问');
  }
}

/** 读取单个周报（本人 / 负责人任意） */
export function getReportById(user: AuthUser, id: string): WeeklyReport {
  const report = findById(getDb(), id);
  if (report === null) {
    throw notFound('周报不存在');
  }
  assertCanAccess(user, report);
  return report;
}

/**
 * 保存本人本周周报（POST /api/reports）
 * REP-03：同一成员同一周次仅一份，重复保存为更新；REP-01/02：状态机由 status 驱动
 */
export function saveMyReport(user: AuthUser, body: unknown): WeeklyReport {
  const db = getDb();
  const week = currentWeek();
  const fields = parseReportFields(body);
  const status = parseStatus((body as Record<string, unknown> | null)?.status, 'draft');
  const existing = findByUserAndWeek(db, user.id, week);

  const input: SaveReportInput = {
    id: existing?.id ?? newReportId(),
    userId: user.id,
    week,
    weekDone: fields.weekDone,
    ongoing: fields.ongoing,
    issues: fields.issues,
    nextPlan: fields.nextPlan,
    status,
    lastEditorId: user.id, // AUTH-05
    updatedAt: formatDateTimeFull(),
  };

  if (existing === null) {
    insertReport(db, input);
  } else {
    updateReport(db, existing.id, input);
  }

  const saved = findById(db, input.id);
  if (saved === null) {
    throw notFound('周报保存失败');
  }
  return saved;
}

/**
 * 更新周报（PUT /api/reports/{id}）：本人 / 负责人（LEAD-03 代编辑）
 * 可部分更新；REP-02：已提交周报被编辑且未显式提交时状态回退草稿
 */
export function updateReportById(user: AuthUser, id: string, body: unknown): WeeklyReport {
  const db = getDb();
  const report = findById(db, id);
  if (report === null) {
    throw notFound('周报不存在');
  }
  assertCanAccess(user, report);

  const fields = parseReportFields(body, { partial: true, existing: report });
  const requested = parseStatus((body as Record<string, unknown> | null)?.status, 'draft');
  // REP-02：编辑已提交周报（未显式重新提交）→ 回退 draft
  const status: ReportStatus = requested === 'submitted' ? 'submitted' : 'draft';

  updateReport(db, id, {
    id,
    userId: report.userId,
    week: report.week,
    weekDone: fields.weekDone,
    ongoing: fields.ongoing,
    issues: fields.issues,
    nextPlan: fields.nextPlan,
    status,
    lastEditorId: user.id, // LEAD-03：最后编辑人更新为操作者
    updatedAt: formatDateTimeFull(),
  });

  const saved = findById(db, id);
  if (saved === null) {
    throw notFound('周报不存在');
  }
  return saved;
}

/**
 * 团队周报列表（GET /api/reports/team，仅负责人）
 * 契约：响应为**裸数组**，元素 { user, report }；report 为 null 表示"未开始"（OVR-01）
 */
export function getTeamReports(user: AuthUser, rawWeek: unknown): TeamReportItem[] {
  if (user.role !== 'leader') {
    throw forbidden('无权限访问');
  }
  return collectTeamReports(resolveWeek(rawWeek));
}

/** 内部：汇总某周全员周报数据（AI 汇总与总览共用，不做角色校验） */
export function collectTeamReports(week: string): TeamReportItem[] {
  const db = getDb();
  const byUser = new Map(listByWeek(db, week).map((report) => [report.userId, report]));
  return listUsers(db).map((member) => ({ user: member, report: byUser.get(member.id) ?? null }));
}

/** 某周是否已有任何周报（OVR-05 生成前置条件） */
export function hasAnyReport(week: string): boolean {
  return collectTeamReports(week).some((item) => item.report !== null);
}
