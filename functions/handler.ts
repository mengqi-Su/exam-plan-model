// ========================================
// Exam Plan AI 后端函数（Deno Edge Function）
// 能力（全部同源 /functions/v1/app 下）：
//   GET  /health            AI 服务与 Key 配置状态（DeepSeek）
//   POST /ai/units          资料 -> 核心大单元（小输出）
//   POST /ai/textbook-toc   教材名 -> 章节目录（供用户勾选，凭模型回忆，不接地资料）
//   POST /ai/unit-tree      单个大单元 -> 细分考点树（资料提取 / 教材回忆两套规矩）
//   POST /ai/plan-schedule  偏好 -> 学习日历与分段（纯本地计算，不调模型）
//   POST /ai/plan-chunk     一段日历 -> 该段每日任务（首段附带阶段）
//   POST /ai/rebalance      过期/未完成任务重排（AI 不可用时走本地规则）
// 站点网关对单个请求约 60 秒超时（实测 504 "upstream request timeout"），而 DeepSeek
// 调用是同步的，因此这里不提供 start/poll：每次只让模型输出一小段结构化 JSON，
// 由浏览器并发编排；函数自己的时间预算见 llm.ts 的 TOTAL_BUDGET_MS。
// API Key 只存在于函数环境与请求头，绝不进入浏览器、提示词或日志。
// 每个 POST 先过 requestGuard.ts 这道安检：同源校验、JSON Content-Type、按字节封顶的
// 流式 body、按来源 IP 的令牌桶。/health 例外——它是运维探活和发布后只读核对的入口。
// ========================================

import { completeJson, deepseekConfigured, LlmError } from './llm.ts';
import { asRejection, checkAccess, readJsonBody } from './requestGuard.ts';

import {
  PlannerError,
  buildPlanChunkPrompt,
  buildRebalancePrompt,
  buildStudyCalendar,
  buildTextbookTocPrompt,
  buildTextbookTreePrompt,
  buildUnitTreePrompt,
  buildUnitsPrompt,
  chunkAllMaterials,
  chunkStudyDays,
  clampText,
  enforceRebalanceBudget,
  extractJson,
  fallbackRebalancePlan,
  mergeRebalanceTasks,
  normalizeUnitTopic,
  parseLocalDate,
  resolveIsChinese,
  sanitizeMaterials,
  sanitizePlanChunkResult,
  sanitizePlanForRebalance,
  sanitizePreferences,
  sanitizeRebalanceResult,
  sanitizeTocResult,
  sanitizeUnitsResult,
  selectUnitExcerpts,
  sanitizeTopics,
  studyDatesFromCalendar,
  toLocalDateString,
  type StudyDay,
  type SyllabusUnit,
} from './planner.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

// 单次调用的输出预算：够一小段任务，又不至于撞上 45 秒网关超时
const MAX_LLM_MATERIAL_CHARS = 60_000;
const MAX_LLM_MATERIALS = 20;
const MAX_UNITS = 14;
const MAX_CHUNK_DATES = 4;
const REBALANCE_LLM_TASK_LIMIT = 30;

// 重排是纯本地的日期再分配，AI 拿不到结果时不该卡住用户；这些错误码一律走本地兜底。
const LOCAL_REBALANCE_FALLBACK_CODES = new Set([
  'ai_not_configured',
  'ai_unavailable',
  'ai_out_of_credits',
  'ai_access_denied',
  'ai_rate_limited',
  'ai_request_rejected',
  'ai_bad_output',
  'ai_output_capped',
  'ai_timeout',
  'AI_EMPTY',
]);

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...(headers || {}) } });
}

// 扁平错误结构 { ok:false, code, error }，与前端 localizeApiError 的读取方式一致。
function fail(code: string, message: string, status = 400, headers?: Record<string, string>): Response {
  return json({ ok: false, code, error: message }, status, headers);
}

