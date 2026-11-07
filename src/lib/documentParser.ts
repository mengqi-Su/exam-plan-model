import { MAX_UPLOAD_BYTES } from "./aiClient";
import { LegacyWordError, extractLegacyWordText, isOleCompoundFile } from "./legacyWord";

export interface ParsedDocumentResult {
  text: string;
  fileName: string;
  pageCount?: number;
  length: number;
}

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "pptx",
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "rtf",
]);

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "json", "csv", "rtf"]);

// 上传白名单只在这里说一次：资料弹窗和新建向导共用，免得加一种格式要改两处、两边说法还不一样。
export const UPLOAD_ACCEPT = Array.from(SUPPORTED_EXTENSIONS)
  .map((e) => `.${e}`)
  .join(",");

// 旧版 PowerPoint 走的是另一套 OLE 流（PowerPoint Document，记录式结构），
// 与 Word 的 piece table 完全不同，不值得在这里重写一遍。但它和 .doc 共用同一个文件头，
// 所以要单独说清楚「另存为 pptx」，不能只甩一句「格式不支持」。
const LEGACY_PRESENTATION_EXTENSIONS = new Set(["ppt", "pps", "pot", "dps"]);
/** 一份资料的正文上限：解析器截到这里，粘贴入口和草稿落盘都按同一个数说话。 */
export const MAX_MATERIAL_CHARS = 120_000;
/* 压缩包的四道闸门，测试和文案都从这里取数，别在别处再写一遍字面量。
   单份 8 MB 挡不住 zip bomb：一个 10 MB 的包能声明 4000 份各 8 MB 的 XML，
   照单全收就是把浏览器按死。所以除了单份上限，还要管总量、压缩比和份数。 */
export const MAX_ZIP_ENTRY_BYTES = 8 * 1024 * 1024;
export const MAX_ZIP_TOTAL_BYTES = 32 * 1024 * 1024;
export const MAX_ZIP_TEXT_ENTRIES = 1_000;
/** 真正的讲义 XML 一般压 5~30 倍；这个数之上的先当作炸弹处理，连解压都不开始。 */
export const MAX_ZIP_RATIO = 200;

// 文档解析全部在浏览器本地完成（本地优先，文件不离开设备）：
//   文本类直接读取；DOCX/PPTX 用内置 ZIP+XML 解析；PDF 用 pdf.js 提取文字层；
//   旧版 .doc 走 legacyWord 的 OLE + piece table。
// 这样站点云函数只负责 AI 规划，无需任何 Node 专有解析库。
export async function parseDocumentFile(
  file: File,
  language: string = "zh",
  onProgress?: (statusText: string) => void
): Promise<ParsedDocumentResult> {
  const isZh = language !== "en";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (LEGACY_PRESENTATION_EXTENSIONS.has(ext)) {
    throw new Error(
      isZh
        ? "这是旧版 PowerPoint（.ppt）文件，请用 PowerPoint 或 WPS 另存为 .pptx 或 PDF 后上传。"
        : "That is a legacy PowerPoint (.ppt) file. Save it as .pptx or PDF, then upload."
    );
  }

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      isZh
        ? "不支持此文件格式。请上传 PDF、Word（.doc / .docx）、PPTX、TXT、Markdown、CSV 或 JSON。"
        : "Unsupported file type. Upload PDF, Word (.doc / .docx), PPTX, TXT, Markdown, CSV, or JSON."
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      isZh ? "单个文件超过 10 MB 上限，请压缩或拆分后再上传。" : "Each file must be 10 MB or smaller."
    );
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    onProgress?.(isZh ? "正在快速读取文本内容..." : "Reading text content...");
    const text = await readFileAsText(file);
    const cleaned = ext === "rtf" ? stripRtf(text) : text;
    if (cleaned && cleaned.trim().length > 0 && !containsBinaryGarbage(cleaned)) {
      const trimmed = cleaned.trim();
      return { text: trimmed, fileName: file.name, length: trimmed.length };
    }
    throw new Error(
      isZh ? "未能从文件中读取到文字内容。" : "No readable text was found in this file."
    );
  }

  onProgress?.(
    isZh
      ? `正在本地解析 ${file.name}（PDF / Word / PPTX）...`
      : `Parsing ${file.name} locally (PDF / Word / PPTX)...`
  );

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new Error(isZh ? "文件内容为空。" : "The file is empty.");
  }

  // 以文件头为准，扩展名只用来挑报错文案：老师发的 .doc 里有人塞的是 zip 装的 docx，
  // .docx 里也常见还是 OLE 的老文件。按扩展名硬解只会给出误导性的「文件已损坏」。
  const kind = sniffKind(new Uint8Array(buffer));

  if (kind === "ole") {
    const text = extractLegacyDocText(buffer, isZh);
    return { text, fileName: file.name, length: text.length };
  }

  if (kind === "zip") {
    const text = await extractOoxmlText(buffer, ext, isZh);
    return { text, fileName: file.name, length: text.length };
  }

  if (kind === "pdf") {
    const { text, pageCount } = await extractPdfText(buffer, isZh);
    return { text, fileName: file.name, pageCount, length: text.length };
  }

  // 剩下的是「二进制看版的文本」：RTF 存成 .doc、HTML 存成 .doc 都走这条路。
  if (kind === "unknown" || kind === "rtf") {
    const rawText = decodeLooseText(buffer);
    if (rawText && !containsBinaryGarbage(rawText)) {
      const cleaned = stripRtf(rawText);
      if (cleaned.trim().length >= 10) {
        const trimmed = cleaned.trim();
        return { text: trimmed, fileName: file.name, length: trimmed.length };
      }
    }
  }

  throw new Error(
    isZh
      ? "这个文件读不出文字，请确认它是真正的 PDF、Word 或 PPTX，而不是快捷方式或云文档占位。"
      : "No text could be read from this file. Make sure it is a real PDF, Word or PPTX file, not a shortcut or cloud placeholder."
  );
}

