/**
 * 周次与时间工具（前端展示用）
 * 说明：周次的**权威值来自服务端**（GET /api/health 或周报对象的 week 字段）；
 * 此处的 ISO 周计算仅作为接口不可用时的兜底展示，避免页面空标题。
 */

const MS_PER_DAY = 86_400_000;

export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + 4 - isoDay);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function currentWeek(): string {
  return isoWeekOf(new Date());
}

/** 「2026-W42」→「2026 年第 42 周」 */
export function weekLabel(week: string): string {
  const matched = /^(\d{4})-W(\d{2})$/.exec(week);
  if (matched === null) return week;
  return `${matched[1]} 年第 ${Number(matched[2])} 周`;
}

/** 生成最近 n 周的周次（含当前周），用于成员管理页的历史分组展示 */
export function recentWeeks(count: number): string[] {
  const now = new Date();
  const weeks: string[] = [];
  for (let i = 0; i < count; i += 1) {
    weeks.push(isoWeekOf(new Date(now.getTime() - i * 7 * MS_PER_DAY)));
  }
  return weeks;
}

export function isCurrentWeek(week: string): boolean {
  return week === currentWeek();
}
