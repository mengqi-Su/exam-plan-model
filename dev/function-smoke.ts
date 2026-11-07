// 临时冒烟测试：用 tsx 直接跑云函数 handler 的无凭据路径（不需要 Deno / API Key）。
// 验证路由、校验、日历分段与本地兜底；跑完即可删除。
import assert from 'node:assert/strict';
import { handler } from '../functions/handler.ts';
import { completeJson, LlmError } from '../functions/llm.ts';

const base = 'https://example.com/functions/v1/app';

async function call(path: string, body: unknown): Promise<{ status: number; data: any }> {
  const res = await handler(new Request(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }));
  return { status: res.status, data: await res.json() };
}

async function get(path: string): Promise<any> {
  const res = await handler(new Request(`${base}${path}`, { method: 'GET' }));
  return { status: res.status, data: await res.json() };
}

const material = {
  id: 'm1',
  name: '计算机网络考纲.md',
  type: 'syllabus',
  content: [
    '# 第 1 章 体系结构',
    'OSI 七层模型与 TCP/IP 四层模型的定义、各层功能与协议数据单元。封装与解封装过程。',
    '',
    '# 第 2 章 传输层',
    'TCP 三次握手与四次挥手公式推导，可靠传输机制：确认、重传、滑动窗口。UDP 无连接特性，拥塞控制算法。',
    '',
    '# 第 3 章 网络层',
    'IP 地址分类与子网划分计算，路由选择协议 RIP/OSPF/BGP 机制对比。',
  ].join('\n')
};

const preferences = {
  examName: '计算机网络期末',
  subject: '计算机网络',
  startDate: '2026-11-02',
  examDate: '2026-11-16',
  examTime: '09:00',
  sessionLengthMinutes: 45,
  language: 'zh',
  weakTopicsFocus: ['传输层'],
  userNeedFocusArea: 'comprehensive',
  customPromptRequirement: '重点突破计算题',
  dailySchedules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek !== 0,
    availableHours: 2
  }))
};

const topics = [
  { id: 'unit-1', title: '第 1 章 体系结构', category: '网络', weightPercentage: 30, difficulty: 'easy', subtopics: ['OSI 模型'], estimatedHours: 4 },
  { id: 'unit-2', title: '第 2 章 传输层', category: '传输', weightPercentage: 40, difficulty: 'hard', subtopics: ['TCP 握手', '拥塞控制'], estimatedHours: 8 }
];

console.log('function smoke checks (no API key)');

const health = await get('/health');
assert.equal(health.status, 200);
assert.equal(health.data.service, 'exam-plan-ai');
assert.equal(health.data.ai.provider, 'deepseek');
assert.equal(health.data.ai.configured, false);
console.log('  ok  /health -> provider deepseek, configured false');

const units = await call('/ai/units', { materials: [material], examName: '计算机网络期末', subject: '计算机网络', language: 'zh' });
assert.equal(units.status, 503);
assert.equal(units.data.code, 'ai_not_configured');
console.log('  ok  /ai/units 无 Key 时返回 ai_not_configured');

const tree = await call('/ai/unit-tree', {
  unit: { id: 'unit-1', title: '第 1 章 体系结构', category: '网络', weightPercentage: 30, difficulty: 'easy', estimatedHours: 4, excerpts: 'OSI 七层模型' },
  unitIndex: 0,
  unitsCount: 2,
  language: 'zh'
});
assert.equal(tree.data.code, 'ai_not_configured');
console.log('  ok  /ai/unit-tree 无 Key 时返回 ai_not_configured');

const tocMissingName = await call('/ai/textbook-toc', { textbook: '   ', language: 'zh' });
assert.equal(tocMissingName.status, 400, JSON.stringify(tocMissingName.data));
assert.equal(tocMissingName.data.code, 'invalid_request');
console.log('  ok  /ai/textbook-toc 没有教材名时直接拦下');

const toc = await call('/ai/textbook-toc', { textbook: '计算机网络（第 8 版）', examName: '考研 408', subject: '计算机网络', language: 'zh' });
assert.equal(toc.data.code, 'ai_not_configured');
console.log('  ok  /ai/textbook-toc 无 Key 时返回 ai_not_configured');

const textbookTree = await call('/ai/unit-tree', {
  unit: { id: 'ch-1', title: '第 1 章 概述', weightPercentage: 12, difficulty: 'easy', estimatedHours: 4, source: 'textbook', sections: ['1.1 网络在信息时代的作用'] },
  textbook: '计算机网络（第 8 版）',
  unitIndex: 0,
  unitsCount: 9,
  language: 'zh'
});
assert.equal(textbookTree.data.code, 'ai_not_configured', '教材章节没有原文片段也应正常进入模型调用');
console.log('  ok  /ai/unit-tree 教材来源分支不要求原文片段');

