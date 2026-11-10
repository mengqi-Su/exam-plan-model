// 科目总览的百叶窗卡组是用户定的设计，不是可以随手换掉的实现细节：npm run test:deck
// 它被平铺卡片网格替换过一次（f1ba47d），桌面悬停展开那一排和移动端手风琴一起没了。
// 这里钉住的是「形态」，不是配色文案——形态一旦被改回网格，这道守卫先红。
//   1) 桌面是一排等高的横向板条：收起 60px、展开 380px，靠 flex 5:1 分配宽度，
//      指针落到哪张哪张展开，离开整排回到选中那张。不是 grid，不是每门一张独立卡片。
//   2) 收起的板条上科目名是竖排的（rotate-90）——这是百叶窗的签名，横排就不是百叶窗了。
//   3) 「新建科目」是同一排里的一条板条，不是网格末尾一块虚线瓷砖。
//   4) 移动端同一批科目换成手风琴行，展开态由 aria-expanded 说出来，箭头跟着转。
//   5) 键盘和指针同权：板条可聚焦，Enter / Space 与点击做同一件事。
//   6) 总览页页头的三个数是三条「标签在上、数字在下」的读数格，靠空白分组，不装盒子、
//      也不拼成一句中点分隔的话；科目计数全站一处，没值的格整格不写。
//      字号钉在 13 标签 / 20 数字这一档（token：ui-metric-label / ui-metric-value）。
//      这一条改过两次：先是带边框的统计卡被拆成一行 12 档脚注（读不见），
//      再是字号补到 15 的散文行——形态和大小都不对，并列的数要排成一排才扫得过去。
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

/* 页头读数条的反面写法，三代都有过：
   第一代——四个短读数被 rounded+border+bg-white 框成「一块内容」，最后一项用 ml-auto
   推到最右边拉出一段空洞，值靠手写 <b> 加粗，没数的地方印「—」。
   第二代——盒子拆了，却挂上「今日」页列表脚注的 ui-row-meta / ui-row-value（12 档），
   页头三个数在 24 的标题下面根本读不见。
   第三代——字号补到 15 了，形态仍是一句中点分隔的话：要按顺序读完才知道哪个数属于哪件事。
   现在的口径是三条格子：标签在上、数字在下，格子之间只留空白。 */
