import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { config } from '../config.ts';
import { unauthorized } from './errors.ts';
import type { AuthUser } from '../types.ts';

export interface TokenPayload { sub: string; name: string; role: string; groupId: string | null; }

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, name: user.name, role: user.role, groupId: user.groupId };
  const options = { expiresIn: config.jwtExpiresIn } as SignOptions;
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === 'string' || decoded === null) throw unauthorized();
    const d = decoded as { sub?: unknown; name?: unknown; role?: unknown; groupId?: unknown };
    if (typeof d.sub !== 'string' || typeof d.name !== 'string' || (d.role !== 'employee' && d.role !== 'leader' && d.role !== 'center')) throw unauthorized();
    return { sub: d.sub, name: d.name, role: d.role, groupId: typeof d.groupId === 'string' ? d.groupId : null };
  } catch {
    throw unauthorized();
  }
}