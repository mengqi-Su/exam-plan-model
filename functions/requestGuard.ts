// ========================================
// 请求闸门（函数入口的唯一一道安检）
//
// 站点函数是公网可达的 URL。网关只保证「请求被送到了这里」，不保证它是谁发的、
// 带了多大的 body、多久发一次。这个文件补齐四件事，两端各自持有同一份逻辑：
//
//   1. body 上限：先看 Content-Length，再按字节流式读取，超限立即 cancel。
//      旧写法 `await req.text()` 会把任意大的 body 整个搬进内存之后才判断长度——
//      检查在伤害之后，等于没有检查。
//   2. POST 必须是 application/json：表单、纯文本、别的站点随手发来的请求一律 415。
//   3. Origin / Sec-Fetch-Site 同源校验：拦掉「恶意网页借用户已登录的浏览器打我们」。
//      浏览器一定会带这两个头之一，所以缺失（curl、运维探活）按放行处理，不误伤。
//   4. 按来源 IP 的令牌桶 + 日额度：让「把这里当免费 AI 接口刷」不再便宜，超限 429。
//
// 关于第 4 点的诚实边界：函数实例是无状态的，计数只活在当前实例的内存里，
// 冷启动会清零、多实例各算各的。所以这层的目标是把滥用成本抬起来，不是精确计费；
// 真正的钱在上游 API Key 那边。额度取得宽（一次正常生成就是几十个并发小请求 + 重试），
// 宁可漏过一点滥用，也不要把正在等结果的用户拦在门外。
// ========================================

/** 闸门拒绝：带 code / HTTP status / 可选 Retry-After，由调用方翻译成自己的错误信封。 */
export class GateRejection extends Error {
  code: string;
  status: number;
  retryAfterSeconds?: number;

  constructor(code: string, message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.name = 'GateRejection';
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** 429 必须告诉客户端等多久，否则前端只会立刻再撞一次。 */
  headers(): Record<string, string> {
    return this.retryAfterSeconds ? { 'Retry-After': String(this.retryAfterSeconds) } : {};
  }
}

/**
 * 单一实现，两端各存一份（各自的部署单元不同）。前端按 code 出本地化文案
 * （Exam Plan 走 localizeApiError，StarQuiz 走词典），这里的中文原文只是
 * 「客户端不认识这个 code 时」的兜底。
 */
export type RateBucket = 'ai';

// 绝对天花板：就算某个路由忘了传自己的上限，也不会放开整个函数收任意大的 body。
const ABSOLUTE_MAX_BODY = 16 * 1024 * 1024;
// 读 body 的时间天花板：慢到这里的连接，继续等也只是把函数时间烧光。
const BODY_READ_TIMEOUT_MS = 25_000;

const RATE_LIMITS: Record<RateBucket, { burst: number; refillPerMinute: number; perDay: number }> = {
  // 一次正常生成：考点 1 + 逐章展开最多 14 + 排程 1 + 分段任务若干，浏览器 4 路并发，
  // 瞬时错误还会自动重试两次。桶必须先把这条路让过去，拦的是「把这里当免费 AI 接口刷」。
  ai: { burst: 120, refillPerMinute: 60, perDay: 4000 },
};

const MAX_TRACKED_KEYS = 4000;
const IDLE_EVICT_MS = 60 * 60 * 1000;

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  day: string;
  used: number;
}

const buckets = new Map<string, TokenBucket>();

function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim()
    || req.headers.get('cf-connecting-ip')?.trim()
    || 'shared';
}

function todayKey(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** 长期不活跃的键要清掉：这是一张会随访客数无限增长的表。 */
function pruneBuckets(now: number) {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > IDLE_EVICT_MS) buckets.delete(key);
  }
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
}

function sleepSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}

