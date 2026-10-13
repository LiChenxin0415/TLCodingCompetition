/**
 * 周报字段校验与规范化
 * 需求依据：4.2 模板字段规范、6.1 字段字典、GEN-01/02（AI 输入）、错误码 400
 *
 * 约束：weekDone 2—5 条、ongoing 1—3 条、issues 0—3 条（选填）、nextPlan 2—3 条、每条 ≤50 字
 */

import { badRequest } from './errors.ts';
import type { ReportFields, ReportStatus } from '../types.ts';

export const ITEM_MAX_LEN = 50;
export const AI_INPUT_MAX_LEN = 2000; // GEN-02

export interface FieldSpec {
  key: keyof ReportFields;
  label: string;
  required: boolean;
  min: number;
  max: number;
}

export const FIELD_SPECS: FieldSpec[] = [
  { key: 'weekDone', label: '本周完成', required: true, min: 2, max: 5 },
  { key: 'ongoing', label: '进行中', required: true, min: 1, max: 3 },
  { key: 'issues', label: '问题与风险', required: false, min: 0, max: 3 },
  { key: 'nextPlan', label: '下周计划', required: true, min: 2, max: 3 },
];

function asRecord(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw badRequest('请求体格式错误，应为 JSON 对象');
  }
  return body as Record<string, unknown>;
}

/** 单个字段：类型、条数、单条长度校验 + 去空白 */
function parseField(spec: FieldSpec, raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw badRequest(`${spec.label}应为字符串数组`);
  }
  if (raw.length < spec.min || raw.length > spec.max) {
    throw badRequest(`${spec.label}需 ${spec.min}—${spec.max} 条，当前 ${raw.length} 条`);
  }
  const items = raw.map((item, index) => {
    if (typeof item !== 'string') {
      throw badRequest(`${spec.label}第 ${index + 1} 条应为字符串`);
    }
    const text = item.trim();
    if (text === '') {
      throw badRequest(`${spec.label}第 ${index + 1} 条不能为空`);
    }
    if ([...text].length > ITEM_MAX_LEN) {
      throw badRequest(`${spec.label}第 ${index + 1} 条超过 ${ITEM_MAX_LEN} 字`);
    }
    return text;
  });
  return items;
}

export interface ParseOptions {
  /** 部分更新（PUT）：未提供的字段沿用 existing */
  partial?: boolean;
  existing?: ReportFields;
}

/** 解析并校验周报四字段，返回可直接落库的规范化结果 */
export function parseReportFields(body: unknown, options: ParseOptions = {}): ReportFields {
  const record = asRecord(body);
  const partial = options.partial === true;
  const existing = options.existing;

  const result: ReportFields = {
    weekDone: existing?.weekDone ?? [],
    ongoing: existing?.ongoing ?? [],
    issues: existing?.issues ?? [],
    nextPlan: existing?.nextPlan ?? [],
  };

  for (const spec of FIELD_SPECS) {
    const raw = record[spec.key];
    if (raw === undefined) {
      if (partial) continue; // PUT 未传该字段 → 保留原值
      if (!spec.required) {
        result[spec.key] = ['暂无']; // TPL-03：无风险默认值
        continue;
      }
      throw badRequest(`${spec.label}不能为空`);
    }
    result[spec.key] = parseField(spec, raw);
  }

  return result;
}

export function parseStatus(raw: unknown, fallback: ReportStatus): ReportStatus {
  if (raw === undefined) return fallback;
  if (raw === 'draft' || raw === 'submitted') return raw;
  throw badRequest('status 仅支持 draft / submitted');
}

/** AI 生成结果归一化：超长截断、条数收敛到上限（保证生成结果可直接保存，避免演示中断） */
export function normalizeAiFields(fields: ReportFields): ReportFields {
  const normalized = {} as ReportFields;
  for (const spec of FIELD_SPECS) {
    const items = fields[spec.key]
      .filter((item): item is string => typeof item === 'string')
      .map((item) => {
        const text = item.trim();
        return [...text].length > ITEM_MAX_LEN ? [...text].slice(0, ITEM_MAX_LEN).join('') : text;
      })
      .filter((item) => item !== '')
      .slice(0, spec.max);
    normalized[spec.key] = items;
  }
  if (normalized.issues.length === 0) {
    normalized.issues = ['暂无']; // TPL-03
  }
  return normalized;
}
