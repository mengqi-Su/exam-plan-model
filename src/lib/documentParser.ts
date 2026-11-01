import { MAX_UPLOAD_BYTES, readApiError } from "./aiClient";

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
    try {
      const text = await readFileAsText(file);
      if (text && text.trim().length > 0 && !containsBinaryGarbage(text)) {
        return {
          text: text.trim(),
          fileName: file.name,
          length: text.length,
        };
      }
    } catch (err) {
      console.warn("Direct text read failed, sending to server parser:", err);
    }
  }

  onProgress?.(
    isZh
      ? `正在解析 ${file.name}（PDF / Word / PPTX / 讲义内容）...`
      : `Parsing ${file.name} (PDF / Word / PPTX / notes)...`
  );

  const base64Data = await readFileAsBase64(file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch("/api/parse-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || getMimeFromExt(ext),
        base64Data,
        language: isZh ? "zh" : "en",
      }),
    });

    if (!res.ok) {
      const apiError = await readApiError(res, isZh ? "zh" : "en");
      throw new Error(apiError.message);
    }

    const data = await res.json();
    const text = typeof data?.text === "string" ? data.text.trim() : "";
    if (!text) {
      throw new Error(
        isZh ? "解析结果为空，请确认文件中包含可读文字。" : "Parsing returned no text. Please verify the file contains readable content."
      );
    }

    return {
      text,
      fileName: file.name,
      pageCount: data.pageCount,
      length: text.length,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(
        isZh ? "解析超时，请稍后重试或换用更小的文件。" : "Parsing timed out. Try again or upload a smaller file."
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        isZh ? "无法连接解析服务，请检查网络后重试。" : "Could not reach the parsing service. Check your connection and try again."
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || "");
    reader.onerror = reject;
    reader.readAsText(file, "utf-8");
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = (e.target?.result as string) || "";
      if (!result) {
        reject(new Error("Failed to read the selected file"));
        return;
      }
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function containsBinaryGarbage(text: string): boolean {
  if (text.startsWith("%PDF-") || text.includes("\x00\x00\x00")) return true;
  let nonPrintable = 0;
  for (let i = 0; i < Math.min(text.length, 500); i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
  }
  return nonPrintable > 15;
}

function getMimeFromExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    case "md":
    case "markdown":
      return "text/markdown";
    case "csv":
      return "text/csv";
    case "json":
      return "application/json";
    case "rtf":
      return "application/rtf";
    default:
      return "application/octet-stream";
  }
}
