import { ExamStudyPlan, AppSettings, DailyMemoNote } from "../types";

const LEGACY_STORAGE_KEY_PLANS = "exam_planner_saved_plans_v1";
const STORAGE_KEY_ACTIVE_ID = "exam_planner_active_plan_id_v1";
const STORAGE_KEY_DAILY_MEMOS = "exam_planner_daily_memos_v1";

const DB_NAME = "exam_planner_local";
const DB_VERSION = 1;
const PLAN_STORE = "plans";

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
    };
    request.onsuccess = () => resolve(request.result);
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

export async function loadSavedPlans(): Promise<ExamStudyPlan[]> {
  try {
    const db = await openPlanDatabase();
    const plans = await new Promise<ExamStudyPlan[]>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readonly");
      const request = tx.objectStore(PLAN_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []) as ExamStudyPlan[]);
      request.onerror = () => reject(request.error || new Error("Failed to read local plans"));
      tx.oncomplete = () => db.close();
    });
    if (plans.length > 0) {
      return plans.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
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
  return legacyPlans;
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
      tx.onerror = () => reject(tx.error || new Error("Failed to write local plans"));
      tx.onabort = () => reject(tx.error || new Error("Local write was aborted"));
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
      const tx = db.transaction(PLAN_STORE, "readwrite");
      tx.objectStore(PLAN_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error || new Error("Failed to clear local plans"));
    });
  } catch (e) {
    console.warn("Failed to clear IndexedDB plans", e);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
  localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  localStorage.removeItem(STORAGE_KEY_DAILY_MEMOS);
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
  version: "v3.0.0",
  releaseName: "Local-First Planning Edition",
  buildDate: "2026-10-31",
  buildNumber: "build-20261031.300",
  environment: "Local Browser (IndexedDB)",
  changelog: [
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
