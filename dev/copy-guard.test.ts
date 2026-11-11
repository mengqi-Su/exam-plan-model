// 文案底线，全站一次性检查：npm run test:copy
//   1) 计数不许写 `file(s)`：说人话的英文要么单数要么复数，这种斜杠是没人肯在模板里
//      判断单复数留下的写法，两头不靠。单复数只在 text.pl 判一次，其余地方调它。
//   2) 英文句子不许带中文标点：拼句子时没问当前语言，就会在 "Read 3 files；" 里漏出「；」。
//   3) 提示不称呼用户：中文「请…」，英文祈使句，两边都不写 你/您/you/your/Please。
//   4) 状态与错误不用感叹号：报错不是喊话。
//   5) 用户看不见的内部名词不进文案：plans、JSON、接口、API Key、模板回退、厂商名。
//   6) 一个东西一个名字：科目 / subject、资料库 / Library，不许再冒出别的叫法。
//   7) 省略号统一「…」，不写三个 ASCII 句点。
//   8) 引用界面文字必须真的存在：提示里写「点某个按钮」，那个按钮就得在别处渲染出来。
//   9) 弹窗页头不挂解释灰字：眉栏和底栏 note 是状态读数，「标题下面一句说明」是说明文。
// 词典 zh/en 占位符是否一致由 test:inbound 管，这里不重复一遍。
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { translations } from '../src/lib/i18n.tsx';
import { ERROR_MESSAGES } from '../src/lib/aiClient.ts';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const CJK_PUNCT = new RegExp("[\u3000-\u303F\uFF01-\uFF60]");
const CJK_HAN = /[\u4E00-\u9FFF]/;
const PLURAL_HEDGE = /\w\(s\)/;
/* 句尾的感叹号才算喊话：前面是字、后面不接词。className 里的 `!text-[#…]`
   前面是空格或冒号、后面接词，是 Tailwind 的 important 前缀，不是标点。 */
