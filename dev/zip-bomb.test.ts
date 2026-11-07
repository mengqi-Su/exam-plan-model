// 恶意压缩包的四道闸门回归：npm run test:zipbomb
// 上传队列把「一次传多少」管住了，但一份包本身仍能把浏览器按死：
// docx / pptx 都是 zip，读取时按中央目录声明的体积解压，声明可以是假的心、也可以是真的炸弹。
// 这里手搓 ZIP 字节（不引第三方打包库），逐条断言哪道闸门在挡、挡下来的是「跳过这一份」而不是整个标签页没了。
// 不触网、不需要任何 API Key。
import assert from 'node:assert/strict';
import {
  MAX_ZIP_ENTRY_BYTES,
  MAX_ZIP_RATIO,
  MAX_ZIP_TEXT_ENTRIES,
  MAX_ZIP_TOTAL_BYTES,
  readZipEntries,
} from '../src/lib/documentParser.ts';

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const enc = new TextEncoder();

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

interface RawEntry {
  name: string;
  /** 实际放进包里的字节（deflate 之后的大小） */
  data: Uint8Array;
  /** 8 = deflate-raw，0 = stored */
  method?: number;
  /** 声明的解压后体积：读取器就按这个数决定比率、单份上限和总量预算，所以造假正是要在这里造 */
  uncompressedSize?: number;
  /** 声明的压缩后体积，默认取实际字节 */
  compressedSize?: number;
}

/* 能省则省：读取器只认固定偏移上的字段，CRC 它压根不校验，所以这里填 0。
   手搓的意义正在于此——我要能造出「声明 6 MB、实际 1 KB」这种真实打包工具做不出来的包。 */
function buildZip(entries: RawEntry[]): ArrayBuffer {
  const locals: Uint8Array[] = [];
  const centers: Uint8Array[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const method = entry.method ?? 8;
    const nameBytes = enc.encode(entry.name);
    const data = entry.data;
    const compressed = entry.compressedSize ?? data.length;
    const uncompressed = entry.uncompressedSize ?? data.length;

    const header = new Uint8Array(30 + nameBytes.length + data.length);
    const lview = new DataView(header.buffer);
    lview.setUint32(0, 0x04034b50, true);
    lview.setUint16(4, 20, true);
    lview.setUint16(8, method, true);
    lview.setUint32(18, compressed, true);
    lview.setUint32(22, uncompressed, true);
    lview.setUint16(26, nameBytes.length, true);
    header.set(nameBytes, 30);
    header.set(data, 30 + nameBytes.length);
    locals.push(header);

    const central = new Uint8Array(46 + nameBytes.length);
    const cview = new DataView(central.buffer);
    cview.setUint32(0, 0x02014b50, true);
    cview.setUint16(4, 20, true);
    cview.setUint16(6, 20, true);
    cview.setUint16(10, method, true);
    cview.setUint32(20, compressed, true);
    cview.setUint32(24, uncompressed, true);
    cview.setUint16(28, nameBytes.length, true);
    cview.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centers.push(central);

    offset += header.length;
  });

  const cdStart = offset;
  const cdSize = centers.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  const eview = new DataView(eocd.buffer);
  eview.setUint32(0, 0x06054b50, true);
  eview.setUint16(8, entries.length, true);
  eview.setUint16(10, entries.length, true);
  eview.setUint32(12, cdSize, true);
  eview.setUint32(16, cdStart, true);

  const all = [...locals, ...centers, eocd];
  const out = new Uint8Array(all.reduce((n, part) => n + part.length, 0));
  let cursor = 0;
  for (const part of all) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out.buffer as ArrayBuffer;
}

const docxXml = '<w:t>第三章 栈与队列：先进后出、后进先出。</w:t>';
const keepDocumentXml = (name: string) => name === 'word/document.xml';
const keepSlides = (name: string) => /^ppt\/slides\/slide\d+\.xml$/.test(name);

/** 造一份能压到十几倍、又不至于像炸弹那样规整的讲义正文。 */
function lectureText(size: number): Uint8Array {
  const chunks: string[] = [];
  let n = 0;
  while (n < size) {
    chunks.push(`<a:t>section-${(n % 9973).toString(36)}-知识点复习要点</a:t>`);
    n += 40;
  }
  return enc.encode(chunks.join(''));
}

