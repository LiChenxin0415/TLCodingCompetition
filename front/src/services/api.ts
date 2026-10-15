/**
 * API 层：Mock / 真实后端二选一（VITE_USE_MOCK），切换点唯一。
 * 真实路径严格对齐 HLD §7 接口清单。
 */
import { del, get, post, put } from './http';
import * as mock from './mock';
import type {
  AiContractResult,
  AuthResult,
  CalibrationRow,
  ChangeReason,
  Contract,
  ContractItem,
  Deliverable,
  DrilldownRow,
  ItemCheck,
  MetricCard,
  Objective,
  ProgressParseResult,
  ReportEntry,
  SkillTag,
  User,
} from '@/types';

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/* ---------------- 认证 ---------------- */

export const login = (userId: string): Promise<AuthResult> =>
  USE_MOCK ? mock.mockLogin(userId) : post<AuthResult>('/login', { userId });

export const me = (): Promise<{ user: User; month: string }> =>
  USE_MOCK ? mock.mockMe() : get<{ user: User; month: string }>('/me');

/* ---------------- 大目标 ---------------- */

export const listObjectives = (): Promise<Objective[]> =>
  USE_MOCK ? mock.mockObjectives() : get<Objective[]>('/objectives');

export const getObjective = (id: string) =>
  USE_MOCK ? mock.mockObjective(id) : get<Awaited<ReturnType<typeof mock.mockObjective>>>(`/objectives/${id}`);

export const saveObjective = (payload: Record<string, unknown>, id?: string) =>
  USE_MOCK
    ? mock.mockSaveObjective(payload, id)
    : id
      ? put<Objective>(`/objectives/${id}`, payload)
      : post<Objective>('/objectives', payload);

/* ---------------- 合约 ---------------- */

export type MyContract = {
  contract: Contract | null;
  items: ContractItem[];
  deliverables: Record<string, Deliverable[]>;
};

export const getMyContract = (month: string): Promise<MyContract> =>
  USE_MOCK ? mock.mockMyContract(month) : get<MyContract>('/contracts/mine', { month });

export const createContract = (month: string): Promise<Contract> =>
  USE_MOCK ? mock.mockCreateContract(month) : post<Contract>('/contracts', { month });

export const saveContract = (contractId: string, items: Partial<ContractItem>[]) =>
  USE_MOCK
    ? mock.mockSaveContract(contractId, items)
    : put<{ contract: Contract; items: ContractItem[] }>(`/contracts/${contractId}`, { items });

export const submitContract = (contractId: string) =>
  USE_MOCK
    ? mock.mockSubmitContract(contractId)
    : post<{ contract: Contract; items: ContractItem[] }>(`/contracts/${contractId}/submit`);

export const getTeamContracts = (month: string) =>
  USE_MOCK
    ? mock.mockTeamContracts(month)
    : get<Awaited<ReturnType<typeof mock.mockTeamContracts>>>('/contracts/team', { month });

export const confirmContract = (contractId: string): Promise<Contract> =>
  USE_MOCK ? mock.mockConfirmContract(contractId) : post<Contract>(`/contracts/${contractId}/confirm`);

export const rejectContract = (contractId: string, reason: string): Promise<Contract> =>
  USE_MOCK ? mock.mockRejectContract(contractId, reason) : post<Contract>(`/contracts/${contractId}/reject`, { reason });

export const exportLedger = (month: string): Promise<string> =>
  USE_MOCK ? mock.mockExport(month) : get<string>('/contracts/export', { month });

/* ---------------- 工作包 ---------------- */

export const getItemDetail = (itemId: string) =>
  USE_MOCK ? mock.mockItemDetail(itemId) : get<Awaited<ReturnType<typeof mock.mockItemDetail>>>(`/items/${itemId}`);

export const updateItem = (itemId: string, patch: Partial<ContractItem> & { reason?: ChangeReason; note?: string }) =>
  USE_MOCK ? mock.mockUpdateItem(itemId, patch) : put(`/api/items/${itemId}`, patch);

export const listDeliverables = (itemId: string): Promise<Deliverable[]> =>
  USE_MOCK ? mock.mockListDeliverables(itemId) : get<Deliverable[]>(`/items/${itemId}/deliverables`);

export const addDeliverable = (itemId: string, payload: { kind: 'file' | 'link'; file_type: string; name: string; url: string }) =>
  USE_MOCK ? mock.mockAddDeliverable(itemId, payload) : post<Deliverable>(`/items/${itemId}/deliverables`, payload);

