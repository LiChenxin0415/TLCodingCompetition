import dayjs from 'dayjs';
import type {
  ChangeLog,
  Contract,
  ContractItem,
  Deliverable,
  Group,
  Objective,
  ProgressLog,
  ReportEntry,
  SkillTag,
  User,
} from '@/types';
import { currentMonth, dateInMonth, monthlyScore, objectiveProgress, today } from '@/utils/rules';

export interface Db {
  users: User[];
  groups: Group[];
  objectives: Objective[];
  contracts: Contract[];
  items: ContractItem[];
  deliverables: Deliverable[];
  progressLogs: ProgressLog[];
  reports: ReportEntry[];
  changeLogs: ChangeLog[];
  skillTags: SkillTag[];
}

const M = currentMonth();
const PREV1 = dayjs(`${M}-01`).subtract(1, 'month').format('YYYY-MM');
const PREV2 = dayjs(`${M}-01`).subtract(2, 'month').format('YYYY-MM');

/** 造一个「已过期」的截止日（用于演示逾期/风险），限制在合约月内 */
const duePast = (month: string) => {
  const d = dayjs().date();
  return dateInMonth(month, month === M ? Math.max(1, d - 3) : 10);
};
const dueEnd = (month: string) => dateInMonth(month, 28);

/* ---------------- 用户 / 组织（HLD §15 种子账号） ---------------- */

const users: User[] = [
  { id: 'dept01', name: '王部长', role: 'center', group_id: 'grp_root', join_month: '2023-01' },
  { id: 'center01', name: '李中心', role: 'center', group_id: 'grp_root', join_month: '2023-03' },
  { id: 'leader01', name: '赵组长', role: 'leader', group_id: 'grp_a', join_month: '2023-05' },
  { id: 'leader02', name: '钱组长', role: 'leader', group_id: 'grp_b', join_month: '2023-06' },
  { id: 'member01', name: '张伟', role: 'employee', group_id: 'grp_a', join_month: '2024-03' },
  { id: 'member02', name: '李娜', role: 'employee', group_id: 'grp_a', join_month: '2024-07' },
  { id: 'member03', name: '王强', role: 'employee', group_id: 'grp_b', join_month: '2025-02' },
];

const groups: Group[] = [
  { id: 'grp_root', name: '科技部门', center_id: '' },
  { id: 'grp_a', name: 'A 组', center_id: 'grp_root' },
  { id: 'grp_b', name: 'B 组', center_id: 'grp_root' },
];

const objectives: Objective[] = [
  {
    id: 'obj_001',
    name: '核心系统分布式改造一期',
    group_id: 'grp_a',
    owner_id: 'leader01',
    start_date: '2026-09-01',
    end_date: '2026-12-31',
    status: '进行中',
    progress: 0,
  },
  {
    id: 'obj_002',
    name: '稳定性专项',
    group_id: 'grp_b',
    owner_id: 'leader02',
    start_date: '2026-10-01',
    end_date: '2026-12-31',
    status: '进行中',
    progress: 0,
  },
];

/* ---------------- 当月合约（P0 演示主数据） ---------------- */

const item = (i: Partial<ContractItem> & Pick<ContractItem, 'id' | 'contract_id'>): ContractItem => ({
  objective_id: null,
  type: '基础履职类',
  priority: '中',
  title: '',
  target_desc: '',
  deliverable_type: '其他',
  deliverable_desc: '',
  weight: 0,
  due_date: '',
  progress: 0,
  source: 'manual',
  checked: 0,
  ...i,
});

const c1 = `ctr_${M}_member01`;
const c2 = `ctr_${M}_member02`;

const contracts: Contract[] = [
  { id: c1, user_id: 'member01', month: M, status: 'confirmed', submit_at: `${M}-05 10:00:00`, check_by: 'leader01' },
  { id: c2, user_id: 'member02', month: M, status: 'confirmed', submit_at: `${M}-05 11:20:00`, check_by: 'leader01' },
];

