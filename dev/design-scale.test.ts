// 设计标尺的三条底线，全站一次性检查：npm run test:scale
//   1) 字号只有档，不是想写多少写多少。读字的六档 11/12/13/15/20/24 写在组件里；
//      更大的是显示层（页头 28、页图标 48、统计数字 30），它们只允许出现在 index.css
//      的那几个 .ui-* 类里——组件想放大字号就挂类，不要再造一个 text-3xl 的第四方档位。
//      Tailwind 的具名尺寸类（text-sm / text-3xl …）也一并禁掉：同一档有两个写法，
//      等于每次新页面都要重新决定「13 到底是 text-sm 还是 text-[13px]」。
//   2) 圆角只有三层：控件 8、卡片 12、浮层 16、胶囊 full。
//      4px（裸 rounded）和 6px（rounded-md）跟 8px 差肉眼分不出，却够让人怀疑「是不是没对齐」。
//   3) 颜色不许再长出第四种灰：退役字面量禁止，文字色必须是量过对比度的那一份名单，
//      装饰性写法（uppercase、单独一个「·」）全站清零。
// 注释里提到旧颜色是正当的说明（清单 UI-03 要交代为什么换），所以先按行保留换行地剥掉注释再查。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

/* 读字档：11 胶囊 / 12 元信息与标签 / 13 行与正文 / 15 段与属性 / 20 数字强调 / 24 页面标题 */
const READING_TIERS = [11, 12, 13, 15, 20, 24];
/* 显示档：只许写在 index.css 的 .ui-doc-title / .ui-page-icon / .ui-stat-value / .ui-display-num 里 */
const DISPLAY_TIERS = [28, 30, 36, 48, 64];
const NAMED_SIZES = "xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl";
/* 圆角四层：控件 8 / 卡片 12 / 浮层 16 / 胶囊。方向前缀（rounded-tr-lg）和响应式前缀（sm:rounded-xl）都算。 */
const IN_TIER = /^(?:[a-z-]+:)*rounded(?:-[a-z]{1,2})?-(?:lg|xl|2xl|full)$/;
/* 整串取出一个 rounded 开头的类名 token：到空白或引号为止。 */
const RADIUS_TOKEN = /(?:^|[\s"'`])((?:[a-z-]+:)*rounded[^\s"'`]*)/g;

/* 退役字面量：旧设计系统的灰、被 #6b6660 取代的那两档、以及只活在便利贴主题表里的旧黄。
   这里查的是「会当成样式生效」的位置，不是全仓字符串——FOUR_NOTE_THEMES 那种数据表
   走内联 style，每一档都单独量过（8.39–14.74:1），归 #209 的便利贴色系一起处理。 */
const RETIRED = [
  "#111111", "#222222", "#333333", "#444444", "#666666", "#777777", "#888888", "#999999",
  "#cccccc", "#a39e97", "#8a8580", "#a6a298", "#a39f96", "#c5c1b8", "#8e8e8e",
  "#fcd33b", "#d8d8d8", "#b5b5b5", "#282828", "#e6e0d6", "#9a1d14",
];

/* 文字色白名单：每一个都在自己的背景上量过 ≥4.5:1（窄体图标按 3:1 也算过）。
   新加一档颜色 = 先量对比度，再把值加进来；这样「换个浅一点的灰」过不了守卫。 */
const TEXT_COLORS = [
  "#1c1b1a", // 主文字，纸白上 16.05:1
  "#6b6660", // 次级文字唯一一档：纸白 5.31，#f1efe9 4.94，白 5.68
  "#716c65", // 占位符：白 5.20
  "#b42318", // 危险/红：#FDF0EE 上 5.91
  "#8a5a00", // 提醒/黄：#FFF6DD 上 5.50
  "#3f6b4f", // 达成/绿：#EEF4EF 上 5.49
  "#1d4ed8", // 链接：#EEF3FE 上 6.03
  "#6b4e8e", // 真题标签：#F3EEF8 上 5.92
  "#8ab4f8", // 夜读链接：#18181A 上 8.41
  "#e4e4e7", // 夜读正文：#18181A 上 13.97
  "#a1a1aa", // 夜读次级：#18181A 上 6.92
  "#18181a", // 印在浅黄胶囊上的夜读图标：#FCD33B 上 11.89
  "#d8b878", // 夜读要点：#2a2618 上 7.95
  "#cbb98a", // 夜读要点列表：#2a2618 上 7.81
  "#f0a9a0", // 夜读删除：#18181A 上 9.19
  "#7fbf95", // 复制成功：#18181A 上 8.26
  "#2b2319", // 米读正文：#F5EFEB 上 13.58
  "#6b5842", // 米读次级：#F5EFEB 上 5.95
  "#6b5320", // 米读要点列表：#FFF6DD 上 6.76
];

/* 剥注释但保留行号：直接删掉整段注释会让后面每一行的行号往前跳，报错就指不到地方了。 */
function maskComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  let out = src.replace(/\/\*[\s\S]*?\*\//g, blank);
  out = out.replace(/(^|[^:\\])(\/\/[^\n]*)/gm, (_all, pre: string, comment: string) => pre + blank(comment));
  return out;
}

function sourceFiles(dir: string, patterns: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, patterns, out);
    else if (patterns.test(entry)) out.push(full);
  }
  return out;
}

