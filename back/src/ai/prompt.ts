/**
 * Prompt 组装
 * 需求依据：4.3（个人周报 Prompt 模板，逐字照抄）、6.3（团队周报输出契约）、OVR-06（四段结构）
 */

import type { TeamReportItem } from '../types.ts';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 个人周报生成 Prompt（需求 4.3 原文，{user_input} 占位替换） */
export function buildPersonalPrompt(userInput: string): string {
  return [
    '你是一名团队周报助手。请把用户输入的本周工作描述，整理为一份标准周报。',
    '要求：',
    '1. 严格输出以下JSON结构，不要输出任何JSON以外的内容：',
    '{"weekDone": ["条目1", "条目2"], "ongoing": ["条目（进度xx%）"], "issues": ["条目"], "nextPlan": ["条目"]}',
    '2. weekDone=本周完成：提炼已完成的关键工作，量化成果，2—5条，每条不超过50字；',
    '3. ongoing=进行中：提炼未完成工作，每条末尾标注估算进度（如"开发团队总览页（70%）"），1—3条；',
    '4. issues=问题与风险：提炼阻塞、风险与所需支持；用户输入中没有任何问题时填 ["暂无"]，0—3条；',
    '5. nextPlan=下周计划：基于输入合理推断下周关键工作，2—3条；',
    '6. 语言风格：客观、动词开头、删去口语化表达；不得编造输入中不存在的工作内容。',
    `用户输入：${userInput}`,
  ].join('\n');
}

const STATUS_LABEL: Record<string, string> = { draft: '草稿', submitted: '已提交' };

/** 把本周成员周报拼成可供模型阅读的文本块 */
function formatReportsBlock(items: TeamReportItem[]): string {
  return items
    .filter((item): item is TeamReportItem & { report: NonNullable<TeamReportItem['report']> } => item.report !== null)
    .map((item) => {
      const r = item.report;
      const lines = [
        `【${item.user.name}（${item.user.id}）｜${STATUS_LABEL[r.status] ?? r.status}】`,
        `本周完成：${r.weekDone.join('；') || '无'}`,
        `进行中：${r.ongoing.join('；') || '无'}`,
        `问题与风险：${r.issues.join('；') || '暂无'}`,
        `下周计划：${r.nextPlan.join('；') || '无'}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');
}

/** 团队周报汇总 Prompt（6.3 输出契约 + OVR-06 四段结构） */
export function buildTeamPrompt(week: string, items: TeamReportItem[]): string {
  return [
    '你是一名团队周报助手。请把团队成员的本周周报，汇总为一份团队级周报。',
    '要求：',
    '1. 严格输出以下JSON结构，不要输出任何JSON以外的内容：',
    '{"overall": "整体进展（2—3句）", "achievements": ["成员姓名：成果条目"], "risks": ["成员姓名：风险条目"], "nextFocus": ["重点条目"]}',
    '2. overall=整体进展：2—3句概括团队本周整体状态；',
    '3. achievements=关键成果：按成员聚合的成果条目，标注成员姓名，3—6条；',
    '4. risks=风险集中点：聚合全员问题与风险，无风险时输出 ["本周无明显风险"]；',
    '5. nextFocus=下周重点：按成员或按主题归纳，3—5条；',
    '6. 语言风格：客观、动词开头、删去口语化表达；不得编造周报中不存在的工作内容。',
    `本周（${week}）成员周报如下：`,
    formatReportsBlock(items),
  ].join('\n');
}
