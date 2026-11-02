// ========================================
// Exam Plan AI 后端函数（Deno Edge Function）
// 能力（全部同源 /functions/v1/app 下）：
//   GET  /health     AI 是否已配置（站点内置 Qoder AI）
//   POST /ai/start   资料/考点/偏好 -> 启动规划任务，立即返回会话 ID
//   POST /ai/poll    轮询任务，拿到完整 JSON 后归一化返回
// 规划是本地优先、单用户、无持久会话的应用，因此函数保持无状态：
// 浏览器持有会话 ID 与规划上下文（preferences / studyDates），轮询时一并回传。
// PAT、Agent 配置与上游地址只存在于函数内，绝不进入浏览器。
// ========================================

import { MAX_AI_OUTPUT_CHARS, pollQoderGeneration, QcaError, qoderConfigured, startQoderGeneration } from './qca-ai.ts';
import {
  PlannerError,
  buildPlanPrompt,
  buildRebalancePrompt,
  buildSyllabusPrompt,
  clampText,
  extractJson,
  fallbackRebalancePlan,
  parseLocalDate,
  resolveIsChinese,
  sanitizeMaterials,
  sanitizePlanForRebalance,
  sanitizePlanResult,
  sanitizePreferences,
  sanitizeRebalanceResult,
  sanitizeSyllabusResult,
  sanitizeTopics,
  toLocalDateString,
} from './planner.ts';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

// 重排是纯本地的日期再分配，AI 拿不到结果时不该卡住用户；这些错误码一律走本地兜底。
const LOCAL_REBALANCE_FALLBACK_CODES = new Set([
  'ai_not_configured',
  'ai_unavailable',
  'ai_out_of_credits',
  'ai_access_denied',
  'ai_rate_limited',
  'ai_request_rejected',
  'ai_bad_output',
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

// 扁平错误结构 { ok:false, code, error }，与前端 localizeApiError 的读取方式一致。
function fail(code: string, message: string, status = 400): Response {
  return json({ ok: false, code, error: message }, status);
}

async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('body_too_large');
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad_body');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('bad_body');
  }
}

function failFromError(error: unknown, isZh: boolean): Response {
  if (error instanceof PlannerError) return fail(error.code, error.message, error.status);
  if (error instanceof QcaError) return fail(error.code, error.message, error.status);
  return fail(
    'ai_unavailable',
    isZh ? 'AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。' : 'The AI service is temporarily unavailable. Please try again.',
    502
  );
}

/* ---------------- start ---------------- */

async function handleAIStart(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req, 4 * 1024 * 1024);
  } catch (e) {
    return fail('invalid_request', e instanceof Error && e.message === 'body_too_large' ? '提交内容过大，请减少资料数量' : '请求格式错误');
  }

  const mode = String(body.mode || '');
  const language = body.language;
  const isZh = resolveIsChinese(language);

  try {
    if (mode === 'syllabus') {
      const rawMaterials = body.materials;
      if (!Array.isArray(rawMaterials) || rawMaterials.length === 0) {
        return fail('MISSING_MATERIALS', isZh ? '请先上传至少一份课程资料。' : 'Upload at least one course document first.');
      }
      const materials = sanitizeMaterials(rawMaterials);
      if (materials.length === 0) {
        return fail('EMPTY_MATERIALS', isZh ? '资料内容为空，请重新上传。' : 'The materials contain no readable text.');
      }
      const examName = clampText(body.examName, 200);
      const subject = clampText(body.subject, 200);
      const zh = resolveIsChinese(language, examName, subject);
      const prompt = buildSyllabusPrompt(materials, examName, subject, zh);
      const sessionId = await startQoderGeneration(prompt);
      return json({ ok: true, sessionId, mode });
    }

    if (mode === 'plan') {
      const preferences = sanitizePreferences(body.preferences);
      const topics = sanitizeTopics(body.topics);
      const materials = sanitizeMaterials(body.materials || []);
      const zh = resolveIsChinese(preferences.language || language, preferences.examName, preferences.subject);
      const { prompt, studyDates } = buildPlanPrompt(preferences, topics, materials, zh);
      const sessionId = await startQoderGeneration(prompt);
      // studyDates 回传给浏览器，轮询时用于覆盖率统计与任务归一化
      return json({ ok: true, sessionId, mode, studyDates });
    }

    if (mode === 'rebalance') {
      const currentPlan = sanitizePlanForRebalance(body.currentPlan);
      const requestedDate = clampText(body.currentDate, 20);
      const todayStr = requestedDate && !Number.isNaN(parseLocalDate(requestedDate).getTime())
        ? requestedDate
        : toLocalDateString();
      const reason = clampText(body.reason, 500);
      const zh = resolveIsChinese(language, currentPlan.examName, currentPlan.subject);

      // AI 不可用时（未启用 / 额度用尽 / 上游异常）直接返回本地排程兜底，保证重排始终可用（本地优先）。
      if (!qoderConfigured()) {
        const result = fallbackRebalancePlan(currentPlan, todayStr, reason);
        return json({ ok: true, done: true, mode, result, meta: { source: 'fallback', fallbackReason: 'no_api_key' } });
      }

      const prompt = buildRebalancePrompt(currentPlan, todayStr, reason, zh);
      try {
        const sessionId = await startQoderGeneration(prompt);
        return json({ ok: true, sessionId, mode });
      } catch (error) {
        const code = error instanceof QcaError ? error.code : '';
        if (!LOCAL_REBALANCE_FALLBACK_CODES.has(code)) throw error;
        const result = fallbackRebalancePlan(currentPlan, todayStr, reason);
        return json({ ok: true, done: true, mode, result, meta: { source: 'fallback', fallbackReason: 'ai_error' } });
      }
    }

    return fail('invalid_request', isZh ? '未知的规划任务类型。' : 'Unknown planning mode.');
  } catch (error) {
    return failFromError(error, isZh);
  }
}

