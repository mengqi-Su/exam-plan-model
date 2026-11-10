// 科目总览的百叶窗卡组是用户定的设计，不是可以随手换掉的实现细节：npm run test:deck
// 它被平铺卡片网格替换过一次（f1ba47d），桌面悬停展开那一排和移动端手风琴一起没了。
// 这里钉住的是「形态」，不是配色文案——形态一旦被改回网格，这道守卫先红。
//   1) 桌面是一排等高的横向板条：收起 60px、展开 380px，靠 flex 5:1 分配宽度，
//      指针落到哪张哪张展开，离开整排回到选中那张。不是 grid，不是每门一张独立卡片。
//   2) 收起的板条上科目名是竖排的（rotate-90）——这是百叶窗的签名，横排就不是百叶窗了。
//   3) 「新建科目」是同一排里的一条板条，不是网格末尾一块虚线瓷砖。
//   4) 移动端同一批科目换成手风琴行，展开态由 aria-expanded 说出来，箭头跟着转。
//   5) 键盘和指针同权：板条可聚焦，Enter / Space 与点击做同一件事。
// 文案风格归 dev/copy-guard.test.ts，字阶圆角颜色归 dev/design-scale.test.ts，这里不重复。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const GALLERY = 'src/components/CourseAccordionGallery.tsx';
const DASHBOARD = 'src/components/MasterDashboard.tsx';
const read = (file: string) => readFileSync(file, 'utf8');
/* 注释里提到「网格」是在交代它被换掉过，不会渲染出去，先剥掉再查 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const src = read(GALLERY);
const code = codeOnly(src);

/* 反面样本用的判定：平铺网格的写法。抓到任意一条就说明形态被换掉了。 */
function gridOffenses(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/(?:^|[\s"'`])((?:[a-z-]+:)*grid-cols-[^\s"'`]*)/g)) bad.push(m[1]);
  if (/<article[\s>]/.test(text)) bad.push('<article> 独立卡片');
  return bad;
}

await check('桌面是一排横向板条，不是卡片网格', () => {
  assert.ok(/hidden md:flex w-full h-\[400px\]/.test(code), '桌面那排要等高 400px，且只在 md 以上出现');
  assert.ok(/overflow-hidden items-stretch/.test(code), '板条等高拉满，超出的裁掉');
  assert.deepEqual(gridOffenses(code), [], `百叶窗被换成了平铺网格：\n${gridOffenses(code).join('\n')}`);
});

await check('宽度由 flex 分配：收起 60px，展开 380px / 5 倍', () => {
  assert.ok(/flex: isExpanded \? "5" : "1"/.test(code), '展开那条吃 5 份，其余各 1 份');
  assert.ok(/minWidth: isExpanded \? "380px" : "60px"/.test(code), '展开下限 380px，收起下限 60px');
  assert.ok(/transition-all duration-300/.test(code), '展开是一段过渡，不是瞬间换布局');
});

await check('展开由指针驱动，离开整排回到选中那条', () => {
  assert.ok(/const \[activeHoverId, setActiveHoverId\]/.test(code), '悬停态是一份状态');
  assert.ok(/const \[selectedId, setSelectedId\]/.test(code), '选中态是另一份，点击才动它');
  assert.ok(
    /const effectiveExpandedId = activeHoverId !== null \? activeHoverId : selectedId/.test(code),
    '悬停优先于选中：指针在的时候听指针的'
  );
  assert.ok(/onMouseEnter=\{\(\) => setActiveHoverId\(plan\.id\)\}/.test(code), '落到哪条展开哪条');
  assert.ok(/onMouseLeave=\{\(\) => setActiveHoverId\(null\)\}/.test(code), '离开整排才回落，不是每条各清各的');
});

await check('收起的板条上科目名竖排——百叶窗的签名', () => {
  assert.ok(/rotate-90 origin-center/.test(code), '收起态的名字要转 90 度');
  assert.ok(/whitespace-nowrap rotate-90/.test(code), '竖排名字不换行');
  assert.ok(/max-w-\[220px\] truncate/.test(code), '长科目名截断，不撑破板条');
  assert.ok(/<PageIconGlyph plan=\{plan\} className="text-\[20px\]" \/>/.test(code), '收起态顶部仍是科目自己的页面图标');
});

await check('「新建科目」是同一排里的一条板条', () => {
  assert.ok(/const isAddNewExpanded = effectiveExpandedId === "add_new"/.test(code), '新建那条和科目共用一套展开态');
  assert.ok(/onMouseEnter=\{\(\) => setActiveHoverId\("add_new"\)\}/.test(code), '它也会被指针展开');
  assert.ok(/flex: isAddNewExpanded \? "5" : "1"/.test(code), '宽度分配与科目板条同一条规矩');
  assert.ok(/minWidth: isAddNewExpanded \? "360px" : "60px"/.test(code), '收起同样是 60px 一条');
  assert.ok(/border-2 border-dashed/.test(code), '新建那条是虚线，和已有科目分得开');
  /* 它必须住在桌面那排里面，而不是被挪到容器外面当一块独立瓷砖 */
  const desktopAt = code.indexOf('hidden md:flex w-full h-[400px]');
  const mobileAt = code.indexOf('md:hidden space-y-2.5');
  const addSlatAt = code.indexOf('const isAddNewExpanded');
  assert.ok(desktopAt > 0 && mobileAt > desktopAt, '桌面那排在移动端那排之前');
  assert.ok(addSlatAt > 0 && addSlatAt < desktopAt, '新建板条的展开态在渲染那排之前就算好');
  assert.ok(
    code.indexOf('setActiveHoverId("add_new")') > desktopAt && code.indexOf('setActiveHoverId("add_new")') < mobileAt,
    '新建板条渲染在桌面那排内部'
  );
});

await check('移动端是同一批科目的手风琴行', () => {
  assert.ok(/md:hidden space-y-2\.5/.test(code), 'md 以下换成纵向手风琴');
  assert.ok(/aria-expanded=\{isExpanded\}/.test(code), '展开态对读屏说出来');
  assert.ok(/isExpanded \? "rotate-180" : ""/.test(code), '箭头跟着展开转');
  assert.ok(/setSelectedId\(isExpanded \? "add_new" : plan\.id\)/.test(code), '点同一行收回去，不是只开不关');
  /* 两个形态共用同一份数据口径，不许各算一套进度 */
  assert.equal((code.match(/const \{ pending, progress, examLabel \} = cardFacts\(plan\)/g) || []).length, 2,
    '桌面和移动端都从 cardFacts 取数，没有第二套算法');
  assert.equal((code.match(/const cardFacts = /g) || []).length, 1, 'cardFacts 只有一份');
});

await check('键盘和指针同权', () => {
  const keyHandlers = code.match(/if \(e\.key === "Enter" \|\| e\.key === " "\)/g) || [];
  assert.ok(keyHandlers.length >= 4, `桌面科目板条 / 新建板条 / 移动端新建行 / 移动端科目行都要接键盘，实际 ${keyHandlers.length} 处`);
  assert.ok(/tabIndex=\{0\}/.test(code), '板条可聚焦');
  assert.ok(/role="button"/.test(code), '板条对读屏是个按钮');
  assert.ok(/e\.preventDefault\(\)/.test(code), 'Space 不该顺手把页面滚下去');
  assert.ok(
    /aria-label=\{[\s\S]{0,200}isExpanded \? "收起" : "展开"/.test(code),
    '中文 aria-label 说的是展开/收起，不是含糊的「科目」'
  );
  assert.ok(/isExpanded \? "collapse" : "expand"/.test(code), '英文 aria-label 同样说清动作');
});

await check('总览页仍然把这一排挂出来，没有绕过它另铺一份', () => {
  const dash = read(DASHBOARD);
  assert.ok(/import \{ CourseAccordionGallery \} from "\.\/CourseAccordionGallery"/.test(dash), '用的是这一份组件');
  assert.equal((dash.match(/<CourseAccordionGallery/g) || []).length, 1, '只渲染一次');
  assert.deepEqual(gridOffenses(codeOnly(dash)), [], '总览页自己不许再铺一层科目网格');
  assert.ok(/todayStr=\{todayStr\}/.test(dash), '今日口径由总览页传进来，卡组不自己算今天');
});

/* 反面样本：规则抓不住就等于没规则，这里先验自己 */
await check('守卫有效：网格写法抓得住，百叶窗写法不误伤', () => {
  assert.deepEqual(gridOffenses('className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"'),
    ['sm:grid-cols-2', 'xl:grid-cols-3'], '这正是 f1ba47d 换上去的那一行');
  assert.deepEqual(gridOffenses('<article key={plan.id} className="ui-card p-4">'), ['<article> 独立卡片']);
  assert.deepEqual(gridOffenses('className="hidden md:flex w-full h-[400px] gap-3"'), [], '横向板条不是网格');
  assert.deepEqual(gridOffenses('className="md:hidden space-y-2.5"'), [], '手风琴也不是网格');
  assert.deepEqual(gridOffenses(codeOnly('/* 以前被换成 grid-cols-3，现在恢复了 */ const a = 1;')), [], '注释不会渲染出去');
  assert.deepEqual(gridOffenses('className="flex gap-3 items-stretch"'), [], 'flex 排不是网格');
});

console.log(`\n${passed} subject-deck checks passed`);