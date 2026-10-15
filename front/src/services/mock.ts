/**
 * Mock 适配器 —— 后端未就绪时，前端可独立跑通全闭环演示（HLD §9.2 Mock LLM 同理）。
 * 规则实现与后端口径保持一致（HLD §8 硬规则），真实联调时由 API 层替换本文件。
 */
import dayjs from 'dayjs';
import { ApiError } from '@/utils/error';
import {
  SCORE_TIERS,
  checkItem,
  dateInMonth,
  deviationAdvice,
  isCheckFailed,
  monthlyScore,
  normalizeWeights,
  now,
  objectiveProgress,
  riskStatus,
  sumWeight,
  validateContract,
  validateScore,
} from '@/utils/rules';
import {
  ITEM_TYPES,
  type AiContractResult,
  type AuthResult,
  type CalibrationRow,
  type ChangeReason,
  type Contract,
  type ContractItem,
  type DashboardOverview,
  type Deliverable,
  type DrillLevel,
  type DrilldownRow,
  type GroupStat,
  type ItemCheck,
  type MetricCard,
  type MetricKey,
  type ObjectiveBoard,
  type PersonStat,
  type ProgressParseResult,
  type PublishReadiness,
  type ReportEntry,
  type SkillTag,
  type TierSlice,
  type TypeSlice,
  type User,
} from '@/types';
import { db } from './seed';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const call = async <T,>(fn: () => T, ms = 260): Promise<T> => {
  await sleep(ms);
  return fn();
};

/** AI 开关：false 时模拟 504 超时，用于演示「AI 降级为手工」 */
const AI_ON = import.meta.env.VITE_AI_ENABLED !== 'false';
const aiGate = () => {
  if (!AI_ON) throw new ApiError(504, 'AI 暂不可用，请手动操作');
};

const assertRollback = (cond: boolean, msg: string, code = 422) => {
  if (!cond) throw new ApiError(code, msg);
};

/* ---------------- 会话与权限 ---------------- */

const tokenUser = (): string => {
  const t = localStorage.getItem('gct_token') || '';
  const m = /^mock\.(.+)$/.exec(t);
  if (!m) throw new ApiError(401, '未登录或登录已失效');
  return m[1];
};

export const currentUser = (): User => {
  const id = tokenUser();
  const u = db.users.find((x) => x.id === id);
  if (!u) throw new ApiError(401, '账号不存在');
  return u;
};

/** 可见用户集合：employee 仅本人 / leader 仅本组 / center 全中心（HLD §11 行级权限） */
const visibleUserIds = (u: User): string[] => {
  if (u.role === 'employee') return [u.id];
  if (u.role === 'leader') return db.users.filter((x) => x.group_id === u.group_id).map((x) => x.id);
  return db.users.filter((x) => x.role !== 'center').map((x) => x.id);
};

const canSeeItem = (u: User, it: ContractItem): boolean => {
  const c = db.contracts.find((x) => x.id === it.contract_id);
  if (!c) return false;
  if (u.role === 'center') return true;
  if (u.role === 'leader') return visibleUserIds(u).includes(c.user_id);
  return c.user_id === u.id;
};

const itemsOf = (contractId: string) => db.items.filter((i) => i.contract_id === contractId);
const contractOf = (userId: string, month: string) =>
  db.contracts.find((c) => c.user_id === userId && c.month === month);

const ensureEditable = (c: Contract) => {
  assertRollback(c.status !== 'published', '已发布月份数据只读，不可修改', 409);
};

const recomputeObjectives = () => {
  db.objectives.forEach((o) => {
    o.progress = objectiveProgress(db.items.filter((i) => i.objective_id === o.id));
  });
};

const hasDeliverable = (itemId: string) => db.deliverables.some((d) => d.item_id === itemId);

/* ---------------- 认证 ---------------- */

export const mockLogin = (userId: string) =>
  call<AuthResult>(() => {
    const u = db.users.find((x) => x.id === userId);
    assertRollback(Boolean(u), '账号不存在', 404);
    return { token: `mock.${userId}`, user: u as User };
  }, 120);

export const mockMe = () => call(() => ({ user: currentUser(), month: dayjs().format('YYYY-MM') }), 100);

/* ---------------- 大目标 FR-04 ---------------- */

export const mockObjectives = () =>
  call(() => {
    const u = currentUser();
    const visibleObjectives = db.objectives.filter((o) => {
      if (u.role === 'center') return true;
      if (u.role === 'leader') return o.group_id === u.group_id;
      return db.items.some((i) => i.contract_id === contractOf(u.id, dayjs().format('YYYY-MM'))?.id && i.objective_id === o.id);
    });
    return visibleObjectives.map((o) => ({ ...o, progress: objectiveProgress(db.items.filter((i) => i.objective_id === o.id)) }));
  });

export const mockObjective = (id: string) =>
  call(() => {
    currentUser();
    const o = db.objectives.find((x) => x.id === id);
    assertRollback(Boolean(o), '大目标不存在', 404);
    const linked = db.items.filter((i) => i.objective_id === id);
    const totalWeight = sumWeight(linked);
    const rows = linked.map((i) => {
      const c = db.contracts.find((x) => x.id === i.contract_id);
      const owner = db.users.find((x) => x.id === c?.user_id);
      return {
        item_id: i.id,
        user_id: c?.user_id ?? '',
        user_name: owner?.name ?? '',
        month: c?.month ?? '',
        title: i.title,
        weight: i.weight,
        progress: i.progress,
        contribution: totalWeight ? Math.round((i.weight / totalWeight) * 1000) / 10 : 0,
        deliverable_status: (hasDeliverable(i.id) ? '已上传' : '未上传') as DrilldownRow['deliverable_status'],
      };
    });
    return {
      objective: { ...(o as NonNullable<typeof o>), progress: objectiveProgress(linked) },
      rows,
      formula: 'Σ(工作包进度 × 权重) ÷ Σ(权重)，保留 1 位小数',
    };
  });

export const mockSaveObjective = (input: Partial<ContractItem> & Record<string, unknown>, id?: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role !== 'employee', '仅组长/中心可维护大目标', 403);
    const payload = input as {
      name: string; group_id: string; owner_id: string; start_date: string; end_date: string;
      status: '进行中' | '已达成' | '已关闭';
    };
    if (id) {
      const o = db.objectives.find((x) => x.id === id);
      assertRollback(Boolean(o), '大目标不存在', 404);
      Object.assign(o as object, payload);
      recomputeObjectives();
      return o;
    }
    const obj = {
      id: `obj_${Date.now().toString(36)}`,
      name: payload.name,
      group_id: payload.group_id,
      owner_id: payload.owner_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status ?? '进行中',
      progress: 0,
    };
    db.objectives.push(obj);
    return obj;
  });

/* ---------------- 合约 FR-02 ---------------- */

