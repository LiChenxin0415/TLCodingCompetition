/**
 * AI 服务（GEN-01~08、OVR-05~09、6.3 输出契约）
 * 需求依据：backend-design §7、需求 4.3 / 4.6.2 / 6.3 / 第七章
 *
 * 关键约定：
 *   - 输入校验 400（GEN-01 空输入、GEN-02 超 2000 字）
 *   - 超时 20s → 504（GEN-04/06）
 *   - 解析失败/网络错误视同生成失败 → 504，**不向前端暴露原始报错**（6.3）
 *   - AI_ENABLED=false 或未配置端点 → 降级（GEN-07）：个人生成返回空模板，团队汇总走规则化聚合
 */

import { aiUsable } from '../config.ts';
import { callLlm, extractJsonObject, LlmError } from '../ai/llmClient.ts';
import { buildPersonalPrompt, buildTeamPrompt } from '../ai/prompt.ts';
import { getDb } from '../db/index.ts';
import { findSummary, saveSummary } from '../repositories/summaryRepo.ts';
import { aiFailed, aiTimeout, badRequest } from '../utils/errors.ts';
import { formatDateTimeFull } from '../utils/isoWeek.ts';
import { AI_INPUT_MAX_LEN, normalizeAiFields } from '../utils/validate.ts';
import { collectTeamReports, hasAnyReport, resolveWeek } from './reportService.ts';
import type { ReportFields, TeamReportItem, TeamSummary, TeamSummarySnapshot } from '../types.ts';

/** 原始错误只落服务端日志，前端一律得到通用文案（6.3） */
function toApiError(err: unknown): never {
  if (err instanceof LlmError) {
    console.error(`[ai] 生成失败 kind=${err.kind} message=${err.message}`);
    if (err.kind === 'timeout') throw aiTimeout('AI 生成超时，请重试');
    throw aiFailed('生成失败，请重试');
  }
  console.error('[ai] 未知异常', err);
  throw aiFailed('生成失败，请重试');
}

/** 模型输出宽容解析：数组或按换行/分号分隔的字符串均可 */
function toArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => item !== '');
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|；|;/)
      .map((item) => item.replace(/^[-*\d.、\s]+/, '').trim())
      .filter((item) => item !== '');
  }
  return null;
}

/** 个人周报四字段结构校验（缺字段 → 视同生成失败，GEN-06） */
function coercePersonalFields(parsed: unknown): ReportFields {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new LlmError('parse', 'AI 返回结构不是对象');
  }
  const record = parsed as Record<string, unknown>;
  const keys: Array<keyof ReportFields> = ['weekDone', 'ongoing', 'issues', 'nextPlan'];
  const result = {} as ReportFields;
  for (const key of keys) {
    const arr = toArray(record[key]);
    if (arr === null) {
      throw new LlmError('parse', `AI 返回缺少字段 ${key}`);
    }
    result[key] = arr;
  }
  return result;
}

/** 团队周报四段结构校验（6.3 / OVR-06） */
function coerceTeamSummary(parsed: unknown): TeamSummary {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new LlmError('parse', 'AI 返回结构不是对象');
  }
  const record = parsed as Record<string, unknown>;
  const overallRaw = record.overall;
  if (typeof overallRaw !== 'string' || overallRaw.trim() === '') {
    throw new LlmError('parse', 'AI 返回缺少 overall');
  }
  const achievements = toArray(record.achievements);
  const risks = toArray(record.risks);
  const nextFocus = toArray(record.nextFocus);
  if (achievements === null || risks === null || nextFocus === null) {
    throw new LlmError('parse', 'AI 返回缺少团队周报字段');
  }
  return {
    overall: overallRaw.trim(),
    achievements: achievements.slice(0, 6),
    // OVR-06：无风险时输出固定文案
    risks: risks.length === 0 ? ['本周无明显风险'] : risks.slice(0, 6),
    nextFocus: nextFocus.slice(0, 5),
  };
}

/** 降级（GEN-07）：不调 AI，个人周报返回空模板供手动填写 */
function degradedPersonalFields(): ReportFields {
  return { weekDone: [], ongoing: [], issues: ['暂无'], nextPlan: [] };
}

/**
 * 降级（GEN-07）：团队汇总退化为**规则化聚合**——
 * 仍有内容、可演示，比占位文本更实用（成果按成员聚合、风险取自 issues 字段）
 */
