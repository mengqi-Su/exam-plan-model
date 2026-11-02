import { StudyMaterial } from "../types";

export const MAX_AI_MATERIALS = 20;
export const MAX_AI_CHARS_PER_MATERIAL = 120_000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface AiResponseMeta {
  source?: "ai" | "fallback";
  fallbackReason?: "no_api_key" | "ai_error" | "ai_timeout";
}

export function prepareMaterialsForAI(materials?: StudyMaterial[]) {
  return (materials || []).slice(0, MAX_AI_MATERIALS).map((material) => ({
    id: material.id,
    name: material.name,
    type: material.type,
    content: (material.content || "").slice(0, MAX_AI_CHARS_PER_MATERIAL),
  }));
}

export function getAiFallbackNotice(meta: AiResponseMeta | undefined, language: string): string | null {
  if (meta?.source !== "fallback") return null;
  if (language === "zh") {
    return meta.fallbackReason === "no_api_key"
      ? "未配置 AI 服务，已按本地排程规则重新分配任务。所有数据仍保存在本浏览器中。"
      : "AI 服务暂时不可用，已按本地排程规则重新分配任务。你可以在设置中查看 AI 状态。";
  }
  return meta.fallbackReason === "no_api_key"
    ? "AI is not configured. Tasks were rescheduled with local rules. Your data stays in this browser."
    : "AI is temporarily unavailable. Tasks were rescheduled with local rules. Check AI status in Settings.";
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
    zh: "一次最多上传 20 份资料，请分批处理。",
    en: "Up to 20 materials can be processed at once. Please split the batch.",
  },
  UNSUPPORTED_FORMAT: {
    zh: "不支持此文件格式。请上传 PDF、DOCX、PPTX、TXT、Markdown、CSV 或 JSON。",
    en: "Unsupported file type. Upload PDF, DOCX, PPTX, TXT, Markdown, CSV, or JSON.",
  },
  LEGACY_OFFICE_UNSUPPORTED: {
    zh: "不支持旧版 DOC/PPT 格式，请另存为 DOCX/PPTX 或 PDF 后重试。",
    en: "Legacy DOC/PPT files are not supported. Save as DOCX/PPTX or PDF first.",
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
    zh: "Qoder AI 尚未启用，请稍后再试。",
    en: "Qoder AI is not enabled yet. Please try again later.",
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
    zh: "Qoder AI 授权失败，请稍后再试。",
    en: "Qoder AI authorization failed. Please try again later.",
  },
  AI_EMPTY: {
    zh: "AI 本次没有返回内容，请重试。",
    en: "AI returned no content this time. Please try again.",
  },
  AI_TIMEOUT: {
    zh: "生成超时了，请稍后重试，或减少资料量。",
    en: "Generation timed out. Try again later or reduce the materials.",
  },
  invalid_request: {
    zh: "请求内容格式无效，请刷新页面后重试。",
    en: "Invalid request format. Refresh the page and try again.",
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

/* ---------------- Qoder AI 生成（start / poll 轮询） ---------------- */

export class GenerationError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
  }
}

export type GenerationMode = "syllabus" | "plan" | "rebalance";

export interface RunGenerationOptions {
  language: string;
  signal?: AbortSignal;
  onStatus?: (text: string) => void;
  deadlineMs?: number;
  pollIntervalMs?: number;
}

const FUNCTION_BASE = "/functions/v1/app";
const START_RETRY_DELAYS = [1000, 2500, 5000];

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

