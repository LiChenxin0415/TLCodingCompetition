/**
 * ISO 8601 周次计算：YYYY-Www（如 2026-W42）
 * 周次由服务端按当前日期计算，前端仅做展示，用户不可修改（需求 1.5）
 */

function startOfIsoWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7; // 周日=7
  d.setUTCDate(d.getUTCDate() - (day - 1)); // 回退到周一
  return d;
}

/** 该日期所在 ISO 周的周四（决定 ISO 周所属年份） */
function isoWeekThursday(date: Date): Date {
  const monday = startOfIsoWeek(date);
  monday.setUTCDate(monday.getUTCDate() + 3);
  return monday;
}

/** 某年 1 月 1 日所在周的周一 */
function firstMondayOfYear(year: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return startOfIsoWeek(jan4);
}

export function isoWeek(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const thursday = isoWeekThursday(d);
  const year = thursday.getUTCFullYear();
  const weekStart = firstMondayOfYear(year);
  const diffDays = Math.round((thursday.getTime() - weekStart.getTime()) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** 相对当前周的偏移周次：offset=-1 表示上周 */
export function weekByOffset(offset: number, from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + offset * 7);
  return isoWeek(d);
}

/** 当前周次（页面标题、默认筛选使用） */
export function currentWeek(): string {
  return isoWeek(new Date());
}

/** "2026-10-13 14:30" 形式的时间戳 */
export function nowStamp(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(
    date.getMinutes(),
  )}`;
}
