// 出站联动契约回归：npm run test:links
// 覆盖「三入口 → 完整路径参数」的构造规则与今日任务的路径反解，
// 包括必要参数缺失时退化为旧链接、同名歧义时绝不猜路径。
import assert from 'node:assert/strict';
import {
  LINK_PROTOCOL_VERSION,
  resolvePracticeTopicPath,
  starquizPracticeUrl,
  starquizPracticeUrlForTask,
} from '../src/lib/links.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.split('?')[1] || '');
}

const plan = {
  id: 'plan-中国近代史',
  subject: '中国近代史',
  examName: '2026 考研',
  preferences: { subject: '中国近代史' },
  topics: [
    { id: 'u1', title: '辛亥革命', subtopicTree: [{ title: '武昌起义' }, { name: '临时约法' }], subtopics: [] as string[] },
    { id: 'u2', title: '五四运动', subtopicTree: [], subtopics: ['新文化运动', '工人阶级'] },
    { id: 'u3', title: '闭关锁国', subtopicTree: [{ title: '闭关锁国' }], subtopics: [] as string[] },
    { id: 'u4', title: '鸦片战争', subtopicTree: [{ title: '《南京条约》' }], subtopics: [] as string[] },
    { id: 'u5', title: '重名单元甲', subtopicTree: [], subtopics: [] as string[] },
    { id: 'u5', title: '重名单元乙', subtopicTree: [], subtopics: [] as string[] },
    { id: 'u6', title: '国民大革命', subtopicTree: [{ title: '北伐战争' }], subtopics: ['北伐战争'] },
    { id: 'u7', title: '洋务运动', subtopicTree: [{ title: '洋务运动' }], subtopics: ['洋务运动'] },
  ],
};

console.log('出站联动契约');

check('必要参数齐全时带上 v=1 联动上下文', () => {
  const url = starquizPracticeUrl({
    planId: 'p-1',
    level: 'subtopic',
    subject: '中国近代史',
    unit: '辛亥革命',
    topic: '武昌起义',
    examName: '2026 考研',
    date: '2026-11-03',
    taskId: 'task-9',
  });
  const q = query(url);
  assert.equal(q.get('from'), 'exam-plan');
  assert.equal(q.get('v'), LINK_PROTOCOL_VERSION);
  assert.equal(q.get('plan'), 'p-1');
  assert.equal(q.get('level'), 'subtopic');
  assert.equal(q.get('unit'), '辛亥革命');
  assert.equal(q.get('topic'), '武昌起义');
  assert.equal(q.get('date'), '2026-11-03');
  assert.equal(q.get('task'), 'task-9');
});

check('出站不携带考点钥匙与 back 地址', () => {
  const url = starquizPracticeUrl({ planId: 'p-1', level: 'unit', subject: '物理', unit: '力学', topic: '力学' });
  assert.equal(query(url).get('tk'), null);
  assert.equal(query(url).get('back'), null);
  assert.ok(!url.includes('exam-plan-ai'), '不能把本站地址塞进参数');
});

check('缺 plan / level / unit 任一 → 退化为旧链接（不启用结果回流）', () => {
  const base = { subject: '物理', unit: '力学', topic: '力学', level: 'unit' as const, planId: 'p-1' };
  for (const broken of [{ planId: '' }, { level: '' }, { unit: '  ' }, { subject: '' }, { topic: '' }, { level: 'chapter' }]) {
    const q = query(starquizPracticeUrl({ ...base, ...broken }));
    assert.equal(q.get('v'), null, JSON.stringify(broken));
    assert.equal(q.get('plan'), null);
    assert.equal(q.get('level'), null);
  }
  // 旧行为保留：subject/topic/exam 仍然传过去
  const q = query(starquizPracticeUrl({ ...base, planId: '' }));
  assert.equal(q.get('subject'), '物理');
  assert.equal(q.get('topic'), '力学');
});

check('旧版调用方式（只有 subject/topic/exam）行为不变', () => {
  const q = query(starquizPracticeUrl({ subject: '编程', topic: '二叉树遍历', examName: '期末' }));
  assert.equal(q.get('from'), 'exam-plan');
  assert.equal(q.get('subject'), '编程');
  assert.equal(q.get('topic'), '二叉树遍历');
  assert.equal(q.get('exam'), '期末');
  assert.equal(q.get('v'), null);
});

