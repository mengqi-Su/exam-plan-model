import { StudyMaterial, TextbookChapter, TextbookOutline } from "../types";
import { attachTaskTopicIds } from "./links";

// 资料库容量和单次生成用量是两件事：库里能存 100 份，一次生成只吃 20 份。
// 20 这个数字来自提示词预算（每份均分 45,000 字），再多后面的资料就到不了模型面前。
export const MAX_AI_MATERIALS = 20;
export const MAX_LIBRARY_MATERIALS = 100;
// 单次 AI 调用只需要片段文本：本地阅读器仍保留完整原文
export const MAX_AI_CHARS_PER_MATERIAL = 60_000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface AiResponseMeta {
  source?: "ai" | "fallback";
  fallbackReason?: "no_api_key" | "ai_error" | "ai_timeout" | "too_many_tasks";
  coveredDays?: number;
  planningDays?: number;
}

/**
 * 默认勾选前 20 份；用户已经手动选过就沿用他的选择，只剔除被删掉的资料。
 * 全部取消后回到默认，免得「一份都没选」把生成按钮永久卡死。
 */
export function defaultAiSelection(materials: StudyMaterial[] | undefined, previous?: string[]): string[] {
  const list = materials || [];
  const alive = new Set(list.map((material) => material.id));
  const kept = (previous || []).filter((id) => alive.has(id)).slice(0, MAX_AI_MATERIALS);
  if (kept.length) return kept;
  return list.slice(0, MAX_AI_MATERIALS).map((material) => material.id);
}

/** 勾选上限处的原因：说清这次用了多少、剩下的去哪了，不做静默截断。 */
export function aiSelectionNotice(total: number, selected: number, language: string): string | null {
  if (total <= MAX_AI_MATERIALS) return null;
  const unused = total - selected;
  return language === "zh"
    ? `资料库共 ${total} 份，一次生成最多用 ${MAX_AI_MATERIALS} 份：本次用勾选的 ${selected} 份，其余 ${unused} 份留在资料库。`
    : `${total} materials in the library, but one run uses at most ${MAX_AI_MATERIALS}: this run uses the ${selected} checked files, and the other ${unused} stay in the library.`;
}

/**
 * 只把勾选的资料交给 AI。超出单次上限就明确报错，绝不替用户悄悄丢掉后面的资料——
 * 选哪几份是用户在列表里勾的，这里只负责忠实执行。
 */
export function prepareMaterialsForAI(materials?: StudyMaterial[], selectedIds?: string[]) {
  const list = materials || [];
  const picked = selectedIds ? list.filter((material) => selectedIds.includes(material.id)) : list;
  if (picked.length > MAX_AI_MATERIALS) {
    throw new GenerationError(
      `一次生成最多用 ${MAX_AI_MATERIALS} 份资料，当前勾选了 ${picked.length} 份，请取消勾选一部分。`,
      "TOO_MANY_MATERIALS"
    );
  }
  return picked.map((material) => ({
    id: material.id,
    name: material.name,
    type: material.type,
    content: (material.content || "").slice(0, MAX_AI_CHARS_PER_MATERIAL),
  }));
}

export function getAiFallbackNotice(meta: AiResponseMeta | undefined, language: string): string | null {
  if (meta?.source !== "fallback") return null;
  if (language === "zh") {
    if (meta.fallbackReason === "no_api_key") {
      return "未配置 AI 服务，已按本地排程规则重新分配任务。所有数据仍保存在本浏览器中。";
    }
    if (meta.fallbackReason === "too_many_tasks") {
      return "待办任务较多，已按本地排程规则均匀重排。数据和已完成任务都保留在本浏览器中。";
    }
    return "AI 服务暂时不可用，已按本地排程规则重新分配任务。你的数据和已完成的任务都保留在本浏览器中。";
  }
  if (meta.fallbackReason === "no_api_key") {
    return "AI is not configured. Tasks were rescheduled with local rules. Your data stays in this browser.";
  }
  if (meta.fallbackReason === "too_many_tasks") {
    return "There are many open tasks, so they were redistributed with local rules. Your data and completed tasks stay in this browser.";
  }
  return "AI is temporarily unavailable. Tasks were rescheduled with local rules. Your data and completed tasks stay in this browser.";
}

