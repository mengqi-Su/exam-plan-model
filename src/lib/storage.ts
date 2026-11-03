import { ExamStudyPlan, AppSettings, DailyMemoNote, PracticeEvent, PracticeEventStatus } from "../types";
import { attachTaskTopicIds } from "./links";

const LEGACY_STORAGE_KEY_PLANS = "exam_planner_saved_plans_v1";
const STORAGE_KEY_ACTIVE_ID = "exam_planner_active_plan_id_v1";
const STORAGE_KEY_DAILY_MEMOS = "exam_planner_daily_memos_v1";
const STORAGE_KEY_PRACTICE_EVENTS = "exam_planner_practice_events_v1";

const DB_NAME = "exam_planner_local";
/** v2：新增 practice_events（StarQuiz 回流的练习事件），旧 plans 数据原地保留 */
const DB_VERSION = 2;
const PLAN_STORE = "plans";
const PRACTICE_STORE = "practice_events";

export const DEFAULT_WEEK_SCHEDULE = [
  { dayOfWeek: 0, dayName: "周日", availableHours: 4, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 1, dayName: "周一", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 2, dayName: "周二", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 3, dayName: "周三", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 4, dayName: "周四", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 5, dayName: "周五", availableHours: 2, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 6, dayName: "周六", availableHours: 5, preferredTimeSlot: "morning" as const, enabled: true },
];

function openPlanDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAN_STORE)) {
        db.createObjectStore(PLAN_STORE, { keyPath: "id" });
      }
      // attemptId 即幂等键：同一次练习重复返回只会覆盖同一条记录，不会累加。
      if (!db.objectStoreNames.contains(PRACTICE_STORE)) {
        db.createObjectStore(PRACTICE_STORE, { keyPath: "attemptId" });
      }
    };
    request.onblocked = () => {
      // 另一个标签页还占着旧版本；不报错也不挂死，交给调用方超时后走回退
      console.warn("IndexedDB upgrade blocked by another tab holding an older connection");
    };
    request.onsuccess = () => {
      const db = request.result;
      // 本标签页被别的旧版本标签页升级时主动让路，避免读写事务永久等待
      db.onversionchange = () => db.close();
      db.onclose = () => console.warn("Local database closed unexpectedly");
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Failed to open local database"));
  });
}

function readLegacyPlans(): ExamStudyPlan[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY_PLANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only the exact old demo entries are discarded. Never filter by course name.
    return parsed.filter(
      (plan) => plan && typeof plan.id === "string" && plan.id !== "sample-plan-cs301" && !plan.id.startsWith("sample-")
    );
  } catch (e) {
    console.warn("Failed to read legacy plans", e);
    return [];
  }
}

/**
 * 早期计划里的每日任务只带 topicTitle：读取时按考点表补写所属单元 id。
 * 没有 unit id 就解析不出完整考点路径，「今日任务」入口会退化成普通跳转，
 * 拿不到 v=1 联动上下文，练习结果也就无法回流。补写只认唯一归属，歧义保持留空。
 */
function backfillTaskTopicIds(plans: ExamStudyPlan[]): ExamStudyPlan[] {
  return plans.map((plan) => {
    const tasks = Array.isArray(plan?.tasks) ? plan.tasks : [];
    const topics = Array.isArray(plan?.topics) ? plan.topics : [];
    if (!tasks.length || !topics.length) return plan;
    if (tasks.every((task) => Boolean(task?.topicId))) return plan;
    return { ...plan, tasks: attachTaskTopicIds(tasks, topics) };
  });
}

