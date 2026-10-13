/**
 * 用户仓储（users 表）
 * 需求依据：6.1 User、4.1 预置账号
 */

import type { DatabaseSync } from 'node:sqlite';
import type { User, Role } from '../types.ts';

interface UserRow {
  id: string;
  name: string;
  role: Role;
}

function rowToUser(row: UserRow): User {
  return { id: row.id, name: row.name, role: row.role };
}

export function findUserById(db: DatabaseSync, id: string): User | null {
  const row = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row === undefined ? null : rowToUser(row);
}

/** 团队成员列表（含负责人本人，见需求 4.5 验收标准） */
export function listUsers(db: DatabaseSync): User[] {
  const rows = db.prepare('SELECT id, name, role FROM users ORDER BY id ASC').all() as unknown as UserRow[];
  return rows.map(rowToUser);
}

export function countUsers(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  return Number(row.c);
}
