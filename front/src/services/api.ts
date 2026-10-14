/**
 * 前端请求层：方法签名与 material/design/api-spec-v1.md 一一对应。
 * VITE_USE_MOCK=true 时走 mock 适配器（前端独立演示）；=false 时走真实后端。
 */
import type {
  LoginResult,
  Report,
  ReportFields,
  ReportStatus,
  TeamRow,
  TeamSummary,
  TemplateField,
} from '@/types';
import { http } from './http';
import { mock } from './mock';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export function login(userId: string): Promise<LoginResult> {
  if (USE_MOCK) return mock.login(userId);
  return http.post<LoginResult>('/login', { userId }).then((r) => r.data);
}

export function getTemplate(): Promise<TemplateField[]> {
  if (USE_MOCK) return mock.getTemplate();
  return http.get<{ fields: TemplateField[] }>('/template').then((r) => r.data.fields);
}

export function getMyReports(): Promise<Report[]> {
  if (USE_MOCK) return mock.getMyReports();
  return http.get<Report[]>('/reports/mine').then((r) => r.data);
}

export function createReport(payload: ReportFields & { status: ReportStatus }): Promise<Report> {
  if (USE_MOCK) return mock.createReport(payload);
  return http.post<Report>('/reports', payload).then((r) => r.data);
}

export function getReport(id: string): Promise<Report> {
  if (USE_MOCK) return mock.getReport(id);
  return http.get<Report>(`/reports/${id}`).then((r) => r.data);
}

export function updateReport(
  id: string,
  payload: Partial<ReportFields> & { status?: ReportStatus },
): Promise<Report> {
  if (USE_MOCK) return mock.updateReport(id, payload);
  return http.put<Report>(`/reports/${id}`, payload).then((r) => r.data);
}

export function getTeamReports(week?: string): Promise<TeamRow[]> {
  if (USE_MOCK) return mock.getTeamReports(week);
  return http
    .get<TeamRow[]>('/reports/team', { params: week ? { week } : undefined })
    .then((r) => r.data);
}

export function generateReport(input: string): Promise<ReportFields> {
  if (USE_MOCK) return mock.generateReport(input);
  return http.post<ReportFields>('/reports/generate', { input }).then((r) => r.data);
}

export function generateTeamSummary(week: string): Promise<TeamSummary> {
  if (USE_MOCK) return mock.generateTeamSummary(week);
  return http.post<TeamSummary>('/reports/team-summary', { week }).then((r) => r.data);
}

/** 导出 .txt：统一返回 { filename, content }，由前端生成 Blob 下载（OVR-08） */
export async function exportTeamSummary(week: string): Promise<{ filename: string; content: string }> {
  if (USE_MOCK) return mock.exportTeamSummary(week);
  const resp = await http.get<Blob>('/reports/team-summary/export', {
    params: { week },
    responseType: 'blob',
  });
  const content = await resp.data.text();
  const disposition = resp.headers['content-disposition'] as string | undefined;
  const match = disposition ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition) : null;
  const filename = match ? decodeURIComponent(match[1]) : `团队周报_${week}.txt`;
  return { filename, content };
}
