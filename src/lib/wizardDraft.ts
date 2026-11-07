import {
  DaySchedulePreference,
  StudyMaterial,
  SyllabusTopic,
  WizardDraft,
} from "../types";
import { MAX_LIBRARY_MATERIALS } from "./aiClient";
import { DEFAULT_DAILY_HOURS, clampDailyHours, dayName, uniformWeekSchedules } from "./dailyHours";
import { addDays, isValidLocalDate, toLocalDateString } from "./date";
import { readLocalStore, rewriteLocalStore, WIZARD_DRAFT_STORE } from "./storage";

/** 全站只有「当前这一份」草稿：同一时间只会开着一个新建向导。 */
export const WIZARD_DRAFT_ID = "current";
/** 超过这个天数还没回来的草稿直接作废：三周以后那次填写多半已经不是同一件事了。 */
export const WIZARD_DRAFT_TTL_DAYS = 21;
/** 一次草稿最多带多少字的正文（约 4 MB 文本）。超出的资料不存，接回时如实说明份数。 */
export const WIZARD_DRAFT_CHAR_BUDGET = 2_000_000;

// 文本上限一律对齐输入框自己的 maxLength：草稿不该把用户写下的字悄悄剪掉。
const LIMITS = {
  name: 200,
  requirements: 2000,
  topicTitle: 200,
  subtopic: 300,
  description: 600,
  id: 64,
};
const TOPIC_COUNT_LIMIT = 200;
const SUBTOPIC_COUNT_LIMIT = 60;
const MATERIAL_TYPES: StudyMaterial["type"][] = [
  "syllabus",
  "notes",
  "lecture_slides",
  "past_exam",
  "textbook_outline",
  "custom",
];
const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const KNOWLEDGE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const EXAM_FREQUENCIES = ["high", "medium", "low"] as const;
const TOPIC_SOURCES: NonNullable<SyllabusTopic["source"]>[] = ["material", "textbook", "manual"];

/** 向导交给草稿落盘的东西：草稿本体去掉存储层自己填的那三个信封字段。 */
export type WizardDraftInput = Omit<WizardDraft, "schemaVersion" | "id" | "updatedAt">;

function draftText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (!text || text.length > max) return "";
  return text;
}

function optionalText(value: unknown, max: number): string | undefined {
  const text = draftText(value, max);
  return text || undefined;
}

function numberWithin(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.min(max, value);
}

function datePart(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return isValidLocalDate(text) ? text : "";
}

function sanitizeMaterial(raw: unknown): StudyMaterial | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = draftText(value.id, LIMITS.id);
  const name = draftText(value.name, LIMITS.name);
  // 正文为空的资料没有意义，也说明这条记录本身已经坏了：整条丢掉，不补一份假内容
  const content = typeof value.content === "string" ? value.content : "";
  if (!id || !name || !content.trim()) return null;
  const type = MATERIAL_TYPES.includes(value.type as StudyMaterial["type"])
    ? (value.type as StudyMaterial["type"])
    : "custom";
  const material: StudyMaterial = {
    id,
    name,
    type,
    content,
    uploadedAt: typeof value.uploadedAt === "string" ? value.uploadedAt : new Date().toISOString(),
  };
  const categoryGroup = value.categoryGroup;
  if (categoryGroup === "course_syllabus" || categoryGroup === "exam_question" || categoryGroup === "study_material") {
    material.categoryGroup = categoryGroup;
  }
  if (typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes) && value.sizeBytes >= 0) {
    material.sizeBytes = value.sizeBytes;
  }
  if ((DIFFICULTIES as readonly string[]).includes(String(value.difficulty))) {
    material.difficulty = value.difficulty as StudyMaterial["difficulty"];
  }
  const summary = optionalText(value.summaryNotes, LIMITS.subtopic * 2);
  if (summary) material.summaryNotes = summary;
  // 指纹只认 64 位小写十六进制：对不上就当它不存在，去重会退回逐字比正文。
  // 留一个残缺的哈希更糟——那等于给两份不同的资料发了同一张身份证。
  if (typeof value.contentHash === "string" && /^[0-9a-f]{64}$/.test(value.contentHash)) {
    material.contentHash = value.contentHash;
  }
  return material;
}

