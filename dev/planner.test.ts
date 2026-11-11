// 无凭据 fixture 校验：用 tsx 运行（npm run test:planner）。
// 只测试纯函数规划核心（分段提示词构建 / 输入校验 / 结果归一化 / 本地重排兜底），
// 不触网、不需要 Deno 或任何 API Key。
import assert from 'node:assert/strict';
import {
  addDaysToDateString,
  buildPlanChunkPrompt,
  buildRebalancePrompt,
  buildStudyCalendar,
  buildTextbookTocPrompt,
  buildTextbookTreePrompt,
  buildUnitTreePrompt,
  buildUnitsPrompt,
  chunkAllMaterials,
  chunkStudyDays,
  dailyBudgetMinutes,
  dayStartClock,
  daysBetweenDateStrings,
  enforceDailyHourBudget,
  extractJson,
  fallbackRebalancePlan,
  mergeRebalanceTasks,
  normalizeDailySchedules,
  normalizePlanTasks,
  normalizeUnitTopic,
  parseLocalDate,
  PLANNING_WINDOW_DAYS,
  PlannerError,
  retrieveTopChunksForQuery,
  sanitizeMaterials,
  sanitizePlanChunkResult,
  sanitizePreferences,
  sanitizeRebalanceResult,
  sanitizeSyllabusResult,
  sanitizeTocResult,
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

check('教材目录提示词只回忆章节并禁止编造', () => {
  const prompt = buildTextbookTocPrompt('数据结构（C语言版）', '计算机考研 408', '数据结构', true);
  assert.ok(prompt.includes('数据结构（C语言版）'));
  assert.ok(prompt.includes('计算机考研 408'), '应带上备考的考试，权重才有依据');
  assert.ok(prompt.includes('TEXTBOOK RECALL RULES'), '教材回忆走另一套规矩');
  assert.ok(prompt.includes('Never invent page numbers'), '不许编页码题号');
  assert.ok(prompt.includes('"chapters"'), '输出章节目录形状');
  assert.ok(prompt.includes('简体中文'));
  assert.ok(!prompt.includes('GROUNDING RULES'), '没有原文时不该宣称接地');
  assert.ok(prompt.length <= 6_000, `prompt length ${prompt.length}`);
  const en = buildTextbookTocPrompt('Intro to Algorithms', '', '', false);
  assert.ok(!en.includes('简体中文'));
  assert.ok(buildTextbookTocPrompt('   ', '', '', false).includes('The course textbook'), '空教材名用占位，不让提示词断在引号里');
});

check('sanitizeTocResult 去重限量并把权重学时兜底', () => {
  const result = sanitizeTocResult({
    textbook: '数据结构（C语言版）',
    summary: '在线性表到图之间分配复习量。',
    confidence: 'weird',
    chapters: [
      { title: '第 1 章 绪论', sections: ['1.1', ' ', '1.3'], weightPercentage: 8, estimatedHours: 3 },
      { title: '第 1 章  绪论', weightPercentage: 50 },          // 大小写/空格同名，丢弃
      { title: '第 2 章 线性表', weightPercentage: 220, estimatedHours: 999, difficulty: 'brutal' },
      { title: '', estimatedHours: 4 },
      ...Array.from({ length: 20 }, (_, i) => ({ title: `第 ${i + 3} 章` })),
    ],
  });
  assert.equal(result.confidence, 'medium', '不认识的信心一律降级为 medium');
  assert.equal(result.chapters.length, 16, '章节限量，避免一次生成拖垮排程');
  assert.deepEqual(result.chapters[0].sections, ['1.1', '1.3']);
  assert.equal(result.chapters[1].weightPercentage, 100, '权重封顶 100');
  assert.equal(result.chapters[1].estimatedHours, 120, '学时封顶 120');
  assert.equal(result.chapters[1].difficulty, 'medium');
  assert.equal(result.chapters[2].title, '第 3 章');
  assert.deepEqual(result.chapters.map((c: any) => c.index), result.chapters.map((_: any, i: number) => i + 1), '重排后编号连续');
  assert.deepEqual(sanitizeTocResult(null).chapters, []);
});

check('buildTextbookTreePrompt 展开章节时不需要原文片段', () => {
  const chapter: SyllabusUnit = { ...sampleUnit, excerpts: '', source: 'textbook', sections: ['2.1 TCP 报文段', '2.2 可靠传输'] };
  const prompt = buildTextbookTreePrompt(chapter, '计算机网络（第 8 版）', 9, true);
  assert.ok(prompt.includes('计算机网络（第 8 版）'), '要知道是哪本教材');
  assert.ok(prompt.includes('第 2 章 传输层'));
  assert.ok(prompt.includes('chapter 2 of 9'));
  assert.ok(prompt.includes('2.1 TCP 报文段'), '把章节小标题交给模型，防止越界到别的章');
  assert.ok(prompt.includes('TEXTBOOK RECALL RULES'));
  assert.ok(prompt.includes('"weightPercentage": 35'), '权重学时原样保留，排程才认');
  assert.ok(!prompt.includes('no supporting excerpts'), '教材路径不该走资料缺失的措辞');
  assert.ok(buildTextbookTreePrompt({ ...chapter, sections: [] }, '', 9, true).includes('No section list was provided'));
});

check('考点来源标记只认三种且默认不写', () => {
  const topics = sanitizeTopics([
    { title: 'A', source: 'textbook', subtopics: ['a1'] },
    { title: 'B', source: 'manual', subtopics: ['b1'] },
    { title: 'C', source: 'material', subtopics: ['c1'] },
    { title: 'D', source: 'ai', subtopics: ['d1'] },
    { title: 'E', subtopics: ['e1'] },
  ]);
  assert.deepEqual(topics.map((t: any) => t.source), ['textbook', 'manual', 'material', undefined, undefined]);
  const topic = normalizeUnitTopic({ ...sampleUnit, source: 'textbook' }, { subtopics: ['TCP 握手'] });
  assert.equal(topic.source, 'textbook', '单元来源要一路带到考点，界面才分得清谁是谁回忆的');
});

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

check('sanitizePlanChunkResult 丢弃越界日期、清洗阶段并给空白天保底', () => {
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
  const modelTasks = result.tasks.filter((t: any) => !t.localScheduled);
  assert.equal(modelTasks.length, 1, JSON.stringify(modelTasks.map((t: any) => t.date)));
  assert.equal(modelTasks[0].date, allowed[0]);
  // 模型没排到的 allowed[1] 也是用户勾了 2 小时的学习日，不能空着
  const padded = result.tasks.filter((t: any) => t.localScheduled);
  assert.deepEqual(padded.map((t: any) => t.date), [allowed[1]], '空白学习日必须补一条本地任务');
  assert.equal(padded[0].durationMinutes, 45, '保底任务按单次时长给');
  assert.ok(padded[0].title.includes('薄弱点'), '中文环境下保底任务要说人话');
  assert.equal(result.phases.length, 1);
  assert.equal(result.phases[0].name, '基础阶段');
});

check('用户填的每日小时与休息日先归一化，预算和开钟都按它走', () => {
  const out = sanitizePreferences({
    ...rawPrefs,
    dailySchedules: [
      // 界面上是 number input，但历史数据/导入备份里什么都可能出现
      { dayOfWeek: 3, dayName: '周三', availableHours: '1', preferredTimeSlot: 'evening', enabled: true },
      { dayOfWeek: 0, dayName: '周日', availableHours: 0, preferredTimeSlot: 'morning', enabled: false },
      { dayOfWeek: 6, availableHours: 99 },
      { dayOfWeek: 9, availableHours: 3 },
    ],
  });
  const wednesday = out.dailySchedules.find((d: any) => d.dayOfWeek === 3);
  assert.equal(wednesday.availableHours, 1, '字符串小时也要认，否则整天预算作废');
  assert.equal(wednesday.preferredTimeSlot, 'evening');
  assert.equal(out.dailySchedules.find((d: any) => d.dayOfWeek === 0).enabled, false);
  const saturday = out.dailySchedules.find((d: any) => d.dayOfWeek === 6);
  assert.equal(saturday.availableHours, 12, '超界的小时截到 12');
  assert.equal(saturday.enabled, true, '缺 enabled 字段的老数据算学习日，不能凭空变休息');
  assert.equal(saturday.preferredTimeSlot, 'flexible', '没有时段就给兜底，不猜');
  assert.ok(!out.dailySchedules.some((d: any) => d.dayOfWeek === 9), '非法的星期序号丢掉');
  assert.equal(dailyBudgetMinutes(out, '2026-11-04'), 60, '周三 1 小时 = 60 分钟预算');
  assert.equal(dailyBudgetMinutes(out, '2026-11-08'), 0, '周日休息 = 没有预算');
  assert.equal(dayStartClock(out, '2026-11-04'), '19:00', '晚间时段该晚上开学');
  assert.equal(dayStartClock(out, '2026-11-07'), '09:00', '没设时段用兜底钟点');
  assert.deepEqual(normalizeDailySchedules(undefined), []);
});

check('每日时间预算：超了截短，休息日不排', () => {
  const tight = sanitizePreferences({
    ...rawPrefs,
    dailySchedules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      // 周三只留 1 小时，周日整天下线
      availableHours: dayOfWeek === 3 ? 1 : dayOfWeek === 0 ? 0 : 2,
      enabled: dayOfWeek !== 0,
    })),
  });
  const days = buildStudyCalendar(tight);
  assert.ok(!days.some((day) => parseLocalDate(day.date).getDay() === 0), '周日是休息日，不该进日历');
  assert.ok(!studyDatesFromCalendar(days).includes('2026-11-08'));

  const wednesday = days.find((day) => parseLocalDate(day.date).getDay() === 3)!.date;
  const saturday = days.find((day) => parseLocalDate(day.date).getDay() === 6)!.date;
  const out = enforceDailyHourBudget(
    [
      { id: 'a', title: '高', date: wednesday, durationMinutes: 45, priority: 'high', status: 'pending' },
      { id: 'b', title: '中', date: wednesday, durationMinutes: 45, priority: 'medium', status: 'pending' },
      { id: 'c', title: '低', date: wednesday, durationMinutes: 45, priority: 'low', status: 'pending' },
      { id: 'd', title: '休息日任务', date: '2026-11-08', durationMinutes: 45, priority: 'high', status: 'pending' },
      { id: 'e', title: '周六', date: saturday, durationMinutes: 120, priority: 'high', status: 'pending' },
    ],
    tight,
    [wednesday, saturday, '2026-11-08']
  );
  const wedTasks = out.tasks.filter((t: any) => t.date === wednesday);
  assert.equal(wedTasks.reduce((sum: number, t: any) => sum + t.durationMinutes, 0), 60, '周三只能占用填的 1 小时');
  assert.ok(wedTasks.some((t: any) => t.dayBudgetTrimmed), '尾部任务应被截短而不是整天欠着');
  assert.ok(!out.tasks.some((t: any) => t.id === 'd'), '休息日的任务要取消');
  assert.ok(!out.tasks.some((t: any) => t.id === 'c'), '低优先级的整条该撤掉');
  assert.equal(out.tasks.find((t: any) => t.id === 'e').durationMinutes, 120, '预算内不动原时长');
  assert.ok(out.droppedCount >= 2);

  // 重排路径不补保底任务，也不能吃掉已完成的历史
  const rebalanced = enforceDailyHourBudget(
    [
      { id: 'done', title: '已完成', date: wednesday, durationMinutes: 90, priority: 'high', status: 'completed' },
      { id: 'move', title: '搬过来', date: wednesday, durationMinutes: 90, priority: 'high', status: 'pending' },
    ],
    tight,
    [wednesday],
    { padEmptyDays: false, keepCompleted: true }
  );
  assert.ok(rebalanced.tasks.some((t: any) => t.id === 'done'), '已完成任务不受预算影响');
  assert.equal(rebalanced.tasks.find((t: any) => t.id === 'move').durationMinutes, 60);
});

