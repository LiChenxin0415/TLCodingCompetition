import type { AuthUser, Objective } from '../types.ts';
import { getDb } from '../db/index.ts';
import * as objRepo from '../repositories/objectiveRepo.ts';
import * as itemRepo from '../repositories/contractRepo.ts';
import { forbidden, notFound, unprocessable } from '../utils/errors.ts';
import { objectiveProgress } from '../utils/algorithms.ts';
import { newId } from '../utils/misc.ts';

export function listObjectives(user: AuthUser): Objective[] {
  const all = objRepo.listObjectives(getDb());
  if (user.role === 'center') return all;
  if (user.role === 'leader') return all.filter((o) => o.groupId === user.groupId || o.ownerId === user.id);
  return all; // employee：由前端按关联合约过滤
}

export function createObjective(user: AuthUser, body: Record<string, unknown>): Objective {
  if (user.role !== 'center' && user.role !== 'leader') throw forbidden();
  const name = String(body.name ?? '').trim();
  if (name === '') throw unprocessable('大目标名称不能为空');
  const objective: Objective = {
    id: 'obj_' + newId(''),
    name,
    groupId: typeof body.group_id === 'string' ? body.group_id : user.groupId,
    ownerId: typeof body.owner_id === 'string' ? body.owner_id : user.id,
    startDate: String(body.start_date ?? ''),
    endDate: String(body.end_date ?? ''),
    status: typeof body.status === 'string' ? body.status : '进行中',
  };
  objRepo.insertObjective(getDb(), objective);
  return objective;
}

export function updateObjective(user: AuthUser, id: string, body: Record<string, unknown>): Objective {
  if (user.role !== 'center' && user.role !== 'leader') throw forbidden();
  const existing = objRepo.findObjective(getDb(), id);
  if (existing === null) throw notFound('大目标不存在');
  const objective: Objective = {
    id,
    name: String(body.name ?? existing.name),
    groupId: body.group_id !== undefined ? (typeof body.group_id === 'string' ? body.group_id : null) : existing.groupId,
    ownerId: body.owner_id !== undefined ? (typeof body.owner_id === 'string' ? body.owner_id : null) : existing.ownerId,
    startDate: String(body.start_date ?? existing.startDate),
    endDate: String(body.end_date ?? existing.endDate),
    status: String(body.status ?? existing.status),
  };
  objRepo.updateObjective(getDb(), objective);
  return objective;
}

export function objectiveDetail(user: AuthUser, id: string): { objective: Objective; progress: number; items: Array<Record<string, unknown>> } {
  const objective = objRepo.findObjective(getDb(), id);
  if (objective === null) throw notFound('大目标不存在');
  const links = objRepo.listItemLinksByObjective(getDb(), id);
  const progress = objectiveProgress(links.map((l) => ({ progress: l.progress, weight: l.weight })));
  const totalWeight = links.reduce((s, l) => s + l.weight, 0);
  const items = links.map((l) => ({ ...l, contribution: totalWeight > 0 ? Math.round((l.weight / totalWeight) * 1000) / 10 : 0 }));
  return { objective, progress, items };
}