function sanitizeSubtopicNode(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const title = draftText(value.title, LIMITS.subtopic);
  if (!title) return null;
  const node: NonNullable<SyllabusTopic["subtopicTree"]>[number] = { title };
  const id = optionalText(value.id, LIMITS.id);
  if (id) node.id = id;
  const name = optionalText(value.name, LIMITS.subtopic);
  if (name) node.name = name;
  if ((DIFFICULTIES as readonly string[]).includes(String(value.difficulty))) {
    node.difficulty = value.difficulty as (typeof DIFFICULTIES)[number];
  }
  if ((EXAM_FREQUENCIES as readonly string[]).includes(String(value.examFrequency))) {
    node.examFrequency = value.examFrequency as (typeof EXAM_FREQUENCIES)[number];
  }
  const keyPoints = Array.isArray(value.keyPoints)
    ? value.keyPoints.map((point) => draftText(point, LIMITS.subtopic)).filter(Boolean).slice(0, 20)
    : [];
  if (keyPoints.length) node.keyPoints = keyPoints;
  const trap = optionalText(value.formulaOrTrap, LIMITS.description);
  if (trap) node.formulaOrTrap = trap;
  return node;
}

function sanitizeTopic(raw: unknown): SyllabusTopic | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = draftText(value.id, LIMITS.id);
  const title = draftText(value.title, LIMITS.topicTitle);
  if (!id || !title) return null;
  const topic: SyllabusTopic = {
    id,
    title,
    weightPercentage: numberWithin(value.weightPercentage, 100),
    difficulty: (DIFFICULTIES as readonly string[]).includes(String(value.difficulty))
      ? (value.difficulty as SyllabusTopic["difficulty"])
      : "medium",
    subtopics: Array.isArray(value.subtopics)
      ? value.subtopics.map((item) => draftText(item, LIMITS.subtopic)).filter(Boolean).slice(0, SUBTOPIC_COUNT_LIMIT)
      : [],
    estimatedHours: numberWithin(value.estimatedHours, 400),
  };
  const category = optionalText(value.category, LIMITS.name);
  if (category) topic.category = category;
  const description = optionalText(value.description, LIMITS.description);
  if (description) topic.description = description;
  if ((KNOWLEDGE_LEVELS as readonly string[]).includes(String(value.userKnowledgeLevel))) {
    topic.userKnowledgeLevel = value.userKnowledgeLevel as SyllabusTopic["userKnowledgeLevel"];
  }
  // 考点来源决定它能不能被「整理教材目录」重新覆盖，也决定界面上的标记，认不出来就留空
  if (TOPIC_SOURCES.includes(value.source as NonNullable<SyllabusTopic["source"]>)) {
    topic.source = value.source as NonNullable<SyllabusTopic["source"]>;
  }
  if (Array.isArray(value.subtopicTree)) {
    const tree = value.subtopicTree.map(sanitizeSubtopicNode).filter((node) => !!node);
    if (tree.length) topic.subtopicTree = tree.slice(0, SUBTOPIC_COUNT_LIMIT);
  }
  return topic;
}

/**
 * 周计划只认完整的七天：缺一天或掺进脏记录，整份退回默认周模板。
 * 半份周计划会让「每天几小时」那个框显示一个和真实排程无关的数字，正是之前那批 bug 的来源。
 */
function sanitizeSchedules(raw: unknown, isZh: boolean): DaySchedulePreference[] {
  const fallback = uniformWeekSchedules(DEFAULT_DAILY_HOURS, isZh);
  if (!Array.isArray(raw) || raw.length !== 7) return fallback;
  const days = raw.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const value = entry as Record<string, unknown>;
    const dayOfWeek = Number(value.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) return null;
    return {
      dayOfWeek,
      // 星期名是界面按语言现算的；草稿里那份不管来自哪个语言，接回来都按当前语言重写
      dayName: dayName(dayOfWeek, isZh),
      availableHours: clampDailyHours(Number(value.availableHours) || 0),
      preferredTimeSlot: (["morning", "afternoon", "evening", "flexible"] as const).includes(
        value.preferredTimeSlot as "flexible"
      )
        ? (value.preferredTimeSlot as DaySchedulePreference["preferredTimeSlot"])
        : ("flexible" as const),
      enabled: value.enabled !== false,
    } satisfies DaySchedulePreference;
  });
  if (days.some((day) => !day)) return fallback;
  const ordered = days as DaySchedulePreference[];
  // 同一天出现两次（旧数据或脏写）也退回模板，不猜哪一条才是用户想要的
  if (new Set(ordered.map((day) => day.dayOfWeek)).size !== 7) return fallback;
  return ordered;
}

/**
 * 逐字段重认一份草稿：认不出的字段退回空值，整份结构不对就返回 null（等于没有草稿）。
 * 资料按上传顺序保留到字数预算为止，被丢掉的份数记在 droppedMaterials 里，接回时如实说出来。
 */
