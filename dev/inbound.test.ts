// 回程入站契约回归：npm run test:inbound
// 覆盖方案 §6.2 的入站七步：识别来源与版本 → 校验参数并重算考点钥匙 →
// 按 attemptId 去重 → 三重定位（planId + 规范化路径 + 钥匙）→ 定位不到存 unmatched →
// 只带定位上下文时不写成绩 → 写入失败仍要清 URL。
// 不触网、不碰浏览器存储：load/save 全部注入内存桩。
import assert from 'node:assert/strict';
import type { ExamStudyPlan, PracticeEvent } from '../src/types.ts';
import { computeTopicKey } from '../src/lib/topicKey.ts';
import { sanitizePracticeEvent } from '../src/lib/storage.ts';
import {
  INBOUND_PROTOCOL_VERSION,
  locateTopicTarget,
  parseReturnParams,
  processInboundReturn,
  resolveEventFocus,
} from '../src/lib/inbound.ts';
import { translations } from '../src/lib/i18n.tsx';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const PLAN_ID = 'plan-m2-demo';
const NOW = '2026-11-03T02:00:00.000Z';
const NOW_DATE = new Date(NOW);

function plan(overrides: Partial<ExamStudyPlan> = {}): ExamStudyPlan {
  return {
    id: PLAN_ID,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    examName: '2026 导游资格考试',
    subject: '中国近代史',
    examDate: '2026-12-20',
    startDate: '2026-10-01',
    totalPlannedHours: 40,
    phases: [],
    topics: [
      {
        id: 'u1',
        title: '辛亥革命',
        weightPercentage: 20,
        difficulty: 'medium',
        estimatedHours: 6,
        subtopics: ['武昌起义', '临时约法'],
        subtopicTree: [{ title: '武昌起义' }, { title: '二次革命' }],
      },
      { id: 'u2', title: '五四运动', weightPercentage: 15, difficulty: 'easy', estimatedHours: 4, subtopics: ['新文化运动'] },
      { id: 'u3', title: '闭关锁国', weightPercentage: 10, difficulty: 'hard', estimatedHours: 3, subtopics: [] },
    ],
    tasks: [],
    preferences: {
      examName: '2026 导游资格考试',
      subject: '中国近代史',
      examDate: '2026-12-20',
      startDate: '2026-10-01',
      dailySchedules: [],
      studyPace: 'spaced_repetition',
      sessionLengthMinutes: 45,
      includePracticeExams: true,
      includeBufferDays: true,
      bufferDaysCount: 2,
      weakTopicsFocus: [],
    },
    ...overrides,
  } as ExamStudyPlan;
}

/** 复刻 StarQuiz 出站的钥匙计算：入站必须用同一算法重算并校验一致。 */
async function keyFor(level: 'unit' | 'subtopic', subject: string, unit: string, topic: string): Promise<string> {
  return computeTopicKey({ level, subject, unit, topic });
}

function link(params: Record<string, string>): string {
  const search = new URLSearchParams({ from: 'starquiz', v: INBOUND_PROTOCOL_VERSION, ...params }).toString();
  return `?${search}`;
}

function memoryStore(initial: PracticeEvent[] = []) {
  const rows = [...initial];
  return {
    rows,
    load: async () => rows.map((row) => ({ ...row })),
    save: async (event: PracticeEvent) => {
      const existing = rows.find((row) => row.attemptId === event.attemptId) || null;
      if (existing) return { created: false, existing };
      rows.push(event);
      return { created: true, existing: null };
    },
  };
}

const baseContext = {
  plan: PLAN_ID,
  subject: '中国近代史',
  exam: '2026 导游资格考试',
  date: '2026-11-03',
  task: 'task-1',
};

const fullResult = {
  attempt: 'a1mlk3j2abcd',
  graded: '3',
  correct: '2',
  at: '2026-11-03T01:50:00.000Z',
  set: 'custom-mvzy7a8igx4',
};

console.log('回程入站契约（Exam Plan · M2）');