/* ---------------- poll ---------------- */

async function handleAIPoll(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await readJsonBody(req, 64 * 1024);
  } catch {
    return fail('invalid_request', '请求格式错误');
  }

  const mode = String(body.mode || '');
  const isZh = resolveIsChinese(body.language);

  try {
    const snapshot = await pollQoderGeneration(String(body.sessionId || ''));
    if (!snapshot.messages.length) {
      return json({ ok: true, done: false, statuses: snapshot.statuses, errors: snapshot.errors });
    }

    const output = snapshot.messages[snapshot.messages.length - 1].text;
    if (output.length > MAX_AI_OUTPUT_CHARS) {
      return fail('ai_bad_output', isZh ? 'AI 返回内容过大，请减少资料后重试' : 'AI output was too large. Reduce the materials and try again.', 502);
    }

    let parsed: any;
    try {
      parsed = extractJson(output);
    } catch {
      return fail('ai_bad_output', isZh ? 'AI 返回的格式不正确，请重试' : 'AI returned malformed output. Please try again.', 502);
    }

    if (mode === 'syllabus') {
      const result = sanitizeSyllabusResult(parsed);
      if (!result.topics.length) {
        return fail('SYLLABUS_EMPTY', isZh
          ? 'AI 未能从这些资料中识别出可用考点，请补充更完整的考纲、讲义或真题后重试。'
          : 'AI could not identify usable topics from these materials. Add a fuller syllabus, notes, or past paper and try again.', 502);
      }
      return json({ ok: true, done: true, result, meta: { source: 'ai' } });
    }

    if (mode === 'plan') {
      const preferences = sanitizePreferences(body.preferences);
      const studyDates = Array.isArray(body.studyDates) ? body.studyDates.map((d) => String(d)) : [];
      const result = sanitizePlanResult(parsed, preferences, studyDates);
      if (!result.tasks.length) {
        return fail('PLAN_EMPTY', isZh
          ? 'AI 未能生成可用的每日任务，请检查资料内容后重试。'
          : 'AI did not return any usable daily tasks. Check the materials and try again.', 502);
      }
      return json({ ok: true, done: true, result, meta: result.meta });
    }

    if (mode === 'rebalance') {
      const result = sanitizeRebalanceResult(parsed);
      if (!result.tasks.length) {
        return fail('ai_bad_output', isZh ? 'AI 未返回有效排程，请重试' : 'AI returned no usable schedule. Please try again.', 502);
      }
      return json({ ok: true, done: true, result, meta: { source: 'ai' } });
    }

    return fail('invalid_request', isZh ? '未知的规划任务类型。' : 'Unknown planning mode.');
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
        ai: { provider: 'qoder', configured: qoderConfigured() },
      });
    }

    if (req.method !== 'POST') {
      return fail('method_not_allowed', '仅支持 POST 请求', 405);
    }

    // 网关会重写函数名路径段，因此用 endsWith 匹配子路由。
    if (path.endsWith('/ai/start')) return await handleAIStart(req);
    if (path.endsWith('/ai/poll')) return await handleAIPoll(req);

    return fail('not_found', '接口不存在', 404);
  } catch {
    return fail('internal_error', '服务暂时不可用，请稍后重试', 500);
  }
}