// 数据模型严格对齐 material/design/api-spec-v1.md 冻结契约
export type Role = 'member' | 'leader';

export type ReportStatus = 'draft' | 'submitted';

export interface User {
  id: string;
  name: string;
  role: Role;
}

export type FieldKey = 'weekDone' | 'ongoing' | 'issues' | 'nextPlan';

export interface ReportFields {
  weekDone: string[];
  ongoing: string[];
  issues: string[];
  nextPlan: string[];
}

export interface Report extends ReportFields {
  id: string;
  userId: string;
  week: string;
  status: ReportStatus;
  lastEditorId: string;
  updatedAt: string;
}

export interface TemplateField {
  key: FieldKey;
  label: string;
  required: boolean;
  maxItems: number;
  maxLen: number;
}

export interface TeamRow {
  user: User;
  report: Report | null;
}

export interface TeamSummary {
  overall: string;
  achievements: string[];
  risks: string[];
  nextFocus: string[];
}

export interface LoginResult {
  token: string;
  user: User;
}

/** 统一错误对象：code 为 HTTP 错误码，message 为可直接展示给用户的文案 */
export class ApiError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.name = 'ApiError';
  }
}