export async function loadSavedPlans(): Promise<ExamStudyPlan[]> {
  try {
    const db = await openPlanDatabase();
    const plans = await new Promise<ExamStudyPlan[]>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readonly");
      const request = tx.objectStore(PLAN_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []) as ExamStudyPlan[]);
      request.onerror = () => reject(request.error || new Error("Failed to read local plans"));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
    if (plans.length > 0) {
      return backfillTaskTopicIds(plans.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    }
  } catch (e) {
    console.warn("IndexedDB read failed, checking legacy localStorage", e);
  }

  const legacyPlans = readLegacyPlans();
  if (legacyPlans.length > 0) {
    try {
      await savePlans(legacyPlans);
      localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
    } catch (e) {
      console.warn("Legacy plan migration failed, keeping localStorage copy", e);
    }
  }
  return backfillTaskTopicIds(legacyPlans);
}

export async function savePlans(plans: ExamStudyPlan[]): Promise<void> {
  let indexedDbError: unknown = null;
  try {
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readwrite");
      const store = tx.objectStore(PLAN_STORE);
      store.clear();
      plans.forEach((plan) => store.put(plan));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to write local plans"));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Local write was aborted"));
      };
    });
    localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
    return;
  } catch (e) {
    indexedDbError = e;
    console.warn("IndexedDB write failed, trying localStorage fallback", e);
  }

  try {
    localStorage.setItem(LEGACY_STORAGE_KEY_PLANS, JSON.stringify(plans));
  } catch (fallbackError) {
    console.error("All local persistence attempts failed", indexedDbError, fallbackError);
    throw new Error("本地存储写入失败，请导出备份并清理浏览器空间后重试。");
  }
}

export function getActivePlanId(): string {
  try {
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (!activeId || activeId === "sample-plan-cs301" || activeId.startsWith("sample-")) {
      return "";
    }
    return activeId;
  } catch (e) {
    return "";
  }
}

export function setActivePlanId(id: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  } catch (e) {
    console.warn("Failed to persist active plan id", e);
  }
}

export async function clearPlannerData(): Promise<void> {
  try {
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([PLAN_STORE, PRACTICE_STORE], "readwrite");
      tx.objectStore(PLAN_STORE).clear();
      tx.objectStore(PRACTICE_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to clear local planner data"));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Local clear was aborted"));
      };
    });
  } catch (e) {
    console.warn("Failed to clear IndexedDB planner data", e);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
  localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  localStorage.removeItem(STORAGE_KEY_DAILY_MEMOS);
  localStorage.removeItem(STORAGE_KEY_PRACTICE_EVENTS);
}

/** 回流的练习事件只允许这四种状态，导入或旧数据里的其他值一律丢弃整条记录。 */
export const PRACTICE_EVENT_STATUSES: PracticeEventStatus[] = ["pending", "applied", "dismissed", "unmatched"];

const PRACTICE_TEXT_LIMITS = { planId: 64, topicKey: 40, attemptId: 64, linkId: 128, setId: 64, exam: 150, subject: 100, unit: 400, topic: 400, date: 10, task: 128 };
const PRACTICE_TOPIC_KEY_RE = /^t1_[0-9a-f]{32}$/;
const PRACTICE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function practiceText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text || text.length > max) return null;
  return text;
}

/**
 * 逐字段校验一条回流事件：任何不合法都返回 null，由调用方丢弃，
 * 绝不用半合法的数据写进本地库（尤其是 status 和计数，否则统计会失真）。
 */
