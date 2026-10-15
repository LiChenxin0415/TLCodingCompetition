#!/usr/bin/env node
/**
 * AI 智能周报系统 · 性能测试脚本
 * =============================
 * 对运行中的后端执行两类性能验证：
 *   1) 延迟基线：关键接口顺序请求 N 次，统计 min/avg/P50/P95/P99/max 与错误数；
 *   2) 并发压力：并发登录 / 并发读 / 并发写 / AI 生成，统计吞吐（QPS）与错误率。
 *
 * 用法：
 *   node test/perf-tests.mjs --base http://127.0.0.1:3000
 *   node test/perf-tests.mjs --base http://127.0.0.1:3000 --rounds 30 --concurrency 50
 *
 * 参数：
 *   --base        后端基地址（默认 http://127.0.0.1:3000）
 *   --rounds      延迟基线的每接口请求次数（默认 30）
 *   --concurrency 并发场景的并发数（默认 50）
 *   --out         结果输出 JSON（默认 test/results/perf-results.json）
 *
 * 通过标准（阈值）：
 *   - 全部场景错误率 = 0%
 *   - 非 AI 接口 P95 ≤ 300ms；AI 生成 P95 ≤ 2000ms（本地 Mock LLM）
 *   - 并发读 QPS ≥ 100；并发登录 QPS ≥ 100
 *
 * 退出码：全部达标为 0，否则为 1。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---------------------------------------------------------------- CLI 参数
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : dflt;
};
const BASE = argOf('base', 'http://127.0.0.1:3000');
const ROUNDS = Math.max(5, Number(argOf('rounds', 30)));
const CONCURRENCY = Math.max(10, Number(argOf('concurrency', 50)));
const OUT = resolve(argOf('out', 'test/results/perf-results.json'));

// ---------------------------------------------------------------- HTTP 封装
async function api(method, path, { token, body, timeoutMs = 15_000 } = {}) {
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
    await res.arrayBuffer(); // 读完整响应体（导出接口也不遗漏）
    return { status: res.status, elapsedMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/** 百分位（线性插值） */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    avg: Math.round((sum / sorted.length) * 100) / 100,
    p50: Math.round(percentile(sorted, 0.5) * 100) / 100,
    p95: Math.round(percentile(sorted, 0.95) * 100) / 100,
    p99: Math.round(percentile(sorted, 0.99) * 100) / 100,
    max: sorted[sorted.length - 1] ?? 0,
  };
}

// ---------------------------------------------------------------- 登录准备
async function login(userId) {
  const res = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  const json = await res.json();
  if (res.status !== 200 || !json.token) throw new Error(`登录失败：${userId} → ${res.status}`);
  return json.token;
}

// ---------------------------------------------------------------- 场景一：延迟基线
async function scenarioLatency(ctx) {
  const { memberToken, leaderToken } = ctx;
  const cases = [
    { id: 'PERF-LAT-login', title: 'POST /api/login（免密登录签发 JWT）', ai: false,
      run: () => api('POST', '/api/login', { body: { userId: 'member01' } }) },
    { id: 'PERF-LAT-template', title: 'GET /api/template（模板四字段）', ai: false,
      run: () => api('GET', '/api/template', { token: memberToken }) },
    { id: 'PERF-LAT-mine', title: 'GET /api/reports/mine（我的周报列表）', ai: false,
      run: () => api('GET', '/api/reports/mine', { token: memberToken }) },
    { id: 'PERF-LAT-team', title: 'GET /api/reports/team（团队列表）', ai: false,
      run: () => api('GET', '/api/reports/team', { token: leaderToken }) },
    { id: 'PERF-LAT-detail', title: 'GET /api/reports/{id}（周报详情）', ai: false,
      run: () => api('GET', `/api/reports/${ctx.memberReportId}`, { token: memberToken }) },
    { id: 'PERF-LAT-generate', title: 'POST /api/reports/generate（AI 生成）', ai: true,
      run: () => api('POST', '/api/reports/generate', { token: memberToken, body: { input: '这周主要在联调周报接口，还写了一些冒烟用例' } }) },
    { id: 'PERF-LAT-summary', title: 'POST /api/reports/team-summary（AI 团队汇总）', ai: true,
      run: () => api('POST', '/api/reports/team-summary', { token: leaderToken, body: {} }) },
    { id: 'PERF-LAT-export', title: 'GET /api/reports/team-summary/export（导出 .txt）', ai: false,
      run: () => api('GET', '/api/reports/team-summary/export', { token: leaderToken }) },
  ];

  const results = [];
  for (const c of cases) {
    const samples = [];
    let errors = 0;
    let lastStatus = 0;
    for (let i = 0; i < ROUNDS; i += 1) {
      const r = await c.run();
      lastStatus = r.status;
      if (r.status >= 400) errors += 1;
      else samples.push(r.elapsedMs);
    }
    const s = stats(samples);
    const p95Limit = c.ai ? 2000 : 300;
    results.push({
      id: c.id, title: c.title, rounds: ROUNDS, lastStatus,
      errors, pass: errors === 0 && s.p95 <= p95Limit,
      threshold: `P95 ≤ ${p95Limit}ms 且错误率 0%`, ...s,
    });
  }
  return results;
}

