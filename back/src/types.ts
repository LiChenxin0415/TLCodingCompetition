/**
 * 共享类型定义
 * 需求依据：6.1 数据模型与字段字典
 */

export type Role = 'member' | 'leader';
export type ReportStatus = 'draft' | 'submitted';

export interface User {
  id: string;
  name: string;
  role: Role;
}

/** 登录态用户（由 auth 中间件注入 req.user） */
export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

/** 周报四字段（模板结构，TPL-01/02） */
export interface ReportFields {
  weekDone: string[];
  ongoing: string[];
  issues: string[];
  nextPlan: string[];
}

export interface WeeklyReport extends ReportFields {
  id: string;
  userId: string;
  week: string;
  status: ReportStatus;
  lastEditorId: string;
  updatedAt: string;
}

/** 团队总览：成员 + 该周周报（null 表示"未开始"，OVR-01） */
export interface TeamReportItem {
  user: User;
  report: WeeklyReport | null;
}

/** AI 团队周报四段结构（6.3 / OVR-06） */
export interface TeamSummary {
  overall: string;
  achievements: string[];
  risks: string[];
  nextFocus: string[];
}

export interface TeamSummarySnapshot {
  week: string;
  summary: TeamSummary;
  generatedAt: string;
}

/** 模板字段定义（GET /api/template） */
export interface TemplateField {
  key: keyof ReportFields;
  label: string;
  required: boolean;
  maxItems: number;
  maxLen: number;
}