export function sanitizePracticeEvent(raw: unknown): PracticeEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;

  const attemptId = practiceText(value.attemptId, PRACTICE_TEXT_LIMITS.attemptId);
  const planId = practiceText(value.planId, PRACTICE_TEXT_LIMITS.planId);
  const topicKey = practiceText(value.topicKey, PRACTICE_TEXT_LIMITS.topicKey);
  const linkId = practiceText(value.linkId, PRACTICE_TEXT_LIMITS.linkId);
  if (!attemptId || !planId || !topicKey || !linkId) return null;
  // 题库 id 只是来源展示信息，旧链接没带也不影响统计，缺失时留空
  const setId = value.setId === undefined || value.setId === null ? "" : practiceText(value.setId, PRACTICE_TEXT_LIMITS.setId) ?? "";
  if (!PRACTICE_TOPIC_KEY_RE.test(topicKey)) return null;
  if (linkId !== `${planId}:${topicKey}`) return null;

  const path = value.path as Record<string, unknown> | undefined;
  const level = path && path.level;
  if (level !== "unit" && level !== "subtopic") return null;
  const subject = practiceText(path?.subject, PRACTICE_TEXT_LIMITS.subject);
  const unit = practiceText(path?.unit, PRACTICE_TEXT_LIMITS.unit);
  const topic = practiceText(path?.topic, PRACTICE_TEXT_LIMITS.topic);
  if (!subject || !unit || !topic) return null;
  const exam = path?.exam === undefined || path?.exam === null ? "" : practiceText(path.exam, PRACTICE_TEXT_LIMITS.exam) ?? "";

  const graded = value.graded;
  const correct = value.correct;
  if (typeof graded !== "number" || !Number.isInteger(graded) || graded <= 0 || graded > 1000) return null;
  if (typeof correct !== "number" || !Number.isInteger(correct) || correct < 0 || correct > graded) return null;

  const completedAt = practiceText(value.completedAt, 40);
  const receivedAt = practiceText(value.receivedAt, 40);
  if (!completedAt || !receivedAt || Number.isNaN(Date.parse(completedAt)) || Number.isNaN(Date.parse(receivedAt))) return null;

  const status = value.status;
  if (typeof status !== "string" || !PRACTICE_EVENT_STATUSES.includes(status as PracticeEventStatus)) return null;

  const source = value.sourceContext as Record<string, unknown> | undefined;
  const rawDate = source?.date;
  const date = typeof rawDate === "string" && PRACTICE_DATE_RE.test(rawDate.trim()) ? rawDate.trim() : undefined;
  const task = source?.task === undefined || source?.task === null ? undefined : practiceText(source.task, PRACTICE_TEXT_LIMITS.task) ?? undefined;

  const event: PracticeEvent = {
    schemaVersion: 1,
    attemptId,
    linkId,
    planId,
    topicKey,
    path: { level, exam, subject, unit, topic },
    sourceContext: { date, task },
    setId,
    graded,
    correct,
    completedAt,
    receivedAt,
    status: status as PracticeEventStatus,
  };

  const appliedAt = value.appliedAt;
  if (typeof appliedAt === "string" && !Number.isNaN(Date.parse(appliedAt))) {
    event.appliedAt = appliedAt.trim();
  }
  const resolution = value.resolution as Record<string, unknown> | undefined;
  if (resolution && typeof resolution === "object") {
    const rPlan = practiceText(resolution.planId, PRACTICE_TEXT_LIMITS.planId);
    const rTopic = practiceText(resolution.topicId, PRACTICE_TEXT_LIMITS.planId);
    if (rPlan && rTopic) {
      const subtopicTitle = resolution.subtopicTitle === undefined || resolution.subtopicTitle === null ? undefined : practiceText(resolution.subtopicTitle, PRACTICE_TEXT_LIMITS.topic) ?? undefined;
      const taskId = resolution.taskId === undefined || resolution.taskId === null ? undefined : practiceText(resolution.taskId, PRACTICE_TEXT_LIMITS.task) ?? undefined;
      event.resolution = { planId: rPlan, topicId: rTopic, subtopicTitle, taskId };
    }
  }
  return event;
}

function readPracticeEventsFallback(): PracticeEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRACTICE_EVENTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.map(sanitizePracticeEvent).filter((e): e is PracticeEvent => !!e);
    return dedupeByAttemptId(valid);
  } catch (e) {
    console.warn("Failed to read practice events from localStorage", e);
    return [];
  }
}

function writePracticeEventsFallback(events: PracticeEvent[]): void {
  localStorage.setItem(STORAGE_KEY_PRACTICE_EVENTS, JSON.stringify(events));
}

function dedupeByAttemptId(events: PracticeEvent[]): PracticeEvent[] {
  const byId = new Map<string, PracticeEvent>();
  events.forEach((event) => {
    if (!event) return;
    byId.set(event.attemptId, event);
  });
  return Array.from(byId.values()).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""));
}

