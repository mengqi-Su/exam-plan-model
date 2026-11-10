// 科目详情页的排版是这一轮定下来的：npm run test:course
// 它被改坏过一次的方式不是「不好看」，而是同一件事说三遍：距考试在页头、卡组、科目页各一个口径，
// 考点数在轮盘中心和资料段标题各数一次，生成计划在页头和今日卡各一颗主按钮，
// 外加「页 → 左标栏 + 白卡 → 卡里再套卡」最多四层边框。这里钉住的是这些结构，不是配色文案。
//   1) 段骨架只有标题行 + 全宽内容，没有 168px 左标栏，标题不在栏里和内容里各写一遍。
//   2) 备考路线是页头下面的一条横轴（宽屏一排节点 / 窄屏纵向列表），不是纵向时间线大卡。
//   3) D-N 全站科目页只由 countdownDnLabel 说一次；秒级口径和每秒重渲染都不在这页。
//   4) 一个功能一处：主按钮一颗、考点数一处、资料计数不带考点、重排默认只留一个动作。
//   5) 嵌套深度：卡里不许再套卡。
//   6) 带单位的数字只印一遍：数字已在旁边时用 unitNoun()，不能用会自己数数的 pl()。
// 字阶圆角颜色归 dev/design-scale.test.ts，文案风格归 dev/copy-guard.test.ts，卡组形态归 dev/subject-deck.test.ts。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pl, unitNoun } from '../src/lib/text';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const SECTION = 'src/components/SectionBlock.tsx';
const ROADMAP = 'src/components/PhaseRoadmapSection.tsx';
const PAGE = 'src/components/CourseDetailPage.tsx';
const MASTERY = 'src/components/TopicMasterySection.tsx';
const WHEEL = 'src/components/DomainMasteryWheelChart.tsx';
const REBALANCE = 'src/components/RebalanceSection.tsx';
const HUB = 'src/components/CourseKnowledgeHub.tsx';
const TEXT = 'src/lib/text.ts';
const read = (file: string) => readFileSync(file, 'utf8');
/* 注释里写「原来是左标栏」是在交代改过什么，不会渲染出去，先剥掉再查 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* 反面样本判定：左标栏的写法（定宽标签列 + 内容列并排）。 */
function railOffenses(text: string): string[] {
  const bad: string[] = [];
  for (const m of text.matchAll(/(?:^|[\s"'`])((?:lg:|md:)?w-\[1[0-9]{2}px\])/g)) bad.push(m[1]);
  if (/flex-col lg:flex-row/.test(text)) bad.push('lg:flex-row 双列：标签列和内容列并排');
  if (/lg:shrink-0/.test(text)) bad.push('把左列钉死不缩，就是标栏');
  return bad;
}

/* 反面样本判定：卡里套卡。渲染出的 ui-card 数超过一层就是套娃。 */
function cardLayers(text: string): number {
  return (text.match(/className="[^"]*\bui-card\b/g) || []).length;
}

await check('段骨架：标题行 + 全宽内容，没有左标栏', () => {
  const code = codeOnly(read(SECTION));
  assert.deepEqual(railOffenses(code), [], `段骨架长回了左标栏：\n${railOffenses(code).join('\n')}`);
  assert.ok(/<section className="py-6/.test(code), '段间距回到全站块间距一档，不再为两列留 36-40px');
  assert.ok(/title: string;/.test(code) && !/title:\s*React\.ReactNode/.test(code), '标题是一段纯文字，只在标栏出现一次');
  /* 标题与它的计数/操作同一行；内容在下一行，中间只隔 mt-3 */
  assert.ok(/flex flex-wrap items-center[^"]*gap-x-3/.test(code), '标题、读数、动作排同一行');
  assert.ok(/action && <span className="ml-auto/.test(code), '动作靠右，读数不跟着标题漂');
  assert.ok(/body\.length > 0 && <div className="mt-3/.test(code), '没有内容时不多出一段空白');
});

await check('备考路线是横轴：宽屏一排节点，窄屏纵向列表', () => {
  const code = codeOnly(read(ROADMAP));
  assert.ok(/<ol className="hidden items-start md:flex">/.test(code), '宽屏是一排等分节点');
  assert.ok(/<ol className="relative space-y-4 md:hidden">/.test(code), '窄屏纵向列表，同一份节点数据');
  assert.ok(/min-w-0 flex-1/.test(code), '节点宽度按 flex 等分，阶段增减不用改排版');
  assert.ok(/left-1\/2 -right-1\/2/.test(code), '连接线用分数留白接下一个节点，不写魔法数字');
  assert.ok(!/ui-card/.test(code), '轴本身不包白卡：包上就成了段里的第四层');
  assert.deepEqual(railOffenses(code), [], '轴不住在左标栏里');
  /* 渐进披露：描述只在选中那一段出现，不做每段全展开的长列表 */
  assert.ok(/active\?\.detail && \(/.test(code), '只说选中那一段要做什么');
  assert.ok(/onClick=\{\(\) => setSelIdx\(idx\)\}/.test(code), '节点可点，点和读是同一次渲染');
  assert.ok(/const \[selFrom, setSelFrom\] = useState\(plan\.id\)/.test(code), '换科目把选中态还给这一门');
});

await check('轴末端就是考试日，D-N 在科目页只说一次', () => {
  const roadmap = codeOnly(read(ROADMAP));
  assert.ok(/key: "exam-day"/.test(roadmap), '考试日挂在轴的最右端');
  assert.ok(/countdownDnLabel\(examCount, isZh\)/.test(roadmap), '轴上那行读数用 D-N 口径');
  assert.ok(/list\.length === 0 && examCount/.test(roadmap), '没有阶段时左端补「今天」，孤点不叫轴');
  const page = codeOnly(read(PAGE));
  assert.equal((roadmap + page + codeOnly(read(MASTERY))).match(/距考试|Days left/g)?.length || 0, 0,
    '页头不再挂一条「距考试」属性：天数只在轴上说一次');
  assert.ok(!/countdownClockLabel|countdownDaysLabel/.test(page), '科目页不引秒级／自然日另一种口径');
  assert.ok(!/setInterval/.test(page), '不为一个一秒一跳的读数每秒重渲染整页');
  assert.equal((page.match(/<PropItem/g) || []).length, 3, '属性行只剩 学科 / 考试 / 目标 三条事实');
  assert.ok(!/examCountdown|countdownDays/.test(page), '页头自己不算倒计时');
});

await check('一个功能一处：主按钮一颗、重排一个动作、计数不重复', () => {
  const page = codeOnly(read(PAGE));
  assert.equal((page.match(/ui-btn-primary/g) || []).length, 1, '页头那颗是全站唯一的主按钮');
  assert.ok(!/ui-btn-primary/.test(codeOnly(read(MASTERY))), '掌握度段不另起一颗主按钮');
  /* 资料段只数资料；考点数由轮盘中心那一处说 */
  assert.ok(!/topicsCount/.test(page), '科目页不再数考点，两处各数一遍会长成两个数');
  assert.ok(/materialsCount/.test(page) && /个考点|topics/g.test(codeOnly(read(WHEEL))), '考点计数留在轮盘中心那一处');
  /* 待办卡不复刻页头那颗按钮：动作标签全站只喂给 primaryAction 一处 */
  assert.ok(/pendingCopy\.title/.test(page), '待办卡说的是还差什么');
  assert.equal((page.match(/pendingCopy\.action/g) || []).length, 1,
    '待办的动作标签只给页头那颗按钮用，内容区不再复刻第二颗');
  assert.ok(page.indexOf('pendingCopy.action') < page.indexOf('<main'),
    '那一处住在页头的主动作里，不是住在正文的卡片里');
});

/* 数字印两遍不是风格问题，是坏掉的句子。这页刚在英文里翻过一次车：
   pl() 自己带数字，调用处已经把 0.8/5.5 印完了，于是渲染成 "Invested 0.8/5.5 5.5 hrs"。
   分工钉住——要数字用 pl()，数字已经在旁边就用 unitNoun()。 */
await check('带单位的数字只印一遍：pl() 数数，unitNoun() 只管词尾', () => {
  const page = codeOnly(read(PAGE));
  const text = codeOnly(read(TEXT));
  assert.ok(/export function pl\([\s\S]{0,200}return\s*`\$\{n\} \$\{/.test(text),
    'pl() 会印出数字——哪天它改成只返名词，这条先红，免得调用处全都变成半个句子');
  assert.ok(!/export function unitNoun[\s\S]{0,200}return\s*`\$\{n\}/.test(text),
    'unitNoun() 只挑单复数，不碰数字');
  assert.ok(
    /\{isZh \? "小时" : unitNoun\(stats\.plannedHours, \{ one: "hr", many: "hrs" \}\)\}/.test(page),
    '投入那行的单位接的是 unitNoun：0.8/5.5 已经印在 ui-row-value 里了');
  assert.ok(!/pl\(stats\.plannedHours/.test(page), '同一行不许再让 pl() 把小时数数第二遍');
  /* 反面样本就是线上真出现过的那一句 */
  assert.equal(`Invested 0.8/5.5 ${pl(5.5, 'hr', 'hrs')}`, 'Invested 0.8/5.5 5.5 hrs',
    '用错 helper 就长成这样，而它正是上一版渲染出来的句子');
  assert.equal(`0.8/5.5 ${unitNoun(5.5, { one: 'hr', many: 'hrs' })}`, '0.8/5.5 hrs');
  assert.equal(`1 ${unitNoun(1, { one: 'hr', many: 'hrs' })}`, '1 hr', '整一小时不写成 1 hrs');
});

await check('重排默认只有一个动作，确认那颗展开之后才有', () => {
  const rebalance = codeOnly(read(REBALANCE));
  assert.ok(/action=\{/ .test(rebalance), '未展开时只有一个 ghost 动作挂在段标题行');
  assert.ok(/!armed && \(/.test(rebalance), '展开之后标题行那颗就收掉，不两排按钮并存');
  const armedAt = rebalance.indexOf('{armed && (');
  const confirmAt = rebalance.indexOf('ui-btn-primary');
  assert.ok(armedAt > 0, '展开的输入区是一处条件渲染');
  assert.ok(confirmAt > armedAt, '确认按钮只在展开之后出现');
  assert.ok(/title=\{isZh \? "计划动态重排" : "Adaptive rebalance"\}/.test(rebalance),
    '段名不改：改考试日期那条提示指着它');
});

await check('嵌套深度：卡里不套卡', () => {
  /* 掌握度：外层一张卡（SVG 扇区要白底），明细列不再自描一圈边 */
  const wheel = codeOnly(read(WHEEL));
  assert.equal(cardLayers(wheel), 1, `轮盘这块只许一层卡，实际 ${cardLayers(wheel)} 处`);
  assert.ok(/lg:border-l/.test(wheel), '宽屏两栏靠发丝竖线分，不靠第二个卡面');
  /* 资料区：展开态直接挂 hub，收起态那颗条状按钮是这一段唯一的一层 */
  const page = codeOnly(read(PAGE));
  assert.ok(!/className="ui-card p-4 sm:p-5 animate-fadeIn"/.test(page), '展开的资料区外面不套白卡');
  assert.equal(cardLayers(page), 2, '科目页自己只画两张卡面：今日任务列表 + 资料区收起条');
  assert.ok(/w-full ui-card ui-card-hover/.test(page), '收起态那颗条仍然是卡，一点就展开');
  /* 段组件不自带卡：卡属于内容，属于段里那一块，不属于骨架 */
  assert.equal(cardLayers(codeOnly(read(MASTERY))), 0, '掌握度段骨架不画卡');
});

await check('顺序：先全景，再今天，再哪里没掌握，最后凭什么', () => {
  const page = read(PAGE);
  const at = (s: string) => page.indexOf(s);
  const order = [
    at('<PhaseRoadmapSection plan={plan} />'),
    at('title={isZh ? "今日任务" : "Today"}'),
    at('<TopicMasterySection plan={plan} />'),
    at('title={isZh ? "课程资料与考点体系" : "Materials & topics"}'),
    at('<RebalanceSection plan={plan} onUpdatePlan={onUpdatePlan} />'),
  ];
  assert.deepEqual(order.filter((n) => n < 0), [], '五段都在页上');
  assert.deepEqual([...order].sort((a, b) => a - b), order, `顺序被打乱了：${order.join(', ')}`);
});

await check('守卫有效：左标栏和卡里套卡都抓得住', () => {
  assert.deepEqual(
    railOffenses('<div className="flex flex-col lg:flex-row lg:gap-10"><div className="min-w-0 lg:w-[168px] lg:shrink-0" /></div>'),
    ['lg:w-[168px]', 'lg:flex-row 双列：标签列和内容列并排', '把左列钉死不缩，就是标栏'],
    '这正是改之前的段骨架'
  );
  assert.deepEqual(railOffenses('<section className="py-6"><div className="flex flex-wrap items-center gap-x-3" /></section>'),
    [], '改之后的标题行不是标栏');
  assert.deepEqual(railOffenses('className="w-[168px]"'), ['w-[168px]'], '不带 lg: 前缀的定宽列也抓');
  assert.equal(cardLayers('<div className="ui-card p-6"><aside className="ui-card p-5 space-y-4" /></div>'), 2,
    '两层卡面数得出来');
  assert.equal(cardLayers('<div className="flex-1 w-full max-w-md space-y-4 border-t pt-5" />'), 0, '边框不算卡面');
  assert.deepEqual(
    railOffenses(codeOnly('/* 原来是 lg:w-[168px] 的左标栏 */ <section className="py-6" />')),
    [], '注释不会渲染出去');
});

/* 资料区内部自己那批卡属于 hub，改它要连着改这份守卫——这里只提醒别把它当骨架用 */
await check('资料区仍是独立组件，段骨架没被塞进它', () => {
  const hub = read(HUB);
  assert.ok(!/SectionBlock/.test(hub), 'hub 自己排内容，不套段骨架再套一层卡');
  assert.ok(/<CourseKnowledgeHub/.test(codeOnly(read(PAGE))), '科目页仍然只挂这一份资料区');
});

console.log(`\n${passed} course-page-layout checks passed`);
