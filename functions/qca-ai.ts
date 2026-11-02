// 站点内置 Qoder AI：服务端通过 Qoder Cloud Agents 完成考点提取 / 计划生成 / 计划重排。
// 浏览器只提交资料、考点与偏好；PAT、Agent 配置和上游地址都留在函数内，绝不外泄。
// 站点网关对单个 HTTP 请求约 45 秒超时，所以生成拆成两步：
//   startQoderGeneration 建会话并投递提示词，立即返回会话 ID；
//   pollQoderGeneration  浏览器每 2-3 秒拉一次增量结果，直到拿到完整 JSON。
import { CloudAgentsError, createCloudAgentsClient } from './cloud-agents.mjs';

const CLOUD_ORIGIN = 'https://api.qoder.com.cn';
const CONFIG_VERSION = 1;
const SYSTEM_PROMPT =
  '你是一位严谨的学习科学与备考规划专家。请严格依据用户提供的学习资料完成考点提炼、学习计划编排或计划重排，' +
  '只输出一个合法的 JSON 对象，不要输出 Markdown 代码块、解释或任何多余文字。' +
  '所有内容必须扎根于用户资料，禁止编造章节、公式、文档名、引用或考试规则；资料中没有的信息宁可省略也不要虚构。';
const ENV_NAME = 'Exam Plan AI 规划环境';
const AGENT_NAME = 'Exam Plan AI 规划助手';
const SESSION_TITLE = 'Exam Plan AI 规划任务';
const BINDING_TTL_MS = 10 * 60 * 1000;
const MAX_OUTPUT_CHARS = 400_000;

export class QcaError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = 'QcaError';
    this.code = code;
    this.status = status;
  }
}

const cloud = createCloudAgentsClient({ origin: CLOUD_ORIGIN, timeoutMs: 20_000 });

type Binding = {
  agentId: string;
  agentVersion: number;
  environmentId: string;
  model: string;
};

let cachedBinding: { value: Binding; at: number } | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function safeConfigured(): boolean {
  try {
    const token = Deno.env.get('QODER_PAT');
    return typeof token === 'string' && token.trim().length > 0;
  } catch {
    return false;
  }
}

export function qoderConfigured(): boolean {
  return safeConfigured();
}

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function pickModel(models: unknown): string {
  const list = Array.isArray(models) ? models : [];
  const enabled = list.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const model = item as Record<string, unknown>;
    return typeof model.id === 'string' && model.is_enabled !== false && model.enabled !== false;
  }) as Array<Record<string, unknown>>;
  if (!enabled.length) throw new QcaError('ai_unavailable', 'Qoder AI 暂时没有可用模型，请稍后重试', 503);

  // 规划属于结构化生成，优先选择速度更快的模型，保证在网关超时前返回
  const preferred = ['standard', 'fast', 'pro', 'plus', 'ultimate'];
  for (const id of preferred) {
    const hit = enabled.find((model) => model.id === id);
    if (hit) return String(hit.id);
  }

  const ranked = [...enabled].sort((a, b) => {
    const pa = Number(a.price_factor);
    const pb = Number(b.price_factor);
    return (Number.isFinite(pa) ? pa : 2) - (Number.isFinite(pb) ? pb : 2);
  });
  return String(ranked[0].id);
}

