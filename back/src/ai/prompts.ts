export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function buildContractPrompt(desc: string, objectiveName: string | null): string {
  return [
    '你是科技部门的绩效合约助手。请把员工的一句话工作描述，拆解为 3—5 个结构化工作包。',
    '要求：',
    '1. 严格输出以下 JSON 结构，不要输出任何 JSON 以外的内容：',
    '{"items":[{"type":"任务类型","title":"工作包标题","target_desc":"可量化目标（含数字+时限+可验证动词）","deliverable":{"type":"交付物类型","desc":"交付物说明"},"weight":20,"priority":"高|中|低","due_date":"YYYY-MM-DD","objective_id":null}],"total_weight":100}',
    '2. 任务类型只能取：基础履职类 / 重点交付类 / 治理改善类 / 探索突破类。',
    '3. 交付物类型只能取：代码合并请求 / 设计文档 / 测试报告 / 数据报表 / 上线单 / PoC 结论报告 / 运维记录 / 其他。',
    '4. target_desc 必须包含数字、时限和可验证动词（如完成、上线、治理、降低、提升、交付）。',
    '5. weight 为整数百分比，合计必须等于 100。',
    '6. due_date 用本月内日期（YYYY-MM-DD）。',
    '7. 语言客观、动词开头，不编造输入中不存在的工作。',
    (objectiveName !== null ? '关联大目标：' + objectiveName : ''),
    '员工输入：' + desc,
  ].filter((s) => s !== '').join('\n');
}

export function buildProgressPrompt(text: string, items: Array<{ id: string; title: string; progress: number }>): string {
  return [
    '你是绩效进度解析助手。请从员工的一句话进展描述中，识别它命中了哪个工作包、新进度是多少。',
    '严格输出 JSON，不要输出 JSON 以外的内容：',
    '{"item_id":"命中的工作包id或null","new_progress":0,"delta":0,"evidence":["成果证据"],"confidence":0.0,"candidates":[{"item_id":"id","title":"标题"}]}',
    '规则：',
    '1. 从候选工作包中选最可能命中的一项，confidence 取值 0—1；无把握时 item_id 给 null 且 confidence 低于 0.6。',
    '2. new_progress 为 0—100 整数；delta 为相对当前进度的变化（正负整数）。',
    '3. candidates 给最可能的 1 个 + 备选 2 个（按可能性排序）。',
    '4. evidence 抽取文本中的成果/完成/交付等证据短语。',
    '5. 若文本无明确进展，item_id 为 null、confidence 低于 0.3。',
    '候选工作包（id|标题|当前进度）：',
    ...items.map((it) => it.id + '|' + it.title + '|' + it.progress),
    '员工进展文本：' + text,
  ].join('\n');
}

export function buildReportPrompt(text: string): string {
  return [
    '你是日报周报摘要助手。请从以下文本中提炼要点与建议关联的工作包。',
    '严格输出 JSON：',
    '{"summary":["要点1","要点2"],"suggestions":[{"title":"建议关联的工作包标题","delta":0,"reason":"理由"}]}',
    'summary 最多 5 条；suggestions 最多 3 条。',
    '文本：' + text,
  ].join('\n');
}