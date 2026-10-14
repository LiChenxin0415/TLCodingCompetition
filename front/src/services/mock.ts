/**
 * Mock 适配器（VITE_USE_MOCK=true 时启用）
 * 目的：接口契约冻结后前端可独立跑通全流程，后端就绪后切 VITE_USE_MOCK=false 即可联调。
 * 数据规格见 material/design/demo-data-seed-v1.md。
 */
import { ApiError, type LoginResult, type Report, type ReportFields, type ReportStatus, type TeamRow, type TeamSummary, type TemplateField, type User } from '@/types';
import { currentWeek, nowStamp, weekByOffset } from '@/utils/isoWeek';

const DB_KEY = 'tl_mock_db';
const CW = currentWeek();
const CW_1 = weekByOffset(-1);
const CW_2 = weekByOffset(-2);

const USERS: User[] = [
  { id: 'leader01', name: '王负责人', role: 'leader' },
  { id: 'member01', name: '李成员', role: 'member' },
  { id: 'member02', name: '张成员', role: 'member' },
  { id: 'member03', name: '刘成员', role: 'member' },
];

const TEMPLATE: TemplateField[] = [
  { key: 'weekDone', label: '本周完成', required: true, maxItems: 5, maxLen: 50 },
  { key: 'ongoing', label: '进行中', required: true, maxItems: 3, maxLen: 50 },
  { key: 'issues', label: '问题与风险', required: false, maxItems: 3, maxLen: 50 },
  { key: 'nextPlan', label: '下周计划', required: true, maxItems: 3, maxLen: 50 },
];

let seq = 100;
const uid = () => `rpt_${Date.now().toString(36)}_${seq++}`;

function seedReports(): Report[] {
  const mk = (
    userId: string,
    week: string,
    status: ReportStatus,
    f: ReportFields,
    lastEditorId: string,
  ): Report => ({
    id: uid(),
    userId,
    week,
    status,
    lastEditorId,
    updatedAt: nowStamp(),
    ...f,
  });

  return [
    mk(
      'member01',
      CW_1,
      'submitted',
      {
        weekDone: ['完成登录模块接口联调', '周报模板查询接口上线', 'AI 生成接口联调通过'],
        ongoing: ['团队总览页开发（70%）', '权限用例编写（40%）'],
        issues: ['暂无'],
        nextPlan: ['团队总览页联调', '权限边界测试', '演示数据灌入'],
      },
      'member01',
    ),
    mk(
      'member01',
      CW_2,
      'draft',
      {
        weekDone: ['需求评审与接口契约冻结', '项目脚手架搭建'],
        ongoing: ['登录页开发（90%）'],
        issues: ['AI 模型 Key 未到位，待后端配置'],
        nextPlan: ['登录接口联调', '周报编辑页开发'],
      },
      'member01',
    ),
    mk(
      'member02',
      CW_1,
      'submitted',
      {
        weekDone: ['成员周报管理页接口', '数据库表设计与建表'],
        ongoing: ['导出功能开发（30%）'],
        issues: ['导出 .txt 编码乱码，需确认 UTF-8', '测试环境数据库偶发连接超时'],
        nextPlan: ['导出功能修复', '联调自测', '补充单测'],
      },
      'member02',
    ),
    mk(
      'member03',
      CW_1,
      'draft',
      {
        weekDone: ['UI 原型走查', '前端路由与守卫搭建'],
        ongoing: ['周报编辑页组件开发（50%）'],
        issues: ['暂无'],
        nextPlan: ['编辑页四字段组件', '接入 AI 生成按钮', '对接模板接口'],
      },
      'member03',
    ),
  ];
}

function loadDb(): Report[] {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw) as Report[];
  } catch {
    /* 忽略损坏数据，重新播种 */
  }
  const seeded = seedReports();
  saveDb(seeded);
  return seeded;
}

function saveDb(db: Report[]): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function currentUserId(): string {
  const token = localStorage.getItem('tl_weekly_token') || '';
  const m = /^mock\.([a-z0-9]+)\./.exec(token);
  return m ? m[1] : '';
}

/** 简易「AI 生成」：按标点切句填入四字段，保证演示可走通（真实实现由后端 AIService 完成） */
function fakeGenerate(input: string): ReportFields {
  const clauses = input
    .split(/[。！？；;\n，,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.length > 30 ? `${s.slice(0, 30)}…` : s));

  const weekDone = clauses.slice(0, 3);
  const ongoing = clauses.slice(3, 5);
  const nextPlan = clauses.slice(5, 8);

  return {
    weekDone: weekDone.length ? weekDone : ['（AI 整理）本周主要推进了上述工作'],
    ongoing: ongoing.length ? ongoing : ['待补充：进行中事项'],
    issues: ['暂无'],
    nextPlan: nextPlan.length ? nextPlan : ['待补充：下周计划'],
  };
}