function pickResource(resources: unknown): Record<string, unknown> | null {
  if (!Array.isArray(resources) || !resources.length) return null;
  const list = resources.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
  if (!list.length) return null;
  list.sort((a, b) => {
    const ta = String(a.created_at || '');
    const tb = String(b.created_at || '');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  return list[0];
}

function requireResourceId(value: unknown, prefix: string): string {
  if (typeof value !== 'string' || !value.startsWith(prefix)) {
    throw new QcaError('ai_unavailable', 'Qoder AI 初始化失败，请稍后重试', 502);
  }
  return value;
}

async function ensureBinding(): Promise<Binding> {
  if (cachedBinding && Date.now() - cachedBinding.at < BINDING_TTL_MS) return cachedBinding.value;

  const modelList = await cloud.request('/api/v1/cloud/models');
  const model = pickModel((modelList as Record<string, unknown>)?.data);
  const fingerprint = (await digest(JSON.stringify({ version: CONFIG_VERSION, model, system: SYSTEM_PROMPT }))).slice(0, 24);
  const metadata = { app: 'exam-plan-ai', role: 'study-planner', config: fingerprint };

  let environment = pickResource(await cloud.findResources('environments', metadata));
  if (!environment) {
    environment = await cloud.request('/api/v1/cloud/environments', {
      method: 'POST',
      body: {
        name: ENV_NAME,
        config: { type: 'cloud' },
        metadata
      }
    }) as Record<string, unknown>;
  }
  const environmentId = requireResourceId(environment?.id, 'env_');

  let agent = pickResource(await cloud.findResources('agents', metadata));
  if (!agent) {
    try {
      agent = await cloud.request('/api/v1/cloud/agents', {
        method: 'POST',
        body: {
          name: AGENT_NAME,
          model,
          system: SYSTEM_PROMPT,
          metadata
        },
        idempotencyKey: `exam-plan-ai-agent-${fingerprint}`
      }) as Record<string, unknown>;
    } catch (error) {
      if (!(error instanceof CloudAgentsError) || error.code !== 'ai_conflict') throw error;
      agent = pickResource(await cloud.findResources('agents', metadata));
      if (!agent) throw error;
    }
  }
  const agentId = requireResourceId(agent?.id, 'agent_');
  let agentVersion = Number(agent?.version);
  if (!Number.isInteger(agentVersion) || agentVersion < 1) {
    const full = await cloud.request(`/api/v1/cloud/agents/${agentId}`) as Record<string, unknown>;
    agentVersion = Number(full?.version);
  }
  if (!Number.isInteger(agentVersion) || agentVersion < 1) {
    throw new QcaError('ai_unavailable', 'Qoder AI 初始化失败，请稍后重试', 502);
  }

  const binding: Binding = { agentId, agentVersion, environmentId, model };
  cachedBinding = { value: binding, at: Date.now() };
  return binding;
}

async function createSession(binding: Binding): Promise<string> {
  const session = await cloud.request('/api/v1/cloud/sessions', {
    method: 'POST',
    body: {
      agent: {
        type: 'agent',
        id: binding.agentId,
        version: binding.agentVersion
      },
      environment_id: binding.environmentId,
      title: SESSION_TITLE
    }
  }) as Record<string, unknown>;
  return requireResourceId(session?.id, 'sess_');
}

function eventText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  let text = '';
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const item = block as Record<string, unknown>;
    if (item.type === 'text' && typeof item.text === 'string') text += item.text;
  }
  return text;
}

async function readEvents(sessionId: string): Promise<Array<Record<string, unknown>>> {
  const all: Array<Record<string, unknown>> = [];
  const seenPages = new Set<string>();
  let page = '';
  // 只关心最新的事件：按倒序取最近的 1-2 页即可，避免每轮轮询都把整段历史重新拉一遍
  for (let index = 0; index < 2; index++) {
    const suffix = page ? `&page=${encodeURIComponent(page)}` : '';
    const result = await cloud.request(
      `/api/v1/cloud/sessions/${sessionId}/events?order=desc&limit=100${suffix}`
    ) as Record<string, unknown>;
    const data = Array.isArray(result?.data) ? result.data : [];
    for (const item of data) {
      if (item && typeof item === 'object') all.push(item as Record<string, unknown>);
    }
    // 最新一页里已经有 agent.message，说明结果已经产生，不需要再往前翻
    if (index === 0 && all.some((item) => item.type === 'agent.message')) break;
    if (result?.has_more !== true) break;
    const next = typeof result?.next_page === 'string' ? result.next_page : '';
    if (!next || seenPages.has(next)) break;
    seenPages.add(next);
    page = next;
  }
  all.reverse();
  return all;
}

async function readEventsWithRetry(sessionId: string): Promise<Array<Record<string, unknown>>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await readEvents(sessionId);
    } catch (error) {
      lastError = error;
      if (error instanceof CloudAgentsError && error.code === 'ai_access_denied') throw error;
      await sleep(700);
    }
  }
  throw lastError;
}

export const MAX_AI_OUTPUT_CHARS = MAX_OUTPUT_CHARS;

