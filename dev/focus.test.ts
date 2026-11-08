// 焦点指示的三条底线，一次性检查：npm run test:focus
//   1) index.css 里那条 base :focus-visible 还在，且是「2px 实心 + 深色」——不是靠边框变色冒充焦点。
//   2) 全站源码里没有任何把轮廓抹掉的写法：outline-none / outline-hidden / outline-0 工具类，
//      CSS 的 outline:none / outline:0，以及内联 style 里的同义写法。Tailwind 的 utilities 层
//      排在 base 之后，任何一处都会把第 1 条整条压掉，键盘用户就看不见焦点在哪。
//   3) 焦点样式只有 base 这一处出处：组件上不再各写一份 focus-visible:outline-*，
//      否则改一处漏一处，迟早又出现「有的控件有环、有的没有」。
// 这条规则挡的是回归，不是审美；对比度与真实聚焦效果由浏览器实测核对（见清单 A11Y-03）。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

/* 注释里会正当地提到 outline-none（解释为什么不能用），先剥掉再查，
   否则这份说明本身就会把守卫绊倒。CSS 只有块注释，TS/TSX 还要剥行注释。 */
const stripCssComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '');
const stripCodeComments = (src: string) =>
  stripCssComments(src).replace(/^\s*\/\/.*$/gm, '');

/* 只认「类名 token」与「CSS 声明」两种形状：src 里 TextbookOutline / textbook_outline /
   outline.summary 这类标识符到处都是，按整词 outline 查会全是误报。 */
const OUTLINE_UTILITY = /(?:^|[\s"'`{])(?:[a-z-]+:)*outline-(?:none|hidden|0)(?![\w-])/;
const OUTLINE_DECL = /\boutline(?:-style)?\s*:\s*["']?(?:none|0)\b/i;
const OUTLINE_OVERRIDE = /(?:^|[\s"'`])(?:[a-z-]+:)*focus-visible:outline-/;

function offenders(src: string, kind: 'css' | 'code'): string[] {
  const text = kind === 'css' ? stripCssComments(src) : stripCodeComments(src);
  const bad: string[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (OUTLINE_UTILITY.test(line)) bad.push(`${i + 1}: outline 工具类 → ${line.trim().slice(0, 140)}`);
    if (OUTLINE_DECL.test(line)) bad.push(`${i + 1}: outline 声明 → ${line.trim().slice(0, 140)}`);
    if (OUTLINE_OVERRIDE.test(line)) bad.push(`${i + 1}: 组件自写焦点样式 → ${line.trim().slice(0, 140)}`);
  });
  return bad;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

await check('base :focus-visible 是 2px 实心深色环，输入类贴边框', () => {
  const css = stripCssComments(readFileSync('src/index.css', 'utf8'));
  const rule = /:focus-visible\s*\{([^}]*)\}/.exec(css);
  assert.ok(rule, 'index.css 里必须有 :focus-visible');
  const body = rule![1];
  assert.match(body, /outline:\s*2px solid #111111/, '环要 2px 实心、够深，不能只把边框调深一档');
  assert.match(body, /outline-offset:\s*2px/);
  const inputs = /input:focus-visible,\s*textarea:focus-visible,\s*select:focus-visible\s*\{([^}]*)\}/.exec(css);
  assert.ok(inputs, '输入类控件要单独把 offset 收成 0');
  assert.match(inputs![1], /outline-offset:\s*0/);
});

await check('全站源码没有抹掉轮廓的写法，也没有第二处焦点样式', () => {
  const bad: string[] = [];
  for (const file of sourceFiles('src')) {
    for (const line of offenders(readFileSync(file, 'utf8'), file.endsWith('.css') ? 'css' : 'code')) {
      bad.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('index.html 与构建配置里也没有偷偷放开轮廓', () => {
  for (const file of ['index.html', 'vite.config.ts', 'csp.config.ts']) {
    assert.deepEqual(offenders(readFileSync(file, 'utf8'), 'code'), [], file);
  }
});

/* 反面样本：规则抓不住就等于没规则。这里同时验「抓得到」与「不误伤」——
   TextbookOutline 这类标识符在本站有几十处，误伤一次就会有人把守卫删掉。 */
await check('守卫有效：反面写法抓得住，outline 标识符不误伤', () => {
  assert.equal(offenders('className="w-full outline-none focus:border-x"', 'code').length, 1);
  assert.equal(offenders('className="w-full focus:outline-none"', 'code').length, 1);
  assert.equal(offenders('className="outline-hidden"', 'code').length, 1);
  assert.equal(offenders('className="focus:outline-0"', 'code').length, 1);
  assert.equal(offenders('.x { outline: none; }', 'css').length, 1);
  assert.equal(offenders('.x { outline:0 }', 'css').length, 1);
  assert.equal(offenders('.x { outline-style: none; }', 'css').length, 1);
  assert.equal(offenders('style={{ outline: "none" }}', 'code').length, 1);
  assert.equal(offenders('className="focus-visible:outline-2 focus-visible:outline-offset-0"', 'code').length, 1);
  /* 注释里解释「为什么不能用 outline-none」是正当的，不算违规 */
  assert.equal(offenders('/* 任何一处 outline-none 都会压掉 base */\n.x { color: red }', 'css').length, 0);
  assert.equal(offenders('// 别写 outline-none\nconst a = 1;', 'code').length, 0);
  /* 标识符、类型名、字段名都不是 CSS */
  assert.equal(offenders('import { TextbookOutline } from "../types";', 'code').length, 0);
  assert.equal(offenders('const outline = await runGeneration<TextbookOutline>();', 'code').length, 0);
  assert.equal(offenders('type: "textbook_outline", outline: null', 'code').length, 0);
  assert.equal(offenders('{outline.summary && <p>{outline.summary}</p>}', 'code').length, 0);
  /* 正常写法的焦点环（base 那条）不该被自己的守卫拦下 */
  assert.equal(offenders(':focus-visible { outline: 2px solid #111111; outline-offset: 2px; }', 'css').length, 0);
});

console.log(`\n${passed} focus checks passed`);