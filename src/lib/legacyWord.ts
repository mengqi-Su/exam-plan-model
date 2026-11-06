/**
 * 旧版 Word（Word 97-2003 的 .doc，OLE 复合文档）纯文本提取，全部在浏览器本地完成。
 *
 * 为什么要自己写：.doc 不是 zip，DOCX 那套 ZIP+XML 解析帮不上忙，它是一层 OLE 容器里
 * 的 WordDocument 二进制流。WPS 和老版 Office 存出来的讲义、老师发的真题很多还是 .doc，
 * 一句「请另存为 DOCX」把用户挡在门外不划算。
 *
 * 规矩：先解 OLE 复合文档拿到流，再读 WordDocument 的 piece table 还原正文；
 * piece table 结构不可信（老文件、损坏、缺 0Table/1Table）才退回 fcMin..fcMac。
 * 与 StarQuiz 的 web/doc-text.js 同一套算法，两端对同一份文件的读数要一致。
 */

export type LegacyWordErrorCode =
  | "not_ole"
  | "bad_sector_size"
  | "no_word_stream"
  | "not_word97"
  | "encrypted_doc";

export class LegacyWordError extends Error {
  readonly code: LegacyWordErrorCode;

  constructor(code: LegacyWordErrorCode) {
    super(code);
    this.code = code;
  }
}

const END_OF_CHAIN = 0xfffffffe;
const FREE_SECT = 0xffffffff;
/** WordDocument 流里 FIB 魔数：a5ec 才是 Word 97 之后的二进制文档。 */
const WORD97_MAGIC = 0xa5ec;
const MAX_PIECES = 8_000;

