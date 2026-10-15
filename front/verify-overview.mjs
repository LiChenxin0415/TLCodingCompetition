/**
 * 临时校验脚本：用 Vite SSR 加载 mock.ts，真实执行 mockOverview 并打印聚合结果。
 * 校验通过后由 config delete 删除，不入库。
 */
import { createServer } from 'vite';

// polyfill 浏览器 API（mock 层依赖 localStorage 存 token）
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const server = await createServer({
  root: process.cwd(),
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const mock = await server.ssrLoadModule('/src/services/mock.ts');
  const rules = await server.ssrLoadModule('/src/utils/rules.ts');
  const month = rules.currentMonth();
  const seed = await server.ssrLoadModule('/src/services/seed.ts');

  const check = async (userId, groupId, level) => {
    store.set('gct_token', `mock.${userId}`);
    const o = await mock.mockOverview(month, groupId, level);
    console.log(`\n===== ${userId} | group=${groupId} | level=${level} =====`);
    console.log('scope:', JSON.stringify(o.scope), 'members:', o.scope.member_count);
    console.log('metrics:');
    o.metrics.forEach((m) => console.log(`   ${m.label.padEnd(8)} = ${String(m.value).padStart(5)}${m.suffix ?? ''}  ${m.caption}  drillable=${m.drillable}`));
    console.log('objectives:');
    o.objectives.forEach((x) => {
      console.log(`   ${x.name}  进度=${x.progress}%  关联=${x.link_count}  已完成=${x.done_count}  风险=${x.risk_count}  合计权重=${x.total_weight}%`);
      x.contributors.forEach((c) => console.log(`       - ${c.user_name}/${c.item_title} w=${c.weight}% p=${c.progress}% 贡献=${c.contribution}%`));
    });
    console.log('groups:', o.groups.map((g) => `${g.group_name}(人${g.member_count} 包${g.item_count} 进度${g.avg_progress}% 分${g.avg_score} 风险${g.risk_count})`).join(' | '));
    console.log('persons:');
    o.persons.forEach((p) => console.log(`   ${p.user_name} ${p.group_name} 状态=${p.contract_status} 包${p.item_count} 进度${p.avg_progress}% 分${p.score} 风险${p.risk_count} 缺物${p.undelivered_count}`));
    console.log('types :', o.type_slices.map((t) => `${t.type}:${t.count}(w${t.weight}% p${t.avg_progress}%)`).join(' | '));
    console.log('tiers :', o.tier_slices.map((t) => `${t.range}${t.tier}:${t.count}`).join(' | '));
    console.log('riskTop:', o.risk_top.map((r) => `${r.user_name}/${r.item_title}/${r.risk_status}`).join(' | '));
    console.log('readiness ok=', o.readiness.ok, JSON.stringify(o.readiness.checks.map((c) => `${c.label}=${c.passed}`)));
    console.log('groupOptions:', JSON.stringify(o.group_options));

    // FR-05 R5：卡上的数字必须等于下钻明细条数
    for (const m of o.metrics) {
      if (!m.drillable) continue;
      const rows = await mock.mockDrilldown(m.key, month, groupId, level, 'all');
      const ok = rows.length === m.value;
      console.log(`   [R5] ${m.label}: card=${m.value} drill=${rows.length} ${ok ? 'OK' : '<<< MISMATCH'}`);
    }
    console.log('seed: items=', seed.db.items.length, 'contracts=', seed.db.contracts.length, 'objectives progress=', seed.db.objectives.map((x) => `${x.name}=${x.progress}%`).join(','));
    return o;
  };

  await check('center01', 'all', 'center');
  await check('center01', 'grp_a', 'group');
  await check('center01', 'all', 'person');
  await check('leader01', 'all', 'center');
  await check('leader02', 'all', 'center');

  // 越权：employee 不得访问看板支部ិ他人数据 —— 通过 module 边界已保证，这里只看 leader 能否看到别组
  store.set('gct_token', 'mock.leader01');
  const dd = await mock.mockDrilldown('total', month, 'all', 'center', 'all');
  const names = [...new Set(dd.map((r) => r.user_name))];
  console.log('\n[权限] leader01 下钻可见成员:', names.join('、'), names.length === 2 ? '(应仅 A 组 2 人) OK' : '<<< 越权');
} finally {
  await server.close();
}
