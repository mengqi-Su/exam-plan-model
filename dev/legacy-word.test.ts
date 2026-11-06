// 旧版 Word（.doc / OLE 复合文档）提取回归：npm run test:legacyword
// 1) dev/fixtures/graph-notes.doc 是本机 Word 真实存出来的二进制文档（不是手搓的字节），
//    提取结果必须逐句命中 graph-notes.txt，段数也要对上——多出来的段就是把属性区当正文读了；
// 2) 扩展名与内容不符（mislabeled.doc 其实是 zip）时靠文件头判定，不能当成 .doc 硬解；
// 3) 同目录下若存在 StarQuiz 仓库，则加载 web/doc-text.js 在同一份字节上互校，
//    保证两端对同一文件的读数完全一致（同一份讲义从任一端上传，看到的考点来源要相同）。
// 不触网、不需要任何 API Key。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { TextDecoder as NodeTextDecoder } from 'node:util';
import {
  LegacyWordError,
  extractLegacyWordText,
  isOleCompoundFile,
  type LegacyWordErrorCode,
} from '../src/lib/legacyWord.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');
const read = (name: string) => new Uint8Array(fs.readFileSync(path.join(fixtures, name)));

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${name}`);
}

function captureError(fn: () => unknown): LegacyWordError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof LegacyWordError, `抛的不是 LegacyWordError：${String(error)}`);
    return error;
  }
  throw new Error('本应抛错，却正常返回了');
}

console.log('legacyWord（.doc）提取回归');

const expectedLines = fs.readFileSync(path.join(fixtures, 'graph-notes.txt'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const docBytes = read('graph-notes.doc');
const extracted = extractLegacyWordText(docBytes);

check('文件头识别为 OLE 复合文档', () => {
  assert.equal(isOleCompoundFile(docBytes), true);
  assert.equal(docBytes[7], 0xe1);
});

check('真实 Word 存出的 .doc 每句正文都能取回，段数也对得上', () => {
  const squeeze = (s: string) => s.replace(/\s+/g, '');
  const hay = squeeze(extracted);
  for (const line of expectedLines) {
    assert.ok(hay.includes(squeeze(line)), `漏了这句：${line}`);
  }
  const got = extracted.split('\n').map(squeeze).filter(Boolean);
  assert.equal(
    got.length,
    expectedLines.length,
    `段数 ${got.length} ≠ ${expectedLines.length}，正文里混进了非文本字节：\n${extracted}`
  );
});

check('只留可读文本，没有属性区残渣', () => {
  assert.ok(extracted.length > 300, `太短：${extracted.length}`);
  // 段落分隔只剩换行与制表，其它 C0 控制字符都该被清掉
  assert.equal(/[\x00-\x08\x0b-\x1f]/.test(extracted), false, '残留控制字符');
  // 私有区字符（PUA）与代理项是「读错了字节」的典型指纹
  assert.equal(/[\ue000-\uf8ff]|[\ud800-\udfff]/.test(extracted), false, '疑似读到流表而非正文');
});

check('中英混排与公式串按原样保留', () => {
  assert.ok(extracted.includes('G=(V,E)'));
  assert.ok(extracted.includes('O(n^2)'));
  assert.ok(extracted.includes('Dijkstra'));
  assert.ok(extracted.includes('广度优先遍历'));
});

check('扩展名骗不过文件头：zip 冒充 .doc 判为 not_ole', () => {
  const zip = read('mislabeled.doc');
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(isOleCompoundFile(zip), false);
  assert.equal(captureError(() => extractLegacyWordText(zip)).code, 'not_ole');
});

check('随便给点字节也只是报错，不会崩', () => {
  for (const junk of [new Uint8Array(4096).fill(0x41), new Uint8Array(0), new Uint8Array(4096)]) {
    assert.equal(isOleCompoundFile(junk), false);
    assert.equal(captureError(() => extractLegacyWordText(junk)).code, 'not_ole');
  }
});

check('合法文件头 + 截断的扇区表：由 sectorSize 或流缺失兜住', () => {
  const bytes = new Uint8Array(512);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  const code = captureError(() => extractLegacyWordText(bytes)).code;
  assert.ok(['bad_sector_size', 'no_word_stream', 'not_word97', 'not_ole'].includes(code), `实际 ${code}`);
});

// —— 跨仓库互校：同一份字节，两端读数必须逐字相同 ——
const starquizFile = path.resolve(here, '../../starquiz/web/doc-text.js');
if (fs.existsSync(starquizFile)) {
  const sandbox: Record<string, unknown> = {
    TextDecoder: NodeTextDecoder,
    Uint8Array,
    DataView,
    Map,
    Math,
    Number,
    String,
    Array,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  // doc-text.js 是 ES Module 写法，去掉 export 关键字后当普通脚本跑，
  // 函数声明会落到沙箱全局上，正好拿来调用。
  vm.runInContext(
    fs.readFileSync(starquizFile, 'utf8').replace(/^export\s+/gm, ''),
    sandbox,
    { filename: 'starquiz/web/doc-text.js' }
  );
  const other = sandbox as unknown as {
    isOleFile: (b: Uint8Array) => boolean;
    extractLegacyWordText: (b: Uint8Array) => string;
  };

  check('StarQuiz 端对同一份 .doc 的读数与本地一致', () => {
    assert.equal(other.isOleFile(docBytes), isOleCompoundFile(docBytes));
    assert.equal(other.extractLegacyWordText(docBytes), extracted);
  });

  check('StarQuiz 端同样拒绝 zip 冒充 .doc', () => {
    const zip = read('mislabeled.doc');
    assert.equal(other.isOleFile(zip), false);
    assert.throws(() => other.extractLegacyWordText(zip), /not_ole/);
  });
} else {
  console.log(`  skip 跨仓库互校（未找到 ${starquizFile}）`);
}

console.log(`\n${passed} legacyWord checks passed`);
