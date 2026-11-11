// ========================================
// DeepSeek 对话补全客户端（只在云函数内运行）
// - API Key 通过应用 Secret 注入：Deno.env.get('DEEPSEEK_API_KEY') 或 'API_KEY'
// - Key 绝不进入浏览器代码、提示词、构建产物或日志
// - 站点网关在 60 秒断开（实测 504 "upstream request timeout"），所以这里给自己
//   留 48 秒总预算：预算用完就带着结构化错误码返回，绝不把请求拖到网关切断，
//   否则浏览器收到的是一段非 JSON 文本，只能盲目重连同一个大请求。
// - 上游异常只以稳定错误码 + 中性文案返回，原始异常文本不外泄
// ========================================

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
// 站点里实际配的是通用名 API_KEY，两者都认：显式的 DEEPSEEK_API_KEY 优先，
// 换供应商时只要改 Secret 名，不用重新发布函数。
const API_KEY_ENVS = ['DEEPSEEK_API_KEY', 'API_KEY'];
const MODEL_ENV = 'DEEPSEEK_MODEL';

// 模型名会随 DeepSeek 版本调整：逐个候选尝试，遇到「模型不存在」自动换下一个。
// 旧别名 deepseek-chat / deepseek-reasoner 已于 2026-07-24 停用，不再列入候选。
const MODEL_CANDIDATES = ['deepseek-flash', 'deepseek-v4-pro'];

// 网关 60 秒断开，函数侧总预算取 48 秒：留出回退与网络余量
const TOTAL_BUDGET_MS = 48_000;
const MIN_ATTEMPT_MS = 6_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_REQUEST_BYTES = 240 * 1024;
const MAX_RESPONSE_CHARS = 400_000;
const DEFAULT_MAX_TOKENS = 3_000;
const HARD_MAX_TOKENS = 8_000;

interface RequestVariant {
  /** 是否附带 max_tokens / temperature（400 时可以先去掉再试） */
  fullParams: boolean;
  /** 是否显式关闭思考模式（旧模型不认识这个参数时要去掉再试） */
  thinking: boolean;
}

export type LlmFailureKind = 'model' | 'params' | 'transport' | 'fatal';

export class LlmError extends Error {
  code: string;
  status: number;
  kind: LlmFailureKind;

  constructor(code: string, message: string, status = 502, kind: LlmFailureKind = 'fatal') {
    super(message);
    this.name = 'LlmError';
    this.code = code;
    this.status = status;
    this.kind = kind;
  }
}

export function deepseekConfigured(): boolean {
  return apiKey().length > 0;
}

export function modelCandidates(): string[] {
  const override = env(MODEL_ENV);
  const names = override ? [override, ...MODEL_CANDIDATES] : [...MODEL_CANDIDATES];
  return Array.from(new Set(names.filter((name) => /^[A-Za-z0-9._:-]{1,64}$/.test(name))));
}

function env(name: string): string {
  try {
    const deno = (globalThis as any).Deno;
    const value = String(deno?.env?.get(name) ?? '').trim();
    if (value) return value;
    // 本机没有 Deno 时退回 process.env，方便用 tsx 冒烟测试无网络分支
    return String((globalThis as any).process?.env?.[name] ?? '').trim();
  } catch {
    return '';
  }
}

function apiKey(): string {
  for (const name of API_KEY_ENVS) {
    const value = env(name);
    if (value) return value;
  }
  return '';
}

// 只记录安全元数据：事件、状态码、错误码、模型名，不含 Key 与上游正文
function log(event: string, detail: Record<string, unknown>): void {
  try {
    console.error(JSON.stringify({ event, ...detail }));
  } catch {
    // 日志失败不影响请求
  }
}

interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** 排障用：把调用点标记带进日志，不进入响应 */
  stage?: string;
  /** 本次调用允许占用的总时间（含模型回退），默认 48 秒 */
  budgetMs?: number;
  /** 结构化输出默认关闭思考模式；需要推理的调用可以显式打开 */
  thinking?: boolean;
}