await check('识别合法子考点回程：定位到单元与子考点并记录事件', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '武昌起义');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'subtopic', unit: '辛亥革命', topic: '武昌起义', ...fullResult }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'recorded');
  assert.equal(outcome.clearUrl, true);
  assert.deepEqual(outcome.focus, { planId: PLAN_ID, topicId: 'u1', subtopicTitle: '武昌起义' });
  assert.equal(store.rows.length, 1);
  const event = store.rows[0];
  assert.equal(event.attemptId, fullResult.attempt);
  assert.equal(event.topicKey, tk);
  assert.equal(event.linkId, `${PLAN_ID}:${tk}`);
  assert.equal(event.setId, fullResult.set);
  assert.equal(event.graded, 3);
  assert.equal(event.correct, 2);
  assert.equal(event.status, 'pending');
  assert.equal(event.receivedAt, NOW);
  assert.deepEqual(event.sourceContext, { date: '2026-11-03', task: 'task-1' });
  assert.deepEqual(event.resolution, { planId: PLAN_ID, topicId: 'u1', subtopicTitle: '武昌起义' });
});

await check('单元级回程按单元定位，不带子考点标题', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.deepEqual(outcome.focus, { planId: PLAN_ID, topicId: 'u1' });
  assert.equal(store.rows[0].status, 'pending');
});

await check('考点钥匙与内容路径不符 → 拒绝，不写任何记录', async () => {
  const wrongKey = await keyFor('subtopic', '中国近代史', '辛亥革命', '临时约法');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk: wrongKey, level: 'subtopic', unit: '辛亥革命', topic: '武昌起义', ...fullResult }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'invalid');
  assert.equal(store.rows.length, 0);
});

await check('缺 attempt/graded/correct 之一 → 视为非法链接', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const params = { ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult };
  delete (params as Record<string, string>).graded;
  const store = memoryStore();
  const outcome = await processInboundReturn(link(params), [plan()], { ...store, now: () => NOW_DATE });
  assert.equal(outcome.kind, 'invalid');
  assert.equal(store.rows.length, 0);
});

await check('correct 大于 graded 或 graded 为 0 → 拒绝', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const store = memoryStore();
  const tooMany = { ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult, graded: '3', correct: '4' };
  const zero = { ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult, graded: '0', correct: '0' };
  assert.equal((await processInboundReturn(link(tooMany), [plan()], { ...store, now: () => NOW_DATE })).kind, 'invalid');
  assert.equal((await processInboundReturn(link(zero), [plan()], { ...store, now: () => NOW_DATE })).kind, 'invalid');
  assert.equal(store.rows.length, 0);
});

await check('定位不到考点时存成 unmatched，绝不挂靠同名考点', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '武昌起义');
  // 另一个计划里有同名同子考点，但 planId 不同：成绩只属于来源计划
  const other = plan({ id: 'plan-other', topics: [{ ...plan().topics[0], id: 'other-u1' }] });
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, plan: 'plan-deleted', tk, level: 'subtopic', unit: '辛亥革命', topic: '武昌起义', ...fullResult }),
    [other],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'unmatched');
  assert.equal(outcome.focus, undefined);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].status, 'unmatched');
  assert.equal(store.rows[0].resolution, undefined);
});

await check('考点被改名后不再匹配：即使标题路径与链接一致也不猜', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '武昌起义');
  const renamed = plan({
    topics: [{ ...plan().topics[0], subtopics: ['首义广场'], subtopicTree: [{ title: '首义广场' }] }],
  });
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'subtopic', unit: '辛亥革命', topic: '武昌起义', ...fullResult }),
    [renamed],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'unmatched');
  assert.equal(store.rows[0].status, 'unmatched');
});

