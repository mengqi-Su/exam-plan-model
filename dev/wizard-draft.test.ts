// 向导草稿回归：npm run test:draft
// FUN-05 说的是同一件事：资料解析好的正文只值一次刷新。
// 草稿落盘前后必须长得一样——接回来的那份不能多出一个字段、少一份资料，
// 更不能把「2026-13-99」这种日期悄悄顺延成真实存在的一天。这份测试守的就是这条往返不变式。
import assert from 'node:assert/strict';
import {
  WIZARD_DRAFT_CHAR_BUDGET,
  isWizardDraftFresh,
  sanitizeWizardDraft,
} from '../src/lib/wizardDraft.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const DAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 界面上的周计划就长这样：星期名是当前语言算出来的那一份，所以草稿往返应当一模一样
const schedulesZh = [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
  dayOfWeek,
  dayName: DAY_ZH[dayOfWeek],
  availableHours: 3,
  preferredTimeSlot: 'morning' as const,
  enabled: dayOfWeek !== 0,
}));

const fullDraft = () => ({
  schemaVersion: 1,
  id: 'current',
  updatedAt: '2026-11-08T10:00:00.000Z',
  step: 3,
  examName: '导游基础知识',
  subject: '历史',
  startDate: '2026-11-08',
  examDate: '2026-12-20',
  examTime: '09:30',
  targetScore: '90+',
  requirements: '只要中国部分',
  dailySchedules: schedulesZh,
  materials: [
    {
      id: 'mat-1',
      name: '考纲.pdf',
      type: 'syllabus' as const,
      categoryGroup: 'course_syllabus' as const,
      content: '第一章 全国导游基础知识……',
      sizeBytes: 12345,
      uploadedAt: '2026-11-08T09:00:00.000Z',
      difficulty: 'medium' as const,
      summaryNotes: '第一章 全国导游……',
    },
  ],
  aiSelectedIds: ['mat-1'],
  topics: [
    {
      id: 'topic-1',
      title: '全国导游基础知识',
      weightPercentage: 40,
      difficulty: 'hard' as const,
      subtopics: ['导游服务', '政策法律'],
      estimatedHours: 12,
      source: 'material' as const,
      subtopicTree: [{ id: 'sub-1', title: '导游服务', keyPoints: ['地陪流程'], difficulty: 'easy' as const }],
    },
  ],
  textbookLabel: '全国导游基础知识（第七版）',
});

check('一份完整草稿原样往返：字段不多不少，资料与考点都还在', () => {
  const draft = sanitizeWizardDraft(fullDraft());
  assert.ok(draft);
  assert.deepEqual(
    draft,
    { ...fullDraft(), materials: [fullDraft().materials[0]], topics: [fullDraft().topics[0]] }
  );
  assert.equal(draft.droppedMaterials, undefined);
});

check('结构不对、版本不对：等于没有草稿，而不是一个空表单', () => {
  assert.equal(sanitizeWizardDraft(null), null);
  assert.equal(sanitizeWizardDraft('草稿'), null);
  assert.equal(sanitizeWizardDraft(42), null);
  assert.equal(sanitizeWizardDraft({ ...fullDraft(), schemaVersion: 2 }), null);
});

check('脏类型不炸：每个字段退回空值，草稿本身仍然接得回来', () => {
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    examName: 123,
    requirements: { a: 1 },
    materials: '不是数组',
    topics: [null, 7],
    aiSelectedIds: [null],
    step: 99,
  });
  assert.ok(draft);
  assert.equal(draft.examName, '');
  assert.equal(draft.requirements, '');
  assert.deepEqual(draft.materials, []);
  assert.deepEqual(draft.topics, []);
  assert.deepEqual(draft.aiSelectedIds, []);
  assert.equal(draft.step, 1);
});

