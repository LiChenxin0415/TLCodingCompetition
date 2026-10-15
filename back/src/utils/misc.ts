import { randomUUID } from 'node:crypto';

export function newId(prefix: string): string {
  return prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 12);
}

export function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}