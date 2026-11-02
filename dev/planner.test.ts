// 无凭据 fixture 校验：用 tsx 运行（npm run test:planner）。
// 只测试纯函数规划核心（分段提示词构建 / 输入校验 / 结果归一化 / 本地重排兜底），
// 不触网、不需要 Deno 或任何 API Key。
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  buildPlanChunkPrompt,
  buildRebalancePrompt,
  buildStudyCalendar,
  buildUnitTreePrompt,
  buildUnitsPrompt,
  chunkAllMaterials,
  chunkStudyDays,
  daysBetweenDateStrings,
  extractJson,
  fallbackRebalancePlan,
  mergeRebalanceTasks,
  normalizePlanTasks,
  normalizeUnitTopic,
  parseLocalDate,
  PlannerError,
  retrieveTopChunksForQuery,
  sanitizeMaterials,
  sanitizePlanChunkResult,
  sanitizePreferences,
  sanitizeRebalanceResult,
  sanitizeSyllabusResult,
  sanitizeTopics,
  sanitizeUnitsResult,
  selectUnitExcerpts,
  studyDatesFromCalendar,
  type SyllabusUnit,
} from '../functions/planner.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const material = {
  id: 'm1',
  name: '计算机网络考纲.md',
  type: 'syllabus',
  content: [
    '# 第 1 章 体系结构',
    'OSI 七层模型与 TCP/IP 四层模型的定义、各层功能与协议数据单元。',
    '封装与解封装过程，面向连接与无连接服务的区别。',
    '',
    '# 第 2 章 传输层',
    'TCP 三次握手与四次挥手公式推导，可靠传输机制：确认、重传、滑动窗口。',
    'UDP 无连接特性，拥塞控制算法（慢启动、拥塞避免）原理与计算题。',
    '',
    '# 第 3 章 网络层',
    'IP 地址分类与子网划分计算，路由选择协议 RIP/OSPF/BGP 机制对比。',
  ].join('\n'),
};

console.log('planner fixture checks');

check('extractJson 去除代码块与尾逗号', () => {
  const parsed: any = extractJson('前言\n```json\n{"summary":"s","topics":[{"id":"t1",}],}\n```');
  assert.equal(parsed.summary, 's');
  assert.equal(parsed.topics[0].id, 't1');
});

