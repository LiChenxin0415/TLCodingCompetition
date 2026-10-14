#!/usr/bin/env node
/**
 * AI 智能周报系统 · 可执行 API 测试脚本
 * =====================================
 * 依据 material/requirements/test-cases-v1.md 的规则 ID（AUTH/LOGIN/TPL/GEN/REP/LEAD/OVR/EDGE）
 * 逐条实现为可执行用例，直接对运行中的后端发起真实 HTTP 请求并断言响应。
 *
 * 用法：
 *   node test/api-tests.mjs --base http://127.0.0.1:3012 --phase ai       # AI 启用（Mock LLM 运行中）
 *   node test/api-tests.mjs --base http://127.0.0.1:3012 --phase fail     # AI 调用失败（Mock LLM 已停止）
 *   node test/api-tests.mjs --base http://127.0.0.1:3013 --phase degraded # 降级模式（AI_ENABLED=false）
 *
 * 参数：
 *   --base   后端基地址（默认 http://127.0.0.1:3012）
 *   --phase  运行阶段：ai / fail / degraded（默认 ai）
 *   --out    结果输出 JSON（默认 test/results/api-results.json，按 phase 合并）
 *
 * 退出码：全部通过为 0，存在失败为 1。
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---------------------------------------------------------------- CLI 参数
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const BASE = argOf('base', 'http://127.0.0.1:3012');
const PHASE = argOf('phase', 'ai');
const OUT = resolve(argOf('out', 'test/results/api-results.json'));

// ------------------------------------------------- ISO 周工具（与服务端 isoWeek.ts 同算法，UTC 计算）
const MS_PER_DAY = 86_400_000;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

function isoWeekOfUtc(date) {
  const d = new Date(date.getTime());
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function weekStartUtc(week) {
  const m = WEEK_RE.exec(week);
  if (!m) return null;
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4));
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const firstMonday = jan4.getTime() - (jan4IsoDay - 1) * MS_PER_DAY;
  return new Date(firstMonday + (Number(m[2]) - 1) * 7 * MS_PER_DAY);
}

function shiftWeek(week, offsetWeeks) {
  const monday = weekStartUtc(week);
  if (monday === null) throw new Error(`非法周次：${week}`);
  return isoWeekOfUtc(new Date(monday.getTime() + offsetWeeks * 7 * MS_PER_DAY));
}

// ---------------------------------------------------------------- HTTP 封装
async function api(method, path, { token, body, timeoutMs = 10_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // ignoreBOM:true 保留文本前的 BOM 字符；BOM 是否存在以原始字节为准（fetch 默认会剥离）
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 响应（如导出文件） */
    }
    return { status: res.status, json, text, bytes, headers: res.headers, elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/** 原始字节前 3 位为 EF BB BF → 文件带 UTF-8 BOM（Windows 记事本防乱码） */
const hasUtf8Bom = (res) => res.bytes.length >= 3 && res.bytes[0] === 0xef && res.bytes[1] === 0xbb && res.bytes[2] === 0xbf;

/** 断言辅助：返回统一结果结构 */
const judge = (pass, expected, actual) => ({ pass: Boolean(pass), expected, actual });

// ---------------------------------------------------------------- 测试数据
const VALID_FIELDS = {
  weekDone: ['完成周报模块接口联调', '编写接口冒烟用例'],
  ongoing: ['团队总览页联调（50%）'],
  issues: ['暂无'],
  nextPlan: ['完成总览页联调', '补充权限测试'],
};

const MOCK_PERSONAL = {
  weekDone: ['完成登录接口联调', '周报模块 CRUD 实现'],
  ongoing: ['权限校验模块（60%）'],
  issues: ['暂无'],
  nextPlan: ['权限用例测试', '总览页联调'],
};

const MOCK_TEAM = {
  overall: '本周团队整体推进顺利，核心接口联调完成，总览页待收尾。',
  achievements: ['李成员：完成登录与周报 CRUD', '张成员：模板查询接口', '王负责人：代补风险说明'],
  risks: ['刘成员：权限测试阻塞，需后端支持'],
  nextFocus: ['权限用例测试', '团队总览页联调', '演示数据灌入'],
};

// ---------------------------------------------------------------- 用例定义
/** ctx: { tokens: Map, state: Object, week: 当前周, lastWeek, weekBeforeLast } */
const CASES = [
  // ============================================================ 登录 LOGIN
  {
    id: 'TC-LOGIN-01', rule: 'LOGIN-01', title: '预置账号列表（登录页账号卡片数据源）', priority: 'P0', phase: 'any',
    expected: 'GET /api/login/accounts 返回 4 个预置账号，含 leader01/王负责人/leader 与 3 名成员',
    async run(ctx) {
      const res = await api('GET', '/api/login/accounts');
      const accounts = res.json?.accounts ?? [];
      const leader = accounts.find((a) => a.id === 'leader01');
      const members = accounts.filter((a) => a.role === 'member');
      return judge(
        res.status === 200 && accounts.length === 4 && leader?.name === '王负责人' && leader?.role === 'leader' && members.length === 3,
        '200，4 个账号（1 leader + 3 member），leader01=王负责人',
        `status=${res.status}，账号数=${accounts.length}，leader=${JSON.stringify(leader)}`,
      );
    },
  },
  {
    id: 'TC-LOGIN-02', rule: 'LOGIN-02', title: '免密登录签发 token（成员/负责人两种角色）', priority: 'P0', phase: 'any',
    expected: 'POST /api/login {userId} 返回 token 与 user；member01→role=member，leader01→role=leader',
    async run(ctx) {
      const m = await api('POST', '/api/login', { body: { userId: 'member01' } });
      const l = await api('POST', '/api/login', { body: { userId: 'leader01' } });
      if (m.status !== 200 || typeof m.json?.token !== 'string' || m.json.token === '') {
        return judge(false, 'member01 登录返回 200 + 非空 token', `status=${m.status} body=${m.text.slice(0, 120)}`);
      }
      ctx.tokens.set('member01', m.json.token);
      ctx.tokens.set('leader01', l.json.token);
      return judge(
        l.status === 200 && m.json.user?.role === 'member' && l.json.user?.role === 'leader',
        'member01.role=member，leader01.role=leader',
        `member01.role=${m.json.user?.role}，leader01.role=${l.json.user?.role}`,
      );
    },
  },
  {
    id: 'TC-LOGIN-02b', rule: 'LOGIN-02', title: '未知 userId 登录被拒绝', priority: 'P1', phase: 'any',
    expected: 'POST /api/login {userId:"ghost"} 返回 400，message 含用户不存在',
    async run() {
      const res = await api('POST', '/api/login', { body: { userId: 'ghost' } });
      return judge(
        res.status === 400 && res.json?.code === 400 && /不存在/.test(res.json?.message ?? ''),
        '400 {code:400, message 含"不存在"}',
        `status=${res.status} body=${res.text.slice(0, 120)}`,
      );
    },
  },
  {
    id: 'TC-LOGIN-03', rule: 'LOGIN-03 / AUTH-03', title: '未登录 / 伪造 token 访问受保护接口', priority: 'P0', phase: 'any',
    expected: '无 token 与伪造 token 访问 GET /api/reports/mine 均返回 401',
    async run() {
      const noToken = await api('GET', '/api/reports/mine');
      const badToken = await api('GET', '/api/reports/mine', { token: 'invalid.token.value' });
      return judge(
        noToken.status === 401 && badToken.status === 401 && noToken.json?.code === 401,
        '两种场景均 401 {code:401}',
        `无token=${noToken.status}，伪造token=${badToken.status}（${badToken.text.slice(0, 80)}）`,
      );
    },
  },

  // ============================================================ 权限 AUTH
  {
    id: 'TC-AUTH-01', rule: 'AUTH-02', title: '越权读取他人周报被服务端拦截', priority: 'P0', phase: 'ai',
    expected: 'member01 读 member02 的上周周报 → 403 {code:403, message:"无权限访问"}',
    async run(ctx) {
      const team = await api('GET', `/api/reports/team?week=${ctx.lastWeek}`, { token: ctx.tokens.get('leader01') });
      const target = (team.json ?? []).find((item) => item.user.id === 'member02')?.report;
      if (!target?.id) return judge(false, '先通过负责人视图取到 member02 上周周报', `team 响应异常：${team.text.slice(0, 120)}`);
      ctx.state.member02LastWeekId = target.id;
      const res = await api('GET', `/api/reports/${target.id}`, { token: ctx.tokens.get('member01') });
      return judge(
        res.status === 403 && res.json?.message === '无权限访问',
        '403 + "无权限访问"',
        `status=${res.status} body=${res.text.slice(0, 120)}`,
      );
    },
  },
  {
    id: 'TC-AUTH-02', rule: 'AUTH-02', title: '成员数据隔离（仅见本人周报）', priority: 'P0', phase: 'ai',
    expected: 'member01 GET /api/reports/mine 仅返回本人数据（写入前应为 2 条种子历史）',
    async run(ctx) {
      const res = await api('GET', '/api/reports/mine', { token: ctx.tokens.get('member01') });
      const list = res.json ?? [];
      const foreign = list.filter((r) => r.userId !== 'member01');
      return judge(
        res.status === 200 && Array.isArray(list) && foreign.length === 0 && list.length === 2,
        '200，全部 userId=member01，共 2 条（种子历史，本周尚未写入）',
        `status=${res.status}，条数=${list.length}，他人数据=${foreign.length} 条`,
      );
    },
  },
  {
    id: 'TC-AUTH-04', rule: 'AUTH-04', title: '成员访问团队视图被拒（切换账号后原 leader 数据不可见的服务端体现）', priority: 'P1', phase: 'ai',
    expected: 'member01 GET /api/reports/team → 403',
    async run(ctx) {
      const res = await api('GET', '/api/reports/team', { token: ctx.tokens.get('member01') });
      return judge(res.status === 403, '403', `status=${res.status} body=${res.text.slice(0, 100)}`);
    },
  },

  // ============================================================ 模板 TPL
  {
    id: 'TC-TPL-01', rule: 'TPL-01', title: '周报模板四字段结构', priority: 'P1', phase: 'any',
    expected: 'GET /api/template 返回 fields 数组，含 weekDone/ongoing/issues/nextPlan 及条数/长度约束',
    async run(ctx) {
      const res = await api('GET', '/api/template', { token: ctx.tokens.get('member01') });
      const fields = res.json?.fields ?? [];
      const keys = fields.map((f) => f.key);
      return judge(
        res.status === 200 &&
          ['weekDone', 'ongoing', 'issues', 'nextPlan'].every((k) => keys.includes(k)) &&
          fields.every((f) => typeof f.maxItems === 'number' && typeof f.maxLen === 'number'),
        '四字段齐全，且每项带 maxItems/maxLen 约束',
        `status=${res.status} keys=${JSON.stringify(keys)}`,
      );
    },
  },

  // ============================================================ AI 生成 GEN（AI 启用）
  {
    id: 'TC-GEN-01', rule: 'GEN-01', title: '空输入拒绝生成', priority: 'P0', phase: 'ai',
    expected: 'input 为空字符串或缺失 → 400 "请输入本周工作描述"',
    async run(ctx) {
      const empty = await api('POST', '/api/reports/generate', { token: ctx.tokens.get('member01'), body: { input: '' } });
      const missing = await api('POST', '/api/reports/generate', { token: ctx.tokens.get('member01'), body: {} });
      return judge(
        empty.status === 400 && missing.status === 400 && empty.json?.message === '请输入本周工作描述',
        '两种情况均 400 "请输入本周工作描述"',
        `空串=${empty.status}(${empty.json?.message})，缺失=${missing.status}(${missing.json?.message})`,
      );
    },
  },
  {
    id: 'TC-GEN-02', rule: 'GEN-02', title: '超长输入拒绝生成', priority: 'P0', phase: 'ai',
    expected: 'input 超过 2000 字 → 400 "输入长度不能超过 2000 字"',
    async run(ctx) {
      const res = await api('POST', '/api/reports/generate', {
        token: ctx.tokens.get('member01'),
        body: { input: '本周'.repeat(1001) }, // 2002 字
      });
      return judge(
        res.status === 400 && /2000/.test(res.json?.message ?? ''),
        '400，message 提示不超过 2000 字',
        `status=${res.status} body=${res.text.slice(0, 100)}`,
      );
    },
  },
  {
    id: 'TC-GEN-04', rule: 'GEN-04 / 6.3', title: 'AI 正常生成（含 markdown 围栏剥离与 JSON 严格解析）', priority: 'P0', phase: 'ai',
    expected: '输入口语化描述 → 200，返回四字段；Mock 返回带 ```json 围栏的内容被正确解析（GEN-09 正向验证）',
    async run(ctx) {
      const res = await api('POST', '/api/reports/generate', {
        token: ctx.tokens.get('member01'),
        body: { input: '这周主要在联调周报接口，还写了一些冒烟用例，总览页联调了一半' },
      });
      const j = res.json ?? {};
      const same = JSON.stringify(j.weekDone) === JSON.stringify(MOCK_PERSONAL.weekDone) && JSON.stringify(j.nextPlan) === JSON.stringify(MOCK_PERSONAL.nextPlan);
      return judge(
        res.status === 200 && same && Array.isArray(j.ongoing) && j.ongoing.length > 0,
        '200，四字段齐全且与 Mock 输出一致（证明围栏剥离 + JSON 解析成功）',
        `status=${res.status} weekDone=${JSON.stringify(j.weekDone)}`,
      );
    },
  },
  {
    id: 'TC-GEN-04b', rule: 'GEN-04', title: 'AI 生成超时返回 504（Mock 挂起 20s）', priority: 'P0', phase: 'ai',
    expected: '输入含 HANG 触发 Mock 不响应 → 约 20s 后 504 "AI 生成超时，请重试"',
    async run(ctx) {
      const res = await api('POST', '/api/reports/generate', {
        token: ctx.tokens.get('member01'),
        body: { input: 'HANG 这周在进行接口联调与用例编写工作，内容较长一些以便测试超时逻辑是否正常触发并返回统一错误码与提示文案' },
        timeoutMs: 30_000,
      });
      return judge(
        res.status === 504 && res.json?.message === 'AI 生成超时，请重试' && res.elapsedMs >= 15_000,
        '504 "AI 生成超时，请重试"，且耗时 ≥15s（确属超时而非快速失败）',
        `status=${res.status} 耗时=${(res.elapsedMs / 1000).toFixed(1)}s body=${res.text.slice(0, 80)}`,
      );
    },
  },

  // ============================================================ 个人周报 REP（写入前先验历史数据）
  {
    id: 'TC-REP-04', rule: 'REP-04', title: '预置历史周报存在', priority: 'P1', phase: 'ai',
    expected: 'member01 /api/reports/mine 含上周（submitted）与上上周（draft）种子数据',
    async run(ctx) {
      const res = await api('GET', '/api/reports/mine', { token: ctx.tokens.get('member01') });
      const list = res.json ?? [];
      const last = list.find((r) => r.week === ctx.lastWeek);
      const before = list.find((r) => r.week === ctx.weekBeforeLast);
      return judge(
        res.status === 200 && last?.status === 'submitted' && before?.status === 'draft',
        `${ctx.lastWeek}=submitted，${ctx.weekBeforeLast}=draft`,
        `status=${res.status} 周次分布=${JSON.stringify(list.map((r) => [r.week, r.status]))}`,
      );
    },
  },
  {
    id: 'TC-OVR-05', rule: 'OVR-05', title: '本周无任何周报时汇总被拒', priority: 'P1', phase: 'ai',
    expected: '当前周无周报 → POST /api/reports/team-summary 返回 400 "暂无可汇总的周报"',
    async run(ctx) {
      const res = await api('POST', '/api/reports/team-summary', { token: ctx.tokens.get('leader01'), body: {} });
      return judge(
        res.status === 400 && res.json?.message === '暂无可汇总的周报',
        '400 "暂无可汇总的周报"',
        `status=${res.status} body=${res.text.slice(0, 100)}`,
      );
    },
  },
  {
    id: 'TC-REP-01', rule: 'REP-01', title: '周报状态机：草稿 → 提交', priority: 'P0', phase: 'ai',
    expected: 'POST /api/reports 先存 draft，再以 status=submitted 保存 → submitted；week 取服务端当前周',
    async run(ctx) {
      const draft = await api('POST', '/api/reports', { token: ctx.tokens.get('member01'), body: { ...VALID_FIELDS, status: 'draft' } });
      if (draft.status !== 200) return judge(false, '首次保存返回 200', `status=${draft.status} body=${draft.text.slice(0, 120)}`);
      ctx.state.member01WeekId = draft.json.id;
      const submitted = await api('POST', '/api/reports', {
        token: ctx.tokens.get('member01'),
        body: { ...VALID_FIELDS, weekDone: ['完成周报模块接口联调', '编写接口冒烟用例', '补充回归验证'], status: 'submitted' },
      });
      return judge(
        submitted.status === 200 && submitted.json.status === 'submitted' && submitted.json.week === ctx.week,
        `draft→submitted，week=${ctx.week}`,
        `status=${submitted.status} 状态=${submitted.json?.status} week=${submitted.json?.week}`,
      );
    },
  },
  {
    id: 'TC-REP-02', rule: 'REP-02', title: '已提交周报被编辑后回退草稿', priority: 'P0', phase: 'ai',
    expected: '对 submitted 周报执行 PUT 且不带 status → 状态回退 draft',
    async run(ctx) {
      const res = await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('member01'),
        body: { weekDone: ['完成周报模块接口联调', '编写接口冒烟用例', '补充回归验证', '更新模板文案'] },
      });
      return judge(res.status === 200 && res.json?.status === 'draft', '200，status=draft', `status=${res.status} 状态=${res.json?.status}`);
    },
  },
  {
    id: 'TC-REP-03', rule: 'REP-03', title: '同周次重复保存为更新（不新增）', priority: 'P0', phase: 'ai',
    expected: '同一 member 同一周再次 POST → id 不变；/mine 中本周报仅 1 条',
    async run(ctx) {
      const again = await api('POST', '/api/reports', { token: ctx.tokens.get('member01'), body: { ...VALID_FIELDS, status: 'submitted' } });
      const mine = await api('GET', '/api/reports/mine', { token: ctx.tokens.get('member01') });
      const thisWeek = (mine.json ?? []).filter((r) => r.week === ctx.week);
      return judge(
        again.status === 200 && again.json.id === ctx.state.member01WeekId && thisWeek.length === 1,
        `id 保持 ${ctx.state.member01WeekId}，本周报 1 条`,
        `返回id=${again.json?.id}，本周条数=${thisWeek.length}`,
      );
    },
  },
  {
    id: 'TC-TPL-03', rule: 'TPL-03', title: 'issues 缺省按"暂无"处理', priority: 'P1', phase: 'ai',
    expected: 'POST /api/reports 不传 issues → 保存成功且 issues=["暂无"]（按无风险处理）',
    async run(ctx) {
      const res = await api('POST', '/api/reports', {
        token: ctx.tokens.get('member01'),
        body: { weekDone: VALID_FIELDS.weekDone, ongoing: VALID_FIELDS.ongoing, nextPlan: VALID_FIELDS.nextPlan, status: 'submitted' },
      });
      return judge(
        res.status === 200 && JSON.stringify(res.json?.issues) === JSON.stringify(['暂无']),
        '200，issues=["暂无"]',
        `status=${res.status} issues=${JSON.stringify(res.json?.issues)}`,
      );
    },
  },

  // ============================================================ 负责人管理 LEAD
  {
    id: 'TC-LEAD-01', rule: 'LEAD-01', title: '团队周报列表（裸数组 + 未开始成员 report=null）', priority: 'P1', phase: 'ai',
    expected: `GET /api/reports/team?week=${'<上周>'} 返回数组，4 名成员全员在列；无周报成员 report=null`,
    async run(ctx) {
      const res = await api('GET', `/api/reports/team?week=${ctx.lastWeek}`, { token: ctx.tokens.get('leader01') });
      const list = res.json ?? [];
      const notStarted = list.filter((item) => item.report === null).map((item) => item.user.id);
      const withReport = list.filter((item) => item.report !== null).map((item) => item.user.id);
      return judge(
        res.status === 200 && Array.isArray(list) && list.length === 4 && notStarted.includes('leader01') && withReport.length === 3,
        '数组 4 项；leader01 等无周报者 report=null，3 名成员有上周周报',
        `status=${res.status} 人数=${list.length} 未开始=${JSON.stringify(notStarted)} 有报=${JSON.stringify(withReport)}`,
      );
    },
  },
  {
    id: 'TC-LEAD-02', rule: 'LEAD-02', title: '团队列表行字段完整', priority: 'P1', phase: 'ai',
    expected: '每个元素含 user{id,name,role} 与 report 完整字段（status/lastEditorId/updatedAt/四字段）',
    async run(ctx) {
      const res = await api('GET', `/api/reports/team?week=${ctx.lastWeek}`, { token: ctx.tokens.get('leader01') });
      const item = (res.json ?? []).find((i) => i.user.id === 'member01');
      const r = item?.report;
      const okShape =
        r && typeof r.id === 'string' && typeof r.status === 'string' && typeof r.lastEditorId === 'string' &&
        typeof r.updatedAt === 'string' && Array.isArray(r.weekDone) && Array.isArray(r.nextPlan);
      return judge(res.status === 200 && okShape, 'report 字段齐全（含 lastEditorId/updatedAt）', `status=${res.status} report=${JSON.stringify(r)?.slice(0, 160)}`);
    },
  },
  {
    id: 'TC-LEAD-03', rule: 'LEAD-03', title: '负责人代编辑成员周报', priority: 'P0', phase: 'ai',
    expected: 'leader PUT member01 本周周报 → 200，lastEditorId=leader01',
    async run(ctx) {
      const res = await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('leader01'),
        body: { issues: ['暂无', '演示环境需提前预热'] },
      });
      ctx.state.leaderEdited = res.status === 200;
      return judge(
        res.status === 200 && res.json?.lastEditorId === 'leader01',
        '200，lastEditorId=leader01',
        `status=${res.status} lastEditorId=${res.json?.lastEditorId}`,
      );
    },
  },
  {
    id: 'TC-AUTH-05', rule: 'AUTH-05', title: '最后编辑人记录（leader 代编辑后 member 端可见）', priority: 'P0', phase: 'ai',
    expected: 'leader 代编辑 member01 本周周报后，member01 查看详情 lastEditorId=leader01',
    async run(ctx) {
      const res = await api('GET', `/api/reports/${ctx.state.member01WeekId}`, { token: ctx.tokens.get('member01') });
      return judge(
        res.status === 200 && res.json?.lastEditorId === 'leader01',
        'lastEditorId=leader01',
        `status=${res.status} lastEditorId=${res.json?.lastEditorId}`,
      );
    },
  },
  {
    id: 'TC-LEAD-04', rule: 'LEAD-04', title: '并发场景最后写入优先', priority: 'P2', phase: 'ai',
    expected: '成员与负责人先后保存同一份周报 → 最终内容为后写入者（无锁覆盖）',
    async run(ctx) {
      await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('member01'),
        body: { weekDone: ['成员最后一次写入的内容甲', '编写接口冒烟用例', '补充回归验证', '更新模板文案'], status: 'submitted' },
      });
      const leaderWrite = await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('leader01'),
        body: { weekDone: ['负责人最后一次写入的内容乙', '编写接口冒烟用例', '补充回归验证', '更新模板文案'] },
      });
      const detail = await api('GET', `/api/reports/${ctx.state.member01WeekId}`, { token: ctx.tokens.get('leader01') });
      return judge(
        leaderWrite.status === 200 && detail.json?.weekDone?.[0] === '负责人最后一次写入的内容乙' && detail.json?.lastEditorId === 'leader01',
        '最终 weekDone[0]=负责人写入内容，lastEditorId=leader01',
        `weekDone[0]=${detail.json?.weekDone?.[0]} lastEditorId=${detail.json?.lastEditorId}`,
      );
    },
  },

  // ============================================================ 团队总览 OVR
  {
    id: 'TC-OVR-01', rule: 'OVR-01', title: '风险高亮三态数据（有风险 / 暂无 / 未开始）', priority: 'P0', phase: 'ai',
    expected: '团队列表中：member01 issues=["暂无"]（无风险）、member02 有真实风险、member03 report=null（未开始）',
    async run(ctx) {
      // 数据准备：member01 将 issues 重置为"暂无"（无风险态）；member02 提交带风险周报；member03 保持未开始
      await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('member01'),
        body: { issues: ['暂无'] },
      });
      // 构造三态数据：member02 本周提交一份带风险的周报（member03 保持未开始）
      const m2 = await api('POST', '/api/login', { body: { userId: 'member02' } });
      ctx.tokens.set('member02', m2.json.token);
      await api('POST', '/api/reports', {
        token: m2.json.token,
        body: {
          weekDone: ['成员周报管理页接口开发', '数据库表设计与建表'],
          ongoing: ['导出功能开发（30%）'],
          issues: ['导出 .txt 编码乱码，需确认 UTF-8', '测试环境数据库偶发连接超时'],
          nextPlan: ['导出功能修复', '联调自测'],
          status: 'submitted',
        },
      });
      const res = await api('GET', `/api/reports/team?week=${ctx.week}`, { token: ctx.tokens.get('leader01') });
      const list = res.json ?? [];
      const m1 = list.find((i) => i.user.id === 'member01');
      const m2Item = list.find((i) => i.user.id === 'member02');
      const m3 = list.find((i) => i.user.id === 'member03');
      const riskOk = (m2Item?.report?.issues ?? []).some((s) => s !== '暂无' && s.trim() !== '');
      return judge(
        res.status === 200 && list.length === 4 &&
          JSON.stringify(m1?.report?.issues) === JSON.stringify(['暂无']) &&
          riskOk && m3?.report === null,
        'member01=暂无（无风险）、member02=有风险、member03=未开始(null)',
        `m1.issues=${JSON.stringify(m1?.report?.issues)} m2.issues=${JSON.stringify(m2Item?.report?.issues)} m3.report=${JSON.stringify(m3?.report)}`,
      );
    },
  },
  {
    id: 'TC-OVR-06', rule: 'OVR-06', title: 'AI 团队汇总四段结构（含成员姓名）', priority: 'P0', phase: 'ai',
    expected: 'POST /api/reports/team-summary → 200，{overall, achievements[], risks[], nextFocus[]}，achievements 含成员姓名',
    async run(ctx) {
      const res = await api('POST', '/api/reports/team-summary', { token: ctx.tokens.get('leader01'), body: {} });
      const j = res.json ?? {};
      const withName = (j.achievements ?? []).some((s) => /[一-龥]{2,4}：/.test(s));
      ctx.state.firstExport = null;
      return judge(
        res.status === 200 && typeof j.overall === 'string' && j.overall !== '' &&
          Array.isArray(j.achievements) && j.achievements.length > 0 && Array.isArray(j.risks) && Array.isArray(j.nextFocus) && withName,
        '四段齐全，achievements 含"姓名："前缀',
        `status=${res.status} overall="${j.overall?.slice(0, 30)}…" achievements=${JSON.stringify(j.achievements)}`,
      );
    },
  },
  {
    id: 'TC-OVR-08a', rule: 'OVR-08', title: '导出团队周报 .txt（文件名/编码/四段正文）', priority: 'P1', phase: 'ai',
    expected: 'GET /api/reports/team-summary/export → 200 text/plain，附件名 团队周报_2026-W42.txt，正文含 BOM 与四段标题',
    async run(ctx) {
      const res = await api('GET', `/api/reports/team-summary/export?week=${ctx.week}`, { token: ctx.tokens.get('leader01') });
      const cd = res.headers.get('content-disposition') ?? '';
      ctx.state.firstExport = res.text;
      return judge(
        res.status === 200 &&
          (res.headers.get('content-type') ?? '').includes('text/plain') &&
          cd.includes('team-weekly-') &&
          decodeURIComponent(cd).includes(`团队周报_${ctx.week}.txt`) &&
          hasUtf8Bom(res) &&
          ['整体进展：', '关键成果：', '风险集中点：', '下周重点：'].every((t) => res.text.includes(t)),
        '200；Content-Disposition 含中文文件名；文件头 3 字节为 UTF-8 BOM；四段标题齐全',
        `status=${res.status} cd="${cd.slice(0, 90)}…" BOM=${hasUtf8Bom(res) ? '有(EF BB BF)' : '无'} 正文前40字=${JSON.stringify(res.text.slice(0, 40))}`,
      );
    },
  },
  {
    id: 'TC-OVR-08b', rule: 'OVR-08', title: '未生成快照的周次导出被拒', priority: 'P1', phase: 'ai',
    expected: '对无快照周次导出 → 400 "请先生成团队周报后再导出"',
    async run(ctx) {
      const res = await api('GET', `/api/reports/team-summary/export?week=${ctx.weekBeforeLast}`, { token: ctx.tokens.get('leader01') });
      return judge(
        res.status === 400 && res.json?.message === '请先生成团队周报后再导出',
        '400 "请先生成团队周报后再导出"',
        `status=${res.status} body=${res.text.slice(0, 100)}`,
      );
    },
  },
  {
    id: 'TC-OVR-09', rule: 'OVR-09', title: '团队周报快照不随成员修改自动更新', priority: 'P2', phase: 'ai',
    expected: '生成汇总后成员修改周报，再次导出内容与首次导出一致（快照语义）',
    async run(ctx) {
      await api('PUT', `/api/reports/${ctx.state.member01WeekId}`, {
        token: ctx.tokens.get('member01'),
        body: { weekDone: ['快照测试-成员修改后的全新内容甲', '编写接口冒烟用例', '补充回归验证', '更新模板文案'] },
      });
      const again = await api('GET', `/api/reports/team-summary/export?week=${ctx.week}`, { token: ctx.tokens.get('leader01') });
      return judge(
        again.status === 200 && again.text === ctx.state.firstExport,
        '两次导出内容完全一致（服务端保存快照，非实时重算）',
        `status=${again.status} 与首次导出一致=${again.text === ctx.state.firstExport}`,
      );
    },
  },

  // ============================================================ 边界 EDGE
  {
    id: 'TC-EDGE-03a', rule: 'EDGE / 6.1', title: '字段条数校验（400）', priority: 'P0', phase: 'any',
    expected: 'weekDone 仅 1 条 → 400 "本周完成需 2—5 条，当前 1 条"',
    async run(ctx) {
      const res = await api('POST', '/api/reports', {
        token: ctx.tokens.get('member01'),
        body: { weekDone: ['只有一条'], ongoing: VALID_FIELDS.ongoing, nextPlan: VALID_FIELDS.nextPlan },
      });
      return judge(res.status === 400 && /2—5 条/.test(res.json?.message ?? ''), '400，message 提示 2—5 条', `status=${res.status} body=${res.text.slice(0, 100)}`);
    },
  },
  {
    id: 'TC-EDGE-03b', rule: 'EDGE / 8', title: '统一错误响应体 {code,message}', priority: 'P0', phase: 'any',
    expected: '400/401/403/404 场景响应体均为 {code,message} 且 code 与 HTTP 状态一致',
    async run(ctx) {
      const r400 = await api('POST', '/api/reports', { token: ctx.tokens.get('member01'), body: { weekDone: ['x'] } });
      const r401 = await api('GET', '/api/reports/mine');
      const r403 = await api('GET', '/api/reports/team', { token: ctx.tokens.get('member01') });
      const r404 = await api('GET', '/api/reports/rpt_not_exist', { token: ctx.tokens.get('leader01') });
      const shape = (r) => r.json?.code === r.status && typeof r.json?.message === 'string' && r.json.message !== '';
      return judge(
        [r400, r401, r403, r404].every(shape),
        '四种错误均 {code,message} 且 code===HTTP 状态',
        `400=${r400.json?.code} 401=${r401.json?.code} 403=${r403.json?.code} 404=${r404.json?.code}`,
      );
    },
  },
  {
    id: 'TC-EDGE-02', rule: 'EDGE / REP-04', title: '历史周次周报可编辑（规则同本周）', priority: 'P2', phase: 'ai',
    expected: 'member01 编辑上周种子周报 → 200；已提交状态被编辑后回退 draft',
    async run(ctx) {
      const team = await api('GET', `/api/reports/team?week=${ctx.lastWeek}`, { token: ctx.tokens.get('leader01') });
      const id = (team.json ?? []).find((i) => i.user.id === 'member01')?.report?.id;
      const res = await api('PUT', `/api/reports/${id}`, { token: ctx.tokens.get('member01'), body: { nextPlan: ['团队总览页联调', '权限边界测试', '演示数据灌入'] } });
      return judge(res.status === 200 && res.json?.status === 'draft', '200，submitted→draft（与本周规则一致）', `status=${res.status} 状态=${res.json?.status}`);
    },
  },

  // ============================================================ AI 失败（Mock LLM 停止）
  {
    id: 'TC-GEN-06', rule: 'GEN-06 / 6.3', title: 'AI 生成失败返回 504 通用文案（不暴露原始错误）', priority: 'P0', phase: 'fail',
    expected: 'Mock LLM 停止后调用生成 → 504 "生成失败，请重试"，且不泄露 ECONNREFUSED/fetch 等原始错误',
    async run(ctx) {
      const res = await api('POST', '/api/reports/generate', {
        token: ctx.tokens.get('member01'),
        body: { input: '这周主要在联调周报接口，还写了一些冒烟用例' },
      });
      const leak = /ECONNREFUSED|fetch failed|socket|undefined|SyntaxError/i.test(res.text);
      return judge(
        res.status === 504 && res.json?.message === '生成失败，请重试' && !leak,
        '504 "生成失败，请重试"，无原始错误泄露',
        `status=${res.status} body=${res.text.slice(0, 100)}`,
      );
    },
  },
  {
    id: 'TC-GEN-06b', rule: 'GEN-06 / OVR-07', title: 'AI 团队汇总失败返回 504 通用文案', priority: 'P0', phase: 'fail',
    expected: 'Mock LLM 停止后调用团队汇总 → 504 "生成失败，请重试"',
    async run(ctx) {
      const res = await api('POST', '/api/reports/team-summary', { token: ctx.tokens.get('leader01'), body: {} });
      return judge(res.status === 504 && res.json?.message === '生成失败，请重试', '504 "生成失败，请重试"', `status=${res.status} body=${res.text.slice(0, 100)}`);
    },
  },

  // ============================================================ 降级模式（AI_ENABLED=false）
  {
    id: 'TC-OVR-05d', rule: 'OVR-05 / GEN-07', title: '降级模式：无周报时汇总仍被拒', priority: 'P1', phase: 'degraded',
    expected: 'AI_ENABLED=false 且本周无周报 → 400 "暂无可汇总的周报"（降级不绕过前置校验）',
    async run(ctx) {
      const res = await api('POST', '/api/reports/team-summary', { token: ctx.tokens.get('leader01'), body: {} });
      return judge(res.status === 400 && res.json?.message === '暂无可汇总的周报', '400 "暂无可汇总的周报"', `status=${res.status} body=${res.text.slice(0, 100)}`);
    },
  },
  {
    id: 'TC-GEN-07a', rule: 'GEN-07', title: '降级模式：个人生成返回空模板', priority: 'P0', phase: 'degraded',
    expected: 'AI_ENABLED=false → POST /api/reports/generate 返回 {weekDone:[],ongoing:[],issues:["暂无"],nextPlan:[]}（供手动填写）',
    async run(ctx) {
      const res = await api('POST', '/api/reports/generate', { token: ctx.tokens.get('member01'), body: { input: '这周主要在联调周报接口' } });
      const j = res.json ?? {};
      return judge(
        res.status === 200 && Array.isArray(j.weekDone) && j.weekDone.length === 0 && j.ongoing.length === 0 &&
          JSON.stringify(j.issues) === JSON.stringify(['暂无']) && j.nextPlan.length === 0,
        '200，空模板（四字段为空数组，issues=["暂无"]）',
        `status=${res.status} body=${res.text.slice(0, 120)}`,
      );
    },
  },
  {
    id: 'TC-GEN-07b', rule: 'GEN-07 / OVR-06', title: '降级模式：团队汇总走规则化聚合', priority: 'P0', phase: 'degraded',
    expected: '有周报 → 200；overall 标注"降级模式"，achievements 按"成员姓名：内容"聚合',
    async run(ctx) {
      await api('POST', '/api/reports', { token: ctx.tokens.get('member01'), body: { ...VALID_FIELDS, status: 'submitted' } });
      const res = await api('POST', '/api/reports/team-summary', { token: ctx.tokens.get('leader01'), body: {} });
      const j = res.json ?? {};
      return judge(
        res.status === 200 && /降级模式/.test(j.overall ?? '') && (j.achievements ?? []).some((s) => s.startsWith('李成员：')),
        '200，overall 含"降级模式"，achievements 含"李成员："',
        `status=${res.status} overall="${(j.overall ?? '').slice(0, 40)}…" achievements=${JSON.stringify(j.achievements)}`,
      );
    },
  },
  {
    id: 'TC-GEN-07c', rule: 'GEN-07 / OVR-08', title: '降级模式：汇总结果可导出', priority: 'P1', phase: 'degraded',
    expected: '降级汇总生成后可导出 .txt，四段正文齐全',
    async run(ctx) {
      const res = await api('GET', `/api/reports/team-summary/export?week=${ctx.week}`, { token: ctx.tokens.get('leader01') });
      return judge(
        res.status === 200 && hasUtf8Bom(res) && ['整体进展：', '关键成果：', '风险集中点：', '下周重点：'].every((t) => res.text.includes(t)),
        '200，BOM+四段标题齐全',
        `status=${res.status} BOM=${hasUtf8Bom(res) ? '有(EF BB BF)' : '无'} 正文前30字=${JSON.stringify(res.text.slice(0, 30))}`,
      );
    },
  },
];

