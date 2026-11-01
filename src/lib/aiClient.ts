import { StudyMaterial } from "../types";

export const MAX_AI_MATERIALS = 20;
export const MAX_AI_CHARS_PER_MATERIAL = 120_000;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface AiResponseMeta {
  source?: "ai" | "fallback";
  fallbackReason?: "no_api_key" | "ai_error" | "ai_timeout";
}

export function prepareMaterialsForAI(materials?: StudyMaterial[]) {
  return (materials || []).slice(0, MAX_AI_MATERIALS).map((material) => ({
    id: material.id,
    name: material.name,
    type: material.type,
    content: (material.content || "").slice(0, MAX_AI_CHARS_PER_MATERIAL),
  }));
}

export function getAiFallbackNotice(meta: AiResponseMeta | undefined, language: string): string | null {
  if (meta?.source !== "fallback") return null;
  if (language === "zh") {
    return meta.fallbackReason === "no_api_key"
      ? "未配置 AI 服务，已使用本地规划模板生成结果。所有数据仍保存在本浏览器中。"
      : "AI 服务暂时不可用，已使用本地规划模板生成结果。你可以在设置中查看 AI 状态。";
  }
  return meta.fallbackReason === "no_api_key"
    ? "AI is not configured. A local planning template was used instead. Your data stays in this browser."
    : "AI is temporarily unavailable. A local planning template was used instead. Check AI status in Settings.";
}

const ERROR_MESSAGES: Record<string, { zh: string; en: string }> = {
  RATE_LIMITED: {
    zh: "请求过于频繁，请等待一分钟后重试。",
    en: "Too many requests. Please wait a minute and try again.",
  },
  PAYLOAD_TOO_LARGE: {
    zh: "上传内容超过上限（16 MB），请减少文件数量或压缩文件。",
    en: "The request exceeds the 16 MB limit. Reduce the number of files or compress them.",
  },
  FILE_TOO_LARGE: {
    zh: "单个文件超过 10 MB 上限，请压缩或拆分后再上传。",
    en: "Each file must be 10 MB or smaller.",
  },
  TOO_MANY_MATERIALS: {
    zh: "一次最多上传 20 份资料，请分批处理。",
    en: "Up to 20 materials can be processed at once. Please split the batch.",
  },
  UNSUPPORTED_FORMAT: {
    zh: "不支持此文件格式。请上传 PDF、DOCX、PPTX、TXT、Markdown、CSV 或 JSON。",
    en: "Unsupported file type. Upload PDF, DOCX, PPTX, TXT, Markdown, CSV, or JSON.",
  },
  LEGACY_OFFICE_UNSUPPORTED: {
    zh: "不支持旧版 DOC/PPT 格式，请另存为 DOCX/PPTX 或 PDF 后重试。",
    en: "Legacy DOC/PPT files are not supported. Save as DOCX/PPTX or PDF first.",
  },
  SCANNED_PDF_AI_REQUIRED: {
    zh: "该 PDF 没有可提取的文字层（可能是扫描件），且 AI 解析不可用。请上传可复制文字的 PDF、DOCX 或 PPTX。",
    en: "This PDF has no text layer (it may be scanned) and AI parsing is unavailable. Upload a text-based PDF, DOCX, or PPTX.",
  },
  AI_PARSE_FAILED: {
    zh: "AI 解析服务暂时不可用，请稍后重试。",
    en: "AI document parsing is temporarily unavailable. Please try again later.",
  },
  AI_UNAVAILABLE: {
    zh: "AI 服务暂时不可用，请稍后重试。",
    en: "AI service is temporarily unavailable. Please try again later.",
  },
  EMPTY_DOCUMENT: {
    zh: "未能从文件中读取到文字内容。",
    en: "No readable text was found in this file.",
  },
  DOCX_PARSE_FAILED: {
    zh: "无法读取该 DOCX 文件，请确认文件未损坏。",
    en: "Could not read this DOCX file. Please verify it is not corrupted.",
  },
  PPTX_NO_TEXT: {
    zh: "未能从 PPTX 中提取文字（可能全部为图片）。请导出为 PDF 或补充文字版讲义。",
    en: "No text could be extracted from this PPTX. Export it as PDF or upload text-based notes.",
  },
  MISSING_FILE_DATA: {
    zh: "缺少文件内容，请重新选择文件。",
    en: "Missing file data. Please select the file again.",
  },
  INVALID_JSON: {
    zh: "请求内容格式无效，请刷新页面后重试。",
    en: "Invalid request format. Refresh the page and try again.",
  },
};

export function localizeApiError(
  code: string | undefined,
  status: number,
  language: string,
  serverMessage?: string
): string {
  const entry = code ? ERROR_MESSAGES[code] : undefined;
  if (entry) return language === "zh" ? entry.zh : entry.en;
  if (language === "zh") return serverMessage || `请求失败（HTTP ${status}）。`;
  return `Request failed (HTTP ${status}).`;
}

export async function readApiError(
  response: Response,
  language: string
): Promise<{ message: string; code?: string }> {
  let code: string | undefined;
  let serverMessage: string | undefined;
  try {
    const data = await response.json();
    code = typeof data?.code === "string" ? data.code : undefined;
    serverMessage = typeof data?.error === "string" ? data.error : undefined;
  } catch {
    // response body was not JSON
  }
  return {
    message: localizeApiError(code, response.status, language, serverMessage),
    code,
  };
}
