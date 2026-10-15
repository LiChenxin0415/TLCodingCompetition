import dayjs from 'dayjs';
import {
  DELIVERABLE_TYPES,
  ITEM_TYPES,
  type ContractItem,
  type ItemCheck,
  type ItemType,
} from '@/types';

/* ---------------- 日期工具 ---------------- */

export const currentMonth = () => dayjs().format('YYYY-MM');
export const today = () => dayjs().format('YYYY-MM-DD');
export const now = () => dayjs().format('YYYY-MM-DD HH:mm:ss');

/** 生成合约月份内的日期（FR-02/HLD §5.2：due_date 必须在合约月份内） */
export function dateInMonth(month: string, day: number): string {
  const start = dayjs(`${month}-01`);
  const maxDay = start.daysInMonth();
  return start.date(Math.min(Math.max(day, 1), maxDay)).format('YYYY-MM-DD');
}

/** 可选月份范围：入职月至今（FR-06 R1） */
export function monthRange(joinMonth: string): string[] {
  const list: string[] = [];
  let cur = dayjs(joinMonth + '-01');
  const end = dayjs(currentMonth() + '-01');
  while (!cur.isAfter(end)) {
    list.push(cur.format('YYYY-MM'));
    cur = cur.add(1, 'month');
  }
  return list.reverse();
}

/* ---------------- 权重（硬规则 1） ---------------- */

export const sumWeight = (items: Pick<ContractItem, 'weight'>[]) =>
  items.reduce((s, i) => s + (Number(i.weight) || 0), 0);

export const itemCountValid = (items: unknown[]) => items.length >= 3 && items.length <= 5;

/** AI 生成后归一化到 100（HLD §8 硬规则 1） */
export function normalizeWeights(items: { weight: number }[]): number[] {
  const raw = items.map((i) => Math.max(1, Number(i.weight) || 1));
  const total = raw.reduce((s, n) => s + n, 0);
  const norm = raw.map((n) => Math.round((n / total) * 100));
  const diff = 100 - norm.reduce((s, n) => s + n, 0);
  if (diff !== 0) norm[0] += diff;
  return norm;
}

/* ---------------- 体检（硬规则 2 / FR-02 R4，纯规则无 AI） ---------------- */

const VERIFIABLE_VERBS = [
  '完成', '上线', '交付', '治理', '发布', '降低', '提升', '压降', '收敛', '优化',
  '修复', '排查', '覆盖', '验证', '实现', '梳理', '缩短', '提高', '减少', '达标',
  '迁移', '接入', '落地', '扩容', '压测', '归档', '推广',
];

const NUMBER_RE = /\d|一|二|三|四|五|六|七|八|九|十|百|千|万/;

export interface CheckInput {
  title: string;
  target_desc: string;
  due_date?: string;
  deliverable_type?: string;
  deliverable_desc?: string;
}

/**
 * 体检扣分：100 −（无数字25 + 无可验证动词20 + 描述过短15 + 无时限20 + 无交付物20）
 * <80 标红并列出 issue（FR-02 R4）
 */
export function checkItem(input: CheckInput): ItemCheck {
  const text = `${input.title || ''}${input.target_desc || ''}`;
  const has_number = NUMBER_RE.test(text);
  const has_verifiable_verb = VERIFIABLE_VERBS.some((v) => text.includes(v));
  const too_short = (input.target_desc || '').trim().length < 10;
  const has_deadline = Boolean(input.due_date);
  const has_deliverable = Boolean(input.deliverable_desc || input.deliverable_type);

  const issues: string[] = [];
  let deduct = 0;
  if (!has_number) {
    issues.push('缺少可量化数字目标');
    deduct += 25;
  }
  if (!has_verifiable_verb) {
    issues.push('缺少可验证动词');
    deduct += 20;
  }
  if (too_short) {
    issues.push('目标描述过短');
    deduct += 15;
  }
  if (!has_deadline) {
    issues.push('缺少计划截止日');
    deduct += 20;
  }
  if (!has_deliverable) {
    issues.push('缺少约定交付物');
    deduct += 20;
  }

  return {
    item_title: input.title,
    has_number,
    has_deadline,
    has_verifiable_verb,
    score: Math.max(0, 100 - deduct),
    issues,
  };
}

export const isCheckFailed = (c: ItemCheck) => c.score < 80;

/* ---------------- 校验：合约可提交性 ---------------- */

export interface SubmitIssue {
  field: string;
  message: string;
}

