// 临时冒烟测试：用假 fetch 驱动前端编排（runGeneration），验证分段并发、重试、合并与错误透传。
// 不触网、不需要 API Key；跑完即可删除。
import assert from 'node:assert/strict';
import { runGeneration, GenerationError } from '../src/lib/aiClient.ts';

const requests: Array<{ path: string; body: any }> = [];
let chunkAttempts = 0;
let rateLimitedOnce = false;
let capMultiDayChunks = false;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

const studyDates = ['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09'];

async function fakeFetch(input: any, init: any): Promise<Response> {
  const url = String(input);
  const body = JSON.parse(String(init?.body || '{}'));
  const path = url.replace(/^.*\/functions\/v1\/app/, '');
  requests.push({ path, body });

  if (path === '/ai/units') {
    return jsonResponse({
      ok: true,
      summary: '覆盖三章核心内容。',
      units: [
        { id: 'unit-1', title: '第 1 章 体系结构', weightPercentage: 30, estimatedHours: 4, excerpts: 'OSI 七层模型' },
        { id: 'unit-2', title: '第 2 章 传输层', weightPercentage: 40, estimatedHours: 8, excerpts: 'TCP 三次握手' },
        { id: 'unit-3', title: '第 3 章 网络层', weightPercentage: 30, estimatedHours: 6, excerpts: '子网划分' }
      ]
    });
  }

  if (path === '/ai/unit-tree') {
    assert.ok(body.unit?.id, '应回传单元对象');
    assert.equal(body.materials, undefined, '展开单元时不该重复上传整份资料');
    const id = body.unit.id;
    return jsonResponse({
      ok: true,
      topic: {
        id,
        title: body.unit.title,
        weightPercentage: body.unit.weightPercentage,
        subtopics: [`${id} 子考点 A`, `${id} 子考点 B`],
        subtopicTree: [{ id: `sub-${id}`, title: '细分考点', keyPoints: ['要点一'] }]
      }
    });
  }

  if (path === '/ai/plan-schedule') {
    return jsonResponse({
      ok: true,
      studyDates,
      totalDays: studyDates.length,
      chunks: [{ dates: ['2026-11-03', '2026-11-04'] }, { dates: ['2026-11-05', '2026-11-06'] }, { dates: ['2026-11-09'] }]
    });
  }

  if (path === '/ai/plan-chunk') {
    chunkAttempts += 1;
    const dates: string[] = body.dates;
    // 模拟 DeepSeek 单次输出长度到顶：多天段一律拒绝，只有拆成单天才成功
    if (capMultiDayChunks && dates.length > 1) {
      return jsonResponse({ ok: false, code: 'ai_output_capped', error: 'output capped' }, 502);
    }
    // 第一段第一次返回限流，验证自动重试
    if (!rateLimitedOnce && dates[0] === '2026-11-03') {
      rateLimitedOnce = true;
      return jsonResponse({ ok: false, code: 'ai_rate_limited', error: 'too many requests' }, 429);
    }
    const tasks = dates.flatMap((date, i) => [
      // 每段都从 task-1 开始编号：合并后必须重新去重
      { id: 'task-1', title: `复习 ${date}`, date, topicTitle: '第 2 章 传输层', durationMinutes: 45, category: 'reading', priority: 'high', status: 'pending' },
      ...(date === '2026-11-04' ? [] : [{ id: 'task-2', title: `练习 ${date}`, date, topicTitle: '第 1 章 体系结构', durationMinutes: 30, category: 'practice_problems', priority: 'medium', status: 'pending' }])
    ]);
    const phases = body.includePhases
      ? [{ id: 'phase-1', name: '基础阶段', startDate: dates[0], endDate: dates[dates.length - 1], focus: '概念' }]
      : [];
    return jsonResponse({ ok: true, phases, tasks, dates, studyDates });
  }

  if (path === '/ai/rebalance') {
    return jsonResponse({
      ok: true,
      result: { rebalanceSummary: '已把积压任务分摊到后面三天。', tasks: [{ id: 'a', date: '2026-11-05', status: 'pending' }] },
      meta: { source: 'ai' }
    });
  }

  throw new Error(`unexpected path ${path}`);
}

const realFetch = globalThis.fetch;
(globalThis as any).fetch = fakeFetch as any;

console.log('client orchestration smoke checks');