await check('同一 attemptId 重复返回只保留一条记录', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '武昌起义');
  const url = link({ ...baseContext, tk, level: 'subtopic', unit: '辛亥革命', topic: '武昌起义', ...fullResult });
  const store = memoryStore();
  const first = await processInboundReturn(url, [plan()], { ...store, now: () => NOW_DATE });
  const second = await processInboundReturn(url, [plan()], { ...store, now: () => new Date('2026-11-04T09:00:00.000Z') });
  assert.equal(first.kind, 'recorded');
  assert.equal(second.kind, 'duplicate');
  assert.equal(store.rows.length, 1);
  // 重复返回不得覆盖首次接收时间或计数
  assert.equal(store.rows[0].receivedAt, NOW);
  assert.deepEqual(second.focus, first.focus);
});

await check('去重键是 attemptId：不同 attempt 即使同考点也各记一条', async () => {
  const tk = await keyFor('unit', '中国近代史', '五四运动', '五四运动');
  const store = memoryStore();
  const mk = (attempt: string, graded: string, correct: string) =>
    processInboundReturn(
      link({ ...baseContext, tk, level: 'unit', unit: '五四运动', topic: '五四运动', ...fullResult, attempt, graded, correct }),
      [plan()],
      { ...store, now: () => NOW_DATE }
    );
  assert.equal((await mk('a1111aaaa', '5', '4')).kind, 'recorded');
  assert.equal((await mk('a2222bbbb', '6', '1')).kind, 'recorded');
  assert.equal(store.rows.length, 2);
});

await check('只带定位上下文的回程：定位考点但不写任何成绩记录', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '二次革命');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'subtopic', unit: '辛亥革命', topic: '二次革命' }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'located');
  assert.equal(outcome.clearUrl, true);
  assert.deepEqual(outcome.focus, { planId: PLAN_ID, topicId: 'u1', subtopicTitle: '二次革命' });
  assert.equal(store.rows.length, 0);
});

await check('只定位且本机找不到：提示定位失败，仍清 URL 且不写库', async () => {
  const tk = await keyFor('unit', '中国近代史', '洋务运动', '洋务运动');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '洋务运动', topic: '洋务运动' }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'locate_unmatched');
  assert.equal(outcome.focus, undefined);
  assert.equal(store.rows.length, 0);
});

await check('非联动链接原样忽略，绝不动地址栏', async () => {
  const store = memoryStore();
  for (const search of ['', '?from=exam-plan&subject=x', '?plan=whatever', '?tk=t1_00000000000000000000000000000000']) {
    const outcome = await processInboundReturn(search, [plan()], { ...store, now: () => NOW_DATE });
    assert.equal(outcome.kind, 'none');
    assert.equal(outcome.handled, false);
    assert.equal(outcome.clearUrl, false);
  }
  assert.equal(store.rows.length, 0);
});

await check('协议版本不为 1 → 按非法联动处理并清 URL', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const params = { ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult };
  const search = `?${new URLSearchParams({ from: 'starquiz', v: '2', ...params }).toString()}`;
  const store = memoryStore();
  const outcome = await processInboundReturn(search, [plan()], { ...store, now: () => NOW_DATE });
  assert.equal(outcome.kind, 'invalid');
  assert.equal(outcome.clearUrl, true);
  assert.equal(store.rows.length, 0);
});

await check('拒绝畸形参数：钥匙格式、日期格式、控制字符、超长文本、越界时间', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const good = { ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult };
  const cases: Array<Record<string, string>> = [
    { tk: 't1_DEADBEEF' },
    { tk: 'T1_00000000000000000000000000000000' },
    { date: '2026-11-3' },
    { task: 'task\n注入' },
    { subject: 'X'.repeat(200) },
    { unit: '革'.repeat(500) },
    { attempt: 'a'.repeat(80) },
    { graded: '9999' },
    { at: '1970-01-01T00:00:00.000Z' },
    { at: '2999-01-01T00:00:00.000Z' },
    { at: 'not-a-date' },
  ];
  const store = memoryStore();
  for (const patch of cases) {
    const outcome = await processInboundReturn(link({ ...good, ...patch }), [plan()], { ...store, now: () => NOW_DATE });
    assert.equal(outcome.kind, 'invalid', `应拒绝：${JSON.stringify(patch)}`);
  }
  assert.equal(store.rows.length, 0);
});

