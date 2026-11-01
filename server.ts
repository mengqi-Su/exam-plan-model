import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";
import { inflateRawSync } from "zlib";

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Uploads are capped well below the previous 50 MB limit. A 10 MB file expands
// to roughly 13.4 MB as base64, which still fits in the JSON body budget.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILE_NAME_LENGTH = 200;
const MAX_MATERIALS = 24;
const MAX_MATERIAL_CHARS = 120_000;
const MAX_QUERY_CHARS = 2_000;
const MAX_TASKS_PER_PLAN = 600;

app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(
  [
    "/api/parse-document",
    "/api/extract-syllabus",
    "/api/generate-plan",
    "/api/rag-ask",
    "/api/rebalance-plan",
  ],
  rateLimitAiRoutes
);
app.use(express.json({ limit: "16mb" }));

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 20;
let lastRateSweep = Date.now();

function rateLimitAiRoutes(req: express.Request, res: express.Response, next: express.NextFunction) {
  const now = Date.now();

  if (now - lastRateSweep > RATE_WINDOW_MS * 5) {
    lastRateSweep = now;
    for (const [key, bucket] of rateBuckets) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = rateBuckets.get(ip);

  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({
      error: "请求过于频繁，请稍后再试。",
      code: "RATE_LIMITED",
      retryAfterSeconds: retryAfter,
    });
  }

  next();
}

class ApiInputError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "BAD_REQUEST") {
    super(message);
    this.name = "ApiInputError";
    this.status = status;
    this.code = code;
  }
}

class AiUnavailableError extends Error {
  code = "AI_UNAVAILABLE";

  constructor(message = "AI 服务暂时不可用，请稍后重试。") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function resolveIsChinese(language: unknown, ...texts: Array<string | undefined>): boolean {
  if (language === "zh") return true;
  if (language === "en") return false;
  return texts.some((text) => isChinese(text || ""));
}

function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(dateString: string): Date {
  const [year, month, day] = (dateString || "").split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

function addDaysToDateString(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

function daysBetweenDateStrings(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

interface ClientMaterial {
  id: string;
  name: string;
  type: string;
  content: string;
}

function sanitizeMaterials(
  raw: unknown,
  maxDocs = MAX_MATERIALS,
  maxChars = MAX_MATERIAL_CHARS
): ClientMaterial[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > maxDocs) {
    throw new ApiInputError(`一次最多上传 ${maxDocs} 份资料，请分批处理。`, 413, "TOO_MANY_MATERIALS");
  }

  return raw
    .map((material: any, index: number) => ({
      id: clampText(material?.id, 120) || `material-${index + 1}`,
      name: clampText(material?.name, MAX_FILE_NAME_LENGTH) || `Document ${index + 1}`,
      type: clampText(material?.type, 40) || "notes",
      content: clampText(material?.content, maxChars),
    }))
    .filter((material) => material.content.length > 0);
}

function sanitizeTopics(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((topic: any, index: number) => ({
    id: clampText(topic?.id, 120) || `topic-${index + 1}`,
    title: clampText(topic?.title, 300) || `Topic ${index + 1}`,
    category: clampText(topic?.category, 120),
    description: clampText(topic?.description, 2_000),
    weightPercentage: Number(topic?.weightPercentage) || 0,
    difficulty: clampText(topic?.difficulty, 20) || "medium",
    userKnowledgeLevel: clampText(topic?.userKnowledgeLevel, 20) || "intermediate",
    subtopics: Array.isArray(topic?.subtopics)
      ? topic.subtopics.slice(0, 30).map((item: unknown) => clampText(item, 300)).filter(Boolean)
      : [],
    subtopicTree: Array.isArray(topic?.subtopicTree)
      ? topic.subtopicTree.slice(0, 30).map((node: any, nodeIndex: number) => ({
          id: clampText(node?.id, 120) || `sub-${index + 1}-${nodeIndex + 1}`,
          title: clampText(node?.title, 300),
          keyPoints: Array.isArray(node?.keyPoints)
            ? node.keyPoints.slice(0, 10).map((item: unknown) => clampText(item, 500)).filter(Boolean)
            : [],
          difficulty: clampText(node?.difficulty, 20) || "medium",
          examFrequency: clampText(node?.examFrequency, 20) || "medium",
          formulaOrTrap: clampText(node?.formulaOrTrap, 1_000),
        }))
      : undefined,
    estimatedHours: Number(topic?.estimatedHours) || 0,
  }));
}

function sanitizePreferences(raw: any): any {
  const startDate = clampText(raw?.startDate, 20);
  const examDate = clampText(raw?.examDate, 20);
  if (!startDate || Number.isNaN(parseLocalDate(startDate).getTime())) {
    throw new ApiInputError("开始日期格式无效，应为 YYYY-MM-DD。", 400, "INVALID_START_DATE");
  }
  if (!examDate || Number.isNaN(parseLocalDate(examDate).getTime())) {
    throw new ApiInputError("考试日期格式无效，应为 YYYY-MM-DD。", 400, "INVALID_EXAM_DATE");
  }
  if (daysBetweenDateStrings(startDate, examDate) < 0) {
    throw new ApiInputError("考试日期不能早于开始日期。", 400, "INVALID_DATE_RANGE");
  }

  return {
    examName: clampText(raw?.examName, 200),
    subject: clampText(raw?.subject, 200),
    startDate,
    examDate,
    examTime: clampText(raw?.examTime, 10) || "09:00",
    targetScoreOrGrade: clampText(raw?.targetScoreOrGrade, 200),
    userNeedFocusArea: clampText(raw?.userNeedFocusArea, 120),
    customPromptRequirement: clampText(raw?.customPromptRequirement, 2_000),
    additionalNotes: clampText(raw?.additionalNotes, 2_000),
    weakTopicsFocus: Array.isArray(raw?.weakTopicsFocus)
      ? raw.weakTopicsFocus.slice(0, 30).map((item: unknown) => clampText(item, 300)).filter(Boolean)
      : [],
    dailySchedules: Array.isArray(raw?.dailySchedules) ? raw.dailySchedules.slice(0, 7) : [],
    studyPace: clampText(raw?.studyPace, 40) || "balanced",
    sessionLengthMinutes: Math.min(240, Math.max(10, Number(raw?.sessionLengthMinutes) || 45)),
    includePracticeExams: Boolean(raw?.includePracticeExams),
    includeBufferDays: Boolean(raw?.includeBufferDays),
    bufferDaysCount: Math.min(14, Math.max(0, Number(raw?.bufferDaysCount) || 0)),
    language: raw?.language === "en" ? "en" : raw?.language === "zh" ? "zh" : undefined,
  };
}

function sanitizePlanForRebalance(currentPlan: any): any {
  if (!currentPlan || typeof currentPlan !== "object") {
    throw new ApiInputError("缺少当前计划数据。", 400, "MISSING_PLAN");
  }
  if (!Array.isArray(currentPlan.tasks)) {
    throw new ApiInputError("当前计划缺少任务列表。", 400, "MISSING_TASKS");
  }
  if (currentPlan.tasks.length > MAX_TASKS_PER_PLAN) {
    throw new ApiInputError("计划任务数量过多，无法重排。", 413, "TOO_MANY_TASKS");
  }

  return {
    ...currentPlan,
    examName: clampText(currentPlan.examName, 200),
    subject: clampText(currentPlan.subject, 200),
    examDate: clampText(currentPlan.examDate, 20),
    tasks: currentPlan.tasks.map((task: any) => ({
      ...task,
      id: clampText(task?.id, 120),
      title: clampText(task?.title, 300),
      description: clampText(task?.description, 2_000),
      category: clampText(task?.category, 40),
      topicTitle: clampText(task?.topicTitle, 300),
      date: clampText(task?.date, 20),
      startTime: clampText(task?.startTime, 10),
      endTime: clampText(task?.endTime, 10),
      priority: clampText(task?.priority, 20),
      status: clampText(task?.status, 20),
      keyObjectives: Array.isArray(task?.keyObjectives)
        ? task.keyObjectives.slice(0, 10).map((item: unknown) => clampText(item, 300))
        : [],
      activeRecallPrompt: clampText(task?.activeRecallPrompt, 1_000),
      notes: clampText(task?.notes, 2_000),
    })),
  };
}

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      try {
        aiClient = new GoogleGenAI({
          apiKey: key,
          httpOptions: {
            headers: {
              "User-Agent": "exam-plan-ai",
            },
          },
        });
      } catch (err) {
        console.warn("Failed to initialize GoogleGenAI client:", err);
        aiClient = null;
      }
    }
  }
  return aiClient;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const AI_MODELS = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];

