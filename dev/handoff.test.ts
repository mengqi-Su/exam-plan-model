// 考试级联动快照回归：npm run test:handoff
// 覆盖「点考点链接时随跳转一起交给 StarQuiz 的本地快照」：
// 哪些资料会过去、预算不够时先保谁、没有资料/没有计划时的退化行为，
// 以及标签页名字这一次性通道的写入与清空。全程不涉及任何网络。
import assert from 'node:assert/strict';
import {
  HANDOFF_LIMITS,
  HANDOFF_PROTOCOL,
  HANDOFF_VERSION,
  buildExamHandoffSnapshot,
  clearHandoffWindow,
  encodeExamHandoffSnapshot,
  primeHandoffForPractice,
  primeHandoffForTask,
  primeHandoffWindow,
} from '../src/lib/handoff.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const long = (marker: string, chars = 800) => `${marker}${'。'.repeat(chars)}`;
const paper = { id: 'm-paper', name: '数据结构期末A卷.pdf', type: 'past_exam', categoryGroup: 'exam_question', content: long('一、选择题', 600), uploadedAt: '2026-11-01T00:00:00.000Z' };
const notes = { id: 'm-notes', name: '栈与队列讲义.txt', type: 'notes', content: long('栈是受限的线性表', 400), uploadedAt: '2026-11-01T00:00:00.000Z' };
const slides = { id: 'm-slides', name: '串与数组.pptx', type: 'lecture_slides', content: long('串的定义', 300), uploadedAt: '2026-11-01T00:00:00.000Z' };

const plan = {
  id: 'plan-1730000000000',
  examName: '数据结构期末',
  subject: '计算机',
  preferences: { subject: '计算机' },
  topics: [
    { id: 'unit-1', title: '线性表', subtopics: ['栈与队列'], subtopicTree: [{ title: '栈与队列' }] },
  ],
  materials: [notes, paper, slides],
};

console.log('考试级联动快照');

check('快照带齐考试信息与全部资料，真题排在最前', () => {
  const snap = buildExamHandoffSnapshot(plan, { level: 'subtopic', unit: '线性表', topic: '栈与队列' });
  assert.ok(snap);
  assert.equal(snap!.protocol, HANDOFF_PROTOCOL);
  assert.equal(snap!.version, HANDOFF_VERSION);
  assert.equal(snap!.planId, 'plan-1730000000000');
  assert.equal(snap!.exam, '数据结构期末');
  assert.equal(snap!.subject, '计算机');
  assert.equal(snap!.level, 'subtopic');
  assert.equal(snap!.unit, '线性表');
  assert.equal(snap!.topic, '栈与队列');
  assert.equal(snap!.materials.length, 3);
  assert.deepEqual(snap!.materials.map((m) => m.name), [paper.name, notes.name, slides.name]);
  assert.deepEqual(snap!.materials.map((m) => m.kind), ['exam', 'note', 'note']);
  assert.deepEqual(snap!.omitted, []);
});

check('空文本、纯空白和字数不足的资料不带过去', () => {
  const snap = buildExamHandoffSnapshot(
    { ...plan, materials: [{ id: 'x', name: '扫描件.pdf', type: 'notes', content: '   \n  ' }, { id: 'y', name: '封面.txt', type: 'notes', content: '只有几行字' }, notes] },
    {}
  );
  assert.equal(snap!.materials.length, 1);
  assert.equal(snap!.materials[0].name, notes.name);
});

check('超过单份上限的资料截断并标记，不整份丢掉', () => {
  const fat = { id: 'fat', name: 'long.txt', type: 'notes', content: '字'.repeat(HANDOFF_LIMITS.charsPerMaterial + 5_000) };
  const snap = buildExamHandoffSnapshot({ ...plan, materials: [fat] }, {});
  const piece = snap!.materials[0];
  assert.equal(piece.text.length, HANDOFF_LIMITS.charsPerMaterial);
  assert.equal(piece.truncated, true);
  assert.equal(piece.chars, HANDOFF_LIMITS.charsPerMaterial);
});

check('总量闸门先保真题，挤不下的记进 omitted', () => {
  const filler = Array.from({ length: 12 }, (_, i) => ({
    id: `n-${i}`,
    name: `讲义${i}.txt`,
    type: 'notes',
    content: '字'.repeat(HANDOFF_LIMITS.charsPerMaterial),
  }));
  const snap = buildExamHandoffSnapshot({ ...plan, materials: [...filler, paper] }, {});
  assert.equal(snap!.materials[0].name, paper.name, '真题必须第一个占预算');
  assert.ok(snap!.materials.length < 13);
  const carried = new Set(snap!.materials.map((m) => m.name));
  snap!.omitted.forEach((name) => assert.ok(!carried.has(name), `omitted 里的资料不该同时带过去：${name}`));
  let total = 0;
  snap!.materials.forEach((m) => { total += m.chars; });
  assert.ok(total <= HANDOFF_LIMITS.totalChars);
});