export function sanitizeWizardDraft(raw: unknown, options: { isZh?: boolean; now?: Date } = {}): WizardDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 1) return null;
  const isZh = options.isZh !== false;

  const materials: StudyMaterial[] = [];
  let usedChars = 0;
  let dropped = 0;
  const rawMaterials = Array.isArray(value.materials) ? value.materials : [];
  rawMaterials.slice(0, MAX_LIBRARY_MATERIALS).forEach((entry) => {
    const material = sanitizeMaterial(entry);
    if (!material) {
      dropped += 1;
      return;
    }
    if (usedChars + material.content.length > WIZARD_DRAFT_CHAR_BUDGET) {
      dropped += 1;
      return;
    }
    usedChars += material.content.length;
    materials.push(material);
  });
  const stored = Array.isArray(value.materials) ? value.materials.length : 0;
  const droppedMaterials = dropped + Math.max(0, stored - MAX_LIBRARY_MATERIALS);

  const ids = new Set(materials.map((material) => material.id));
  const aiSelectedIds = Array.isArray(value.aiSelectedIds)
    ? value.aiSelectedIds.map((id) => draftText(id, LIMITS.id)).filter((id) => ids.has(id))
    : [];

  const topics = Array.isArray(value.topics)
    ? value.topics.slice(0, TOPIC_COUNT_LIMIT).map(sanitizeTopic).filter((topic): topic is SyllabusTopic => !!topic)
    : [];

  const step = Number(value.step);
  // 时间戳读不出来就照实留空：新鲜度那一关会认不出这份草稿，宁可丢掉，
  // 也不替它盖一个「刚存的」——那等于把一份不知道哪天写下的旧表单装作新鲜接回来。
  const rawUpdatedAt = typeof value.updatedAt === "string" ? value.updatedAt : "";
  const updatedAt = Number.isNaN(Date.parse(rawUpdatedAt)) ? "" : rawUpdatedAt;

  return {
    schemaVersion: 1,
    id: WIZARD_DRAFT_ID,
    updatedAt,
    step: step === 2 || step === 3 ? (step as 2 | 3) : 1,
    examName: draftText(value.examName, LIMITS.name),
    subject: draftText(value.subject, LIMITS.name),
    startDate: datePart(value.startDate),
    examDate: datePart(value.examDate),
    examTime: draftText(value.examTime, 5),
    targetScore: draftText(value.targetScore, LIMITS.name),
    requirements: draftText(value.requirements, LIMITS.requirements),
    dailySchedules: sanitizeSchedules(value.dailySchedules, isZh),
    materials,
    aiSelectedIds,
    topics,
    textbookLabel: draftText(value.textbookLabel, LIMITS.name),
    ...(droppedMaterials > 0 ? { droppedMaterials } : {}),
  };
}

export function isWizardDraftFresh(draft: WizardDraft, now: Date = new Date()): boolean {
  const savedAt = Date.parse(draft.updatedAt || "");
  if (Number.isNaN(savedAt)) return false;
  const cutoff = addDays(toLocalDateString(now), -WIZARD_DRAFT_TTL_DAYS);
  return draft.updatedAt.slice(0, 10) >= cutoff;
}

export async function loadWizardDraft(): Promise<WizardDraft | null> {
  try {
    const rows = await readLocalStore<WizardDraft>(WIZARD_DRAFT_STORE);
    const stored = rows.find((row) => row && row.id === WIZARD_DRAFT_ID) || null;
    if (!stored) return null;
    const draft = sanitizeWizardDraft(stored);
    if (!draft) return null;
    if (!isWizardDraftFresh(draft)) {
      await clearWizardDraft();
      return null;
    }
    return draft;
  } catch (e) {
    console.warn("Failed to read the wizard draft", e);
    return null;
  }
}

/**
 * 存草稿是便利，不是记账：写失败（浏览器禁用本地存储、配额已满）只留一句 console.warn，
 * 绝不让一个正在填表单项的向导因为 autosave 报错而打断用户。
 * 返回值里带上被丢掉的资料份数，界面才能如实说「只接得回这些」。
 */
export async function saveWizardDraft(input: WizardDraftInput): Promise<{ saved: boolean; draft: WizardDraft | null }> {
  const draft = sanitizeWizardDraft({
    ...input,
    schemaVersion: 1,
    id: WIZARD_DRAFT_ID,
    updatedAt: new Date().toISOString(),
  });
  if (!draft) return { saved: false, draft: null };
  try {
    await rewriteLocalStore(WIZARD_DRAFT_STORE, [draft]);
    return { saved: true, draft };
  } catch (e) {
    console.warn("Failed to save the wizard draft", e);
    return { saved: false, draft };
  }
}

export async function clearWizardDraft(): Promise<void> {
  try {
    await rewriteLocalStore(WIZARD_DRAFT_STORE, []);
  } catch (e) {
    console.warn("Failed to clear the wizard draft", e);
  }
}
