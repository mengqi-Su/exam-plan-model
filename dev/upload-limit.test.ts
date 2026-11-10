// 上传规格与教材名入口的底线，一次性检查：npm run test:uploadlimit
//   1) 单份体积上限只有一处定义，且住在真正执行它的解析器里；界面上那个「20 MB」由常量算出，
//      不是又抄一遍字面量。抄一遍的下场已经见过：上限改了，报错文案还在说旧数字。
//   2) 两个上传入口（新建向导第二步、科目页上传弹窗）挂的是同一份规格 chip，不各写一套。
//   3) 教材名输入框常驻在第二步、紧跟上传区，不是分隔线后面一个 ghost 按钮；
//      书名带进弹窗就直接回忆目录，不让人在浮层里重打一遍。
//   4) 书名号只加一次：输入框的示例自己就带《》，照着打进来不能再套一层，
//      而且摘要要能原样摘回用户填的名字（带版次的那种也不许被切掉）。
// 文案风格（单复数、中文标点）归 dev/copy-guard.test.ts，这里不重复。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, parseDocumentFile } from '../src/lib/documentParser.ts';
import { MAX_LIBRARY_MATERIALS } from '../src/lib/aiClient.ts';
import { bookNameFromSummary, formatBookTitle } from '../src/lib/text.ts';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const read = (file: string) => readFileSync(file, 'utf8');
/* 注释里写着旧数字是给人看的说明，不会渲染出去，先剥掉再查 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const PARSER = 'src/lib/documentParser.ts';
const AI_CLIENT = 'src/lib/aiClient.ts';
const PANEL = 'src/components/UploadQueuePanel.tsx';
const WIZARD = 'src/components/AddExamSubjectWizard.tsx';
const UPLOAD_MODAL = 'src/components/UploadModal.tsx';
const DIALOG = 'src/components/TextbookOutlineDialog.tsx';

/* 写死的 MB 数字：与当前上限相同才算违规。封面图（pageCover 12 MB）和备份导入
   （SettingsPage 50 MB）是另外两个上限，数字不同所以不误伤；哪天真撞上同一个数，
   正确的修法是把那两处也改成由各自的常量插值，而不是给这里开豁免。 */
function hardcodedCapOffenses(src: string): string[] {
  const bad: string[] = [];
  const literal = new RegExp(`\\b${MAX_UPLOAD_MB}(?:\\.0+)?\\s*MB\\b`, 'g');
  for (const m of codeOnly(src).matchAll(literal)) bad.push(m[0]);
  return bad;
}

await check('单份上限：20 MB，只在解析器里定义一次', () => {
  assert.equal(MAX_UPLOAD_BYTES, 20 * 1024 * 1024, '解析在浏览器本地做，20 MB 是内存与解析时间的上限');
  assert.equal(MAX_UPLOAD_MB, 20, '界面上的 MB 数由字节常量算出');
  assert.ok(/export const MAX_UPLOAD_BYTES =/.test(read(PARSER)), '上限住在真正执行它的解析器里');
  assert.ok(/export const MAX_UPLOAD_MB = MAX_UPLOAD_BYTES \//.test(read(PARSER)), 'MB 数不是第二份字面量');
  assert.ok(!/MAX_UPLOAD_BYTES/.test(read(AI_CLIENT)), 'AI 客户端不再管本地解析的体积上限');
});

await check('全站文案：这个上限没有第二份字面量', () => {
  const files = [PARSER, AI_CLIENT, PANEL, WIZARD, UPLOAD_MODAL, 'src/components/CourseKnowledgeHub.tsx'];
  const bad = files.flatMap((file) => hardcodedCapOffenses(read(file)).map((hit) => `${file}: ${hit}`));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
  /* 报错和 chip 都必须是从常量插值出来的 */
  assert.ok(/超过单份 \$\{MAX_UPLOAD_MB\} MB 上限/.test(read(PARSER)), '中文报错由常量出数');
  assert.ok(/over the \$\{MAX_UPLOAD_MB\} MB per-file limit/.test(read(PARSER)), '英文报错由常量出数');
  assert.ok(/单份 ≤ \$\{MAX_UPLOAD_MB\} MB/.test(read(PANEL)), '规格 chip 由常量出数');
  assert.ok(/Up to \$\{MAX_UPLOAD_MB\} MB each/.test(read(PANEL)), '英文 chip 由常量出数');
});

await check('两个上传入口挂同一份规格 chip', () => {
  assert.equal((read(PANEL).match(/export const UploadLimitChips/g) || []).length, 1, 'chip 组件只有一份');
  assert.ok(/MAX_LIBRARY_MATERIALS/.test(read(PANEL)), '份数也从常量取，不写死 100');
  assert.equal(MAX_LIBRARY_MATERIALS, 100);
  for (const file of [WIZARD, UPLOAD_MODAL]) {
    const src = read(file);
    assert.ok(/UploadLimitChips/.test(src), `${file} 要挂规格 chip`);
    assert.ok(/<UploadLimitChips/.test(src), `${file} 要真的渲染它，不是只 import`);
    assert.ok(/import \{[^}]*UploadLimitChips[^}]*\} from "\.\/UploadQueuePanel"/.test(src), `${file} 用的是共享那一份`);
  }
});

