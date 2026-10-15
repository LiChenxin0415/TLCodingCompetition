import type { NextFunction, Request, Response } from 'express';
import type { AuthUser, Role } from '../types.ts';
import { forbidden, unauthorized } from '../utils/errors.ts';
import { verifyToken } from '../utils/jwt.ts';
import { getDb } from '../db/index.ts';
import { findUserById } from '../repositories/userRepo.ts';

export interface AuthedRequest extends Request {
  user: AuthUser;
}

export function authedUser(req: Request): AuthUser {
  const user = (req as Partial<AuthedRequest>).user;
  if (user === undefined) throw unauthorized();
  return user;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const matched = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (matched === null) throw unauthorized('未登录或缺少 token');
  const payload = verifyToken(matched[1].trim());
  const user = findUserById(getDb(), payload.sub);
  if (user === null) throw unauthorized('用户不存在，请重新登录');
  (req as AuthedRequest).user = { id: user.id, name: user.name, role: user.role, groupId: user.groupId };
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = authedUser(req);
    if (!roles.includes(user.role)) throw forbidden('无权限访问');
    next();
  };
}