import type { User } from '../types.ts';
import { getDb } from '../db/index.ts';
import { findUserById, listUsers } from '../repositories/userRepo.ts';
import { badRequest } from '../utils/errors.ts';
import { signToken } from '../utils/jwt.ts';

export interface LoginResult { token: string; user: User; }

export function login(rawUserId: unknown): LoginResult {
  if (typeof rawUserId !== 'string' || rawUserId.trim() === '') throw badRequest('userId 不能为空');
  const user = findUserById(getDb(), rawUserId.trim());
  if (user === null) throw badRequest('用户 ' + rawUserId + ' 不存在');
  return { token: signToken({ id: user.id, name: user.name, role: user.role, groupId: user.groupId }), user };
}

export function listAccounts(): User[] {
  return listUsers(getDb());
}