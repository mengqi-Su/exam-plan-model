import type { ExamStudyPlan, PracticeEvent, PracticeEventPath, PracticeEventSourceContext } from "../types";
import { computeTopicKey, composeLinkId, normalizeTopicSegment } from "./topicKey";
import type { TopicPathInput } from "./topicKey";
import { loadPracticeEvents, putPracticeEventIfNew } from "./storage";

/**
 * 联动协议 v1 · 回程入站
 *
 * StarQuiz 的「带回备考规划 ↗」把一次练习的归因结果编码在 URL 上，本模块负责：
 * 识别来源与协议版本 → 校验参数并重算考点钥匙 → 定位本地计划里的原考点 →
 * 按 attemptId 去重后落盘为 practice_events。
 *
 * 铁律：定位不到就存成 unmatched，绝不因为标题相同就把成绩挂到别的考点上；
 * 入站只写事件库，绝不直接改 StudyTask（是否采纳为复习任务由 M3 的用户确认决定）。
 *
 * 本文件不 import i18n：入站要在测试里跑纯逻辑，文案键用字符串，
 * 由 dev/inbound.test.ts 校验每个键在双语词典里都存在。
 */

export const INBOUND_SOURCE = "starquiz";
export const INBOUND_PROTOCOL_VERSION = "1";

/** 页面需要的定位目标：显式 id，不靠标题文本去猜 DOM。 */
export interface FocusTarget {
  planId: string;
  topicId: string;
  /** 子考点标题；单元级目标时为空 */
  subtopicTitle?: string;
}

export type InboundKind =
  /** URL 与回程联动无关，什么都不做 */
  | "none"
  /** 带 starquiz 标记但参数不合法：清 URL + 提示，不写库 */
  | "invalid"
  /** 已定位到考点（这次只带回定位上下文，没有成绩） */
  | "located"
  /** 只带回定位上下文，但本机找不到对应考点 */
  | "locate_unmatched"
  /** 成绩已记录 */
  | "recorded"
  /** 同一 attemptId 已记录过：不重复写入，但仍然定位 */
  | "duplicate"
  /** 成绩合法但定位不到考点，已存为 unmatched */
  | "unmatched"
  /** 参数没问题，本地写入失败 */
  | "storage_error";

export interface InboundNotice {
  tone: "success" | "warning" | "info";
  /** i18n 文案键（由 dev/inbound.test.ts 校验双语都存在） */
  titleKey: string;
  messageKey: string;
  params?: Record<string, string | number>;
}

export interface InboundOutcome {
  handled: boolean;
  kind: InboundKind;
  /** 由调用方在持久化完成后清理地址栏 */
  clearUrl: boolean;
  notice?: InboundNotice;
  focus?: FocusTarget;
  event?: PracticeEvent;
}

interface ParsedReturn {
  planId: string;
  topicKey: string;
  path: PracticeEventPath;
  sourceContext: PracticeEventSourceContext;
  /** 成绩参数要么齐全、要么全缺；齐全才构成一条可记录的事件 */
  result: { attemptId: string; graded: number; correct: number; completedAt: string } | null;
  setId: string;
}

const PLAN_ID_RE = /^[0-9A-Za-z][0-9A-Za-z._:-]{0,63}$/;
const TOPIC_KEY_RE = /^t1_[0-9a-f]{32}$/;
const ATTEMPT_ID_RE = /^[0-9A-Za-z_-]{4,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TASK_ID_RE = /^[0-9A-Za-z._:-]{1,128}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]");

/** 与 StarQuiz 出站 PLAN_PARAM_LIMITS 对齐的长度上限，防止超长参数撑爆本地库。 */
const LIMITS = { plan: 64, topicKey: 40, subject: 100, unit: 400, topic: 400, exam: 150, task: 128, attempt: 64, set: 64, at: 40 };

/** 空白折叠 + 去首尾 + 拒绝控制字符；不合法返回 null，由调用方判定整条链接无效。 */
function cleanParam(raw: string | null, max: number): string | null {
  if (raw === null) return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text || text.length > max) return null;
  if (CONTROL_CHARS.test(text)) return null;
  return text;
}

function toInt(raw: string | null, max: number): number | null {
  if (raw === null || !/^\d{1,4}$/.test(raw)) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value > max) return null;
  return value;
}