/* ---------------- 文件头识别 ---------------- */

type FileKind = "ole" | "zip" | "pdf" | "rtf" | "unknown";

function sniffKind(bytes: Uint8Array): FileKind {
  if (!bytes || bytes.length < 4) return "unknown";
  if (isOleCompoundFile(bytes)) return "ole";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf"; // %PDF
  if (bytes[0] === 0x7b && bytes[1] === 0x5c && bytes[2] === 0x72 && bytes[3] === 0x74) return "rtf"; // {\rtf
  return "unknown";
}

/* ---------------- 旧版 Word（.doc） ---------------- */

function extractLegacyDocText(buffer: ArrayBuffer, isZh: boolean): string {
  let text: string;
  try {
    text = extractLegacyWordText(buffer);
  } catch (error) {
    const code = error instanceof LegacyWordError ? error.code : "decode";
    throw new Error(legacyWordMessage(code, isZh));
  }
  if (text.trim().length < 10) {
    throw new Error(
      isZh
        ? "这份 Word 文档里没有正文文字（可能是空白页或只放了图片）。"
        : "This Word document has no text (it may be blank or image-only)."
    );
  }
  return text.slice(0, MAX_MATERIAL_CHARS);
}

function legacyWordMessage(code: string, isZh: boolean): string {
  if (code === "encrypted_doc") {
    return isZh
      ? "这份 Word 文档加了打开密码，请先去掉密码再上传。"
      : "This Word file is password-protected. Remove the password before uploading.";
  }
  if (code === "not_word97") {
    return isZh
      ? "这份 .doc 比 Word 97 还老，请用 Word 或 WPS 另存为 .docx 后上传。"
      : "This .doc predates Word 97. Save it as .docx before uploading.";
  }
  if (code === "not_ole") {
    return isZh
      ? "文件后缀是 Word，但内容并不是 Word 文档，可能被改过后缀或只下载了一半。"
      : "The extension says Word but the content is not a Word document — it may be renamed or only half downloaded.";
  }
  return isZh
    ? "无法读取这份 Word 文档，请确认文件完整未损坏，或另存为 .docx / PDF 后重试。"
    : "Could not read this Word document. Check that the file is intact, or save it as .docx / PDF and retry.";
}

/* ---------------- 文本读取 ---------------- */

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

// 文件头认不出来的最后一搏：按 UTF-8 松解，交给 containsBinaryGarbage 判断是否真有成文的文字。
function decodeLooseText(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer).subarray(0, 2_000_000));
  } catch {
    return "";
  }
}

function stripRtf(text: string): string {
  return text
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ");
}

function containsBinaryGarbage(text: string): boolean {
  if (text.startsWith("%PDF-") || text.startsWith("PK\x03\x04") || text.includes("\x00\x00\x00")) return true;
  let nonPrintable = 0;
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) nonPrintable++;
  }
  return nonPrintable > 15;
}