interface AiCallOutcome<T> {
  value: T;
  source: "ai" | "fallback";
  fallbackReason?: "no_api_key" | "ai_error" | "ai_timeout";
}

class AiServiceError extends Error {
  reason: "no_api_key" | "ai_error" | "ai_timeout";

  constructor(reason: "no_api_key" | "ai_error" | "ai_timeout") {
    super(`AI service unavailable (${reason})`);
    this.name = "AiServiceError";
    this.reason = reason;
  }
}

interface AiRunOptions {
  perCallTimeoutMs?: number;
  overallBudgetMs?: number;
  label?: string;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`${label} timed out after ${timeoutMs}ms`), { code: "AI_TIMEOUT" }));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function generateWithRetryAndFallback<T>(
  buildParams: (modelName: string) => any,
  parseResult: (text: string) => T,
  fallbackGenerator: (() => T) | null,
  options: AiRunOptions = {}
): Promise<AiCallOutcome<T>> {
  const startedAt = Date.now();
  const client = getAI();

  if (!client) {
    console.warn(`[AI${options.label ? ` ${options.label}` : ""}] GEMINI_API_KEY is not configured.`);
    if (!fallbackGenerator) throw new AiServiceError("no_api_key");
    return { value: fallbackGenerator(), source: "fallback", fallbackReason: "no_api_key" };
  }

  const perCallTimeoutMs = options.perCallTimeoutMs ?? 40_000;
  const overallBudgetMs = options.overallBudgetMs ?? 75_000;
  let lastError: unknown = null;
  let timedOut = false;

  for (const model of AI_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= overallBudgetMs) {
        timedOut = true;
        break;
      }

      try {
        const params = buildParams(model);
        const remainingMs = Math.max(5_000, Math.min(perCallTimeoutMs, overallBudgetMs - elapsed));
        const response = await withTimeout(
          client.models.generateContent(params),
          remainingMs,
          `${options.label || "AI"} (${model})`
        );
        const text = response.text || "";
        if (!text.trim()) {
          throw new Error("Empty response received from AI model");
        }
        return { value: parseResult(text), source: "ai" };
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code || err?.statusCode;
        const msg = String(err?.message || "");
        const isTimeout = err?.code === "AI_TIMEOUT";
        if (isTimeout) timedOut = true;

        const is503HighDemand =
          status === 503 ||
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("UNAVAILABLE");

        const isRateLimit =
          status === 429 ||
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED");

        if (attempt === 1 && !isTimeout && (is503HighDemand || isRateLimit)) {
          await sleep(400);
          continue;
        }

        break;
      }
    }

    if (timedOut && Date.now() - startedAt >= overallBudgetMs) break;
  }

  console.warn(
    `[AI${options.label ? ` ${options.label}` : ""}] request failed:`,
    lastError instanceof Error ? lastError.message : lastError
  );

  if (!fallbackGenerator) {
    throw new AiServiceError(timedOut ? "ai_timeout" : "ai_error");
  }

  return {
    value: fallbackGenerator(),
    source: "fallback",
    fallbackReason: timedOut ? "ai_timeout" : "ai_error",
  };
}

interface DocumentChunk {
  id: string;
  materialId: string;
  materialName: string;
  materialType: string;
  sectionTitle: string;
  content: string;
  keywords: string[];
  isExamQuestion: boolean;
  isFormulaOrTheorem: boolean;
  estimatedDifficulty: "easy" | "medium" | "hard";
  tokenEstimate: number;
}

