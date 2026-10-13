/**
 * 字符串 ↔ 四字段数组 转换、模板兜底与前端校验
 * 需求依据：4.2 模板字段规范、4.4 列表摘要（首条截断 20 字）、GEN-08（逐字段编辑）
 *
 * 注意：模板结构以 GET /api/template 为准（TPL-01 前端不硬编码），
 * 此处的 DEFAULT_TEMPLATE 仅在模板接口异常时兜底，保证页面不白屏。
 */

import type { FieldKey, ReportFields, TemplateField } from '../types';

export const FIELD_KEYS: FieldKey[] = ['weekDone', 'ongoing', 'issues', 'nextPlan'];

/** 条数下限（契约未下发 min，取需求 6.1 字段字典：weekDone 2—5 / ongoing 1—3 / issues 0—3 / nextPlan 2—3） */
export const FIELD_MIN: Record<FieldKey, number> = {
  weekDone: 2,
  ongoing: 1,
  issues: 0,
  nextPlan: 2,
};

export const DEFAULT_TEMPLATE: TemplateField[] = [
  { key: 'weekDone', label: '本周完成', required: true, maxItems: 5, maxLen: 50 },
  { key: 'ongoing', label: '进行中', required: true, maxItems: 3, maxLen: 50 },
  { key: 'issues', label: '问题与风险', required: false, maxItems: 3, maxLen: 50 },
  { key: 'nextPlan', label: '下周计划', required: true, maxItems: 3, maxLen: 50 },
];

export const EMPTY_FIELDS: ReportFields = { weekDone: [], ongoing: [], issues: [], nextPlan: [] };

/** 多行文本 → 条目数组（一行一条，去空白、丢空行） */
export function textToItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/** 条目数组 → 多行文本 */
export function itemsToText(items: string[] | undefined): string {
  return (items ?? []).join('\n');
}

/** 四字段 → 编辑区文本（回填用） */
export function fieldsToText(fields: ReportFields): Record<FieldKey, string> {
  return {
    weekDone: itemsToText(fields.weekDone),
    ongoing: itemsToText(fields.ongoing),
    issues: itemsToText(fields.issues),
    nextPlan: itemsToText(fields.nextPlan),
  };
}

/** 编辑区文本 → 四字段（提交用） */
export function textToFields(text: Record<FieldKey, string>): ReportFields {
  return {
    weekDone: textToItems(text.weekDone),
    ongoing: textToItems(text.ongoing),
    issues: textToItems(text.issues),
    nextPlan: textToItems(text.nextPlan),
  };
}

/**
 * 前端校验（先于请求给出表单级提示，避免演示时被后端 400 打断）
 * 返回 null 表示通过；否则返回错误文案
 */
export function validateFields(fields: ReportFields, template: TemplateField[]): string | null {
  for (const key of FIELD_KEYS) {
    const field = template.find((t) => t.key === key);
    const label = field?.label ?? key;
    const items = fields[key] ?? [];
    // issues 为选填：0 条即表示「无风险」（TPL-03）
    const min = key === 'issues' ? 0 : FIELD_MIN[key];
    const max = field?.maxItems ?? 5;
    const maxLen = field?.maxLen ?? 50;

    if (items.length < min) {
      return `${label}至少填写 ${min} 条（当前 ${items.length} 条）`;
    }
    if (items.length > max) {
      return `${label}最多 ${max} 条（当前 ${items.length} 条）`;
    }
    const tooLong = items.find((item) => [...item].length > maxLen);
    if (tooLong !== undefined) {
      return `${label}每条不超过 ${maxLen} 字`;
    }
  }
  return null;
}

/** 列表「本周完成摘要」：取首条并截断 20 字（需求 4.4） */
export function summarize(text: string | undefined, max = 20): string {
  const first = (text ?? '').split(/\r?\n/).map((s) => s.trim()).find((s) => s !== '') ?? '';
  if (first === '') return '—';
  return [...first].length > max ? `${[...first].slice(0, max).join('')}…` : first;
}

/** 风险判定（OVR-01）：issues 非空且不为「暂无」 */
export function hasRisk(items: string[] | undefined): boolean {
  return (items ?? []).some((item) => {
    const text = item.trim();
    return text !== '' && text !== '暂无';
  });
}