check('资料正文是空的：整条丢掉并计数，绝不补一份假内容', () => {
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    materials: [
      fullDraft().materials[0],
      { id: 'mat-2', name: '空白.pdf', type: 'notes', content: '   ', uploadedAt: '' },
      { id: '', name: '没有 id.pdf', type: 'notes', content: '有内容' },
      { id: 'mat-4', name: '', type: 'notes', content: '有内容' },
    ],
  });
  assert.equal(draft.materials.length, 1);
  assert.equal(draft.droppedMaterials, 3);
  assert.equal(draft.materials[0].id, 'mat-1');
});

check('指纹跟着草稿一起往返：认不得的指纹就丢掉，别当身份证用', () => {
  const hashed = { ...fullDraft().materials[0], contentHash: 'a'.repeat(64) };
  const kept = sanitizeWizardDraft({ ...fullDraft(), materials: [hashed] });
  assert.equal(kept.materials[0].contentHash, 'a'.repeat(64), '刷新一次不该让资料重新算一遍指纹');
  const broken = { ...fullDraft().materials[0], contentHash: `${'A'.repeat(63)}g` };
  const cleaned = sanitizeWizardDraft({ ...fullDraft(), materials: [broken] });
  assert.equal(cleaned.materials[0].contentHash, undefined);
  assert.equal(cleaned.materials[0].id, 'mat-1', '指纹坏掉不该连累整条资料：去重会退回逐字比正文');
});

check('勾选只认还活着的资料：丢掉的文件不会留下一个空勾', () => {
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    materials: [fullDraft().materials[0], { id: 'mat-9', name: '讲义.pptx', type: 'lecture_slides', content: '正文', uploadedAt: '' }],
    aiSelectedIds: ['mat-9', 'mat-1', '早就删掉的'],
  });
  assert.deepEqual(draft.aiSelectedIds, ['mat-9', 'mat-1']);
});

check('超过字数预算的资料不硬塞：按上传顺序保留，剩下的份数如实记下来', () => {
  const chunk = 'x'.repeat(Math.floor(WIZARD_DRAFT_CHAR_BUDGET / 2) + 10);
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    materials: [
      { id: 'm1', name: 'a.pdf', type: 'notes', content: chunk, uploadedAt: '' },
      { id: 'm2', name: 'b.pdf', type: 'notes', content: chunk, uploadedAt: '' },
      { id: 'm3', name: 'c.pdf', type: 'notes', content: chunk, uploadedAt: '' },
    ],
    aiSelectedIds: ['m1', 'm2', 'm3'],
  });
  assert.equal(draft.materials.length, 1);
  assert.equal(draft.materials[0].id, 'm1');
  assert.equal(draft.droppedMaterials, 2);
  assert.deepEqual(draft.aiSelectedIds, ['m1']);
});

check('考点：缺标题的丢掉，越界的数字夹紧，认不出的来源留空', () => {
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    topics: [
      { ...fullDraft().topics[0], weightPercentage: 150, estimatedHours: -5 },
      { id: 'topic-2', title: '   ' },
      { id: 'topic-3', title: '地方导游基础知识', source: '胡来的来源', difficulty: '史诗难度' },
    ],
  });
  assert.equal(draft.topics.length, 2);
  assert.equal(draft.topics[0].weightPercentage, 100);
  assert.equal(draft.topics[0].estimatedHours, 0);
  assert.equal(draft.topics[1].source, undefined);
  assert.equal(draft.topics[1].difficulty, 'medium');
  // subtopicTree 里没有标题的节点不该留在草稿里
  assert.deepEqual(draft.topics[0].subtopicTree, fullDraft().topics[0].subtopicTree);
});