const schedule = await call('/ai/plan-schedule', { preferences, language: 'zh' });
assert.equal(schedule.status, 200, JSON.stringify(schedule.data));
assert.ok(schedule.data.studyDates.length > 0);
assert.equal(schedule.data.totalDays, schedule.data.studyDates.length);
assert.ok(schedule.data.chunks.every((chunk: any) => chunk.dates.length <= 4));
assert.equal(schedule.data.studyDates.some((d: string) => new Date(`${d}T00:00:00`).getDay() === 0), false, '周日应被排除');
console.log(`  ok  /ai/plan-schedule -> ${schedule.data.studyDates.length} 天 / ${schedule.data.chunks.length} 段`);

const chunk = await call('/ai/plan-chunk', {
  preferences, topics, materials: [material],
  dates: schedule.data.chunks[0].dates, includePhases: true, language: 'zh'
});
assert.equal(chunk.data.code, 'ai_not_configured');
console.log('  ok  /ai/plan-chunk 无 Key 时返回 ai_not_configured');

const badChunk = await call('/ai/plan-chunk', {
  preferences, topics, materials: [material], dates: ['2026-11-08'], language: 'zh'
});
assert.equal(badChunk.status, 400, JSON.stringify(badChunk.data));
assert.equal(badChunk.data.code, 'INVALID_DATE_RANGE');
console.log('  ok  /ai/plan-chunk 拒绝禁用日（周日）');

const noDates = await call('/ai/plan-chunk', { preferences, topics, materials: [material], dates: [], language: 'zh' });
assert.equal(noDates.status, 400);
assert.equal(noDates.data.code, 'invalid_request');
console.log('  ok  /ai/plan-chunk 校验缺失日期');

const rebalance = await call('/ai/rebalance', {
  currentPlan: {
    examName: '计算机网络期末',
    subject: '计算机网络',
    examDate: '2026-11-16',
    preferences,
    tasks: [
      { id: 'a', title: '已完成', date: '2026-11-01', status: 'completed', priority: 'high', durationMinutes: 45 },
      { id: 'b', title: '积压任务', date: '2026-11-01', status: 'pending', priority: 'low', durationMinutes: 45 },
      { id: 'c', title: '另一积压', date: '2026-11-02', status: 'pending', priority: 'low', durationMinutes: 45 }
    ]
  },
  currentDate: '2026-11-03',
  reason: '漏做了两天',
  language: 'zh'
});
assert.equal(rebalance.status, 200, JSON.stringify(rebalance.data));
assert.equal(rebalance.data.ok, true);
assert.equal(rebalance.data.meta.source, 'fallback');
assert.equal(rebalance.data.meta.fallbackReason, 'no_api_key');
assert.equal(rebalance.data.result.tasks.length, 3);
assert.equal(rebalance.data.result.tasks.find((t: any) => t.id === 'a').date, '2026-11-01');
assert.ok(rebalance.data.result.tasks.filter((t: any) => t.status === 'pending').every((t: any) => t.date >= '2026-11-03'));
console.log('  ok  /ai/rebalance 无 Key 时走本地兜底并保留已完成任务');

const bigPlanTasks = Array.from({ length: 40 }, (_x, i) => ({
  id: `t${i}`, title: `任务 ${i}`, date: '2026-11-01', status: i < 3 ? 'completed' : 'pending', priority: 'low', durationMinutes: 45
}));
// 模拟「已配置 Key」：只用于验证待办过多时直接走本地规则，这条路径不会发起任何网络请求
(process.env as any).DEEPSEEK_API_KEY = 'smoke-placeholder-not-a-real-key';
const tooMany = await call('/ai/rebalance', {
  currentPlan: { examName: 'x', examDate: '2026-11-16', preferences, tasks: bigPlanTasks },
  currentDate: '2026-11-03',
  reason: '',
  language: 'zh'
});
delete (process.env as any).DEEPSEEK_API_KEY;
assert.equal(tooMany.status, 200, JSON.stringify(tooMany.data));
assert.equal(tooMany.data.meta.fallbackReason, 'too_many_tasks');
assert.equal(tooMany.data.result.tasks.length, 40);
console.log('  ok  待办过多时重排直接用本地规则（单次调用装不下）');