await check('体积报错的两条死词条已删，服务端真发的码还在', () => {
  const src = read(AI_CLIENT);
  /* 这两个码没有任何产生者：函数闸门发小写 body_too_large，单份体积由解析器本地拦。
     留着就等于让上限在文案里还有第二份字面量。 */
  assert.ok(!/^\s*FILE_TOO_LARGE:/m.test(src), 'FILE_TOO_LARGE 没有产生者');
  assert.ok(!/^\s*PAYLOAD_TOO_LARGE:/m.test(src), 'PAYLOAD_TOO_LARGE 没有产生者');
  assert.ok(/^\s*body_too_large:/m.test(src), '函数闸门真会发这个码，英文界面不能掉到 HTTP 413');
  assert.ok(/^\s*TOO_MANY_MATERIALS:/m.test(src), 'planner 真会发这个码');
});

await check('超限真的被拦下，而且文件名只由入口挂一次', async () => {
  /* 真的造一份超限文件走一遍闸门，不只是对着源码正则 */
  const over = new File([new Uint8Array(MAX_UPLOAD_BYTES + 1024 * 1024)], '探针超大文件.pdf', { type: 'application/pdf' });
  const zh = await parseDocumentFile(over, 'zh').then(() => null, (e: Error) => e.message);
  const en = await parseDocumentFile(over, 'en').then(() => null, (e: Error) => e.message);
  assert.ok(zh && zh.includes(`${MAX_UPLOAD_MB} MB`), `中文报错要报出上限：${zh}`);
  assert.ok(zh && zh.includes('21.0 MB'), '也要报出这一份自己多大');
  assert.ok(en && en.includes(`over the ${MAX_UPLOAD_MB} MB per-file limit`), `英文报错同口径：${en}`);
  for (const message of [zh, en]) {
    assert.ok(message && !message.includes('探针超大文件'), '解析器不带文件名：入口已经用「名字：原因」挂过一遍');
  }
  /* 两个入口共用同一份行首格式，所以名字不会一处有一处没有 */
  for (const file of [WIZARD, UPLOAD_MODAL]) {
    assert.ok(/\$\{task\.name\}\$\{labelColon\(isZh\)\}\$\{task\.error/.test(read(file)), `${file} 用「名字：原因」这一份格式`);
  }
  /* 正好等于上限不算超限：闸门比的是 >，不是 >=。这里只钉运算符，
     不再造一份 20 MB 的真文件去跑解析——那条路会读全文，在 Node 里跑的是另一套环境。 */
  assert.ok(/if \(file\.size > MAX_UPLOAD_BYTES\)/.test(read(PARSER)), '等于上限放行，大于才拦');
});

await check('教材名输入框常驻第二步，且排在资料列表之前', () => {
  const src = read(WIZARD);
  const field = src.indexOf('id="wizard-textbook-name"');
  assert.ok(field > 0, '第二步要有一个真的书名输入框，不是一个开弹窗的按钮');
  assert.ok(/htmlFor="wizard-textbook-name"/.test(src), '输入框要有配对的 label');
  assert.ok(/value=\{textbookInput\}/.test(src), '输入框受控于书名状态');
  assert.ok(/setTextbookInput\(event\.target\.value\)/.test(src), '打字只动输入框，不动已整理那本书');
  assert.ok(field < src.indexOf('<UploadQueuePanel'), '紧跟上传区，不埋在资料列表后面');
  assert.ok(field < src.indexOf('courseDocuments.map'), '一份资料都没有时它也在首屏');
  assert.ok(!src.includes('只填教材名，按目录整理考点'), '旧那句解释性标题已经清掉');
  /* 两个书名各管各的：摘要是「已经整理成考点的那一本」，不能被正在打的字改口 */
  assert.ok(/const \[textbookLabel, setTextbookLabel\]/.test(src));
  assert.ok(/const \[textbookInput, setTextbookInput\]/.test(src));
  assert.ok(/formatBookTitle\(textbookLabel \|\|/.test(src), '资料摘要仍然只认已整理的那本书');
});

await check('书名带进弹窗就直接回忆目录，不重打一遍', () => {
  const wizard = read(WIZARD);
  const dialog = read(DIALOG);
  assert.ok(/initialTextbook=\{textbookInput\.trim\(\)\}/.test(wizard), '向导把书名交给弹窗');
  assert.ok(/initialTextbook\?: string/.test(dialog), '弹窗收得下这本书名');
  assert.ok(/void requestToc\(name\)/.test(dialog), '带名开窗直接跑回忆，不再停在书名屏');
  assert.ok(/autoStartedRef/.test(dialog), '一次开窗只自动跑一次，「换一本」要能回到书名屏');
  assert.ok(/const requestToc = async \(nameOverride\?: string\)/.test(dialog), '回忆入口只有这一份');
  assert.equal((dialog.match(/runGeneration<TextbookOutline>/g) || []).length, 1, '回忆目录的 AI 调用没有第二套');
  /* 科目页工具条没有输入框，仍然走弹窗自己的书名屏 */
  assert.ok(!/initialTextbook=/.test(read('src/components/CourseKnowledgeHub.tsx')));
});

await check('书名号只加一次，摘要能原样摘回用户填的名字', () => {
  /* 输入框的示例就是「《导游业务》第 4 版」，用户照着打进来是常态，不是边角料 */
  assert.equal(formatBookTitle('导游业务'), '《导游业务》');
  assert.equal(formatBookTitle('《导游业务》第 4 版'), '《导游业务》第 4 版', '自己带号的不再套一层');
  assert.equal(formatBookTitle('  导游业务  '), '《导游业务》', '两端空白先去掉');
  assert.equal(formatBookTitle(''), '');
  /* 摘要 <-> 书名来回走一趟必须还原，带版次的不能被第一个》切断 */
  for (const name of ['导游业务', '《导游业务》第 4 版', '政策与法律法规（2026 版）']) {
    const summary = `${formatBookTitle(name)}目录 · AI 整理 12 个考点`;
    assert.equal(bookNameFromSummary(summary), name, `中文摘要还原：${name}`);
    assert.equal(formatBookTitle(bookNameFromSummary(summary)), formatBookTitle(name), '还原后再排版不叠号');
  }
  assert.equal(bookNameFromSummary('Outline of "Introduction to Algorithms" · 12 topics recalled by AI'), 'Introduction to Algorithms');
  assert.equal(bookNameFromSummary('《教材》目录 · AI 整理 12 个考点'), '', '兜底词不是书名，别回填进输入框');
  assert.equal(bookNameFromSummary('Outline of "the textbook" · 12 topics recalled by AI'), '');
  assert.equal(bookNameFromSummary('3 份资料 · AI 识别 12 个考点'), '', '上传那条摘要里没有书名');
  assert.equal(bookNameFromSummary(''), '');
  /* 加号的模板全站只留一份：其余地方一律调 formatBookTitle */
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' })
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'));
  const offenders = files
    .filter((f) => /《\$\{/.test(codeOnly(readFileSync(`src/${f}`, 'utf8'))))
    .map((f) => `src/${f}`);
  assert.deepEqual(offenders, ['src/lib/text.ts'], `\n书名号模板只该出现在 text.ts：\n${offenders.join('\n')}`);
});

await check('「去上传资料」两颗按钮都真的送到上传弹窗', () => {
  const src = read('src/components/CourseDetailPage.tsx');
  /* 同一个标签不许一处送到弹窗、另一处只把资料区展开：展开之后还要人自己找「上传文件」，
     等于一句话办半件事。页头主动作以前接的是 revealKnowledge，待办卡接的是 revealUpload。 */
  assert.equal((src.match(/const revealUpload = /g) || []).length, 1, '送到上传口这件事只有一份实现');
  assert.ok(/revealKnowledge\(\);\s*\n\s*setUploadRequest/.test(src), 'revealUpload 先展开再开弹窗');
  const wired = src.match(/readiness === "awaiting-materials" \? revealUpload/g) || [];
  assert.equal(wired.length, 2, `页头主动作和待办卡都要接 revealUpload，实际 ${wired.length} 处`);
  assert.ok(!/awaiting-materials" \? revealKnowledge/.test(src), '不许再有只展开的那条分支');
  /* 定义要在 primaryAction 之前：那是个立即执行的 IIFE，晚定义会撞 TDZ */
  assert.ok(src.indexOf('const revealUpload') < src.indexOf('const primaryAction'), 'revealUpload 先定义再用');
});

/* 反面样本：规则抓不住就等于没规则，这里先验自己 */
await check('守卫有效：写死的上限数字抓得住，插值和别的上限不误伤', () => {
  assert.deepEqual(hardcodedCapOffenses('throw new Error("单个文件超过 20 MB 上限")'), ['20 MB']);
  assert.deepEqual(hardcodedCapOffenses('en: "Each file must be 20 MB or smaller."'), ['20 MB']);
  assert.deepEqual(hardcodedCapOffenses('`超过单份 ${MAX_UPLOAD_MB} MB 上限`'), [], '插值不是字面量');
  assert.deepEqual(hardcodedCapOffenses('// 以前是 20 MB，现在改了'), [], '注释不会渲染出去');
  assert.deepEqual(hardcodedCapOffenses('/* 上限 20 MB */ const a = 1;'), [], '块注释同样剥掉');
  assert.deepEqual(hardcodedCapOffenses('封面图超过 12 MB'), [], '封面图是另一个上限');
  assert.deepEqual(hardcodedCapOffenses('备份文件超过 50 MB'), [], '备份导入是另一个上限');
});

console.log(`\n${passed} upload-spec checks passed`);