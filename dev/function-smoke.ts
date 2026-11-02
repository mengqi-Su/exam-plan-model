// 临时冒烟测试：用 tsx 直接跑云函数 handler 的无凭据路径（不需要 Deno / API Key）。
// 验证路由、校验、日历分段与本地兜底；跑完即可删除。
import assert from 'node:assert/strict';
import { handler } from '../functions/handler.ts';

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
const badMode = await handler(new Request(`${base}/ai/nope`, { method: 'POST', body: '{}' }));
assert.equal(badMode.status, 404);
const wrongMethod = await handler(new Request(`${base}/ai/units`, { method: 'DELETE' }));
assert.equal(wrongMethod.status, 405);
console.log('  ok  空资料 / 未知路由 / 非 POST 都有明确响应');

console.log('\nfunction smoke checks passed');