function upstreamCode(payload: unknown): string {
  const error = (payload as any)?.error;
  return String(error?.code ?? error?.type ?? '').toLowerCase();
}

function upstreamMessage(payload: unknown): string {
  return String((payload as any)?.error?.message ?? '').toLowerCase();
}

function classifyStatus(status: number, payload: unknown): LlmError {
  const code = upstreamCode(payload);
  const message = upstreamMessage(payload);

  if (status === 401 || status === 403) {
    return new LlmError('ai_access_denied', 'AI 服务密钥无效，暂时无法自动生成。', 502, 'fatal');
  }
  if (status === 402 || code.includes('insufficient') || message.includes('balance')) {
    return new LlmError('ai_out_of_credits', 'AI 服务余额不足，暂时无法自动生成。', 402, 'fatal');
  }
  if (status === 429) {
    return new LlmError('ai_rate_limited', '请求太频繁，请稍后重试。', 429, 'fatal');
  }
  if (status === 404 || code.includes('model_not_found') || message.includes('model')) {
    return new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。', 502, 'model');
  }
  if (status >= 500) {
    return new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。', 502, 'transport');
  }
  if (status === 400) {
    // 400 常见于参数不被接受（如 max_tokens）：先去掉可选参数再试一次
    return new LlmError('ai_request_rejected', 'AI 服务拒绝了这次请求，请减少资料量后重试。', 400, 'params');
  }
  return new LlmError('ai_request_rejected', 'AI 服务拒绝了这次请求，请减少资料量后重试。', 400, 'fatal');
}