// 闸门的拒绝原样透传：这些 code 前端有对应文案，中文原文只是兜底。
function reject(error: unknown): Response {
  const rejection = asRejection(error);
  if (!rejection) return fail('internal_error', '服务暂时不可用，请稍后重试。', 500);
  return fail(rejection.code, rejection.message, rejection.status, rejection.headers());
}

/**
 * POST body 的唯一读取口。返回 Response 表示已被闸门拦下（过大 / 不是 JSON / 类型不对），
 * 六个路由不再各写一遍 try/catch，也不再各说各的「请求格式错误」。
 */
async function readBody(req: Request, maxBytes: number): Promise<Record<string, unknown> | Response> {
  try {
    return await readJsonBody(req, maxBytes);
  } catch (error) {
    if (asRejection(error)) return reject(error);
    return fail('invalid_request', '页面数据已过期，请刷新后重试。');
  }
}

// AI 只吃被裁剪过的资料副本；本地阅读器仍持有完整原文
function aiMaterials(raw: unknown) {
  return sanitizeMaterials(raw, MAX_LLM_MATERIALS, MAX_LLM_MATERIAL_CHARS);
}

function parseOutput(text: string, isZh: boolean): any {
  try {
    return extractJson(text);
  } catch {
    throw new PlannerError(
      isZh ? 'AI 返回的内容不可用，请重试。' : 'AI returned unusable output. Try again.',
      502,
      'ai_bad_output'
    );
  }
}

function failFromError(error: unknown, isZh: boolean): Response {
  if (error instanceof PlannerError) return fail(error.code, error.message, error.status);
  if (error instanceof LlmError) return fail(error.code, error.message, error.status);
  return fail(
    'ai_unavailable',
    isZh ? 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。' : 'AI is temporarily unavailable. Try again in a moment. Uploaded materials stay unchanged.',
    502
  );
}

/* ---------------- 考点提取 ---------------- */

async function handleUnits(req: Request): Promise<Response> {
  const parsed = await readBody(req, 8 * 1024 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const materials = aiMaterials(body.materials);
    if (materials.length === 0) {
      return fail('EMPTY_MATERIALS', isZh ? '这些资料里没有可读的文字，请重新上传带文字的文件。' : 'These materials contain no readable text. Upload a file with text.');
    }
    const examName = clampText(body.examName, 200);
    const subject = clampText(body.subject, 200);
    const zh = resolveIsChinese(body.language, examName, subject);
    const prompt = buildUnitsPrompt(materials, examName, subject, zh);
    const output = await completeJson(prompt, { stage: 'units', maxTokens: 1_600, temperature: 0.2 });
    const { summary, units } = sanitizeUnitsResult(parseOutput(output, isZh));
    if (!units.length) {
      return fail('SYLLABUS_EMPTY', isZh
        ? 'AI 没有从这些资料里识别出考点，请补充更完整的考纲、讲义或真题后重试。'
        : 'AI found no topics in these materials. Add a fuller syllabus, notes, or past paper and try again.', 502);
    }
    // 预先为每个单元挑好原文片段：展开考点时只回传这几 KB，不必重复上传整份资料
    const allChunks = chunkAllMaterials(materials);
    const limited = units.slice(0, MAX_UNITS);
    const withExcerpts = limited.map((unit, index) => ({ ...unit, unitIndex: index, excerpts: selectUnitExcerpts(unit, allChunks) }));
    return json({ ok: true, summary, units: withExcerpts, unitCount: withExcerpts.length });
  } catch (error) {
    return failFromError(error, isZh);
  }
}