const ERROR_MESSAGES: Record<string, { zh: string; en: string }> = {
  RATE_LIMITED: {
    zh: "请求过于频繁，请等待一分钟后重试。",
    en: "Too many requests. Please wait a minute and try again.",
  },
  PAYLOAD_TOO_LARGE: {
    zh: "上传内容超过上限（16 MB），请减少文件数量或压缩文件。",
    en: "The request exceeds the 16 MB limit. Reduce the number of files or compress them.",
  },
  FILE_TOO_LARGE: {
    zh: "单个文件超过 10 MB 上限，请压缩或拆分后再上传。",
    en: "Each file must be 10 MB or smaller.",
  },
  TOO_MANY_MATERIALS: {
    zh: "一次生成最多用 20 份资料，请取消勾选一部分。",
    en: "One run uses at most 20 materials. Uncheck some files and try again.",
  },
  UNSUPPORTED_FORMAT: {
    zh: "不支持此文件格式。请上传 PDF、Word（.doc / .docx）、PPTX、TXT、Markdown、CSV 或 JSON。",
    en: "Unsupported file type. Upload PDF, Word (.doc / .docx), PPTX, TXT, Markdown, CSV, or JSON.",
  },
  // 旧版 Word（.doc）现在能本地直接读，剩下只有旧版 PowerPoint 还得让用户另存一次。
  LEGACY_OFFICE_UNSUPPORTED: {
    zh: "旧版 PowerPoint（.ppt）暂时读不了，请用 PowerPoint 或 WPS 另存为 .pptx 或 PDF 后上传。",
    en: "Legacy PowerPoint (.ppt) can't be read yet. Save it as .pptx or PDF, then upload.",
  },
  SCANNED_PDF_AI_REQUIRED: {
    zh: "该 PDF 没有可提取的文字层（可能是扫描件），且 AI 解析不可用。请上传可复制文字的 PDF、DOCX 或 PPTX。",
    en: "This PDF has no text layer (it may be scanned) and AI parsing is unavailable. Upload a text-based PDF, DOCX, or PPTX.",
  },
  AI_PARSE_FAILED: {
    zh: "AI 解析服务暂时不可用，请稍后重试。",
    en: "AI document parsing is temporarily unavailable. Please try again later.",
  },
  AI_UNAVAILABLE: {
    zh: "AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。",
    en: "The AI service is temporarily unavailable. Please try again. Your materials will not be replaced with a template.",
  },
  AI_NOT_CONFIGURED: {
    zh: "AI 服务尚未启用，无法自动生成。请稍后重试或检查站点 AI 状态。",
    en: "AI is not enabled yet. Try again later or check the site's AI status.",
  },
  MISSING_MATERIALS: {
    zh: "请先上传至少一份课程资料。",
    en: "Upload at least one course document first.",
  },
  EMPTY_MATERIALS: {
    zh: "资料内容为空，请重新上传可读取文字的文件。",
    en: "The materials contain no readable text. Upload a text-based file and try again.",
  },
  SYLLABUS_EMPTY: {
    zh: "AI 没有从这些资料中识别到可用考点，请补充更完整的考纲、讲义或真题后重试。",
    en: "AI found no usable topics in these materials. Add a fuller syllabus, notes, or past paper and try again.",
  },
  SYLLABUS_EXTRACTION_FAILED: {
    zh: "考点提取失败，请稍后重试。",
    en: "Topic extraction failed. Please try again later.",
  },
  PLAN_EMPTY: {
    zh: "AI 没有返回可用的每日任务，请检查资料内容后重试。",
    en: "AI returned no usable daily tasks. Check your materials and try again.",
  },
  PLAN_GENERATION_FAILED: {
    zh: "学习计划生成失败，请稍后重试。",
    en: "Study plan generation failed. Please try again later.",
  },
  PLAN_CHUNK_EMPTY: {
    zh: "有几天没能生成任务，请重试或减少这几天的资料要求。",
    en: "Some days got no tasks. Try again, or reduce the requirements for those days.",
  },
  INVALID_START_DATE: {
    zh: "开始日期格式无效，请重新选择。",
    en: "The start date is invalid. Pick it again.",
  },
  INVALID_EXAM_DATE: {
    zh: "考试日期格式无效，请重新选择。",
    en: "The exam date is invalid. Pick it again.",
  },
  INVALID_DATE_RANGE: {
    zh: "考试日期不能早于开始复习日期。",
    en: "The exam date cannot be earlier than the start date.",
  },
  PARSE_FAILED: {
    zh: "文档解析服务异常，请稍后重试或换一份文件。",
    en: "Document parsing failed. Please try again or upload a different file.",
  },
  EMPTY_DOCUMENT: {
    zh: "未能从文件中读取到文字内容。",
    en: "No readable text was found in this file.",
  },
  DOCX_PARSE_FAILED: {
    zh: "无法读取该 DOCX 文件，请确认文件未损坏。",
    en: "Could not read this DOCX file. Please verify it is not corrupted.",
  },
  PPTX_NO_TEXT: {
    zh: "未能从 PPTX 中提取文字（可能全部为图片）。请导出为 PDF 或补充文字版讲义。",
    en: "No text could be extracted from this PPTX. Export it as PDF or upload text-based notes.",
  },
  MISSING_FILE_DATA: {
    zh: "缺少文件内容，请重新选择文件。",
    en: "Missing file data. Please select the file again.",
  },
  INVALID_JSON: {
    zh: "请求内容格式无效，请刷新页面后重试。",
    en: "Invalid request format. Refresh the page and try again.",
  },
  ai_not_configured: {
    zh: "AI 服务尚未启用：请在站点设置中填写 DeepSeek API Key。",
    en: "AI is not enabled yet: add a DeepSeek API key in the site settings.",
  },
  ai_unavailable: {
    zh: "AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。",
    en: "The AI service is temporarily unavailable. Please try again. Your materials will not be replaced with a template.",
  },
  ai_bad_output: {
    zh: "AI 返回的格式不正确，请重试。",
    en: "AI returned malformed output. Please try again.",
  },
  ai_rate_limited: {
    zh: "AI 调用频率过高，请稍后再试。",
    en: "AI is rate limited. Please try again later.",
  },
  ai_access_denied: {
    zh: "AI 服务鉴权失败，请检查站点设置中的 DeepSeek API Key。",
    en: "AI authentication failed. Check the DeepSeek API key in the site settings.",
  },
  ai_out_of_credits: {
    zh: "DeepSeek 账户余额不足，本次无法生成。请充值后重试。",
    en: "The DeepSeek account has no remaining balance, so generation is paused. Top up and try again.",
  },
  ai_request_rejected: {
    zh: "AI 服务拒绝了本次请求，请减少资料量或分批生成后重试。",
    en: "The AI service rejected this request. Reduce the materials or generate in smaller batches.",
  },
  AI_EMPTY: {
    zh: "AI 本次没有返回内容，请重试。",
    en: "AI returned no content this time. Please try again.",
  },
  AI_TIMEOUT: {
    zh: "生成超时了，请稍后重试，或减少资料量。",
    en: "Generation timed out. Try again later or reduce the materials.",
  },
  ai_timeout: {
    zh: "AI 这一段生成太慢了，已自动拆成更小的批次重试。",
    en: "That segment was too slow for AI, so it is being retried in smaller batches.",
  },
  ai_output_capped: {
    zh: "AI 单次输出长度到顶了，已自动拆成逐日生成。",
    en: "AI hit its per-call output limit, so the days are being generated one by one.",
  },
  invalid_request: {
    zh: "请求内容格式无效，请刷新页面后重试。",
    en: "Invalid request format. Refresh the page and try again.",
  },
  // 下面是函数闸门（functions/requestGuard.ts）的拒绝码。
  body_too_large: {
    zh: "这次提交的内容超过了服务上限，请减少资料数量后重试。",
    en: "This request is over the service limit. Reduce the materials and try again.",
  },
  body_timeout: {
    zh: "上传太慢了，请检查网络，或减少资料量后重试。",
    en: "The upload was too slow. Check your connection, or reduce the materials and try again.",
  },
  bad_body: {
    zh: "请求内容格式无效，请刷新页面后重试。",
    en: "Invalid request format. Refresh the page and try again.",
  },
  unsupported_media_type: {
    zh: "这个接口只接受 JSON 请求，请刷新页面后重试。",
    en: "This endpoint only accepts JSON requests. Refresh the page and try again.",
  },
  cross_origin: {
    zh: "当前页面不能调用规划服务，请在本站页面内使用。",
    en: "This page cannot call the planning service. Use it from within the site.",
  },
  rate_limited: {
    zh: "请求太频繁了，请等一会儿再试。",
    en: "Too many requests. Please wait a moment and try again.",
  },
  // 与 rate_limited 分开：那是等几分钟，重试有意义；这是等明天，重试只是耗时间。
  daily_quota_reached: {
    zh: "今天的调用次数已用完，请明天再试。",
    en: "You've used up today's allowance. Please try again tomorrow.",
  },
  internal_error: {
    zh: "服务暂时不可用，请稍后重试。",
    en: "The service is temporarily unavailable. Please try again later.",
  },
};

