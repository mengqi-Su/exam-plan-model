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
      ? "未配置 AI 服务，已按本地排程规则重新分配任务。所有数据仍保存在本浏览器中。"
      : "AI 服务暂时不可用，已按本地排程规则重新分配任务。你可以在设置中查看 AI 状态。";
  }
  return meta.fallbackReason === "no_api_key"
    ? "AI is not configured. Tasks were rescheduled with local rules. Your data stays in this browser."
    : "AI is temporarily unavailable. Tasks were rescheduled with local rules. Check AI status in Settings.";
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
    zh: "AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。",
    en: "The AI service is temporarily unavailable. Please try again. Your materials will not be replaced with a template.",
  },
  AI_NOT_CONFIGURED: {
    zh: "AI 服务尚未配置，无法自动生成。请在部署环境配置 GEMINI_API_KEY 后重试。",
    en: "AI is not configured on this server. Set GEMINI_API_KEY in your deployment and try again.",
  },
  MISSING_MATERIALS: {
    zh: "请先上传至少一份课程资料。",
    en: "Upload at least one course document first.",
  },
  EMPTY_MATERIALS: {
    zh: "资料内容为空，请重新上传可读取文字的文件。",
    en: "The materials contain no readable text. Upload a text-based file and try again.",
  },
  SYLLABUS_EMPTY: {
    zh: "AI 没有从这些资料中识别到可用考点，请补充更完整的考纲、讲义或真题后重试。",
    en: "AI found no usable topics in these materials. Add a fuller syllabus, notes, or past paper and try again.",
  },
  SYLLABUS_EXTRACTION_FAILED: {
    zh: "考点提取失败，请稍后重试。",
    en: "Topic extraction failed. Please try again later.",
  },
  PLAN_EMPTY: {
    zh: "AI 没有返回可用的每日任务，请检查资料内容后重试。",
    en: "AI returned no usable daily tasks. Check your materials and try again.",
  },
  PLAN_GENERATION_FAILED: {
    zh: "学习计划生成失败，请稍后重试。",
    en: "Study plan generation failed. Please try again later.",
  },
  INVALID_START_DATE: {
    zh: "开始日期格式无效，请重新选择。",
    en: "The start date is invalid. Pick it again.",
  },
  INVALID_EXAM_DATE: {
    zh: "考试日期格式无效，请重新选择。",
    en: "The exam date is invalid. Pick it again.",
  },
  INVALID_DATE_RANGE: {
    zh: "考试日期不能早于开始复习日期。",
    en: "The exam date cannot be earlier than the start date.",
  },
  PARSE_FAILED: {
    zh: "文档解析服务异常，请稍后重试或换一份文件。",
    en: "Document parsing failed. Please try again or upload a different file.",
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