export const mockMyContract = (month: string) =>
  call(() => {
    const u = currentUser();
    const c = contractOf(u.id, month);
    if (!c) return { contract: null, items: [], deliverables: {} as Record<string, Deliverable[]> };
    const items = itemsOf(c.id);
    const deliverables: Record<string, Deliverable[]> = {};
    items.forEach((i) => {
      deliverables[i.id] = db.deliverables.filter((d) => d.item_id === i.id);
    });
    return { contract: c, items, deliverables };
  });

export const mockCreateContract = (month: string) =>
  call(() => {
    const u = currentUser();
    const exist = contractOf(u.id, month);
    assertRollback(!exist, '本月合约已存在', 409);
    const c: Contract = {
      id: `ctr_${month}_${u.id}`,
      user_id: u.id,
      month,
      status: 'draft',
    };
    db.contracts.push(c);
    return c;
  });

export const mockSaveContract = (contractId: string, inputs: Partial<ContractItem>[]) =>
  call(() => {
    const u = currentUser();
    const c = db.contracts.find((x) => x.id === contractId);
    assertRollback(Boolean(c), '合约不存在', 404);
    ensureEditable(c as Contract);
    assertRollback(contractId === (c as Contract).id && (c as Contract).user_id === u.id, '仅本人可编辑合约', 403);

    // 删除本次不再包含的工作包，其余 upsert
    const keepIds = inputs.map((i) => i.id).filter(Boolean) as string[];
    db.items = db.items.filter((i) => i.contract_id !== contractId || keepIds.includes(i.id));

    inputs.forEach((input) => {
      if (input.id) {
        const origin = db.items.find((i) => i.id === input.id);
        if (origin) {
          Object.assign(origin, input);
          return;
        }
      }
      const it: ContractItem = {
        id: input.id || `itm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        contract_id: contractId,
        objective_id: input.objective_id ?? null,
        type: input.type ?? '基础履职类',
        priority: input.priority ?? '中',
        title: input.title ?? '',
        target_desc: input.target_desc ?? '',
        deliverable_type: input.deliverable_type ?? '其他',
        deliverable_desc: input.deliverable_desc ?? '',
        weight: Number(input.weight) || 0,
        due_date: input.due_date ?? '',
        progress: Number(input.progress) || 0,
        source: input.source ?? 'manual',
        checked: 0,
      };
      db.items.push(it);
    });

    // due_date 必须在合约月份内（HLD §5.2）
    const bad = itemsOf(contractId).find((i) => i.due_date && dayjs(i.due_date).format('YYYY-MM') !== (c as Contract).month);
    assertRollback(!bad, `「${bad?.title}」截止日不在合约月份内`, 422);
    recomputeObjectives();
    return { contract: c, items: itemsOf(contractId) };
  });

export const mockSubmitContract = (contractId: string) =>
  call(() => {
    const c = db.contracts.find((x) => x.id === contractId);
    assertRollback(Boolean(c), '合约不存在', 404);
    const items = itemsOf(contractId);
    const issues = validateContract(items);
    assertRollback(issues.length === 0, issues.map((i) => i.message).join('；'), 422);
    (c as Contract).status = 'submitted';
    (c as Contract).submit_at = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return { contract: c, items };
  });

export const mockTeamContracts = (month: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role !== 'employee', '仅组长/中心可查看成员合约', 403);
    const ids = visibleUserIds(u).filter((id) => db.users.find((x) => x.id === id)?.role === 'employee');
    return ids.map((uid) => {
      const owner = db.users.find((x) => x.id === uid) as User;
      const c = contractOf(uid, month);
      const items = c ? itemsOf(c.id) : [];
      const deliverables: Record<string, Deliverable[]> = {};
      items.forEach((i) => {
        deliverables[i.id] = db.deliverables.filter((d) => d.item_id === i.id);
      });
      return { user: owner, contract: c ?? null, items, deliverables };
    });
  });

export const mockConfirmContract = (contractId: string) =>
  call(() => {
    const u = currentUser();
    const c = db.contracts.find((x) => x.id === contractId) as Contract | undefined;
    assertRollback(Boolean(c), '合约不存在', 404);
    assertRollback((c as Contract).status === 'submitted', '仅「待组长核对」状态可确认', 409);
    (c as Contract).status = 'confirmed';
    (c as Contract).check_by = u.id;
    (c as Contract).reject_reason = '';
    itemsOf(contractId).forEach((i) => (i.checked = 1));
    return c as Contract;
  });

export const mockRejectContract = (contractId: string, reason: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(Boolean(reason && reason.trim()), '退回意见必填', 422);
    const c = db.contracts.find((x) => x.id === contractId) as Contract | undefined;
    assertRollback(Boolean(c), '合约不存在', 404);
    (c as Contract).status = 'rejected';
    (c as Contract).reject_reason = reason;
    (c as Contract).reject_by = u.id;
    return c as Contract;
  });

/** 台账导出（FR-06 R4 字段） */
export const mockExport = (month: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role !== 'employee', '仅组长/中心可导出台账', 403);
    const ids = visibleUserIds(u);
    const header = '月份,成员,工作包,类型,优先级,权重,进度,评分,评分说明,得分,变更次数';
    const lines: string[] = [header];
    db.items
      .filter((i) => {
        const c = db.contracts.find((x) => x.id === i.contract_id);
        return c && c.month === month && ids.includes(c.user_id);
      })
      .forEach((i) => {
        const c = db.contracts.find((x) => x.id === i.contract_id) as Contract;
        const user = db.users.find((x) => x.id === c.user_id) as User;
        const changes = db.changeLogs.filter((l) => l.item_id === i.id).length;
        const safe = (v: string | undefined) => (v ?? '').replace(/,/g, '，');
        lines.push(
          [c.month, user.name, safe(i.title), i.type, i.priority, i.weight, i.progress,
            i.score ?? '', safe(i.score_basis), c.score ?? '', changes].join(','),
        );
      });
    return lines.join('\n');
  }, 400);

/* ---------------- 工作包 FR-01 / FR-03 ---------------- */

export const mockItemDetail = (itemId: string) =>
  call(() => {
    const u = currentUser();
    const it = db.items.find((x) => x.id === itemId);
    assertRollback(Boolean(it), '工作包不存在', 404);
    assertRollback(canSeeItem(u, it as ContractItem), '仅本人/本组可见', 403);
    const c = db.contracts.find((x) => x.id === (it as ContractItem).contract_id) as Contract;
    const owner = db.users.find((x) => x.id === c.user_id) as User;
    return {
      item: it as ContractItem,
      contract: c,
      owner,
      objective: db.objectives.find((o) => o.id === (it as ContractItem).objective_id) ?? null,
      deliverables: db.deliverables.filter((d) => d.item_id === itemId),
      progressLogs: db.progressLogs.filter((l) => l.item_id === itemId),
      changeLogs: db.changeLogs.filter((l) => l.item_id === itemId),
      check: checkItem(it as ContractItem),
    };
  });

export const mockUpdateItem = (
  itemId: string,
  patch: Partial<ContractItem> & { reason?: ChangeReason; note?: string },
) =>
  call(() => {
    const u = currentUser();
    const it = db.items.find((x) => x.id === itemId) as ContractItem | undefined;
    assertRollback(Boolean(it), '工作包不存在', 404);
    assertRollback(canSeeItem(u, it as ContractItem), '仅本人/本组可见', 403);
    const c = db.contracts.find((x) => x.id === (it as ContractItem).contract_id) as Contract;
    ensureEditable(c);

    const fields: Partial<ContractItem> = {};
    (['title', 'target_desc', 'type', 'priority', 'weight', 'due_date', 'progress', 'objective_id', 'deliverable_type', 'deliverable_desc'] as const).forEach(
      (k) => {
        if (patch[k] !== undefined && patch[k] !== (it as ContractItem)[k]) {
          Object.assign(fields, { [k]: patch[k] });
        }
      },
    );

    if (fields.progress !== undefined) {
      const np = Number(fields.progress);
      assertRollback(np >= 0 && np <= 100, '进度须在 0–100 之间', 422);
      const delta = np - (it as ContractItem).progress;
      if (delta < -20) {
        assertRollback(Boolean(patch.reason), '回退超过 20% 需填写原因（FR-01 R4）', 422);
      }
    }

    Object.entries(fields).forEach(([k, v]) => {
      const oldValue = String((it as ContractItem)[k as keyof ContractItem] ?? '');
      db.changeLogs.push({
        id: `chg_${Date.now().toString(36)}_${k}`,
        item_id: itemId,
        field: k,
        old_value: oldValue,
        new_value: String(v),
        reason: patch.reason ?? '范围蔓延',
        note: patch.note ?? '',
        operator: u.id,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
      Object.assign(it as object, { [k]: v });
    });

    if (fields.weight !== undefined) {
      const others = itemsOf(c.id).filter((i) => i.id !== itemId);
      const othersWeight = sumWeight(others.filter((i) => i.id !== itemId));
      assertRollback(othersWeight + Number(fields.weight) <= 100, '调整后权重合计超过 100%', 422);
    }

    recomputeObjectives();
    return { item: it, changeLogs: db.changeLogs.filter((l) => l.item_id === itemId) };
  });

export const mockListDeliverables = (itemId: string) => call(() => db.deliverables.filter((d) => d.item_id === itemId));

export const mockAddDeliverable = (itemId: string, input: { kind: 'file' | 'link'; file_type: string; name: string; url: string }) =>
  call(() => {
    const u = currentUser();
    const it = db.items.find((x) => x.id === itemId) as ContractItem | undefined;
    assertRollback(Boolean(it), '工作包不存在', 404);
    const c = db.contracts.find((x) => x.id === (it as ContractItem).contract_id) as Contract;
    ensureEditable(c);
    const whitelist = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'zip', 'md', 'txt'];
    if (input.kind === 'file') {
      assertRollback(whitelist.includes(input.file_type.toLowerCase()), '文件类型不支持，仅允许白名单类型', 400);
    }
    const d: Deliverable = {
      id: `dlv_${Date.now().toString(36)}`,
      item_id: itemId,
      kind: input.kind,
      file_type: input.file_type,
      name: input.name,
      url: input.url,
      uploader: u.id,
      upload_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      version: db.deliverables.filter((x) => x.item_id === itemId).length + 1,
    };
    db.deliverables.push(d);
    return d;
  });

export const mockDeleteDeliverable = (deliverableId: string) =>
  call(() => {
    const d = db.deliverables.find((x) => x.id === deliverableId);
    assertRollback(Boolean(d), '交付物不存在', 404);
    const it = db.items.find((x) => x.id === (d as Deliverable).item_id) as ContractItem;
    const c = db.contracts.find((x) => x.id === it.contract_id) as Contract;
    ensureEditable(c);
    db.deliverables = db.deliverables.filter((x) => x.id !== deliverableId);
    return { ok: true };
  });

/* ---------------- AI：合约生成 / 体检 / 进度解析 ---------------- */

const RULES: { kw: string[]; type: ContractItem['type']; title: string; target: string; dtype: ContractItem['deliverable_type']; ddesc: string; due: number; priority: ContractItem['priority'] }[] = [
  { kw: ['慢sql', 'sql', '索引', '调优'], type: '治理改善类', title: '慢SQL治理', target: '治理 10 条慢SQL，平均耗时下降 30%', dtype: '数据报表', ddesc: '治理清单 + 耗时对比报表', due: 22, priority: '高' },
  { kw: ['ab', '实验', '灰度', '上线', '发布'], type: '重点交付类', title: '重点需求交付上线', target: '完成 3 个业务场景上线并通过验收', dtype: '上线单', ddesc: '上线单 + 灰度验证结论', due: 20, priority: '高' },
  { kw: ['需求', '开发', '编码', '功能'], type: '重点交付类', title: '需求开发与交付', target: '按期交付全部需求并通过测试验收', dtype: '代码合并请求', ddesc: 'MR 清单 + 测试报告', due: 24, priority: '高' },
  { kw: ['稳定', '值班', '生产', '运维', '故障'], type: '基础履职类', title: '生产值守与工单处理', target: '处理生产工单 40 单，响应及时率 100%', dtype: '运维记录', ddesc: '值班与工单台账', due: 28, priority: '中' },
  { kw: ['测试', '质量', '用例'], type: '治理改善类', title: '测试与质量保障', target: '用例覆盖率提升至 80%，缺陷收敛', dtype: '测试报告', ddesc: '测试报告 + 覆盖率统计', due: 25, priority: '中' },
  { kw: ['poc', '探索', '调研', '创新'], type: '探索突破类', title: '技术探索 PoC', target: '完成 PoC 验证并产出结论报告', dtype: 'PoC 结论报告', ddesc: 'PoC 结论报告', due: 26, priority: '低' },
];

export const mockAiGenerate = (desc: string, objectiveId?: string) =>
  call(() => {
    const u = currentUser();
    aiGate();
    const month = dayjs().format('YYYY-MM');
    const text = (desc || '').toLowerCase();
    const hits = RULES.filter((r) => r.kw.some((k) => text.includes(k)));
    const picked = hits.length >= 3 ? hits.slice(0, 4) : [...hits, ...RULES.filter((r) => !hits.includes(r))].slice(0, 3);
    const weights = normalizeWeights(picked.map(() => ({ weight: 1 })));
    const items = picked.map((r, idx) => ({
      type: r.type,
      title: r.title,
      target_desc: r.target,
      deliverable: undefined,
      deliverable_type: r.dtype,
      deliverable_desc: r.ddesc,
      weight: weights[idx],
      priority: r.priority,
      due_date: dateInMonth(month, r.due),
      objective_id: r.type === '基础履职类' ? null : objectiveId ?? db.objectives[0]?.id ?? null,
    }));

    const checks: ItemCheck[] = items.map((i) => checkItem(i));
    const total = sumWeight(items);
    if (total !== 100) {
      // 归一化兜底（HLD §8 硬规则 1）
      const fixed = normalizeWeights(items);
      items.forEach((i, idx) => (i.weight = fixed[idx]));
    }
    return {
      items,
      total_weight: sumWeight(items),
      checks,
      hint: isCheckFailed(checks[0]) ? '首条体检未通过，建议补充数字与交付物' : undefined,
      unknown_for_employee: u.role !== 'employee',
    } as AiContractResult & { hint?: string; unknown_for_employee?: boolean };
  }, 1400);

export const mockAiCheck = (inputs: Partial<ContractItem>[]) =>
  call<ItemCheck[]>(() => inputs.map((i) => checkItem(i as Parameters<typeof checkItem>[0])), 400);

const COMPLETE_WORDS = ['完成', '已完成', '搞定', '上线', '交付', '验收通过', '通过了', '结束'];
const PART_WORDS = ['过半', '一半', '进展顺利', '推进', '继续'];

export const mockAiParseProgress = (text: string, itemId?: string) =>
  call<ProgressParseResult>(() => {
    const u = currentUser();
    aiGate();
    const month = dayjs().format('YYYY-MM');
    const c = contractOf(u.id, month);
    const myItems = c ? itemsOf(c.id).filter((i) => i.progress < 100) : [];
    assertRollback(myItems.length > 0, '本月暂无在办工作包，请先在合约中添加', 422);

    const pctMatch = /(\d{1,3})\s*%/.exec(text);
    const complete = COMPLETE_WORDS.some((w) => text.includes(w));
    const partial = PART_WORDS.some((w) => text.includes(w));
    const noSignal = !pctMatch && !complete && !partial;

    const scored = myItems.map((i) => {
      const words = `${i.title}${i.target_desc}`.split('').filter((ch) => /[一-龥A-Za-z]/.test(ch));
      const overlap = words.filter((ch) => text.includes(ch)).length / Math.max(words.length, 1);
      let confidence = 0.45 + overlap * 0.55;
      if (itemId && i.id === itemId) confidence = Math.max(confidence, 0.92);
      return { item: i, confidence: Math.min(0.97, Math.round(confidence * 100) / 100) };
    }).sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];
    const low = best.confidence < 0.6;
    const current = best.item.progress;
    let np = current;
    if (pctMatch) np = Math.min(100, Math.max(0, Number(pctMatch[1])));
    else if (complete) np = 100;
    else if (partial) np = Math.min(100, current + 20);
    else np = Math.min(100, current + 10);

    return {
      item_id: low ? null : best.item.id,
      item_title: low ? null : best.item.title,
      new_progress: np,
      delta: np - current,
      evidence: pctMatch ? `文本中识别到进度 ${pctMatch[1]}%` : complete ? '文本含「完成/验收通过」语义' : '文本含进展描述',
      confidence: best.confidence,
      candidates: scored.slice(0, 3).map((s) => ({ item_id: s.item.id, item_title: s.item.title, confidence: s.confidence })),
      suggest_deliverable: complete,
      no_signal: noSignal,
    };
  }, 900);

export const mockConfirmProgress = (payload: { item_id: string; new_progress: number; raw_text: string; delta: number; evidence: string; confidence: number }) =>
  call(() => {
    const u = currentUser();
    const it = db.items.find((x) => x.id === payload.item_id) as ContractItem | undefined;
    assertRollback(Boolean(it), '工作包不存在', 404);
    const c = db.contracts.find((x) => x.id === (it as ContractItem).contract_id) as Contract;
    ensureEditable(c);
    (it as ContractItem).progress = payload.new_progress;
    db.progressLogs.push({
      id: `plog_${Date.now().toString(36)}`,
      item_id: payload.item_id,
      operator: u.id,
      raw_text: payload.raw_text,
      ai_result: {
        item_id: payload.item_id,
        new_progress: payload.new_progress,
        delta: payload.delta,
        evidence: payload.evidence,
        confidence: payload.confidence,
      },
      delta: payload.delta,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
    recomputeObjectives();
    return it;
  });

export const mockManualProgress = (payload: { item_id: string; progress: number; reason?: ChangeReason; note?: string }) =>
  call(() => {
    const u = currentUser();
    const it = db.items.find((x) => x.id === payload.item_id) as ContractItem | undefined;
    assertRollback(Boolean(it), '工作包不存在', 404);
    const delta = payload.progress - (it as ContractItem).progress;
    if (delta < -20) assertRollback(Boolean(payload.reason), '回退超过 20% 需填写原因', 422);
    (it as ContractItem).progress = Math.min(100, Math.max(0, payload.progress));
    db.progressLogs.push({
      id: `plog_${Date.now().toString(36)}`,
      item_id: payload.item_id,
      operator: u.id,
      raw_text: '（手工更新）',
      ai_result: null,
      delta,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    });
    if (payload.reason) {
      db.changeLogs.push({
        id: `chg_${Date.now().toString(36)}_p`,
        item_id: payload.item_id,
        field: 'progress',
        old_value: String((it as ContractItem).progress - delta),
        new_value: String((it as ContractItem).progress),
        reason: payload.reason,
        note: payload.note ?? '手工更新进度',
        operator: u.id,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    }
    recomputeObjectives();
    return it;
  });

/* ---------------- 计价 / 评分 FR-09 ---------------- */

export const mockScoreItem = (payload: { item_id: string; score: number; basis?: string; force_reason?: string }) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role !== 'employee', '仅组长可评分', 403);
    const it = db.items.find((x) => x.id === payload.item_id) as ContractItem | undefined;
    assertRollback(Boolean(it), '工作包不存在', 404);
    const c = db.contracts.find((x) => x.id === (it as ContractItem).contract_id) as Contract;
    ensureEditable(c);
    const delivered = hasDeliverable(payload.item_id);
    const v = validateScore({ score: payload.score, hasDeliverable: delivered, basis: payload.basis, forceReason: payload.force_reason });
    assertRollback(v.ok, v.message ?? '评分校验未通过', 422);
    if (payload.score > 100) {
      assertRollback(delivered, '评分 >100 需存在可验证的超预期成果（交付物/核验数据留痕）', 422);
    }
    (it as ContractItem).score = payload.score;
    (it as ContractItem).score_basis = payload.basis ?? '';
    return { item: it, warn: v.level === 'warn' ? v.message : undefined };
  });

export const mockSubmitRating = (contractId: string) =>
  call(() => {
    const c = db.contracts.find((x) => x.id === contractId) as Contract | undefined;
    assertRollback(Boolean(c), '合约不存在', 404);
    const items = itemsOf(contractId);
    const unscored = items.filter((i) => typeof i.score !== 'number');
    assertRollback(unscored.length === 0, `还有 ${unscored.length} 个工作包未评分`, 422);
    (c as Contract).status = 'rated';
    (c as Contract).score = monthlyScore(items);
    return c as Contract;
  });

export const mockCalibration = (month: string) =>
  call<CalibrationRow[]>(() => {
    const u = currentUser();
    assertRollback(u.role === 'center', '仅中心管理者可查看校准', 403);
    const ids = visibleUserIds(u).filter((id) => db.users.find((x) => x.id === id)?.role === 'employee');
    const cs = db.contracts.filter((c) => c.month === month && ids.includes(c.user_id));
    const scoredScores = cs.filter((c) => typeof c.score === 'number').map((c) => c.score as number);
    const avg = scoredScores.length ? scoredScores.reduce((s, n) => s + n, 0) / scoredScores.length : 0;
    return cs.map((c) => {
      const owner = db.users.find((x) => x.id === c.user_id) as User;
      const score = c.score ?? 0;
      const deviation = score && avg ? Math.round((score - avg) * 10) / 10 : 0;
      return {
        user_id: c.user_id,
        user_name: owner.name,
        contract_id: c.id,
        status: c.status,
        score,
        deviation,
        advice: deviationAdvice(score, avg),
        issues: mockPublishCheckFor(c),
      };
    });
  }, 400);

/** 发布前置校验的三大分类（FR-09 R5） */
type CheckCategory = 'weight' | 'confirm' | 'abnormal';

/**
 * 发布前置校验的唯一实现（FR-09 R5）。
 * 「看板就绪度」与「确认发布」共用本函数，保证两处口径不会打架。
 */
const publishIssuesFor = (c: Contract): { category: CheckCategory; message: string }[] => {
  const issues: { category: CheckCategory; message: string }[] = [];
  const items = itemsOf(c.id);
  if (!items.length) return [{ category: 'confirm', message: '本月无合约' }];

  // ① 有效任务权重合计 = 100%
  const total = sumWeight(items);
  if (total !== 100) issues.push({ category: 'weight', message: `有效权重合计 ${total}% ≠ 100%` });

  // ② 合约与评分全部确认完成
  if (c.status === 'draft' || c.status === 'submitted') {
    issues.push({ category: 'confirm', message: '合约尚未完成组长核对确认' });
  }
  const unscored = items.filter((i) => typeof i.score !== 'number');
  if (unscored.length) issues.push({ category: 'confirm', message: `存在 ${unscored.length} 个工作包未评分` });

  // ③ 无录入异常（权重/日期/交付物）
  if (items.some((i) => dayjs(i.due_date).format('YYYY-MM') !== c.month)) {
    issues.push({ category: 'abnormal', message: '存在截止日不在合约月份内' });
  }
  if (items.some((i) => !i.deliverable_type || !i.deliverable_desc)) {
    issues.push({ category: 'abnormal', message: '存在工作包缺少交付物约定' });
  }
  if (items.some((i) => i.type !== '基础履职类' && !i.objective_id)) {
    issues.push({ category: 'abnormal', message: '存在非基础履职类工作包未关联大目标' });
  }
  return issues;
};

/** 字符串形式，供校验页/发布接口沿用既有契约 */
const mockPublishCheckFor = (c: Contract): string[] => publishIssuesFor(c).map((x) => x.message);

export const mockPublishCheck = (month: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role === 'center', '仅中心管理者可执行发布', 403);
    const ids = visibleUserIds(u).filter((id) => db.users.find((x) => x.id === id)?.role === 'employee');
    const cs = db.contracts.filter((c) => c.month === month && ids.includes(c.user_id));
    if (!cs.length) throw new ApiError(422, '本月暂无可发布的合约');
    return cs.map((c) => ({
      user_id: c.user_id,
      user_name: db.users.find((x) => x.id === c.user_id)?.name ?? '',
      contract_id: c.id,
      status: c.status,
      score: c.score ?? 0,
      issues: mockPublishCheckFor(c),
    }));
  }, 300);

export const mockPublish = (month: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role === 'center', '仅中心管理者可执行发布', 403);
    const ids = visibleUserIds(u).filter((id) => db.users.find((x) => x.id === id)?.role === 'employee');
    const cs = db.contracts.filter((c) => c.month === month && ids.includes(c.user_id));
    const blocked = cs.map((c) => ({ c, issues: mockPublishCheckFor(c) })).filter((x) => x.issues.length);
    assertRollback(blocked.length === 0, blocked.map((b) => `${db.users.find((x) => x.id === b.c.user_id)?.name}：${b.issues.join('、')}`).join('；'), 422);
    cs.forEach((c) => {
      c.status = 'published';
      c.publish_at = dayjs().format('YYYY-MM-DD HH:mm:ss');
      c.score = monthlyScore(itemsOf(c.id));
    });
    return { published: cs.length };
  }, 500);

export const mockReturnForBasis = (contractId: string, opinion: string) =>
  call(() => {
    const u = currentUser();
    assertRollback(u.role === 'center', '仅中心管理者可退回', 403);
    assertRollback(Boolean(opinion && opinion.trim()), '退回意见必填', 422);
    const c = db.contracts.find((x) => x.id === contractId) as Contract | undefined;
    assertRollback(Boolean(c), '合约不存在', 404);
    (c as Contract).status = 'confirmed';
    (c as Contract).reject_reason = opinion;
    (c as Contract).reject_by = u.id;
    return c as Contract;
  });

/* ---------------- 日报 / 周报 FR-07 ---------------- */

export const mockListReports = () =>
  call(() => {
    const u = currentUser();
    return db.reports.filter((r) => r.user_id === u.id);
  }, 200);

export const mockCreateReport = (payload: { kind: 'daily' | 'weekly'; period: string; content: string }) =>
  call(() => {
    const u = currentUser();
    assertRollback(Boolean(payload.period), '日期或日期区间必填', 422);
    assertRollback(Boolean(payload.content), '内容不能为空', 422);
    const existIdx = db.reports.findIndex((r) => r.user_id === u.id && r.period === payload.period && r.kind === payload.kind);
    const report: ReportEntry = {
      id: existIdx >= 0 ? db.reports[existIdx].id : `rep_${Date.now().toString(36)}`,
      user_id: u.id,
      kind: payload.kind,
      period: payload.period,
      content_ref: payload.content,
      ai_summary: [],
      linked_item_ids: [],
      version: existIdx >= 0 ? db.reports[existIdx].version + 1 : 1, // 同一日期重复上传覆盖更新，保留版本（R5）
    };
    if (existIdx >= 0) db.reports[existIdx] = report;
    else db.reports.push(report);
    return report;
  }, 300);

export const mockParseReport = (reportId: string) =>
  call(() => {
    aiGate();
    const u = currentUser();
    const r = db.reports.find((x) => x.id === reportId);
    assertRollback(Boolean(r), '日报周报不存在', 404);
    const month = dayjs().format('YYYY-MM');
    const c = contractOf(u.id, month);
    const myItems = c ? itemsOf(c.id).filter((i) => i.progress < 100) : [];
    const sentences = (r as ReportEntry).content_ref.split(/[。！\n；;]/).filter((s: string) => s.trim().length > 4);
    const summary = sentences.slice(0, 5);
    const suggestions = myItems.slice(0, 3).map((i, idx) => ({
      item_id: i.id,
      item_title: i.title,
      delta: [20, 15, 10][idx] ?? 5,
      reason: `日报/周报文本与「${i.title}」语义匹配`,
    }));
    return {
      report_id: reportId,
      summary: summary.length ? summary : ['未提取到要点，请补充更具体的进展描述'],
      suggestions,
      todo: ['建议核对截止日临近的工作包'],
    };
  }, 800);

export const mockAdoptReport = (reportId: string, itemIds: string[]) =>
  call(() => {
    const u = currentUser();
    const r = db.reports.find((x) => x.id === reportId);
    assertRollback(Boolean(r), '日报周报不存在', 404);
    (r as ReportEntry).linked_item_ids = itemIds;
    itemIds.forEach((id) => {
      const it = db.items.find((x) => x.id === id) as ContractItem | undefined;
      if (!it) return;
      const next = Math.min(100, (it as ContractItem).progress + 10);
      const delta = next - (it as ContractItem).progress;
      Object.assign(it as object, { progress: next });
      db.progressLogs.push({
        id: `plog_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        item_id: id,
        operator: u.id,
        raw_text: `（日报周报采纳：${(r as ReportEntry).period}）`,
        ai_result: null,
        delta,
        created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      });
    });
    recomputeObjectives();
    return { report: r, adopted: itemIds.length };
  }, 400);

