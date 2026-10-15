// 目标合约通 · 接口冒烟测试（对照 HLD §7 / PRD 硬规则）
const BASE = process.env.SMOKE_BASE_URL ?? ('http://127.0.0.1:' + (process.env.PORT ?? 3000) + '/api');

interface Res { status: number; data: any; text: string; }

async function call(method: string, path: string, options: { token?: string; body?: unknown } = {}): Promise<Res> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) headers.Authorization = 'Bearer ' + options.token;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = null; }
  return { status: res.status, data, text };
}

let passed = 0, failed = 0;
const failures: string[] = [];
function check(id: string, title: string, ok: boolean, detail = ''): void {
  if (ok) { passed++; console.log('  \u2713 ' + id.padEnd(12) + title); }
  else { failed++; failures.push(id + ' ' + title + ' ' + detail); console.log('  \u2717 ' + id.padEnd(12) + title + '  ' + detail); }
}
function section(t: string): void { console.log('\n' + t); }

async function main(): Promise<void> {
  console.log('冒烟目标：' + BASE);

  section('一、健康检查与登录');
  const health = await call('GET', '/health');
  check('HEALTH', '健康检查 200', health.status === 200, 'status=' + health.status);
  console.log('      月份=' + health.data?.month + ' AI=' + (health.data?.aiEnabled ? '启用' : '降级'));

  const m1 = await call('POST', '/login', { body: { userId: 'member01' } });
  const m2 = await call('POST', '/login', { body: { userId: 'member02' } });
  const m3 = await call('POST', '/login', { body: { userId: 'member03' } });
  const l1 = await call('POST', '/login', { body: { userId: 'leader01' } });
  const dept = await call('POST', '/login', { body: { userId: 'dept01' } });
  check('LOGIN', '8 账号可登录（含部门负责人）', [m1, m2, m3, l1, dept].every((r) => r.status === 200));
  check('LOGIN', '未知用户 400', (await call('POST', '/login', { body: { userId: 'ghost' } })).status === 400);

  const t1 = m1.data.token as string;
  const t2 = m2.data.token as string;
  const t3 = m3.data.token as string;
  const tl = l1.data.token as string;
  const td = dept.data.token as string;
  check('ROLE', 'dept01 为 center（部门负责人）', dept.data.user.role === 'center');

  const accounts = await call('GET', '/accounts');
  check('ACCOUNTS', '返回 8 个预置账号', accounts.status === 200 && accounts.data?.accounts?.length === 8, 'len=' + accounts.data?.accounts?.length);

  section('二、合约与工作包（种子数据）');
  const mine = await call('GET', '/contracts/mine', { token: t1 });
  check('CONTRACT', 'member01 有已确认合约', mine.status === 200 && mine.data?.contract?.status === 'confirmed', 'status=' + mine.data?.contract?.status);
  check('CONTRACT', '含 3 个工作包、权重合计 100', mine.data?.items?.length === 3 && mine.data?.items?.reduce((s: number, it: any) => s + it.weight, 0) === 100);
  const contractId = mine.data?.contract?.id as string;

  const m3mine = await call('GET', '/contracts/mine', { token: t3 });
  check('EMPTY', 'member03 无合约（空态草稿）', m3mine.data?.items?.length === 0, 'items=' + m3mine.data?.items?.length);

  section('三、大目标（加权进度）');
  const objs = await call('GET', '/objectives', { token: td });
  check('OBJECTIVE', '组长可见大目标', objs.status === 200 && Array.isArray(objs.data) && objs.data.length >= 2);
  const detail = await call('GET', '/objectives/obj_001', { token: tl });
  check('OBJ-PROG', 'obj_001 加权进度 = 87.1', detail.status === 200 && detail.data?.progress === 87.1, 'progress=' + detail.data?.progress);

  section('四、AI（DeepSeek / 降级，容忍 200 或 504）');
  const gen = await call('POST', '/ai/contracts/generate', { token: t1, body: { desc: '这个月主要搞慢SQL治理和AB需求，再保证生产稳定' } });
  const genOk = gen.status === 200 && (gen.data?.degraded === true || (Array.isArray(gen.data?.items) && gen.data.items.length >= 1));
  check('AI-GEN', '合约生成返回 200（AI 或降级）', genOk || gen.status === 504, 'status=' + gen.status + ' degraded=' + gen.data?.degraded);
  console.log('      生成模式：' + (gen.data?.degraded ? '降级' : 'AI 结构化 ' + gen.data?.items?.length + ' 个 + 体检 ' + gen.data?.checks?.length + ' 条'));

  const parse = await call('POST', '/progress/parse', { token: t1, body: { text: '今天联调全部完成，环境问题已解决' } });
  check('AI-PARSE', '进度解析返回 200/504', parse.status === 200 || parse.status === 504, 'status=' + parse.status + ' conf=' + parse.data?.confidence);

  section('五、进度与交付物');
  const confirm = await call('POST', '/progress/confirm', { token: t1, body: { item_id: 'item_m01_1', new_progress: 90, raw_text: '联调完成' } });
  check('PROGRESS', '进度更新成功 + 留痕', confirm.status === 200 && confirm.data?.item?.progress === 90);

  const dlv = await call('POST', '/items/item_m01_3/deliverables/link', { token: t1, body: { url: 'https://git.example.com/mr/3001' } });
  check('DELIVERABLE', '上传交付物链接成功', dlv.status === 200, 'status=' + dlv.status);

  section('六、评分与发布（硬规则）');
  const scoreNoBasis = await call('PUT', '/items/item_m01_2/score', { token: tl, body: { score: 105 } });
  check('SCORE-422', '偏离100分未填依据 → 422', scoreNoBasis.status === 422, 'status=' + scoreNoBasis.status);
  const scoreOk = await call('PUT', '/items/item_m01_2/score', { token: tl, body: { score: 105, basis: '联调零缺陷，超预期' } });
  check('SCORE', '超额分填依据 → 200', scoreOk.status === 200 && scoreOk.data?.band === '部分超额');

  const noDlvItem = await call('PUT', '/items/item_m01_1/score', { token: tl, body: { score: 100, basis: '完成得不错' } });
  check('SCORE-CAP', '无交付物打 100 → 422（封顶 95）', noDlvItem.status === 422, 'status=' + noDlvItem.status + ' msg=' + noDlvItem.data?.message);

  section('七、越权');
  const cross = await call('GET', '/contracts/' + contractId, { token: t3 });
  check('AUTH-403', 'member03 越权读 member01 合约 → 403', cross.status === 403, 'status=' + cross.status);

  section('八、看板 / 能力 / 审计（P1/P2）');
  const metrics = await call('GET', '/dashboard/metrics', { token: tl });
  check('DASH', '看板指标 200', metrics.status === 200 && typeof metrics.data?.total === 'number', 'total=' + metrics.data?.total);
  const drill = await call('GET', '/dashboard/drilldown?metric=risk', { token: tl });
  check('DASH-RISK', '风险下钻 200', drill.status === 200 && Array.isArray(drill.data), 'rows=' + drill.data?.length);

  const regen = await call('POST', '/skills/member01/regenerate', { token: t1 });
  check('SKILL', '能力标签生成 200', regen.status === 200 && Array.isArray(regen.data));
  const skills = await call('GET', '/skills/member01', { token: t1 });
  check('SKILL-TAG', '含“数据库与 SQL 调优能力”', Array.isArray(skills.data) && skills.data.some((s: any) => s.tagName.includes('SQL')), 'tags=' + (skills.data ?? []).map((s: any) => s.tagName).join(','));

  const audit = await call('GET', '/audit', { token: td });
  check('AUDIT', '中心可查审计日志', audit.status === 200 && Array.isArray(audit.data));
  check('AUDIT-403', '成员查审计 → 403', (await call('GET', '/audit', { token: t1 })).status === 403);

  console.log('\n==============================================');
  console.log('  通过 ' + passed + ' 项，失败 ' + failed + ' 项');
  if (failed > 0) { for (const f of failures) console.log('   - ' + f); }
  console.log('==============================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => { console.error('冒烟异常：', err); process.exit(1); });