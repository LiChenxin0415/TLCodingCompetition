export type Role = 'employee' | 'leader' | 'center';
export type ContractStatus = 'draft' | 'submitted' | 'confirmed' | 'rejected' | 'rated' | 'published';
export type ItemType = '基础履职类' | '重点交付类' | '治理改善类' | '探索突破类';
export type Priority = '高' | '中' | '低';
export type DeliverableKind = 'file' | 'link';
export type ChangeReason = '上游调整' | '资源不足' | '估时不准' | '范围蔓延' | '临时插入任务';
export type ReportKind = 'daily' | 'weekly';

export interface User {
  id: string;
  name: string;
  role: Role;
  groupId: string | null;
  joinMonth: string;
}

export interface Group {
  id: string;
  name: string;
}

export interface Objective {
  id: string;
  name: string;
  groupId: string | null;
  ownerId: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

export interface Contract {
  id: string;
  userId: string;
  month: string;
  status: ContractStatus;
  submitAt: string | null;
  checkBy: string | null;
  publishAt: string | null;
}

export interface ContractItem {
  id: string;
  contractId: string;
  objectiveId: string | null;
  type: ItemType;
  priority: Priority;
  title: string;
  targetDesc: string;
  deliverableType: string;
  deliverableDesc: string;
  weight: number;
  dueDate: string;
  progress: number;
  source: 'manual' | 'AI';
  checked: number;
  score: number | null;
}

export interface Deliverable {
  id: string;
  itemId: string;
  kind: DeliverableKind;
  fileType: string | null;
  url: string;
  uploader: string;
  uploadAt: string;
  version: number;
}

export interface ProgressLog {
  id: string;
  itemId: string;
  operator: string;
  rawText: string;
  aiResult: string | null;
  delta: number;
  createdAt: string;
}

export interface Report {
  id: string;
  userId: string;
  kind: ReportKind;
  period: string;
  contentRef: string;
  aiSummary: string | null;
  linkedItemIds: string | null;
  version: number;
}

export interface ChangeLog {
  id: string;
  itemId: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  note: string;
  operator: string;
  createdAt: string;
}

export interface SkillTag {
  id: string;
  userId: string;
  tagName: string;
  score: number;
  evidenceItemIds: string | null;
  updatedAt: string;
  hidden: number;
}

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
  groupId: string | null;
}

export interface AiContractCheck {
  item_title: string;
  has_number: boolean;
  has_deadline: boolean;
  has_verifiable_verb: boolean;
  score: number;
  issues: string[];
}

export interface AiGeneratedItem {
  type: string;
  title: string;
  target_desc: string;
  deliverable: { type: string; desc: string };
  weight: number;
  priority: string;
  due_date: string;
  objective_id: string | null;
}

export interface AiContractResult {
  items: AiGeneratedItem[];
  total_weight: number;
  checks: AiContractCheck[];
}

export interface AiProgressResult {
  item_id: string | null;
  new_progress: number;
  delta: number;
  evidence: string[];
  confidence: number;
}