export function validateContract(items: Partial<ContractItem>[]): SubmitIssue[] {
  const issues: SubmitIssue[] = [];
  if (!itemCountValid(items)) {
    issues.push({ field: 'count', message: `合约需包含 3–5 个工作包，当前 ${items.length} 个` });
  }
  const total = sumWeight(items as Pick<ContractItem, 'weight'>[]);
  if (total !== 100) {
    issues.push({ field: 'weight', message: `权重合计必须为 100%，当前 ${total}%` });
  }
  items.forEach((it, idx) => {
    const no = `第 ${idx + 1} 个「${it.title || '未命名'}」`;
    if (!it.type || !ITEM_TYPES.includes(it.type as ItemType)) {
      issues.push({ field: 'type', message: `${no}：任务类型必须是四类之一` });
    }
    if (!it.priority) issues.push({ field: 'priority', message: `${no}：优先级必填` });
    if (!it.title) issues.push({ field: 'title', message: `${no}：标题必填` });
    if (!it.target_desc) issues.push({ field: 'target_desc', message: `${no}：本月目标必填` });
    if (!it.due_date) issues.push({ field: 'due_date', message: `${no}：计划截止日必填` });
    if (!it.deliverable_type || !DELIVERABLE_TYPES.includes(it.deliverable_type as never)) {
      issues.push({ field: 'deliverable_type', message: `${no}：缺少交付物约定` });
    }
    if (!it.deliverable_desc) issues.push({ field: 'deliverable_desc', message: `${no}：交付物说明必填` });
    if (it.type !== '基础履职类' && !it.objective_id) {
      issues.push({ field: 'objective_id', message: `${no}：非基础履职类必须关联大目标（FR-04 R2）` });
    }
  });
  return issues;
}

/* ---------------- 评分（FR-09） ---------------- */

export const SCORE_TIERS: { range: string; tier: string; min: number; max: number }[] = [
  { range: '<80', tier: '严重不足', min: 0, max: 79 },
  { range: '80–89', tier: '明显不足', min: 80, max: 89 },
  { range: '90–99', tier: '轻微不足', min: 90, max: 99 },
  { range: '100', tier: '完整履约', min: 100, max: 100 },
  { range: '101–109', tier: '部分超额', min: 101, max: 109 },
  { range: '110–119', tier: '显著超额', min: 110, max: 119 },
  { range: '120', tier: '卓越超额（上限）', min: 120, max: 120 },
];

export function scoreTier(score: number): string {
  if (score < 80) return '严重不足';
  if (score < 90) return '明显不足';
  if (score < 100) return '轻微不足';
  if (score === 100) return '完整履约';
  if (score < 110) return '部分超额';
  if (score < 120) return '显著超额';
  return '卓越超额（上限）';
}

/** 无交付物封顶 95（FR-03 R4 / FR-09 R4） */
export const CAP_NO_DELIVERABLE = 95;

export interface ScoreCheck {
  ok: boolean;
  level: 'error' | 'warn' | 'ok';
  message?: string;
  /** 无交付物时 >95 需二次确认 + 理由 */
  needForce?: boolean;
}

/** 硬规则 3/6：档位 + 封顶 + 依据必填 */
export function validateScore(input: {
  score: number;
  hasDeliverable: boolean;
  basis?: string;
  forceReason?: string;
}): ScoreCheck {
  const { score, hasDeliverable, basis, forceReason } = input;
  if (score < 80 || score > 120) {
    return { ok: false, level: 'error', message: '评分范围须为 80–120 分' };
  }
  if (score !== 100 && !(basis && basis.trim())) {
    return { ok: false, level: 'error', message: '偏离 100 分须说明依据（FR-09 R1）' };
  }
  if (!hasDeliverable && score > CAP_NO_DELIVERABLE) {
    const forced = Boolean(forceReason && forceReason.trim());
    return {
      ok: forced,
      level: forced ? 'warn' : 'error',
      needForce: true,
      message: forced
        ? `交付物未上传，已强制评分 ${score} 分并留痕`
        : `交付物未上传，最高 ${CAP_NO_DELIVERABLE} 分`,
    };
  }
  return { ok: true, level: 'ok' };
}

/** 月度得分 = Σ(工作包评分 × 权重) ÷ 100，保留 1 位小数（PRD 硬规则 5） */
export function monthlyScore(items: { score?: number; weight: number }[]): number {
  const scored = items.filter((i) => typeof i.score === 'number');
  if (!scored.length) return 0;
  const sum = scored.reduce((s, i) => s + (i.score as number) * i.weight, 0);
  return Math.round((sum / 100) * 10) / 10;
}

/** 组内偏差提示（FR-09 R6，≥3 分提示，不拦截） */
export function deviationAdvice(score: number, avg: number): string | null {
  if (!avg || !score) return null;
  const d = Math.round((score - avg) * 10) / 10;
  if (Math.abs(d) < 3) return null;
  return d < 0
    ? `评分低于组内均值 ${Math.abs(d)} 分，请确认是否存在尺度偏严`
    : `评分高于组内均值 ${d} 分，请确认是否存在尺度偏松`;
}

/* ---------------- 大目标加权进度（FR-04 R3） ---------------- */

/** Σ(工作包进度 × 权重) ÷ Σ(权重)，保留 1 位小数 */
export function objectiveProgress(items: { progress: number; weight: number }[]): number {
  const total = items.reduce((s, i) => s + (Number(i.weight) || 0), 0);
  if (!total) return 0;
  const sum = items.reduce((s, i) => s + (Number(i.progress) || 0) * (Number(i.weight) || 0), 0);
  return Math.round((sum / total) * 10) / 10;
}

/* ---------------- 风险判定（FR-05 下钻 / 风险卡） ---------------- */

export function riskStatus(item: { due_date: string; progress: number }): '正常' | '风险' | '逾期' {
  const p = Number(item.progress) || 0;
  if (p >= 100) return '正常';
  const due = dayjs(item.due_date);
  const diff = due.diff(dayjs(today()), 'day');
  if (diff < 0) return '逾期';
  if (diff <= 5) return '风险';
  return '正常';
}