const missing = await call('/ai/units', { materials: [], language: 'zh' });
assert.equal(missing.data.code, 'EMPTY_MATERIALS');
const badMode = await handler(new Request(`${base}/ai/nope`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
}));
assert.equal(badMode.status, 404);
const wrongMethod = await handler(new Request(`${base}/ai/units`, { method: 'DELETE' }));
assert.equal(wrongMethod.status, 405);
console.log('  ok  空资料 / 未知路由 / 非 POST 都有明确响应');

/* ---------------- 请求闸门：来源、类型、体积、频率 ---------------- */

// 来源与频率用例打在 /ai/nope 上：闸门在路由分发之前，能走到 404 就说明「放行到了门口以内」，
// 而 body 用例必须走一个真会读 body 的路由（/ai/plan-schedule，256 KB 上限，纯本地计算）。
async function gate(
  path: string,
  headers: Record<string, string>,
  body?: BodyInit
): Promise<{ status: number; data: any; retryAfter: string | null }> {
  const res = await handler(new Request(`${base}${path}`, { method: 'POST', headers, body }));
  return {
    status: res.status,
    data: await res.json(),
    retryAfter: res.headers.get('Retry-After'),
  };
}

const jsonType = { 'Content-Type': 'application/json' };
const nopePath = '/ai/nope';
const bodyPath = '/ai/plan-schedule';

const notJson = await gate(bodyPath, { 'Content-Type': 'text/plain' }, '{"language":"zh"}');
assert.equal(notJson.status, 415, JSON.stringify(notJson.data));
assert.equal(notJson.data.code, 'unsupported_media_type');
console.log('  ok  闸门：非 JSON Content-Type 一律 415');

const crossOrigin = await gate(nopePath, { ...jsonType, Origin: 'https://evil.example.com', 'Sec-Fetch-Site': 'cross-site' });
assert.equal(crossOrigin.status, 403, JSON.stringify(crossOrigin.data));
assert.equal(crossOrigin.data.code, 'cross_origin');
console.log('  ok  闸门：跨站页面借浏览器打我们 -> 403');

// 同域与本地开发要放行；没有 Origin 的调用（curl、探活、发布后核对）也要放行，
// 否则运维和验证一起被挡在门外，而这类调用本来也借不到用户的登录态。
for (const origin of ['https://exam-plan-ai-zfc3er164xi.qoder.zone', 'http://127.0.0.1:4400', 'http://localhost:5173']) {
  const ok = await gate(nopePath, { ...jsonType, Origin: origin, 'Sec-Fetch-Site': 'same-origin' }, '{}');
  assert.equal(ok.status, 404, `${origin} 应放行到路由层，实际 ${ok.status}`);
}
const noOrigin = await gate(nopePath, jsonType, '{}');
assert.equal(noOrigin.status, 404);
console.log('  ok  闸门：本站与本地来源放行，无 Origin 的调用也放行');

// 上限按字节算：中文一字 3 字节，旧写法按字符判断等于把上限放宽三倍。
const tooBig = await gate(bodyPath, jsonType, JSON.stringify({ preferences: { note: '字'.repeat(120_000) } }));
assert.equal(tooBig.status, 413, JSON.stringify(tooBig.data));
assert.equal(tooBig.data.code, 'body_too_large');
console.log('  ok  闸门：按字节封顶的 body 超限即 413');

// 声明很小、实际很大时，流式读取仍要在超限处中止，而不是信了 Content-Length 就整块收下。
const declaredSmall = await gate(
  bodyPath,
  { 'Content-Type': 'application/json', 'Content-Length': '16' },
  '{"materials":"' + '字'.repeat(200_000) + '"}'
);
assert.equal(declaredSmall.status, 413, JSON.stringify(declaredSmall.data));
assert.equal(declaredSmall.data.code, 'body_too_large');
console.log('  ok  闸门：Content-Length 撒谎时，流式读取仍然中止');

const brokenJson = await gate(bodyPath, jsonType, 'not-json-at-all');
assert.equal(brokenJson.status, 400, JSON.stringify(brokenJson.data));
assert.equal(brokenJson.data.code, 'bad_body');
console.log('  ok  闸门：body 不是 JSON 时给 bad_body，不再混进「请求格式错误」');

