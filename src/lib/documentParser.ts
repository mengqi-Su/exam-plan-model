import { MAX_UPLOAD_BYTES } from "./aiClient";

export interface ParsedDocumentResult {
  text: string;
  fileName: string;
  pageCount?: number;
  length: number;
}

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
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
const MAX_MATERIAL_CHARS = 120_000;
const MAX_ZIP_ENTRY_BYTES = 8 * 1024 * 1024;

// 文档解析全部在浏览器本地完成（本地优先，文件不离开设备）：
//   文本类直接读取；DOCX/PPTX 用内置 ZIP+XML 解析；PDF 用 pdf.js 提取文字层。
// 这样站点云函数只负责 AI 规划，无需任何 Node 专有解析库。
export async function parseDocumentFile(
  file: File,
  language: string = "zh",
  onProgress?: (statusText: string) => void
): Promise<ParsedDocumentResult> {
  const isZh = language !== "en";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      isZh
        ? "不支持此文件格式。请上传 PDF、DOCX、PPTX、TXT、Markdown、CSV 或 JSON。"
        : "Unsupported file type. Upload PDF, DOCX, PPTX, TXT, Markdown, CSV, or JSON."
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

  if (ext === "docx") {
    const text = await extractDocxText(buffer, isZh);
    return { text, fileName: file.name, length: text.length };
  }

  if (ext === "pptx") {
    const text = await extractPptxText(buffer, isZh);
    return { text, fileName: file.name, length: text.length };
  }

  if (ext === "pdf") {
    const { text, pageCount } = await extractPdfText(buffer, isZh);
    return { text, fileName: file.name, pageCount, length: text.length };
  }

  throw new Error(isZh ? "不支持此文件格式。" : "Unsupported file type.");
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

// 极简 ZIP 读取：拒绝 ZIP64，限制条目数与解压体积，防止恶意压缩包耗尽内存。
async function readZipEntries(
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
  const safeEntryCount = Math.min(entryCount, 4_000);

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
        raw = await inflateRaw(compressed, Math.max(uncompressedSize, 1));
      } catch {
        continue;
      }
    } else {
      continue;
    }
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