export async function loadPracticeEvents(): Promise<PracticeEvent[]> {
  try {
    const db = await openPlanDatabase();
    const events = await new Promise<PracticeEvent[]>((resolve, reject) => {
      const tx = db.transaction(PRACTICE_STORE, "readonly");
      const request = tx.objectStore(PRACTICE_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).map(sanitizePracticeEvent).filter((e): e is PracticeEvent => !!e));
      request.onerror = () => reject(request.error || new Error("Failed to read practice events"));
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    });
    const merged = dedupeByAttemptId(events);
    // IndexedDB 恢复可用但库是空的：把回退期间写进 localStorage 的回执迁回来，
    // 否则下一次成功写入会顺手删掉回退键，回执就无声消失了。
    if (merged.length === 0) {
      const orphaned = readPracticeEventsFallback();
      if (orphaned.length > 0) {
        await savePracticeEvents(orphaned);
        return orphaned;
      }
    }
    return merged;
  } catch (e) {
    console.warn("IndexedDB practice event read failed, using localStorage copy", e);
    return readPracticeEventsFallback();
  }
}

/** 全量重写，与 savePlans 一致；同 attemptId 的记录在写入前就已合并，不会重复累积。 */
export async function savePracticeEvents(events: PracticeEvent[]): Promise<void> {
  const merged = dedupeByAttemptId(events.map(sanitizePracticeEvent).filter((e): e is PracticeEvent => !!e));
  let indexedDbError: unknown = null;
  try {
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PRACTICE_STORE, "readwrite");
      const store = tx.objectStore(PRACTICE_STORE);
      store.clear();
      merged.forEach((event) => store.put(event));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error("Failed to write practice events"));
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || new Error("Practice event write was aborted"));
      };
    });
    localStorage.removeItem(STORAGE_KEY_PRACTICE_EVENTS);
    return;
  } catch (e) {
    indexedDbError = e;
    console.warn("IndexedDB practice event write failed, trying localStorage fallback", e);
  }

  try {
    writePracticeEventsFallback(merged);
  } catch (fallbackError) {
    console.error("All local practice event persistence attempts failed", indexedDbError, fallbackError);
    throw new Error("练习回执保存失败，请清理浏览器空间后重试。");
  }
}

/** 幂等写入：attemptId 已存在就原样返回，不覆盖已有 status（重复点「带回」不产生第二条记录）。 */
export async function putPracticeEventIfNew(event: PracticeEvent): Promise<{ created: boolean; events: PracticeEvent[]; existing: PracticeEvent | null }> {
  const clean = sanitizePracticeEvent(event);
  if (!clean) throw new Error("Invalid practice event");
  const current = await loadPracticeEvents();
  const existing = current.find((e) => e.attemptId === clean.attemptId) || null;
  if (existing) return { created: false, events: current, existing };
  const next = dedupeByAttemptId([clean, ...current]);
  await savePracticeEvents(next);
  return { created: true, events: next, existing: null };
}

export async function updatePracticeEvent(attemptId: string, patch: { status?: PracticeEventStatus; resolution?: PracticeEvent["resolution"]; appliedAt?: string }): Promise<PracticeEvent[]> {
  const current = await loadPracticeEvents();
  const next = current.map((event) => (event.attemptId === attemptId ? { ...event, ...patch } : event));
  const clean = next.map(sanitizePracticeEvent).filter((e): e is PracticeEvent => !!e);
  await savePracticeEvents(clean);
  return dedupeByAttemptId(clean);
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
  } catch (e) {
    return null;
  }
}

const STORAGE_KEY_SETTINGS = "exam_planner_app_settings_v1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultFocusDuration: 45,
  enableSoundAlerts: true,
  enableDailyReminders: true,
  firstDayOfWeek: "monday",
  dateFormat: "YYYY-MM-DD",
  rebalanceSensitivity: "balanced",
  defaultStudyPace: "spaced_repetition",
  themeMode: "light",
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
    }
    return DEFAULT_APP_SETTINGS;
  } catch (e) {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save app settings", e);
  }
}