await check('单元级链接里 topic 与 unit 不一致 → 拒绝（防止手改路径冒充）', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '武昌起义', ...fullResult }),
    [plan()],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'invalid');
});

await check('同规范化路径的两个单元造成歧义 → 不猜，存 unmatched', async () => {
  const tk = await keyFor('unit', '中国近代史', '重名专题', '重名专题');
  const ambiguous = plan({
    topics: [
      { id: 'dup1', title: '重名专题', weightPercentage: 5, difficulty: 'easy', estimatedHours: 1, subtopics: [] },
      { id: 'dup2', title: '重名专题', weightPercentage: 5, difficulty: 'easy', estimatedHours: 1, subtopics: [] },
    ],
  });
  assert.equal(await locateTopicTarget([ambiguous], { planId: PLAN_ID, topicKey: tk, path: { level: 'unit', exam: '', subject: '中国近代史', unit: '重名专题', topic: '重名专题' } }), null);
  const store = memoryStore();
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '重名专题', topic: '重名专题', ...fullResult }),
    [ambiguous],
    { ...store, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'unmatched');
});

await check('学科名与计划不一致时不定位（大小写与空白差异仍算同一学科）', async () => {
  const tk = await keyFor('unit', '世界史', '辛亥革命', '辛亥革命');
  const otherSubject = plan({ subject: '世界史' });
  const target = await locateTopicTarget([plan(), otherSubject], {
    planId: PLAN_ID,
    topicKey: tk,
    path: { level: 'unit', exam: '', subject: '世界史', unit: '辛亥革命', topic: '辛亥革命' },
  });
  assert.equal(target, null, '计划学科对不上就不该挂');
  const loose = await locateTopicTarget([plan()], {
    planId: PLAN_ID,
    topicKey: await keyFor('unit', '  中国近代史 ', '辛亥革命', '辛亥革命'),
    path: { level: 'unit', exam: '', subject: '中国近代史', unit: ' 辛亥革命 ', topic: '辛亥革命' },
  });
  assert.deepEqual(loose, { planId: PLAN_ID, topicId: 'u1' });
});

await check('写入失败：仍按 handled 清 URL 并给出保存失败提示', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult }),
    [plan()],
    { load: async () => [], save: async () => { throw new Error('quota'); }, now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'storage_error');
  assert.equal(outcome.clearUrl, true);
  assert.equal(outcome.notice?.messageKey, 'inboundStorageBody');
  assert.deepEqual(outcome.focus, { planId: PLAN_ID, topicId: 'u1' });
});

await check('读取失败也按写入失败处理，不静默吞掉成绩', async () => {
  const tk = await keyFor('unit', '中国近代史', '辛亥革命', '辛亥革命');
  const outcome = await processInboundReturn(
    link({ ...baseContext, tk, level: 'unit', unit: '辛亥革命', topic: '辛亥革命', ...fullResult }),
    [plan()],
    { load: async () => { throw new Error('db'); }, save: async () => ({ created: true, existing: null }), now: () => NOW_DATE }
  );
  assert.equal(outcome.kind, 'storage_error');
});

await check('parseReturnParams 把 URL 编码的中文与空格还原成规范参数', () => {
  const search = `?from=starquiz&v=1&plan=${PLAN_ID}&level=subtopic&subject=%E4%B8%AD%E5%9B%BD%E8%BF%91%E4%BB%A3%E5%8F%B2&unit=%E8%BE%9B%E4%BA%A5%E9%9D%A9%E5%91%BD&topic=%E6%AD%A6%E6%98%8C%20%E8%B5%B7%E4%B9%89&tk=t1_00000000000000000000000000000000`;
  const { parsed, invalid } = parseReturnParams(search);
  assert.equal(invalid, false);
  assert.equal(parsed?.path.subject, '中国近代史');
  assert.equal(parsed?.path.unit, '辛亥革命');
  assert.equal(parsed?.path.topic, '武昌 起义', '解码后保留内容里的单个空格');
  assert.equal(parsed?.planId, PLAN_ID);
});

