/**
 * 数据模型 —— 对齐 HLD §5.1 表结构与 PRD §10
 */
export type Role = 'employee' | 'leader' | 'center';

export interface User {
  id: string;
  name: string;
  role: Role;
  group_id: string;
  join_month: string;
}

export interface Group {
  id: string;
  name: string;
  center_id?: string;
}

/** 任务类型（四类枚举，PRD FR-02 R1） */
export const ITEM_TYPES = ['基础履职类', '重点交付类', '治理改善类', '探索突破类'] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** 优先级（HLD §5.1 contract_items.priority 必填） */
export const PRIORITIES = ['高', '中', '低'] as const;
export type Priority = (typeof PRIORITIES)[number];

/** 交付物类型枚举（PRD FR-03） */
export const DELIVERABLE_TYPES = [
  '代码合并请求',
  '设计文档',
  '测试报告',
  '数据报表',
  '上线单',
  'PoC 结论报告',
  '运维记录',
  '其他',
] as const;
export type DeliverableType = (typeof DELIVERABLE_TYPES)[number];

/** 合约状态机（HLD §6.1） */
export const CONTRACT_STATUS = ['draft', 'submitted', 'confirmed', 'rejected', 'rated', 'published'] as const;
export type ContractStatus = (typeof CONTRACT_STATUS)[number];

export const CONTRACT_STATUS_TEXT: Record<ContractStatus, string> = {
  draft: '草稿',
  submitted: '待组长核对',
  confirmed: '执行中',
  rejected: '已退回',
  rated: '待中心校准',
  published: '已发布',
};

export interface Contract {
  id: string;
  user_id: string;
  month: string;
  status: ContractStatus;
  submit_at?: string;
  check_by?: string;
  publish_at?: string;
  score?: number;
  reject_reason?: string;
  reject_by?: string;
}

export interface ContractItem {
  id: string;
  contract_id: string;
  objective_id: string | null;
  type: ItemType;
  priority: Priority;
  title: string;
  target_desc: string;
  deliverable_type: DeliverableType;
  deliverable_desc: string;
  weight: number;
  due_date: string;
  progress: number;
  source: 'manual' | 'AI';
  checked: 0 | 1;
  /** 月末评分（FR-09），80–120 */
  score?: number;
  score_basis?: string;
}

export interface Objective {
  id: string;
  name: string;
  group_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  status: '进行中' | '已达成' | '已关闭';
  /** 计算值 Σ(progress×weight)/Σ(weight)，禁止人工写入（HLD §5.1） */
  progress: number;
}

export interface Deliverable {
  id: string;
  item_id: string;
  kind: 'file' | 'link';
  file_type: string;
  name: string;
  url: string;
  uploader: string;
  upload_at: string;
  version: number;
}

export interface ProgressLog {
  id: string;
  item_id: string;
  operator: string;
  raw_text: string;
  ai_result: {
    item_id: string;
    new_progress: number;
    delta: number;
    evidence: string;
    confidence: number;
  } | null;
  delta: number;
  created_at: string;
}

export interface ReportEntry {
  id: string;
  user_id: string;
  kind: 'daily' | 'weekly';
  period: string;
  content_ref: string;
  ai_summary: string[];
  linked_item_ids: string[];
  version: number;
}

/** 变更原因枚举（PRD §10 ChangeLog） */
export const CHANGE_REASONS = ['上游调整', '资源不足', '估时不准', '范围蔓延', '临时插入任务'] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

export interface ChangeLog {
  id: string;
  item_id: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: ChangeReason;
  note: string;
  operator: string;
  created_at: string;
}

export interface SkillTag {
  id: string;
  user_id: string;
  tag_name: string;
  score: number;
  evidence_item_ids: string[];
  updated_at: string;
  hidden: 0 | 1;
}

/** AI 体检结果（FR-02 R4） */
export interface ItemCheck {
  item_title: string;
  has_number: boolean;
  has_deadline: boolean;
  has_verifiable_verb: boolean;
  score: number;
  issues: string[];
}

export interface AiContractResult {
  items: Omit<ContractItem, 'id' | 'contract_id' | 'checked' | 'progress' | 'source'>[];
  total_weight: number;
  checks: ItemCheck[];
}

export interface ProgressParseCandidate {
  item_id: string;
  item_title: string;
  confidence: number;
}

