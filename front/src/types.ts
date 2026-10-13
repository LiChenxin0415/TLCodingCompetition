/**
 * 前端共享类型（与 api-spec-v1.md / 需求 6.1 字段字典保持一致）
 */

export type Role = 'member' | 'leader';
export type ReportStatus = 'draft' | 'submitted';

export interface User {
  id: string;
  name: string;
  role: Role;
}

/** 周报四字段（模板结构） */
export interface ReportFields {
  weekDone: string[];
  ongoing: string[];
  issues: string[];
  nextPlan: string[];
}

export type FieldKey = keyof ReportFields;

export interface WeeklyReport extends ReportFields {
  id: string;
  userId: string;
  week: string;
  status: ReportStatus;
  lastEditorId: string;
  updatedAt: string;
}

/** 团队总览元素：report 为 null 表示「未开始」（OVR-01） */
export interface TeamReportItem {
  user: User;
  report: WeeklyReport | null;
}

/** AI 团队周报四段结构（OVR-06） */
export interface TeamSummary {
  overall: string;
  achievements: string[];
  risks: string[];
  nextFocus: string[];
}

/** 模板字段（GET /api/template，前端不硬编码） */
export interface TemplateField {
  key: FieldKey;
  label: string;
  required: boolean;
  maxItems: number;
  maxLen: number;
}

export interface HealthInfo {
  status: string;
  week: string;
  aiEnabled: boolean;
  llmConfigured: boolean;
}

/** 统一错误载荷（由 axios 拦截器归一化） */
export interface ApiFailure {
  status: number;
  message: string;
}