check('份数闸门按 maxMaterials 生效，多出来的记进 omitted', () => {
  const many = Array.from({ length: HANDOFF_LIMITS.materials + 3 }, (_, i) => ({
    id: `m-${i}`,
    name: `小抄${i}.txt`,
    type: 'notes',
    content: '字'.repeat(60),
  }));
  const snap = buildExamHandoffSnapshot({ ...plan, materials: many }, {});
  assert.equal(snap!.materials.length, HANDOFF_LIMITS.materials);
  assert.equal(snap!.omitted.length, 3);
});

check('没有资料或没有计划 id 时不给快照，链接自然退化', () => {
  assert.equal(buildExamHandoffSnapshot({ ...plan, materials: [] }, {}), null);
  assert.equal(buildExamHandoffSnapshot({ ...plan, materials: undefined }, {}), null);
  assert.equal(buildExamHandoffSnapshot({ ...plan, id: '' }, {}), null);
  // 考试名和学科都为空（含 preferences 兜底）就没有「哪一场考试」可认，不带快照
  assert.equal(buildExamHandoffSnapshot({ ...plan, examName: '', subject: '', preferences: {} }, {}), null);
  assert.equal(buildExamHandoffSnapshot(null, {}), null);
  assert.equal(buildExamHandoffSnapshot({ ...plan, materials: '不是数组' as any }, {}), null);
});

check('只填了学科或只填了考试名时，快照仍认得出这场考试', () => {
  const onlySubject = buildExamHandoffSnapshot({ ...plan, examName: '', preferences: {} }, {})!;
  assert.equal(onlySubject.exam, '');
  assert.equal(onlySubject.subject, '计算机');
  const onlyExam = buildExamHandoffSnapshot({ ...plan, subject: '', preferences: {} }, {})!;
  assert.equal(onlyExam.exam, '数据结构期末');
  assert.equal(onlyExam.materials.length, 3);
});

check('今日任务入口：路径解析不出来也照常带资料，只是不带层级', () => {
  (globalThis as any).window = { name: '' };
  primeHandoffForTask(
    { ...plan, topics: [] },
    { id: 'task-9', topicTitle: '没在考点表里的标题', topicId: undefined, date: '2026-11-05' }
  );
  const raw = (globalThis as any).window.name;
  assert.ok(raw, '资料属于这场考试，路径解析失败也值得带过去');
  const snap = JSON.parse(raw);
  assert.equal(snap.level, '');
  assert.equal(snap.unit, '');
  assert.equal(snap.topic, '没在考点表里的标题');
  assert.equal(snap.date, '2026-11-05');
  assert.equal(snap.task, 'task-9');
  assert.equal(snap.materials.length, 3);
});

check('今日任务入口：能解析路径时把完整层级一起写进快照', () => {
  (globalThis as any).window = { name: '' };
  primeHandoffForTask(plan, { id: 'task-1', topicTitle: '栈与队列', topicId: 'unit-1', date: '2026-11-04' });
  const snap = JSON.parse((globalThis as any).window.name);
  assert.equal(snap.level, 'subtopic');
  assert.equal(snap.unit, '线性表');
  assert.equal(snap.topic, '栈与队列');
});

check('标签页名字是一次性通道：写快照、清空、互不残留', () => {
  (globalThis as any).window = { name: '上一次跳转留下的东西' };
  primeHandoffForPractice(plan, { level: 'unit', unit: '线性表', topic: '线性表' });
  assert.notEqual((globalThis as any).window.name, '上一次跳转留下的东西');
  primeHandoffForPractice({ ...plan, materials: [] }, {});
  assert.equal((globalThis as any).window.name, '', '没有快照时必须清空，不能把上一场考试留给下一个页面');
  clearHandoffWindow();
  assert.equal((globalThis as any).window.name, '');
});

check('脏输入与预算超量都不抛异常，只退化成不带快照', () => {
  (globalThis as any).window = { name: 'stale' };
  assert.doesNotThrow(() => primeHandoffForTask(null, null));
  assert.equal((globalThis as any).window.name, '');
  assert.doesNotThrow(() => primeHandoffForPractice({ ...plan, materials: [{ id: 'z', name: 123, type: 'notes', content: 42 }] }, {}));
  assert.equal(encodeExamHandoffSnapshot(null), '');
  const huge = { ...plan, materials: [{ id: 'h', name: 'huge.txt', type: 'notes', content: '字'.repeat(HANDOFF_LIMITS.charsPerMaterial) }] };
  const snap = buildExamHandoffSnapshot(huge, {})!;
  (snap as any).materials[0].text = '字'.repeat(HANDOFF_LIMITS.maxEncodedChars + 10);
  assert.equal(encodeExamHandoffSnapshot(snap), '', '编码超过标签页名字预算就整个不带');
  assert.doesNotThrow(() => primeHandoffWindow(snap));
  assert.equal((globalThis as any).window.name, '');
});

check('没有 window（函数端/构建期）时写入安全退出', () => {
  delete (globalThis as any).window;
  assert.doesNotThrow(() => primeHandoffForPractice(plan, { level: 'unit', unit: '线性表', topic: '线性表' }));
  assert.doesNotThrow(() => clearHandoffWindow());
});

console.log(`\n全部 ${passed} 项通过`);
