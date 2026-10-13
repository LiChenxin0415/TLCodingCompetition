/**
 * 演示种子数据（REP-04 / 需求 4.1）
 * 唯一数据来源：material/design/demo-data-seed-v1.md
 *
 * 幂等：使用 INSERT OR IGNORE + (user_id, week) 唯一约束，
 * 重复执行不会覆盖现场演示中已修改的数据。
 */

import type { DatabaseSync } from 'node:sqlite';
import { currentWeek, shiftWeek, formatDateTimeFull } from '../utils/isoWeek.ts';
import type { ReportStatus, Role } from '../types.ts';

interface SeedUser {
  id: string;
  name: string;
  role: Role;
}

interface SeedReport {
  userId: string;
  weekOffset: number; // 相对当前周：-1=上一周 {CW-1}，-2={CW-2}
  status: ReportStatus;
  weekDone: string[];
  ongoing: string[];
  issues: string[];
  nextPlan: string[];
}

/** 预置 4 账号（需求 4.1，免密登录） */
export const SEED_USERS: SeedUser[] = [
  { id: 'leader01', name: '王负责人', role: 'leader' },
  { id: 'member01', name: '李成员', role: 'member' },
  { id: 'member02', name: '张成员', role: 'member' },
  { id: 'member03', name: '刘成员', role: 'member' },
];

/** 历史周报样例（demo-data-seed-v1.md 第三节，逐条照抄） */
export const SEED_REPORTS: SeedReport[] = [
  {
    userId: 'member01',
    weekOffset: -1,
    status: 'submitted',
    weekDone: ['完成登录模块接口联调', '周报模板查询接口上线', 'AI 生成接口联调通过'],
    ongoing: ['团队总览页开发（70%）', '权限用例编写（40%）'],
    issues: ['暂无'],
    nextPlan: ['团队总览页联调', '权限边界测试', '演示数据灌入'],
  },
  {
    userId: 'member01',
    weekOffset: -2,
    status: 'draft',
    weekDone: ['需求评审与接口契约冻结', '项目脚手架搭建'],
    ongoing: ['登录页开发（90%）'],
    issues: ['AI 模型 Key 未到位，待后端配置'],
    nextPlan: ['登录接口联调', '周报编辑页开发'],
  },
  {
    userId: 'member02',
    weekOffset: -1,
    status: 'submitted',
    weekDone: ['成员周报管理页接口', '数据库表设计与建表'],
    ongoing: ['导出功能开发（30%）'],
    issues: ['导出 .txt 编码乱码，需确认 UTF-8', '测试环境数据库偶发连接超时'],
    nextPlan: ['导出功能修复', '联调自测', '补充单测'],
  },
  {
    userId: 'member03',
    weekOffset: -1,
    status: 'draft',
    weekDone: ['UI 原型走查', '前端路由与守卫搭建'],
    ongoing: ['周报编辑页组件开发（50%）'],
    issues: ['暂无'],
    nextPlan: ['编辑页四字段组件', '接入 AI 生成按钮', '对接模板接口'],
  },
];

export interface SeedResult {
  users: number;
  reports: number;
}

export function seedDemoData(db: DatabaseSync): SeedResult {
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, role) VALUES (?, ?, ?)');
  let users = 0;
  for (const u of SEED_USERS) {
    const res = insertUser.run(u.id, u.name, u.role);
    users += Number(res.changes);
  }

  const insertReport = db.prepare(
    `INSERT OR IGNORE INTO weekly_reports
       (id, user_id, week, week_done, ongoing, issues, next_plan, status, last_editor_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const cw = currentWeek();
  let reports = 0;
  for (const r of SEED_REPORTS) {
    const week = shiftWeek(cw, r.weekOffset);
    // 历史周报的更新时间：按"该周周日"折算，便于列表展示倒序
    const updatedAt = formatDateTimeFull(new Date(Date.now() + r.weekOffset * 7 * 86_400_000));
    const res = insertReport.run(
      `rpt_seed_${r.userId}_${week}`,
      r.userId,
      week,
      JSON.stringify(r.weekDone),
      JSON.stringify(r.ongoing),
      JSON.stringify(r.issues),
      JSON.stringify(r.nextPlan),
      r.status,
      r.userId,
      updatedAt,
    );
    reports += Number(res.changes);
  }

  return { users, reports };
}