async function requestOnce(
  model: string,
  prompt: string,
  opts: CompletionOptions,
  variant: RequestVariant,
  timeoutMs: number
): Promise<string> {
  const deadline = Math.min(40_000, Math.max(5_000, Math.round(timeoutMs)));
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: 'You are a precise study-plan engine. Follow the user instructions exactly and reply with a single JSON object only.' },
      { role: 'user', content: prompt }
    ],
    stream: false
  };
  // 思考模式的思维链会占用输出预算：结构化输出默认显式关闭，
  // 否则同一段 JSON 会被 thinking tokens 挤到 finish_reason='length'。
  if (variant.thinking) body.thinking = { type: 'disabled' };
  if (variant.fullParams) {
    const requested = Number(opts.maxTokens) || DEFAULT_MAX_TOKENS;
    body.max_tokens = Math.min(HARD_MAX_TOKENS, Math.max(256, Math.round(requested)));
    body.temperature = Number.isFinite(opts.temperature) ? Math.min(1, Math.max(0, opts.temperature)) : 0.2;
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_REQUEST_BYTES) {
    throw new LlmError('body_too_large', '这次提交的内容超过服务上限，请减少资料量后重试。', 413, 'fatal');
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadline);
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey()}`
      },
      body: serialized,
      signal: controller.signal,
      redirect: 'manual'
    });
  } catch {
    clearTimeout(timer);
    const timedOut = controller.signal.aborted;
    log('exam_plan_llm_attempt', {
      model,
      stage: opts.stage,
      ms: Date.now() - startedAt,
      ok: false,
      reason: timedOut ? 'client_timeout' : 'fetch_failed',
      deadline,
      variant,
    });
    return Promise.reject(new LlmError(timedOut ? 'ai_timeout' : 'ai_unavailable', timedOut
      ? '这一段生成太慢，已自动拆成更小的批次重试。'
      : 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。', 502, 'transport'));
  }
  clearTimeout(timer);

  const raw = await response.text().catch(() => '');
  if (raw.length > MAX_RESPONSE_CHARS) {
    log('exam_plan_llm_response_too_large', { model, stage: opts.stage, chars: raw.length });
    throw new LlmError('ai_output_too_large', 'AI 返回的内容超过长度上限，请减少资料量后重试。', 502, 'fatal');
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = classifyStatus(response.status, payload);
    log('exam_plan_llm_attempt', {
      model,
      stage: opts.stage,
      ms: Date.now() - startedAt,
      ok: false,
      status: response.status,
      code: error.code,
      kind: error.kind,
      variant,
    });
    throw error;
  }

  const choice = (payload as any)?.choices?.[0];
  const text = String(choice?.message?.content ?? '').trim();
  const finishReason = String(choice?.finish_reason ?? '');
  if (!text) {
    log('exam_plan_llm_attempt', { model, stage: opts.stage, ms: Date.now() - startedAt, ok: false, reason: 'empty_output', finishReason });
    throw new LlmError('AI_EMPTY', 'AI 本次没有返回内容，请重试。', 502, 'model');
  }
  if (finishReason === 'length') {
    // 输出被 max_tokens 截断：这段 JSON 一定解析不出来，换模型只会更慢，
    // 交给调用方把批次切小，所以标记为 budget 而不是 model。
    log('exam_plan_llm_attempt', { model, stage: opts.stage, ms: Date.now() - startedAt, ok: false, reason: 'truncated', chars: text.length });
    throw new LlmError('ai_output_capped', 'AI 单次输出到了上限，已自动改为逐日生成。', 502, 'model');
  }
  log('exam_plan_llm_attempt', { model, stage: opts.stage, ms: Date.now() - startedAt, ok: true, chars: text.length, finishReason });
  return text;
}

/** 调用 DeepSeek，返回助手输出的纯文本（由调用方解析 JSON）。 */
export async function completeJson(prompt: string, opts: CompletionOptions = {}): Promise<string> {
  if (!deepseekConfigured()) {
    throw new LlmError('ai_not_configured', 'AI 服务未启用，暂时无法自动生成。', 503, 'fatal');
  }

  const models = modelCandidates();
  const budgetMs = Math.min(TOTAL_BUDGET_MS, Math.max(5_000, Number(opts.budgetMs) || TOTAL_BUDGET_MS));
  const startedAt = Date.now();
  const remaining = () => budgetMs - (Date.now() - startedAt);
  let lastError: LlmError | null = null;

  for (const model of models) {
    // 变体阶梯：完整参数 + 关闭思考 → 不认识 thinking 就去掉它 → 再退到只发必填参数
    const variants: RequestVariant[] = [
      { fullParams: true, thinking: opts.thinking !== true },
      { fullParams: true, thinking: false },
      { fullParams: false, thinking: false },
    ];
    let switchedModel = false;
    for (const variant of variants) {
      if (remaining() < MIN_ATTEMPT_MS) break;
      try {
        return await requestOnce(
          model,
          prompt,
          opts,
          variant,
          Math.min(Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS, Math.max(5_000, remaining() - 2_000)),
        );
      } catch (error) {
        if (!(error instanceof LlmError)) {
          lastError = new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。', 502, 'transport');
          switchedModel = true;
          break;
        }
        lastError = error;
        if (error.kind === 'fatal') throw error;
        if (error.code === 'ai_output_capped') {
          // 长度上限是模型侧的，换模型只会再等一次超时：直接告诉调用方切小批次
          throw error;
        }
        if (error.kind === 'params') continue;
        switchedModel = true;
        break;
      }
    }
    if (switchedModel && lastError?.kind === 'transport' && remaining() < MIN_ATTEMPT_MS) break;
  }

  const elapsed = Date.now() - startedAt;
  if (elapsed + MIN_ATTEMPT_MS > budgetMs && lastError?.kind !== 'model') {
    log('exam_plan_llm_budget_exceeded', { stage: opts.stage, elapsed, budgetMs, code: lastError?.code });
    throw new LlmError('ai_timeout', '这一段生成太慢，已自动拆成更小的批次重试。', 504, 'fatal');
  }
  log('exam_plan_llm_exhausted', { stage: opts.stage, elapsed, code: lastError?.code });
  throw lastError || new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。已上传的资料不会被改动。', 502, 'fatal');
}
