/**
 * JWT 签发与校验
 * 需求依据：AUTH-03（token 缺失/失效 → 401）、AUTH-04（重新登录换新 token 即切角色）、有效期 24h
 */

import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../config.ts';
import { unauthorized } from './errors.ts';
import type { AuthUser, Role } from '../types.ts';

export interface TokenPayload {
  sub: string;
  name: string;
  role: Role;
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, name: user.name, role: user.role };
  const options = { expiresIn: config.jwtExpiresIn } as SignOptions;
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string' || decoded === null) {
      throw unauthorized();
    }
    const sub = decoded.sub;
    const name = (decoded as { name?: unknown }).name;
    const role = (decoded as { role?: unknown }).role;
    if (typeof sub !== 'string' || typeof name !== 'string' || (role !== 'member' && role !== 'leader')) {
      throw unauthorized();
    }
    return { sub, name, role };
  } catch {
    // 过期 / 签名错误 / 结构异常一律按未登录处理（AUTH-03）
    throw unauthorized();
  }
}