await check('正常 docx：压了十几倍的讲义 XML 照常读出来，闸门不该拦住真文件', async () => {
  const raw = enc.encode(docxXml.repeat(40));
  const compressed = await deflateRaw(raw);
  const ratio = raw.length / compressed.length;
  assert.ok(ratio < MAX_ZIP_RATIO, `这份夹具的压缩比 ${ratio.toFixed(1)} 已经像炸弹了，测不出「真文件放行」`);
  const entries = await readZipEntries(
    buildZip([{ name: 'word/document.xml', data: compressed, uncompressedSize: raw.length }]),
    keepDocumentXml
  );
  assert.equal(entries.length, 1);
  assert.ok(new TextDecoder().decode(entries[0].data).includes('先进后出'));
});

await check('压缩比闸门：声明 6 MB、实际 1 KB 的一份，不解压、直接跳过', async () => {
  const tiny = await deflateRaw(enc.encode('x'));
  const entries = await readZipEntries(
    buildZip([
      {
        name: 'word/document.xml',
        data: tiny,
        // 单份体积声明留在 8 MB 以下（否则第一道就挡了），把比率拉到 200 倍以上才测得到比率这道闸门
        uncompressedSize: 6 * 1024 * 1024,
      },
    ]),
    keepDocumentXml
  );
  assert.equal(entries.length, 0, '比率为炸弹特征时应跳过这一份，不该开始解压');
});

await check('单份体积闸门：声明超过 8 MB 的一份被跳过', async () => {
  const tiny = await deflateRaw(enc.encode('x'));
  const entries = await readZipEntries(
    buildZip([
      { name: 'word/document.xml', data: tiny, uncompressedSize: MAX_ZIP_ENTRY_BYTES + 1 },
    ]),
    keepDocumentXml
  );
  assert.equal(entries.length, 0);
});

await check('解压总量闸门：每份都合法，累加越过 32 MB 就停手（不是失败，是这一包读到这里为止）', async () => {
  const per = 7 * 1024 * 1024;
  const raw = lectureText(per);
  const compressed = await deflateRaw(raw);
  const ratio = raw.length / compressed.length;
  assert.ok(ratio < MAX_ZIP_RATIO, `夹具压缩比 ${ratio.toFixed(1)} 过高，先换个不那么规整的内容`);
  assert.ok(
    raw.length > MAX_ZIP_ENTRY_BYTES / 2 && raw.length < MAX_ZIP_ENTRY_BYTES,
    `单份 ${raw.length} 字节越过了单份上限，测不到总量这道闸门`
  );
  const slides = Array.from({ length: 12 }, (_, i) => ({
    name: `ppt/slides/slide${i + 1}.xml`,
    data: compressed,
    uncompressedSize: raw.length,
  }));
  const entries = await readZipEntries(buildZip(slides), keepSlides);
  const budgeted = Math.floor(MAX_ZIP_TOTAL_BYTES / raw.length);
  assert.ok(entries.length > 0 && entries.length < slides.length, `应只读到一部分，实际 ${entries.length} 份`);
  assert.ok(
    entries.length <= budgeted,
    `读进内存的 ${entries.length} 份 × ${raw.length} 字节已超过 ${MAX_ZIP_TOTAL_BYTES} 的预算`
  );
});

await check('份数闸门：中央目录条目数造假也不空转，最多走 MAX_ZIP_TEXT_ENTRIES 圈', async () => {
  const tiny = await deflateRaw(enc.encode('<a:t>hi</a:t>'));
  const slides = Array.from({ length: 30 }, (_, i) => ({
    name: `ppt/slides/slide${i + 1}.xml`,
    data: tiny,
    uncompressedSize: 11,
  }));
  const zip = buildZip(slides);
  const bytes = new Uint8Array(zip);
  const view = new DataView(zip);
  const eocd = bytes.length - 22;
  assert.equal(view.getUint32(eocd, true), 0x06054b50, 'EOCD 签名没找到，夹具写错了');
  view.setUint16(eocd + 8, 65535, true);
  view.setUint16(eocd + 10, 65535, true);
  const started = Date.now();
  const entries = await readZipEntries(zip, keepSlides);
  assert.ok(Date.now() - started < 5000, '条目数造假时不该长时间空转');
  assert.ok(entries.length <= Math.min(65535, MAX_ZIP_TEXT_ENTRIES));
  assert.ok(entries.length <= slides.length + 1, '条目数造假不该换来多读出来的份');
});

console.log(`\n${passed} zip-bomb checks passed`);