/* ---------------- 内置 ZIP 读取（DOCX / PPTX 共用） ---------------- */

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

async function inflateRaw(data: Uint8Array, maxOutput: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream unavailable");
  }
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxOutput) {
        await reader.cancel().catch(() => {});
        throw new Error("zip entry too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/* 极简 ZIP 读取：拒绝 ZIP64，限制条目数、单份体积、压缩比与解压总量，防止恶意压缩包耗尽内存。
   导出只为本机的 dev/zip-bomb.test.ts 能直接对着这几道闸门断言——正文层的
   parseDocumentFile 会把它们的效果混在一起，看不出到底是哪一道在挡。 */
export async function readZipEntries(
  buffer: ArrayBuffer,
  filter: (name: string) => boolean
): Promise<ZipEntry[]> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const len = buffer.byteLength;
  if (len < 22) throw new Error("File is too small to be a ZIP archive");

  let eocd = -1;
  const minimumOffset = Math.max(0, len - 65_557);
  for (let i = len - 22; i >= minimumOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP central directory not found");

  const entryCount = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  const cdSize = view.getUint32(eocd + 12, true);
  if (cdOffset === 0xffffffff || cdSize === 0xffffffff) throw new Error("ZIP64 archives are not supported");
  if (cdOffset + cdSize > len) throw new Error("Corrupt ZIP central directory");

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  let cursor = cdOffset;
  const safeEntryCount = Math.min(entryCount, MAX_ZIP_TEXT_ENTRIES);
  let expandedBytes = 0;

  for (let i = 0; i < safeEntryCount; i++) {
    if (cursor + 46 > len || view.getUint32(cursor, true) !== 0x02014b50) break;

    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);

    if (cursor + 46 + nameLength > len) break;
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;

    if (!filter(name)) continue;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) continue;
    if (compressedSize > MAX_ZIP_ENTRY_BYTES || uncompressedSize > MAX_ZIP_ENTRY_BYTES) continue;
    // 先按声明的压缩比拒绝，连解压都不开始：炸弹的那 8 MB 只有在解开之后才看得见
    if (method === 8 && compressedSize > 0 && uncompressedSize / compressedSize > MAX_ZIP_RATIO) continue;
    if (expandedBytes + uncompressedSize > MAX_ZIP_TOTAL_BYTES) break;
    if (localOffset + 30 > len || view.getUint32(localOffset, true) !== 0x04034b50) continue;

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > len) continue;

    const compressed = bytes.subarray(dataStart, dataEnd);
    let raw: Uint8Array;
    if (method === 0) {
      raw = compressed;
    } else if (method === 8) {
      try {
        raw = await inflateRaw(compressed, Math.min(Math.max(uncompressedSize, 1), MAX_ZIP_ENTRY_BYTES));
      } catch {
        continue;
      }
    } else {
      continue;
    }
    expandedBytes += raw.byteLength;
    entries.push({ name, data: raw });
  }

  return entries;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");
}

function cleanExtractedText(raw: string): string {
  return decodeXmlEntities(raw)
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_MATERIAL_CHARS);
}

/* ---------------- OOXML（zip 装的 Word / PPT） ---------------- */

/* 压缩包到底是 Word 还是 PPT，由容器里有什么决定，不由扩展名决定：
   老师把 docx 改名成 .doc 发出来是常事，反过来也有。先按用户以为的那一种解析，
   对不上再试另一种。两条路都读不出正文时，说的那句要照着文件本身（一个读不出正文的压缩包），
   不是照着猜错的扩展名——「这个 DOCX 损坏了」会把人引去重装 Office，而问题只是后缀写错了。 */
async function extractOoxmlText(buffer: ArrayBuffer, ext: string, isZh: boolean): Promise<string> {
  const wantsSlides = ext === "pptx";
  const first = wantsSlides ? extractPptxText : extractDocxText;
  const second = wantsSlides ? extractDocxText : extractPptxText;
  let firstError: Error | null = null;
  try {
    return await first(buffer, isZh);
  } catch (error) {
    firstError = error instanceof Error ? error : new Error(String(error));
  }
  try {
    return await second(buffer, isZh);
  } catch {
    const error = new Error(
      isZh
        ? "这个压缩包里读不到正文，可能是改了扩展名的其他文件。"
        : "No text could be read from this archive — it may be a different file type with a changed extension."
    );
    if (firstError) error.cause = firstError;
    throw error;
  }
}