async function handleUnitTree(req: Request): Promise<Response> {
  const parsed = await readBody(req, 8 * 1024 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const rawUnit = body.unit;
    const unitId = clampText((rawUnit as any)?.id, 120);
    const title = clampText((rawUnit as any)?.title, 300);
    if (!title) return fail('invalid_request', isZh ? '页面数据已过期，请刷新后重试。' : 'This page is out of date. Reload it and try again.');
    // 教材目录来的章节没有原文片段可接地，走另一套回忆规矩；输出形状与资料提取完全一致。
    const source = clampText((rawUnit as any)?.source, 20) === 'textbook' ? 'textbook' : 'material';
    const textbook = clampText(body.textbook, 200);
    const unit: SyllabusUnit = {
      id: unitId || `unit-${Number(body.unitIndex) + 1 || 1}`,
      title,
      category: clampText((rawUnit as any)?.category, 120),
      description: clampText((rawUnit as any)?.description, 1_000),
      weightPercentage: Math.max(0, Math.min(100, Number((rawUnit as any)?.weightPercentage) || 0)),
      difficulty: ['easy', 'medium', 'hard'].includes(String((rawUnit as any)?.difficulty)) ? String((rawUnit as any).difficulty) : 'medium',
      estimatedHours: Math.max(0, Math.min(120, Number((rawUnit as any)?.estimatedHours) || 0)),
      unitIndex: Math.max(0, Number(body.unitIndex) || 0),
      excerpts: clampText((rawUnit as any)?.excerpts, 14_000),
      source,
      sections: Array.isArray((rawUnit as any)?.sections)
        ? (rawUnit as any).sections.slice(0, 8).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
    };
    const unitsCount = Math.max(1, Number(body.unitsCount) || unit.unitIndex + 1);
    const zh = resolveIsChinese(body.language, unit.title, unit.category);
    const prompt = source === 'textbook'
      ? buildTextbookTreePrompt(unit, textbook, unitsCount, zh)
      : buildUnitTreePrompt(unit, unitsCount, zh);
    const output = await completeJson(prompt, { stage: 'unit-tree', maxTokens: 2_400, temperature: 0.25 });
    const topic = normalizeUnitTopic(unit, parseOutput(output, isZh));
    if (!topic) {
      return fail('ai_bad_output', isZh ? 'AI 返回的内容不可用，请重试。' : 'AI returned unusable output. Try again.', 502);
    }
    return json({ ok: true, topic, unitId: unit.id });
  } catch (error) {
    return failFromError(error, isZh);
  }
}

/* ---------------- 教材目录：只给教材名，回忆章节目录供勾选 ---------------- */

async function handleTextbookToc(req: Request): Promise<Response> {
  const parsed = await readBody(req, 256 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const textbook = clampText(body.textbook, 200);
    if (!textbook) {
      return fail('TEXTBOOK_NAME_MISSING', isZh ? '还没有教材名，请填写教材全称（含版次）。' : 'No textbook name yet. Enter the full title, including the edition.');
    }
    const examName = clampText(body.examName, 200);
    const subject = clampText(body.subject, 200);
    const zh = resolveIsChinese(body.language, textbook, examName, subject);
    const prompt = buildTextbookTocPrompt(textbook, examName, subject, zh);
    const output = await completeJson(prompt, { stage: 'textbook-toc', maxTokens: 2_000, temperature: 0.3 });
    const result = sanitizeTocResult(parseOutput(output, isZh));
    if (!result.chapters.length) {
      return fail('TEXTBOOK_TOC_EMPTY', isZh
        ? 'AI 没能整理出这本教材的目录，请换成教材全称（含版次）后重试。'
        : "AI couldn't outline this textbook. Try the full title, including the edition.", 502);
    }
    return json({ ok: true, ...result, chapterCount: result.chapters.length });
  } catch (error) {
    return failFromError(error, isZh);
  }
}

/* ---------------- 排程 ---------------- */

function calendarFor(preferences: any): { days: StudyDay[]; studyDates: string[]; byDate: Map<string, StudyDay> } {
  const days = buildStudyCalendar(preferences);
  const byDate = new Map(days.map((day) => [day.date, day]));
  return { days, studyDates: studyDatesFromCalendar(days), byDate };
}