const items: ContractItem[] = [
  // member01 —— 覆盖：AI 生成来源、逾期项、基础履职不挂大目标、PoC 探索
  item({
    id: 'itm_m1_1', contract_id: c1, type: '治理改善类', priority: '高', source: 'AI', checked: 1,
    title: '慢SQL治理', objective_id: 'obj_001',
    target_desc: '治理 10 条慢SQL，平均耗时下降 30%',
    deliverable_type: '数据报表', deliverable_desc: '治理清单 + 治理前后耗时对比报表',
    weight: 30, due_date: dateInMonth(M, 22), progress: 70,
  }),
  item({
    id: 'itm_m1_2', contract_id: c1, type: '重点交付类', priority: '高', source: 'AI', checked: 1,
    title: 'AB实验框架上线', objective_id: 'obj_001',
    target_desc: '完成 3 个业务场景接入并通过上线验收',
    deliverable_type: '上线单', deliverable_desc: '上线单 + 灰度验证结论',
    weight: 30, due_date: duePast(M), progress: 40,
  }),
  item({
    id: 'itm_m1_3', contract_id: c1, type: '基础履职类', priority: '中', checked: 1,
    title: '生产值班与工单处理',
    target_desc: '处理生产工单 40 单，响应及时率 100%',
    deliverable_type: '运维记录', deliverable_desc: '值班记录与工单台账',
    weight: 25, due_date: dueEnd(M), progress: 90,
  }),
  item({
    id: 'itm_m1_4', contract_id: c1, type: '探索突破类', priority: '低', checked: 1,
    title: '慢SQL自动巡检 PoC', objective_id: 'obj_002',
    target_desc: '完成 PoC 并在 1 个库完成验证，误报率低于 5%',
    deliverable_type: 'PoC 结论报告', deliverable_desc: 'PoC 结论报告 + 巡检样例',
    weight: 15, due_date: dateInMonth(M, 25), progress: 20,
  }),
  // member02 —— 覆盖：已完成待评分、无交付物（封顶 95 演示）
  item({
    id: 'itm_m2_1', contract_id: c2, type: '重点交付类', priority: '高', source: 'AI', checked: 1,
    title: '核心模块联调', objective_id: 'obj_001',
    target_desc: '完成 8 个接口联调并通过联调验收',
    deliverable_type: '测试报告', deliverable_desc: '联调测试报告 + 接口清单',
    weight: 35, due_date: dateInMonth(M, 18), progress: 100,
  }),
  item({
    id: 'itm_m2_2', contract_id: c2, type: '治理改善类', priority: '中', checked: 1,
    title: '告警降噪', objective_id: 'obj_001',
    target_desc: '告警量从日均 200 条降至 50 条以内',
    deliverable_type: '数据报表', deliverable_desc: '治理前后告警量对比报表',
    weight: 30, due_date: dateInMonth(M, 24), progress: 60,
  }),
  item({
    id: 'itm_m2_3', contract_id: c2, type: '基础履职类', priority: '中', checked: 1,
    title: '值班与故障响应',
    target_desc: '响应故障 15 次，平均恢复时长 30 分钟内',
    deliverable_type: '运维记录', deliverable_desc: '故障处理记录',
    weight: 20, due_date: dueEnd(M), progress: 85,
  }),
  item({
    id: 'itm_m2_4', contract_id: c2, type: '探索突破类', priority: '低', checked: 1,
    title: 'AI 辅助排障调研', objective_id: 'obj_002',
    target_desc: '产出 1 份调研报告并给出 2 个可落地场景',
    deliverable_type: '其他', deliverable_desc: '调研报告',
    weight: 15, due_date: dateInMonth(M, 26), progress: 30,
  }),
];

/* ---------------- 交付物（itm_m2_2 故意留空，用于演示封顶 95） ---------------- */

const deliverables: Deliverable[] = [
  {
    id: 'dlv_1', item_id: 'itm_m1_2', kind: 'file', file_type: 'docx',
    name: 'AB实验框架上线单.docx', url: 'mock://uploads/ab-online.docx',
    uploader: 'member01', upload_at: `${M}-08 15:20:00`, version: 1,
  },
  {
    id: 'dlv_2', item_id: 'itm_m2_1', kind: 'file', file_type: 'xlsx',
    name: '核心模块联调测试报告.xlsx', url: 'mock://uploads/lt-test.xlsx',
    uploader: 'member02', upload_at: `${M}-12 09:40:00`, version: 1,
  },
];

/* ---------------- 历史月（FR-06 P1：跨月对比数据） ---------------- */