const SHOUT = /(?:[A-Za-z0-9\u4E00-\u9FFF])[！!](?![\w-])/;
const ASCII_ELLIPSIS = /\.\.\./;
const ADDRESS_ZH = /[你您]/;
const ADDRESS_EN = /\b(?:you|your|yours|you're|please)\b/i;

const QUOTED_LITERAL = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
const TEMPLATE_LITERAL = /`((?:\\.|[^\\`])*)`/g;
const INTERPOLATION = /\$\{[^}]*\}/g;

/* 注释里留着旧说法是给人看的说明，不是会渲染出去的文案，所以先剥掉再查 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

type Lang = 'zh' | 'en' | 'unknown';
type Literal = { value: string; lang: Lang; computed: boolean };
/* where 是给人看的定位：源码写成 路径:行号，词典写成 i18n.zh.key */
type Hit = { where: string; value: string; lang: Lang };

/* 按字符串字面量判，不按整行判：tt("中文", "English") 常常写在同一条线上，
   整行里有个汉字，就把那句漏了中文标点的英文一起藏住了。
   顺手记下它是哪一侧：`zh: "Word（.doc / .docx）"` 是中文标签，全角括号是它自己的
   标点，不能按「英文里夹了中文标点」报。语言只从紧挨着的 zh:/en: 标签认，认不出就 unknown。 */
function literalsOnLine(line: string): Literal[] {
  const out: Literal[] = [];
  const langAt = (index: number): Lang => {
    const before = line.slice(Math.max(0, index - 12), index);
    if (/\bzh\s*:\s*$/.test(before)) return 'zh';
    if (/\ben\s*:\s*$/.test(before)) return 'en';
    return 'unknown';
  };
  const quoted = QUOTED_LITERAL;
  let m: RegExpExecArray | null;
  while ((m = quoted.exec(line))) out.push({ value: m[2], lang: langAt(m.index), computed: false });
  const template = TEMPLATE_LITERAL;
  while ((m = template.exec(line))) {
    out.push({ value: m[1].replace(INTERPOLATION, '1'), lang: langAt(m.index), computed: m[1].includes('${') });
  }
  return out;
}

/* 只有「像一句话」的字面量才按文案查：类名、store 名、mime、路径不是文案。
   有汉字就算中文句子；英文要有空格、至少两个词，单个标识符（'plans'、'json'）不算。 */
function isProse(value: string): boolean {
  if (CJK_HAN.test(value)) return true;
  return /\s/.test(value) && value.trim().split(/\s+/).length >= 2 && /[A-Za-z]{3}/.test(value);
}

function pluralOffense(value: string): string | null {
  if (!/[A-Za-z]/.test(value)) return null;
  return PLURAL_HEDGE.test(value) ? 'plural hedge "(s)"' : null;
}

function punctuationOffense(value: string, lang: Lang = 'unknown'): string | null {
  if (lang === 'zh') return null;
  if (!/[A-Za-z]/.test(value)) return null;
  return CJK_PUNCT.test(value) && !CJK_HAN.test(value) ? 'Chinese punctuation in an English string' : null;
}

function addressOffense(value: string, lang: Lang = 'unknown'): string | null {
  if (!isProse(value)) return null;
  if (CJK_HAN.test(value) && ADDRESS_ZH.test(value)) return '中文提示不称呼用户（你 / 您）';
  if (lang !== 'zh' && !CJK_HAN.test(value) && ADDRESS_EN.test(value)) return 'no you / your / Please in English copy';
  return null;
}

function exclamationOffense(value: string): string | null {
  if (!isProse(value)) return null;
  return SHOUT.test(value) ? '状态与错误不用感叹号' : null;
}

/* 用户看不见的东西不进文案。plans 只在夹着汉字时算漏（"study plans" 是正常英文，
   「plans 数据」才是把 store 名摊给用户看）。 */
const JARGON: Array<[RegExp, string]> = [
  [/DeepSeek/i, '厂商名 DeepSeek'],
  [/\bWPS\b/, '厂商名 WPS'],
  [/PowerPoint/i, '厂商名 PowerPoint'],
  [/API\s*Key/i, 'API Key'],
  [/\bJSON\b/, 'JSON'],
  [/接口/, '接口'],
  [/模板回退/, '模板回退'],
];
/* storage.ts 里那两条曾经整个豁免，理由是「历史更新日志记的是当时接了什么」。
   但更新日志就在设置页底部摊给用户看，用户照样读得到厂商名——豁免等于给规则开了个洞。
   现在日志也按同一口径写，豁免撤掉。 */
function jargonOffense(value: string, _where = ''): string | null {
  if (!isProse(value)) return null;
  for (const [re, name] of JARGON) if (re.test(value)) return `内部名词不进文案：${name}`;
  if (CJK_HAN.test(value) && /\bplans\b/.test(value)) return '内部名词不进文案：plans';
  return null;
}

/* 一个东西一个名字。实体叫「科目」/"subject"，容器叫「资料库」/"Library"，
   教材那一栏叫「教材名」（标签、报错、弹窗共用 textbookNameLabel()，不再写「教材名称」）。 */
const BANNED_NAMES: Array<[RegExp, string]> = [
  [/备考科目|考试科目/, '科目（不叫备考科目 / 考试科目）'],
  [/知识库/, '资料库（不叫知识库）'],
  [/\bKnowledge base\b/i, 'Library (not "Knowledge base")'],
  [/教材名称/, '教材名（不叫教材名称）'],
];

function namingOffense(value: string): string | null {
  if (!isProse(value)) return null;
  for (const [re, name] of BANNED_NAMES) if (re.test(value)) return `一个东西一个名字：${name}`;
  return null;
}

function ellipsisOffense(value: string): string | null {
  if (!isProse(value)) return null;
  return ASCII_ELLIPSIS.test(value) ? '省略号写「…」，不写三个句点' : null;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/* 全站字面量收一次，后面每条规则都扫同一份，省得把 src 读八遍 */
const LITERALS: Hit[] = [];
const RAW_LINES: Array<{ where: string; line: string }> = [];
for (const file of sourceFiles('src')) {
  const where = file.replace(/\\/g, '/');
  codeOnly(readFileSync(file, 'utf8'))
    .split(/\r?\n/)
    .forEach((line, i) => {
      RAW_LINES.push({ where: `${where}:${i + 1}`, line });
      for (const lit of literalsOnLine(line)) LITERALS.push({ where: `${where}:${i + 1}`, value: lit.value, lang: lit.lang });
    });
}
const DICT: Hit[] = (['zh', 'en'] as const).flatMap((lang) =>
  Object.entries(translations[lang] as Record<string, string>).map(([key, value]) => ({
    where: `i18n.${lang}.${key}`,
    value,
    lang,
  })),
);
const ALL: Hit[] = [...LITERALS, ...DICT];

function sweep(rule: (hit: Hit) => string | null, hits: Hit[] = ALL): string[] {
  const bad: string[] = [];
  for (const hit of hits) {
    const why = rule(hit);
    if (why) bad.push(`${hit.where} ${why} → ${hit.value.slice(0, 120)}`);
  }
  return bad;
}
const failWith = (bad: string[]) => assert.deepEqual(bad, [], `\n${bad.join('\n')}`);

await check('计数不许写 (s)：单复数只在 text.pl 判一次', () => {
  const bad = sweep((h) => pluralOffense(h.value));
  /* 跨行模板里的斜杠复数不在任何一行的字面量里，整行再兜一次 */
  for (const { where, line } of RAW_LINES) {
    if (PLURAL_HEDGE.test(line)) bad.push(`${where} plural hedge "(s)" → ${line.trim().slice(0, 120)}`);
  }
  failWith(bad);
});

await check('英文句子不夹中文标点（zh: 标签那一侧不算）', () => {
  failWith(sweep((h) => punctuationOffense(h.value, h.lang)));
});

await check('计数只有一处算法：pl() 之外不许再拼单复数', () => {
  const text = readFileSync('src/lib/text.ts', 'utf8');
  assert.ok(/export function pl\(/.test(text), '英文单复数归 text.pl 管');
  assert.ok(!PLURAL_HEDGE.test(codeOnly(text)), 'text.ts 自己也别留反面写法');
});

await check('提示不称呼用户：中文没有 你/您，英文没有 you/your/Please', () => {
  failWith(sweep((h) => addressOffense(h.value, h.lang)));
});

await check('状态与错误不用感叹号', () => {
  failWith(sweep((h) => exclamationOffense(h.value)));
});

await check('用户看不见的内部名词不进文案', () => {
  failWith(sweep((h) => jargonOffense(h.value, h.where)));
});

await check('一个东西一个名字：科目 / 资料库 / Library / 教材名', () => {
  failWith(sweep((h) => namingOffense(h.value)));
});

await check('省略号统一写「…」', () => {
  failWith(sweep((h) => ellipsisOffense(h.value)));
});

/* ---------------- 函数侧：兜底句子守同一套规矩，而且只许照抄码表 ---------------- */
/* functions/*.ts 是独立 Deno 模块，引不到 src 的码表，中文原文只能手抄一份。
   抄歪了就会出现「同一个码，走本地印一句、走服务端印另一句」。这里只拆 fail /
   GateRejection / LlmError / PlannerError 的实参——提示词是写给模型的，不是用户文案，
   所以不扫整个 functions 目录。 */
const MESSAGE_ARGS: Record<string, { code: number; message: number }> = {
  fail: { code: 0, message: 1 },
  GateRejection: { code: 0, message: 1 },
  LlmError: { code: 0, message: 1 },
  PlannerError: { code: 2, message: 0 },
};

/* 从 openIndex 那个 '(' 起按顶层逗号拆实参，字符串和嵌套括号里的逗号不算 */
function splitArgs(src: string, openIndex: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      current += ch;
      if (ch === '\\') { current += src[i + 1] ?? ''; i++; }
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; current += ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      if (!(depth === 1 && ch === '(')) current += ch;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { args.push(current); return args; }
      current += ch;
      continue;
    }
    if (ch === ',' && depth === 1) { args.push(current); current = ''; continue; }
    current += ch;
  }
  args.push(current);
  return args;
}

const literalsIn = (span: string): Literal[] => span.split(/\r?\n/).flatMap(literalsOnLine);

type ServerHit = Hit & { code: string; computed: boolean };
const SERVER: ServerHit[] = [];
for (const file of sourceFiles('functions')) {
  const where = file.replace(/\\/g, '/');
  const code = codeOnly(readFileSync(file, 'utf8'));
  const call = /\b(fail|GateRejection|LlmError|PlannerError)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(code))) {
    const shape = MESSAGE_ARGS[m[1]];
    const args = splitArgs(code, m.index + m[0].length - 1);
    const codes = literalsIn(args[shape.code] ?? '');
    const messages = literalsIn(args[shape.message] ?? '');
    const line = code.slice(0, m.index).split(/\r?\n/).length;
    messages.forEach((msg, i) => {
      /* 码和句子都可能是三元（isZh ? … : …），按位置对齐；只写一个码时就共用它 */
      const codeValue = (codes[i] ?? codes[0])?.value ?? '';
      SERVER.push({ where: `${where}:${line}`, value: msg.value, lang: msg.lang, code: codeValue, computed: msg.computed });
    });
  }
}

await check('函数侧的兜底句子：同样不称呼用户、不用感叹号、不漏内部名词', () => {
  assert.ok(SERVER.length >= 20, `只拆出 ${SERVER.length} 条函数侧句子，这条规则已经空转`);
  failWith(sweep((h) =>
    addressOffense(h.value, h.lang) ||
    exclamationOffense(h.value) ||
    jargonOffense(h.value, h.where) ||
    namingOffense(h.value) ||
    ellipsisOffense(h.value) ||
    pluralOffense(h.value) ||
    punctuationOffense(h.value, h.lang), SERVER));
});

await check('一个错误码只对应一句话：函数侧的码在码表里有说法，句子与码表一字不差', () => {
  const bad: string[] = [];
  for (const hit of SERVER) {
    const entry = ERROR_MESSAGES[hit.code];
    if (!entry) { bad.push(`${hit.where} 码 ${hit.code} 在客户端码表里没有说法`); continue; }
    /* 带插值的句子由常量算出来（数字只有一处来源），不要求与码表逐字相同 */
    if (hit.computed || !isProse(hit.value)) continue;
    const want = CJK_HAN.test(hit.value) ? entry.zh : entry.en;
    if (hit.value !== want) bad.push(`${hit.where} ${hit.code} 与码表不一致\n    函数侧：${hit.value}\n    码表侧：${want}`);
  }
  failWith(bad);
});

/* 提示里说「点『整理目录』」，那颗按钮就得真的在别处渲染出来，字面还得一模一样。
   把全站字面量当界面词表：引用能在词表里找到原话才算数。
   带插值的引用（「${name}」/「{topic}」）是运行时拼出来的，这里对不上，跳过。 */
const UI_WORDS = new Set(ALL.map((h) => h.value.trim()));
const ZH_REF = /「([^」]+)」/g;
const EN_REF = /"([^"]+)"/g;

function quotedRefs(value: string, lang: Lang): string[] {
  const unescaped = value.replace(/\\"/g, '"').replace(/\\'/g, "'");
  const out: string[] = [];
  const push = (re: RegExp) => {
    const rx = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(unescaped))) out.push(m[1].trim());
  };
  if (lang !== 'en') push(ZH_REF);
  if (lang !== 'zh' && !CJK_HAN.test(unescaped)) push(EN_REF);
  return out.filter((ref) => ref && !/[${}]/.test(ref));
}

function missingRefOffense(hit: Hit): string | null {
  if (!isProse(hit.value)) return null;
  const missing = quotedRefs(hit.value, hit.lang).filter((ref) => !UI_WORDS.has(ref));
  return missing.length ? `引用的界面文字不存在：${missing.map((r) => `「${r}」`).join('、')}` : null;
}

await check('提示引用的按钮 / 标题，界面上真的有这句话', () => {
  /* 先确认这条规则没空转：全站至少要真的找出若干处引用，否则「零违规」是假的 */
  const total = ALL.reduce((n, h) => n + quotedRefs(h.value, h.lang).length, 0);
  assert.ok(total >= 10, `只找到 ${total} 处界面引用，这条规则已经空转`);
  failWith(sweep(missingRefOffense));
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
  failWith(bad);
});

/* 反面样本：规则抓不住就等于没规则，这里先验自己 */
await check('守卫有效：每条规则都抓得住反面写法，也不误伤正常写法', () => {
  assert.equal(punctuationOffense('Some files could not be read；try again'), 'Chinese punctuation in an English string');
  assert.equal(pluralOffense('Read 3 file(s) in this batch'), 'plural hedge "(s)"');
  assert.equal(punctuationOffense('Cancelled；3 files not read.'), 'Chinese punctuation in an English string');
  assert.equal(punctuationOffense('已取消，剩下 3 份没有读。'), null);
  assert.equal(punctuationOffense('；'), null);
  /* zh: 那一侧的全角括号是中文自己的标点 */
  assert.equal(punctuationOffense('Word（.doc / .docx）', 'zh'), null);
  assert.equal(punctuationOffense('Word（.doc / .docx）', 'en'), 'Chinese punctuation in an English string');
  /* 中英写在同一行的 tt()：只看整行会被汉字藏住，拆成字面量才抓得到 */
  const pair = 'fail(tt("有文件没读出来", "Some files could not be read；"))';
  assert.equal(literalsOnLine(pair).filter((l) => punctuationOffense(l.value, l.lang)).length, 1);
  const labelled = 'zh: "Word（.doc / .docx）", en: "Word (.doc / .docx)"';
  assert.deepEqual(literalsOnLine(labelled).map((l) => l.lang), ['zh', 'en']);

  /* 称呼用户 */
  assert.ok(addressOffense('请先上传您的考纲'));
  assert.ok(addressOffense('你可以稍后再上传资料'));
  assert.ok(addressOffense('Upload your syllabus first.'));
  assert.ok(addressOffense('Please try again.'));
  assert.equal(addressOffense('请先上传一份考纲。'), null);
  assert.equal(addressOffense('Upload a syllabus first.'), null);

  /* 感叹号：句尾才算，Tailwind 的 important 前缀不算 */
  assert.ok(exclamationOffense('生成失败！'));
  assert.ok(exclamationOffense('Generation failed!'));
  assert.equal(exclamationOffense('生成失败，请重试。'), null);
  assert.equal(exclamationOffense('ui-chip !text-[#8A5A00] !bg-[#FFF6DD]'), null);
  assert.equal(exclamationOffense('hover:!bg-[#FFF6DD]'), null);

  /* 内部名词：夹汉字的 plans 算漏，正常英文复数不算；更新日志也照同一口径查，不再豁免 */
  assert.ok(jargonOffense('plans 数据已保存到本机'));
  assert.ok(jargonOffense('请填入 API Key 后重试'));
  assert.ok(jargonOffense('已调用 DeepSeek 接口'));
  assert.equal(jargonOffense('Study plans stay on this device.'), null);
  assert.equal(jargonOffense('plans'), null);
  assert.equal(jargonOffense('application/json'), null);
  assert.ok(jargonOffense('接入 DeepSeek 接口', 'src/lib/storage.ts:455'));
  assert.ok(jargonOffense('接入 DeepSeek 接口', 'src/lib/aiClient.ts:12'));

  /* 一个东西一个名字 */
  assert.ok(namingOffense('还没有备考科目'));
  assert.ok(namingOffense('去知识库上传资料'));
  assert.ok(namingOffense('Open the Knowledge base to upload.'));
  assert.ok(namingOffense('请先填写教材名称。'));
  assert.equal(namingOffense('还没有科目'), null);
  assert.equal(namingOffense('去资料库上传资料'), null);
  assert.equal(namingOffense('Open the Library to upload.'), null);
  assert.equal(namingOffense('还没有教材名，请填写教材全称（含版次）。'), null);

  /* 省略号 */
  assert.ok(ellipsisOffense('正在整理教材目录...'));
  assert.ok(ellipsisOffense('Building the outline...'));
  assert.equal(ellipsisOffense('正在整理教材目录…'), null);
  assert.equal(ellipsisOffense('flex items-center gap-2'), null);

  /* 引用界面文字：带插值的跳过，对不上的报出来 */
  assert.deepEqual(quotedRefs('请点「${action}」继续', 'zh'), []);
  assert.deepEqual(quotedRefs('请点「整理目录」继续', 'zh'), ['整理目录']);
  assert.deepEqual(quotedRefs('Use "Build outline" to continue.', 'en'), ['Build outline']);
  assert.deepEqual(quotedRefs('已定位到考点「{topic}」。', 'zh'), []);
  const words = new Set(['整理目录']);
  assert.equal(quotedRefs('请点「整理目录」继续', 'zh').every((r) => words.has(r)), true);
  assert.equal(quotedRefs('请点「重新整理目录」继续', 'zh').every((r) => words.has(r)), false);

  /* 函数侧实参拆分：顶层逗号才算分隔，字符串里的逗号和嵌套括号不算 */
  assert.deepEqual(splitArgs("('a', 'b, c', 400)", 0).map((s) => s.trim()), ["'a'", "'b, c'", '400']);
  assert.deepEqual(splitArgs("(isZh ? '甲，乙' : 'A, B', fn(1, 2))", 0).map((s) => s.trim()), ["isZh ? '甲，乙' : 'A, B'", 'fn(1, 2)']);
  /* 码和句子各在第几个实参：PlannerError 与另外三个不一样 */
  assert.equal(MESSAGE_ARGS.PlannerError.code, 2);
  assert.equal(MESSAGE_ARGS.PlannerError.message, 0);
  assert.equal(MESSAGE_ARGS.fail.message, 1);
  /* 三元里码和句子按位置对齐，两边都拆得出来 */
  const ternary = splitArgs("(timedOut ? 'ai_timeout' : 'ai_unavailable', timedOut ? '甲。' : '乙。', 502)", 0);
  assert.deepEqual(literalsIn(ternary[0]).map((l) => l.value), ['ai_timeout', 'ai_unavailable']);
  assert.deepEqual(literalsIn(ternary[1]).map((l) => l.value), ['甲。', '乙。']);
  /* 带插值的句子由常量算出来，标记 computed，不参与逐字比对 */
  assert.equal(literalsIn('`一次最多 ${n} 天`')[0].computed, true);
  assert.equal(literalsIn("'一码一句'")[0].computed, false);

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