async function handlePlanSchedule(req: Request): Promise<Response> {
  const parsed = await readBody(req, 256 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const preferences = sanitizePreferences(body.preferences);
    const { days, studyDates } = calendarFor(preferences);
    if (!days.length) {
      return fail('NO_STUDY_DAYS', isZh ? '所选日期里没有可用的学习日，请调整每日安排后重试。' : 'No study days fall in the selected range. Adjust the daily plan and try again.');
    }
    const chunks = chunkStudyDays(days, {
      // 一天 1~3 个任务，每段最多 2 天：单次输出控制在两千字以内，
      // DeepSeek 才会在网关切断之前写完，也不会撞上输出长度上限。
      maxTasksPerChunk: 4,
      maxDaysPerChunk: 2,
      sessionLengthMinutes: preferences.sessionLengthMinutes,
    });
    return json({ ok: true, studyDates, chunks, totalDays: days.length });
  } catch (error) {
    return failFromError(error, isZh);
  }
}

async function handlePlanChunk(req: Request): Promise<Response> {
  const parsed = await readBody(req, 8 * 1024 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const preferences = sanitizePreferences(body.preferences);
    const topics = sanitizeTopics(body.topics);
    if (!topics.length) {
      return fail('invalid_request', isZh ? '页面数据已过期，请刷新后重试。' : 'This page is out of date. Reload it and try again.');
    }
    const materials = aiMaterials(body.materials || []);
    const requestedDates = Array.isArray(body.dates) ? body.dates.map((d) => clampText(d, 20)).filter(Boolean) : [];
    if (!requestedDates.length) return fail('invalid_request', isZh ? '页面数据已过期，请刷新后重试。' : 'This page is out of date. Reload it and try again.');
    if (requestedDates.length > MAX_CHUNK_DATES) {
      return fail('invalid_request', isZh ? `一次最多排程 ${MAX_CHUNK_DATES} 天，请刷新后重试。` : `At most ${MAX_CHUNK_DATES} days per run. Reload the page and try again.`, 413);
    }

    const { days, byDate, studyDates } = calendarFor(preferences);
    // 只接受日历内真实存在的日期，顺序按日历走
    const chunkDays = studyDates.filter((date) => requestedDates.includes(date)).map((date) => byDate.get(date) as StudyDay);
    if (!chunkDays.length) {
      return fail('NO_STUDY_DAYS', isZh ? '所选日期里没有可用的学习日，请调整每日安排后重试。' : 'No study days fall in the selected range. Adjust the daily plan and try again.');
    }

    const coveredTopicTitles = Array.isArray(body.coveredTopicTitles)
      ? body.coveredTopicTitles.map((t) => clampText(t, 300)).filter(Boolean)
      : [];
    const includePhases = body.includePhases === true;
    const prompt = buildPlanChunkPrompt(preferences, topics, materials, chunkDays, { includePhases, coveredTopicTitles, isZh });
    const output = await completeJson(prompt, {
      stage: includePhases ? 'plan-first-chunk' : 'plan-chunk',
      // 输出被截断会毁掉整段任务：预算按天宽给，同时靠分段控制规模。
      // 思考模式已在 llm.ts 关闭，所以这段预算全部用于正文本身。
      maxTokens: Math.min(6_000, 1_400 + chunkDays.length * 1_100 + (includePhases ? 700 : 0)),
      temperature: 0.3,
    });
    const result = sanitizePlanChunkResult(parseOutput(output, isZh), preferences, chunkDays.map((d) => d.date), {
      hasMaterials: materials.length > 0,
      isZh,
    });
    if (!result.tasks.length) {
      return fail('PLAN_CHUNK_EMPTY', isZh ? '有几天没排上任务，请减少这几天的资料量后重试。' : 'Some days got no tasks. Use fewer materials for those days and try again.', 502);
    }
    return json({
      ok: true,
      phases: includePhases ? result.phases : [],
      tasks: result.tasks,
      dates: chunkDays.map((d) => d.date),
      studyDates,
    });
  } catch (error) {
    return failFromError(error, isZh);
  }
}

/* ---------------- 重排（本地优先） ---------------- */