check('特殊字符经 URL 编解码后原样还原', () => {
  const url = starquizPracticeUrl({
    planId: 'p 1',
    level: 'subtopic',
    subject: 'C&C++ / Java',
    unit: '算法 #1: 递归?',
    topic: 'emoji 🚀 与 &/#',
  });
  assert.ok(!/[#&]emoji/.test(url), '裸 # 或 & 会截断查询串');
  const q = query(url);
  assert.equal(q.get('unit'), '算法 #1: 递归?');
  assert.equal(q.get('topic'), 'emoji 🚀 与 &/#');
  assert.equal(q.get('subject'), 'C&C++ / Java');
});

check('今日任务反解：命中父单元标题 → 单元级路径', () => {
  const path = resolvePracticeTopicPath(plan, { topicId: 'u1', topicTitle: '辛亥革命' });
  assert.deepEqual(path, { level: 'unit', subject: '中国近代史', unit: '辛亥革命', topic: '辛亥革命' });
});

check('今日任务反解：命中子考点 → 子考点级路径，父单元一并带上', () => {
  assert.deepEqual(resolvePracticeTopicPath(plan, { topicId: 'u1', topicTitle: '武昌起义' }), {
    level: 'subtopic', subject: '中国近代史', unit: '辛亥革命', topic: '武昌起义',
  });
  // subtopicTree 里只有 name 时也能命中
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u1', topicTitle: '临时约法' })?.level, 'subtopic');
  // 纯字符串 subtopics 同样支持
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u2', topicTitle: '新文化运动' })?.topic, '新文化运动');
});

check('歧义与找不到 → 返回 null，绝不猜路径', () => {
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u3', topicTitle: '闭关锁国' }), null); // 单元与子考点同名
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u9', topicTitle: '不存在' }), null); // topicId 找不到
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u5', topicTitle: '重名单元甲' }), null); // 同一 id 命中两个单元
  assert.equal(resolvePracticeTopicPath(plan, { topicId: undefined, topicTitle: '辛亥革命' }), null);
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u1', topicTitle: '   ' }), null);
  assert.equal(resolvePracticeTopicPath({ ...plan, subject: '  ', preferences: { subject: '' } }, { topicId: 'u1', topicTitle: '辛亥革命' }), null);
  assert.equal(resolvePracticeTopicPath(null, { topicId: 'u1', topicTitle: '辛亥革命' }), null);
});

check('含书名号的标题原样传递', () => {
  const path = resolvePracticeTopicPath(plan, { topicId: 'u4', topicTitle: '《南京条约》' });
  assert.equal(path?.topic, '《南京条约》');
  assert.equal(query(starquizPracticeUrlForTask(plan, { topicId: 'u4', topicTitle: '《南京条约》' }, { taskId: 't1', date: '2026-11-03' })).get('topic'), '《南京条约》');
});

check('任务入口：能解析就带联动上下文，否则退化为旧链接', () => {
  const linked = query(starquizPracticeUrlForTask(plan, { id: 'task-1', topicId: 'u1', topicTitle: '武昌起义', date: '2026-11-03' }, { examName: plan.examName, date: '2026-11-03', taskId: 'task-1' }));
  assert.equal(linked.get('v'), LINK_PROTOCOL_VERSION);
  assert.equal(linked.get('plan'), 'plan-中国近代史');
  assert.equal(linked.get('level'), 'subtopic');
  assert.equal(linked.get('unit'), '辛亥革命');
  assert.equal(linked.get('task'), 'task-1');

  const fallback = query(starquizPracticeUrlForTask(plan, { id: 'task-2', topicId: 'zzz', topicTitle: '自由探索', date: '2026-11-03' }, { examName: plan.examName, date: '2026-11-03', taskId: 'task-2' }));
  assert.equal(fallback.get('v'), null);
  assert.equal(fallback.get('topic'), '自由探索');
  assert.equal(fallback.get('subject'), '中国近代史');
});

check('同一子考点在 tree 与字符串列表里重复出现时不算歧义', () => {
  // subtopicTree 与 subtopics 是同一批子考点的两种表示，真实计划里经常同时存在
  assert.deepEqual(resolvePracticeTopicPath(plan, { topicId: 'u6', topicTitle: '北伐战争' }), {
    level: 'subtopic', subject: '中国近代史', unit: '国民大革命', topic: '北伐战争',
  });
  assert.deepEqual(resolvePracticeTopicPath(plan, { topicId: 'u6', topicTitle: '国民大革命' }), {
    level: 'unit', subject: '中国近代史', unit: '国民大革命', topic: '国民大革命',
  });
  // 单元与其子考点同名时仍是歧义，即使两种表示都指向同一标题
  assert.equal(resolvePracticeTopicPath(plan, { topicId: 'u7', topicTitle: '洋务运动' }), null);
});

console.log(`\n${passed} links checks passed`);