const PAST_TEMPLATE: { type: ContractItem['type']; title: string; weight: number; score: number; basis?: string }[] = [
  { type: '治理改善类', title: '慢SQL治理', weight: 30, score: 105, basis: '提前完成 12 条治理，耗时下降 38%' },
  { type: '重点交付类', title: '核心模块联调', weight: 30, score: 100 },
  { type: '基础履职类', title: '生产值班与工单处理', weight: 25, score: 95, basis: '工单响应及时率 96%' },
  { type: '探索突破类', title: '灰度方案调研', weight: 15, score: 90, basis: '调研报告延期 2 天提交' },
];

function makeHistory(uid: string, month: string, scale: number) {
  const cid = `ctr_${month}_${uid}`;
  const list: ContractItem[] = PAST_TEMPLATE.map((t, i) =>
    item({
      id: `itm_${uid}_${month.replace('-', '')}_${i + 1}`,
      contract_id: cid,
      type: t.type,
      priority: i === 0 ? '高' : i === 1 ? '高' : '中',
      title: t.title,
      objective_id: t.type === '基础履职类' ? null : 'obj_001',
      target_desc: `${t.title}（历史月回放）`,
      deliverable_type: '数据报表',
      deliverable_desc: '月度交付物',
      weight: t.weight,
      due_date: dueEnd(month),
      progress: 100,
      source: 'manual',
      checked: 1,
      // scale：略作月度波动，用于跨月对比趋势
      score: Math.max(80, Math.min(120, Math.round(t.score * scale))),
      score_basis: t.basis,
    }),
  );
  const contract: Contract = {
    id: cid,
    user_id: uid,
    month,
    status: 'published',
    submit_at: `${month}-05 09:00:00`,
    check_by: 'leader01',
    publish_at: `${month}-30 18:00:00`,
    score: monthlyScore(list),
  };
  return { contract, list };
}

function buildSeed(): Db {
  const db: Db = {
    users,
    groups,
    objectives: objectives.map((o) => ({ ...o })),
    contracts: [...contracts],
    items: [...items],
    deliverables: [...deliverables],
    progressLogs: [],
    reports: [],
    changeLogs: [],
    skillTags: [],
  };

  // 历史两个月：member01 / member02 均已发布；member03 无历史（演示空态）
  const hist: { uid: string; month: string; scale: number }[] = [
    { uid: 'member01', month: PREV2, scale: 0.95 },
    { uid: 'member01', month: PREV1, scale: 1 },
    { uid: 'member02', month: PREV2, scale: 0.92 },
    { uid: 'member02', month: PREV1, scale: 0.98 },
  ];
  hist.forEach(({ uid, month, scale }) => {
    const { contract, list } = makeHistory(uid, month, scale);
    db.contracts.push(contract);
    db.items.push(...list);
  });

  // 进度留痕（FR-01 R6，同时作为能力画像证据）
  db.progressLogs.push(
    {
      id: 'plog_1', item_id: 'itm_m1_1', operator: 'member01',
      raw_text: '今天又治理了 3 条慢SQL，索引重建完成',
      ai_result: { item_id: 'itm_m1_1', new_progress: 70, delta: 20, evidence: '新增 3 条治理 + 索引重建', confidence: 0.91 },
      delta: 20, created_at: `${M}-10 18:20:00`,
    },
    {
      id: 'plog_2', item_id: 'itm_m1_2', operator: 'member01',
      raw_text: '灰度环境联调排查到第 2 个阻塞问题',
      ai_result: { item_id: 'itm_m1_2', new_progress: 40, delta: 15, evidence: '阻塞问题 2 个待解', confidence: 0.78 },
      delta: 15, created_at: `${M}-12 11:05:00`,
    },
  );

  // 大目标进度为计算值，初始化时算一次并落回 books(objectiveProgress)
  db.objectives.forEach((o) => {
    o.progress = objectiveProgress(db.items.filter((i) => i.objective_id === o.id));
  });

  return db;
}

/** 单例内存库：刷新页面即回到干净演示态 */
export const db: Db = buildSeed();

export const seedMeta = {
  currentMonth: M,
  prev1: PREV1,
  prev2: PREV2,
  today: today(),
};

/** 对外暴露的演示账号（登录页用） */
export const DEMO_ACCOUNTS = users.map((u) => ({
  id: u.id,
  name: u.name,
  role: u.role,
  group_id: u.group_id,
  group_name: groups.find((g) => g.id === u.group_id)?.name ?? '',
}));