export const APP_VERSION_DATA = {
  version: "v3.1.0",
  releaseName: "Local-First Planning Edition",
  buildDate: "2026-11-02",
  buildNumber: "build-20261102.310",
  environment: "Local Browser (IndexedDB)",
  changelog: [
    {
      version: "v3.1.0",
      date: "2026-11-02",
      title: "今日视图风格统一与规划后端切换",
      highlights: [
        "今日待办、任务路线便签与专注计时弹窗统一为全站编辑式排版 token（字号、圆角、间距、按钮）",
        "设置页页头固定，次要信息（版本、更新日志）折叠到底部弱区",
        "AI 考点提取与排程改为服务端 DeepSeek 模型，密钥仅保存在云函数环境变量，不进入浏览器",
        "考点可一键跳转 StarQuiz 练习，规划与刷题各司其职",
      ],
    },
    {
      version: "v3.0.0",
      date: "2026-10-31",
      title: "本地优先、专注规划与安全加固",
      highlights: [
        "移除登录与云端同步：全部备考计划仅保存在当前浏览器 (IndexedDB)，旧版本地数据自动迁移",
        "移除生成测验与刷题功能：Exam Plan AI 专注考试规划与进度管理，练习与刷题请使用 StarQuiz",
        "AI 接口新增请求限流、输入上限与超时保护，文档解析失败时不再伪造资料内容",
        "新增数据备份导入/导出、存储占用诊断与写入失败提示",
      ],
    },
    {
      version: "v2.4.0",
      date: "2026-08-18",
      title: "科目层级导航与多视图重构",
      highlights: [
        "左侧树形导航支持直接展开每日清单、复习日历、进度追踪与考纲资料",
        "优化全学科备考总览看板，减少科目之间的上下文切换成本",
      ],
    },
    {
      version: "v2.2.0",
      date: "2026-08-16",
      title: "Notion 风格视觉规范与 ICS 日历同步",
      highlights: [
        "还原 Notion 风格渐变封面、属性矩阵与轻量卡片布局",
        "支持一键导出备考排程为标准 .ICS 格式，导入 Google Calendar 与 Apple 日历",
      ],
    },
  ],
};

export function getDailyMemos(): Record<string, DailyMemoNote> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_MEMOS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse daily memos", e);
    return {};
  }
}

export function getDailyMemo(date: string): DailyMemoNote | null {
  const all = getDailyMemos();
  return all[date] || null;
}

export function mergeDailyMemos(memos: Record<string, DailyMemoNote>): void {
  if (!memos || typeof memos !== "object") return;
  try {
    const all = getDailyMemos();
    Object.entries(memos).forEach(([date, memo]) => {
      if (memo && typeof memo.content === "string") {
        all[date] = memo;
      }
    });
    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to import daily memos", e);
  }
}

export function saveDailyMemo(date: string, data: { content?: string; mood?: DailyMemoNote["mood"]; tags?: string[] }): Record<string, DailyMemoNote> {
  try {
    const all = getDailyMemos();
    const existing = all[date] || { date, content: "", updatedAt: new Date().toISOString() };
    const updated: DailyMemoNote = {
      ...existing,
      ...data,
      date,
      updatedAt: new Date().toISOString(),
    };

    if (!updated.content?.trim() && !updated.mood && (!updated.tags || updated.tags.length === 0)) {
      delete all[date];
    } else {
      all[date] = updated;
    }

    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
    return all;
  } catch (e) {
    console.error("Failed to save daily memo", e);
    return {};
  }
}

export function deleteDailyMemo(date: string): Record<string, DailyMemoNote> {
  try {
    const all = getDailyMemos();
    delete all[date];
    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
    return all;
  } catch (e) {
    console.error("Failed to delete daily memo", e);
    return {};
  }
}