function chunkDocumentText(
  materialId: string,
  materialName: string,
  materialType: string,
  text: string
): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];
  const cleanText = text.replace(/\r\n/g, "\n").trim();
  const paragraphBlocks = cleanText.split(/\n{2,}/);
  const chunks: DocumentChunk[] = [];

  let currentSectionTitle = materialName.replace(/\.[^/.]+$/, "");
  let accumulatedText = "";
  let chunkIdx = 1;

  const commitChunk = (body: string, heading: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 20) return;

    const isExamQuestion =
      materialType === "past_exam" ||
      /(?:第[一二三四五六七八九\d]+题|\b(q\d+|question\d+|problem\d+|ex\d+|\d+[\.、]))/i.test(trimmed) ||
      /(?:选择题|填空题|计算题|简答题|综合题|证明题|问答题)/.test(trimmed);

    const isFormulaOrTheorem =
      /(?:公式|定理|推论|引理|def|theorem|lemma|formula|equation|f\(x\)|∑|∫|lim|log|sin|cos|matrix|\b(o\(n\)|tcp|udp|ip)\b)/i.test(
        trimmed
      );

    const keywords: string[] = [];
    const engWords = (trimmed.match(/[A-Za-z]{3,}/g) || []).slice(0, 8);
    keywords.push(...Array.from(new Set(engWords)));

    const zhTerms = (
      trimmed.match(
        /[\u4e00-\u9fa5]{2,6}(?:定理|公式|算法|机制|协议|模型|结构|函数|方程|分析|计算|证明|原理|概念|设计)/g
      ) || []
    ).slice(0, 8);
    keywords.push(...Array.from(new Set(zhTerms)));

    let diff: "easy" | "medium" | "hard" = "medium";
    if (/(?:证明|高阶|综合|推导|难点|复杂|NP|级数|最值|优化)/.test(trimmed) || isExamQuestion) {
      diff = "hard";
    } else if (/(?:简介|概述|基本概念|定义|常识|首日)/.test(trimmed)) {
      diff = "easy";
    }

    chunks.push({
      id: `chunk-${materialId}-${chunkIdx++}`,
      materialId,
      materialName,
      materialType,
      sectionTitle: heading,
      content: trimmed,
      keywords: Array.from(new Set(keywords)).slice(0, 8),
      isExamQuestion,
      isFormulaOrTheorem,
      estimatedDifficulty: diff,
      tokenEstimate: Math.ceil(trimmed.length / 3),
    });
  };

  for (const block of paragraphBlocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    const firstLine = trimmedBlock.split("\n")[0].trim();
    const isHeading =
      firstLine.length < 60 &&
      /(?:^#+|^第[一二三四五六七八九\d]+[章节讲单元部分]|^[0-9]+[\.、]|^[A-Z\s]{4,}|^Unit\s*\d+|^Chapter\s*\d+|^Section\s*\d+|^Topic)/i.test(
        firstLine
      );

    if (isHeading) {
      if (accumulatedText.length > 50) {
        commitChunk(accumulatedText, currentSectionTitle);
        accumulatedText = "";
      }
      currentSectionTitle = firstLine.replace(/^[#*\-•\d\.\s]+/, "").trim() || currentSectionTitle;
    }

    accumulatedText += (accumulatedText ? "\n\n" : "") + trimmedBlock;

    if (accumulatedText.length >= 800) {
      commitChunk(accumulatedText, currentSectionTitle);
      accumulatedText = "";
    }
  }

  if (accumulatedText.trim().length > 0) {
    commitChunk(accumulatedText, currentSectionTitle);
  }

  if (chunks.length === 0 && cleanText.length > 0) {
    commitChunk(cleanText.slice(0, 1000), materialName);
  }

  return chunks;
}

function chunkAllMaterials(materials: any[]): DocumentChunk[] {
  if (!Array.isArray(materials) || materials.length === 0) return [];
  const allChunks: DocumentChunk[] = [];
  materials.forEach((m, idx) => {
    const text = m.content || m.summaryNotes || "";
    const chunks = chunkDocumentText(m.id || `mat-${idx}`, m.name || `doc-${idx}`, m.type || "notes", text);
    allChunks.push(...chunks);
  });
  return allChunks;
}

function retrieveTopChunksForQuery(
  query: string,
  chunks: DocumentChunk[],
  options: {
    topK?: number;
    preferQuestions?: boolean;
    preferFormulas?: boolean;
  } = {}
): DocumentChunk[] {
  if (!chunks || chunks.length === 0) return [];
  const topK = options.topK || 4;
  const lowerQuery = (query || "").toLowerCase();
  const queryTokens = lowerQuery.split(/[\s,，、。；;：:!！?？\-_/\\()\[\]]+/).filter((t) => t.length >= 2);

  const scored: { chunk: DocumentChunk; score: number }[] = [];

  for (const chunk of chunks) {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerHeading = chunk.sectionTitle.toLowerCase();

    for (const tok of queryTokens) {
      if (lowerHeading.includes(tok)) score += 25;
      if (lowerContent.includes(tok)) score += 8;
    }

    for (const kw of chunk.keywords) {
      if (lowerQuery.includes(kw.toLowerCase())) score += 15;
    }

    if (options.preferQuestions && chunk.isExamQuestion) score += 20;
    if (options.preferFormulas && chunk.isFormulaOrTheorem) score += 18;

    if (score > 0 || chunks.length <= topK) {
      scored.push({ chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text || "");
}

function fallbackRebalancePlan(currentPlan: any, currentDate: string, reason: string) {
  const isZh = resolveIsChinese(currentPlan?.language, currentPlan?.examName, currentPlan?.subject);
  const today = currentDate || toLocalDateString();
  const examDate =
    currentPlan?.examDate && !Number.isNaN(parseLocalDate(currentPlan.examDate).getTime())
      ? currentPlan.examDate
      : addDaysToDateString(today, 14);

  const completedTasks = currentPlan.tasks.filter((t: any) => t.status === "completed");
  const pendingTasks = currentPlan.tasks.filter((t: any) => t.status !== "completed");

  const remainingDays = Math.max(1, daysBetweenDateStrings(today, examDate));

  const updatedPending = pendingTasks.map((task: any, idx: number) => {
    const dayOffset = idx % remainingDays;
    const targetDate = addDaysToDateString(today, dayOffset);
    return {
      ...task,
      date: targetDate,
      status: "pending",
      priority: task.priority === "low" ? "medium" : task.priority,
    };
  });

  return {
    rebalanceSummary: isZh
      ? `已成功自适应重排！将剩余 ${pendingTasks.length} 个学习任务科学均衡分配至距离 ${examDate} 考试前的 ${remainingDays} 天内。已保留 ${completedTasks.length} 个已完成的学习里程碑。`
      : `Successfully rebalanced ${pendingTasks.length} remaining tasks across ${remainingDays} days leading up to ${examDate}. Preserved ${completedTasks.length} completed study milestones.`,
    tasks: [...completedTasks, ...updatedPending],
  };
}

class DocumentParseError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "DocumentParseError";
    this.status = status;
    this.code = code;
  }
}

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".csv", ".rtf"]);
const LEGACY_OFFICE_EXTENSIONS = new Set([".doc", ".ppt"]);
const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".pptx", ...TEXT_EXTENSIONS]);

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

/**
 * Minimal ZIP reader used only to pull `ppt/slides/slideN.xml` out of a PPTX
 * file. It deliberately refuses ZIP64 entries and caps decompressed output so a
 * malicious archive cannot exhaust server memory.
 */
function extractPptxText(buffer: Buffer): string {
  if (buffer.length < 22) throw new Error("File is too small to be a PPTX archive");

  let eocdOffset = -1;
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let i = buffer.length - 22; i >= minimumOffset; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("ZIP central directory not found");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  if (centralDirectoryOffset === 0xffffffff || centralDirectorySize === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported");
  }
  if (centralDirectoryOffset + centralDirectorySize > buffer.length) {
    throw new Error("Corrupt ZIP central directory");
  }

  const slides: Array<{ index: number; xml: string }> = [];
  let cursor = centralDirectoryOffset;
  const safeEntryCount = Math.min(entryCount, 4_000);

  for (let i = 0; i < safeEntryCount; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    if (cursor + 46 + nameLength > buffer.length) break;
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;

    const match = /^ppt\/slides\/slide(\d+)\.xml$/.exec(name);
    if (!match) continue;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) continue;
    if (compressedSize > 8 * 1024 * 1024 || uncompressedSize > 8 * 1024 * 1024) continue;
    if (localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) continue;

    const compressed = buffer.subarray(dataStart, dataEnd);
    let xmlBuffer: Buffer;
    if (method === 0) {
      xmlBuffer = Buffer.from(compressed);
    } else if (method === 8) {
      try {
        xmlBuffer = inflateRawSync(compressed, {
          maxOutputLength: Math.max(uncompressedSize, 1),
        } as any);
      } catch {
        continue;
      }
    } else {
      continue;
    }

    slides.push({ index: Number(match[1]), xml: xmlBuffer.toString("utf8") });
  }

  slides.sort((a, b) => a.index - b.index);

  const chunks: string[] = [];
  let totalChars = 0;
  for (const slide of slides) {
    const text = decodeXmlEntities(
      slide.xml
        .replace(/<a:br\b[^>]*\/>/g, "\n")
        .replace(/<\/a:p>/g, "\n")
        .replace(/<[^>]+>/g, "")
    )
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n");
    if (!text) continue;
    chunks.push(text);
    totalChars += text.length;
    if (totalChars >= MAX_MATERIAL_CHARS) break;
  }

  return chunks.join("\n\n").slice(0, MAX_MATERIAL_CHARS);
}