check('sanitizeMaterials 过滤空内容并限制数量', () => {
  const out = sanitizeMaterials([material, { id: 'm2', name: 'empty', type: 'notes', content: '   ' }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, '计算机网络考纲.md');
  assert.throws(() => sanitizeMaterials(new Array(25).fill(material)), PlannerError);
});

check('sanitizePreferences 校验日期范围', () => {
  const prefs = sanitizePreferences({ startDate: '2026-11-02', examDate: '2026-11-09', language: 'zh' });
  assert.equal(prefs.sessionLengthMinutes, 45);
  assert.throws(() => sanitizePreferences({ startDate: '2026-11-09', examDate: '2026-11-02' }), PlannerError);
  assert.throws(() => sanitizePreferences({ startDate: 'bad', examDate: '2026-11-09' }), PlannerError);
});

/* ---------------- 第一步：核心单元 ---------------- */

check('buildUnitsPrompt 接地、只要单元且长度受控', () => {
  const materials = sanitizeMaterials([material]);
  const prompt = buildUnitsPrompt(materials, '计算机网络期末', '计算机网络', true);
  assert.ok(prompt.includes('计算机网络期末'));
  assert.ok(prompt.includes('GROUNDING RULES'));
  assert.ok(prompt.includes('简体中文'));
  assert.ok(prompt.includes('"units"'));
  assert.ok(!prompt.includes('"subtopicTree"'), '单元阶段不应要求展开考点树');
  assert.ok(prompt.length >= 50 && prompt.length <= 120_000, `prompt length ${prompt.length}`);
});

check('sanitizeUnitsResult 清洗字段并限制数量', () => {
  const raw = {
    summary: '  覆盖三章内容。  ',
    units: [
      { id: 'u1', title: ' 第 1 章 体系结构 ', category: '网络', weightPercentage: '35.6', difficulty: 'hard', estimatedHours: '6' },
      { title: '' },
      ...Array.from({ length: 20 }, (_x, i) => ({ title: `单元 ${i}`, weightPercentage: 1, estimatedHours: 1 })),
    ],
  };
  const { summary, units } = sanitizeUnitsResult(raw);
  assert.equal(summary, '覆盖三章内容。');
  assert.equal(units.length, 14);
  assert.equal(units[0].title, '第 1 章 体系结构');
  assert.equal(units[0].weightPercentage, 36);
  assert.equal(units[0].difficulty, 'hard');
  assert.equal(units[0].estimatedHours, 6);
  assert.equal(units[0].unitIndex, 0);
  assert.equal(sanitizeUnitsResult(null).units.length, 0);
});

check('selectUnitExcerpts 取回该单元相关原文片段', () => {
  const chunks = chunkAllMaterials(sanitizeMaterials([material]));
  const text = selectUnitExcerpts({ title: '第 2 章 传输层', category: '传输', description: 'TCP 拥塞控制' }, chunks);
  assert.ok(text.includes('TCP') || text.includes('传输层'), text.slice(0, 120));
  assert.ok(text.length <= 14_000);
  assert.equal(selectUnitExcerpts({ title: 'x', category: '', description: '' }, []), '');
});

/* ---------------- 第二步：逐单元考点树 ---------------- */

const sampleUnit: SyllabusUnit = {
  id: 'unit-2',
  title: '第 2 章 传输层',
  category: '传输',
  description: 'TCP/UDP 与拥塞控制',
  weightPercentage: 35,
  difficulty: 'hard',
  estimatedHours: 8,
  unitIndex: 1,
  excerpts: '[1] Source: "计算机网络考纲.md" (syllabus) | Heading: "第 2 章 传输层"\nTCP 三次握手与拥塞控制算法。',
};

check('buildUnitTreePrompt 只展开当前单元并复用片段', () => {
  const prompt = buildUnitTreePrompt(sampleUnit, 3, true);
  assert.ok(prompt.includes('第 2 章 传输层'));
  assert.ok(prompt.includes('unit 2 of 3'));
  assert.ok(prompt.includes('TCP 三次握手'), '应带上预选的原文片段');
  assert.ok(prompt.includes('"weightPercentage": 35'), '单元权重需原样保留');
  assert.ok(prompt.length <= 30_000, `prompt length ${prompt.length}`);
  assert.ok(buildUnitTreePrompt({ ...sampleUnit, excerpts: '' }, 3, true).includes('no supporting excerpts'));
});

check('normalizeUnitTopic 以单元字段为准并补齐子树', () => {
  const topic = normalizeUnitTopic(sampleUnit, {
    title: 'AI 改写的标题',
    description: '细分考点说明',
    subtopics: ['TCP 握手', '拥塞控制'],
    subtopicTree: [{ title: '慢启动', keyPoints: ['cwnd 指数增长'], difficulty: 'hard', examFrequency: 'high' }],
  });
  assert.equal(topic.id, 'unit-2');
  assert.equal(topic.title, '第 2 章 传输层');
  assert.equal(topic.weightPercentage, 35);
  assert.equal(topic.estimatedHours, 8);
  assert.equal(topic.difficulty, 'hard');
  assert.equal(topic.subtopics.length, 2);
  assert.equal(topic.subtopicTree.length, 1);
  assert.equal(topic.subtopicTree[0].keyPoints.length, 1);
  assert.equal(normalizeUnitTopic(sampleUnit, { title: '' }), null);
});

check('sanitizeSyllabusResult 回填 subtopicTree 并过滤无效考点', () => {
  const result = sanitizeSyllabusResult({
    summary: '覆盖体系结构、传输层与网络层。',
    topics: [
      { title: '第 1 章 体系结构', difficulty: 'easy', subtopics: ['1.1 OSI 模型', '1.2 封装'] },
      { title: '   ' },
      { title: '第 2 章 传输层', subtopicTree: [{ title: 'TCP 握手' }] },
    ],
  });
  assert.equal(result.topics.length, 2);
  assert.equal(result.topics[0].subtopicTree.length, 2);
  assert.equal(result.topics[0].id, 'topic-1');
  assert.deepEqual(result.topics[1].subtopics, ['TCP 握手']);
});

// 偏好：周日(0)禁用，其余每天 2 小时
const rawPrefs = {
  examName: '计算机网络期末',
  subject: '计算机网络',
  startDate: '2026-11-02',
  examDate: '2026-11-09',
  examTime: '09:00',
  sessionLengthMinutes: 45,
  language: 'zh',
  weakTopicsFocus: ['传输层'],
  userNeedFocusArea: 'comprehensive',
  customPromptRequirement: '重点突破计算题',
  dailySchedules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek !== 0,
    availableHours: 2,
  })),
};
const preferences = sanitizePreferences(rawPrefs);
const topics = sanitizeTopics([
  { id: 'topic-1', title: '第 1 章 体系结构', difficulty: 'easy', subtopics: ['OSI 模型'], estimatedHours: 4 },
  { id: 'topic-2', title: '第 2 章 传输层', difficulty: 'hard', subtopics: ['TCP 握手', '拥塞控制'], estimatedHours: 8 },
]);