/** 练习完成时间必须在可信区间内：不接受 1970 或一千年后的时间戳。 */
function parseCompletedAt(raw: string, nowMs: number): string | null {
  const iso = ISO_RE.test(raw) ? raw : null;
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const lowerBound = Date.UTC(2000, 0, 1);
  const upperBound = nowMs + 24 * 60 * 60 * 1000;
  if (ms < lowerBound || ms > upperBound) return null;
  return new Date(ms).toISOString();
}

/**
 * 解析回程参数。
 * 返回 null = 这条 URL 与回程联动无关（普通链接/站内地址），调用方不应清 URL。
 * 返回 { invalid: reason } = 明确带上了 starquiz 标记却无法校验通过，需要提示并清理。
 */
export function parseReturnParams(search: string): { parsed: ParsedReturn | null; invalid: boolean } {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const from = (params.get("from") || "").trim().toLowerCase();
  if (from !== INBOUND_SOURCE) return { parsed: null, invalid: false };

  // 带上了来源标记就是联动链接，之后任何不合格都算 invalid，而不是「忽略」
  const version = (params.get("v") || "").trim();
  if (version !== INBOUND_PROTOCOL_VERSION) return { parsed: null, invalid: true };

  const planId = cleanParam(params.get("plan"), LIMITS.plan);
  const topicKey = cleanParam(params.get("tk"), LIMITS.topicKey);
  const subject = cleanParam(params.get("subject"), LIMITS.subject);
  const unit = cleanParam(params.get("unit"), LIMITS.unit);
  const topic = cleanParam(params.get("topic"), LIMITS.topic);
  const rawLevel = cleanParam(params.get("level"), 20);
  if (!planId || !topicKey || !subject || !unit || !topic) return { parsed: null, invalid: true };
  if (!PLAN_ID_RE.test(planId)) return { parsed: null, invalid: true };
  if (!TOPIC_KEY_RE.test(topicKey)) return { parsed: null, invalid: true };
  if (rawLevel !== "unit" && rawLevel !== "subtopic") return { parsed: null, invalid: true };
  const level = rawLevel;
  // 单元级目标的 topic 段就是单元本身；不一致说明链接被手改过
  if (level === "unit" && normalizeTopicSegment(unit) !== normalizeTopicSegment(topic)) return { parsed: null, invalid: true };

  const exam = cleanParam(params.get("exam"), LIMITS.exam) ?? "";
  const rawDate = cleanParam(params.get("date"), 10);
  if (rawDate !== null && !DATE_RE.test(rawDate)) return { parsed: null, invalid: true };
  const rawTask = cleanParam(params.get("task"), LIMITS.task);
  if (rawTask !== null && !TASK_ID_RE.test(rawTask)) return { parsed: null, invalid: true };
  const setId = cleanParam(params.get("set"), LIMITS.set) ?? "";
  if (setId && !ATTEMPT_ID_RE.test(setId) && !PLAN_ID_RE.test(setId)) return { parsed: null, invalid: true };

  const attemptRaw = cleanParam(params.get("attempt"), LIMITS.attempt);
  const gradedRaw = params.get("graded");
  const correctRaw = params.get("correct");
  const atRaw = cleanParam(params.get("at"), 40);
  const hasAnyResultParam = [attemptRaw, gradedRaw, correctRaw, atRaw].some((v) => v !== null);
  let result: ParsedReturn["result"] = null;
  if (hasAnyResultParam) {
    if (!attemptRaw || gradedRaw === null || correctRaw === null || !atRaw) return { parsed: null, invalid: true };
    if (!ATTEMPT_ID_RE.test(attemptRaw)) return { parsed: null, invalid: true };
    const graded = toInt(gradedRaw, 1000);
    const correct = toInt(correctRaw, 1000);
    if (graded === null || correct === null || graded < 1 || correct > graded) return { parsed: null, invalid: true };
    result = { attemptId: attemptRaw, graded, correct, completedAt: atRaw };
  }

  return {
    parsed: {
      planId,
      topicKey,
      path: { level, exam, subject, unit, topic },
      sourceContext: { date: rawDate ?? undefined, task: rawTask ?? undefined },
      result,
      setId,
    },
    invalid: false,
  };
}

/** 单元/子考点标题的两套表示合并去重，与 links.ts 的口径保持一致。 */
function subtopicTitles(unit: NonNullable<ExamStudyPlan["topics"]>[number]): string[] {
  const titles = new Set<string>();
  (unit.subtopicTree || []).forEach((sub) => {
    const title = String(sub?.title || sub?.name || "").trim();
    if (title) titles.add(title);
  });
  (unit.subtopics || []).forEach((sub) => {
    const title = String(sub || "").trim();
    if (title) titles.add(title);
  });
  return Array.from(titles);
}

