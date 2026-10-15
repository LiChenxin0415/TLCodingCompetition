// 演示种子数据（HLD §15 已确认：8 账号 + 2 大目标 + 边界态）
// 幂等：INSERT OR IGNORE，重复执行不覆盖现场数据
import type { DatabaseSync } from 'node:sqlite';
import { currentMonth } from '../utils/month.ts';

function fmtDate(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}
function nowStamp(): string {
  return fmtDate(new Date()) + ' ' + String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0');
}

interface SeedItem {
  id: string;
  type: string;
  priority: string;
  title: string;
  targetDesc: string;
  deliverableType: string;
  deliverableDesc: string;
  weight: number;
  dueDate: string;
  progress: number;
  objectiveId: string | null;
  source?: 'manual' | 'AI';
}

export function seedDemoData(db: DatabaseSync): { users: number; contracts: number; items: number } {
  const insGroup = db.prepare('INSERT OR IGNORE INTO groups (id, name) VALUES (?, ?)');
  insGroup.run('grp_a', 'A 组');
  insGroup.run('grp_b', 'B 组');

  const insUser = db.prepare('INSERT OR IGNORE INTO users (id, name, role, group_id, join_month) VALUES (?, ?, ?, ?, ?)');
  const users: Array<[string, string, string, string | null]> = [
    ['dept01', '王部长', 'center', null],
    ['center01', '李中心', 'center', null],
    ['leader01', '赵组长', 'leader', 'grp_a'],
    ['leader02', '钱组长', 'leader', 'grp_b'],
    ['member01', '张伟', 'employee', 'grp_a'],
    ['member02', '李娜', 'employee', 'grp_a'],
    ['member03', '王强', 'employee', 'grp_b'],
  ];
  for (const u of users) insUser.run(u[0], u[1], u[2], u[3], '2026-01');

  const insObj = db.prepare('INSERT OR IGNORE INTO objectives (id, name, group_id, owner_id, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
  insObj.run('obj_001', '核心系统分布式改造一期', 'grp_a', 'leader01', '2026-10-01', '2026-12-31', '进行中');
  insObj.run('obj_002', '稳定性专项', 'grp_b', 'leader02', '2026-10-01', '2026-12-31', '进行中');

  const month = currentMonth();

  const insContract = db.prepare('INSERT OR IGNORE INTO contracts (id, user_id, month, status, submit_at, check_by, publish_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insItem = db.prepare(`INSERT OR IGNORE INTO contract_items
    (id, contract_id, objective_id, type, priority, title, target_desc, deliverable_type, deliverable_desc, weight, due_date, progress, source, checked, score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insDlv = db.prepare('INSERT OR IGNORE INTO deliverables (id, item_id, kind, file_type, url, uploader, upload_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insLog = db.prepare('INSERT OR IGNORE INTO progress_logs (id, item_id, operator, raw_text, ai_result, delta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insTag = db.prepare('INSERT OR IGNORE INTO skill_tags (id, user_id, tag_name, score, evidence_item_ids, updated_at, hidden) VALUES (?, ?, ?, ?, ?, ?, ?)');

  let contracts = 0;
  let items = 0;

  // member01：3 个工作包，权重 30/40/30，覆盖「逾期风险 / 已完成 / 无交付物」
  insContract.run('ctr_member01_' + month, 'member01', month, 'confirmed', nowStamp(), 'leader01', null);
  contracts += 1;
  const m1Items: SeedItem[] = [
    { id: 'item_m01_1', type: '治理改善类', priority: '高', title: '慢SQL治理', targetDesc: '治理 10 条慢SQL，平均耗时下降 30%', deliverableType: '数据报表', deliverableDesc: '治理清单 + 治理前后耗时对比报表', weight: 30, dueDate: daysFromNow(-2), progress: 70, objectiveId: 'obj_001' },
    { id: 'item_m01_2', type: '重点交付类', priority: '高', title: '核心模块联调', targetDesc: '完成核心系统联调并通过测试', deliverableType: '代码合并请求', deliverableDesc: '核心模块联调 MR', weight: 40, dueDate: daysFromNow(3), progress: 100, objectiveId: 'obj_001' },
    { id: 'item_m01_3', type: '基础履职类', priority: '中', title: '生产稳定性保障', targetDesc: '保障生产稳定，工单及时处理', deliverableType: '运维记录', deliverableDesc: '本月运维工单记录', weight: 30, dueDate: daysFromNow(10), progress: 60, objectiveId: null },
  ];
  for (const it of m1Items) {
    insItem.run(it.id, 'ctr_member01_' + month, it.objectiveId, it.type, it.priority, it.title, it.targetDesc, it.deliverableType, it.deliverableDesc, it.weight, it.dueDate, it.progress, 'manual', 1, null);
    items += 1;
  }
  insDlv.run('dlv_m01_2', 'item_m01_2', 'link', null, 'https://git.example.com/mr/1002', 'member01', nowStamp(), 1);
  insLog.run('log_m01_1', 'item_m01_1', 'member01', '今天联调全部完成，环境问题已解决', JSON.stringify({ item_id: 'item_m01_1', new_progress: 70, delta: 20, confidence: 0.92 }), 20, nowStamp());
  insTag.run('tag_m01_1', 'member01', '数据库与 SQL 调优能力', 2, JSON.stringify(['item_m01_1']), nowStamp(), 0);

  // member02：2 个工作包，覆盖「无交付物 + 未完成」
  insContract.run('ctr_member02_' + month, 'member02', month, 'confirmed', nowStamp(), 'leader01', null);
  contracts += 1;
  const m2Items: SeedItem[] = [
    { id: 'item_m02_1', type: '重点交付类', priority: '高', title: '数据迁移脚本', targetDesc: '完成核心数据迁移脚本并灰度通过', deliverableType: '代码合并请求', deliverableDesc: '迁移脚本 MR', weight: 50, dueDate: daysFromNow(5), progress: 40, objectiveId: 'obj_001' },
    { id: 'item_m02_2', type: '基础履职类', priority: '中', title: '接口文档补全', targetDesc: '补全 20 个接口文档并通过评审', deliverableType: '设计文档', deliverableDesc: '接口文档', weight: 50, dueDate: daysFromNow(2), progress: 100, objectiveId: null },
  ];
  for (const it of m2Items) {
    insItem.run(it.id, 'ctr_member02_' + month, it.objectiveId, it.type, it.priority, it.title, it.targetDesc, it.deliverableType, it.deliverableDesc, it.weight, it.dueDate, it.progress, 'manual', 1, null);
    items += 1;
  }
  insDlv.run('dlv_m02_2', 'item_m02_2', 'link', null, 'https://git.example.com/doc/2001', 'member02', nowStamp(), 1);

  // member03：无合约（演示空态），不建 contract

  return { users: 7, contracts, items };
}