function takeToken(req: Request, bucket: RateBucket, now: number) {
  const limits = RATE_LIMITS[bucket];
  const id = `${bucket}|${clientKey(req)}`;
  const day = todayKey(now);
  let state = buckets.get(id);
  if (!state) {
    state = { tokens: limits.burst, lastRefill: now, day, used: 0 };
    buckets.set(id, state);
    pruneBuckets(now);
  }
  if (state.day !== day) {
    state.day = day;
    state.used = 0;
  }
  const elapsedMinutes = Math.max(0, now - state.lastRefill) / 60_000;
  state.tokens = Math.min(limits.burst, state.tokens + elapsedMinutes * limits.refillPerMinute);
  state.lastRefill = now;

  if (state.used >= limits.perDay) {
    // 日额度按 UTC 日重置。单独的 code：客户端对「等几分钟」和「等明天」不能给同一句话，
    // 前者值得自动重试，后者重试只是在浪费用户的时间。
    const nextDay = Date.parse(`${day}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
    throw new GateRejection(
      'daily_quota_reached',
      '今天的调用次数已用完，请明天再试。',
      429,
      sleepSeconds(nextDay - now)
    );
  }
  if (state.tokens < 1) {
    const minutesToWait = (1 - state.tokens) / limits.refillPerMinute;
    throw new GateRejection(
      'rate_limited',
      '请求太频繁了，请等一会儿再试。',
      429,
      sleepSeconds(minutesToWait * 60_000)
    );
  }
  state.tokens -= 1;
  state.used += 1;
}

/**
 * 同源判定。注意方向：浏览器跨站发 POST 时一定会带 Origin，
 * 非浏览器调用（curl、健康探针、发布后的只读核对）两个头都没有，那类调用放行——
 * 它们本来也借不到用户的登录态，拦掉只会把运维和验证一起挡在门外。
 */
function assertSameSite(req: Request) {
  const secFetchSite = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (secFetchSite && !['same-origin', 'same-site', 'none'].includes(secFetchSite)) {
    throw new GateRejection('cross_origin', '这个页面不能调用本服务，请在站点内使用。', 403);
  }
  const origin = req.headers.get('origin');
  if (!origin || origin === 'null') return;
  let host = '';
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    throw new GateRejection('cross_origin', '这个页面不能调用本服务，请在站点内使用。', 403);
  }
  const allowed = host === 'localhost'
    || host === '127.0.0.1'
    || host === '[::1]'
    || host === '::1'
    || host === 'qoder.zone'
    || host.endsWith('.qoder.zone');
  if (!allowed) {
    throw new GateRejection('cross_origin', '这个页面不能调用本服务，请在站点内使用。', 403);
  }
}

/**
 * POST 进门安检：同源 + 额度。放在读 body 之前——被拒的请求连 body 都不该搬进来。
 * Content-Type 属于 body 的一部分，由 readJsonBody 负责。
 */
export function checkAccess(req: Request, bucket: RateBucket): void {
  assertSameSite(req);
  takeToken(req, bucket, Date.now());
}

function declaredLength(req: Request): number {
  const raw = req.headers.get('content-length');
  if (!raw) return NaN;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : NaN;
}

/** 按字节流式读取，边读边计数；超限或超时立刻中止，不把整个 body 搬进内存。 */
async function readCappedBytes(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = declaredLength(req);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new GateRejection('body_too_large', '提交内容过大，请减少资料数量后重试。', 413);
  }
  const stream = req.body;
  if (!stream) return new Uint8Array();

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  const abort = async () => {
    try {
      await reader.cancel();
    } catch {
      // 流已经关了就不用再管
    }
  };
  // 一个定时器管整段读取：每个分片各挂一个的话，大 body 会留下成百个空转的计时器。
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('body_read_timeout')), BODY_READ_TIMEOUT_MS);
  });

  try {
    while (true) {
      const result = await Promise.race([reader.read(), timedOut]);
      if (result.done) break;
      const value = result.value;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await abort();
        throw new GateRejection('body_too_large', '提交内容过大，请减少资料数量后重试。', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    await abort();
    if (error instanceof GateRejection) throw error;
    // 读太慢、网关掐断、客户端中途关页面都走到这里：说人话，别把底层报错甩给用户
    throw new GateRejection('body_timeout', '上传太慢了，请检查网络，或减少资料量后重试。', 408);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/**
 * POST body 唯一的读取口：Content-Type 必须是 JSON，body 按字节封顶，再解析成对象。
 * 抛出的都是 GateRejection，由各站点的 handler 翻译成自己的错误信封。
 */
export async function readJsonBody(req: Request, maxBytes: number): Promise<Record<string, unknown>> {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    throw new GateRejection('unsupported_media_type', '这个接口只接受 JSON 请求。', 415);
  }
  const cap = Math.min(maxBytes, ABSOLUTE_MAX_BODY);
  const bytes = await readCappedBytes(req, cap);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new GateRejection('bad_body', '请求内容不是有效的 JSON。', 400);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new GateRejection('bad_body', '请求内容不是有效的 JSON 对象。', 400);
  }
  return parsed as Record<string, unknown>;
}

/** 供各站点在 catch 里复用：闸门拒绝原样透传，其他错误返回 null 交给本地兜底。 */
export function asRejection(error: unknown): GateRejection | null {
  return error instanceof GateRejection ? error : null;
}
