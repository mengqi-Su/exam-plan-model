// 无凭据 fixture 校验：用 tsx 运行（npm run test:planner）。
// 只测试纯函数规划核心（提示词构建 / 输入校验 / 结果归一化 / 本地重排兜底），
// 不触网、不需要 Deno 或 QODER_PAT。
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  buildPlanPrompt,
  buildRebalancePrompt,
  buildSyllabusPrompt,
  chunkAllMaterials,
  daysBetweenDateStrings,
  extractJson,
  fallbackRebalancePlan,
  normalizePlanTasks,
  parseLocalDate,
  PlannerError,
  retrieveTopChunksForQuery,
  sanitizeMaterials,
  sanitizePlanResult,
  sanitizePreferences,
  sanitizeRebalanceResult,
  sanitizeSyllabusResult,
  sanitizeTopics,
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

check('buildSyllabusPrompt 接地且长度受控', () => {
  const materials = sanitizeMaterials([material]);
  const prompt = buildSyllabusPrompt(materials, '计算机网络期末', '计算机网络', true);
  assert.ok(prompt.includes('计算机网络期末'));
  assert.ok(prompt.includes('GROUNDING RULES'));
  assert.ok(prompt.includes('简体中文'));
  assert.ok(prompt.length >= 50 && prompt.length <= 120_000, `prompt length ${prompt.length}`);
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

check('buildPlanPrompt 日历排除禁用日且长度受控', () => {
  const { prompt, studyDates } = buildPlanPrompt(preferences, topics, sanitizeMaterials([material]), true);
  assert.ok(studyDates.length > 0);
  for (const d of studyDates) {
    assert.notEqual(parseLocalDate(d).getDay(), 0, `周日不应出现在学习日历: ${d}`);
    assert.ok(daysBetweenDateStrings(preferences.startDate, d) >= 0);
    assert.ok(daysBetweenDateStrings(preferences.startDate, d) < daysBetweenDateStrings(preferences.startDate, preferences.examDate));
  }
  assert.ok(prompt.includes('PLANNING CALENDAR'));
  assert.ok(prompt.includes('RAG'));
  assert.ok(prompt.length >= 50 && prompt.length <= 120_000, `prompt length ${prompt.length}`);
});

check('sanitizePlanResult 归一化任务并统计覆盖率', () => {
  const { studyDates } = buildPlanPrompt(preferences, topics, sanitizeMaterials([material]), true);
  const firstDay = studyDates[0];
  const sunday = (() => {
    for (let i = 0; i < 7; i++) {
      const d = addDaysToDateString(preferences.startDate, i);
      if (parseLocalDate(d).getDay() === 0) return d;
    }
    return addDaysToDateString(preferences.startDate, 6);
  })();
  const aiOutput = {
    phases: [{ id: 'phase-1', name: '基础', description: 'd', startDate: firstDay, endDate: firstDay, focus: 'f' }],
    tasks: [
      { id: 'task-1', title: '阅读 OSI 模型', description: 'd', category: 'reading', topicTitle: '第 1 章 体系结构', date: firstDay, durationMinutes: 5, priority: 'high', status: 'pending', keyObjectives: ['理解七层'] },
      { id: 'task-1', title: '重复 ID 任务', description: 'd', category: 'bogus', topicTitle: 't', date: firstDay, durationMinutes: 999, priority: 'urgent', status: 'pending', keyObjectives: [] },
      { id: 'task-x', title: '考试当天任务', description: 'd', category: 'reading', topicTitle: 't', date: preferences.examDate, durationMinutes: 45, priority: 'low', status: 'pending', keyObjectives: [] },
      { id: 'task-sun', title: '禁用日任务', description: 'd', category: 'reading', topicTitle: 't', date: sunday, durationMinutes: 45, priority: 'low', status: 'pending', keyObjectives: [] },
      { id: 'task-bad', title: '非法日期', description: 'd', category: 'reading', topicTitle: 't', date: '2026/11/03', durationMinutes: 45, priority: 'low', status: 'pending', keyObjectives: [] },
    ],
    totalPlannedHours: 99,
  };
  const result = sanitizePlanResult(aiOutput, preferences, studyDates);
  // 仅 firstDay 的两个任务保留（考试当天/禁用日/非法日期被剔除）
  assert.equal(result.tasks.length, 2, JSON.stringify(result.tasks.map((t: any) => t.date)));
  assert.equal(result.tasks[0].durationMinutes, 45); // 5 -> 会话时长 45
  assert.equal(result.tasks[1].durationMinutes, 240); // 999 -> 上限 240
  assert.equal(result.tasks[1].category, 'reading'); // bogus -> reading
  assert.equal(result.tasks[1].priority, 'medium'); // urgent -> medium
  assert.notEqual(result.tasks[0].id, result.tasks[1].id); // 重复 ID 去重
  assert.equal(result.meta.coveredDays, 1);
  assert.equal(result.meta.planningDays, studyDates.length);
  assert.equal(result.totalPlannedHours, Math.round((45 + 240) / 60));
});

check('normalizePlanTasks 空输入返回空数组', () => {
  assert.deepEqual(normalizePlanTasks([], preferences), []);
});

check('buildRebalancePrompt 与 sanitizeRebalanceResult', () => {
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
  assert.ok(prompt.length <= 120_000);

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

console.log(`\n${passed} planner checks passed`);