const components = sourceFiles("src", /\.tsx$/);
const liveOf = (file: string) => maskComments(readFileSync(file, "utf8"));

/* 只认类名 token 位，不认整行：注释以外的 rounded-xl 出现在 className 里才算用了这一档 */
const token = (re: RegExp, text: string): string[] => [...text.matchAll(re)].map((m) => m[1] ?? m[0]);

/* 尺寸 token：小数也要抓。text-[13.5px] 这种「比 13 大一点点」正是这把标尺要消灭的东西，
   写成正整数就漏掉了它；rem/em/% 算另起一套单位，一律不许出现在字号上。 */
const SIZE_TOKEN = /text-\[([\d.]+(?:px|rem|em|%)?)\]/g;
const sizeOffense = (raw: string): string | null => {
  if (!raw.endsWith("px")) return `${raw}：字号只写 px`;
  const n = Number(raw.slice(0, -2));
  return READING_TIERS.includes(n) ? null : `${raw} 不在读字档`;
};

/* 具名尺寸类：捕获组要自己把 "text-sm" 整个包住，别指望 token() 补上——
   没有捕获组时它返回整串匹配，报错信息里会多出前缀和空白。 */
const NAMED_SIZE = new RegExp(`(?:^|[\\s"'\`])((?:[a-z-]+:)*text-(?:${NAMED_SIZES}))(?![\\w-])`, "g");
const NAMED_SIZE_LOOSE = new RegExp(`((?:[a-z-]+:)*text-(?:${NAMED_SIZES}))(?![\\w-])`, "g");