/** 文件头是 OLE 复合文档（而不是 docx 的 zip：PK），.doc 与老 .ppt/.xls 都长这样。 */
export function isOleCompoundFile(bytes: Uint8Array): boolean {
  return (
    !!bytes &&
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function decodeUtf16(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const even = bytes.length - (bytes.length % 2);
  return new TextDecoder("utf-16le").decode(bytes.subarray(0, even));
}

function decodeAnsi(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  // 中文 Word 的 8 位压缩分段是 GBK；解不动再退回 Windows-1252 / UTF-8。
  try {
    return new TextDecoder("gbk", { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(bytes);
    } catch {
      return new TextDecoder("utf-8").decode(bytes);
    }
  }
}

interface OleDirectoryEntry {
  name: string;
  type: number;
  start: number;
  size: number;
}

function parseOleStreams(bytes: Uint8Array): Map<string, Uint8Array> {
  if (!isOleCompoundFile(bytes)) throw new LegacyWordError("not_ole");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const sectorShift = dv.getUint16(0x1e, true);
  const sectorSize = 1 << sectorShift;
  if (sectorSize < 128 || sectorSize > 65_536) throw new LegacyWordError("bad_sector_size");
  const miniSize = 1 << dv.getUint16(0x20, true);
  const numFatSectors = dv.getUint32(0x2c, true);
  const dirStart = dv.getUint32(0x30, true);
  const miniCutoff = dv.getUint32(0x38, true) || 4096;
  const miniFatStart = dv.getUint32(0x3c, true);
  const numMiniFatSectors = dv.getUint32(0x40, true);
  const difatStart = dv.getUint32(0x44, true);
  const numDifatSectors = dv.getUint32(0x48, true);

  const base = bytes.byteOffset;
  const seg = (offset: number, length: number) => new Uint8Array(bytes.buffer, base + offset, length);
  const sectorAt = (id: number) => (id + 1) * sectorSize;

  // DIFAT：头部内联 109 个 FAT 扇区号，不够再顺着 DIFAT 链继续找。
  const fatSectors: number[] = [];
  for (let i = 0; i < 109; i++) {
    const id = dv.getUint32(0x4c + i * 4, true);
    if (id !== FREE_SECT) fatSectors.push(id);
  }
  let difat = difatStart;
  for (let guard = 0; difat !== END_OF_CHAIN && difat !== FREE_SECT && guard <= numDifatSectors + 2; guard++) {
    const off = sectorAt(difat);
    if (off + sectorSize > bytes.length) break;
    const perSector = sectorSize / 4 - 1;
    for (let i = 0; i < perSector; i++) {
      const id = dv.getUint32(off + i * 4, true);
      if (id !== FREE_SECT) fatSectors.push(id);
    }
    difat = dv.getUint32(off + sectorSize - 4, true);
  }

  const fat: number[] = [];
  const fatLimit = numFatSectors * (sectorSize / 4) + fatSectors.length * (sectorSize / 4);
  for (const id of fatSectors) {
    if (fat.length >= fatLimit) break;
    const off = sectorAt(id);
    if (off + sectorSize > bytes.length) break;
    for (let i = 0; i < sectorSize / 4; i++) fat.push(dv.getUint32(off + i * 4, true));
  }

  const chain = (start: number, table: number[]): number[] => {
    const out: number[] = [];
    let id = start;
    let guard = 0;
    while (id !== END_OF_CHAIN && id !== FREE_SECT && id < table.length && guard++ < table.length + 8) {
      out.push(id);
      id = table[id];
    }
    return out;
  };

  const readFatStream = (start: number, size: number): Uint8Array => {
    const ids = chain(start, fat);
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (const id of ids) {
      const off = sectorAt(id);
      if (off + sectorSize > bytes.length) break;
      chunks.push(seg(off, sectorSize));
      total += sectorSize;
      if (size && total >= size) break;
    }
    const out = new Uint8Array(size ? Math.min(total, size) : total);
    let p = 0;
    for (const chunk of chunks) {
      if (p >= out.length) break;
      const take = Math.min(chunk.length, out.length - p);
      out.set(chunk.subarray(0, take), p);
      p += take;
    }
    return out;
  };

  const dirBytes = readFatStream(dirStart, 0);
  const entries: OleDirectoryEntry[] = [];
  for (let off = 0; off + 128 <= dirBytes.length; off += 128) {
    const view = new DataView(dirBytes.buffer, dirBytes.byteOffset + off, 128);
    const nameLen = view.getUint16(64, true);
    const type = view.getUint8(66);
    if (!type) continue;
    const nameBytes = dirBytes.subarray(off, off + Math.max(0, Math.min(64, nameLen) - 2));
    entries.push({
      name: decodeUtf16(nameBytes),
      type,
      start: view.getUint32(116, true),
      size: view.getUint32(120, true) || 0,
    });
  }

  // 小于 miniCutoff 的流住在 root 扇区里，靠 miniFAT 串起来。
  const root = entries.find((entry) => entry.type === 5);
  let miniFat: number[] = [];
  let miniStream = new Uint8Array(0);
  if (root) {
    miniStream = readFatStream(root.start, root.size);
    const miniFatBytes = readFatStream(miniFatStart, numMiniFatSectors * sectorSize);
    const mv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
    for (let i = 0; i * 4 + 4 <= miniFatBytes.length; i++) miniFat.push(mv.getUint32(i * 4, true));
  }

  const readMiniStream = (start: number, size: number): Uint8Array => {
    const ids = chain(start, miniFat);
    const out = new Uint8Array(size);
    let p = 0;
    for (const id of ids) {
      const off = id * miniSize;
      if (off + miniSize > miniStream.length || p >= size) break;
      const take = Math.min(miniSize, size - p);
      out.set(miniStream.subarray(off, off + take), p);
      p += take;
    }
    return out;
  };

  const streams = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.type !== 2 || !entry.name) continue;
    streams.set(
      entry.name,
      entry.size < miniCutoff ? readMiniStream(entry.start, entry.size) : readFatStream(entry.start, entry.size)
    );
  }
  return streams;
}

/** 域代码、单元格结束符之类控制字符换成可读的空白，剩下的清掉。 */
function cleanWordText(raw: string): string {
  return String(raw || "")
    // \x13 指令 \x14 结果 \x15：目录、页码这类域只保留结果
    .replace(/\x13[^\x13\x14\x15]*\x14/g, "")
    .replace(/[\x13\x14\x15]/g, "")
    .replace(/\x07/g, "\t")
    .replace(/[\x0b\x0c\r]/g, "\n")
    .replace(/\x1e/g, "-")
    .replace(/[\x00-\x08\x0e-\x1f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface WordPiece {
  cpStart: number;
  cpEnd: number;
  fc: number;
  compressed: boolean;
}

/**
 * WordDocument + 0Table/1Table 里读出 piece table。
 *
 * 为什么不看 fComplex：Word 存盘时正文并不总是连成一段——这份仓库里的回归样本
 * （graph-notes.doc）就是 fComplex=0 而正文分成两截，只看标志位就会退回 fcMin..fcMac，
 * 中间那 1KB 属性区被当成正文读出来，考点提炼直接废掉。
 * 所以改成「结构自己证明自己」：piece 必须从 0 起、首尾相接、刚好覆盖 ccpText，
 * 且每段的字节范围都落在 WordDocument 里。任一条不成立才退回连续区。
 * 读不出可信结构时返回空数组，不把整份文件判死。
 */
function readPieceTable(wd: Uint8Array, table: Uint8Array, ccpText: number): WordPiece[] {
  if (!table.length) return [];
  const tdv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const wdv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);

  const fcClx = wdv.getUint32(0x01a2, true);
  const lcbClx = wdv.getUint32(0x01a6, true);
  if (!lcbClx || fcClx + lcbClx > table.length) return [];

  let p = fcClx;
  const end = fcClx + lcbClx;
  // Prc 属性块可能连着好几段：0x01 + cbGrpprl(u16) + 数据，跳过它们才轮到 0x02 的 Pcdt。
  for (let guard = 0; p < end && table[p] === 0x01 && guard < MAX_PIECES; guard++) {
    const cb = tdv.getUint16(p + 1, true);
    p += 3 + cb;
  }
  if (p >= end || table[p] !== 0x02) return [];

  const lcb = tdv.getUint32(p + 1, true);
  const plc = p + 5;
  if (!lcb || plc + lcb > table.length) return [];
  const count = Math.floor((lcb - 4) / 12);
  if (count <= 0 || count > MAX_PIECES) return [];

  const pcdStart = plc + (count + 1) * 4;
  const pieces: WordPiece[] = [];
  for (let i = 0; i < count; i++) {
    const cpStart = tdv.getUint32(plc + i * 4, true);
    const cpEnd = tdv.getUint32(plc + (i + 1) * 4, true);
    const fcRaw = tdv.getUint32(pcdStart + i * 8 + 2, true);
    const compressed = !!(fcRaw & 0x40000000);
    const fc = compressed ? (fcRaw & 0x3fffffff) >>> 1 : fcRaw & 0x3fffffff;
    if (cpEnd <= cpStart) return [];
    const bytesNeeded = compressed ? cpEnd - cpStart : (cpEnd - cpStart) * 2;
    if (fc + bytesNeeded > wd.length) return [];
    pieces.push({ cpStart, cpEnd, fc, compressed });
  }

  // 分段必须无缝：从 0 开始，一段接一段。知道 ccpText 就要求它正好收到最后一个字符。
  if (pieces[0].cpStart !== 0) return [];
  for (let i = 1; i < pieces.length; i++) {
    if (pieces[i].cpStart !== pieces[i - 1].cpEnd) return [];
  }
  if (ccpText > 0 && pieces[pieces.length - 1].cpEnd !== ccpText) return [];
  return pieces;
}

/** 读旧版 Word 正文：piece table 结构可信就用它，否则退回 fcMin..fcMac 连续区。 */
export function extractLegacyWordText(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const streams = parseOleStreams(bytes);
  const wd = streams.get("WordDocument");
  if (!wd || wd.length < 0x200) throw new LegacyWordError("no_word_stream");

  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength);
  if (dv.getUint16(0, true) !== WORD97_MAGIC) throw new LegacyWordError("not_word97");

  const flags = dv.getUint16(0x0a, true);
  if (flags & 0x0100) throw new LegacyWordError("encrypted_doc");

  const fExtChar = !!(flags & 0x1000);
  const tableName = flags & 0x0200 ? "1Table" : "0Table";
  const table = streams.get(tableName) || streams.get("0Table") || streams.get("1Table") || new Uint8Array(0);
  const ccpText = Math.min(dv.getUint32(0x4c, true), 20 * 1024 * 1024);
  const pieces = readPieceTable(wd, table, ccpText);

  let raw = "";
  if (pieces.length) {
    const limit = ccpText > 0 ? ccpText : pieces[pieces.length - 1].cpEnd;
    for (const piece of pieces) {
      if (piece.cpStart >= limit) continue;
      const chars = Math.min(piece.cpEnd, limit) - piece.cpStart;
      if (chars <= 0) continue;
      if (piece.compressed) {
        raw += decodeAnsi(wd.subarray(piece.fc, Math.min(wd.length, piece.fc + chars)));
      } else {
        raw += decodeUtf16(wd.subarray(piece.fc, Math.min(wd.length, piece.fc + chars * 2)));
      }
    }
  } else {
    const fcMin = dv.getUint32(0x18, true);
    const fcMac = dv.getUint32(0x1c, true);
    const end = Math.min(wd.length, fcMac || wd.length);
    if (fcMin < end) {
      const slice = wd.subarray(fcMin, end);
      raw = fExtChar ? decodeUtf16(slice) : decodeAnsi(slice);
    }
  }

  return cleanWordText(raw);
}
