// 核心算法（PRD 硬规则落地，纯规则、无 AI）
// FR-02 R4 体检扣分 / FR-04 R3 大目标加权进度 / FR-09 月度得分与档位 / FR-08 R1 能力标签打分

const VERIFIABLE_VERBS = ['完成', '上线', '发布', '治理', '降低', '提升', '优化', '覆盖', '迁移', '改造', '交付', '达标', '落地', '修复', '输出', '通过', '达成', '解决', '统一', '梳理', '建设', '重构', '接入', '沉淀', '保障', '验证', '推广'];

export interface CheckInput {
  targetDesc: string;
  dueDate: string;
  deliverableType: string;
  deliverableDesc: string;
}

export interface CheckResult {
  score: number;
  issues: string[];
  hasNumber: boolean;
  hasDeadline: boolean;
  hasVerifiableVerb: boolean;
}

const hasNumber = (text: string): boolean => /\d/.test(text);
const hasVerb = (text: string): boolean => VERIFIABLE_VERBS.some((verb) => text.includes(verb));

/** FR-02 R4：体检得分 = 100 − 扣分项；<80 标红 */
export function checkItem(input: CheckInput): CheckResult {
  const issues: string[] = [];
  let penalty = 0;
  const number = hasNumber(input.targetDesc);
  const verb = hasVerb(input.targetDesc);
  const deadline = input.dueDate !== undefined && input.dueDate !== null && input.dueDate.trim() !== '';
  const deliverable = (input.deliverableType.trim() !== '' && input.deliverableType !== '其他') || input.deliverableDesc.trim() !== '';
  if (!number) { penalty += 25; issues.push('缺少可量化数字目标'); }
  if (!verb) { penalty += 20; issues.push('缺少可验证动词'); }
  if (input.targetDesc.trim().length < 8) { penalty += 15; issues.push('目标描述过短'); }
  if (!deadline) { penalty += 20; issues.push('缺少截止时限'); }
  if (!deliverable) { penalty += 20; issues.push('缺少交付物约定'); }
  return { score: Math.max(0, 100 - penalty), issues, hasNumber: number, hasDeadline: deadline, hasVerifiableVerb: verb };
}

/** FR-04 R3：大目标进度 = Σ(progress×weight)/Σ(weight)，保留 1 位小数 */
export function objectiveProgress(items: Array<{ progress: number; weight: number }>): number {
  let sumWeight = 0;
  let sum = 0;
  for (const item of items) {
    sumWeight += item.weight;
    sum += item.progress * item.weight;
  }
  if (sumWeight === 0) return 0;
  return Math.round((sum / sumWeight) * 10) / 10;
}

/** FR-09：个人月度得分 = Σ(score×weight)/100，保留 1 位小数；未评分项忽略 */
export function monthlyScore(items: Array<{ score: number | null; weight: number }>): number | null {
  let sum = 0;
  let rated = 0;
  for (const item of items) {
    if (item.score !== null) {
      sum += item.score * item.weight;
      rated += 1;
    }
  }
  if (rated === 0) return null;
  return Math.round((sum / 100) * 10) / 10;
}

/** FR-09 评分档位：返回档位名（用于展示与依据校验） */
export function scoreBand(score: number): string {
  if (score < 80) return '严重不足';
  if (score < 90) return '明显不足';
  if (score < 95) return '轻微不足';
  if (score === 100) return '完整履约';
  if (score <= 105) return '部分超额';
  if (score <= 110) return '显著超额';
  return '卓越超额';
}