export function localizeApiError(
  code: string | undefined,
  status: number,
  language: string,
  serverMessage?: string
): string {
  const entry = code ? ERROR_MESSAGES[code] : undefined;
  if (entry) return language === "zh" ? entry.zh : entry.en;
  if (language === "zh") return serverMessage || `请求失败（HTTP ${status}）。`;
  return `Request failed (HTTP ${status}).`;
}

export async function readApiError(
  response: Response,
  language: string
): Promise<{ message: string; code?: string }> {
  let code: string | undefined;
  let serverMessage: string | undefined;
  try {
    const data = await response.json();
    code = typeof data?.code === "string" ? data.code : undefined;
    serverMessage = typeof data?.error === "string" ? data.error : undefined;
  } catch {
    // response body was not JSON
  }
  return {
    message: localizeApiError(code, response.status, language, serverMessage),
    code,
  };
}

/* ---------------- DeepSeek 生成（浏览器并发编排小请求） ---------------- */

export class GenerationError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
  }
}

// textbook-toc：只回忆章节目录，一次调用；textbook-topics：把勾选的章节逐章展开，和 syllabus 同样是并发多段。
export type GenerationMode = "syllabus" | "plan" | "rebalance" | "textbook-toc" | "textbook-topics";

export interface RunGenerationOptions {
  language: string;
  signal?: AbortSignal;
  onStatus?: (text: string) => void;
  deadlineMs?: number;
}