// ---------------------------------------------------------------- 场景二：并发
async function scenarioConcurrency(ctx) {
  const { memberToken, leaderToken } = ctx;
  const results = [];

  // --- 并发读（GET /api/reports/mine，同一 token） ---
  {
    const startedAt = Date.now();
    const tasks = Array.from({ length: CONCURRENCY }, () =>
      api('GET', '/api/reports/mine', { token: memberToken }));
    const rs = await Promise.all(tasks);
    const elapsedMs = Date.now() - startedAt;
    const errors = rs.filter((r) => r.status !== 200).length;
    const qps = Math.round((CONCURRENCY / elapsedMs) * 1000);
    results.push({
      id: 'PERF-CONC-read', title: `并发读 × ${CONCURRENCY}（GET /api/reports/mine）`,
      concurrency: CONCURRENCY, elapsedMs, qps, errors,
      pass: errors === 0 && qps >= 100,
      threshold: `错误率 0% 且 QPS ≥ 100`, actual: `QPS=${qps} 错误=${errors} 总耗时=${elapsedMs}ms`,
    });
  }

  // --- 并发登录（POST /api/login） ---
  {
    const startedAt = Date.now();
    const tasks = Array.from({ length: CONCURRENCY }, (_, i) =>
      api('POST', '/api/login', { body: { userId: i % 2 === 0 ? 'member01' : 'leader01' } }));
    const rs = await Promise.all(tasks);
    const elapsedMs = Date.now() - startedAt;
    const errors = rs.filter((r) => r.status !== 200).length;
    const qps = Math.round((CONCURRENCY / elapsedMs) * 1000);
    results.push({
      id: 'PERF-CONC-login', title: `并发登录 × ${CONCURRENCY}（POST /api/login）`,
      concurrency: CONCURRENCY, elapsedMs, qps, errors,
      pass: errors === 0 && qps >= 100,
      threshold: `错误率 0% 且 QPS ≥ 100`, actual: `QPS=${qps} 错误=${errors} 总耗时=${elapsedMs}ms`,
    });
  }

  // --- 并发写（3 名成员同时保存本周周报，重复 5 轮） ---
  {
    const members = ['member01', 'member02', 'member03'];
    const tokens = new Map();
    for (const m of members) tokens.set(m, await login(m));
    let errors = 0;
    const samples = [];
    for (let round = 0; round < 5; round += 1) {
      const startedAt = Date.now();
      const tasks = members.map((m, idx) =>
        api('POST', '/api/reports', {
          token: tokens.get(m),
          body: {
            weekDone: [`并发写测试-${m}-第${round}轮`, '编写接口冒烟用例'],
            ongoing: ['并发写验证（100%）'],
            issues: ['暂无'],
            nextPlan: ['并发回归验证', '总览页联调'],
            status: idx === round % members.length ? 'submitted' : 'draft',
          },
        }));
      const rs = await Promise.all(tasks);
      samples.push(Date.now() - startedAt);
      errors += rs.filter((r) => r.status !== 200).length;
    }
    const s = stats(samples);
    results.push({
      id: 'PERF-CONC-write', title: `并发写 × ${members.length}（POST /api/reports，5 轮）`,
      rounds: 5, errors, ...s,
      pass: errors === 0 && s.p95 <= 1000,
      threshold: '错误率 0% 且单轮 P95 ≤ 1000ms', actual: `单轮P95=${s.p95}ms 错误=${errors}`,
    });
  }

  // --- AI 生成并发（10 并发） ---
  {
    const n = 10;
    const startedAt = Date.now();
    const tasks = Array.from({ length: n }, () =>
      api('POST', '/api/reports/generate', {
        token: memberToken,
        body: { input: '这周主要在联调周报接口，还写了一些冒烟用例，总览页联调了一半' },
        timeoutMs: 30_000,
      }));
    const rs = await Promise.all(tasks);
    const elapsedMs = Date.now() - startedAt;
    const errors = rs.filter((r) => r.status !== 200).length;
    results.push({
      id: 'PERF-CONC-generate', title: `AI 生成并发 × ${n}（POST /api/reports/generate）`,
      concurrency: n, elapsedMs, qps: Math.round((n / elapsedMs) * 1000), errors,
      pass: errors === 0,
      threshold: '错误率 0%', actual: `错误=${errors} 总耗时=${elapsedMs}ms`,
    });
  }

  return results;
}

