// 资料库容量与单次生成用量的口径回归：npm run test:materials
// 库里能存 100 份，一次生成只吃 20 份。选哪 20 份必须是用户勾的，
// 任何一条路径都不许替用户悄悄丢掉后面的资料——超了就明确报错。
import assert from 'node:assert/strict';
import {
  MAX_AI_MATERIALS,
  MAX_LIBRARY_MATERIALS,
  MAX_AI_CHARS_PER_MATERIAL,
  aiSelectionNotice,
  defaultAiSelection,
  prepareMaterialsForAI,
} from '../src/lib/aiClient.ts';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

function library(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `mat-${i + 1}`,
    name: `资料 ${i + 1}.txt`,
    type: 'notes',
    content: `第 ${i + 1} 份资料的正文。`,
  })) as any[];
}

check('两个上限是分开的：库容量大于单次生成用量', () => {
  assert.ok(MAX_LIBRARY_MATERIALS > MAX_AI_MATERIALS);
  assert.equal(MAX_AI_MATERIALS, 20, '20 来自提示词预算，改它要同时改 planner 的均分预算');
});

check('默认勾选前 20 份，第 21 份起留在库里', () => {
  const docs = library(25);
  const selected = defaultAiSelection(docs);
  assert.equal(selected.length, MAX_AI_MATERIALS);
  assert.deepEqual(selected, docs.slice(0, 20).map((doc) => doc.id));
});

check('资料不足 20 份时全选，不留空勾选', () => {
  const docs = library(7);
  assert.equal(defaultAiSelection(docs).length, 7);
  assert.deepEqual(defaultAiSelection([]), []);
  assert.deepEqual(defaultAiSelection(undefined), []);
});

check('用户手动勾过的组合要沿用，只剔除被删掉的资料', () => {
  const docs = library(25);
  const manual = ['mat-25', 'mat-3', 'mat-1'];
  assert.deepEqual(defaultAiSelection(docs, manual), manual);
  // mat-3 被删了：剩下两份保持用户的选择，不重新默认成前 20 份
  const afterDelete = docs.filter((doc) => doc.id !== 'mat-3');
  assert.deepEqual(defaultAiSelection(afterDelete, manual), ['mat-25', 'mat-1']);
});

check('勾选被清空或资料全删后回到默认，生成按钮不会永久卡死', () => {
  const docs = library(25);
  assert.equal(defaultAiSelection(docs, []).length, MAX_AI_MATERIALS);
  assert.deepEqual(defaultAiSelection([], ['mat-1']), []);
});

check('沿用选择时也不许超过单次上限', () => {
  const docs = library(30);
  const tooMany = docs.map((doc) => doc.id);
  assert.equal(defaultAiSelection(docs, tooMany).length, MAX_AI_MATERIALS);
});

check('只把勾选的资料交给 AI，顺序按资料库原序', () => {
  const docs = library(25);
  const out = prepareMaterialsForAI(docs, ['mat-25', 'mat-2']);
  assert.deepEqual(out.map((item) => item.id), ['mat-2', 'mat-25']);
  assert.equal(out[0].name, '资料 2.txt');
});

check('没传勾选又超过上限：明确报错，绝不静默截断', () => {
  const docs = library(25);
  assert.throws(
    () => prepareMaterialsForAI(docs),
    (error: any) => error.code === 'TOO_MANY_MATERIALS' && /20/.test(error.message)
  );
  assert.throws(
    () => prepareMaterialsForAI(docs, docs.slice(0, 21).map((doc) => doc.id)),
    (error: any) => error.code === 'TOO_MANY_MATERIALS' && /21/.test(error.message)
  );
});

check('勾选在上限内就正常放行，空勾选返回空数组交给上游判空', () => {
  const docs = library(25);
  assert.equal(prepareMaterialsForAI(docs, docs.slice(0, 20).map((doc) => doc.id)).length, 20);
  assert.deepEqual(prepareMaterialsForAI(docs, []), []);
  assert.deepEqual(prepareMaterialsForAI([], []), []);
});

check('每份资料仍按单次调用的字数上限裁剪，本地原文不受影响', () => {
  const long = { id: 'mat-1', name: '长.txt', type: 'notes', content: '字'.repeat(MAX_AI_CHARS_PER_MATERIAL + 500) } as any;
  const out = prepareMaterialsForAI([long], ['mat-1']);
  assert.equal(out[0].content.length, MAX_AI_CHARS_PER_MATERIAL);
  assert.equal(long.content.length, MAX_AI_CHARS_PER_MATERIAL + 500, '裁剪的是副本，不是库里的原文');
});

check('超出单次上限才出提示，且说清总数、用了多少、剩下多少', () => {
  assert.equal(aiSelectionNotice(20, 20, 'zh'), null);
  assert.equal(aiSelectionNotice(7, 7, 'en'), null);
  const zh = aiSelectionNotice(25, 20, 'zh')!;
  assert.match(zh, /25/);
  assert.match(zh, /20/);
  assert.match(zh, /5/);
  assert.match(zh, /资料库/);
  const en = aiSelectionNotice(25, 20, 'en')!;
  assert.match(en, /25/);
  assert.match(en, /library/i);
  assert.ok(!/[\u4e00-\u9fa5]/.test(en), '英文提示里不该残留中文');
});

console.log(`\n${passed} material-selection checks passed`);