export const deleteDeliverable = (id: string) =>
  USE_MOCK ? mock.mockDeleteDeliverable(id) : del(`/deliverables/${id}`);

/* ---------------- AI ---------------- */

export const aiGenerateContract = (desc: string, objectiveId?: string) =>
  USE_MOCK
    ? mock.mockAiGenerate(desc, objectiveId)
    : post<AiContractResult & { hint?: string }>('/ai/contracts/generate', { desc, objective_id: objectiveId });

export const aiCheck = (items: Partial<ContractItem>[]): Promise<ItemCheck[]> =>
  USE_MOCK ? mock.mockAiCheck(items) : post<ItemCheck[]>('/ai/contracts/check', { items });

export const aiParseProgress = (text: string, itemId?: string): Promise<ProgressParseResult> =>
  USE_MOCK ? mock.mockAiParseProgress(text, itemId) : post<ProgressParseResult>('/ai/progress/parse', { text, item_id: itemId });

export const confirmProgress = (payload: {
  item_id: string; new_progress: number; raw_text: string; delta: number; evidence: string; confidence: number;
}) => (USE_MOCK ? mock.mockConfirmProgress(payload) : post('/progress/confirm', payload));

export const manualProgress = (payload: { item_id: string; progress: number; reason?: ChangeReason; note?: string }) =>
  USE_MOCK ? mock.mockManualProgress(payload) : post('/progress', payload);

/* ---------------- 评分 / 校准 / 发布 ---------------- */

export const scoreItem = (payload: { item_id: string; score: number; basis?: string; force_reason?: string }) =>
  USE_MOCK ? mock.mockScoreItem(payload) : put(`/items/${payload.item_id}/score`, payload);

export const submitRating = (contractId: string): Promise<Contract> =>
  USE_MOCK ? mock.mockSubmitRating(contractId) : post<Contract>(`/contracts/${contractId}/submit-rating`);

export const getCalibration = (month: string): Promise<CalibrationRow[]> =>
  USE_MOCK ? mock.mockCalibration(month) : get<CalibrationRow[]>('/calibration', { month });

export const getPublishCheck = (month: string) =>
  USE_MOCK ? mock.mockPublishCheck(month) : get<Awaited<ReturnType<typeof mock.mockPublishCheck>>>('/monthly/check', { month });

export const publishMonth = (month: string) =>
  USE_MOCK ? mock.mockPublish(month) : post<{ published: number }>('/monthly/publish', { month });

export const returnForBasis = (contractId: string, opinion: string): Promise<Contract> =>
  USE_MOCK ? mock.mockReturnForBasis(contractId, opinion) : post<Contract>('/calibration/return', { contract_id: contractId, opinion });

/* ---------------- 看板 ---------------- */

export const getMetrics = (month: string, groupId = 'all'): Promise<MetricCard[]> =>
  USE_MOCK ? mock.mockMetrics(month, groupId) : get<MetricCard[]>('/dashboard/metrics', { month, group: groupId });

export const getDrilldown = (metric: MetricCard['key'], month: string, groupId = 'all'): Promise<DrilldownRow[]> =>
  USE_MOCK
    ? mock.mockDrilldown(metric, month, groupId)
    : get<DrilldownRow[]>('/dashboard/drilldown', { metric, month, group: groupId, level: groupId === 'all' ? 'center' : 'group' });

/* ---------------- 日报周报（FR-07） ---------------- */

export const listReports = (): Promise<ReportEntry[]> =>
  USE_MOCK ? mock.mockListReports() : get<ReportEntry[]>('/reports');

export const createReport = (payload: { kind: 'daily' | 'weekly'; period: string; content: string }): Promise<ReportEntry> =>
  USE_MOCK ? mock.mockCreateReport(payload) : post<ReportEntry>('/reports', payload);

export const parseReport = (id: string) =>
  USE_MOCK ? mock.mockParseReport(id) : post<Awaited<ReturnType<typeof mock.mockParseReport>>>(`/reports/${id}/parse`);

export const adoptReport = (id: string, itemIds: string[]) =>
  USE_MOCK ? mock.mockAdoptReport(id, itemIds) : post(`/reports/${id}/adopt`, { item_ids: itemIds });

/* ---------------- 能力画像（FR-08） ---------------- */

export const getSkills = (userId: string): Promise<SkillTag[]> =>
  USE_MOCK ? mock.mockSkills(userId) : get<SkillTag[]>('/skills', { user_id: userId });

export const hideSkill = (tagId: string) =>
  USE_MOCK ? mock.mockHideSkill(tagId) : post(`/skills/${tagId}/hide`);