const FUNCTION_BASE = "/functions/v1/app";

// 站点网关单请求约 60 秒超时，因此每次只让模型产出一小段 JSON，由浏览器并发调用拼接。
const CONCURRENCY = 4;
const CALL_RETRY_DELAYS = [2500, 9000];
// 这些错误码是瞬时的（限流、抖动、坏输出、上传太慢），自动重试；配置与额度类错误直接告诉用户。
const RETRYABLE_CODES = new Set([
  "ai_rate_limited",
  "ai_unavailable",
  "ai_bad_output",
  "AI_EMPTY",
  "PLAN_CHUNK_EMPTY",
  "internal_error",
  // 闸门给的瞬时拒绝也是等一会儿就可能过：重试比解释对用户有用。
  // 日额度用满是另一个 code（daily_quota_reached），不在这里——那要等明天，重试没有意义。
  "rate_limited",
  "body_timeout",
]);
// 输出长度上限/时间预算用完：同一份大请求重试只会再撞一次，改成把这段日历拆成单天再要。
const SPLITTABLE_CODES = new Set(["ai_output_capped", "ai_timeout", "PLAN_CHUNK_EMPTY"]);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

interface CallContext {
  lang: "zh" | "en";
  tt: (zh: string, en: string) => string;
  deadlineAt: number;
  signal: AbortSignal;
  onStatus?: (text: string) => void;
}

