// 「先建科目，资料回头再传」的状态口径回归：npm run test:readiness
// 这门科目不是另一种数据，只是还差一步：差资料 / 差生成 / 已经排上任务。
// 判断只允许在 lib/planReadiness 一处，页面拿到的文案必须两种语言都齐全，
// 否则同一门科目在总览卡写「待上传」、在详情页写「0% 完成」，用户分不清它是坏了还是还没开始。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPlanPending, planReadiness, readinessCopy } from '../src/lib/planReadiness.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const base = { id: 'plan-导游业务', examName: '导游业务', tasks: [], topics: [], materials: [] } as any;

check('空壳科目算「还没上传资料」，不是坏数据', () => {
  assert.equal(planReadiness(base), 'awaiting-materials');
  assert.equal(isPlanPending(base), true);
});

check('脏数据（数组缺失/为 null）不抛异常，仍给出可解释的状态', () => {
  assert.equal(planReadiness({ id: 'x' } as any), 'awaiting-materials');
  assert.equal(planReadiness({ tasks: null, topics: undefined, materials: null } as any), 'awaiting-materials');
  assert.equal(planReadiness(null), 'ready');
  assert.equal(planReadiness(undefined), 'ready');
});

check('传了资料但没生成计划 → 差生成', () => {
  assert.equal(planReadiness({ ...base, materials: [{ id: 'm1', name: '《导游业务》讲义.pdf' }] } as any), 'awaiting-generation');
  // 只有标题算数：空的 topics 数组和全空标题都不算「有内容」
  assert.equal(planReadiness({ ...base, topics: [] } as any), 'awaiting-materials');
  assert.equal(planReadiness({ ...base, topics: [{ id: 'u1', title: '   ' }] } as any), 'awaiting-materials');
  assert.equal(planReadiness({ ...base, topics: [{ id: 'u1', title: '辛亥革命' }] } as any), 'awaiting-generation');
});

check('一旦排出任务就是正常计划，进度口径重新生效', () => {
  const planned = { ...base, tasks: [{ id: 't1', date: '2026-11-06', title: '第三章', status: 'pending' }] };
  assert.equal(planReadiness(planned as any), 'ready');
  assert.equal(isPlanPending(planned as any), false);
  // 全跳过 / 全完成也仍然是「有计划的科目」，不该退回引导态
  assert.equal(planReadiness({ ...base, tasks: [{ status: 'skipped' }] } as any), 'ready');
});

check('两种待办状态各自的话术：ready 不说话，其余两种双语齐全', () => {
  assert.equal(readinessCopy('ready', true), null);
  assert.equal(readinessCopy('ready', false), null);
  for (const isZh of [true, false]) {
    for (const state of ['awaiting-materials', 'awaiting-generation'] as const) {
      const copy = readinessCopy(state, isZh);
      assert.ok(copy, `${state} 必须有文案`);
      // 只剩「一句话 + 一个动作」：解释性的 hint 已经从契约里去掉了。
      for (const field of ['title', 'action'] as const) {
        assert.ok(copy[field].trim().length > 0, `${state}.${field} 不能为空`);
        // 中文条目里不该混进英文整句，反之亦然
        if (isZh) assert.equal(/[a-z]{4,}/.test(copy[field]), false, `${state}.${field} 混进了英文`);
        else assert.equal(/[\u4e00-\u9fff]/.test(copy[field]), false, `${state}.${field} 混进了中文`);
      }
      assert.equal('hint' in copy, false, `${state} 不该再带解释性的 hint`);
    }
  }
});

check('两种待办状态的说法不通用：差资料和差生成说的是两件事', () => {
  const zh = readinessCopy('awaiting-materials', true);
  const gen = readinessCopy('awaiting-generation', true);
  assert.notEqual(zh.title, gen.title);
  assert.notEqual(zh.action, gen.action);
  assert.equal(zh.action, '去上传资料');
  assert.equal(gen.action, '生成学习计划');
});

/* 文案答应的那个动作，页面就得真的做到：
   「去上传资料」不能只把资料区展开、再让人自己找「上传文件」；
   而资料区里存着上一门的提示（库满、失败、勾选、草稿），换一门科目必须整块重建，
   否则 0 份资料的科目头上会挂着另一门「最多存 100 份」的话。 */
check('「去上传资料」直通上传弹窗，资料区按科目重建', () => {
  const page = readFileSync('src/components/CourseDetailPage.tsx', 'utf8');
  const hub = readFileSync('src/components/CourseKnowledgeHub.tsx', 'utf8');
  /* 「去上传资料」现在只挂在页头那颗按钮上（科目页去重：一个功能一处），
     接的是函数引用，不是 onClick 里的一次调用——两颗按钮各调一次的时代过去了。 */
  assert.match(page, /awaiting-materials" \? revealUpload/, '差资料那条动作要走「展开资料区 + 开上传弹窗」');
  assert.match(page, /revealKnowledge\(\);\s*\n\s*setUploadRequest/, 'revealUpload 一份实现做完整两件事');
  assert.equal((page.match(/revealUpload\b/g) || []).length, 2, '一份定义 + 页头一处接线，正文不再复刻第二颗');
  assert.match(page, /<CourseKnowledgeHub\s+key=\{plan\.id\}/, '换科目不留上一门的提示');
  assert.match(page, /uploadRequest=\{uploadRequest\}/, '请求由页头交给资料区');
  assert.match(hub, /if \(uploadRequest > 0\) setShowUploadBox\(true\);/, '资料区收到请求就把门打开');
});

console.log(`\n${passed} readiness checks passed`);