try {
  const statuses: string[] = [];
  const syllabus = await runGeneration(
    'syllabus',
    { materials: [{ id: 'm1', name: '考纲.md', type: 'syllabus', content: 'OSI 七层模型' }], examName: '期末', subject: '计算机网络' },
    { language: 'zh', onStatus: (text) => statuses.push(text) }
  );
  assert.equal(syllabus.meta?.source, 'ai');
  assert.equal(syllabus.result.summary, '覆盖三章核心内容。');
  assert.deepEqual(syllabus.result.topics.map((t: any) => t.id), ['unit-1', 'unit-2', 'unit-3'], '考点顺序需与单元顺序一致');
  assert.ok(statuses.some((s) => s.includes('3/3')), statuses.join(' | '));
  console.log('  ok  考点提取：单元 -> 并发展开 -> 按序合并');

  requests.length = 0;
  const planStatuses: string[] = [];
  const plan = await runGeneration(
    'plan',
    { topics: [{ id: 'unit-1', title: '第 1 章 体系结构' }], preferences: { startDate: '2026-11-03', examDate: '2026-11-10' }, materials: [] },
    { language: 'zh', onStatus: (text) => planStatuses.push(text) }
  );
  const tasks = plan.result.tasks as any[];
  // 2026-11-04 在第一段里只有 1 个任务，其余每天 2 个；缺日由补一轮补齐
  assert.ok(tasks.length >= 8, `tasks=${tasks.length}`);
  assert.equal(new Set(tasks.map((t) => t.id)).size, tasks.length, '合并后任务 ID 必须唯一');
  assert.equal(new Set(tasks.map((t) => t.date)).size, studyDates.length, '每个学习日都应有任务');
  for (let i = 1; i < tasks.length; i++) assert.ok(tasks[i - 1].date <= tasks[i].date, '任务需按日期排序');
  assert.equal(plan.result.phases.length, 1, '阶段只取第一段返回的');
  assert.equal(plan.result.totalPlannedHours, Math.round(tasks.reduce((s, t) => s + t.durationMinutes, 0) / 60));
  assert.equal(plan.meta?.planningDays, studyDates.length);
  assert.equal(plan.meta?.coveredDays, studyDates.length);
  assert.ok(requests.filter((r) => r.path === '/ai/plan-chunk').length >= 4, '限流应触发重试');
  assert.ok(planStatuses.some((s) => s.includes('重试')), planStatuses.join(' | '));
  assert.ok(planStatuses.some((s) => s.includes('3/3')), planStatuses.join(' | '));
  console.log('  ok  计划生成：分段并发 + 限流重试 + ID 去重 + 覆盖补齐');

  const rebalance = await runGeneration(
    'rebalance',
    { currentPlan: { tasks: [] }, currentDate: '2026-11-03', reason: '漏做' },
    { language: 'zh' }
  );
  assert.equal(rebalance.meta?.source, 'ai');
  assert.ok(String(rebalance.result.rebalanceSummary).includes('分摊'));
  console.log('  ok  重排：直接返回函数结果');

  // 输出长度到顶：多天段必须自动拆成逐日，而不是把整份计划判失败
  capMultiDayChunks = true;
  requests.length = 0;
  const splitStatuses: string[] = [];
  const splitPlan = await runGeneration(
    'plan',
    { topics: [{ id: 'unit-1', title: '第 1 章 体系结构' }], preferences: { startDate: '2026-11-03', examDate: '2026-11-10' }, materials: [] },
    { language: 'zh', onStatus: (text) => splitStatuses.push(text) }
  );
  capMultiDayChunks = false;
  const splitTasks = splitPlan.result.tasks as any[];
  assert.equal(new Set(splitTasks.map((t) => t.date)).size, studyDates.length, '逐日拆开后每天仍要有任务');
  assert.equal(splitPlan.result.phases.length, 1, '阶段只取第一天的那次调用');
  const chunkCalls = requests.filter((r) => r.path === '/ai/plan-chunk').map((r) => r.body.dates as string[]);
  assert.ok(chunkCalls.some((d) => d.length > 1), '应先按整段请求一次');
  assert.equal(chunkCalls.filter((d) => d.length === 1).length, studyDates.length, '每天各请求一次');
  assert.ok(splitStatuses.some((s) => s.includes('逐日编排')), splitStatuses.join(' | '));
  console.log('  ok  输出到顶：自动逐日重排，不丢日期也不重复阶段');

  // 终局错误必须原样透传，不能被当成网络问题反复重试
  let sawFailing = 0;
  (globalThis as any).fetch = (async (input: any, init: any) => {
    sawFailing += 1;
    return jsonResponse({ ok: false, code: 'ai_out_of_credits', error: 'no balance' }, 402);
  }) as any;
  await assert.rejects(
    () => runGeneration('syllabus', { materials: [], examName: '', subject: '' }, { language: 'zh' }),
    (error: any) => error instanceof GenerationError && error.code === 'ai_out_of_credits'
  );
  assert.equal(sawFailing, 1, '额度用尽不应重试');
  console.log('  ok  额度类错误：不重试、原样抛出');

  // 取消：abort 后立刻结束（模拟浏览器：signal 触发时 fetch 以 AbortError 失败）
  (globalThis as any).fetch = (async (_input: any, init: any) =>
    new Promise<Response>((resolve, reject) => {
      const onAbort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      if (init?.signal?.aborted) {
        onAbort();
        return;
      }
      init?.signal?.addEventListener('abort', onAbort, { once: true });
      setTimeout(() => resolve(jsonResponse({ ok: true })), 5000);
    })) as any;
  const controller = new AbortController();
  const pending = runGeneration(
    'plan',
    { topics: [{ id: 'unit-1', title: '第 1 章 体系结构' }], preferences: { startDate: '2026-11-03', examDate: '2026-11-10' }, materials: [] },
    { language: 'zh', signal: controller.signal }
  );
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(
    () => pending,
    (error: any) => error instanceof GenerationError && error.code === 'ABORTED'
  );
  console.log('  ok  生成可取消');

  /* ---------------- 函数闸门（requestGuard.ts）的拒绝码 ----------------
     闸门在业务逻辑之前，所以它的 code 出现在所有路由的共同路径上；这里用 /ai/units
     （syllabus 的第一跳）验证客户端把它翻成了本地化文案，而不是「网络异常」或原样印中文。 */
  const gateOnly = (code: string, status: number) => {
    let calls = 0;
    (globalThis as any).fetch = (async () => {
      calls += 1;
      return jsonResponse({ ok: false, code, error: 'gate fallback from function' }, status);
    }) as any;
    return () => calls;
  };

  // 限流和上传超时是「等一会儿就可能过」，必须先进重试预算；重试用尽才落到文案。
  const forever = gateOnly('rate_limited', 429);
  await assert.rejects(
    () => runGeneration('syllabus', { materials: [], examName: '', subject: '' }, { language: 'zh' }),
    (error: any) =>
      error instanceof GenerationError &&
      error.code === 'rate_limited' &&
      error.message === '请求太频繁了，请等一会儿再试。'
  );
  assert.equal(forever(), 3, 'rate_limited 应把重试预算用完（1 次 + 2 次重试）');
  console.log('  ok  闸门 rate_limited：先重试，最终给本地化文案而不是「网络异常」');

  // 不可重试的几类：一次都不该多打，文案按语言出。
  for (const [code, status, zh, en] of [
    ['body_too_large', 413, '这次提交的内容超过了服务上限，请减少资料数量后重试。', 'This request is over the service limit. Reduce the materials and try again.'],
    ['unsupported_media_type', 415, '这个接口只接受 JSON 请求，请刷新页面后重试。', 'This endpoint only accepts JSON requests. Refresh the page and try again.'],
    ['bad_body', 400, '请求内容格式无效，请刷新页面后重试。', 'Invalid request format. Refresh the page and try again.'],
    ['cross_origin', 403, '当前页面不能调用规划服务，请在本站页面内使用。', 'This page cannot call the planning service. Use it from within the site.'],
    ['daily_quota_reached', 429, '今天的调用次数已用完，请明天再试。', "You've used up today's allowance. Please try again tomorrow."],
  ] as const) {
    const calls = gateOnly(code, status);
    for (const [lang, expect] of [['zh', zh], ['en', en]] as const) {
      await assert.rejects(
        () => runGeneration('syllabus', { materials: [], examName: '', subject: '' }, { language: lang }),
        (error: any) => error instanceof GenerationError && error.code === code && error.message === expect,
        `${code} / ${lang}`
      );
    }
    assert.equal(calls(), 2, `${code} 属于终局错误，两种语言各打一次，不该重试`);
  }
  console.log('  ok  闸门终局类拒绝：不重试，中英各给一句能照着做的话');

  // 闸门偶发一次限流：用户不该感知到，重试后照常出结果。
  let unitsCalls = 0;
  (globalThis as any).fetch = (async (input: any, init: any) => {
    if (++unitsCalls === 1) return jsonResponse({ ok: false, code: 'rate_limited', error: 'slow down' }, 429);
    return fakeFetch(input, init);
  }) as any;
  const recovered = await runGeneration(
    'syllabus',
    { materials: [{ id: 'm1', name: '考纲.md', type: 'syllabus', content: 'OSI' }], examName: '期末', subject: '计算机网络' },
    { language: 'zh', onStatus: () => {} }
  );
  assert.equal(recovered.result.topics.length, 3, '限流重试后应拿到完整考点');
  assert.ok(unitsCalls >= 2, '第一次应被限流');
  console.log('  ok  闸门偶发限流：静默重试，结果不受影响');
} finally {
  (globalThis as any).fetch = realFetch;
}

console.log('\nclient orchestration smoke checks passed');
