/**
 * ISO 8601 周次工具
 * 需求依据：1.5（周次由服务端按当前日期计算，用户不可修改）、REP-03（同一周次仅一份）
 * 周次格式：YYYY-Www，例如 2026-W42
 *
 * 实现约定：所有周次运算一律在 UTC 下进行（周一为一周第一天），
 * 仅"当前周"由本地日期换算为 UTC 零点后再计算，避免时区/夏令时导致跨周错位。
 */

const MS_PER_DAY = 86_400_000;
const WEEK_RE = /^(\d{4})-W(\d{2})$/;

/** 把本地年月日转为 UTC 零点（用于"今天属于哪一周"） */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

/** 按 UTC 日期计算 ISO 周次 */
export function isoWeekOfUtc(date: Date): string {
  const d = new Date(date.getTime());
  const isoDay = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 周一=1 ... 周日=7
  d.setUTCDate(d.getUTCDate() + 4 - isoDay); // 移到本周四，ISO 周归属于周四所在年
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart) / MS_PER_DAY + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** 当前周次（服务端权威值） */
export function currentWeek(now: Date = new Date()): string {
  return isoWeekOfUtc(toUtcMidnight(now));
}

export function parseWeek(week: string): { year: number; week: number } | null {
  const m = WEEK_RE.exec(week);
  if (!m) return null;
  const year = Number(m[1]);
  const weekNo = Number(m[2]);
  if (weekNo < 1 || weekNo > 53) return null;
  return { year, week: weekNo };
}

export function isValidWeek(week: string): boolean {
  return parseWeek(week) !== null;
}

/** 某个 ISO 周的周一（UTC 零点） */
function weekStartUtc(week: string): Date | null {
  const parsed = parseWeek(week);
  if (!parsed) return null;
  const jan4 = new Date(Date.UTC(parsed.year, 0, 4));
  const jan4IsoDay = jan4.getUTCDay() === 0 ? 7 : jan4.getUTCDay();
  const firstMonday = new Date(jan4.getTime() - (jan4IsoDay - 1) * MS_PER_DAY);
  return new Date(firstMonday.getTime() + (parsed.week - 1) * 7 * MS_PER_DAY);
}

/** 周次偏移，offsetWeeks 为负表示往前推（如 -1 得上一周，用于种子数据 {CW-1}） */
export function shiftWeek(week: string, offsetWeeks: number): string {
  const monday = weekStartUtc(week);
  if (monday === null) {
    throw new Error(`非法周次：${week}`);
  }
  return isoWeekOfUtc(new Date(monday.getTime() + offsetWeeks * 7 * MS_PER_DAY));
}

/** 周次倒序比较：新的在前，供列表排序使用 */
export function compareWeekDesc(a: string, b: string): number {
  const ma = weekStartUtc(a);
  const mb = weekStartUtc(b);
  if (ma === null || mb === null) return 0;
  return mb.getTime() - ma.getTime();
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 接口展示格式 yyyy-MM-dd HH:mm（本地时间），见需求 4.4 列表列定义 */
export function formatDateTime(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** 落库格式 yyyy-MM-dd HH:mm:ss（本地时间） */
export function formatDateTimeFull(date: Date = new Date()): string {
  return `${formatDateTime(date)}:${pad2(date.getSeconds())}`;
}
