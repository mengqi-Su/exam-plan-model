import { resolvePracticeTopicPath } from "./links";

/**
 * 考试级联动快照：点「练这个考点」时，把这场考试在 Exam Plan 里上传的资料与真题，
 * 随同这一次跳转一起交给 StarQuiz——用户不需要在对面重新上传一遍。
 *
 * 通道是同一个标签页的 window.name：它是本地优先边界内唯一不需要云端、
 * 不需要跨域读对方存储、也不需要账号的载体。数据只在用户自己点击链接的那一刻、
 * 在自己的浏览器里换一次手；StarQuiz 读到即清空，Exam Plan 每次点击都会重写或清空，
 * 因此不会留下可被下一个页面读到的残留。全程不经过服务器，也不落云端。
 */
export const HANDOFF_PROTOCOL = "exam-plan-handoff";
export const HANDOFF_VERSION = 1;

export const HANDOFF_LIMITS = {
  /** 单次最多带的资料份数：再多 StarQuiz 的出题窗口也用不过来 */
  materials: 16,
  /** 单份资料的文本上限，和 Exam Plan 侧 AI 调用的截断量同级 */
  charsPerMaterial: 60_000,
  /** 整份快照的文本总量；window.name 的浏览器上限远大于此 */
  totalChars: 400_000,
  /** 超过就整个快照都不写：宁退化回「自己上传」，也不要塞坏一个标签页名字 */
  maxEncodedChars: 1_200_000,
  /** 少于这个有效字数就没什么可出题的，和 StarQuiz 上传闸门一致 */
  minVisibleChars: 50,
  name: 160,
};

export interface HandoffMaterial {
  /** StarQuiz 的素材类型：exam=真题原样整理，note=笔记出题 */
  kind: "exam" | "note";
  /** Exam Plan 自己的资料分类，保留下来便于两端排查 */
  type: string;
  name: string;
  chars: number;
  truncated: boolean;
  text: string;
}

export interface ExamHandoffSnapshot {
  protocol: typeof HANDOFF_PROTOCOL;
  version: typeof HANDOFF_VERSION;
  planId: string;
  exam: string;
  subject: string;
  /** 目标考点路径；层级不完整时留空，入站仍可按考试导入资料 */
  level: string;
  unit: string;
  topic: string;
  date: string;
  task: string;
  materials: HandoffMaterial[];
  /** 因为总量闸门没带过去的资料名，入站可以如实提示 */
  omitted: string[];
  generatedAt: string;
}

interface HandoffPlanLike {
  id?: unknown;
  examName?: unknown;
  subject?: unknown;
  preferences?: { subject?: unknown; examName?: unknown };
  materials?: unknown;
}

function trimmed(value: unknown): string {
  return String(value === null || value === undefined ? "" : value).trim();
}

/** 与 StarQuiz 的 aiVisibleChars 同口径：空白不计入，闸门才不会两端算出不同结果。 */
function visibleChars(text: string): number {
  return text.replace(/\s/g, "").length;
}

function isPastPaper(material: any): boolean {
  return material?.type === "past_exam" || material?.categoryGroup === "exam_question";
}

function toHandoffMaterial(material: any): HandoffMaterial | null {
  const raw = typeof material?.content === "string" ? material.content : "";
  const name = trimmed(material?.name).slice(0, HANDOFF_LIMITS.name);
  if (!name || !raw.trim()) return null;
  const truncated = raw.length > HANDOFF_LIMITS.charsPerMaterial;
  const text = truncated ? raw.slice(0, HANDOFF_LIMITS.charsPerMaterial) : raw;
  const chars = visibleChars(text);
  if (chars < HANDOFF_LIMITS.minVisibleChars) return null;
  return { kind: isPastPaper(material) ? "exam" : "note", type: trimmed(material?.type) || "custom", name, chars, truncated, text };
}

/**
 * 组装快照。真题优先占预算——总量超限时先被挤掉的是讲义/大纲，
 * 因为用户说的「资料和真题」里，真题是 StarQuiz 最需要的那一份。
 */
