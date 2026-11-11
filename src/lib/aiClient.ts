import { StudyMaterial, TextbookChapter, TextbookOutline } from "../types";
import { attachTaskTopicIds } from "./links";
import { appendClause, docxUnreadable, formatBookTitle, textbookNameLabel, textbookProgress } from "./text";
import { scannedPdfNotice, supportedFormatList } from "./documentParser";

// 资料库容量和单次生成用量是两件事：库里能存 100 份，一次生成只吃 20 份。
// 20 这个数字来自提示词预算（每份均分 45,000 字），再多后面的资料就到不了模型面前。
export const MAX_AI_MATERIALS = 20;
export const MAX_LIBRARY_MATERIALS = 100;
// 单次 AI 调用只需要片段文本：本地阅读器仍保留完整原文
export const MAX_AI_CHARS_PER_MATERIAL = 60_000;

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
 * 资料库存满了 / 这次只收得下前几份：两句话各有一份，向导和科目页共用。
 * 以前四处在各自拼，写出过「请先删除部分文件」「请先删除一些」和英文
 * "Remove some files" / "were kept" / "were processed"——同一个上限三种说法。
 */
export function libraryFullNotice(isZh: boolean): string {
  return isZh
    ? `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，请先删除一部分。`
    : `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Delete some first.`;
}

export function libraryOverflowNotice(kept: number, isZh: boolean): string {
  return isZh
    ? `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，本次只收下 ${kept} 份。`
    : `The library holds up to ${MAX_LIBRARY_MATERIALS} materials, so only the first ${kept} files were kept.`;
}

/**
 * 一次生成用多少份资料，这句话只在这里拼。
 * 带份数的是本地闸门（用户勾了 21 份，要说清是哪 21 份被挡）；
 * 不带份数的是错误码表（服务端 planner 也可能发同一个码，那时它说不出用户勾了几份）。
 * 两种说法共用「上限 + 动作」这半句，改上限时只改 MAX_AI_MATERIALS 一处。
 */
export function tooManyMaterialsNotice(picked: number, isZh: boolean): string {
  const limit = isZh
    ? `一次生成最多用 ${MAX_AI_MATERIALS} 份资料`
    : `One run uses at most ${MAX_AI_MATERIALS} materials`;
  const action = isZh ? "请取消勾选一部分。" : "Uncheck some and try again.";
  return picked > MAX_AI_MATERIALS ? `${limit}，本次勾选了 ${picked} 份，${action}` : `${limit}，${action}`;
}

/**
 * 只把勾选的资料交给 AI。超出单次上限就明确报错，绝不替用户悄悄丢掉后面的资料——
 * 选哪几份是用户在列表里勾的，这里只负责忠实执行。
 */