async function transcribePdfWithAI(cleanBase64: string, language: string): Promise<string> {
  const client = getAI();
  if (!client) {
    throw new DocumentParseError(
      422,
      "SCANNED_PDF_AI_REQUIRED",
      "该 PDF 未检测到可提取文字（可能是扫描件）。请上传带文字层的 PDF、DOCX 或 PPTX。"
    );
  }

  const isZh = language !== "en";
  const prompt = isZh
    ? `你是一位专业的高校备考与教辅文档解析专家。请将本 PDF 的内容完整、准确、结构化地转录为清晰易读的 Markdown 文本。
要求：
1. 完整保留章节大纲、考点要求、题目序号、核心公式与要点。
2. 保持排版层级清晰，禁止输出乱码或丢失核心考点。
3. 如果是试卷或习题，请完整保留题目要求与选项。`
    : `You are an expert academic document parsing specialist. Transcribe all text, syllabus outlines, chapters, formulas, and questions from this PDF accurately into clean, readable Markdown. Preserve structural hierarchy and every key concept.`;

  const startedAt = Date.now();
  for (const model of AI_MODELS) {
    if (Date.now() - startedAt > 60_000) break;
    try {
      const response = await withTimeout(
        client.models.generateContent({
          model,
          contents: [
            { inlineData: { data: cleanBase64, mimeType: "application/pdf" } },
            prompt,
          ],
        }),
        30_000,
        `PDF OCR (${model})`
      );
      const text = (response.text || "").trim();
      if (text.length > 20) return text;
    } catch (err) {
      console.warn("[PDF OCR] model failed:", err instanceof Error ? err.message : err);
    }
  }

  throw new DocumentParseError(502, "AI_PARSE_FAILED", "AI 解析服务暂时不可用，请稍后重试或上传可复制文字的 PDF。");
}

async function parseUploadedDocument(
  fileName: string,
  fileType: string,
  base64Data: string,
  language: string = "zh"
): Promise<{ text: string; pageCount?: number; source: "local" | "ai" }> {
  const isZh = language !== "en";
  const safeFileName = path.basename(fileName || "document").slice(0, MAX_FILE_NAME_LENGTH);
  const ext = path.extname(safeFileName).toLowerCase();
  const cleanBase64 = (base64Data || "").replace(/^data:.*?;base64,/, "");

  if (!cleanBase64) {
    throw new DocumentParseError(400, "MISSING_FILE_DATA", isZh ? "缺少文件内容。" : "Missing file data.");
  }

  if (Math.floor((cleanBase64.length * 3) / 4) > MAX_UPLOAD_BYTES) {
    throw new DocumentParseError(
      413,
      "FILE_TOO_LARGE",
      isZh ? "文件超过 10 MB 上限，请压缩或拆分后再上传。" : "File exceeds the 10 MB limit."
    );
  }

  if (LEGACY_OFFICE_EXTENSIONS.has(ext)) {
    throw new DocumentParseError(
      415,
      "LEGACY_OFFICE_UNSUPPORTED",
      isZh
        ? `暂不支持旧版 ${ext.toUpperCase()} 格式，请另存为 ${ext === ".doc" ? ".docx" : ".pptx"} 或 PDF 后重新上传。`
        : `Legacy ${ext.toUpperCase()} files are not supported. Please save as ${ext === ".doc" ? ".docx" : ".pptx"} or PDF.`
    );
  }

  if (!SUPPORTED_EXTENSIONS.has(ext) && !fileType.startsWith("text/")) {
    throw new DocumentParseError(
      415,
      "UNSUPPORTED_FORMAT",
      isZh
        ? "不支持此文件格式。请上传 PDF、DOCX、PPTX、TXT、Markdown、CSV 或 JSON 文件。"
        : "Unsupported file type. Upload PDF, DOCX, PPTX, TXT, Markdown, CSV, or JSON."
    );
  }

  const buffer = Buffer.from(cleanBase64, "base64");
  if (buffer.length === 0) {
    throw new DocumentParseError(422, "EMPTY_FILE", isZh ? "文件内容为空。" : "The file is empty.");
  }

  if (TEXT_EXTENSIONS.has(ext) || fileType.startsWith("text/")) {
    let text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    if (ext === ".rtf") {
      text = text
        .replace(/\\'[0-9a-f]{2}/gi, " ")
        .replace(/\\[a-z]+-?\d* ?/gi, " ")
        .replace(/[{}]/g, " ");
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      throw new DocumentParseError(422, "EMPTY_DOCUMENT", isZh ? "未能从文件中读取到文字内容。" : "No readable text found in the file.");
    }
    return { text: trimmed, source: "local" };
  }

  if (ext === ".docx" || fileType.includes("wordprocessingml")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = (result.value || "").trim();
      if (text.length > 10) return { text, source: "local" };
    } catch (err) {
      console.warn("DOCX parsing failed:", err);
    }
    throw new DocumentParseError(
      422,
      "DOCX_PARSE_FAILED",
      isZh ? "无法读取该 DOCX 文件，请确认文件未损坏后重试。" : "Could not read this DOCX file. Please verify it is not corrupted."
    );
  }

  if (ext === ".pptx" || fileType.includes("presentationml")) {
    try {
      const text = extractPptxText(buffer);
      if (text.length > 10) return { text, source: "local" };
    } catch (err) {
      console.warn("PPTX parsing failed:", err);
    }
    throw new DocumentParseError(
      422,
      "PPTX_NO_TEXT",
      isZh
        ? "未能从 PPTX 中提取文字（可能全部为图片）。请导出为 PDF 或补充文字版讲义。"
        : "No text could be extracted from this PPTX (it may be image-only). Please export it as PDF or upload text-based notes."
    );
  }

  if (ext === ".pdf" || fileType === "application/pdf") {
    try {
      if (typeof pdfParse === "function") {
        const data = await (pdfParse as any)(buffer);
        if (data && typeof data.text === "string" && data.text.trim().length > 20) {
          return { text: data.text.trim(), pageCount: data.numpages, source: "local" };
        }
      } else {
        const { PDFParse } = pdfParseModule as any;
        if (PDFParse) {
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          const text = typeof textResult === "string" ? textResult : textResult?.text || "";
          let pageCount: number | undefined;
          try {
            const info = await parser.getInfo();
            pageCount = info?.pages || info?.numPages || info?.pageCount;
          } catch {
            pageCount = undefined;
          }
          try {
            await parser.destroy?.();
          } catch {
            // ignore cleanup errors
          }
          if (text && text.trim().length > 20) {
            return { text: text.trim(), pageCount, source: "local" };
          }
        }
      }
    } catch (err) {
      console.warn("Local PDF text extraction failed:", err);
    }

    const text = await transcribePdfWithAI(cleanBase64, language);
    return { text, source: "ai" };
  }

  throw new DocumentParseError(
    415,
    "UNSUPPORTED_FORMAT",
    isZh ? "不支持此文件格式。" : "Unsupported file type."
  );
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    aiConfigured: Boolean(getAI()),
  });
});