function abortError(ctx: CallContext): GenerationError {
  return new GenerationError(
    ctx.lang === "zh" ? "已取消生成。" : "Generation cancelled.",
    "ABORTED"
  );
}

// 单次小请求：瞬时故障（限流 / 网络抖动 / 坏输出 / 发布窗口的非 JSON 响应）自动重试，
// 配置与额度类错误立即抛出，让用户看到真实原因而不是「请检查网络」。
async function callAi<T = any>(
  path: string,
  body: Record<string, unknown>,
  ctx: CallContext
): Promise<T> {
  const url = `${FUNCTION_BASE}${path}`;
  const requestBody = { ...body, language: ctx.lang };

  for (let attempt = 0; attempt <= CALL_RETRY_DELAYS.length; attempt++) {
    if (ctx.signal.aborted) throw abortError(ctx);
    if (Date.now() > ctx.deadlineAt) {
      throw new GenerationError(
        ctx.tt("生成超时了，请稍后重试，或减少资料量。", "Generation timed out. Try again later or reduce the materials."),
        "AI_TIMEOUT"
      );
    }

    let res: Response | null = null;
    let data: any = null;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: ctx.signal,
      });
      data = await res.json().catch(() => null);
    } catch (error: any) {
      if (error?.name === "AbortError") throw abortError(ctx);
      res = null;
      data = null;
    }

    if (!res || !data) {
      if (attempt < CALL_RETRY_DELAYS.length) {
        ctx.onStatus?.(ctx.tt("正在重连 AI 服务…", "Reconnecting to the AI service…"));
        await sleep(CALL_RETRY_DELAYS[attempt], ctx.signal);
        continue;
      }
      throw new GenerationError(
        ctx.tt("无法连接 AI 服务，请检查网络后重试。", "Could not reach the AI service. Check your connection and try again."),
        "ai_unavailable"
      );
    }

    if (!res.ok || data.ok === false) {
      const code = typeof data.code === "string" ? data.code : undefined;
      if (code && RETRYABLE_CODES.has(code) && attempt < CALL_RETRY_DELAYS.length) {
        ctx.onStatus?.(ctx.tt(`AI 服务繁忙，自动重试中（第 ${attempt + 1} 次）…`, `AI is busy, retrying (attempt ${attempt + 1})…`));
        await sleep(CALL_RETRY_DELAYS[attempt], ctx.signal);
        continue;
      }
      throw new GenerationError(localizeApiError(code, res.status, ctx.lang, data?.error), code);
    }

    return data as T;
  }

  throw new GenerationError(
    ctx.tt("无法连接 AI 服务，请检查网络后重试。", "Could not reach the AI service. Check your connection and try again."),
    "ai_unavailable"
  );
}

/** 保序并发：返回值按输入顺序排列，任一失败即中断整批。 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function linkSignal(external?: AbortSignal): { signal: AbortSignal; abort: () => void } {
  const controller = new AbortController();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return { signal: controller.signal, abort: () => controller.abort() };
}

function dedupeTasks(tasks: any[]): any[] {
  const seenIds = new Set<string>();
  const seenPairs = new Set<string>();
  const out: any[] = [];
  tasks.forEach((task: any) => {
    if (!task || typeof task !== "object" || !task.date || !task.title) return;
    const pair = `${task.date}|${String(task.title).trim().toLowerCase()}`;
    if (seenPairs.has(pair)) return;
    seenPairs.add(pair);
    let id = String(task.id || `task-${task.date}-${out.length + 1}`);
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${String(task.id || `task-${task.date}`)}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);
    out.push({ ...task, id });
  });
  return out.sort((a, b) => {
    const diff = String(a.date).localeCompare(String(b.date));
    return diff !== 0 ? diff : String(a.startTime || "99:99").localeCompare(String(b.startTime || "99:99"));
  });
}

/* ---------------- 考点提取：单元 -> 逐单元展开 ---------------- */