/* ---------------- 看板 FR-05 ---------------- */

const monthItemRows = (month: string, u: User, groupId?: string): DrilldownRow[] => {
  const ids = new Set(visibleUserIds(u));
  return db.items
    .filter((i) => {
      const c = db.contracts.find((x) => x.id === i.contract_id);
      if (!c || c.month !== month) return false;
      if (!ids.has(c.user_id)) return false;
      if (groupId && groupId !== 'all') {
        const owner = db.users.find((x) => x.id === c.user_id);
        if (owner?.group_id !== groupId) return false;
      }
      return true;
    })
    .map((i) => {
      const c = db.contracts.find((x) => x.id === i.contract_id) as Contract;
      const owner = db.users.find((x) => x.id === c.user_id) as User;
      return {
        id: i.id,
        user_id: c.user_id,
        user_name: owner.name,
        item_title: i.title,
        type: i.type,
        objective_name: db.objectives.find((o) => o.id === i.objective_id)?.name ?? '—',
        weight: i.weight,
        progress: i.progress,
        due_date: i.due_date,
        risk_status: riskStatus(i),
        deliverable_status: hasDeliverable(i.id) ? '已上传' : '未上传',
        score: i.score,
      };
    });
};

/** 百分比，用于指标卡副标题（除零保护） */
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const avg = (ns: number[]) => (ns.length ? Math.round((ns.reduce((s, n) => s + n, 0) / ns.length) * 10) / 10 : 0);