app.post("/api/parse-document", async (req, res) => {
  try {
    const { fileName, fileType, base64Data, language } = req.body || {};
    if (!base64Data || !fileName) {
      return res.status(400).json({ error: "缺少文件内容。", code: "MISSING_FILE_DATA" });
    }

    const parsed = await parseUploadedDocument(
      String(fileName),
      typeof fileType === "string" ? fileType : "",
      String(base64Data),
      language === "en" ? "en" : "zh"
    );

    res.json({
      success: true,
      fileName: path.basename(String(fileName)).slice(0, MAX_FILE_NAME_LENGTH),
      text: parsed.text,
      pageCount: parsed.pageCount,
      length: parsed.text.length,
      meta: { source: parsed.source },
    });
  } catch (err: any) {
    if (err instanceof DocumentParseError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    console.error("Error in /api/parse-document:", err);
    res.status(500).json({ error: "文档解析服务异常，请稍后重试。", code: "PARSE_FAILED" });
  }
});

app.post("/api/extract-syllabus", async (req, res) => {
  try {
    const { materials, examName, subject } = req.body || {};

    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: "请先上传至少一份课程资料。", code: "MISSING_MATERIALS" });
    }

    const safeMaterials = sanitizeMaterials(materials);
    if (safeMaterials.length === 0) {
      return res.status(400).json({ error: "资料内容为空，请重新上传。", code: "EMPTY_MATERIALS" });
    }

    const safeExamName = clampText(examName, 200) || "Upcoming Exam";
    const safeSubject = clampText(subject, 200) || "General";
    const aggregatedContent = safeMaterials
      .map((m, idx) => `--- DOCUMENT ${idx + 1}: ${m.name} (${m.type}) ---\n${m.content}`)
      .join("\n\n");

    const isZh = resolveIsChinese(req.body?.language, safeExamName, safeSubject);
    const prompt = `You are an expert academic curriculum analyzer, knowledge tree architect, and exam preparation strategist.
Analyze the following exam study materials for the exam "${safeExamName}" in subject "${safeSubject}".
Extract a deep, multi-tier hierarchical syllabus tree (考点树状图体系).

GROUNDING RULES:
- Use ONLY the supplied documents. Do not invent chapters, topics, formulas or exam rules that are not supported by the material.
- If the documents are thin, return fewer units instead of padding with generic textbook content.
- Prefer the exact chapter, section and terminology names found in the documents.

TREE HIERARCHY RULES:
1. ROOT NODES (Major Units / 核心大单元): Group content into cohesive units or chapters that actually appear in the material.
2. BRANCH NODES (Granular Subtopics / 细分考点): Under EACH major unit, extract 3-6 concrete, highly granular sub-topics / problem types from the material.
3. LEAF NODES (Key Points & Traps / 核心要点与避坑点): For each subtopic, extract 2-4 specific testable points, governing formulas/theorems, score-earning checkpoints, and common pitfalls that are actually taught in the documents.
4. Ensure comprehensive exam weight distribution (weights summing to roughly 100%) and realistic estimated study hours.
${isZh ? "CRITICAL: Output ALL titles, descriptions, subtopic titles, key points, and formula notes in natural, academic Simplified Chinese (简体中文)." : ""}

Documents content:
${aggregatedContent.slice(0, 50000)}

Output a clean JSON object containing:
- summary: A concise 2-sentence summary of the whole knowledge tree scope and highest-yield focus branches.
- topics: An array of major unit topics, each having:
  - id: unique string (e.g. "topic-1", "topic-2")
  - title: major unit/chapter title (e.g. "第 1 单元：核心理论与定义体系")
  - category: broad domain or module name
  - description: overview of the concepts covered in this unit
  - weightPercentage: estimated weight in exam (number 5 to 40)
  - difficulty: "easy" | "medium" | "hard"
  - userKnowledgeLevel: "beginner" | "intermediate" | "advanced"
  - subtopics: array of subtopic title strings (e.g. ["1.1 核心术语界定", "1.2 基础公式推导"])
  - subtopicTree: array of granular subtopic nodes, each containing:
    - id: string (e.g. "sub-1-1")
    - title: specific subtopic title
    - keyPoints: array of 2-4 concrete concept points or formula notes
    - difficulty: "easy" | "medium" | "hard"
    - examFrequency: "high" | "medium" | "low"
    - formulaOrTrap: brief tip, formula, or common mistake to watch out for
  - estimatedHours: realistic hours needed (e.g. 4 to 15)`;

    const outcome = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              topics: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    description: { type: Type.STRING },
                    weightPercentage: { type: Type.NUMBER },
                    difficulty: { type: Type.STRING },
                    userKnowledgeLevel: { type: Type.STRING },
                    subtopics: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    subtopicTree: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING },
                          title: { type: Type.STRING },
                          keyPoints: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          difficulty: { type: Type.STRING },
                          examFrequency: { type: Type.STRING },
                          formulaOrTrap: { type: Type.STRING },
                        },
                        required: ["title"],
                      },
                    },
                    estimatedHours: { type: Type.NUMBER },
                  },
                  required: ["id", "title", "difficulty", "subtopics", "estimatedHours"],
                },
              },
            },
            required: ["summary", "topics"],
          },
        },
      }),
      (text) => {
        const parsed = JSON.parse(text);
        if (parsed.topics && Array.isArray(parsed.topics)) {
          parsed.topics.forEach((t: any, idx: number) => {
            if (!t.id) t.id = `topic-${idx + 1}`;
            if (!t.subtopicTree && t.subtopics && Array.isArray(t.subtopics)) {
              t.subtopicTree = t.subtopics.map((sub: string, sIdx: number) => ({
                id: `sub-${idx + 1}-${sIdx + 1}`,
                title: sub,
                keyPoints: [],
                difficulty: t.difficulty || "medium",
                examFrequency: "medium",
              }));
            } else if (t.subtopicTree && (!t.subtopics || t.subtopics.length === 0)) {
              t.subtopics = t.subtopicTree.map((s: any) => s.title);
            }
          });
        }
        return parsed;
      },
      null,
      { label: "extract-syllabus", perCallTimeoutMs: 35_000, overallBudgetMs: 60_000 }
    );

    const topics = outcome.value?.topics;
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(502).json({
        error: isZh
          ? "AI 未能从这些资料中识别出可用考点，请补充更完整的考纲、讲义或真题后重试。"
          : "AI could not identify usable topics from these materials. Add a fuller syllabus, lecture notes, or past paper and try again.",
        code: "SYLLABUS_EMPTY",
      });
    }

    res.json({
      ...outcome.value,
      meta: { source: outcome.source },
    });
  } catch (error: any) {
    if (error instanceof ApiInputError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    if (error instanceof AiServiceError) {
      const isZh = resolveIsChinese(req.body?.language);
      return res.status(error.reason === "no_api_key" ? 503 : 502).json({
        error:
          error.reason === "no_api_key"
            ? isZh
              ? "当前服务尚未配置 AI，无法自动提炼考点。请配置 GEMINI_API_KEY 后重试。"
              : "AI is not configured on this server. Set GEMINI_API_KEY and try again."
            : isZh
              ? "AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。"
              : "The AI service is temporarily unavailable. Please try again. Your materials will not be replaced with a template.",
        code: error.reason === "no_api_key" ? "AI_NOT_CONFIGURED" : "AI_UNAVAILABLE",
      });
    }
    console.error("Error extracting syllabus:", error);
    res.status(502).json({ error: "考点提取失败，请稍后重试。", code: "SYLLABUS_EXTRACTION_FAILED" });
  }
});