check('资料分块与检索命中相关章节', () => {
  const chunks = chunkAllMaterials(sanitizeMaterials([material]));
  assert.ok(chunks.length >= 2);
  const top = retrieveTopChunksForQuery('TCP 拥塞控制 传输层', chunks, { topK: 2 });
  assert.ok(top.length > 0);
  assert.ok(top.some((c) => c.content.includes('TCP') || c.sectionTitle.includes('传输层')));
});

/* ---------------- 排程日历与分段 ---------------- */

check('buildStudyCalendar 排除禁用日且不超过考试日', () => {
  const days = buildStudyCalendar(preferences);
  const studyDates = studyDatesFromCalendar(days);
  assert.ok(studyDates.length > 0);
  for (const d of studyDates) {
    assert.notEqual(parseLocalDate(d).getDay(), 0, `周日不应出现在学习日历: ${d}`);
    assert.ok(daysBetweenDateStrings(preferences.startDate, d) >= 0);
    assert.ok(daysBetweenDateStrings(preferences.startDate, d) < daysBetweenDateStrings(preferences.startDate, preferences.examDate));
  }
  assert.equal(days.every((day) => day.availableHours > 0), true);
});

check('chunkStudyDays 段内任务与天数都有上限', () => {
  const longRange = sanitizePreferences({
    ...rawPrefs,
    startDate: '2026-11-02',
    examDate: '2026-12-02',
  });
  const days = buildStudyCalendar(longRange);
  const chunks = chunkStudyDays(days, { maxTasksPerChunk: 7, maxDaysPerChunk: 4, sessionLengthMinutes: 45 });
  assert.ok(chunks.length > 1);
  assert.equal(chunks.reduce((sum, c) => sum + c.dates.length, 0), days.length);
  assert.ok(chunks.every((c) => c.dates.length <= 4 && c.expectedTasks <= 7));
  // 段与段之间不重叠，且整体保持日历顺序
  const flat = chunks.flatMap((c) => c.dates);
  assert.equal(new Set(flat).size, flat.length);
  assert.deepEqual(flat, studyDatesFromCalendar(days));
  assert.deepEqual(chunkStudyDays([], {}), []);
});

check('buildPlanChunkPrompt 只排本段日期并控制阶段输出', () => {
  const days = buildStudyCalendar(preferences);
  const firstChunk = days.slice(0, 2);
  const prompt = buildPlanChunkPrompt(preferences, topics, sanitizeMaterials([material]), firstChunk, {
    includePhases: true,
    coveredTopicTitles: ['第 1 章 体系结构'],
    isZh: true,
  });
  assert.ok(prompt.includes('PLANNING CALENDAR'));
  for (const day of firstChunk) assert.ok(prompt.includes(day.date), `缺少日期 ${day.date}`);
  assert.ok(!prompt.includes(days[days.length - 1].date), '不该把整段日历都塞进单次调用');
  assert.ok(prompt.includes('GROUNDING RULES'));
  assert.ok(prompt.includes('第 1 章 体系结构'), '应带上已排过的考点以避免重复');
  assert.ok(prompt.length >= 50 && prompt.length <= 60_000, `prompt length ${prompt.length}`);

  const later = buildPlanChunkPrompt(preferences, topics, sanitizeMaterials([material]), firstChunk, {
    includePhases: false,
    isZh: true,
  });
  assert.ok(later.includes('Do NOT output phases'));
});

check('sanitizePlanChunkResult 丢弃越界日期并清洗阶段', () => {
  const studyDates = studyDatesFromCalendar(buildStudyCalendar(preferences));
  const allowed = studyDates.slice(0, 2);
  const result = sanitizePlanChunkResult(
    {
      phases: [
        { name: ' 基础阶段 ', startDate: allowed[0], endDate: allowed[1], focus: '概念' },
        { name: '' },
      ],
      tasks: [
        { id: 't1', title: 'OSI 分层', date: allowed[0], durationMinutes: 45, category: 'reading', priority: 'high', status: 'pending' },
        { id: 't2', title: '越界日期任务', date: studyDates[studyDates.length - 1], durationMinutes: 45, category: 'reading' },
        { id: 't3', title: '', date: allowed[1], durationMinutes: 45 },
      ],
    },
    preferences,
    allowed
  );
  assert.equal(result.tasks.length, 1, JSON.stringify(result.tasks.map((t: any) => t.date)));
  assert.equal(result.tasks[0].date, allowed[0]);
  assert.equal(result.phases.length, 1);
  assert.equal(result.phases[0].name, '基础阶段');
});