export interface LocateInput {
  planId: string;
  topicKey: string;
  path: PracticeEventPath;
}

/**
 * 用 planId + 规范化路径 + 重算的考点钥匙三重定位原考点。
 *
 * 先按内容路径筛候选（学科/单元/子考点标题规范化相等），再对候选重算 topicKey
 * 并要求与链接里的 tk 完全相等——标题相同但内容路径不同的一律排除。
 * 候选钥匙命中多条时视为歧义，返回 null：宁可不挂，也不把成绩分给两个考点之一。
 */
export async function locateTopicTarget(plans: ExamStudyPlan[], input: LocateInput): Promise<FocusTarget | null> {
  const plan = plans.find((item) => item && item.id === input.planId);
  if (!plan) return null;

  const subject = String(plan.subject || plan.preferences?.subject || "").trim();
  if (!subject) return null;
  if (normalizeTopicSegment(subject) !== normalizeTopicSegment(input.path.subject)) return null;

  const wantedUnit = normalizeTopicSegment(input.path.unit);
  const wantedTopic = normalizeTopicSegment(input.path.topic);
  const candidates: Array<{ topicId: string; subtopicTitle?: string; keyInput: TopicPathInput }> = [];

  (plan.topics || []).forEach((unit) => {
    if (!unit || !unit.id) return;
    const unitTitle = String(unit.title || "").trim();
    if (!unitTitle) return;
    if (normalizeTopicSegment(unitTitle) !== wantedUnit) return;
    if (input.path.level === "unit") {
      if (wantedTopic !== wantedUnit) return;
      candidates.push({ topicId: unit.id, keyInput: { level: "unit", subject, unit: unitTitle, topic: unitTitle } });
      return;
    }
    subtopicTitles(unit).forEach((sub) => {
      if (normalizeTopicSegment(sub) !== wantedTopic) return;
      candidates.push({ topicId: unit.id, subtopicTitle: sub, keyInput: { level: "subtopic", subject, unit: unitTitle, topic: sub } });
    });
  });

  const matched: FocusTarget[] = [];
  for (const candidate of candidates) {
    const key = await computeTopicKey(candidate.keyInput);
    if (key !== input.topicKey) continue;
    matched.push(
      candidate.subtopicTitle
        ? { planId: plan.id, topicId: candidate.topicId, subtopicTitle: candidate.subtopicTitle }
        : { planId: plan.id, topicId: candidate.topicId }
    );
  }
  if (matched.length !== 1) return null;
  return matched[0];
}

function noticeFor(kind: InboundKind, topicLabel: string, graded?: number, correct?: number): InboundNotice {
  switch (kind) {
    case "recorded":
      return {
        tone: "success",
        titleKey: "inboundRecordedTitle",
        messageKey: "inboundRecordedBody",
        params: { topic: topicLabel, graded: graded ?? 0, correct: correct ?? 0 },
      };
    case "duplicate":
      return { tone: "info", titleKey: "inboundDuplicateTitle", messageKey: "inboundDuplicateBody", params: { topic: topicLabel } };
    case "located":
      return { tone: "info", titleKey: "inboundLocateTitle", messageKey: "inboundLocateBody", params: { topic: topicLabel } };
    case "unmatched":
      return { tone: "warning", titleKey: "inboundUnmatchedTitle", messageKey: "inboundUnmatchedBody", params: { topic: topicLabel } };
    case "locate_unmatched":
      return { tone: "warning", titleKey: "inboundUnmatchedTitle", messageKey: "inboundLocateUnmatchedBody", params: { topic: topicLabel } };
    case "storage_error":
      return { tone: "warning", titleKey: "inboundStorageTitle", messageKey: "inboundStorageBody" };
    default:
      return { tone: "warning", titleKey: "inboundInvalidTitle", messageKey: "inboundInvalidBody" };
  }
}

export interface InboundDeps {
  /** 可注入以便测试；默认走 IndexedDB（失败自动回退 localStorage） */
  load?: () => Promise<PracticeEvent[]>;
  save?: (event: PracticeEvent) => Promise<{ created: boolean; existing: PracticeEvent | null }>;
  now?: () => Date;
}

/**
 * 回程入站主流程。调用方（App）在数据水合完成后执行一次，
 * 只有返回 handled=true 时才清理地址栏，且必须在 await 之后清，避免刷新丢事件。
 */