export function prepareMaterialsForAI(materials?: StudyMaterial[], selectedIds?: string[], isZh = true) {
  const list = materials || [];
  const picked = selectedIds ? list.filter((material) => selectedIds.includes(material.id)) : list;
  if (picked.length > MAX_AI_MATERIALS) {
    throw new GenerationError(tooManyMaterialsNotice(picked.length, isZh), "TOO_MANY_MATERIALS");
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
  const isZh = language !== "en";
  /* 三种回退原因共用同一个尾巴（数据还在本机），尾巴只写一份，接缝交给 appendClause。
     不称呼「你」/「your」：这是一条状态读数，不是客服问候。 */
  const tail = isZh ? "数据和已完成的任务仍保存在本机" : "data and completed tasks stay on this device";
  const head =
    meta.fallbackReason === "no_api_key"
      ? isZh
        ? "AI 服务未启用，已按本地规则重新分配任务"
        : "AI is not enabled, so tasks were rescheduled with local rules"
      : meta.fallbackReason === "too_many_tasks"
        ? isZh
          ? "待办任务较多，已按本地规则均匀重排"
          : "There are many open tasks, so they were redistributed with local rules"
        : isZh
          ? "AI 服务暂时不可用，已按本地规则重新分配任务"
          : "AI is temporarily unavailable, so tasks were rescheduled with local rules";
  return appendClause(head, tail, isZh);
}

/* 重排这条路自己也有本地回退：AI 没跑成时，浏览器里的排程规则接管。
   上面那份 getAiFallbackNotice 是服务端自己说「我回退了」，这一份是前端调用失败后说的，
   两条路都在文案里留下「按什么重排」这个事实，措辞同一族（「本地规则」），不另起名字。
   原因由调用处传进来，句尾标点由这里统一收，避免出现「…不可用。；已按…」这种接缝。 */
export function localRebalanceNotice(reason: string | undefined, isZh: boolean): string {
  const tail = isZh ? "已按本地规则重排" : "local rules rebalanced the tasks instead";
  const joined = appendClause(reason || "", tail, isZh);
  // 没有前半句时它就是整句，英文首字母得大写
  return reason || isZh ? joined : joined.charAt(0).toUpperCase() + joined.slice(1);
}

/* 「AI 没启用」过去在两个错误码里各写了一句：一句让人「检查站点的 AI 状态」，
   一句让人「在站点设置中填写 AI 服务密钥」。应用里没有这两个入口，指的都是用户看不见的后台，
   照着做也找不到那一栏。同一个处境只留一句事实，不给不存在的动作；
   「资料还在本机」这半句由调用处按场景补（appendClause），不在这里写死。 */
const AI_NOT_ENABLED = {
  zh: "AI 服务未启用，暂时无法自动生成。",
  en: "AI is not enabled, so this can't be generated yet.",
};

/* 同一句话在码表里出现过三四回（限流三个码、页面过期三个码、AI 不可用两个码）。
   码是协议，句子是文案：码可以有很多个，说法只留一份，改一处就全站一起改。 */
const RATE_LIMIT = {
  zh: "请求太频繁，请稍后重试。",
  en: "Too many requests. Try again in a moment.",
};
const STALE_PAGE = {
  zh: "页面数据已过期，请刷新后重试。",
  en: "This page is out of date. Reload it and try again.",
};
const AI_DOWN = {
  zh: "AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。",
  en: "AI is temporarily unavailable. Try again in a moment. Uploaded materials stay unchanged.",
};

/* 提示文案的规矩，这一张表按它写，dev/copy-guard.test.ts 把它钉住：
   1) 先说事实（发生了什么，带具体数字），再说下一步——只给一个动作，而且给的是界面上真的有的那个。
   2) 中文用「请」，英文用祈使句；两边都不称呼用户（「您」），英文也不写 "Please"。
   3) 状态和错误不用感叹号。
   4) 重试建议只有两种：等一会儿有用的写「请稍后重试 / Try again in a moment」，
      立刻可以再试的写「请重试 / Try again」。旧表里「请稍后再试」「请重试」「请刷新页面后重试」混着来。
   5) 用户看不见的内部名词不进文案：plans、JSON 请求、接口、API Key、模板回退，也不写厂商名。
      「DeepSeek API Key」改成「AI 服务密钥」：填密钥的人不需要在提示里看到供应商叫什么。 */
/* 一个错误码只对应一句话，这张表是唯一的说法来源。函数那边（functions/*.ts）是独立模块，
   引不到这里，只能照抄同一句；抄没抄对由 test:copy 逐条比对，别在两边各写各的。 */
export const ERROR_MESSAGES: Record<string, { zh: string; en: string }> = {
  RATE_LIMITED: RATE_LIMIT,
  /* 这里原来挂着 PAYLOAD_TOO_LARGE / FILE_TOO_LARGE 两条，写着「16 MB」「10 MB」。
     两条都没有产生者：函数闸门发的是小写 body_too_large（下面有），单份体积由
     documentParser 在本地拦、自己报数。留着等于让同一个上限在文案里还有第二份字面量，
     改上限时必然漏掉一处，所以删掉。
     TOO_MANY_MATERIALS 留下，但句子由 tooManyMaterialsNotice() 算出：
     本地闸门和服务端 planner 发的是同一个码，码表里再手写一份「20 份」就是第二个数字来源。 */
  TOO_MANY_MATERIALS: {
    zh: tooManyMaterialsNotice(0, true),
    en: tooManyMaterialsNotice(0, false),
  },
  UNSUPPORTED_FORMAT: {
    zh: `这种格式读不了，支持的是 ${supportedFormatList(true)}。`,
    en: `This format can't be read. Supported formats: ${supportedFormatList(false)}.`,
  },
  // 旧版 Word（.doc）现在能本地直接读，剩下只有旧版 PowerPoint 还得让用户另存一次。
  LEGACY_OFFICE_UNSUPPORTED: {
    zh: "旧版 .ppt 读不出文字，请另存为 .pptx 或 PDF 后再上传。",
    en: "Legacy .ppt files can't be read. Save it as .pptx or PDF, then upload.",
  },
  SCANNED_PDF_AI_REQUIRED: {
    zh: scannedPdfNotice(true, true),
    en: scannedPdfNotice(false, true),
  },
  AI_PARSE_FAILED: {
    zh: "文字识别失败，请稍后重试。",
    en: "Text recognition failed. Try again in a moment.",
  },
  AI_UNAVAILABLE: AI_DOWN,
  AI_NOT_CONFIGURED: AI_NOT_ENABLED,
  MISSING_MATERIALS: {
    zh: "还没有资料。请先上传一份资料。",
    en: "No materials yet. Upload one first.",
  },
  EMPTY_MATERIALS: {
    zh: "这些资料里没有可读的文字，请重新上传带文字的文件。",
    en: "These materials contain no readable text. Upload a file with text.",
  },
  SYLLABUS_EMPTY: {
    zh: "AI 没有从这些资料里识别出考点，请补充更完整的考纲、讲义或真题后重试。",
    en: "AI found no topics in these materials. Add a fuller syllabus, notes, or past paper and try again.",
  },
  SYLLABUS_EXTRACTION_FAILED: {
    zh: "考点提取失败，请稍后重试。",
    en: "Topic extraction failed. Try again in a moment.",
  },
  /* 教材那两步和「资料提炼」失败的是同一类事，但要教的动作不一样：
     一个要改教材名，一个要少勾几章。原来它们共用 SYLLABUS_EMPTY，
     于是同一个码在两处印出两句话——现在各给一个码，一码一句。 */
  TEXTBOOK_TOC_EMPTY: {
    zh: "AI 没能整理出这本教材的目录，请换成教材全称（含版次）后重试。",
    en: "AI couldn't outline this textbook. Try the full title, including the edition.",
  },
  TEXTBOOK_TOPICS_EMPTY: {
    zh: "AI 没能把这些章节展开成考点，请少勾几章后重试。",
    en: "AI couldn't expand these chapters into topics. Select fewer chapters and try again.",
  },
  PLAN_EMPTY: {
    zh: "AI 没有返回可用的每日任务，请检查资料内容后重试。",
    en: "AI returned no usable daily tasks. Check the materials and try again.",
  },
  PLAN_GENERATION_FAILED: {
    zh: "学习计划生成失败，请稍后重试。",
    en: "Plan generation failed. Try again in a moment.",
  },
  PLAN_CHUNK_EMPTY: {
    zh: "有几天没排上任务，请减少这几天的资料量后重试。",
    en: "Some days got no tasks. Use fewer materials for those days and try again.",
  },
  INVALID_START_DATE: {
    zh: "开始日期无效，请重新选择。",
    en: "The start date is invalid. Pick it again.",
  },
  INVALID_EXAM_DATE: {
    zh: "考试日期无效，请重新选择。",
    en: "The exam date is invalid. Pick it again.",
  },
  INVALID_DATE_RANGE: {
    zh: "考试日期不能早于开始复习日期。",
    en: "The exam date can't be earlier than the start date.",
  },
  /* 服务端 planner 对这个情形也发 INVALID_DATE_RANGE，但那句话是「考试日期不能早于开始日期」，
     这里说的是「这段区间里没有一天被排成学习日」——两件事共用一个码，就会共用一句错的解释。
     各给一个码，一码一句。 */
  NO_STUDY_DAYS: {
    zh: "所选日期里没有可用的学习日，请调整每日安排后重试。",
    en: "No study days fall in the selected range. Adjust the daily plan and try again.",
  },
  PARSE_FAILED: {
    zh: "文档解析失败，请重试。",
    en: "Document parsing failed. Try again.",
  },
  EMPTY_DOCUMENT: {
    zh: "这个文件里没有可读的文字。",
    en: "This file contains no readable text.",
  },
  DOCX_PARSE_FAILED: {
    zh: docxUnreadable(true),
    en: docxUnreadable(false),
  },
  PPTX_NO_TEXT: {
    zh: "这份 PPTX 里没有文字（可能全是图片），请导出为 PDF 后上传。",
    en: "This PPTX has no text (it may be all images). Export it as PDF, then upload.",
  },
  MISSING_FILE_DATA: {
    zh: "没有收到文件内容，请重新选择文件。",
    en: "The file arrived empty. Select it again.",
  },
  INVALID_JSON: STALE_PAGE,
  ai_not_configured: AI_NOT_ENABLED,
  ai_unavailable: AI_DOWN,
  ai_bad_output: {
    zh: "AI 返回的内容不可用，请重试。",
    en: "AI returned unusable output. Try again.",
  },
  ai_rate_limited: RATE_LIMIT,
  ai_access_denied: {
    zh: "AI 服务密钥无效，暂时无法自动生成。",
    en: "The AI service key was rejected, so this can't be generated yet.",
  },
  ai_out_of_credits: {
    zh: "AI 服务余额不足，暂时无法自动生成。",
    en: "The AI service has no balance left, so this can't be generated yet.",
  },
  ai_request_rejected: {
    zh: "AI 服务拒绝了这次请求，请减少资料量后重试。",
    en: "AI rejected this request. Use fewer materials and try again.",
  },
  AI_EMPTY: {
    zh: "AI 本次没有返回内容，请重试。",
    en: "AI returned nothing this time. Try again.",
  },
  AI_TIMEOUT: {
    zh: "生成超时，请减少资料量后重试。",
    en: "Generation timed out. Use fewer materials and try again.",
  },
  ai_timeout: {
    zh: "这一段生成太慢，已自动拆成更小的批次重试。",
    en: "That segment was too slow, so it's being retried in smaller batches.",
  },
  ai_output_capped: {
    zh: "AI 单次输出到了上限，已自动改为逐日生成。",
    en: "AI hit its output limit, so the days are being generated one by one.",
  },
  invalid_request: STALE_PAGE,
  // 下面是函数闸门（functions/requestGuard.ts）的拒绝码。
  body_too_large: {
    zh: "这次提交的内容超过服务上限，请减少资料量后重试。",
    en: "This request is over the service limit. Use fewer materials and try again.",
  },
  body_timeout: {
    zh: "上传太慢，请减少资料量后重试。",
    en: "The upload was too slow. Use fewer materials and try again.",
  },
  bad_body: STALE_PAGE,
  unsupported_media_type: {
    zh: "这次提交的内容类型不对，请刷新后重试。",
    en: "This request was sent in the wrong form. Reload the page and try again.",
  },
  cross_origin: {
    zh: "这个页面不在本站内，请从本站地址重新打开。",
    en: "This page is outside the site. Open it again from the site address.",
  },
  rate_limited: RATE_LIMIT,
  // 与 rate_limited 分开：那是等几分钟，重试有意义；这是等明天，重试只是耗时间。
  daily_quota_reached: {
    zh: "今天的调用次数已用完，请明天再试。",
    en: "Today's quota is used up. Try again tomorrow.",
  },
  internal_error: {
    zh: "服务暂时不可用，请稍后重试。",
    en: "The service is temporarily unavailable. Try again in a moment.",
  },
  // 路由没命中（旧标签页还在打已改名的地址）。服务端那句是兜底，说法以这里为准。
  not_found: {
    zh: "这个功能暂时不可用，请刷新后重试。",
    en: "This feature is unavailable. Reload the page and try again.",
  },
  // 打到了只收 POST 的地址，对用户和「路由没命中」是同一件事，共用一句话。
  method_not_allowed: {
    zh: "这个功能暂时不可用，请刷新后重试。",
    en: "This feature is unavailable. Reload the page and try again.",
  },
  /* 下面几条原来只在服务端有句子，前端码表里没有，于是同一个处境走哪条路就印哪句话。
     码表是唯一的说法来源，服务端只许照抄（由 test:copy 钉住）。 */
  TEXTBOOK_NAME_MISSING: {
    zh: `还没有${textbookNameLabel(true)}，请填写教材全称（含版次）。`,
    en: `No ${textbookNameLabel(false).toLowerCase()} yet. Enter the full title, including the edition.`,
  },
  MISSING_PLAN: {
    zh: "没有收到要重排的计划，请刷新后重试。",
    en: "No plan came through for rebalancing. Reload the page and try again.",
  },
  MISSING_TASKS: {
    zh: "这个科目的任务列表读不出来，请刷新后重试。",
    en: "This subject's task list can't be read. Reload the page and try again.",
  },
  TOO_MANY_TASKS: {
    zh: "这个科目的任务超过重排上限，请缩短复习区间后重新生成计划。",
    en: "This subject has more tasks than rebalancing can handle. Shorten the study range and generate the plan again.",
  },
  ai_output_too_large: {
    zh: "AI 返回的内容超过长度上限，请减少资料量后重试。",
    en: "AI returned more text than the limit allows. Use fewer materials and try again.",
  },
};

export function localizeApiError(
  code: string | undefined,
  language: string,
  serverMessage?: string
): string {
  const entry = code ? ERROR_MESSAGES[code] : undefined;
  if (entry) return language === "zh" ? entry.zh : entry.en;
  /* 码表里没有的码：状态码是排查用的内部读数，不摊给用户，只说事实和一个动作。 */
  if (language === "zh") return serverMessage || "这次请求没有成功，请刷新后重试。";
  return "This request did not go through. Reload the page and try again.";
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
    message: localizeApiError(code, language, serverMessage),
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
      throw new GenerationError(localizeApiError("AI_TIMEOUT", ctx.lang), "AI_TIMEOUT");
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
        ctx.tt("无法连接 AI 服务，请检查网络后重试。", "Could not reach the AI service. Check the connection and try again."),
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
      throw new GenerationError(localizeApiError(code, ctx.lang, data?.error), code);
    }

    return data as T;
  }

  throw new GenerationError(
    ctx.tt("无法连接 AI 服务，请检查网络后重试。", "Could not reach the AI service. Check the connection and try again."),
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
    // 认不出单元和展不开考点是同一个故障的两个阶段，错误码也同为 SYLLABUS_EMPTY，
    // 就不该有两句话：一个码一句话，用户看到的说法才不会随哪条路失败而变。
    throw new GenerationError(localizeApiError("SYLLABUS_EMPTY", ctx.lang), "SYLLABUS_EMPTY");
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
    throw new GenerationError(localizeApiError("SYLLABUS_EMPTY", ctx.lang), "SYLLABUS_EMPTY");
  }
  return { result: { summary: unitsRes.summary || "", topics: clean }, meta: { source: "ai" as const } };
}

