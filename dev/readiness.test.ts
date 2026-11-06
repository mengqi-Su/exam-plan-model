// 「先建科目，资料回头再传」的状态口径回归：npm run test:readiness
// 这门科目不是另一种数据，只是还差一步：差资料 / 差生成 / 已经排上任务。
// 判断只允许在 lib/planReadiness 一处，页面拿到的文案必须两种语言都齐全，
// 否则同一门科目在总览卡写「待上传」、在详情页写「0% 完成」，用户分不清它是坏了还是还没开始。
import assert from 'node:assert/strict';
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

check('三种状态各自的话术：ready 不说话，其余两种双语齐全', () => {
  assert.equal(readinessCopy('ready', true), null);
  assert.equal(readinessCopy('ready', false), null);
  for (const isZh of [true, false]) {
    for (const state of ['awaiting-materials', 'awaiting-generation'] as const) {
      const copy = readinessCopy(state, isZh);
      assert.ok(copy, `${state} 必须有文案`);
      for (const field of ['title', 'hint', 'action'] as const) {
        assert.ok(copy[field].trim().length > 0, `${state}.${field} 不能为空`);
        // 中文条目里不该混进英文整句，反之亦然
        if (isZh) assert.equal(/[a-z]{4,}/.test(copy[field]), false, `${state}.${field} 混进了英文`);
        else assert.equal(/[\u4e00-\u9fff]/.test(copy[field]), false, `${state}.${field} 混进了中文`);
      }
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

console.log(`\n${passed} readiness checks passed`);
