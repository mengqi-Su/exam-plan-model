// 文案底线，全站一次性检查：npm run test:copy
//   1) 计数不许写 `file(s)`：说人话的英文要么单数要么复数，这种斜杠是没人肯在模板里
//      判断单复数留下的写法，两头不靠。单复数只在 text.pl 判一次，其余地方调它。
//   2) 英文句子不许带中文标点：拼句子时没问当前语言，就会在 "Read 3 files；" 里漏出「；」。
//   3) 弹窗页头不挂解释灰字：眉栏和底栏 note 是状态读数，「标题下面一句说明」是说明文。
// 词典 zh/en 占位符是否一致由 test:inbound 管，这里不重复一遍。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { translations } from '../src/lib/i18n.tsx';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const CJK_PUNCT = new RegExp("[\u3000-\u303F\uFF01-\uFF60]");
const CJK_HAN = /[\u4E00-\u9FFF]/;
const PLURAL_HEDGE = /\w\(s\)/;

const QUOTED_LITERAL = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
const TEMPLATE_LITERAL = /`((?:\\.|[^\\`])*)`/g;
const INTERPOLATION = /\$\{[^}]*\}/g;

/* 注释里留着旧说法是给人看的说明，不是会渲染出去的文案，所以先剥掉再查 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* 按字符串字面量判，不按整行判：tt("中文", "English") 常常写在同一条线上，
   整行里有个汉字，就把那句漏了中文标点的英文一起藏住了。
   字面量里有字母、一个汉字都没有、却带中文标点——那才是真的漏。 */
function literalsOnLine(line: string): string[] {
  const out: string[] = [];
  const quoted = QUOTED_LITERAL;
  let m: RegExpExecArray | null;
  while ((m = quoted.exec(line))) out.push(m[2]);
  const template = TEMPLATE_LITERAL;
  while ((m = template.exec(line))) out.push(m[1].replace(INTERPOLATION, "1"));
  return out;
}

function valueOffense(value: string): string | null {
  if (!/[A-Za-z]/.test(value)) return null;
  if (PLURAL_HEDGE.test(value)) return 'plural hedge "(s)"';
  if (CJK_PUNCT.test(value) && !CJK_HAN.test(value)) return 'Chinese punctuation in an English string';
  return null;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

await check('全站源码：英文文案没有 (s) 含糊复数，也没夹中文标点', () => {
  const bad: string[] = [];
  for (const file of sourceFiles('src')) {
    codeOnly(readFileSync(file, 'utf8'))
      .split(/\r?\n/)
      .forEach((line, i) => {
        literalsOnLine(line).forEach((value) => {
          const why = valueOffense(value);
          if (why) bad.push(`${file}:${i + 1} ${why} → ${value.slice(0, 120)}`);
        });
        /* 跨行模板里的斜杠复数不在任何一行的字面量里，整行再兜一次 */
        if (PLURAL_HEDGE.test(line)) bad.push(`${file}:${i + 1} plural hedge "(s)" → ${line.trim().slice(0, 120)}`);
      });
  }
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('英文词典本身：同样两条底线', () => {
  const bad: string[] = [];
  Object.entries(translations.en as Record<string, string>).forEach(([key, value]) => {
    const why = valueOffense(value);
    if (why) bad.push(`${key}: ${why} → ${value.slice(0, 120)}`);
  });
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

await check('计数只有一处算法：pl() 之外不许再拼单复数', () => {
  const text = readFileSync('src/lib/text.ts', 'utf8');
  assert.ok(/export function pl\(/.test(text), '英文单复数归 text.pl 管');
  assert.ok(!PLURAL_HEDGE.test(codeOnly(text)), 'text.ts 自己也别留反面写法');
});

/* 弹窗页头不许挂解释句。眉栏（页面归属、已存数量）和底栏 note（字数、已选章数、进度）
   都是状态读数，留着；「标题下面一句说明」是说明文，全站清掉，弹窗也不例外。
   槽留着就一定会被下一个弹窗顺手填一句，所以连 prop 一起删——调用方由 tsc 直接拦住，
   这里钉的是「别把槽加回来」。只查 ModalShell 这一个骨架：全站弹窗都从它出，不必逐个弹窗扫。 */
function headerExplanationOffenses(src: string): string[] {
  const code = codeOnly(src);
  const bad: string[] = [];
  if (/description\??:\s*React\.ReactNode/.test(code)) bad.push('页头又长出了 description 槽');
  if (/<p[^>]*text-\[#6b6660\][^>]*>/.test(code)) bad.push('页头里有一段次要灰字 <p>');
  return bad;
}

await check('弹窗页头只有眉栏和标题，没有解释灰字', () => {
  const bad = headerExplanationOffenses(readFileSync('src/components/ModalShell.tsx', 'utf8'));
  assert.deepEqual(bad, [], `\n${bad.join('\n')}`);
});

/* 反面样本：规则抓不住就等于没规则，这里先验自己 */
await check('守卫有效：漏标点的英文和含糊复数都抓得住，中文句子不误伤', () => {
  assert.equal(valueOffense('Some files could not be read；try again'), 'Chinese punctuation in an English string');
  assert.equal(valueOffense('Read 3 file(s) in this batch'), 'plural hedge "(s)"');
  assert.equal(valueOffense('Cancelled；3 files not read.'), 'Chinese punctuation in an English string');
  assert.equal(valueOffense('已取消，剩下 3 份没有读。'), null);
  assert.equal(valueOffense('；'), null);
  /* 中英写在同一行的 tt()：只看整行会被汉字藏住，拆成字面量才抓得到 */
  const pair = 'fail(tt("有文件没读出来", "Some files could not be read；"))';
  assert.equal(literalsOnLine(pair).map(valueOffense).filter(Boolean).length, 1);
  /* 页头解释句：槽和渲染各算一条，两条都在就报两条 */
  assert.deepEqual(headerExplanationOffenses('  description?: React.ReactNode;'), ['页头又长出了 description 槽']);
  assert.deepEqual(headerExplanationOffenses('<p className="text-[12px] leading-relaxed text-[#6b6660]">{description}</p>'), ['页头里有一段次要灰字 <p>']);
  assert.equal(headerExplanationOffenses('description?: React.ReactNode;\n<p className="text-[12px] text-[#6b6660]">{x}</p>').length, 2);
  /* 眉栏是 div、底栏 note 是 span，都是状态读数，不该被误伤 */
  assert.deepEqual(headerExplanationOffenses('<div className="text-[11px] text-[#6b6660]">{eyebrow}</div><span className="ui-row-meta">{note}</span>'), []);
  /* 注释里解释「为什么没有这个槽」是给人看的，不渲染出去 */
  assert.deepEqual(headerExplanationOffenses('/** 没有 description?: React.ReactNode; 也没有 <p className="text-[#6b6660]"> */'), []);
});

console.log(`\n${passed} copy checks passed`);
