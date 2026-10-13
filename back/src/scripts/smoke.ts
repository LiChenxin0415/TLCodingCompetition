/**
 * 接口冒烟测试（对照 material/design/api-spec-v1.md 与规则 ID）
 *
 * 用法：
 *   1) 另开终端启动服务：npm start
 *   2) 执行：npm run smoke
 *
 * 说明：脚本会真实读写数据库（会创建/更新"当前周"的本人周报，与演示流程一致）。
 * AI 相关用例在未配置 LLM 时走降级路径，同样视为通过（GEN-07）。
 */

const BASE = process.env.SMOKE_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}/api`;

interface ApiRes {
  status: number;
  data: any;
  text: string;
  contentType: string;
  disposition: string;
}

async function call(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiRes> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return {
    status: res.status,
    data,
    text,
    contentType: res.headers.get('content-type') ?? '',
    disposition: res.headers.get('content-disposition') ?? '',
  };
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(id: string, title: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  \u2713 ${id.padEnd(14)} ${title}`);
  } else {
    failed += 1;
    failures.push(`${id} ${title} ${detail}`);
    console.log(`  \u2717 ${id.padEnd(14)} ${title}  ${detail}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

async function main(): Promise<void> {
  console.log(`冒烟测试目标：${BASE}`);

  section('一、健康检查与登录（LOGIN）');
  const health = await call('GET', '/health');
  check('HEALTH', '健康检查返回 200', health.status === 200, `status=${health.status}`);
  console.log(`      当前周次=${health.data?.week} AI=${health.data?.aiEnabled ? '启用' : '降级'}`);

  const member1 = await call('POST', '/login', { body: { userId: 'member01' } });
  check('LOGIN-02', 'member01 免密登录成功', member1.status === 200 && member1.data?.token !== undefined, `status=${member1.status}`);
  check('LOGIN-02', '登录返回 user{id,name,role}', member1.data?.user?.role === 'member' && member1.data?.user?.name === '李成员');

  const member2 = await call('POST', '/login', { body: { userId: 'member02' } });
  const member3 = await call('POST', '/login', { body: { userId: 'member03' } });
  const leader = await call('POST', '/login', { body: { userId: 'leader01' } });
  check('LOGIN-01', '3 名成员 + 1 名负责人均可登录', [member2, member3, leader].every((r) => r.status === 200));
  check('LOGIN-02', '未知 userId 返回 400', (await call('POST', '/login', { body: { userId: 'ghost' } })).status === 400);

  const token1: string = member1.data.token;
  const token2: string = member2.data.token;
  const tokenL: string = leader.data.token;

  section('二、鉴权（AUTH-03）');
  check('AUTH-03', '无 token 访问受保护接口 → 401', (await call('GET', '/template')).status === 401);
  check('AUTH-03', '伪造 token → 401', (await call('GET', '/template', { token: 'not-a-real-token' })).status === 401);

  section('三、模板（TPL-01）');
  const tpl = await call('GET', '/template', { token: token1 });
  const fieldKeys: string[] = Array.isArray(tpl.data?.fields) ? tpl.data.fields.map((f: any) => f.key) : [];
  check('TPL-01', '模板返回四字段且顺序/键名一致', tpl.status === 200 && fieldKeys.join(',') === 'weekDone,ongoing,issues,nextPlan', `keys=${fieldKeys.join(',')}`);
  check('TPL-01', '模板字段含 required/maxItems/maxLen', tpl.data?.fields?.[0]?.maxLen === 50 && tpl.data?.fields?.[1]?.maxItems === 3);

  section('四、个人周报（REP-04 / REP-03 / REP-01 / REP-02 / AUTH-02 / AUTH-05）');
  const mine = await call('GET', '/reports/mine', { token: token1 });
  check('REP-04', '列表包含预置历史周报', mine.status === 200 && Array.isArray(mine.data) && mine.data.length >= 2, `len=${mine.data?.length}`);

  const payload = {
    weekDone: ['完成登录接口联调', '周报 CRUD 实现'],
    ongoing: ['权限校验模块（60%）'],
    issues: ['暂无'],
    nextPlan: ['权限用例测试', '总览页联调'],
    status: 'draft',
  };
  const created = await call('POST', '/reports', { token: token1, body: payload });
  check('REP-03', '本周新建周报成功', created.status === 200 && created.data?.id !== undefined, `status=${created.status}`);
  check('REP-03', '服务端计算 week，用户不可改', /^\d{4}-W\d{2}$/.test(String(created.data?.week)));
  const reportId: string = created.data?.id;

  const again = await call('POST', '/reports', { token: token1, body: payload });
  check('REP-03', '同周次重复保存为更新（id 不变）', again.data?.id === reportId, `${again.data?.id} vs ${reportId}`);

  const invalid = await call('POST', '/reports', { token: token1, body: { ...payload, weekDone: ['只有一条'] } });
  check('400', 'weekDone 条数越界 → 400', invalid.status === 400, `status=${invalid.status} msg=${invalid.data?.message}`);
  const tooLong = await call('POST', '/reports', { token: token1, body: { ...payload, ongoing: ['x'.repeat(51)] } });
  check('400', '单条超过 50 字 → 400', tooLong.status === 400);

  check('AUTH-02', '本人读取自己周报 → 200', (await call('GET', `/reports/${reportId}`, { token: token1 })).status === 200);
  check('AUTH-02', 'member02 越权读取 member01 周报 → 403', (await call('GET', `/reports/${reportId}`, { token: token2 })).status === 403);
  check('AUTH-02', 'member02 越权修改 member01 周报 → 403', (await call('PUT', `/reports/${reportId}`, { token: token2, body: payload })).status === 403);

  const leading = await call('PUT', `/reports/${reportId}`, { token: tokenL, body: { ongoing: ['权限校验模块（80%）'] } });
  check('LEAD-03', '负责人代编辑成功', leading.status === 200, `status=${leading.status}`);
  check('AUTH-05', 'lastEditorId 记录为负责人', leading.data?.lastEditorId === 'leader01', `lastEditorId=${leading.data?.lastEditorId}`);
  check('LEAD-03', '部分更新未传字段保留原值', Array.isArray(leading.data?.weekDone) && leading.data.weekDone.length === 2);

  const submitted = await call('PUT', `/reports/${reportId}`, { token: token1, body: { status: 'submitted' } });
  check('REP-01', '提交后状态 submitted', submitted.data?.status === 'submitted', `status=${submitted.data?.status}`);
  const reverted = await call('PUT', `/reports/${reportId}`, { token: token1, body: { ongoing: ['权限校验模块（90%）'] } });
  check('REP-02', '已提交周报编辑后回退 draft', reverted.data?.status === 'draft', `status=${reverted.data?.status}`);

  section('五、负责人视图（LEAD-01 / LEAD-02）');
  check('AUTH-01', 'member 访问团队列表 → 403', (await call('GET', '/reports/team', { token: token1 })).status === 403);
  const team = await call('GET', '/reports/team', { token: tokenL });
  const teamItems: any[] = Array.isArray(team.data) ? team.data : [];
  check('LEAD-01', '团队列表返回全部成员（含未开始）', team.status === 200 && teamItems.length === 4, `len=${teamItems.length}`);
  check('OVR-01', '列表元素为 {user, report}，未开始成员 report=null', teamItems.every((it) => it.user !== undefined && 'report' in it));

  section('六、AI 生成（GEN-01 / GEN-02 / GEN-04 / GEN-07）');
  check('GEN-01', '空输入 → 400', (await call('POST', '/reports/generate', { token: token1, body: { input: '   ' } })).status === 400);
  check('GEN-02', '输入超 2000 字 → 400', (await call('POST', '/reports/generate', { token: token1, body: { input: 'x'.repeat(2001) } })).status === 400);

  const gen = await call('POST', '/reports/generate', {
    token: token1,
    body: { input: '这周主要在弄登录和周报的接口，联调差不多弄完了，就差权限那块还没测' },
  });
  const genOk = gen.status === 200 && Array.isArray(gen.data?.weekDone);
  const genDegraded = gen.status === 200 && (gen.data?.weekDone?.length ?? 0) === 0;
  const genTimeout = gen.status === 504;
  check('GEN-04', '生成返回 200（正常/降级）或 504（超时）', genOk || genTimeout, `status=${gen.status} msg=${gen.data?.message}`);
  console.log(`      生成模式：${genTimeout ? '504 超时（前端可重试/降级）' : genDegraded ? '降级模式（空模板）' : `结构化四字段 weekDone=${gen.data?.weekDone?.length} 条`}`);

  section('七、团队周报（OVR-05 / OVR-06 / OVR-08）');
  check('AUTH-01', 'member 生成团队周报 → 403', (await call('POST', '/reports/team-summary', { token: token1, body: {} })).status === 403);
  check('OVR-05', 'member 导出 → 403', (await call('GET', '/reports/team-summary/export', { token: token1 })).status === 403);

  const summary = await call('POST', '/reports/team-summary', { token: tokenL, body: {} });
  const summaryOk = summary.status === 200 && typeof summary.data?.overall === 'string';
  check('OVR-06', '团队周报返回四段结构', summaryOk || summary.status === 504, `status=${summary.status} msg=${summary.data?.message}`);
  if (summaryOk) {
    const s = summary.data;
    check('OVR-06', '四段字段齐备（overall/achievements/risks/nextFocus）', Array.isArray(s.achievements) && Array.isArray(s.risks) && Array.isArray(s.nextFocus));
    check('OVR-06', 'risks 非空（无风险为固定文案）', s.risks.length > 0);
    check('OVR-06', 'achievements 已按成员聚合', s.achievements.length > 0);
    console.log(`      模式：${String(s.overall).includes('降级') ? '规则化降级' : 'AI 生成'}；achievements=${s.achievements.length} risks=${s.risks.length} nextFocus=${s.nextFocus.length}`);
  }

  const exportRes = await call('GET', '/reports/team-summary/export', { token: tokenL });
  if (summaryOk) {
    check('OVR-08', '导出返回 text/plain 文件流', exportRes.status === 200 && exportRes.contentType.includes('text/plain'), `status=${exportRes.status} ct=${exportRes.contentType}`);
    check('OVR-08', '附件名符合 团队周报_YYYY-Www.txt', exportRes.disposition.includes(encodeURIComponent('团队周报_')) && /\.txt/.test(exportRes.disposition));
    check('OVR-08', '正文包含四段标题', ['整体进展：', '关键成果：', '风险集中点：', '下周重点：'].every((t) => exportRes.text.includes(t)));
  } else {
    check('OVR-08', '未生成快照时导出 → 400 提示先生成', exportRes.status === 400, `status=${exportRes.status}`);
  }

  section('八、错误码与边界（400/401/403/404）');
  check('404', '不存在的接口 → 404', (await call('GET', '/not-exist')).status === 404);
  check('404', '不存在的周报 id → 404', (await call('GET', '/reports/rpt_not_exist', { token: tokenL })).status === 404);
  check('400', '非法周次格式 → 400', (await call('GET', '/reports/team?week=2026-42', { token: tokenL })).status === 400);
  check('400', '非法 JSON 请求体 → 400', await (async () => {
    const res = await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' });
    return res.status === 400;
  })());

  console.log(`\n==============================================`);
  console.log(`  通过 ${passed} 项，失败 ${failed} 项`);
  if (failed > 0) {
    console.log('  失败明细：');
    for (const f of failures) console.log(`   - ${f}`);
  }
  console.log('==============================================');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\n冒烟测试异常终止：', err);
  console.error('请确认服务已启动（npm start），且 SMOKE_BASE_URL 指向正确地址。');
  process.exit(1);
});