async function postJson(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

// 站点网关对单个请求约 45 秒超时，因此生成拆成 start（建会话）+ poll（轮询结果）。
// 浏览器持有会话 ID 与规划上下文；函数无状态。网络抖动 / 发布窗口可自动重连。
export async function runGeneration<T = any>(
  mode: GenerationMode,
  payload: Record<string, unknown>,
  opts: RunGenerationOptions
): Promise<{ result: T; meta?: AiResponseMeta }> {
  const isZh = opts.language !== "en";
  const lang = isZh ? "zh" : "en";
  const tt = (zh: string, en: string) => (isZh ? zh : en);
  const deadlineMs = opts.deadlineMs ?? (mode === "plan" ? 200_000 : 140_000);
  const interval = opts.pollIntervalMs ?? 2500;
  const startedAt = Date.now();
  const aborted = () =>
    new GenerationError(tt("已取消生成。", "Generation cancelled."), "ABORTED");

  const startBody = { ...payload, mode, language: lang };

  let startData: any = null;
  for (let attempt = 0; attempt <= START_RETRY_DELAYS.length; attempt++) {
    if (opts.signal?.aborted) throw aborted();
    let res: Response | null = null;
    let data: any = null;
    try {
      res = await postJson(`${FUNCTION_BASE}/ai/start`, startBody, opts.signal);
      data = await res.json().catch(() => null);
    } catch (e: any) {
      if (e?.name === "AbortError") throw aborted();
      res = null;
      data = null;
    }

    // 网络失败、网关 5xx、部署窗口的 HTML 响应：重试以撑过后端重启
    if (!res || !data || res.status >= 500) {
      if (attempt < START_RETRY_DELAYS.length) {
        opts.onStatus?.(
          tt(`服务正在更新，自动重连中（第 ${attempt + 1} 次）…`, `Reconnecting (attempt ${attempt + 1})…`)
        );
        await sleep(START_RETRY_DELAYS[attempt], opts.signal);
        continue;
      }
      throw new GenerationError(
        tt("无法连接 AI 服务，请检查网络后重试。", "Could not reach the AI service. Check your connection and try again."),
        "ai_unavailable"
      );
    }

    if (!res.ok || data.ok === false) {
      throw new GenerationError(localizeApiError(data?.code, res.status, lang, data?.error), data?.code);
    }
    startData = data;
    break;
  }

  // 立即完成的结果（如 AI 未启用时的本地重排兜底）
  if (startData?.done && startData?.result) {
    return { result: startData.result as T, meta: startData.meta };
  }

  const sessionId = String(startData?.sessionId || "");
  if (!sessionId) {
    throw new GenerationError(
      tt("AI 服务未返回任务，请重试。", "The AI service did not return a task. Try again."),
      "ai_unavailable"
    );
  }

  const pollBody: Record<string, unknown> = { sessionId, mode, language: lang };
  if (mode === "plan") {
    pollBody.preferences = (payload as any).preferences;
    pollBody.studyDates = startData.studyDates || [];
  }

  let netErrors = 0;
  let badOutput = 0;
  let running = false;
  let idle = false;

  while (true) {
    if (opts.signal?.aborted) throw aborted();
    if (Date.now() - startedAt > deadlineMs) {
      throw new GenerationError(
        tt("生成超时了，请稍后重试，或减少资料量。", "Generation timed out. Try again later or reduce the materials."),
        "AI_TIMEOUT"
      );
    }
    await sleep(interval, opts.signal);

    let res: Response | null = null;
    let data: any = null;
    try {
      res = await postJson(`${FUNCTION_BASE}/ai/poll`, pollBody, opts.signal);
      data = await res.json().catch(() => null);
    } catch (e: any) {
      if (e?.name === "AbortError") throw aborted();
      res = null;
      data = null;
    }

    if (!res || !data || res.status >= 500) {
      netErrors++;
      if (netErrors < 20) continue;
      throw new GenerationError(
        tt("网络连接中断，请检查网络后再试。", "Network connection lost. Check your connection and try again."),
        "ai_unavailable"
      );
    }
    netErrors = 0;

    if (!res.ok || data.ok === false) {
      const code = data?.code;
      if (code === "ai_bad_output" && badOutput < 2) {
        badOutput++;
        continue;
      }
      throw new GenerationError(localizeApiError(code, res.status, lang, data?.error), code);
    }

    if (data.done && data.result) {
      return { result: data.result as T, meta: data.meta };
    }

    for (const status of data.statuses || []) {
      if (!status || typeof status.type !== "string") continue;
      if (status.type === "session.status_running") running = true;
      if (status.type === "session.status_idle") idle = true;
    }
    // 新会话可能先发一次 idle，等运行状态出现或过了 8 秒才当成真正的结束
    if (idle && (running || Date.now() - startedAt > 8000)) {
      const hasErrors = Array.isArray(data.errors) && data.errors.length > 0;
      throw new GenerationError(
        hasErrors
          ? tt("AI 本次没有生成内容，请重试。", "AI returned no content this time. Try again.")
          : tt("AI 没有返回内容，请重试。", "AI returned no content. Try again."),
        "AI_EMPTY"
      );
    }
  }
}