/** 组内可见成员的当月合约 */
const scopedContracts = (month: string, u: User, groupId = 'all') => {
  const ids = new Set(visibleUserIds(u));
  return db.contracts.filter((c) => {
    if (c.month !== month || !ids.has(c.user_id)) return false;
    if (groupId !== 'all') return db.users.find((x) => x.id === c.user_id)?.group_id === groupId;
    return true;
  });
};

export const mockMetrics = (month: string, groupId = 'all'): Promise<MetricCard[]> =>
  call<MetricCard[]>(() => {
    const u = currentUser();
    const rows = monthItemRows(month, u, groupId);
    const riskCount = rows.filter((r) => r.risk_status !== '正常').length;
    const doneCount = rows.filter((r) => r.progress >= 100).length;
    const published = scopedContracts(month, u, groupId).filter((c) => c.status === 'published').length;
    const scored = rows.filter((r) => typeof r.score === 'number').map((r) => r.score as number);
    return [
      {
        key: 'total', label: '工作包总数', value: rows.length, suffix: '个',
        caption: `覆盖 ${new Set(rows.map((r) => r.user_id)).size} 名成员`, tone: 'primary', drillable: true,
      },
      {
        key: 'risk', label: '风险 / 逾期', value: riskCount, suffix: '个',
        caption: `占工作包 ${pct(riskCount, rows.length)}%`, tone: riskCount ? 'danger' : 'success', drillable: true,
      },
      {
        key: 'done', label: '已完成', value: doneCount, suffix: '个',
        caption: `完成率 ${pct(doneCount, rows.length)}%`, tone: 'success', drillable: true,
      },
      {
        key: 'published', label: '已发布绩效', value: publishedRows(rows, month, u, groupId).length, suffix: '个',
        caption: `覆盖 ${published} 人 · 本月共 ${scopedContracts(month, u, groupId).length} 份合约`,
        tone: 'default', drillable: true,
      },
      {
        key: 'avgScore', label: '平均履约得分', value: avg(scored), suffix: '分',
        caption: scored.length ? `已评 ${scored.length} 个工作包` : '本月尚无评分', tone: 'primary', drillable: false,
      },
      {
        key: 'avgProgress', label: '平均进度', value: avg(rows.map((r) => r.progress)), suffix: '%',
        caption: `合计权重 ${sumWeight(rows)}%`, tone: 'default', drillable: false,
      },
    ];
  }, 300);