// ---------------------------------------------------------------- 执行器
function selectCases(phase) {
  return CASES.filter((c) => c.phase === 'any' || c.phase === phase);
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });

  // 健康检查 + 获取服务端权威当前周
  const health = await api('GET', '/api/health');
  if (health.status !== 200) {
    console.error(`[FATAL] 后端不可用：${BASE}/api/health → ${health.status}`);
    process.exit(2);
  }
  const week = health.json?.week;
  const ctx = {
    tokens: new Map(),
    state: {},
    week,
    lastWeek: shiftWeek(week, -1),
    weekBeforeLast: shiftWeek(week, -2),
  };

  const cases = selectCases(PHASE);
  console.log('='.repeat(72));
  console.log(`AI 智能周报系统 · API 测试  base=${BASE}  phase=${PHASE}  服务端当前周=${week}`);
  console.log(`共 ${cases.length} 条用例，开始执行…`);
  console.log('='.repeat(72));

  const results = [];
  for (const c of cases) {
    const startedAt = Date.now();
    let outcome;
    try {
      outcome = await c.run(ctx);
    } catch (err) {
      outcome = { pass: false, expected: c.expected, actual: `脚本执行异常：${err.message}` };
    }
    const durationMs = Date.now() - startedAt;
    const record = {
      id: c.id, rule: c.rule, title: c.title, priority: c.priority, phase: PHASE,
      pass: outcome.pass, expected: outcome.expected, actual: outcome.actual, durationMs,
    };
    results.push(record);
    const mark = outcome.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark}  [${c.priority}] ${c.id} ${c.title}  (${durationMs}ms)`);
    if (!outcome.pass) {
      console.log(`        预期：${outcome.expected}`);
      console.log(`        实际：${outcome.actual}`);
    }
  }

  // 汇总
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const byPriority = ['P0', 'P1', 'P2'].map((p) => {
    const list = results.filter((r) => r.priority === p);
    return `${p}: ${list.filter((r) => r.pass).length}/${list.length}`;
  });
  console.log('-'.repeat(72));
  console.log(`phase=${PHASE} 结果：${passed}/${results.length} 通过，${failed} 失败 ｜ 按优先级 ${byPriority.join('  ')}`);
  console.log('-'.repeat(72));

  // 合并写盘（按 phase 覆盖）
  let store = { updatedAt: null, phases: {} };
  if (existsSync(OUT)) {
    try {
      store = JSON.parse(readFileSync(OUT, 'utf8'));
    } catch {
      /* 损坏则重建 */
    }
  }
  store.phases[PHASE] = { base: BASE, runAt: new Date().toISOString(), cases: results };
  store.updatedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(store, null, 2));
  console.log(`结果已写入：${OUT}`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(2);
});
