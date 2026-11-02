// ========================================
// DeepSeek 对话补全客户端（只在云函数内运行）
// - API Key 通过应用 Secret 注入：Deno.env.get('DEEPSEEK_API_KEY')
// - Key 绝不进入浏览器代码、提示词、构建产物或日志
// - 单次调用必须在网关 45 秒超时之前返回，因此调用方要把任务切小
// - 上游异常只以稳定错误码 + 中性文案返回，原始异常文本不外泄
// ========================================

const ENDPOINT = 'https://api.deepseek.com/chat/completions';
const API_KEY_ENV = 'DEEPSEEK_API_KEY';
const MODEL_ENV = 'DEEPSEEK_MODEL';

// 模型名会随 DeepSeek 版本调整：逐个候选尝试，遇到「模型不存在」自动换下一个。
const MODEL_CANDIDATES = ['deepseek-flash', 'deepseek-v4-pro', 'deepseek-chat'];

// 网关单请求约 45 秒断开，留出回退与网络余量
const DEFAULT_TIMEOUT_MS = 35_000;
const MAX_REQUEST_BYTES = 240 * 1024;
const MAX_RESPONSE_CHARS = 400_000;
const DEFAULT_MAX_TOKENS = 3_000;
const HARD_MAX_TOKENS = 8_000;

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
  return env(API_KEY_ENV);
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
    return new LlmError('ai_access_denied', 'AI 服务鉴权失败，请检查站点设置中的 API Key。', 502, 'fatal');
  }
  if (status === 402 || code.includes('insufficient') || message.includes('balance')) {
    return new LlmError('ai_out_of_credits', 'DeepSeek 账户余额不足，本次无法生成。请充值后重试。', 402, 'fatal');
  }
  if (status === 429) {
    return new LlmError('ai_rate_limited', 'AI 调用频率过高，请稍后重试。', 429, 'fatal');
  }
  if (status === 404 || code.includes('model_not_found') || message.includes('model')) {
    return new LlmError('ai_unavailable', 'AI 模型暂不可用，正在尝试其他模型。', 502, 'model');
  }
  if (status >= 500) {
    return new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。', 502, 'transport');
  }
  if (status === 400) {
    // 400 常见于参数不被接受（如 max_tokens）：先去掉可选参数再试一次
    return new LlmError('ai_request_rejected', 'AI 服务拒绝了本次请求，请减少资料量后重试。', 400, 'params');
  }
  return new LlmError('ai_request_rejected', 'AI 服务拒绝了本次请求。', 400, 'fatal');
}

async function requestOnce(model: string, prompt: string, opts: CompletionOptions, fullParams: boolean): Promise<string> {
  const timeoutMs = Math.min(40_000, Math.max(5_000, Number(opts.timeoutMs) || DEFAULT_TIMEOUT_MS));
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: 'You are a precise study-plan engine. Follow the user instructions exactly and reply with a single JSON object only.' },
      { role: 'user', content: prompt }
    ],
    stream: false
  };
  if (fullParams) {
    const requested = Number(opts.maxTokens) || DEFAULT_MAX_TOKENS;
    body.max_tokens = Math.min(HARD_MAX_TOKENS, Math.max(256, Math.round(requested)));
    body.temperature = Number.isFinite(opts.temperature) ? Math.min(1, Math.max(0, opts.temperature)) : 0.2;
  }

  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_REQUEST_BYTES) {
    throw new LlmError('invalid_request', '本次提交的内容过大，请减少资料量或分批生成。', 413, 'fatal');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
    return Promise.reject(new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。', 502, 'transport'));
  }
  clearTimeout(timer);

  const raw = await response.text().catch(() => '');
  if (raw.length > MAX_RESPONSE_CHARS) {
    log('exam_plan_llm_response_too_large', { model, stage: opts.stage, chars: raw.length });
    throw new LlmError('ai_bad_output', 'AI 返回内容过大，请减少资料后重试。', 502, 'fatal');
  }

  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = classifyStatus(response.status, payload);
    log('exam_plan_llm_upstream_error', { model, stage: opts.stage, status: response.status, code: error.code, kind: error.kind });
    throw error;
  }

  const choice = (payload as any)?.choices?.[0];
  const text = String(choice?.message?.content ?? '').trim();
  if (!text) {
    log('exam_plan_llm_empty_output', { model, stage: opts.stage, finishReason: String(choice?.finish_reason ?? '') });
    throw new LlmError('AI_EMPTY', 'AI 本次没有返回内容，请重试。', 502, 'model');
  }
  if (choice?.finish_reason === 'length') {
    // 输出被 max_tokens 截断：换下一个模型（上限可能更高）再试
    log('exam_plan_llm_truncated', { model, stage: opts.stage, chars: text.length });
    throw new LlmError('ai_bad_output', 'AI 输出被截断，正在重试。', 502, 'model');
  }
  return text;
}

/** 调用 DeepSeek，返回助手输出的纯文本（由调用方解析 JSON）。 */
export async function completeJson(prompt: string, opts: CompletionOptions = {}): Promise<string> {
  if (!deepseekConfigured()) {
    throw new LlmError('ai_not_configured', 'AI 服务尚未启用，请在站点设置中配置 DeepSeek API Key。', 503, 'fatal');
  }

  const models = modelCandidates();
  let lastError: LlmError | null = null;

  for (const model of models) {
    let simplified = false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await requestOnce(model, prompt, opts, !simplified);
      } catch (error) {
        if (!(error instanceof LlmError)) {
          lastError = new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。', 502, 'transport');
          break;
        }
        lastError = error;
        if (error.kind === 'fatal') throw error;
        if (error.kind === 'params' && !simplified) {
          simplified = true;
          continue;
        }
        // model / params(已简化) / transport：换下一个候选模型
        break;
      }
    }
  }

  log('exam_plan_llm_exhausted', { stage: opts.stage, code: lastError?.code });
  throw lastError || new LlmError('ai_unavailable', 'AI 服务暂时不可用，请稍后重试。', 502, 'fatal');
}