await check('已落盘事件可重新定位回考点（刷新后仍能展开滚动）', async () => {
  const tk = await keyFor('subtopic', '中国近代史', '辛亥革命', '临时约法');
  const event: PracticeEvent = {
    schemaVersion: 1,
    attemptId: 'a9zzz0000',
    linkId: `${PLAN_ID}:${tk}`,
    planId: PLAN_ID,
    topicKey: tk,
    path: { level: 'subtopic', exam: '', subject: '中国近代史', unit: '辛亥革命', topic: '临时约法' },
    sourceContext: {},
    setId: '',
    graded: 2,
    correct: 1,
    completedAt: '2026-11-02T10:00:00.000Z',
    receivedAt: '2026-11-02T10:05:00.000Z',
    status: 'pending',
  };
  assert.deepEqual(await resolveEventFocus([plan()], event), { planId: PLAN_ID, topicId: 'u1', subtopicTitle: '临时约法' });
});

await check('落盘前的 sanitize 把畸形记录整条丢掉', () => {
  const tk = 't1_00000000000000000000000000000000';
  const base = {
    schemaVersion: 1,
    attemptId: 'a1',
    linkId: `p:${tk}`,
    planId: 'p',
    topicKey: tk,
    path: { level: 'unit', exam: '', subject: 's', unit: 'u', topic: 'u' },
    sourceContext: {},
    setId: '',
    graded: 2,
    correct: 1,
    completedAt: '2026-11-02T10:00:00.000Z',
    receivedAt: '2026-11-02T10:05:00.000Z',
    status: 'pending',
  };
  assert.ok(sanitizePracticeEvent(base));
  assert.equal(sanitizePracticeEvent({ ...base, status: 'completed' }), null);
  assert.equal(sanitizePracticeEvent({ ...base, linkId: `other:${tk}` }), null);
  assert.equal(sanitizePracticeEvent({ ...base, schemaVersion: 2 }), null);
  assert.equal(sanitizePracticeEvent({ ...base, correct: 3 }), null);
  assert.equal(sanitizePracticeEvent({ ...base, graded: 0 }), null);
  assert.equal(sanitizePracticeEvent({ ...base, completedAt: '刚刚' }), null);
  assert.equal(sanitizePracticeEvent({ ...base, path: { ...base.path, level: 'chapter' } }), null);
  assert.equal(sanitizePracticeEvent(null), null);
  assert.equal(sanitizePracticeEvent('nope'), null);
});

await check('提示文案键在双语词典里都存在', () => {
  const zh = translations.zh as Record<string, string>;
  const en = translations.en as Record<string, string>;
  const keys = [
    'inboundRecordedTitle', 'inboundRecordedBody',
    'inboundDuplicateTitle', 'inboundDuplicateBody',
    'inboundLocateTitle', 'inboundLocateBody',
    'inboundUnmatchedTitle', 'inboundUnmatchedBody', 'inboundLocateUnmatchedBody',
    'inboundStorageTitle', 'inboundStorageBody',
    'inboundInvalidTitle', 'inboundInvalidBody',
    'receiptEyebrow', 'receiptBody', 'receiptMeta', 'receiptUnmatchedBody',
    'receiptLocateAction', 'receiptDismissAction', 'receiptPendingTag', 'receiptUnmatchedTag', 'receiptCountTag',
  ];
  keys.forEach((key) => {
    assert.ok(zh[key] && zh[key].length > 0, `缺少中文文案：${key}`);
    assert.ok(en[key] && en[key].length > 0, `缺少英文文案：${key}`);
    const zhParams = (zh[key].match(/\{(\w+)\}/g) || []).sort().join(',');
    const enParams = (en[key].match(/\{(\w+)\}/g) || []).sort().join(',');
    assert.equal(zhParams, enParams, `双语占位符不一致：${key}`);
  });
});

console.log(`\n${passed} 项入站契约通过`);