export function degradedTeamSummary(items: TeamReportItem[]): TeamSummary {
  const withReport = items.filter((item) => item.report !== null);

  const achievements: string[] = [];
  const risks: string[] = [];
  const nextFocus: string[] = [];

  for (const item of withReport) {
    const report = item.report;
    if (report === null) continue;
    for (const done of report.weekDone.slice(0, 2)) {
      achievements.push(`${item.user.name}：${done}`);
    }
    for (const issue of report.issues) {
      if (issue.trim() !== '' && issue.trim() !== '暂无') {
        risks.push(`${item.user.name}：${issue}`);
      }
    }
    for (const plan of report.nextPlan) {
      if (!nextFocus.includes(plan)) nextFocus.push(plan);
    }
  }

  const submitted = withReport.filter((item) => item.report?.status === 'submitted').length;
  const overall = `本周共 ${withReport.length} 名成员填写周报（已提交 ${submitted} 份、草稿 ${withReport.length - submitted} 份）。当前为降级模式下的规则化汇总，未调用 AI。`;

  return {
    overall,
    achievements: achievements.slice(0, 6),
    risks: risks.length === 0 ? ['本周无明显风险'] : risks.slice(0, 6),
    nextFocus: nextFocus.slice(0, 5),
  };
}

/**
 * 个人周报生成（POST /api/reports/generate）
 * GEN-01/02 校验 → Prompt 组装（4.3）→ LLM → 严格 JSON 解析 → 归一化
 */
export async function generatePersonalReport(rawInput: unknown): Promise<ReportFields> {
  const input = typeof rawInput === 'string' ? rawInput.trim() : '';
  if (input === '') {
    throw badRequest('请输入本周工作描述'); // GEN-01
  }
  if ([...input].length > AI_INPUT_MAX_LEN) {
    throw badRequest(`输入长度不能超过 ${AI_INPUT_MAX_LEN} 字`); // GEN-02
  }

  if (!aiUsable()) {
    console.warn('[ai] AI_ENABLED=false 或未配置 LLM 端点，进入降级模式（GEN-07）');
    return degradedPersonalFields();
  }

  try {
    // 6.3：模型只应输出 JSON，解析失败视同生成失败
    const content = await callLlm([{ role: 'user', content: buildPersonalPrompt(input) }]);
    return normalizeAiFields(coercePersonalFields(extractJsonObject(content)));
  } catch (err) {
    return toApiError(err);
  }
}

/**
 * 团队周报生成（POST /api/reports/team-summary，仅负责人）
 * OVR-05 前置校验 → 聚合本周全员周报 → Prompt → 严格 JSON → 落快照（OVR-09）
 * 契约：响应体即四段结构 { overall, achievements[], risks[], nextFocus[] }
 */
export async function generateTeamSummary(rawWeek: unknown): Promise<TeamSummary> {
  const week = resolveWeek(rawWeek);
  const items = collectTeamReports(week);

  if (!hasAnyReport(week)) {
    throw badRequest('暂无可汇总的周报'); // OVR-05
  }

  let summary: TeamSummary;

  if (!aiUsable()) {
    console.warn('[ai] AI_ENABLED=false 或未配置 LLM 端点，团队汇总进入规则化降级（GEN-07）');
    summary = degradedTeamSummary(items);
  } else {
    try {
      const content = await callLlm([{ role: 'user', content: buildTeamPrompt(week, items) }]);
      summary = coerceTeamSummary(extractJsonObject(content));
    } catch (err) {
      return toApiError(err);
    }
  }

  saveSummary(getDb(), week, summary, formatDateTimeFull()); // OVR-09 快照

  return summary;
}

/** 读取已生成的团队周报快照（导出用，OVR-08） */
export function getSummarySnapshot(week: string): TeamSummarySnapshot | null {
  return findSummary(getDb(), week);
}

/** 四段纯文本（api-spec GET /api/reports/team-summary/export 格式） */
export function buildExportText(summary: TeamSummary): string {
  const lines: string[] = [
    '整体进展：',
    summary.overall,
    '',
    '关键成果：',
    ...summary.achievements.map((item) => `- ${item}`),
    '',
    '风险集中点：',
    ...summary.risks.map((item) => `- ${item}`),
    '',
    '下周重点：',
    ...summary.nextFocus.map((item) => `- ${item}`),
    '',
  ];
  return lines.join('\n');
}

/** OVR-08：团队周报_YYYY-Www.txt */
export function exportFileName(week: string): string {
  return `团队周报_${week}.txt`;
}
