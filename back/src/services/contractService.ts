import type { AuthUser, Contract, ContractItem } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as repo from '../repositories/contractRepo.ts';
import { forbidden, notFound, unprocessable, conflict } from '../utils/errors.ts';
import { checkItem } from '../utils/algorithms.ts';
import { currentMonth } from '../utils/month.ts';
import { newId, nowStamp } from '../utils/misc.ts';
import { insertAudit } from '../repositories/auditRepo.ts';

const ITEM_TYPES = ['基础履职类', '重点交付类', '治理改善类', '探索突破类'];

function assertLeaderOfGroup(user: AuthUser, memberGroupId: string | null): void {
  if (user.role === 'center') return;
  if (user.role === 'leader' && user.groupId === memberGroupId) return;
  throw forbidden('无权限访问');
}

export function getOrCreateContract(user: AuthUser, month: string): Contract {
  let contract = repo.findContractByUserMonth(getDb(), user.id, month);
  if (contract === null) {
    contract = { id: 'ctr_' + user.id + '_' + month, userId: user.id, month, status: 'draft', submitAt: null, checkBy: null, publishAt: null };
    repo.insertContract(getDb(), contract);
  }
  return contract;
}

export function getContractForUser(user: AuthUser, contractId: string): { contract: Contract; items: ContractItem[] } {
  const contract = repo.findContract(getDb(), contractId);
  if (contract === null) throw notFound('合约不存在');
  const member = { groupId: null };
  void member;
  if (user.role === 'employee' && contract.userId !== user.id) throw forbidden('无权限访问');
  if (user.role === 'leader' || user.role === 'center') {
    // 组长/中心可访问本组/全员
  }
  const items = repo.listItemsByContract(getDb(), contractId);
  return { contract, items };
}

/** 制定：整体保存工作包（草稿态替换） */
export function saveItems(user: AuthUser, contractId: string, rawItems: unknown): { contract: Contract; items: ContractItem[] } {
  const { contract } = getContractForUser(user, contractId);
  if (contract.userId !== user.id) throw forbidden('只能编辑本人合约');
  if (contract.status === 'published') throw conflict('已发布合约不可修改');

  if (!Array.isArray(rawItems)) throw unprocessable('工作包列表格式错误');
  const db = getDb();

  // 删除旧工作包（draft/submitted 阶段允许重排）
  const existing = repo.listItemsByContract(db, contractId);
  for (const it of existing) repo.deleteItem(db, it.id);

  const items: ContractItem[] = [];
  for (const raw of rawItems) {
    const r = raw as Record<string, unknown>;
    const type = String(r.type ?? '');
    if (!ITEM_TYPES.includes(type)) throw unprocessable('工作包类型非法：' + type);
    const item: ContractItem = {
      id: newId('item'),
      contractId,
      objectiveId: typeof r.objective_id === 'string' && r.objective_id !== '' ? r.objective_id : null,
      type: type as ContractItem['type'],
      priority: ['高', '中', '低'].includes(String(r.priority)) ? (r.priority as ContractItem['priority']) : '中',
      title: String(r.title ?? '').trim(),
      targetDesc: String(r.target_desc ?? '').trim(),
      deliverableType: String(r.deliverable_type ?? '').trim(),
      deliverableDesc: String(r.deliverable_desc ?? '').trim(),
      weight: Math.round(Number(r.weight) || 0),
      dueDate: String(r.due_date ?? ''),
      progress: Math.max(0, Math.min(100, Math.round(Number(r.progress) || 0))),
      source: r.source === 'AI' ? 'AI' : 'manual',
      checked: 0,
      score: null,
    };
    items.push(item);
    repo.insertItem(db, item);
  }
  return { contract, items };
}

/** 提交核对：校验硬规则 */
export function submitContract(user: AuthUser, contractId: string): { contract: Contract; items: ContractItem[]; checks: Array<Record<string, unknown>> } {
  const { contract, items } = getContractForUser(user, contractId);
  if (contract.userId !== user.id) throw forbidden();
  if (contract.status === 'published') throw conflict('已发布合约不可修改');

  if (items.length < 3 || items.length > 5) throw unprocessable('合约内工作包需 3—5 个，当前 ' + items.length + ' 个');
  const weightSum = items.reduce((s, it) => s + it.weight, 0);
  if (weightSum !== 100) throw unprocessable('权重合计必须为 100%，当前 ' + weightSum + '%');

  const checks = items.map((it) => {
    const c = checkItem({ targetDesc: it.targetDesc, dueDate: it.dueDate, deliverableType: it.deliverableType, deliverableDesc: it.deliverableDesc });
    if (it.deliverableType === '' || it.deliverableDesc === '') throw unprocessable('工作包「' + it.title + '」缺少交付物约定');
    return { item_title: it.title, score: c.score, issues: c.issues, pass: c.score >= 80 };
  });

  repo.updateContractStatus(getDb(), contractId, 'submitted', { submitAt: nowStamp() });
  insertAudit(getDb(), { id: newId('audit'), operator: user.id, action: 'submit_contract', target: contractId, detail: '提交合约核对', createdAt: nowStamp() });
  return { contract: { ...contract, status: 'submitted', submitAt: nowStamp() }, items, checks };
}

export function reviewContract(user: AuthUser, contractId: string, approve: boolean, note: string): Contract {
  if (user.role !== 'leader' && user.role !== 'center') throw forbidden();
  const contract = repo.findContract(getDb(), contractId);
  if (contract === null) throw notFound('合约不存在');
  if (approve) {
    repo.updateContractStatus(getDb(), contractId, 'confirmed', { checkBy: user.id });
    insertAudit(getDb(), { id: newId('audit'), operator: user.id, action: 'confirm_contract', target: contractId, detail: '组长确认合约', createdAt: nowStamp() });
    return { ...contract, status: 'confirmed', checkBy: user.id };
  }
  if (note.trim() === '') throw unprocessable('退回意见不能为空');
  repo.updateContractStatus(getDb(), contractId, 'rejected', { checkBy: user.id });
  insertAudit(getDb(), { id: newId('audit'), operator: user.id, action: 'reject_contract', target: contractId, detail: note, createdAt: nowStamp() });
  return { ...contract, status: 'rejected', checkBy: user.id };
}

export function listTeamContracts(user: AuthUser, month: string): Array<Record<string, unknown>> {
  if (user.role === 'employee') throw forbidden();
  const groupId = user.role === 'leader' ? user.groupId : null;
  const contracts = repo.listContractsByMonth(getDb(), month, groupId);
  return contracts.map((c) => ({ contract: c, items: repo.listItemsByContract(getDb(), c.id) }));
}