// 第一步：建立会话并把提示词投递出去，几秒内返回，不等待模型生成。
export async function startQoderGeneration(prompt: string): Promise<string> {
  if (!safeConfigured()) throw new QcaError('ai_not_configured', 'Qoder AI 尚未启用，请稍后再试', 503);
  if (typeof prompt !== 'string' || prompt.length < 50 || prompt.length > 120_000) {
    throw new QcaError('invalid_request', '资料长度不符合要求', 400);
  }

  const diagnosticId = crypto.randomUUID();

  const runOnce = async (): Promise<string> => {
    const binding = await ensureBinding();
    const sessionId = await createSession(binding);
    await cloud.request(`/api/v1/cloud/sessions/${sessionId}/events`, {
      method: 'POST',
      body: {
        events: [{ type: 'user.message', content: [{ type: 'text', text: prompt }] }]
      }
    });
    return sessionId;
  };

  try {
    return await runOnce();
  } catch (error) {
    // 缓存的 Agent/Environment 可能在上游被归档或删掉（404），这时丢弃缓存重新绑定一次，
    // 否则接下来的 10 分钟里每次生成都会失败。
    if (error instanceof CloudAgentsError && error.code === 'ai_resource_not_found') {
      cachedBinding = null;
      try {
        return await runOnce();
      } catch (retryError) {
        const retried = retryError instanceof QcaError ? retryError : mapCloudError(retryError);
        console.error(JSON.stringify({ event: 'exam_plan_qca_start_failed', diagnosticId, code: retried.code, retried: true }));
        throw retried;
      }
    }
    const mapped = error instanceof QcaError ? error : mapCloudError(error);
    console.error(JSON.stringify({
      event: 'exam_plan_qca_start_failed',
      diagnosticId,
      code: mapped.code
    }));
    throw mapped;
  }
}

export type QcaPollResult = {
  messages: Array<{ id: string; text: string }>;
  statuses: Array<{ id: string; type: string }>;
  errors: string[];
};

// 第二步：读取会话事件。函数不保存状态，浏览器自己持有会话 ID。
export async function pollQoderGeneration(sessionId: string): Promise<QcaPollResult> {
  if (typeof sessionId !== 'string' || !/^sess_[A-Za-z0-9_-]+$/.test(sessionId)) {
    throw new QcaError('invalid_request', '规划任务不存在或已结束，请重新生成', 400);
  }
  let events: Array<Record<string, unknown>>;
  try {
    events = await readEventsWithRetry(sessionId);
  } catch (error) {
    throw mapCloudError(error);
  }

  const messages: Array<{ id: string; text: string }> = [];
  const statuses: Array<{ id: string; type: string }> = [];
  const errors: string[] = [];
  for (const event of events) {
    const id = String(event.id || '');
    if (!id) continue;
    const type = String(event.type || '');
    if (type === 'agent.message') {
      const text = eventText(event.content).trim();
      if (text) messages.push({ id, text });
    } else if (type === 'span.model_request_end') {
      const data = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : {};
      if (event.is_error === true || data.is_error === true) errors.push(id);
    } else if (type === 'session.status_running' || type === 'session.status_idle') {
      statuses.push({ id, type });
    }
  }
  return { messages, statuses, errors };
}

function mapCloudError(error: unknown): QcaError {
  if (error instanceof CloudAgentsError) {
    if (error.code === 'ai_not_configured') return new QcaError('ai_not_configured', 'Qoder AI 尚未启用，请稍后再试', 503);
    if (error.code === 'ai_access_denied') return new QcaError('ai_access_denied', 'Qoder AI 授权失败，请稍后再试', 502);
    if (error.code === 'ai_out_of_credits') {
      return new QcaError('ai_out_of_credits', 'Qoder AI 额度已用尽，请充值或等待额度刷新后重试', 402);
    }
    if (error.code === 'ai_rate_limited') return new QcaError('ai_rate_limited', 'AI 调用频率过高，请稍后再试', 429);
    if (error.code === 'ai_resource_not_found') {
      return new QcaError('ai_unavailable', 'Qoder AI 初始化失败，请稍后重试', 502);
    }
    if (error.code === 'ai_request_rejected') {
      return new QcaError('ai_request_rejected', 'AI 服务拒绝了本次请求，请减少资料量后重试', 400);
    }
    if (error.code === 'ai_request_unknown' || error.code === 'ai_service_unavailable') {
      return new QcaError('ai_unavailable', 'Qoder AI 响应超时，请稍后重试', 504);
    }
    if (error.code === 'ai_response_invalid') return new QcaError('ai_bad_output', 'AI 返回格式异常，请重试', 502);
    return new QcaError('ai_unavailable', 'Qoder AI 暂时不可用，请稍后重试', 502);
  }
  return new QcaError('ai_unavailable', 'Qoder AI 暂时不可用，请稍后重试', 502);
}