function stripOffenses(text: string): string[] {
  const bad: string[] = [];
  if (/rounded-(?:xl|2xl|lg)[^>\n]*border[^>\n]*bg-white/.test(text)) bad.push('带边框的白底统计卡');
  if (/\bml-auto\b/.test(text)) bad.push('ml-auto 把最后一项推出一段空洞');
  if (/<b[\s>]/.test(text)) bad.push('<b> 手写加粗：取值该挂 ui-metric-value');
  if (/nearestDisplay|"—"/.test(text)) bad.push('用「—」给一个不存在的数占位');
  if (/\bui-row-(?:meta|value)\b/.test(text)) bad.push('读数条退回 12 档脚注：页头的数字要给眼睛看，不是列表附注');
  if (/\{" · "\}/.test(text)) bad.push('把几个读数串成一句中点分隔的话：并列的数要排成格子，扫一眼就拿到，不是读完才懂');
  if (/ui-readout/.test(text)) bad.push('上一代散文读数的 token 又长回来了：格子形态不用它');
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

await check('总览页的读数是三条格子，不是一张卡也不是一句话', () => {
  const dash = codeOnly(read(DASHBOARD));
  assert.deepEqual(stripOffenses(dash), [], `读数条被改回了老写法：\n${stripOffenses(dash).join('\n')}`);
  /* 形态：一格一个指标，横排，格与格之间只有空白（gap-x-10 = 40px），没有边框和底色。
     三家设计系统对「并列短读数」给的是同一个形状——标签在上、数值在下（Ant Design
     Statistic、Element 统计数值、Carbon Data grid），差别只在颜色与容器；分组靠空白。 */
  assert.ok(/<div className="flex flex-wrap items-start gap-x-10 gap-y-4">/.test(dash), '格子横排、顶对齐，用空白分组');
  assert.equal((dash.match(/className="min-w-0">/g) || []).length, 3, '三格各自 min-w-0，长名字截断而不是撑开这一排');
  /* 层级：标签 13 灰 / 数字 20 加粗，成对出现，全站只有这一处定义（index.css 的 ui-metric-*） */
  assert.equal((dash.match(/ui-metric-label/g) || []).length, 3, '三个标签同一档');
  assert.equal((dash.match(/ui-metric-value/g) || []).length, 3, '三个数字同一档，不各写各的加粗');
  assert.match(dash, /<p className="ui-metric-label">\{isZh \? "今日" : "Today"\}<\/p>\s*<p className="ui-metric-value">/, '标签在上、数字在下');
  assert.ok(!/\bui-row-(?:meta|value)\b/.test(dash), '这排不退回 12 档脚注：页头的数要给眼睛看');
  assert.ok(/<span[\s\S]{0,120}className="ui-row-title ml-2 inline-block max-w-\[220px\] truncate align-baseline"[\s\S]{0,200}title=\{/.test(dash), '科目名是词不是数：跟在 D-42 后面走 13 medium，截断时 title 给全名');
  /* 计数只数一遍：h1 后面那颗 chip 是全站唯一一处，段头「备考科目」整块没了 */
  assert.equal((dash.match(/\{plans\.length\}/g) || []).length, 1, '科目计数只有一处');
  assert.ok(!/ui-section-title/.test(dash) && !/备考科目/.test(dash), '卡组上面不再有一个和自己抢名字的段头');
  /* 读数条住在页头下面一整行，而不是挤在标题那一列里——它该和下面的卡组同宽，数字才扫得过去 */
  const buttonAt = dash.indexOf('onAddNewSubject} className="ui-btn ui-btn-primary');
  assert.ok(buttonAt > 0 && dash.indexOf('ui-metric-label') > buttonAt, '读数排在「新建科目」那一行之后，横贯整页');
  /* 没值就不写这一格：0/0、— 和「0%」都是在说一件并不存在的事 */
  assert.ok(/todayTotal === 0\s*\n?\s*\? isZh\s*\n?\s*\?\s*"无"/.test(dash), '今天没排任务时这一格写「无」，不摆 0/0');
  assert.ok(/nearestDays !== null && \(/.test(dash), '没有带日期的考试时，「最近考试」整格消失');
  assert.ok(!/awaitingSchedule \? "—"/.test(dash), '还没生成计划时不报 0%，也不报 —');
  assert.ok(/!workspaceMetrics\.awaitingSchedule && \(/.test(dash), '总进度这一格在这种时候根本不出现');
  /* 完成度是比例：数字后面跟一条内联条，纯装饰所以 aria-hidden；粗细跟着字号一起升，
     1px 高的条在 20 的数字旁边只剩一层灰 */
  assert.ok(/aria-hidden="true"[\s\S]{0,200}inline-block h-1\.5 w-16/.test(dash), '内联进度条对读屏是装饰，百分数才是话');
  assert.ok(/style=\{\{ width: `\$\{workspaceMetrics\.globalProgress\}%` \}\}/.test(dash), '条的宽度和那个百分数同一个数');
});

await check('读数格的字号只有 token 一份，散文写法的 token 已删干净', () => {
  const css = codeOnly(read('src/index.css'));
  assert.ok(/\.ui-metric-label \{[^}]*text-\[13px\][^}]*text-\[#6b6660\]/.test(css), '标签 13 灰');
  assert.ok(/\.ui-metric-value \{[^}]*text-\[20px\][^}]*font-semibold[^}]*tabular-nums[^}]*text-\[#1c1b1a\]/.test(css), '数字 20 加粗等宽');
  /* 删槽位而不是删句子：上一代散文读数的 token 留着，下一个页面就会把三个数又拼成一句话 */
  assert.ok(!/ui-readout/.test(css), 'ui-readout / ui-readout-num 已经从标尺里删掉');
  assert.equal((css.match(/text-\[20px\]/g) || []).length, 1, '20 档在标尺里只有 ui-metric-value 一处定义');
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
  /* 统计卡那一段就是第一代原文，一条都不能漏 */
  const OLD_STRIP = `<div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#eae7e1] bg-white px-4 py-3">
        <span>最近考试 <b className="font-semibold">{nearestDisplay}</b></span>
        <span className="ml-auto">总进度 <b>{p}%</b></span>
      </div>`;
  assert.deepEqual(stripOffenses(OLD_STRIP),
    ['带边框的白底统计卡', 'ml-auto 把最后一项推出一段空洞', '<b> 手写加粗：取值该挂 ui-metric-value', '用「—」给一个不存在的数占位'],
    '这是第一代的写法');
  assert.deepEqual(stripOffenses('<p className="ui-row-meta mt-2 tabular-nums">今日 <span className="ui-row-value">2/5</span></p>'),
    ['读数条退回 12 档脚注：页头的数字要给眼睛看，不是列表附注'],
    '第二代：盒子拆了，字号却压成了脚注那档');
  const PROSE = `<p className="ui-readout mt-1.5">今日 <span className="ui-readout-num">2/5</span>{" · "}最近考试 <span className="ui-readout-num">D-42</span></p>`;
  assert.deepEqual(stripOffenses(PROSE),
    ['把几个读数串成一句中点分隔的话：并列的数要排成格子，扫一眼就拿到，不是读完才懂',
      '上一代散文读数的 token 又长回来了：格子形态不用它'],
    '第三代：字号升到 15 了，形态还是一句话——用户的答案是「你会排布信息吗」');
  assert.deepEqual(stripOffenses('<div className="flex flex-wrap items-start gap-x-10 gap-y-4"><div className="min-w-0"><p className="ui-metric-label">今日</p><p className="ui-metric-value">2/5</p></div></div>'),
    [], '现在的格子写法不误伤');
});

console.log(`\n${passed} subject-deck checks passed`);