async function generateSyllabus(payload: Record<string, unknown>, ctx: CallContext) {
  ctx.onStatus?.(ctx.tt("识别核心单元…", "Identifying major units…"));
  const unitsRes = await callAi<{ summary?: string; units: any[] }>(
    "/ai/units",
    { materials: payload.materials, examName: payload.examName, subject: payload.subject },
    ctx
  );
  const units = Array.isArray(unitsRes.units) ? unitsRes.units : [];
  if (!units.length) {
    throw new GenerationError(
      ctx.tt(
        "AI 没有从这些资料中识别到可用单元，请补充更完整的考纲、讲义或真题后重试。",
        "AI found no usable units in these materials. Add a fuller syllabus, notes, or past paper and try again."
      ),
      "SYLLABUS_EMPTY"
    );
  }

  ctx.onStatus?.(ctx.tt(`展开 ${units.length} 个单元的考点…`, `Expanding ${units.length} units…`));
  let done = 0;
  const topics = await mapLimit(units, CONCURRENCY, async (unit: any, index: number) => {
    const res = await callAi<{ topic: any }>(
      "/ai/unit-tree",
      { unit, unitIndex: index, unitsCount: units.length },
      ctx
    );
    done += 1;
    ctx.onStatus?.(ctx.tt(`考点已展开 ${done}/${units.length}`, `Topics expanded ${done}/${units.length}`));
    return res.topic;
  });

  const clean = topics.filter(Boolean);
  if (!clean.length) {
    throw new GenerationError(
      ctx.tt(
        "AI 没有从这些资料中识别到可用考点，请补充更完整的考纲、讲义或真题后重试。",
        "AI found no usable topics in these materials. Add a fuller syllabus, notes, or past paper and try again."
      ),
      "SYLLABUS_EMPTY"
    );
  }
  return { result: { summary: unitsRes.summary || "", topics: clean }, meta: { source: "ai" as const } };
}

/* ---------------- 教材目录：先给章节，勾选后再展开成考点 ---------------- */

async function generateTextbookToc(payload: Record<string, unknown>, ctx: CallContext) {
  ctx.onStatus?.(ctx.tt("整理教材目录…", "Rebuilding the textbook outline…"));
  const res = await callAi<TextbookOutline>(
    "/ai/textbook-toc",
    { textbook: payload.textbook, examName: payload.examName, subject: payload.subject },
    ctx
  );
  const chapters = Array.isArray(res?.chapters) ? res.chapters : [];
  if (!chapters.length) {
    throw new GenerationError(
      ctx.tt(
        "AI 没能整理出这本教材的可靠目录，换成本教材全称（含版次）再试，或直接上传目录/考纲。",
        "AI could not rebuild a reliable outline for this textbook. Try the full title with edition, or upload the table of contents."
      ),
      "SYLLABUS_EMPTY"
    );
  }
  return { result: { ...res, chapters }, meta: { source: "ai" as const } };
}

async function generateTextbookTopics(payload: Record<string, unknown>, ctx: CallContext) {
  const chapters = (Array.isArray(payload.chapters) ? payload.chapters : []) as TextbookChapter[];
  const textbook = String(payload.textbook || "");
  if (!chapters.length) {
    throw new GenerationError(
      ctx.tt("至少勾选一个章节。", "Select at least one chapter."),
      "INVALID_REQUEST"
    );
  }

  let done = 0;
  const topics = await mapLimit(chapters, CONCURRENCY, async (chapter, index) => {
    const res = await callAi<{ topic: any }>(
      "/ai/unit-tree",
      {
        // 章节即单元：来源标成 textbook，函数才会走教材回忆规矩（没有原文片段可接地）。
        unit: { ...chapter, source: "textbook" },
        textbook,
        unitIndex: index,
        unitsCount: chapters.length,
      },
      ctx
    );
    done += 1;
    ctx.onStatus?.(ctx.tt(`考点已展开 ${done}/${chapters.length}`, `Topics expanded ${done}/${chapters.length}`));
    return res.topic;
  });

  const clean = topics.filter(Boolean);
  if (!clean.length) {
    throw new GenerationError(
      ctx.tt(
        "AI 没能把这些章节展开成考点，可以少勾几章再试，或补一份目录/讲义资料。",
        "AI could not expand these chapters into topics. Select fewer chapters, or add a syllabus/outline material."
      ),
      "SYLLABUS_EMPTY"
    );
  }
  const summary = textbook
    ? ctx.tt(`按《${textbook}》的 ${clean.length} 个章节整理`, `From ${clean.length} chapters of "${textbook}"`)
    : "";
  return { result: { summary, topics: clean }, meta: { source: "ai" as const } };
}