export async function processInboundReturn(search: string, plans: ExamStudyPlan[], deps: InboundDeps = {}): Promise<InboundOutcome> {
  const { parsed, invalid } = parseReturnParams(search);
  if (invalid) return { handled: true, kind: "invalid", clearUrl: true, notice: noticeFor("invalid", "") };
  if (!parsed) return { handled: false, kind: "none", clearUrl: false };

  const now = (deps.now ? deps.now() : new Date()).toISOString();
  const topicLabel = parsed.path.topic;

  // 方案 §6.2 第 2 步：用链接自带的内容路径重算钥匙。
  // 链接自身都对不上（被手改或两端算法版本不一致）就是非法链接，
  // 绝不能继续当成「本地找不到」写一条 unmatched 记录污染事件库。
  const recomputed = await computeTopicKey(parsed.path);
  if (recomputed !== parsed.topicKey) {
    return { handled: true, kind: "invalid", clearUrl: true, notice: noticeFor("invalid", "") };
  }

  const target = await locateTopicTarget(plans, { planId: parsed.planId, topicKey: parsed.topicKey, path: parsed.path });

  // 横幅的「返回备考规划」只带定位上下文：帮用户回到原考点，但不写任何成绩记录
  if (!parsed.result) {
    return target
      ? { handled: true, kind: "located", clearUrl: true, focus: target, notice: noticeFor("located", topicLabel) }
      : { handled: true, kind: "locate_unmatched", clearUrl: true, notice: noticeFor("locate_unmatched", topicLabel) };
  }

  const completedAt = parseCompletedAt(parsed.result.completedAt, Date.parse(now));
  if (!completedAt) return { handled: true, kind: "invalid", clearUrl: true, notice: noticeFor("invalid", "") };

  const draft: PracticeEvent = {
    schemaVersion: 1,
    attemptId: parsed.result.attemptId,
    linkId: safeLinkId(parsed.planId, parsed.topicKey),
    planId: parsed.planId,
    topicKey: parsed.topicKey,
    path: parsed.path,
    sourceContext: parsed.sourceContext,
    setId: parsed.setId,
    graded: parsed.result.graded,
    correct: parsed.result.correct,
    completedAt,
    receivedAt: now,
    status: target ? "pending" : "unmatched",
    ...(target ? { resolution: { planId: target.planId, topicId: target.topicId, subtopicTitle: target.subtopicTitle } } : {}),
  };

  const load = deps.load || loadPracticeEvents;
  const save =
    deps.save ||
    (async (event: PracticeEvent) => {
      const result = await putPracticeEventIfNew(event);
      return { created: result.created, existing: result.existing };
    });

  try {
    const existingEvents = await load();
    const seen = existingEvents.find((event) => event.attemptId === draft.attemptId) || null;
    if (seen) {
      // 重复点击同一条回执：保持一条记录，但仍然把用户带回原考点
      const focus = target || (seen.resolution ? { planId: seen.resolution.planId, topicId: seen.resolution.topicId, subtopicTitle: seen.resolution.subtopicTitle } : undefined);
      return { handled: true, kind: "duplicate", clearUrl: true, focus, event: seen, notice: noticeFor("duplicate", topicLabel) };
    }
    const saved = await save(draft);
    if (!saved.created && saved.existing) {
      return { handled: true, kind: "duplicate", clearUrl: true, focus: target, event: saved.existing, notice: noticeFor("duplicate", topicLabel) };
    }
    const kind: InboundKind = target ? "recorded" : "unmatched";
    return { handled: true, kind, clearUrl: true, focus: target ?? undefined, event: draft, notice: noticeFor(kind, topicLabel, draft.graded, draft.correct) };
  } catch (e) {
    console.error("Failed to persist inbound practice event", e);
    return { handled: true, kind: "storage_error", clearUrl: true, focus: target ?? undefined, notice: noticeFor("storage_error", "") };
  }
}

function safeLinkId(planId: string, topicKey: string): string {
  try {
    return composeLinkId(planId, topicKey);
  } catch {
    return `${planId}:${topicKey}`;
  }
}

/** 供 UI 复用：把已落盘的回执事件重新定位回考点（页面刷新/切换计划后仍能展开滚动）。 */
export async function resolveEventFocus(plans: ExamStudyPlan[], event: PracticeEvent): Promise<FocusTarget | null> {
  return locateTopicTarget(plans, { planId: event.planId, topicKey: event.topicKey, path: event.path });
}
