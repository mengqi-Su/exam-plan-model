export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = (dateString || "").split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

export function addDays(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function daysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/**
 * 日历上真存在的那一天。Date 会把 2026-13-99 悄悄顺延成 2027-04-08，
 * 光看格式或光看 isNaN 都拦不住：倒计时会凭空多出天数，草稿会把一个不存在的日期填回表单。
 */
export function isValidLocalDate(dateString: string): boolean {
  const raw = String(dateString || "").trim();
  const date = parseLocalDate(raw);
  if (Number.isNaN(date.getTime())) return false;
  return toLocalDateString(date) === raw;
}

/* 考试倒计时的唯一算法。科目页、今日页、总览卡组、编辑弹窗原先各写一遍：
   首页按自然日说「还剩 43 天」，科目页按时分秒说「42 天 21:47:55」，
   同一场考试在两个页面报出两个天数，用户只能理解成其中一个是坏的。
   现在四处都从这一个函数取数，整天数取下界，不足一天才退回自然日。 */
export type ExamCountdown = {
  examAt: number;
  msLeft: number;
  /** 考试时刻已过：今天考完了也算已过，不再倒计时 */
  passed: boolean;
  /** 距考试时刻的整天数，与 hours/minutes/seconds 同一口径 */
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** 自然日差：0 = 今天开考，1 = 明天 */
  calendarDays: number;
};

const DAY_MS = 86400000;
const HOUR_MS = 3600000;
const MINUTE_MS = 60000;
const TIME_PART_RE = /^\d{1,2}$/;

// 时间字段只有「两位以内的数字」才算数：空串、abc、缺分都退回默认，
// 99 这种越界夹到上限而不是让 Date 悄悄进位到第二天。
function timePart(value: string | undefined, max: number, fallback: number): number {
  if (!value || !TIME_PART_RE.test(value)) return fallback;
  return Math.min(max, Number(value));
}

export function examCountdown(
  examDate?: string | null,
  examTime?: string | null,
  now: Date = new Date()
): ExamCountdown | null {
  const raw = String(examDate || "").trim();
  // 脏日期不当倒计时起点：那种页面上写出来的天数是编出来的，不如回一句「未设定」
  if (!isValidLocalDate(raw)) return null;
  const date = parseLocalDate(raw);
  const [rawHour, rawMinute] = String(examTime || "").split(":");
  const hour = timePart(rawHour, 23, 9);
  const minute = timePart(rawMinute, 59, 0);
  const examAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0).getTime();
  const msLeft = examAt - now.getTime();
  const rest = Math.max(0, msLeft);
  return {
    examAt,
    msLeft,
    passed: msLeft <= 0,
    days: Math.floor(rest / DAY_MS),
    hours: Math.floor((rest % DAY_MS) / HOUR_MS),
    minutes: Math.floor((rest % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((rest % MINUTE_MS) / 1000),
    calendarDays: daysBetween(toLocalDateString(now), raw),
  };
}

// 对外只报一个天数：整天数优先，不足一天时按自然日说，
// 这样「还剩 N 天」永远不会和同一条倒计时的小时分钟互相打脸。
export function countdownDays(countdown: ExamCountdown): number {
  return countdown.days >= 1 ? countdown.days : Math.max(1, countdown.calendarDays);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function countdownDaysLabel(countdown: ExamCountdown, isZh: boolean): string {
  if (countdown.passed) return isZh ? "已结束" : "Finished";
  if (countdown.calendarDays === 0) return isZh ? "今天考试" : "Exam today";
  const days = countdownDays(countdown);
  return isZh ? `还剩 ${days} 天` : `${days} days left`;
}

export function countdownDnLabel(countdown: ExamCountdown, isZh: boolean): string {
  if (countdown.passed) return isZh ? "已结束" : "Finished";
  if (countdown.calendarDays === 0) return isZh ? "今天考试" : "Today";
  return `D-${countdownDays(countdown)}`;
}

export function countdownClockLabel(countdown: ExamCountdown, isZh: boolean): string {
  if (countdown.passed) return isZh ? "已到期" : "Passed";
  const clock = `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`;
  if (countdown.days < 1) return clock;
  return isZh ? `${countdown.days} 天 ${clock}` : `${countdown.days}d ${clock}`;
}