/** 已发布合约的 id 集合（行级权限内） */
const publishedContractIds = (month: string, u: User, groupId = 'all') =>
  new Set(scopedContracts(month, u, groupId).filter((c) => c.status === 'published').map((c) => c.id));

/**
 * 已发布绩效的工作包明细。
 * 指标卡与下钻共用本函数，确保「卡上的数字 = 点开的条数」（FR-05 R5）。
 */
const publishedRows = (rows: DrilldownRow[], month: string, u: User, groupId = 'all') => {
  const ids = publishedContractIds(month, u, groupId);
  return rows
    .filter((r) => {
      const it = db.items.find((x) => x.id === r.id);
      return it ? ids.has(it.contract_id) : false;
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
};

/** 下钻：支持中心/组/个人三级（FR-05 R1），并在 metric 维度上做确定性过滤（R5 条数一致） */
export const mockDrilldown = (
  metric: MetricKey,
  month: string,
  groupId = 'all',
  level: DrillLevel = 'center',
  personId = 'all',
): Promise<DrilldownRow[]> =>
  call<DrilldownRow[]>(() => {
    const u = currentUser();
    let rows = monthItemRows(month, u, groupId);

    // R1 三级过滤：组/个人在已按行级权限裁剪的集合上再收敛
    if (level === 'group' && groupId === 'all') {
      // 中心视角下按组归类时不削减数据，交由前端分组展示
    }
    if (level === 'person' && personId !== 'all') {
      rows = rows.filter((r) => r.user_id === personId);
    }

    switch (metric) {
      case 'risk':
        rows = rows
          .filter((r) => r.risk_status !== '正常')
          .sort((a, b) => (a.risk_status === '逾期' ? 0 : 1) - (b.risk_status === '逾期' ? 0 : 1));
        break;
      case 'done':
        rows = rows.filter((r) => r.progress >= 100).sort((a, b) => b.due_date.localeCompare(a.due_date));
        break;
      case 'published':
        rows = publishedRows(rows, month, u, groupId);
        break;
      case 'total':
        rows = rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
        break;
      default:
        rows = rows.sort((a, b) => a.due_date.localeCompare(b.due_date));
    }
    return rows;
  }, 400);

/* ---------------- 驾驶舱聚合（FR-05 + FR-04 R4 + FR-09 R5） ---------------- */

export const mockOverview = (
  month: string,
  groupId = 'all',
  level: DrillLevel = 'center',
  personId = 'all',
): Promise<DashboardOverview> =>
  call<DashboardOverview>(() => {
    const u = currentUser();
    const groupName = groupId === 'all' ? '全中心' : (db.groups.find((g) => g.id === groupId)?.name ?? groupId);
    const allContracts = scopedContracts(month, u, groupId);
    const allMemberIds = [...new Set(allContracts.map((c) => c.user_id))];
    const allRows = monthItemRows(month, u, groupId);
    // 个人级：把整个驾驶舱收敛到某一个人（FR-05 R1 三级视角）
    const focusId = level === 'person' && personId !== 'all' ? personId : null;
    const rows = focusId ? allRows.filter((r) => r.user_id === focusId) : allRows;
    const memberIds = focusId ? allMemberIds.filter((id) => id === focusId) : allMemberIds;
    const contracts = focusId ? allContracts.filter((c) => c.user_id === focusId) : allContracts;

    /* 1) 大目标：实时重算加权进度 + 贡献占比（FR-04 R3/R4） */
    recomputeObjectives();
    const objectives: ObjectiveBoard[] = db.objectives
      .filter((o) => (u.role === 'leader' ? o.group_id === u.group_id : true))
      .map((o) => {
        const linked = db.items.filter((i) => i.objective_id === o.id && rows.some((r) => r.id === i.id));
        const totalWeight = linked.reduce((s, i) => s + i.weight, 0);
        return {
          id: o.id,
          name: o.name,
          group_name: db.groups.find((g) => g.id === o.group_id)?.name ?? '—',
          owner_name: db.users.find((x) => x.id === o.owner_id)?.name ?? '—',
          status: o.status,
          progress: objectiveProgress(linked),
          total_weight: totalWeight,
          link_count: linked.length,
          done_count: linked.filter((i) => i.progress >= 100).length,
          risk_count: linked.filter((i) => riskStatus(i) !== '正常').length,
          contributors: linked
            .map((i) => {
              const c = db.contracts.find((x) => x.id === i.contract_id) as Contract;
              const owner = db.users.find((x) => x.id === c.user_id) as User;
              return {
                item_id: i.id,
                user_id: c.user_id,
                user_name: owner.name,
                item_title: i.title,
                weight: i.weight,
                progress: i.progress,
                contribution: totalWeight ? Math.round((i.weight / totalWeight) * 1000) / 10 : 0,
              };
            })
            .sort((a, b) => b.contribution - a.contribution),
        };
      });

    /* 2) 组维度排行 */
    const groupIds = [...new Set(memberIds.map((id) => db.users.find((x) => x.id === id)?.group_id ?? ''))].filter(Boolean);
    const groups: GroupStat[] = groupIds.map((gid) => {
      const members = memberIds.filter((id) => db.users.find((x) => x.id === id)?.group_id === gid);
      const gRows = rows.filter((r) => members.includes(r.user_id));
      const gContracts = contracts.filter((c) => members.includes(c.user_id));
      const gScores = gRows.filter((r) => typeof r.score === 'number').map((r) => r.score as number);
      return {
        group_id: gid,
        group_name: db.groups.find((g) => g.id === gid)?.name ?? gid,
        member_count: members.length,
        contract_count: gContracts.length,
        item_count: gRows.length,
        avg_progress: avg(gRows.map((r) => r.progress)),
        avg_score: avg(gScores),
        risk_count: gRows.filter((r) => r.risk_status !== '正常').length,
        published_count: gContracts.filter((c) => c.status === 'published').length,
      };
    }).sort((a, b) => b.avg_progress - a.avg_progress);

    /* 3) 个人维度排行 */
    const persons: PersonStat[] = memberIds.map((uid) => {
      const owner = db.users.find((x) => x.id === uid) as User;
      const pRows = rows.filter((r) => r.user_id === uid);
      const contract = contracts.find((c) => c.user_id === uid) ?? null;
      const scores = pRows.filter((r) => typeof r.score === 'number').map((r) => r.score as number);
      return {
        user_id: uid,
        user_name: owner.name,
        group_name: db.groups.find((g) => g.id === owner.group_id)?.name ?? '—',
        contract_status: contract?.status ?? null,
        item_count: pRows.length,
        avg_progress: avg(pRows.map((r) => r.progress)),
        score: contract?.score ?? (scores.length ? avg(scores) : null),
        risk_count: pRows.filter((r) => r.risk_status !== '正常').length,
        undelivered_count: pRows.filter((r) => r.deliverable_status === '未上传').length,
      };
    }).sort((a, b) => b.avg_progress - a.avg_progress);

    /* 4) 四类任务分布（PRD FR-02 R1 枚举顺序） */
    const type_slices: TypeSlice[] = ITEM_TYPES.map((t) => {
      const list = rows.filter((r) => r.type === t);
      return {
        type: t,
        count: list.length,
        weight: sumWeight(list),
        avg_progress: avg(list.map((r) => r.progress)),
      };
    });

    /* 5) 评分档位分布（PRD FR-09 评分档位表） */
    const scoredRows = rows.filter((r) => typeof r.score === 'number');
    const tier_slices: TierSlice[] = SCORE_TIERS.map((t) => ({
      tier: t.tier,
      range: t.range,
      count: scoredRows.filter((r) => (r.score as number) >= t.min && (r.score as number) <= t.max).length,
      color: t.max < 80 ? '#cf1322' : t.max < 100 ? '#fa8c16' : t.max === 100 ? '#1677ff' : '#52c41a',
    }));

    /* 6) 发布前置校验三项（FR-09 R5）—— 直接复用「确认发布」的同一份校验实现 */
    const flagged = contracts.flatMap((c) => publishIssuesFor(c).map((issue) => ({ c, issue })));
    const summary = (category: CheckCategory, okDetail: string) => {
      const hit = flagged.filter((x) => x.issue.category === category);
      if (!hit.length) return { passed: true, detail: okDetail };
      const who = [...new Set(hit.map((x) => db.users.find((p) => p.id === x.c.user_id)?.name ?? x.c.user_id))];
      const msg = [...new Set(hit.map((x) => x.issue.message))].join('；');
      return { passed: false, detail: `${who.length} 人待处理（${who.join('、')}）：${msg}` };
    };
    const cWeight = summary('weight', '全部合约权重合计均为 100%');
    const cConfirm = summary('confirm', '合约已核对且工作包评分齐全');
    const cAbnormal = summary('abnormal', '无录入异常项');
    const readiness: PublishReadiness = {
      ok: cWeight.passed && cConfirm.passed && cAbnormal.passed,
      month,
      total_contract: contracts.length,
      published_count: contracts.filter((c) => c.status === 'published').length,
      checks: [
        { key: 'weight', label: '有效任务权重合计 = 100%', ...cWeight },
        { key: 'confirmed', label: '合约与评分全部确认完成', ...cConfirm },
        { key: 'abnormal', label: '无录入异常（权重/日期/交付物）', ...cAbnormal },
      ],
    };

    /* 7) 风险 TOP5（展示用）与全量计数（指标卡用，FR-05 R5） */
    const riskAll = rows
      .filter((r) => r.risk_status !== '正常')
      .sort((a, b) => (a.risk_status === '逾期' ? 0 : 1) - (b.risk_status === '逾期' ? 0 : 1));
    const risk_top = riskAll.slice(0, 5);

    /* 已发布绩效明细：与下钻共用口径 */
    const publishedList = publishedRows(rows, month, u, groupId);

    const metrics: MetricCard[] = [
      {
        key: 'total', label: '工作包总数', value: rows.length, suffix: '个',
        caption: `覆盖 ${memberIds.length} 名成员`, tone: 'primary', drillable: true,
      },
      {
        key: 'risk', label: '风险 / 逾期', value: riskAll.length, suffix: '个',
        caption: `占工作包 ${pct(riskAll.length, rows.length)}%`,
        tone: riskAll.length ? 'danger' : 'success', drillable: true,
      },
      {
        key: 'done', label: '已完成', value: rows.filter((r) => r.progress >= 100).length, suffix: '个',
        caption: `完成率 ${pct(rows.filter((r) => r.progress >= 100).length, rows.length)}%`, tone: 'success', drillable: true,
      },
      {
        // 与下钻共用同一口径，保证「卡上的数字 = 点开的条数」（FR-05 R5）
        key: 'published', label: '已发布绩效', value: publishedList.length, suffix: '个',
        caption: `覆盖 ${readiness.published_count} 人 · 本月共 ${contracts.length} 份合约`,
        tone: 'default', drillable: true,
      },
      {
        key: 'avgScore', label: '平均履约得分', value: avg(scoredRows.map((r) => r.score as number)), suffix: '分',
        caption: scoredRows.length ? `已评 ${scoredRows.length} 个工作包` : '本月尚无评分', tone: 'primary', drillable: false,
      },
      {
        key: 'avgProgress', label: '整体推进度', value: avg(rows.map((r) => r.progress)), suffix: '%',
        caption: `合计权重 ${sumWeight(rows)}%`, tone: 'default', drillable: false,
      },
    ];

    /* 8) 筛选项：按角色权限恒定给出，不受当前 groupId / personId 影响，避免选中后候选项塌陷 */
    const group_options = db.groups
      .filter((g) => g.id !== 'grp_root')
      .filter((g) => (u.role === 'center' ? true : g.id === u.group_id))
      .map((g) => ({ group_id: g.id, group_name: g.name }));

    const person_options = allMemberIds.map((uid) => {
      const owner = db.users.find((x) => x.id === uid) as User;
      return {
        user_id: uid,
        user_name: owner.name,
        group_name: db.groups.find((g) => g.id === owner.group_id)?.name ?? '—',
      };
    });

    return {
      month,
      scope: { level, group_id: groupId, group_name: groupName, member_count: memberIds.length },
      updated_at: now(),
      metrics,
      objectives,
      groups,
      group_options,
      persons,
      person_options,
      type_slices,
      tier_slices,
      risk_top,
      readiness,
    };
  }, 320);

/* ---------------- 能力画像 FR-08 ---------------- */

const SKILL_DICT: { tag: string; kw: string[]; dtype: string[] }[] = [
  { tag: '需求与产品分析能力', kw: ['需求', '分析', '调研', '方案'], dtype: ['设计文档'] },
  { tag: 'Java 后端开发能力', kw: ['后端', 'java', '接口', '服务'], dtype: ['代码合并请求'] },
  { tag: '前端开发能力', kw: ['前端', '页面', 'react'], dtype: [] },
  { tag: '数据库与 SQL 调优能力', kw: ['sql', '数据库', '索引', '调优'], dtype: ['数据报表'] },
  { tag: '系统架构与治理能力', kw: ['架构', '治理', '分布式', '稳定性', '降噪'], dtype: [] },
  { tag: '测试与质量保障能力', kw: ['测试', '联调', '质量', '验收', '覆盖率'], dtype: ['测试报告'] },
  { tag: '项目管理与协同能力', kw: ['协同', '排期', '计划', '值班'], dtype: ['运维记录'] },
  { tag: 'AI 应用与数据能力', kw: ['ai', '智能', '巡检', '自动'], dtype: ['PoC 结论报告'] },
];

export const mockSkills = (userId: string) =>
  call<SkillTag[]>(() => {
    const u = currentUser();
    const target = userId || u.id;
    assertRollback(u.id === target || u.role !== 'employee', '仅本人/组长/中心可查看能力画像', 403);
    const itemIds = db.items.filter((i) => {
      const c = db.contracts.find((x) => x.id === i.contract_id);
      return c && c.user_id === target;
    });
    const logs = db.progressLogs.filter((l) => l.operator === target);
    const result: SkillTag[] = [];
    SKILL_DICT.forEach((dict, idx) => {
      let score = 0;
      const evidence: string[] = [];
      itemIds.forEach((i) => {
        const text = `${i.title}${i.target_desc}`.toLowerCase();
        if (dict.kw.some((k) => text.includes(k))) {
          score += 1;
          evidence.push(i.id);
        }
        if (dict.dtype.includes(i.deliverable_type)) {
          score += 1;
          evidence.push(i.id);
        }
      });
      logs.forEach((l) => {
        const text = `${l.raw_text}${l.ai_result?.evidence ?? ''}`.toLowerCase();
        if (dict.kw.some((k) => text.includes(k))) score += 0.5;
      });
      const stored = db.skillTags.find((t) => t.user_id === target && t.tag_name === dict.tag);
      if (score >= 2) {
        result.push({
          id: stored?.id ?? `skill_${target}_${idx}`,
          user_id: target,
          tag_name: dict.tag,
          score,
          evidence_item_ids: Array.from(new Set(evidence)),
          updated_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          hidden: stored?.hidden ?? 0,
        });
      }
    });
    db.skillTags = [...db.skillTags.filter((t) => t.user_id !== target), ...result];
    return result;
  }, 400);

export const mockHideSkill = (tagId: string) =>
  call(() => {
    const t = db.skillTags.find((x) => x.id === tagId);
    assertRollback(Boolean(t), '标签不存在', 404);
    (t as SkillTag).hidden = 1;
    return t;
  });