check('周计划只认完整七天：缺一天、重复一天都退回默认周模板', () => {
  const six = sanitizeWizardDraft({ ...fullDraft(), dailySchedules: schedulesZh.slice(0, 6) });
  assert.equal(six.dailySchedules.length, 7);
  assert.equal(six.dailySchedules[0].availableHours, 2);

  const duplicated = schedulesZh.map((day) => ({ ...day, dayOfWeek: day.dayOfWeek === 3 ? 2 : day.dayOfWeek }));
  const dup = sanitizeWizardDraft({ ...fullDraft(), dailySchedules: duplicated });
  assert.equal(new Set(dup.dailySchedules.map((day) => day.dayOfWeek)).size, 7);
  assert.equal(dup.dailySchedules[0].availableHours, 2);

  // 合法的那份不动：休息日还是休息日，只是小时数过一道标尺
  const kept = sanitizeWizardDraft({ ...fullDraft(), dailySchedules: schedulesZh });
  assert.equal(kept.dailySchedules.length, 7);
  assert.deepEqual(kept.dailySchedules.map((day) => day.dayOfWeek), [1, 2, 3, 4, 5, 6, 0]);
  assert.equal(kept.dailySchedules[6].enabled, false);
});

check('12 小时是上限：草稿里的 99 小时退回 12，不是让排程去猜', () => {
  const draft = sanitizeWizardDraft({
    ...fullDraft(),
    dailySchedules: schedulesZh.map((day) => ({ ...day, availableHours: 99 })),
  });
  assert.equal(draft.dailySchedules[0].availableHours, 12);
});

check('星期名按当前语言重写：接回英文界面的草稿不会带着「周一」', () => {
  const en = sanitizeWizardDraft({ ...fullDraft(), dailySchedules: schedulesZh }, { isZh: false });
  assert.equal(en.dailySchedules[0].dayName, 'Monday');
  const zh = sanitizeWizardDraft({ ...fullDraft(), dailySchedules: schedulesZh }, { isZh: true });
  assert.equal(zh.dailySchedules[0].dayName, '周一');
});

check('日期要日历上真有这一天：2026-13-99 不写回来，也不悄悄顺延成 2027-04-08', () => {
  const draft = sanitizeWizardDraft({ ...fullDraft(), startDate: '2026-13-99', examDate: '2026-11-20' });
  assert.equal(draft.startDate, '');
  assert.equal(draft.examDate, '2026-11-20');
  // 分隔符写歪了也一样不认：草稿里的日期必须是输入框那种 YYYY-MM-DD，不然接回来的是个对不上的日子
  const slashed = sanitizeWizardDraft({ ...fullDraft(), examDate: '2026-11-20'.replace(/-/g, '/') });
  assert.equal(slashed.examDate, '');
});

check('文本按输入框的上限认：超长的那条直接不算数，不剪一半留给用户', () => {
  const draft = sanitizeWizardDraft({ ...fullDraft(), examName: '名'.repeat(201), requirements: '要'.repeat(2001) });
  assert.equal(draft.examName, '');
  assert.equal(draft.requirements, '');
  assert.equal(sanitizeWizardDraft({ ...fullDraft(), examName: '名'.repeat(200) }).examName.length, 200);
});

check('草稿新鲜度：三周没回来就作废，脏时间戳当作不新鲜', () => {
  const now = new Date(2026, 10, 8, 10, 0);
  const fresh = sanitizeWizardDraft({ ...fullDraft(), updatedAt: '2026-11-08T09:00:00.000Z' });
  assert.equal(isWizardDraftFresh(fresh, now), true);
  const old = sanitizeWizardDraft({ ...fullDraft(), updatedAt: '2026-10-10T09:00:00.000Z' });
  assert.equal(isWizardDraftFresh(old, now), false);
  const garbage = sanitizeWizardDraft({ ...fullDraft(), updatedAt: '不是时间' });
  // 时间戳读不出来就照实留空：这份草稿认不出年龄，接回来那关会直接把它丢掉，
  // 而不是盖一个「刚存的」把不知道哪天填的表单装作新鲜。
  assert.equal(garbage.updatedAt, '');
  assert.equal(isWizardDraftFresh(garbage, now), false);
  assert.equal(isWizardDraftFresh({ ...fresh, updatedAt: '随手写的' }, now), false);
});

console.log(`\n向导草稿回归：${passed} 项通过`);