export const mock = {
  async login(userId: string): Promise<LoginResult> {
    await delay(200);
    const user = USERS.find((u) => u.id === userId);
    if (!user) throw new ApiError(400, '账号不存在');
    return { token: `mock.${userId}.${Date.now()}`, user };
  },

  async getTemplate(): Promise<TemplateField[]> {
    await delay(120);
    return TEMPLATE;
  },

  async getMyReports(): Promise<Report[]> {
    await delay(200);
    const me = currentUserId();
    return loadDb()
      .filter((r) => r.userId === me)
      .sort((a, b) => b.week.localeCompare(a.week));
  },

  async createReport(payload: ReportFields & { status: ReportStatus }): Promise<Report> {
    await delay(250);
    const me = currentUserId();
    const db = loadDb();
    const exist = db.find((r) => r.userId === me && r.week === CW);
    if (exist) return mock.updateReport(exist.id, payload);
    const report: Report = {
      id: uid(),
      userId: me,
      week: CW,
      status: payload.status,
      lastEditorId: me,
      updatedAt: nowStamp(),
      weekDone: payload.weekDone,
      ongoing: payload.ongoing,
      issues: payload.issues ?? [],
      nextPlan: payload.nextPlan,
    };
    db.push(report);
    saveDb(db);
    return report;
  },

  async getReport(id: string): Promise<Report> {
    await delay(150);
    const r = loadDb().find((x) => x.id === id);
    if (!r) throw new ApiError(404, '周报不存在');
    return r;
  },

  async updateReport(id: string, payload: Partial<ReportFields> & { status?: ReportStatus }): Promise<Report> {
    await delay(250);
    const me = currentUserId();
    const db = loadDb();
    const idx = db.findIndex((x) => x.id === id);
    if (idx < 0) throw new ApiError(404, '周报不存在');
    const target = db[idx];
    // 权限：本人或 leader 才可改（AUTH-02）
    if (target.userId !== me && USERS.find((u) => u.id === me)?.role !== 'leader') {
      throw new ApiError(403, '无权限访问');
    }
    const next: Report = {
      ...target,
      weekDone: payload.weekDone ?? target.weekDone,
      ongoing: payload.ongoing ?? target.ongoing,
      issues: payload.issues ?? target.issues,
      nextPlan: payload.nextPlan ?? target.nextPlan,
      status: payload.status ?? target.status,
      lastEditorId: me,
      updatedAt: nowStamp(),
    };
    db[idx] = next;
    saveDb(db);
    return next;
  },

  async getTeamReports(week: string = CW): Promise<TeamRow[]> {
    await delay(250);
    const me = currentUserId();
    if (!USERS.find((u) => u.id === me && u.role === 'leader')) throw new ApiError(403, '无权限访问');
    const db = loadDb();
    return USERS.filter((u) => u.role === 'member').map((user) => ({
      user,
      report: db.find((r) => r.userId === user.id && r.week === week) ?? null,
    }));
  },

  async generateReport(input: string): Promise<ReportFields> {
    if (!input || !input.trim()) throw new ApiError(400, '请输入本周工作内容');
    if (input.length > 2000) throw new ApiError(400, '输入内容过长');
    await delay(900);
    return fakeGenerate(input);
  },

  async generateTeamSummary(week: string = CW): Promise<TeamSummary> {
    await delay(1200);
    const rows = await mock.getTeamReports(week);
    const filled = rows.filter((r) => r.report);
    if (!filled.length) throw new ApiError(400, '暂无可汇总的周报');

    const submitted = filled.filter((r) => r.report!.status === 'submitted');
    const notStarted = rows.filter((r) => !r.report);

    const achievements = filled.map(
      (r) => `${r.user.name}：${r.report!.weekDone[0] ?? '本周无明确产出'}`,
    );
    const risks: string[] = [];
    filled.forEach((r) => {
      const issues = (r.report!.issues ?? []).filter((i) => i && i !== '暂无');
      if (issues.length) risks.push(`${r.user.name}：${issues.join('；')}`);
    });
    notStarted.forEach((r) => risks.push(`${r.user.name}：本周未开始`));

    const nextFocus = Array.from(
      new Set(filled.flatMap((r) => r.report!.nextPlan ?? []).filter(Boolean)),
    ).slice(0, 5);

    return {
      overall: `本周共 ${rows.length} 名成员，${submitted.length} 人已提交、${
        filled.length - submitted.length
      } 人为草稿、${notStarted.length} 人未开始；整体推进正常${risks.length ? '，存在需关注的风险项' : '，无明显风险'}。`,
      achievements,
      risks: risks.length ? risks : ['本周无明显风险'],
      nextFocus: nextFocus.length ? nextFocus : ['待补充'],
    };
  },

  async exportTeamSummary(week: string = CW): Promise<{ filename: string; content: string }> {
    const s = await mock.generateTeamSummary(week);
    const content = [
      '整体进展：',
      s.overall,
      '',
      '关键成果：',
      ...s.achievements.map((i) => `- ${i}`),
      '',
      '风险集中点：',
      ...s.risks.map((i) => `- ${i}`),
      '',
      '下周重点：',
      ...s.nextFocus.map((i) => `- ${i}`),
    ].join('\n');
    return { filename: `团队周报_${week}.txt`, content };
  },
};
