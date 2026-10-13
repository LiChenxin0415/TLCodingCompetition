/**
 * 用户服务（LOGIN-01/02、AUTH-04）
 * 需求依据：4.1 登录与角色切换、api-spec POST /api/login
 */

import type { User } from '../types.ts';
import { getDb } from '../db/index.ts';
import { findUserById, listUsers } from '../repositories/userRepo.ts';
import { badRequest } from '../utils/errors.ts';
import { signToken } from '../utils/jwt.ts';

export interface LoginResult {
  token: string;
  user: User;
}

/** 免密登录（LOGIN-02）：按 userId 查预置账号并签发 24h token */
export function login(rawUserId: unknown): LoginResult {
  if (typeof rawUserId !== 'string' || rawUserId.trim() === '') {
    throw badRequest('userId 不能为空');
  }
  const userId = rawUserId.trim();
  const user = findUserById(getDb(), userId);
  if (user === null) {
    throw badRequest(`用户 ${userId} 不存在`);
  }
  return { token: signToken({ id: user.id, name: user.name, role: user.role }), user };
}

/** 登录页账号卡片数据源（LOGIN-01） */
export function listLoginAccounts(): User[] {
  return listUsers(getDb());
}