check('学习日任务数按小时给，日历窗口放宽到 180 天', () => {
  const longRange = sanitizePreferences({
    ...rawPrefs,
    startDate: '2026-11-02',
    examDate: '2027-11-02',
    dailySchedules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      availableHours: dayOfWeek === 6 ? 10 : 1,
      enabled: true,
    })),
  });
  const days = buildStudyCalendar(longRange);
  assert.equal(days.length, PLANNING_WINDOW_DAYS, `窗口应封顶 ${PLANNING_WINDOW_DAYS} 天，实际 ${days.length}`);
  const saturday = days.find((day) => parseLocalDate(day.date).getDay() === 6)!;
  const monday = days.find((day) => parseLocalDate(day.date).getDay() === 1)!;
  const chunks = chunkStudyDays(days, { maxTasksPerChunk: 7, maxDaysPerChunk: 4, sessionLengthMinutes: 45 });
  const saturdayChunk = chunks.find((chunk) => chunk.dates.includes(saturday.date))!;
  const mondayChunk = chunks.find((chunk) => chunk.dates.includes(monday.date))!;
  assert.ok(saturdayChunk.expectedTasks > mondayChunk.expectedTasks, '10 小时的周六要比 1 小时的周一排得更满');
  assert.deepEqual(chunks.flatMap((chunk) => chunk.dates).length, days.length, '分段不能漏掉窗口里的任何一天');

  const prompt = buildPlanChunkPrompt(longRange, topics, [], [saturday, monday], { includePhases: false, isZh: true });
  assert.ok(prompt.includes('budget 600 min'), '提示词要把分钟预算写死');
  assert.ok(prompt.includes('budget 60 min'));
  assert.ok(prompt.includes('in up to 5 task'), '单日任务数封顶 5 条，10 小时也只给 5 段');
  assert.ok(prompt.includes('in up to 1 task'), '只有一小时的日子不该被拆成好几段');
  assert.ok(prompt.includes('A 5h Saturday and a 1h Wednesday must not get the same load'));
  assert.ok(!prompt.includes('Output 1-3 tasks'), '旧的固定 1-3 条说法要删干净');

  const padded = enforceDailyHourBudget([], longRange, [monday.date], { isZh: false });
  assert.ok(padded.tasks[0].title.includes('plan the day'), '英文环境别塞中文保底任务');
  assert.equal(padded.paddedDates.length, 1);
  const zhPadded = enforceDailyHourBudget([], longRange, [monday.date], { isZh: true });
  assert.ok(zhPadded.tasks[0].title.includes('梳理当天待办'), '中文环境保底任务要顺着界面语言走');
});

