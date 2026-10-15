import { aiUsable } from '../config.ts';
import { callLlm, extractJsonObject, LlmError } from './llmClient.ts';
import { buildContractPrompt, buildProgressPrompt, buildReportPrompt } from './prompts.ts';
import { aiFailed, aiTimeout } from '../utils/errors.ts';
import { checkItem } from '../utils/algorithms.ts';
import type { AiContractCheck, AiGeneratedItem, AiContractResult } from '../types.ts';

const ITEM_TYPES = ['基础履职类', '重点交付类', '治理改善类', '探索突破类'];
const DELIVERABLE_TYPES = ['代码合并请求', '设计文档', '测试报告', '数据报表', '上线单', 'PoC 结论报告', '运维记录', '其他'];
const PRIORITIES = ['高', '中', '低'];

function toApiError(err: unknown): never {
  if (err instanceof LlmError) {
    console.error('[ai] kind=' + err.kind + ' message=' + err.message);
    if (err.kind === 'timeout') throw aiTimeout('AI 处理超时，请重试');
    throw aiFailed('AI 暂不可用，请稍后重试');
  }
  console.error('[ai] 未知异常', err);
  throw aiFailed('AI 暂不可用，请稍后重试');
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string');
}

export interface ContractGenerateResult {
  degraded: boolean;
  items: AiGeneratedItem[];
  totalWeight: number;
  checks: AiContractCheck[];
}

export async function generateContract(userId: string, desc: string, objectiveName: string | null): Promise<ContractGenerateResult> {
  if (!aiUsable()) {
    return { degraded: true, items: [], totalWeight: 0, checks: [] };
  }
  try {
    const content = await callLlm([{ role: 'user', content: buildContractPrompt(desc, objectiveName) }]);
    const parsed = extractJsonObject(content) as { items?: unknown; total_weight?: unknown };
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
    if (rawItems.length === 0) throw new LlmError('parse', 'AI 未返回工作包');

    const items: AiGeneratedItem[] = [];
    let weightSum = 0;
    for (const raw of rawItems) {
      const r = raw as Record<string, unknown>;
      const type = typeof r.type === 'string' && ITEM_TYPES.includes(r.type) ? r.type : '重点交付类';
      const priority = typeof r.priority === 'string' && PRIORITIES.includes(r.priority) ? r.priority : '中';
      const deliverable = (typeof r.deliverable === 'object' && r.deliverable !== null ? r.deliverable : {}) as Record<string, unknown>;
      const dlvType = typeof deliverable.type === 'string' && DELIVERABLE_TYPES.includes(deliverable.type) ? deliverable.type : '其他';
      const weight = Math.max(1, Math.round(Number(r.weight) || 0));
      weightSum += weight;
      items.push({
        type,
        title: typeof r.title === 'string' ? r.title : '未命名工作包',
        target_desc: typeof r.target_desc === 'string' ? r.target_desc : '',
        deliverable: { type: dlvType, desc: typeof deliverable.desc === 'string' ? deliverable.desc : '' },
        weight,
        priority,
        due_date: typeof r.due_date === 'string' ? r.due_date : '',
        objective_id: typeof r.objective_id === 'string' ? r.objective_id : null,
      });
    }

    // R2：权重自动归一化到 100
    if (weightSum > 0) {
      let acc = 0;
      for (let i = 0; i < items.length; i++) {
        const w = i === items.length - 1 ? 100 - acc : Math.round((items[i].weight / weightSum) * 100);
        items[i].weight = Math.max(0, w);
        acc += items[i].weight;
      }
    }

    const checks: AiContractCheck[] = items.map((it) => {
      const c = checkItem({ targetDesc: it.target_desc, dueDate: it.due_date, deliverableType: it.deliverable.type, deliverableDesc: it.deliverable.desc });
      return { item_title: it.title, has_number: c.hasNumber, has_deadline: c.hasDeadline, has_verifiable_verb: c.hasVerifiableVerb, score: c.score, issues: c.issues };
    });

    return { degraded: false, items, totalWeight: 100, checks };
  } catch (err) {
    return toApiError(err);
  }
}

export interface ProgressParseResult {
  degraded: boolean;
  confidence: number;
  itemId: string | null;
  newProgress: number;
  delta: number;
  evidence: string[];
  candidates: Array<{ item_id: string; title: string }>;
}

export async function parseProgress(text: string, items: Array<{ id: string; title: string; progress: number }>): Promise<ProgressParseResult> {
  if (!aiUsable() || items.length === 0) {
    return { degraded: true, confidence: 0, itemId: null, newProgress: 0, delta: 0, evidence: [], candidates: [] };
  }
  try {
    const content = await callLlm([{ role: 'user', content: buildProgressPrompt(text, items) }]);
    const parsed = extractJsonObject(content) as Record<string, unknown>;
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    const rawCandidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
    const candidates = rawCandidates.map((c) => {
      const r = c as Record<string, unknown>;
      return { item_id: typeof r.item_id === 'string' ? r.item_id : '', title: typeof r.title === 'string' ? r.title : '' };
    });
    const itemId = confidence >= 0.6 && typeof parsed.item_id === 'string' ? parsed.item_id : null;
    return {
      degraded: false,
      confidence,
      itemId,
      newProgress: Math.max(0, Math.min(100, Math.round(Number(parsed.new_progress) || 0))),
      delta: Math.round(Number(parsed.delta) || 0),
      evidence: asStringArray(parsed.evidence),
      candidates,
    };
  } catch (err) {
    return toApiError(err);
  }
}

export interface ReportParseResult {
  degraded: boolean;
  summary: string[];
  suggestions: Array<{ title: string; delta: number; reason: string }>;
}

export async function parseReport(text: string): Promise<ReportParseResult> {
  if (!aiUsable()) {
    return { degraded: true, summary: [], suggestions: [] };
  }
  try {
    const content = await callLlm([{ role: 'user', content: buildReportPrompt(text) }]);
    const parsed = extractJsonObject(content) as Record<string, unknown>;
    const suggestions = (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map((s) => {
      const r = s as Record<string, unknown>;
      return { title: typeof r.title === 'string' ? r.title : '', delta: Math.round(Number(r.delta) || 0), reason: typeof r.reason === 'string' ? r.reason : '' };
    });
    return { degraded: false, summary: asStringArray(parsed.summary).slice(0, 5), suggestions: suggestions.slice(0, 3) };
  } catch (err) {
    return toApiError(err);
  }
}