/* ---------------- DOCX ---------------- */

async function extractDocxText(buffer: ArrayBuffer, isZh: boolean): Promise<string> {
  let entries: ZipEntry[];
  try {
    entries = await readZipEntries(buffer, (name) => name === "word/document.xml");
  } catch (err) {
    throw new Error(
      isZh ? "无法读取该 DOCX 文件，请确认文件未损坏后重试。" : "Could not read this DOCX file. Please verify it is not corrupted."
    );
  }
  const entry = entries[0];
  if (!entry) {
    throw new Error(
      isZh ? "无法读取该 DOCX 文件，请确认文件未损坏后重试。" : "Could not read this DOCX file. Please verify it is not corrupted."
    );
  }
  const xml = new TextDecoder("utf-8").decode(entry.data);
  const text = cleanExtractedText(
    xml
      .replace(/<w:tab\b[^>]*\/>/g, "\t")
      .replace(/<w:br\b[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, "")
  );
  if (text.trim().length < 10) {
    throw new Error(
      isZh ? "未能从该 DOCX 中提取到文字内容。" : "No readable text could be extracted from this DOCX."
    );
  }
  return text;
}

/* ---------------- PPTX ---------------- */

async function extractPptxText(buffer: ArrayBuffer, isZh: boolean): Promise<string> {
  let entries: ZipEntry[];
  try {
    entries = await readZipEntries(buffer, (name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
  } catch {
    entries = [];
  }
  const slides = entries
    .map((entry) => ({
      index: Number(/slide(\d+)\.xml$/.exec(entry.name)?.[1] || 0),
      xml: new TextDecoder("utf-8").decode(entry.data),
    }))
    .sort((a, b) => a.index - b.index);

  const chunks: string[] = [];
  let totalChars = 0;
  for (const slide of slides) {
    const text = cleanExtractedText(
      slide.xml
        .replace(/<a:br\b[^>]*\/>/g, "\n")
        .replace(/<\/a:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
    );
    if (!text) continue;
    chunks.push(text);
    totalChars += text.length;
    if (totalChars >= MAX_MATERIAL_CHARS) break;
  }

  const joined = chunks.join("\n\n").slice(0, MAX_MATERIAL_CHARS);
  if (joined.trim().length < 10) {
    throw new Error(
      isZh
        ? "未能从 PPTX 中提取文字（可能全部为图片）。请导出为 PDF 或补充文字版讲义。"
        : "No text could be extracted from this PPTX (it may be image-only). Export it as PDF or upload text-based notes."
    );
  }
  return joined;
}

/* ---------------- PDF（pdf.js 文字层提取，按需懒加载） ---------------- */

async function extractPdfText(
  buffer: ArrayBuffer,
  isZh: boolean
): Promise<{ text: string; pageCount?: number }> {
  let pdfjs: any;
  try {
    pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  } catch (err) {
    throw new Error(
      isZh ? "PDF 解析组件加载失败，请刷新页面后重试。" : "Failed to load the PDF parser. Refresh the page and try again."
    );
  }

  let pdf: any;
  try {
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    });
    pdf = await task.promise;
  } catch {
    throw new Error(
      isZh ? "无法读取该 PDF 文件，请确认文件未损坏或加密。" : "Could not read this PDF. It may be corrupted or encrypted."
    );
  }

  const pageCount = pdf.numPages as number;
  const pages: string[] = [];
  let total = 0;
  try {
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      for (const item of content.items) {
        if (item && typeof item.str === "string") {
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";
        }
      }
      pageText = pageText.replace(/[ \t\u00a0]+/g, " ").trim();
      if (pageText) pages.push(pageText);
      total += pageText.length;
      if (total >= MAX_MATERIAL_CHARS) break;
    }
  } finally {
    try {
      await pdf.destroy();
    } catch {
      // ignore cleanup errors
    }
  }

  const text = pages.join("\n\n").slice(0, MAX_MATERIAL_CHARS).trim();
  if (text.length < 20) {
    throw new Error(
      isZh
        ? "该 PDF 没有可提取的文字层（可能是扫描件）。请上传带文字层的 PDF、DOCX 或 PPTX。"
        : "This PDF has no extractable text layer (it may be scanned). Upload a text-based PDF, DOCX, or PPTX."
    );
  }
  return { text, pageCount };
}