/* ---------------- 计划生成：日历分段 -> 并发排程 -> 补缺 ---------------- */

async function generatePlan(payload: Record<string, unknown>, ctx: CallContext) {
  const schedule = await callAi<{ studyDates: string[]; chunks: Array<{ dates: string[] }>; totalDays: number }>(
    "/ai/plan-schedule",
    { preferences: payload.preferences },
    ctx
  );
  const studyDates = Array.isArray(schedule.studyDates) ? schedule.studyDates : [];
  const chunks = Array.isArray(schedule.chunks) ? schedule.chunks : [];
  if (!chunks.length || !studyDates.length) {
    throw new GenerationError(
      ctx.tt("所选日期内没有可用的学习日，请调整日期或每日安排。", "No study days fall in the selected range. Adjust the dates or daily availability."),
      "INVALID_DATE_RANGE"
    );
  }

  ctx.onStatus?.(
    ctx.tt(`共 ${studyDates.length} 天，分 ${chunks.length} 段编排每日任务…`, `${studyDates.length} days in ${chunks.length} segments…`)
  );

  const covered: string[] = [];
  let finished = 0;
  const requestChunk = (dates: string[], withPhases: boolean) =>
    callAi<{ phases: any[]; tasks: any[] }>(
      "/ai/plan-chunk",
      {
        preferences: payload.preferences,
        topics: payload.topics,
        materials: payload.materials,
        dates,
        includePhases: withPhases,
        coveredTopicTitles: covered.slice(-40),
      },
      ctx
    );

  const chunkResults = await mapLimit(chunks, CONCURRENCY, async (chunk, index) => {
    let res: { phases: any[]; tasks: any[] };
    try {
      res = await requestChunk(chunk.dates, index === 0);
    } catch (error) {
      const code = (error as GenerationError)?.code;
      // 输出长度上限 / 时间预算到顶：原样重试只会再撞一次，改成逐日要；仍空就如实抛出
      if (!code || !SPLITTABLE_CODES.has(code) || chunk.dates.length < 2) throw error;
      ctx.onStatus?.(ctx.tt("这一段太大了，逐日编排…", "Segment too large, scheduling day by day…"));
      const singles = await mapLimit(chunk.dates, 2, (date, dayIndex) =>
        requestChunk([date], index === 0 && dayIndex === 0).catch(() => ({ phases: [], tasks: [] }))
      );
      res = {
        phases: singles.flatMap((one) => one?.phases || []),
        tasks: singles.flatMap((one) => one?.tasks || []),
      };
      if (!res.tasks.length) throw error;
    }
    (res.tasks || []).forEach((task: any) => {
      const title = typeof task?.topicTitle === "string" ? task.topicTitle : "";
      if (title && !covered.includes(title)) covered.push(title);
    });
    finished += 1;
    ctx.onStatus?.(ctx.tt(`已编排 ${finished}/${chunks.length} 段`, `Scheduled ${finished}/${chunks.length} segments`));
    return res;
  });

  let phases: any[] = [];
  let tasks: any[] = [];
  chunkResults.forEach((res) => {
    tasks.push(...(res?.tasks || []));
    if (!phases.length && Array.isArray(res?.phases) && res.phases.length) phases = res.phases;
  });

  // 模型偶尔会跳过某几天：单独补一轮，避免日历上出现无说明的空白天
  const scheduled = new Set(tasks.map((task: any) => task?.date));
  const missing = studyDates.filter((date) => !scheduled.has(date));
  if (missing.length > 0 && missing.length < studyDates.length) {
    ctx.onStatus?.(ctx.tt(`补齐 ${missing.length} 个空缺日期…`, `Filling ${missing.length} missing days…`));
    const groups: string[][] = [];
    for (let i = 0; i < missing.length; i += 2) groups.push(missing.slice(i, i + 2));
    const repairs = await mapLimit(groups.slice(0, 10), CONCURRENCY, (group) =>
      callAi<{ tasks: any[] }>("/ai/plan-chunk", {
        preferences: payload.preferences,
        topics: payload.topics,
        materials: payload.materials,
        dates: group,
        includePhases: false,
        coveredTopicTitles: covered.slice(-40),
      }, ctx).catch(() => null)
    );
    repairs.forEach((res) => {
      if (res?.tasks) tasks.push(...res.tasks);
    });
  }

  tasks = attachTaskTopicIds(dedupeTasks(tasks), payload.topics);
  if (!tasks.length) {
    throw new GenerationError(
      ctx.tt("AI 没有返回可用的每日任务，请检查资料内容后重试。", "AI returned no usable daily tasks. Check your materials and try again."),
      "PLAN_EMPTY"
    );
  }

  const coveredDays = new Set(tasks.map((task: any) => task.date)).size;
  return {
    result: {
      phases,
      tasks,
      totalPlannedHours: Math.round(tasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60),
    },
    meta: { source: "ai" as const, coveredDays, planningDays: studyDates.length },
  };
}

