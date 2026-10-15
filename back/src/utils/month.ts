export function currentMonth(now: Date = new Date()): string {
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function resolveMonth(raw: unknown): string {
  if (raw === undefined || raw === null || String(raw).trim() === '') return currentMonth();
  const m = String(raw).trim();
  if (!isValidMonth(m)) throw new Error('月份格式错误，应为 YYYY-MM');
  return m;
}

export function prevMonth(month: string): string {
  const parts = month.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