// ---------------------------------------------------------------- 主流程
async function main() {
  mkdirSync(dirname(OUT), { recursive: true });

  const health = await api('GET', '/api/health');
  if (health.status !== 200) {
    console.error(`[FATAL] 后端不可用：${BASE}/api/health → ${health.status}`);
    process.exit(2);
  }

  console.log('='.repeat(72));
  console.log(`AI 智能周报系统 · 性能测试  base=${BASE}`);
  console.log(`延迟基线每接口 ${ROUNDS} 次请求，并发场景并发数 ${CONCURRENCY}`);
  console.log('='.repeat(72));

  const memberToken = await login('member01');
  const leaderToken = await login('leader01');

  // 准备详情用例所需的周报 ID 与团队汇总快照
  const mine = await fetch(`${BASE}/api/reports/mine`, { headers: { Authorization: `Bearer ${memberToken}` } }).then((r) => r.json());
  const currentWeek = await fetch(`${BASE}/api/health`).then((r) => r.json()).then((j) => j.week);
  const memberReportId = (mine ?? []).find((r) => r.week === currentWeek)?.id ?? (mine ?? [])[0]?.id;
  await api('POST', '/api/reports/team-summary', { token: leaderToken, body: {} }); // 确保导出有快照

  const ctx = { memberToken, leaderToken, memberReportId };

  const latency = await scenarioLatency(ctx);
  for (const r of latency) {
    const mark = r.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark}  ${r.id}  ${r.title}`);
    console.log(`        min=${r.min}ms avg=${r.avg}ms P50=${r.p50}ms P95=${r.p95}ms P99=${r.p99}ms max=${r.max}ms 错误=${r.errors}/${r.rounds}`);
  }

  const concurrency = await scenarioConcurrency(ctx);
  for (const r of concurrency) {
    const mark = r.pass ? '✓ PASS' : '✗ FAIL';
    console.log(`${mark}  ${r.id}  ${r.title}`);
    console.log(`        ${r.actual}`);
  }

  const all = [...latency, ...concurrency];
  const passed = all.filter((r) => r.pass).length;
  const failed = all.length - passed;

  const output = {
    updatedAt: new Date().toISOString(),
    base: BASE,
    config: { rounds: ROUNDS, concurrency: CONCURRENCY },
    node: process.version,
    thresholds: {
      latencyNonAiP95Ms: 300,
      latencyAiP95Ms: 2000,
      concWriteP95Ms: 1000,
      errorRate: 0,
      qpsReadMin: 100,
      qpsLoginMin: 100,
    },
    summary: { total: all.length, passed, failed },
    latency,
    concurrency,
  };
  writeFileSync(OUT, JSON.stringify(output, null, 2));

  console.log('-'.repeat(72));
  console.log(`性能测试结果：${passed}/${all.length} 达标，${failed} 未达标`);
  console.log(`结果已写入：${OUT}`);
  console.log('-'.repeat(72));

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(2);
});