async function handleRebalance(req: Request): Promise<Response> {
  const parsed = await readBody(req, 4 * 1024 * 1024);
  if (parsed instanceof Response) return parsed;
  const body = parsed;
  const isZh = resolveIsChinese(body.language);

  try {
    const currentPlan = sanitizePlanForRebalance(body.currentPlan);
    const requestedDate = clampText(body.currentDate, 20);
    const todayStr = requestedDate && !Number.isNaN(parseLocalDate(requestedDate).getTime())
      ? requestedDate
      : toLocalDateString();
    const reason = clampText(body.reason, 500);
    const zh = resolveIsChinese(body.language, currentPlan.examName, currentPlan.subject);

    const pendingCount = (currentPlan.tasks || []).filter((task: any) => task?.status !== 'completed').length;

    // AI 未启用 / 待办过多时同步调用装不下：直接用本地排程规则，保证重排始终可用
    if (!deepseekConfigured()) {
      return json({
        ok: true,
        result: fallbackRebalancePlan(currentPlan, todayStr, reason),
        meta: { source: 'fallback', fallbackReason: 'no_api_key' },
      });
    }
    if (pendingCount > REBALANCE_LLM_TASK_LIMIT) {
      return json({
        ok: true,
        result: fallbackRebalancePlan(currentPlan, todayStr, reason),
        meta: { source: 'fallback', fallbackReason: 'too_many_tasks' },
      });
    }

    const prompt = buildRebalancePrompt(currentPlan, todayStr, reason, zh);
    try {
      const output = await completeJson(prompt, { stage: 'rebalance', maxTokens: 3_000, temperature: 0.25 });
      const parsed = parseOutput(output, zh);
      const aiResult = sanitizeRebalanceResult(parsed);
      if (!aiResult.tasks.length) {
        return json({
          ok: true,
          result: fallbackRebalancePlan(currentPlan, todayStr, reason),
          meta: { source: 'fallback', fallbackReason: 'ai_error' },
        });
      }
      return json({
        ok: true,
        result: {
          rebalanceSummary: aiResult.rebalanceSummary,
          // 模型只管「往哪搬」，搬运结果仍要过一遍用户填的时间表：休息日清空、每天不超时
          tasks: enforceRebalanceBudget(mergeRebalanceTasks(currentPlan.tasks, aiResult.tasks), currentPlan, todayStr, { isZh: zh }),
        },
        meta: { source: 'ai' },
      });
    } catch (error) {
      const code = error instanceof LlmError || error instanceof PlannerError ? error.code : '';
      if (!LOCAL_REBALANCE_FALLBACK_CODES.has(code)) throw error;
      return json({
        ok: true,
        result: fallbackRebalancePlan(currentPlan, todayStr, reason),
        meta: { source: 'fallback', fallbackReason: 'ai_error' },
      });
    }
  } catch (error) {
    return failFromError(error, isZh);
  }
}

/* ---------------- 路由 ---------------- */

export async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  try {
    if (req.method === 'GET' && (path === '/' || path.endsWith('/health'))) {
      return json({
        ok: true,
        service: 'exam-plan-ai',
        ai: { provider: 'deepseek', configured: deepseekConfigured() },
      });
    }

    if (req.method !== 'POST') {
      return fail('method_not_allowed', '这个功能暂时不可用，请刷新后重试。', 405);
    }

    // 安检只在这里判一次：来源与频率都不依赖具体路由，
    // 放在路由分发之前，被拒的请求连 body 都不会被读进来。
    checkAccess(req, 'ai');

    // 网关会重写函数名路径段，因此用 endsWith 匹配子路由。
    if (path.endsWith('/ai/units')) return await handleUnits(req);
    if (path.endsWith('/ai/textbook-toc')) return await handleTextbookToc(req);
    if (path.endsWith('/ai/unit-tree')) return await handleUnitTree(req);
    if (path.endsWith('/ai/plan-schedule')) return await handlePlanSchedule(req);
    if (path.endsWith('/ai/plan-chunk')) return await handlePlanChunk(req);
    if (path.endsWith('/ai/rebalance')) return await handleRebalance(req);

    return fail('not_found', '这个功能暂时不可用，请刷新后重试。', 404);
  } catch (error) {
    // 闸门的拒绝带 code 与状态码，原样透传；其余才是真的服务端意外。
    return reject(error);
  }
}
