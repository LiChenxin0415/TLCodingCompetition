import type { DatabaseSync } from 'node:sqlite';
import type { User } from '../types.ts';

interface Row { id: string; name: string; role: string; group_id: string | null; join_month: string; }

function rowToUser(row: Row): User {
  return { id: row.id, name: row.name, role: row.role as User['role'], groupId: row.group_id, joinMonth: row.join_month };
}

export function findUserById(db: DatabaseSync, id: string): User | null {
  const row = db.prepare('SELECT id, name, role, group_id, join_month FROM users WHERE id = ?').get(id) as Row | undefined;
  return row === undefined ? null : rowToUser(row);
}

export function listUsers(db: DatabaseSync): User[] {
  const rows = db.prepare('SELECT id, name, role, group_id, join_month FROM users ORDER BY id').all() as unknown as Row[];
  return rows.map(rowToUser);
}

export function listUsersByGroup(db: DatabaseSync, groupId: string): User[] {
  const rows = db.prepare('SELECT id, name, role, group_id, join_month FROM users WHERE group_id = ? ORDER BY id').all(groupId) as unknown as Row[];
  return rows.map(rowToUser);
}