// 令牌桶：一次正常生成是几十个并发小请求，额度必须先让这种人过去；
// 真正的脚本刷量在桶空之后吃 429 + Retry-After。这里用独立 IP，不污染其他用例。
const spamIp = { ...jsonType, 'X-Forwarded-For': '203.0.113.9' };
let limited: { status: number; data: any; retryAfter: string | null } | null = null;
for (let i = 0; i < 140; i++) {
  const attempt = await gate(nopePath, spamIp, '{}');
  if (attempt.status === 429) limited = attempt;
  else assert.equal(attempt.status, 404, `第 ${i + 1} 次不该被限流：${JSON.stringify(attempt.data)}`);
}
assert.ok(limited, '刷到 140 次应当撞到令牌桶');
assert.equal(limited!.data.code, 'rate_limited');
assert.ok(Number(limited!.retryAfter) >= 1, `429 要带 Retry-After，实际 ${limited!.retryAfter}`);
console.log(`  ok  闸门：突发 120 次之后限流（Retry-After ${limited!.retryAfter}s）`);

// 额度按来源 IP 分桶：邻居被刷爆不该把新用户一起关在门外。
const freshIp = await gate(nopePath, { ...jsonType, 'X-Forwarded-For': '203.0.113.10' }, '{}');
assert.equal(freshIp.status, 404);
console.log('  ok  闸门：限流按来源 IP 分桶，不牵连别人');

/* ---------------- 上游客户端：用假 fetch 验证调用形状、截断与时间预算 ---------------- */

const realFetch = globalThis.fetch;
type MockReply = { status?: number; body?: any; hang?: boolean };

async function withMockedUpstream(replies: MockReply[], run: () => Promise<void>): Promise<Record<string, any>[]> {
  const seen: Record<string, any>[] = [];
  globalThis.fetch = (async (_url: any, init: any) => {
    const reply = replies[Math.min(seen.length, replies.length - 1)];
    seen.push(JSON.parse(init.body));
    if (reply.hang) {
      // 上游不返回：只有调用方自己的超时能结束它
      return await new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      });
    }
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
  return seen;
}

const completion = (content: string, finish = 'stop') => ({
  choices: [{ message: { content }, finish_reason: finish }]
});

(process.env as any).DEEPSEEK_API_KEY = 'smoke-placeholder-not-a-real-key';
try {
  const seen = await withMockedUpstream(
    [{ body: completion('{"units":[]}') }],
    async () => {
      const text = await completeJson('smoke prompt', { stage: 'smoke', maxTokens: 2_000 });
      assert.equal(text, '{"units":[]}');
    }
  );
  assert.equal(seen.length, 1);
  assert.equal(seen[0].model, 'deepseek-flash');
  assert.deepEqual(seen[0].thinking, { type: 'disabled' }, '结构化输出必须显式关闭思考模式');
  assert.equal(seen[0].max_tokens, 2_000);
  assert.equal(seen[0].stream, false);
  console.log('  ok  默认走 deepseek-flash 并显式关闭思考模式');

  await withMockedUpstream(
    [
      { status: 400, body: { error: { message: 'unknown parameter thinking' } } },
      { body: completion('{"ok":true}') },
    ],
    async () => {
      const text = await completeJson('smoke prompt', { stage: 'smoke-400' });
      assert.equal(text, '{"ok":true}');
    }
  );
  console.log('  ok  旧模型不认识 thinking 时自动去掉该参数再试');

  const capped: MockReply[] = [{ body: completion('{"tasks":[', 'length') }, { body: completion('{}') }];
  const seenCapped = await withMockedUpstream(capped, async () => {
    let code = '';
    try {
      await completeJson('smoke prompt', { stage: 'smoke-cap' });
    } catch (error) {
      code = (error as LlmError).code;
    }
    assert.equal(code, 'ai_output_capped');
  });
  assert.equal(seenCapped.length, 1, '输出截断不该再级联换模型白等一次');
  console.log('  ok  输出被截断立刻回 ai_output_capped，不做无谓的模型级联');

  const startedAt = Date.now();
  const seenHang = await withMockedUpstream([{ hang: true }], async () => {
    let code = '';
    let status = 0;
    try {
      await completeJson('smoke prompt', { stage: 'smoke-hang', budgetMs: 6_000 });
    } catch (error) {
      code = (error as LlmError).code;
      status = (error as LlmError).status;
    }
    assert.equal(code, 'ai_timeout');
    assert.equal(status, 504);
  });
  const hungFor = Date.now() - startedAt;
  assert.equal(seenHang.length, 1, '预算用完就不再发起下一次上游调用');
  assert.ok(hungFor < 9_000, `预算应在网关之前收口，实际 ${hungFor}ms`);
  console.log(`  ok  上游挂起时按总预算收口（${hungFor}ms 后返回 ai_timeout）`);
} finally {
  delete (process.env as any).DEEPSEEK_API_KEY;
}

console.log('\nfunction smoke checks passed');