await check('字号：组件只用读字六档，显示档只住在 index.css 的类里', () => {
  const bad: string[] = [];
  for (const file of components) {
    for (const size of token(SIZE_TOKEN, liveOf(file))) {
      const why = sizeOffense(size);
      if (why) bad.push(`${file} ${why}`);
    }
    for (const named of token(NAMED_SIZE, liveOf(file))) bad.push(`${file} 具名尺寸类 ${named}`);
  }
  const css = liveOf("src/index.css");
  for (const size of token(SIZE_TOKEN, css)) {
    /* index.css 多一档显示层：28/30/36/48/64 只允许出现在这里 */
    const n = Number(size.slice(0, -2));
    if (size.endsWith("px") && (READING_TIERS.includes(n) || DISPLAY_TIERS.includes(n))) continue;
    const why = sizeOffense(size);
    if (why) bad.push(`src/index.css ${why}`);
  }
  for (const named of token(NAMED_SIZE_LOOSE, css)) bad.push(`src/index.css 具名尺寸类 ${named}`);
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('圆角：只有控件 8 / 卡片 12 / 浮层 16 / 胶囊 full 四层', () => {
  const bad: string[] = [];
  /* 整串取出再判档：rounded / rounded-md / rounded-sm / rounded-[10px] / rounded-${x}
     都是要消灭的东西——前三者与 8px 差肉眼分不出，后两者一个绕过 Tailwind 的扫描，
     一个在 Tailwind 4 里根本不会生成样式。 */
  for (const file of components) {
    for (const tok of token(RADIUS_TOKEN, liveOf(file))) {
      if (!IN_TIER.test(tok)) bad.push(`${file} ${tok}`);
    }
  }
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('颜色：退役字面量不再当样式用，文字色必须是量过的那一份', () => {
  const bad: string[] = [];
  /* 会生效的四个位置：类名里的文字/背景/边框色，SVG 的 fill/stroke，CSS 声明的值。
     数据表里的字符串（便利贴主题、扇形色板）不在此列——它们要单独按自己那块底量。 */
  const STYLE_SITES = /(?:text|bg|border|placeholder|placeholder-text|from|to|via|shadow)-\[(#?[0-9a-fA-F]{3,8})\]|(?:fill|stroke)="#([0-9a-fA-F]{3,8})"/g;
  for (const file of components) {
    const text = liveOf(file);
    for (const m of text.matchAll(STYLE_SITES)) {
      const raw = (m[1] || m[2] || "").toLowerCase();
      const hex = raw.startsWith("#") ? raw : `#${raw}`;
      if (RETIRED.includes(hex)) bad.push(`${file} 退役字面量 ${hex}`);
    }
    for (const c of token(/text-\[(#(?:[0-9a-fA-F]{3,8}))\]/g, text)) {
      if (!TEXT_COLORS.includes(c.toLowerCase())) bad.push(`${file} 文字色 ${c} 没在白名单里（先量对比度再加）`);
    }
  }
  const cssLines = liveOf("src/index.css").split(/\r?\n/);
  cssLines.forEach((line, i) => {
    for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      if (RETIRED.includes(m[0].toLowerCase())) bad.push(`src/index.css:${i + 1} 退役字面量 ${m[0]} 还写在声明里`);
    }
  });
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('装饰：不留 uppercase，也不留「·」当分隔符', () => {
  const bad: string[] = [];
  for (const file of components) {
    const text = liveOf(file);
    if (/(?:^|[\s"'`])(?:[a-z-]+:)*uppercase(?![\w-])/.test(text)) bad.push(`${file} 还有 uppercase`);
    /* 单独成元素的「·」：分隔靠的是 gap 或句子里的逗号，不是把一个点当成一个节点 */
    if (/<span[^>]*>\s*·\s*<\/span>/.test(text)) bad.push(`${file} 还有独立的中点分隔符`);
  }
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

/* 封面带下沿：不许是一条硬边。带子最后一段必须渐隐到透明，露出页面自己的纸色——
   用 mask 而不是叠一层纸色渐变，纸色才只有一处出处，换底色 / 做深色主题时不用跟着改第二遍。
   与 StarQuiz 的 dev/design-scale.mjs 是同一条规则、同一组反面样本。 */
const coverBandBlocks = (css: string) =>
  [...css.matchAll(/([^{}]*\.ui-cover-band[^{}]*)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
const WASHED = /(?:-webkit-)?mask-image:\s*linear-gradient\([^;]*,\s*transparent(?:\s+100%)?\s*\)/;
/* 先取值再判断：写成 `border:\s*(?!0\b)` 会被 \s* 的回溯绕过——
   零空白那一轮 lookahead 看到的是「 0」而不是「0」，于是 border:0 被误判成描边。 */
const declOf = (body: string, prop: string) => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:([^;]*)`).exec(body);
  return m ? m[1].trim() : "";
};
const EMPTY_EDGE = /^(?:0(?:px)?|none)(?:\s+(?:0(?:px)?|none))*$/;
const coverSeamOffenses = (css: string): string[] => {
  const blocks = coverBandBlocks(css);
  if (!blocks.length) return [".ui-cover-band 不见了：收边规则无处落地"];
  const bad: string[] = [];
  if (!blocks.some((b) => WASHED.test(b.body))) {
    bad.push("封面带下沿是硬边：需要一段以 transparent 收尾的 mask-image 渐隐");
  }
  for (const b of blocks) {
    for (const prop of ["border", "border-bottom"]) {
      const v = declOf(b.body, prop);
      if (v && !EMPTY_EDGE.test(v)) bad.push(`封面带描了边 → ${b.selector} { ${prop}: ${v} }`);
    }
    const v = declOf(b.body, "box-shadow");
    if (v && !EMPTY_EDGE.test(v)) bad.push(`封面带带了投影 → ${b.selector} { box-shadow: ${v} }`);
  }
  return bad;
};

await check('封面带下沿是收边不是硬边：渐隐到透明，且不描边不投影', () => {
  const bad = coverSeamOffenses(liveOf("src/index.css"));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

/* 白名单不是「写下来的数字」，是一条能重算的算术：色值改了、名单没改，这里先红。
   文字按 4.5:1，图形（图标/刻度）按 3:1——WCAG 的两条线，同一套相对亮度。 */
const srgb = (c: number) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : Math.pow((c / 255 + 0.055) / 1.055, 2.4));
const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luminance = (h: string) => {
  const [r, g, b] = hexToRgb(h);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const contrast = (a: string, b: string) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

await check('对比度：白名单里每一档在自己的背景上都过线', () => {
  const measured: Array<[string, string, number, string]> = [
    ["#1c1b1a", "#f8f7f4", 4.5, "主文字 / 纸白"],
    ["#6b6660", "#f8f7f4", 4.5, "次级文字 / 纸白"],
    ["#6b6660", "#f1efe9", 4.5, "次级文字 / 最浅轨道"],
    ["#6b6660", "#ffffff", 3.0, "次级文字当图标用 / 白"],
    ["#716c65", "#ffffff", 4.5, "占位符 / 白"],
    ["#b42318", "#fdf0ee", 4.5, "危险文字 / 自己的浅底"],
    ["#8a5a00", "#fff6dd", 4.5, "提醒文字 / 自己的浅底"],
    ["#3f6b4f", "#eef4ef", 4.5, "达成文字 / 自己的浅底"],
    ["#1d4ed8", "#eef3fe", 4.5, "链接 / 自己的浅底"],
    ["#6b4e8e", "#f3eef8", 4.5, "真题标签 / 自己的浅底"],
    ["#e4e4e7", "#18181a", 4.5, "夜读正文 / 夜读底"],
    ["#a1a1aa", "#18181a", 4.5, "夜读次级 / 夜读底"],
    ["#8ab4f8", "#18181a", 4.5, "夜读链接 / 夜读底"],
    ["#d8b878", "#2a2618", 4.5, "夜读要点 / 要点面板"],
    ["#cbb98a", "#2a2618", 4.5, "夜读要点列表 / 要点面板"],
    ["#f0a9a0", "#18181a", 4.5, "夜读删除 / 夜读底"],
    ["#7fbf95", "#18181a", 3.0, "复制成功图标 / 夜读底"],
    ["#2b2319", "#f5efeb", 4.5, "米读正文 / 米读底"],
    ["#6b5842", "#f5efeb", 4.5, "米读次级 / 米读底"],
    ["#6b5320", "#fff6dd", 4.5, "米读要点列表 / 要点面板"],
    ["#1c1b1a", "#fcd33b", 4.5, "便利贴上的字 / 明黄带"],
    ["#ffffff", "#282828", 4.5, "深色便利贴上的字"],
    ["#1c1b1a", "#b5b5b5", 4.5, "岩石灰带上的字"],
    ["#8a6a12", "#f1efe9", 3.0, "科目主色当进度条 / 最浅轨道"],
    ["#46658a", "#f1efe9", 3.0, "科目主色当进度条 / 最浅轨道"],
    ["#8a5348", "#f1efe9", 3.0, "科目主色当进度条 / 最浅轨道"],
    ["#4a7353", "#f1efe9", 3.0, "科目主色当进度条 / 最浅轨道"],
  ];
  const weak = measured
    .map(([fg, bg, min, name]) => ({ name, got: contrast(fg, bg), min }))
    .filter((r) => r.got < r.min)
    .map((r) => `${r.name} 只有 ${r.got.toFixed(2)}，要求 ${r.min}`);
  assert.deepEqual(weak, [], `\n${weak.join('\n')}`);
});

/* 反面样本：规则抓不住就等于没规则。误伤一次就会有人把守卫删掉，所以两边都要验。 */
await check('守卫有效：反面写法抓得住，正当写法不误伤', () => {
  /* 字号：小数档和 rem 都要被抓到，正当的 13px 与白名单里的 text-white 都不许误伤 */
  assert.ok(token(SIZE_TOKEN, 'className="text-[13.5px] text-[24px]"').includes("13.5px"));
  assert.ok(sizeOffense("0.8125rem"));
  assert.equal(sizeOffense("13px"), null);
  assert.equal(sizeOffense("24px"), null);
  assert.equal(token(NAMED_SIZE_LOOSE, 'className="text-sm text-[13px]"').join(), "text-sm");
  assert.deepEqual(token(NAMED_SIZE_LOOSE, 'className="text-white text-[#6b6660] hover:text-sm"'), ["hover:text-sm"]);
  /* 圆角：反面样本必须整串被认出来，不能只吃掉前缀——规则和自测用同一个 RADIUS_TOKEN，
     否则自测验的是另一套正则，规则本身有没有漏谁也不知道。 */
  const radiusTokens = (s: string) => token(RADIUS_TOKEN, s);
  assert.deepEqual(radiusTokens('className="rounded rounded-md rounded-sm rounded-[10px]"'), ["rounded", "rounded-md", "rounded-sm", "rounded-[10px]"]);
  assert.deepEqual(radiusTokens('className="rounded-lg rounded-2xl sm:rounded-xl rounded-full rounded-tr-lg"'), ["rounded-lg", "rounded-2xl", "sm:rounded-xl", "rounded-full", "rounded-tr-lg"]);
  assert.deepEqual(radiusTokens('className="rounded-lg rounded-full"').filter((t) => !IN_TIER.test(t)), []);
  assert.deepEqual(radiusTokens('className="rounded-md rounded"').filter((t) => !IN_TIER.test(t)), ["rounded-md", "rounded"]);
  assert.deepEqual(radiusTokens('className="rounded-[10px] rounded-${tier}"').filter((t) => !IN_TIER.test(t)), ["rounded-[10px]", "rounded-${tier}"]);
  /* 颜色位置 */
  const styled = (s: string) => [...s.matchAll(/(?:text|bg|border)-\[(#?[0-9a-fA-F]{3,8})\]|(?:fill|stroke)="#([0-9a-fA-F]{3,8})"/g)]
    .map((m) => (m[1] || m[2] || "").toLowerCase());
  assert.deepEqual(styled('className="bg-[#333333] text-[#6b6660]" stroke="#cccccc"'), ["#333333", "#6b6660", "cccccc"]);
  /* 数据表里的旧黄不该被位置检查当成样式 */
  assert.deepEqual(styled('headerBg: "#FCD33B", name: "Canary Yellow"'), []);
  /* 注释里提旧颜色是交代原因，不算违规 */
  assert.equal(liveOf("src/lib/courseAccents.ts").includes("#fcd33b"), false);
  /* 封面收边：硬边、描边、投影、假收边都要抓住，正当的 mask 不误伤（与 StarQuiz 同一组样本） */
  assert.equal(coverSeamOffenses('.ui-cover-band { height: 240px; }').length, 1, '没有收边就是硬边');
  assert.equal(coverSeamOffenses('.ui-cover-band { mask-image: linear-gradient(to bottom, #000, #f8f7f4); }').length, 1, '渐隐到实色不算收边，下沿还在');
  assert.equal(coverSeamOffenses('.ui-cover-band { border-bottom: 1px solid #eae7e1; mask-image: linear-gradient(to bottom, #000 58%, transparent); }').length, 1);
  assert.equal(coverSeamOffenses('.ui-cover-band { box-shadow: 0 1px 2px rgba(0,0,0,.1); mask-image: linear-gradient(to bottom, #000 58%, transparent); }').length, 1);
  assert.equal(coverSeamOffenses('').length, 1, '整条规则被删掉也要报');
  assert.equal(coverSeamOffenses('.ui-cover-band { mask-image: linear-gradient(to bottom, #000 58%, transparent 100%); }').length, 0);
  assert.equal(coverSeamOffenses('.ui-cover-band { -webkit-mask-image: linear-gradient(to bottom, #000 58%, transparent); mask-image: linear-gradient(to bottom, #000 58%, transparent); border: 0; box-shadow: none; }').length, 0);
  assert.equal(coverSeamOffenses('.ui-cover-band { @apply block h-[168px] w-full sm:h-[240px]; mask-image: linear-gradient(to bottom, #000 58%, transparent); }').length, 0, '@apply 与 mask 同块不算硬边');
  /* 对比度算术本身 */
  assert.ok(Math.abs(contrast("#1c1b1a", "#f8f7f4") - 16.05) < 0.1);
  assert.ok(contrast("#a39e97", "#ffffff") < 3, "退役的浅灰本来就该不合格，否则这条规则没有意义");
});

console.log(`\n${passed} design-scale checks passed`);
