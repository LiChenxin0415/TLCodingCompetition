/**
 * 鉴权中间件（AUTH-01/03）
 * 需求依据：backend-design §6 权限与安全设计
 *   - token 缺失 / 失效 → 401
 *   - 资源归属校验在 service 层，越权 → 403（AUTH-02）
 */

import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../types.ts';
import { forbidden, unauthorized } from '../utils/errors.ts';
import { verifyToken } from '../utils/jwt.ts';
import { getDb } from '../db/index.ts';
import { findUserById } from '../repositories/userRepo.ts';

/** 带登录态请求：处理器内用 authedUser(req) 取用户 */
export interface AuthedRequest extends Request {
  user: AuthUser;
}

export function authedUser(req: Request): AuthUser {
  const user = (req as Partial<AuthedRequest>).user;
  if (user === undefined) {
    throw unauthorized();
  }
  return user;
}

/** 解析 Bearer token 并注入 req.user；失败 401 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const matched = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (matched === null) {
    throw unauthorized('未登录或缺少 token');
  }

  const payload = verifyToken(matched[1].trim());
  const user = findUserById(getDb(), payload.sub);
  if (user === null) {
    throw unauthorized('用户不存在，请重新登录');
  }

  (req as AuthedRequest).user = { id: user.id, name: user.name, role: user.role };
  next();
}

/** 仅负责人可用（团队总览 / 团队汇总 / 导出，AUTH-01） */
export function requireLeader(req: Request, _res: Response, next: NextFunction): void {
  const user = authedUser(req);
  if (user.role !== 'leader') {
    throw forbidden('无权限访问');
  }
  next();
}