/** AI 进度解析结果（FR-01） */
export interface ProgressParseResult {
  item_id: string | null;
  item_title: string | null;
  new_progress: number;
  delta: number;
  evidence: string;
  confidence: number;
  candidates: ProgressParseCandidate[];
  /** 命中 Rabbit：识别出"完成/验收通过"语义，提示上传交付物（FR-01 R5） */
  suggest_deliverable: boolean;
  /** 未识别到明确进展时为 true（FR-01 空态） */
  no_signal: boolean;
}

/** 看板指标键（FR-05 四张卡 + 驾驶舱补充的两张概览卡） */
export type MetricKey = 'total' | 'risk' | 'done' | 'published' | 'avgScore' | 'avgProgress';

export interface MetricCard {
  key: MetricKey;
  label: string;
  value: number;
  /** 单位后缀：个 / % / 分 */
  suffix?: string;
  /** 卡内副标题，例如「占总工作包 62.5%」 */
  caption?: string;
  tone: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** false 表示概览卡不支持下钻（如平均值类） */
  drillable: boolean;
  /** 迷你趋势序列，用于极值条形 indicate */
  trend?: number[];
}

export interface DrilldownRow {
  id: string;
  user_id: string;
  user_name: string;
  item_title: string;
  type: ItemType;
  objective_name: string;
  weight: number;
  progress: number;
  due_date: string;
  risk_status: '正常' | '风险' | '逾期';
  deliverable_status: '已上传' | '未上传';
  score?: number;
}

/* ---------------- 驾驶舱聚合视图（FR-05 / FR-04 / FR-09） ---------------- */

export type DrillLevel = 'center' | 'group' | 'person';

/** 大目标卡片：加权进度 + 贡献占比（FR-04 R3/R4） */
export interface ObjectiveBoard {
  id: string;
  name: string;
  group_name: string;
  owner_name: string;
  status: Objective['status'];
  /** 实时重算值 Σ(进度×权重)÷Σ(权重)，服务端口径（HLD §8） */
  progress: number;
  total_weight: number;
  link_count: number;
  done_count: number;
  risk_count: number;
  contributors: {
    item_id: string;
    user_id: string;
    user_name: string;
    item_title: string;
    weight: number;
    progress: number;
    /** 单包权重 ÷ 关联总权重 × 100 */
    contribution: number;
  }[];
}

/** 组维度排行 */
export interface GroupStat {
  group_id: string;
  group_name: string;
  member_count: number;
  contract_count: number;
  item_count: number;
  avg_progress: number;
  avg_score: number;
  risk_count: number;
  published_count: number;
}

/** 个人维度排行 */
export interface PersonStat {
  user_id: string;
  user_name: string;
  group_name: string;
  contract_status: ContractStatus | null;
  item_count: number;
  avg_progress: number;
  score: number | null;
  risk_count: number;
  undelivered_count: number;
}

/** 四类任务分布 */
export interface TypeSlice {
  type: ItemType;
  count: number;
  weight: number;
  avg_progress: number;
}

/** 评分档位分布（PRD FR-09 评分档位表） */
export interface TierSlice {
  tier: string;
  range: string;
  count: number;
  color: string;
}

/** 发布前置校验（FR-09 R5 三项） */
export interface PublishReadiness {
  ok: boolean;
  month: string;
  total_contract: number;
  published_count: number;
  checks: { key: string; label: string; passed: boolean; detail: string }[];
}

export interface DashboardOverview {
  month: string;
  /** 当前视角范围说明 */
  scope: { level: DrillLevel; group_id: string; group_name: string; member_count: number };
  updated_at: string;
  metrics: MetricCard[];
  objectives: ObjectiveBoard[];
  groups: GroupStat[];
  /** 组筛选选项：与当前 scope 无关，避免选中某组后候选项塌陷 */
  group_options: { group_id: string; group_name: string }[];
  persons: PersonStat[];
  type_slices: TypeSlice[];
  tier_slices: TierSlice[];
  risk_top: DrilldownRow[];
  readiness: PublishReadiness;
}

export interface CalibrationRow {
  user_id: string;
  user_name: string;
  contract_id: string;
  status: ContractStatus;
  score: number;
  /** 与组均值偏差 ≥3 分时的尺度提示（FR-09 R6） */
  deviation: number;
  advice: string | null;
  issues: string[];
}

/** 统一错误体（HLD §7） */
export interface ApiErrorBody {
  code: number;
  message: string;
}

export type AuthResult = { token: string; user: User };