check('无资料的段不保留模型编造的出处', () => {
  const allowed = studyDatesFromCalendar(buildStudyCalendar(preferences)).slice(0, 2);
  const raw = {
    phases: [],
    tasks: [{
      id: 't1',
      title: '复习定义',
      date: allowed[0],
      durationMinutes: 45,
      category: 'reading',
      ragSource: { documentName: '并不存在的教材', sectionTitle: '第 9 章' },
      formulaOrRules: ['材料里没有的公式'],
    }],
  };
  const withoutMaterials = sanitizePlanChunkResult(raw, preferences, allowed, { hasMaterials: false });
  const modelTask = withoutMaterials.tasks.find((t: any) => !t.localScheduled)!;
  assert.equal(withoutMaterials.tasks.filter((t: any) => !t.localScheduled).length, 1);
  assert.equal(modelTask.ragSource, null, '没有资料时必须丢弃模型自报的出处');
  assert.deepEqual(modelTask.formulaOrRules, []);
  const withMaterials = sanitizePlanChunkResult(raw, preferences, allowed, { hasMaterials: true });
  assert.equal(withMaterials.tasks.find((t: any) => !t.localScheduled)!.ragSource.documentName, '并不存在的教材', '有资料时保留原样交给 UI');

  const days = buildStudyCalendar(preferences);
  const phasePrompt = buildPlanChunkPrompt(preferences, topics, [], days.slice(0, 2), { includePhases: true, isZh: true });
  assert.ok(phasePrompt.includes('contiguous and non-overlapping'), '阶段必须覆盖整段窗口而不是堆在前两天');
  assert.ok(phasePrompt.includes(String(preferences.examDate)), '阶段终点要用考试日');
  assert.ok(phasePrompt.includes('NO MATERIAL EXCERPTS WERE PROVIDED'), '没有资料时要明确禁止编造出处');
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
  // 提示文案规矩：报数、报日期，不带「您」、不带感叹号
  assert.ok(result.rebalanceSummary.includes('2 个学习日'), result.rebalanceSummary);
  assert.ok(result.rebalanceSummary.includes('2026-11-09'), result.rebalanceSummary);
  assert.ok(!/您|！/.test(result.rebalanceSummary), result.rebalanceSummary);
});

check('addDaysToDateString 跨月正确', () => {
  assert.equal(addDaysToDateString('2026-11-30', 1), '2026-12-01');
  assert.equal(daysBetweenDateStrings('2026-11-02', '2026-11-09'), 7);
});

console.log(`\n${passed} planner checks passed`);