app.post("/api/generate-plan", async (req, res) => {
  try {
    const body = req.body || {};
    const preferences = sanitizePreferences(body.preferences);
    const safeTopics = sanitizeTopics(body.topics);
    const safeMaterials = sanitizeMaterials(body.materials || []);

    const isZh = resolveIsChinese(
      preferences.language || body.language,
      preferences.examName,
      preferences.subject
    );

    const allChunks = chunkAllMaterials(safeMaterials);

    const ragContextBlocks: string[] = [];
    const focusQuery = `${preferences.userNeedFocusArea || ""} ${preferences.customPromptRequirement || ""} ${preferences.weakTopicsFocus?.join(" ") || ""}`.trim();

    if (focusQuery && allChunks.length > 0) {
      const topFocusChunks = retrieveTopChunksForQuery(focusQuery, allChunks, { topK: 5 });
      topFocusChunks.forEach((c, idx) => {
        ragContextBlocks.push(`[RAG-CHUNK-FOCUS-${idx + 1}] Source: "${c.materialName}" (${c.materialType}) Section: "${c.sectionTitle}"\nContent Excerpt:\n${c.content.slice(0, 600)}`);
      });
    }

    safeTopics.slice(0, 8).forEach((t: any, idx: number) => {
      if (allChunks.length > 0) {
        const topChunks = retrieveTopChunksForQuery(t.title + " " + (t.subtopics?.join(" ") || ""), allChunks, { topK: 3 });
        topChunks.forEach((c, cIdx) => {
          ragContextBlocks.push(`[RAG-CHUNK-TOPIC-${idx + 1}-${cIdx + 1}] Target: "${t.title}" | Source: "${c.materialName}" (${c.materialType}) | Heading: "${c.sectionTitle}"\nExcerpt:\n${c.content.slice(0, 500)}`);
        });
      }
    });

    const ragContextText = ragContextBlocks.length > 0
      ? `\n=== RETRIEVED RAG KNOWLEDGE BASE CHUNKS FROM UPLOADED MATERIALS ===\n${ragContextBlocks.slice(0, 15).join("\n\n")}\n`
      : "";

    const planningStart = preferences.startDate || toLocalDateString();
    const planningExam = preferences.examDate || addDaysToDateString(planningStart, 21);
    const planningDays = Math.min(Math.max(1, daysBetweenDateStrings(planningStart, planningExam)), 60);
    const studyDayLines: string[] = [];
    for (let offset = 0; offset < planningDays; offset += 1) {
      const dateStr = addDaysToDateString(planningStart, offset);
      const weekday = parseLocalDate(dateStr).toLocaleDateString("en-US", { weekday: "short" });
      const schedule = preferences.dailySchedules?.find(
        (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(dateStr).getDay()
      );
      if (schedule && !schedule.enabled) continue;
      const availableHours = Number(schedule?.availableHours) > 0 ? Number(schedule.availableHours) : 2;
      studyDayLines.push(`${dateStr} (${weekday}) — ${availableHours}h available`);
    }
    const studyCalendarText = studyDayLines.length > 0
      ? studyDayLines.join("\n")
      : `${planningStart} — limited time before the exam`;

    const prompt = `You are a master learning scientist and RAG study schedule architect.
Create a realistic, scientifically optimized day-by-day exam study plan strictly grounded in the student's uploaded materials and personal needs.
${isZh ? "CRITICAL: All generated phase names, phase descriptions, task titles, descriptions, key objectives, active recall prompts, and ragSource citations MUST be written in natural, idiomatic Simplified Chinese (简体中文)." : ""}

STUDENT PROFILE & PERSONALIZED STUDY NEEDS:
- Exam Name: ${preferences.examName || "Final Exam"}
- Subject: ${preferences.subject || "Academic"}
- Start Date: ${planningStart}
- Exam Date: ${planningExam} (Exam Time: ${preferences.examTime || "09:00"})
- Target Score / Goal: ${preferences.targetScoreOrGrade || "Top Grade"}
- User Focus Priority: ${preferences.userNeedFocusArea || "comprehensive"}
- Custom Student Directives: ${preferences.customPromptRequirement || preferences.additionalNotes || "None"}
- Preferred Session Duration: ${preferences.sessionLengthMinutes} minutes per block
- Priority Weak Topics: ${preferences.weakTopicsFocus?.join(", ") || "None specified"}

PLANNING CALENDAR (${planningDays} days; these are the ONLY allowed task dates):
${studyCalendarText}

SYLLABUS TOPICS:
${JSON.stringify(safeTopics, null, 2).slice(0, 40_000)}
${ragContextText}

RAG GROUNDING REQUIREMENTS:
1. Every date listed in PLANNING CALENDAR must receive at least one task. Do not skip listed days and do not invent dates outside the list. Split each day into 1-3 blocks whose total durationMinutes does not exceed that day's available hours.
2. Group the timeline into 3-4 study phases derived from this specific material (not a generic template). Each phase needs concrete startDate/endDate and a focus tied to actual topics.
3. For EVERY study task, ground it directly in the uploaded documents and retrieved chunks:
   - title: concise, highly actionable, tied to a real chapter/section or problem from the material
   - description: clear step-by-step guidance on what to read, solve, or produce
   - category: ["theory", "reading", "practice_problems", "active_recall", "flashcards", "mock_exam", "review_weak_spots", "summary_cheat_sheet"]
   - topicTitle: the associated syllabus topic title
   - date: "YYYY-MM-DD" (must be one of the PLANNING CALENDAR dates)
   - startTime / endTime / durationMinutes
   - priority: "high" | "medium" | "low"
   - status: "pending"
   - keyObjectives: array of 2-3 specific mastery checkpoints from the material
   - activeRecallPrompt: self-testing question based on the document concepts
   - groundedUserNeed: explain which student requirement this task satisfies
   - formulaOrRules: 1-2 key formulas or rules that appear in the material (empty array if none)
   - ragSource: cite the real source document and section used
     - documentName: exact name of the uploaded material
     - documentType: "syllabus" | "notes" | "past_exam" | "lecture_slides"
     - sectionTitle: real section or heading
     - pageOrChapter: real chapter/page reference when available, otherwise a short section reference
     - excerptSnippet: quote or close paraphrase of real content from that source (50-150 chars)
     - keyConcepts: array of 2-4 keywords
     - relevanceReason: why this source chunk supports this task
4. Never fabricate document names, chapter numbers, quotes, formulas or exam rules. If a piece of information is not in the materials, omit it rather than inventing it.`;

    const studyDates = new Set(studyDayLines.map((line) => line.slice(0, 10)));

    const outcome = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              phases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    startDate: { type: Type.STRING },
                    endDate: { type: Type.STRING },
                    focus: { type: Type.STRING },
                  },
                  required: ["id", "name", "description", "startDate", "endDate", "focus"],
                },
              },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    topicTitle: { type: Type.STRING },
                    date: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                    priority: { type: Type.STRING },
                    status: { type: Type.STRING },
                    keyObjectives: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    activeRecallPrompt: { type: Type.STRING },
                    groundedUserNeed: { type: Type.STRING },
                    formulaOrRules: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    ragSource: {
                      type: Type.OBJECT,
                      properties: {
                        documentName: { type: Type.STRING },
                        documentType: { type: Type.STRING },
                        sectionTitle: { type: Type.STRING },
                        pageOrChapter: { type: Type.STRING },
                        excerptSnippet: { type: Type.STRING },
                        keyConcepts: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING },
                        },
                        relevanceReason: { type: Type.STRING },
                      },
                      required: ["documentName", "excerptSnippet"],
                    },
                  },
                  required: [
                    "id",
                    "title",
                    "description",
                    "category",
                    "topicTitle",
                    "date",
                    "durationMinutes",
                    "priority",
                    "status",
                    "keyObjectives",
                  ],
                },
              },
              totalPlannedHours: { type: Type.NUMBER },
            },
            required: ["phases", "tasks", "totalPlannedHours"],
          },
        },
      }),
      (text) => JSON.parse(text),
      null,
      { label: "generate-plan", perCallTimeoutMs: 45_000, overallBudgetMs: 90_000 }
    );

    const rawResult = outcome.value;

    // Keep only real AI-authored tasks; never pad empty days with template content.
    const enrichedTasks = normalizePlanTasks(rawResult.tasks || [], preferences);

    if (enrichedTasks.length === 0) {
      return res.status(502).json({
        error: isZh
          ? "AI 未能生成可用的每日任务，请检查资料内容后重试。"
          : "AI did not return any usable daily tasks. Check the materials and try again.",
        code: "PLAN_EMPTY",
      });
    }

    const coveredDates = new Set(enrichedTasks.map((task) => task.date));
    const uncoveredDays = [...studyDates].filter((date) => !coveredDates.has(date));
    if (uncoveredDays.length > 0) {
      console.warn(
        `[AI generate-plan] ${uncoveredDays.length}/${studyDates.size} study days have no AI task: ${uncoveredDays.slice(0, 8).join(", ")}`
      );
    }

    const totalCalculatedHours = Math.round(
      enrichedTasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60
    );

    res.json({
      ...rawResult,
      tasks: enrichedTasks,
      totalPlannedHours: totalCalculatedHours || rawResult.totalPlannedHours || 0,
      meta: { source: outcome.source, coveredDays: coveredDates.size, planningDays: studyDates.size },
    });
  } catch (error: any) {
    if (error instanceof ApiInputError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    if (error instanceof AiServiceError) {
      const isZh = resolveIsChinese(req.body?.language, req.body?.preferences?.examName);
      return res.status(error.reason === "no_api_key" ? 503 : 502).json({
        error:
          error.reason === "no_api_key"
            ? isZh
              ? "当前服务尚未配置 AI，无法自动生成计划。请配置 GEMINI_API_KEY 后重试。"
              : "AI is not configured on this server. Set GEMINI_API_KEY and try again."
            : isZh
              ? "AI 服务暂时不可用，请稍后重试。你的资料不会被替换成模板。"
              : "The AI service is temporarily unavailable. Please try again. Your materials will not be replaced with a template.",
        code: error.reason === "no_api_key" ? "AI_NOT_CONFIGURED" : "AI_UNAVAILABLE",
      });
    }
    console.error("Error generating study plan:", error);
    res.status(502).json({ error: "学习计划生成失败，请稍后重试。", code: "PLAN_GENERATION_FAILED" });
  }
});

