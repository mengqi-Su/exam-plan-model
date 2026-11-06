import { DaySchedulePreference } from "../types";
import { addDays, daysBetween, parseLocalDate } from "./date";

// 与 functions/planner.ts 的 PLANNING_WINDOW_DAYS 同值：一次规划最多往前排多少天。
// 后端按这个数截断日历，前端的「全程预计」也必须按同一个数算，否则界面承诺 480 小时、
// 计划只给前 180 天，用户看到的又是「我填的时间不认」。
export const PLANNING_WINDOW_DAYS = 180;

export const MIN_DAILY_HOURS = 0.5;
export const MAX_DAILY_HOURS = 12;
/** 向导里「每天可学习时长」的初始值；后端 sanitize 缺口的兜底也是 2h，别各写一个。 */
export const DEFAULT_DAILY_HOURS = 2;

const DAY_NAMES_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function dayName(dayOfWeek: number, isZh: boolean): string {
  const index = Math.min(6, Math.max(0, dayOfWeek));
  return isZh ? DAY_NAMES_ZH[index] : DAY_NAMES_EN[index];
}

/** 界面上的小时都过这一道：半格步进、上限 12h，0 代表休息。 */
export function clampDailyHours(hours: number): number {
  if (!Number.isFinite(hours)) return 0;
  return Math.max(0, Math.min(MAX_DAILY_HOURS, Math.round(hours * 2) / 2));
}

/** 七天一致的周计划：简单档「每天几小时」写下去就是这个形状。 */
export function uniformWeekSchedules(hours: number, isZh: boolean): DaySchedulePreference[] {
  const value = clampDailyHours(hours);
  return [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
    dayOfWeek,
    dayName: dayName(dayOfWeek, isZh),
    availableHours: value,
    preferredTimeSlot: "flexible" as const,
    enabled: value > 0,
  }));
}

/**
 * 把「每天 X 小时」写进已有的周计划：所有天一起改，休息日也一并恢复。
 * 简单档就是这个语义——用户说每天几小时，不该有哪天被悄悄留在旧值上。
 */
export function applyUniformDailyHours(
  schedules: DaySchedulePreference[],
  hours: number,
  isZh: boolean
): DaySchedulePreference[] {
  return uniformWeekSchedules(hours, isZh).map((fallback) => {
    const current = schedules.find((entry) => entry.dayOfWeek === fallback.dayOfWeek);
    return current ? { ...current, availableHours: fallback.availableHours, enabled: fallback.enabled } : fallback;
  });
}

/** 七天是否同一个时长：是就返回那个数，混合（含休息日）返回 null，交给「按天设置」占位。 */
export function uniformHoursOf(schedules: DaySchedulePreference[]): number | null {
  if (schedules.length !== 7) return null;
  if (!schedules.every((entry) => entry.enabled && entry.availableHours > 0)) return null;
  const first = schedules[0].availableHours;
  return schedules.every((entry) => entry.availableHours === first) ? first : null;
}

/** 周总学时：只算启用的天。 */
export function weeklyTotalHours(schedules: DaySchedulePreference[]): number {
  return Math.round(schedules.reduce((sum, entry) => (entry.enabled ? sum + entry.availableHours : sum), 0) * 10) / 10;
}

/** 有得学的天才算学习日：全休息时向导不该让人进入下一步。 */
export function hasStudyDays(schedules: DaySchedulePreference[]): boolean {
  return schedules.some((entry) => entry.enabled && entry.availableHours > 0);
}

export interface WindowEstimate {
  /** 真正会被排程的天数（已扣除休息日、已按窗口截断） */
  studyDays: number;
  /** 这些天加起来的学时 */
  totalHours: number;
  /** 窗口装不下时，被截掉的天数 */
  truncatedDays: number;
}

/**
 * 备考窗口里到底能学多少小时。
 * 口径和后端 buildStudyCalendar 一致：从 startDate 起算、不含考试当天、跳过 disabled 的天、
 * 最多 PLANNING_WINDOW_DAYS 天。
 */
export function estimateStudyWindow(
  schedules: DaySchedulePreference[],
  startDate: string,
  examDate: string
): WindowEstimate | null {
  if (!startDate || !examDate) return null;
  const span = daysBetween(startDate, examDate);
  if (!Number.isFinite(span) || span < 0) return null;
  const days = Math.min(span, PLANNING_WINDOW_DAYS);
  let studyDays = 0;
  let totalHours = 0;
  for (let offset = 0; offset < days; offset += 1) {
    const date = parseLocalDate(addDays(startDate, offset));
    const entry = schedules.find((schedule) => Number(schedule.dayOfWeek) === date.getDay());
    if (entry && !entry.enabled) continue;
    const hours = entry && entry.availableHours > 0 ? entry.availableHours : 2;
    totalHours += hours;
    studyDays += 1;
  }
  return {
    studyDays,
    totalHours: Math.round(totalHours * 10) / 10,
    truncatedDays: Math.max(0, span - days),
  };
}