export function buildExamHandoffSnapshot(
  plan: HandoffPlanLike | null | undefined,
  context: { level?: unknown; unit?: unknown; topic?: unknown; date?: unknown; taskId?: unknown } = {}
): ExamHandoffSnapshot | null {
  const planId = trimmed(plan?.id);
  const exam = trimmed(plan?.examName) || trimmed(plan?.preferences?.examName);
  const subject = trimmed(plan?.subject) || trimmed(plan?.preferences?.subject);
  if (!planId || !(exam || subject)) return null;

  const sources = Array.isArray(plan?.materials) ? (plan.materials as unknown[]) : [];
  if (!sources.length) return null;

  // 真题排在前面抢预算，其余保持用户上传时的先后顺序（sort 稳定）
  const order = sources.map(() => 0);
  sources.forEach((material, index) => {
    order[index] = isPastPaper(material) ? 0 : 1;
  });
  const sequence = order
    .map((rank, index) => ({ rank, index }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index);

  const materials: HandoffMaterial[] = [];
  const omitted: string[] = [];
  let used = 0;
  for (const { index } of sequence) {
    const source = sources[index] as any;
    const piece = toHandoffMaterial(source);
    if (!piece) continue;
    if (materials.length >= HANDOFF_LIMITS.materials) {
      omitted.push(trimmed(source?.name).slice(0, HANDOFF_LIMITS.name));
      continue;
    }
    if (used + piece.chars > HANDOFF_LIMITS.totalChars) {
      omitted.push(piece.name);
      continue;
    }
    used += piece.chars;
    materials.push(piece);
  }

  if (!materials.length) return null;

  return {
    protocol: HANDOFF_PROTOCOL,
    version: HANDOFF_VERSION,
    planId,
    exam,
    subject,
    level: trimmed(context.level),
    unit: trimmed(context.unit).slice(0, 400),
    topic: trimmed(context.topic).slice(0, 400),
    date: trimmed(context.date),
    task: trimmed(context.taskId).slice(0, 128),
    materials,
    omitted,
    generatedAt: new Date().toISOString(),
  };
}

/** 快照编码；超预算或序列化失败就不带（返回空串），由链接自然退化成今天的普通跳转。 */
export function encodeExamHandoffSnapshot(snapshot: ExamHandoffSnapshot | null | undefined): string {
  if (!snapshot) return "";
  try {
    const encoded = JSON.stringify(snapshot);
    if (encoded.length > HANDOFF_LIMITS.maxEncodedChars) return "";
    return encoded;
  } catch {
    return "";
  }
}

/**
 * 在锚点默认跳转之前同步写入标签页名字。
 * 传 null（或预算不够）就是清空：任何一次点击之后，标签页里要么是这一次考试的快照，
 * 要么什么都没有，不会把上一场考试的资料留给下一个页面。
 */
export function primeHandoffWindow(snapshot: ExamHandoffSnapshot | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    window.name = encodeExamHandoffSnapshot(snapshot) || "";
  } catch {
    try {
      window.name = "";
    } catch {
      /* 标签页名字写不进去（沙箱/旧浏览器）：联动照常，只是资料要手动传一次 */
    }
  }
}

/** 点击「练这个考点」时的一次性动作：构建 + 写入，任何异常都不允许阻断跳转。 */
export function primeHandoffForPractice(
  plan: HandoffPlanLike | null | undefined,
  context: { level?: unknown; unit?: unknown; topic?: unknown; date?: unknown; taskId?: unknown } = {}
): void {
  try {
    primeHandoffWindow(buildExamHandoffSnapshot(plan, context));
  } catch {
    primeHandoffWindow(null);
  }
}

/**
 * 「今日任务」入口：考点路径由 links 侧同一套规则解析（解析不出来就不带层级信息，
 * 但资料/真题照样属于这场考试，值得带过去）。
 */
export function primeHandoffForTask(
  plan: HandoffPlanLike | null | undefined,
  task: { topicId?: unknown; topicTitle?: unknown; date?: unknown; id?: unknown } | null | undefined
): void {
  try {
    const path = resolvePracticeTopicPath(plan as any, task ? { topicId: task.topicId as string, topicTitle: String(task.topicTitle ?? "") } : null);
    primeHandoffForPractice(plan, {
      level: path?.level,
      unit: path?.unit,
      topic: path?.topic ?? trimmed(task?.topicTitle),
      date: trimmed(task?.date),
      taskId: trimmed(task?.id),
    });
  } catch {
    primeHandoffWindow(null);
  }
}

/** 应用启动时清掉上一次跳转可能留下的残留。 */
export function clearHandoffWindow(): void {
  primeHandoffWindow(null);
}