function normalizePlanTasks(existingTasks: any[], preferences: any): any[] {
  const startStr = preferences.startDate || toLocalDateString();
  const examStr = preferences.examDate || addDaysToDateString(startStr, 21);
  const totalDays = Math.max(1, daysBetweenDateStrings(startStr, examStr));
  const validCategories = new Set([
    "theory",
    "reading",
    "practice_problems",
    "active_recall",
    "flashcards",
    "mock_exam",
    "review_weak_spots",
    "summary_cheat_sheet",
  ]);
  const validPriorities = new Set(["high", "medium", "low"]);
  const validStatuses = new Set(["pending", "in_progress", "completed", "skipped"]);
  const seenIds = new Set<string>();
  const normalized: any[] = [];

  (existingTasks || []).forEach((task: any, index: number) => {
    if (!task || typeof task !== "object") return;
    const date = clampText(task.date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseLocalDate(date).getTime())) {
      return;
    }
    const dayOffset = daysBetweenDateStrings(startStr, date);
    if (dayOffset < 0 || dayOffset >= totalDays) return;

    const schedule = preferences.dailySchedules?.find(
      (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(date).getDay()
    );
    if (schedule && !schedule.enabled) return;

    const title = clampText(task.title, 300);
    if (!title) return;

    const rawDuration = Number(task.durationMinutes);
    const durationMinutes = Number.isFinite(rawDuration) && rawDuration >= 10
      ? Math.min(240, Math.round(rawDuration))
      : Math.min(240, Math.max(10, Number(preferences.sessionLengthMinutes) || 45));

    const rawId = clampText(task.id, 120) || `task-${date}-${index + 1}`;
    let id = rawId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${rawId}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);

    normalized.push({
      ...task,
      id,
      title,
      description: clampText(task.description, 2_000),
      category: validCategories.has(task.category) ? task.category : "reading",
      topicTitle: clampText(task.topicTitle, 300),
      date,
      startTime: /^\d{2}:\d{2}$/.test(String(task.startTime || "")) ? task.startTime : undefined,
      endTime: /^\d{2}:\d{2}$/.test(String(task.endTime || "")) ? task.endTime : undefined,
      durationMinutes,
      priority: validPriorities.has(task.priority) ? task.priority : "medium",
      status: validStatuses.has(task.status) ? task.status : "pending",
      keyObjectives: Array.isArray(task.keyObjectives)
        ? task.keyObjectives.slice(0, 6).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
      activeRecallPrompt: clampText(task.activeRecallPrompt, 1_000) || undefined,
      groundedUserNeed: clampText(task.groundedUserNeed, 1_000) || undefined,
      formulaOrRules: Array.isArray(task.formulaOrRules)
        ? task.formulaOrRules.slice(0, 6).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
    });
  });

  return normalized.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
  });
}

