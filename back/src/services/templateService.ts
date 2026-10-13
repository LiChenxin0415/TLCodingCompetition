/**
 * 模板服务（TPL-01/02/03）
 * 需求依据：4.2 模板字段规范、api-spec GET /api/template
 * 说明：比赛版本模板固定内置、不建可编辑存储（自定义模板为 P2）。
 */

import { FIELD_SPECS, ITEM_MAX_LEN } from '../utils/validate.ts';
import type { TemplateField } from '../types.ts';

/** 前后端共用的四字段结构，前端不得硬编码 */
export const TEMPLATE_FIELDS: TemplateField[] = FIELD_SPECS.map((spec) => ({
  key: spec.key,
  label: spec.label,
  required: spec.required,
  maxItems: spec.max,
  maxLen: ITEM_MAX_LEN,
}));

export function getTemplate(): { fields: TemplateField[] } {
  return { fields: TEMPLATE_FIELDS.map((field) => ({ ...field })) };
}