check('normalizePlanTasks 空输入返回空数组', () => {
  assert.deepEqual(normalizePlanTasks([], preferences), []);
});

/* ---------------- 重排 ---------------- */

check('buildRebalancePrompt 只提交未完成任务', () => {
  const currentPlan = {
    examName: '计算机网络期末',
    subject: '计算机网络',
    examDate: '2026-11-09',
    preferences: { dailySchedules: rawPrefs.dailySchedules },
    tasks: [
      { id: 'a', title: '已完成', category: 'reading', topicTitle: 't', date: '2026-11-01', durationMinutes: 45, priority: 'high', status: 'completed' },
      { id: 'b', title: '积压', category: 'reading', topicTitle: 't', date: '2026-11-01', durationMinutes: 45, priority: 'low', status: 'pending' },
    ],
  };
  const prompt = buildRebalancePrompt(currentPlan, '2026-11-02', ' missed tasks ', true);
  assert.ok(prompt.includes('2026-11-02'));
  assert.ok(prompt.includes('简体中文'));
  assert.ok(prompt.includes('"id": "b"') || prompt.includes('"id":"b"'), '未完成任务应进入提示词');
  assert.ok(!prompt.includes('"已完成"'), '已完成任务不应重复提交');
  assert.ok(prompt.length <= 60_000, `prompt length ${prompt.length}`);
});

check('mergeRebalanceTasks 保留已完成并只改日期', () => {
  const current = [
    { id: 'a', title: '已完成', date: '2026-11-01', status: 'completed', priority: 'high', durationMinutes: 45 },
    { id: 'b', title: '积压', date: '2026-11-01', status: 'pending', priority: 'low', durationMinutes: 45 },
    { id: 'c', title: '未提及', date: '2026-11-05', status: 'pending', priority: 'medium', durationMinutes: 60 },
  ];
  const merged = mergeRebalanceTasks(current, [
    { id: 'b', date: '2026-11-03', startTime: '09:00', endTime: '09:45', durationMinutes: 45, priority: 'high', status: 'pending' },
    { id: 'b', date: 'bad-date' },
    { id: '', date: '2026-11-04' },
  ]);
  assert.equal(merged.find((t: any) => t.id === 'a').date, '2026-11-01');
  assert.equal(merged.find((t: any) => t.id === 'b').date, '2026-11-03');
  assert.equal(merged.find((t: any) => t.id === 'b').priority, 'high');
  assert.equal(merged.find((t: any) => t.id === 'b').title, '积压', '标题等字段保持不变');
  assert.equal(merged.find((t: any) => t.id === 'c').date, '2026-11-05');
});

check('sanitizeRebalanceResult 补齐任务 ID', () => {
  const result = sanitizeRebalanceResult({ rebalanceSummary: '已重排', tasks: [{ title: 'x', date: '2026-11-03' }, { title: 'y' }] });
  assert.equal(result.tasks.length, 2);
  assert.ok(result.tasks.every((t: any) => typeof t.id === 'string' && t.id.length > 0));
});

check('fallbackRebalancePlan 保留已完成并重排积压', () => {
  const currentPlan = {
    examName: '计算机网络期末',
    examDate: '2026-11-09',
    language: 'zh',
    tasks: [
      { id: 'a', title: '已完成', date: '2026-11-01', status: 'completed', priority: 'high' },
      { id: 'b', title: '积压1', date: '2026-11-01', status: 'pending', priority: 'low' },
      { id: 'c', title: '积压2', date: '2026-11-01', status: 'pending', priority: 'low' },
    ],
  };
  const result = fallbackRebalancePlan(currentPlan, '2026-11-02', '');
  assert.equal(result.tasks.length, 3);
  const completed = result.tasks.find((t: any) => t.id === 'a');
  assert.equal(completed.date, '2026-11-01'); // 已完成日期不变
  const pending = result.tasks.filter((t: any) => t.status === 'pending');
  assert.ok(pending.every((t: any) => t.date >= '2026-11-02'));
  assert.ok(pending.every((t: any) => t.priority === 'medium')); // low -> medium
  assert.ok(result.rebalanceSummary.includes('重排'));
});

check('addDaysToDateString 跨月正确', () => {
  assert.equal(addDaysToDateString('2026-11-30', 1), '2026-12-01');
  assert.equal(daysBetweenDateStrings('2026-11-02', '2026-11-09'), 7);
});

console.log(`\n${passed} planner checks passed`);