/* ---------------- 重排：单次调用，函数内已含本地兜底 ---------------- */

async function generateRebalance(payload: Record<string, unknown>, ctx: CallContext) {
  ctx.onStatus?.(ctx.tt("重新分配未完成任务…", "Rescheduling open tasks…"));
  const res = await callAi<{ result: any; meta?: AiResponseMeta }>(
    "/ai/rebalance",
    { currentPlan: payload.currentPlan, currentDate: payload.currentDate, reason: payload.reason },
    ctx
  );
  if (!res?.result || !Array.isArray(res.result.tasks)) {
    throw new GenerationError(
      ctx.tt("AI 未返回有效排程，请重试。", "AI returned no usable schedule. Please try again."),
      "ai_bad_output"
    );
  }
  return { result: res.result, meta: res.meta };
}

/**
 * 规划生成入口：三种模式都走「小步同步调用 + 浏览器并发编排」，
 * 函数不保存任何会话状态，所有上下文由本浏览器持有（本地优先）。
 */
export async function runGeneration<T = any>(
  mode: GenerationMode,
  payload: Record<string, unknown>,
  opts: RunGenerationOptions
): Promise<{ result: T; meta?: AiResponseMeta }> {
  const isZh = opts.language !== "en";
  const tt = (zh: string, en: string) => (isZh ? zh : en);
  const { signal, abort } = linkSignal(opts.signal);
  // 长计划由多段小调用拼成：给整体留足时间，单段仍受函数内 48 秒预算约束
  const deadlineMs =
    opts.deadlineMs ?? (mode === "plan" ? 900_000 : mode === "syllabus" || mode === "textbook-topics" ? 420_000 : 90_000);
  const ctx: CallContext = {
    lang: isZh ? "zh" : "en",
    tt,
    deadlineAt: Date.now() + deadlineMs,
    signal,
    onStatus: opts.onStatus,
  };

  try {
    if (mode === "syllabus") return (await generateSyllabus(payload, ctx)) as unknown as { result: T; meta?: AiResponseMeta };
    if (mode === "textbook-toc") return (await generateTextbookToc(payload, ctx)) as unknown as { result: T; meta?: AiResponseMeta };
    if (mode === "textbook-topics") return (await generateTextbookTopics(payload, ctx)) as unknown as { result: T; meta?: AiResponseMeta };
    if (mode === "plan") return (await generatePlan(payload, ctx)) as unknown as { result: T; meta?: AiResponseMeta };
    return (await generateRebalance(payload, ctx)) as unknown as { result: T; meta?: AiResponseMeta };
  } catch (error: any) {
    if (error?.name === "AbortError") throw abortError(ctx);
    throw error;
  } finally {
    abort();
  }
}