app.post("/api/rag-ask", async (req, res) => {
  try {
    const body = req.body || {};
    const query = clampText(body.query, MAX_QUERY_CHARS);
    if (!query) {
      return res.status(400).json({ error: "请输入要查询的问题。", code: "MISSING_QUERY" });
    }

    const topicTitle = clampText(body.topicTitle, 300);
    const taskTitle = clampText(body.taskTitle, 300);
    const safeMaterials = sanitizeMaterials(body.materials || [], 20, 80_000);
    const isZh = resolveIsChinese(body.language, query, topicTitle, taskTitle);

    const allChunks = chunkAllMaterials(safeMaterials);
    const searchQuery = `${query} ${topicTitle} ${taskTitle}`.trim();
    const retrievedChunks = retrieveTopChunksForQuery(searchQuery, allChunks, { topK: 5 });

    const contextText = retrievedChunks.length > 0
      ? retrievedChunks.map((c, i) => `[Source ${i + 1}: ${c.materialName} - ${c.sectionTitle}]\n${c.content}`).join("\n\n")
      : "No direct matching document chunks found in uploaded materials.";

    const prompt = `You are an AI Academic Tutor answering a student's question based strictly on their uploaded study materials.
Student Question: "${query}"
Context / Task: Topic: "${topicTitle || "General"}", Task: "${taskTitle}"

Retrieved Document Excerpts:
${contextText}

Instructions:
1. Provide a direct, helpful answer grounded in the excerpts.
2. Explicitly cite the document names and section titles where the information came from.
3. List 1-2 key formulas, rules, or definitions mentioned in the excerpts.
4. Provide a quick 1-step action the student should take right now.
${isZh ? "Output your response in Simplified Chinese (简体中文)." : "Output your response in English."}`;

    const outcome = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: prompt,
      }),
      (text) => ({
        answer: text,
        citations: retrievedChunks.map((c) => ({
          documentName: c.materialName,
          sectionTitle: c.sectionTitle,
          excerpt: c.content.slice(0, 180) + "...",
        })),
      }),
      () => {
        throw new AiUnavailableError();
      },
      { label: "rag-ask", perCallTimeoutMs: 30_000, overallBudgetMs: 50_000 }
    );

    res.json({ ...outcome.value, meta: { source: "ai" } });
  } catch (error: any) {
    if (error instanceof AiUnavailableError) {
      return res.status(503).json({
        error: "AI 问答服务暂时不可用，请稍后重试。",
        code: "AI_UNAVAILABLE",
      });
    }
    console.error("Error in /api/rag-ask:", error);
    res.status(500).json({ error: "问答服务异常，请稍后重试。", code: "RAG_FAILED" });
  }
});

app.post("/api/rebalance-plan", async (req, res) => {
  try {
    const body = req.body || {};
    const currentPlan = sanitizePlanForRebalance(body.currentPlan);
    const requestedDate = clampText(body.currentDate, 20);
    const todayStr = requestedDate && !Number.isNaN(parseLocalDate(requestedDate).getTime())
      ? requestedDate
      : toLocalDateString();
    const reason = clampText(body.reason, 500);

    const isZh = resolveIsChinese(body.language, currentPlan.examName, currentPlan.subject);
    const prompt = `You are an adaptive study coach.
The student needs to dynamically reschedule their remaining exam study plan as of ${todayStr}.
Reason / Trigger: ${reason || "Student missed past tasks or needs schedule rebalancing"}
${isZh ? "CRITICAL: The summary and updated task titles/descriptions must be written in natural Simplified Chinese (简体中文)." : ""}

Exam Date: ${currentPlan.examDate}
Exam Name: ${currentPlan.examName}

Daily Available Schedule Preferences:
${JSON.stringify(currentPlan.preferences?.dailySchedules || [])}

Current Tasks Status:
${JSON.stringify(currentPlan.tasks, null, 2)}

INSTRUCTIONS:
1. Preserve all tasks that are already 'completed'. Keep their dates unchanged.
2. For all 'pending' or 'skipped' tasks scheduled before ${todayStr}, or remaining uncompleted tasks:
   - Reschedule them intelligently across remaining days from ${todayStr} up to ${currentPlan.examDate}.
   - Balance daily study load without exceeding daily available study hours.
   - If time is tight, merge low-priority tasks into high-yield review sessions and mark their priority appropriately.
3. Return the complete updated tasks array with updated dates, startTimes, endTimes, and prioritized sequence.`;

    const outcome = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rebalanceSummary: { type: Type.STRING },
              tasks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    category: { type: Type.STRING },
                    topicTitle: { type: Type.STRING },
                    date: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    durationMinutes: { type: Type.NUMBER },
                    priority: { type: Type.STRING },
                    status: { type: Type.STRING },
                    keyObjectives: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    activeRecallPrompt: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    confidenceRating: { type: Type.NUMBER },
                  },
                  required: ["id", "title", "category", "topicTitle", "date", "durationMinutes", "priority", "status"],
                },
              },
            },
            required: ["rebalanceSummary", "tasks"],
          },
        },
      }),
      (text) => JSON.parse(text),
      () => fallbackRebalancePlan(currentPlan, todayStr, reason),
      { label: "rebalance-plan", perCallTimeoutMs: 35_000, overallBudgetMs: 60_000 }
    );

    const result = outcome.value;
    const sanitized = {
      ...result,
      tasks: (result.tasks || []).map((t: any, idx: number) => {
        const dateStr = t.date || toLocalDateString();
        const salt = Math.random().toString(36).slice(2, 6);
        return {
          ...t,
          id: t.id || `task-${dateStr}-${salt}-${idx}`,
        };
      }),
      meta: { source: outcome.source, fallbackReason: outcome.fallbackReason },
    };

    res.json(sanitized);
  } catch (error: any) {
    if (error instanceof ApiInputError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error("Error rebalancing plan:", error);
    res.status(500).json({ error: "计划重排失败，请稍后重试。", code: "REBALANCE_FAILED" });
  }
});

async function setupViteOrStatic() {
  const isProductionRuntime =
    process.env.NODE_ENV === "production" || /\.cjs$/i.test(process.argv[1] || "");

  if (!isProductionRuntime) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.use((err: any, req: any, res: any, next: any) => {
    if (res.headersSent) return next(err);

    if (err?.type === "entity.too.large") {
      return res.status(413).json({
        error: "上传内容过大（上限 16 MB）。",
        code: "PAYLOAD_TOO_LARGE",
      });
    }

    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({
        error: "请求内容不是有效的 JSON。",
        code: "INVALID_JSON",
      });
    }

    console.error("Unhandled request error:", err);
    res.status(500).json({ error: "服务器内部错误。", code: "INTERNAL_ERROR" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Exam Plan AI Server running on port ${PORT}`);
  });
}

setupViteOrStatic();