/* ---------------- 教材目录：先给章节，勾选后再展开成考点 ---------------- */

async function generateTextbookToc(payload: Record<string, unknown>, ctx: CallContext) {
  ctx.onStatus?.(textbookProgress(ctx.lang === "zh"));
  const res = await callAi<TextbookOutline>(
    "/ai/textbook-toc",
    { textbook: payload.textbook, examName: payload.examName, subject: payload.subject },
    ctx
  );
  const chapters = Array.isArray(res?.chapters) ? res.chapters : [];
  if (!chapters.length) {
    throw new GenerationError(localizeApiError("TEXTBOOK_TOC_EMPTY", ctx.lang), "TEXTBOOK_TOC_EMPTY");
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
    throw new GenerationError(localizeApiError("TEXTBOOK_TOPICS_EMPTY", ctx.lang), "TEXTBOOK_TOPICS_EMPTY");
  }
  const summary = textbook
    ? ctx.tt(`按${formatBookTitle(textbook)}的 ${clean.length} 个章节整理`, `From ${clean.length} chapters of "${textbook}"`)
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
    throw new GenerationError(localizeApiError("NO_STUDY_DAYS", ctx.lang), "NO_STUDY_DAYS");
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
      ctx.tt("AI 没有返回可用的每日任务，请检查资料内容后重试。", "AI returned no usable daily tasks. Check the materials and try again."),
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
    throw new GenerationError(localizeApiError("ai_bad_output", ctx.lang), "ai_bad_output");
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
