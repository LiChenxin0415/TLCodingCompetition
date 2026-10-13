/**
 * 接口封装（与 material/design/api-spec-v1.md 一一对应）
 * 需求依据：frontend-design §7 接口对接清单
 */

import { http } from './http';
import type {
  HealthInfo,
  ReportFields,
  TeamReportItem,
  TeamSummary,
  TemplateField,
  User,
  WeeklyReport,
} from '../types';

/** POST /api/login —— 免密登录（LOGIN-02） */
export async function login(userId: string): Promise<{ token: string; user: User }> {
  const { data } = await http.post<{ token: string; user: User }>('/login', { userId });
  return data;
}

/**
 * GET /api/login/accounts —— 登录页预置账号卡片（LOGIN-01）
 * 说明：契约之外后端新增的只读接口；若后端版本较旧返回 404，则由登录页使用兜底账号列表。
 */
export async function fetchAccounts(): Promise<User[]> {
  const { data } = await http.get<{ accounts: User[] }>('/login/accounts');
  return data.accounts;
}

/** GET /api/health —— 服务端权威当前周次（追加接口） */
export async function fetchHealth(): Promise<HealthInfo> {
  const { data } = await http.get<HealthInfo>('/health');
  return data;
}

/** GET /api/template —— 四字段模板结构（TPL-01，前端不硬编码） */
export async function fetchTemplate(): Promise<TemplateField[]> {
  const { data } = await http.get<{ fields: TemplateField[] }>('/template');
  return data.fields;
}

/** GET /api/reports/mine —— 我的周报列表（仅本人） */
export async function fetchMyReports(): Promise<WeeklyReport[]> {
  const { data } = await http.get<WeeklyReport[]>('/reports/mine');
  return data;
}

/** GET /api/reports/{id} —— 周报详情（本人 / leader） */
export async function fetchReport(id: string): Promise<WeeklyReport> {
  const { data } = await http.get<WeeklyReport>(`/reports/${encodeURIComponent(id)}`);
  return data;
}

/** POST /api/reports —— 新建/更新本人本周周报（REP-03 同周次为更新） */
export async function saveMyReport(
  fields: ReportFields,
  status: 'draft' | 'submitted',
): Promise<WeeklyReport> {
  const { data } = await http.post<WeeklyReport>('/reports', { ...fields, status });
  return data;
}

/** PUT /api/reports/{id} —— 更新周报（本人 / leader 代编辑） */
export async function updateReport(
  id: string,
  fields: Partial<ReportFields>,
  status?: 'draft' | 'submitted',
): Promise<WeeklyReport> {
  const body: Record<string, unknown> = { ...fields };
  if (status !== undefined) body.status = status;
  const { data } = await http.put<WeeklyReport>(`/reports/${encodeURIComponent(id)}`, body);
  return data;
}

/** GET /api/reports/team?week= —— 团队周报列表，返回裸数组（leader） */
export async function fetchTeamReports(week?: string): Promise<TeamReportItem[]> {
  const { data } = await http.get<TeamReportItem[]>('/reports/team', {
    params: week === undefined || week === '' ? {} : { week },
  });
  return data;
}

/** POST /api/reports/generate —— AI 生成个人周报（GEN 系列） */
export async function generateReport(input: string): Promise<ReportFields> {
  const { data } = await http.post<ReportFields>('/reports/generate', { input });
  return data;
}

/** POST /api/reports/team-summary —— AI 汇总团队周报，返回四段结构（OVR-06） */
export async function generateTeamSummary(week?: string): Promise<TeamSummary> {
  const { data } = await http.post<TeamSummary>(
    '/reports/team-summary',
    week === undefined || week === '' ? {} : { week },
  );
  return data;
}

/** GET /api/reports/team-summary/export —— 导出 .txt 文件流（OVR-08） */
export async function exportTeamSummary(
  week: string,
): Promise<{ blob: Blob; filename: string }> {
  const response = await http.get<Blob>('/reports/team-summary/export', {
    params: { week },
    responseType: 'blob',
  });

  const disposition = String(response.headers['content-disposition'] ?? '');
  let filename = `团队周报_${week}.txt`;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  const plainMatch = /filename="([^"]+)"/i.exec(disposition);
  if (utf8Match !== null) {
    try {
      filename = decodeURIComponent(utf8Match[1]);
    } catch {
      // 保留默认文件名
    }
  } else if (plainMatch !== null && plainMatch[1] !== '') {
    filename = plainMatch[1];
  }

  return { blob: response.data, filename };
}
