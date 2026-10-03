import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";
import rateLimit from "express-rate-limit";

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// 收紧请求体上限：base64 上传仍够用，但避免 50MB 的滥用面
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// 简单请求日志：method url 耗时
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// 对 AI 相关接口做基础限流，防刷配额（暂不做鉴权）
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "请求过于频繁，请稍后再试" } },
});

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

function getDeepSeekKey(): string | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (key && key !== "MY_DEEPSEEK_API_KEY") return key;
  return null;
}

// 启动时环境变量校验
if (!getDeepSeekKey()) {
  console.warn("[ENV] DEEPSEEK_API_KEY 未配置或为占位符，AI 接口将全部走本地 fallback（模板结果）。");
}

async function chatCompletion(messages: { role: string; content: string }[], json: boolean): Promise<string> {
  const key = getDeepSeekKey();
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const body: any = {
    model: DEEPSEEK_MODEL,
    messages,
    stream: false,
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    const err: any = new Error(`DeepSeek API error ${res.status}: ${errText.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Empty response from DeepSeek");
  }
  return text.trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// 剥离 markdown 代码块围栏后再解析，避免模型输出 ```json 导致整体降级
function safeParseJSON(text: string): any {
  let cleaned = text.trim();
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) cleaned = fence[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error("Model output is not valid JSON");
  }
}

// 本地时区的“今天”（避免 UTC 偏差一天）
function localToday(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function generateWithRetryAndFallback<T>(
  buildMessages: () => { system?: string; user: string },
  parseResult: (text: string) => T,
  fallbackGenerator: () => T,
  options: { json?: boolean } = {}
): Promise<{ data: T; aiGenerated: boolean }> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { system, user } = buildMessages();
      const messages: { role: string; content: string }[] = [];
      if (system) messages.push({ role: "system", content: system });
      messages.push({ role: "user", content: user });
      const text = await chatCompletion(messages, !!options.json);
      const parsed = parseResult(text);
      return { data: parsed, aiGenerated: true };
    } catch (err: any) {
      const status = err?.status || err?.code || err?.statusCode;
      const msg = String(err?.message || "");
      const isRateLimit = status === 429 || /429|rate\s*limit/i.test(msg);
      const isQuota =
        status === 402 ||
        (status === 403 && /insufficient|quota|balance/i.test(msg)) ||
        /402|insufficient|quota|balance/i.test(msg);
      if ((isRateLimit || isQuota) && attempt < 3) {
        await sleep(500 * attempt * attempt); // 指数退避
        continue;
      }
      console.warn(`[AI] attempt ${attempt} failed (status=${status}): ${msg}`);
      break;
    }
  }
  return { data: fallbackGenerator(), aiGenerated: false };
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

function fallbackExtractSyllabus(materials: any[], examName: string, subject: string, lang: string = "zh") {
  const isZh = lang === "zh" || isChinese(examName) || isChinese(subject);
  const combinedText = materials.map((m) => m.content || "").join("\n");
  const lines = combinedText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 80);

  const foundHeadings = lines.filter((l) =>
    /^(unit|chapter|module|week|topic|part|第|单元|章|模块|\d+\.|\b[A-Z\s]{4,}\b)/i.test(l)
  );

  const topicTemplatesZh = [
    {
      unit: "第 1 单元：核心概念定义与基础理论体系",
      category: "基础概念",
      diff: "easy" as const,
      subtopics: [
        {
          title: "核心术语界定与公理化体系",
          keyPoints: ["基本概念定义与数学/逻辑表述", "定理适用的前提充分与必要条件", "典型反例与边界误区"],
          difficulty: "easy" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "务必注意定理成立的前提约束条件",
        },
        {
          title: "基础公式推导与符号规范",
          keyPoints: ["标准符号约定与代数化表达", "基本等式与恒等变形技巧", "单位量纲与数值范围校验"],
          difficulty: "easy" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "注意公式推导中的符号正负号与分母不为零的定义域限制",
        },
        {
          title: "知识脉络梳理与分类框架",
          keyPoints: ["知识树分支逻辑与内在关联", "同类概念横向对比与辨析矩阵", "基础概念在典型场景下的应用判断"],
          difficulty: "easy" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "概念辨析选择题常考细微差异与易混淆名词",
        },
      ],
    },
    {
      unit: "第 2 单元：核心方法、推导机制与算法状态转移",
      category: "核心方法",
      diff: "medium" as const,
      subtopics: [
        {
          title: "核心推导模型与标准计算流程",
          keyPoints: ["解题标准步骤分解", "主干方程建立与变量代换", "关键结论推导路径"],
          difficulty: "medium" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "掌握规范化步骤分得分点，列出关键主方程",
        },
        {
          title: "关键算法/机制分析与复杂度评估",
          keyPoints: ["状态转移方程与递归边界", "时空复杂度数学分析", "数据结构与辅助数组开销"],
          difficulty: "medium" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "注意边界初始化及极端规模下的溢出防范",
        },
        {
          title: "定理证明逻辑与通用解题模板",
          keyPoints: ["反证法/数学归纳法核心骨架", "构造性证明与构造辅助线/函数", "得分模板书写要点"],
          difficulty: "medium" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "证明题必须完整写出归纳假设与递推依据",
        },
      ],
    },
    {
      unit: "第 3 单元：典型大题精析、高频命题与解题专项演练",
      category: "典型大题",
      diff: "hard" as const,
      subtopics: [
        {
          title: "历年高频主观大题解法剖析",
          keyPoints: ["题干关键题眼抓取与建模", "多步解题策略与中间变量控制", "标准评分标准采分点拆解"],
          difficulty: "hard" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "主观题分步作答，即使最后答案有误也能保住过程分",
        },
        {
          title: "高频易错踩坑点与避坑专项防范",
          keyPoints: ["隐蔽约束条件挖掘", "特殊值测试与极端情形检验", "符号、单位与答题卡书写规范"],
          difficulty: "hard" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "警惕题目中隐藏的暗含条件（如非负整数、闭区间端点）",
        },
        {
          title: "解题速度优化与验算技巧",
          keyPoints: ["代入特殊值快速秒杀法", "数量级估计与量纲检验", "逆向思维与排除法运用"],
          difficulty: "medium" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "客观题优先尝试特殊值与排除法，节约大题用时",
        },
      ],
    },
    {
      unit: "第 4 单元：跨章节综合应用、前沿进阶与压轴难点突破",
      category: "进阶难点",
      diff: "hard" as const,
      subtopics: [
        {
          title: "多模块交叉融合综合命题",
          keyPoints: ["跨章节概念联动分析", "多层嵌套约束解题路径", "系统级综合题建模与解耦"],
          difficulty: "hard" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "压轴题先做模块拆解，化大为小各个击破",
        },
        {
          title: "复杂边界条件与极限情况推演",
          keyPoints: ["临界状态判定准则", "扰动分析与稳定性论证", "极值点与不可导点特殊处理"],
          difficulty: "hard" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "务必单独检验端点与分母为零等奇异点",
        },
        {
          title: "压轴压分技巧与保底策略",
          keyPoints: ["第一问稳拿满分策略", "复杂第二问过程分争取", "时间分配硬性止损机制"],
          difficulty: "hard" as const,
          examFrequency: "medium" as const,
          formulaOrTrap: "超过预定单题时间果断止损，先做性价比更高的题目",
        },
      ],
    },
    {
      unit: "第 5 单元：真题实战全真模拟、艾宾浩斯复盘与速记冲刺",
      category: "真题冲刺",
      diff: "medium" as const,
      subtopics: [
        {
          title: "全真闭卷限时模考演练",
          keyPoints: ["全套试卷时间分配实操", "做题节奏与心理调控", "草稿纸分区使用与复查通道"],
          difficulty: "medium" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "严格按照考试时间闭卷模拟，训练考试生理时钟",
        },
        {
          title: "个人错题本高频陷阱复盘",
          keyPoints: ["错因分类（概念不清/计算失误/读题漏看）", "同类变式题针对性加练", "防重复犯错检查清单"],
          difficulty: "medium" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "重点攻克近期反复错 2 次以上的顽固题型",
        },
        {
          title: "考前 24 小时必背核心清单与速查表",
          keyPoints: ["核心公式定理极速过筛", "高频大题答题框架闭眼回忆", "考场应急处理与心态重置预案"],
          difficulty: "easy" as const,
          examFrequency: "high" as const,
          formulaOrTrap: "考前不再做新难题，全力强化已掌握知识的熟练度",
        },
      ],
    },
  ];

  const topics = topicTemplatesZh.map((tmpl, idx) => {
    const customHeading = foundHeadings[idx]?.replace(/^[#*\-•\d\.\s]+/, "").trim();
    const title = customHeading && customHeading.length > 3 && customHeading.length < 50
      ? `第 ${idx + 1} 单元：${customHeading}`
      : tmpl.unit;

    const subtopicTree = tmpl.subtopics.map((sub, sIdx) => ({
      id: `sub-${idx + 1}-${sIdx + 1}`,
      title: `${idx + 1}.${sIdx + 1} ${sub.title}`,
      keyPoints: sub.keyPoints,
      difficulty: sub.difficulty,
      examFrequency: sub.examFrequency,
      formulaOrTrap: sub.formulaOrTrap,
    }));

    const subtopics = subtopicTree.map((s) => s.title);
    const weight = idx === 0 ? 15 : idx === 1 ? 25 : idx === 2 ? 30 : idx === 3 ? 20 : 10;

    return {
      id: `topic-${idx + 1}`,
      title,
      category: tmpl.category,
      description: isZh
        ? `涵盖「${title}」的大单元考点树，包含 ${subtopicTree.length} 个细分知识点体系与高频题型。`
        : `Covers topic tree for ${title} with ${subtopicTree.length} fine-grained subtopics.`,
      weightPercentage: weight,
      difficulty: tmpl.diff,
      userKnowledgeLevel: tmpl.diff === "hard" ? "beginner" : "intermediate",
      subtopics,
      subtopicTree,
      estimatedHours: tmpl.diff === "hard" ? 8 : tmpl.diff === "medium" ? 6 : 4,
    };
  });

  return {
    summary: isZh
      ? `已深度解析课程资料，构建了完整的树状考点架构（Tree Hierarchy）。包含 ${topics.length} 个大单元模块，细分出 ${topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0)} 个颗粒度考点及核心考查要点。`
      : `Extracted comprehensive hierarchical topic tree with ${topics.length} major units and ${topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0)} granular subtopics.`,
    topics,
  };
}

function fallbackGeneratePlan(topics: any[], preferences: any) {
  const isZh = preferences.language === "zh" || isChinese(preferences.examName) || isChinese(preferences.subject) || true;
  const startDate = new Date(preferences.startDate);
  const examDate = new Date(preferences.examDate);
  const daysTotal = Math.max(1, Math.ceil((examDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const phase1End = new Date(startDate.getTime() + Math.floor(daysTotal * 0.35) * 86400000).toISOString().split("T")[0];
  const phase2End = new Date(startDate.getTime() + Math.floor(daysTotal * 0.70) * 86400000).toISOString().split("T")[0];
  const phase3End = new Date(startDate.getTime() + Math.floor(daysTotal * 0.90) * 86400000).toISOString().split("T")[0];
  const phase4End = preferences.examDate;

  const phasesZh = [
    {
      id: "phase-1",
      name: "第 1 阶段：考纲通读与概念夯实",
      description: "全面通读核心教材与讲义，梳理知识框架，完成定义与公式的理解。",
      startDate: preferences.startDate,
      endDate: phase1End,
      focus: "构建知识网络，完成所有基础考点的首轮精读与笔记整理。",
    },
    {
      id: "phase-2",
      name: "第 2 阶段：专题精练与典型题攻坚",
      description: "按知识模块强化习题演练，吃透典型题型解法，专项突破重难点与薄弱项。",
      startDate: phase1End,
      endDate: phase2End,
      focus: "通过多维度题目演练深化应用能力，强化解题思路与速度。",
    },
    {
      id: "phase-3",
      name: "第 3 阶段：主动回忆与全真模考冲刺",
      description: "限时全真模拟测试，艾宾浩斯主动回忆检测，系统性复盘错题。",
      startDate: phase2End,
      endDate: phase3End,
      focus: "培养应试手感、掌控考场答题节奏，精准查漏补缺。",
    },
    {
      id: "phase-4",
      name: "第 4 阶段：高频考点速记与考前查漏",
      description: "复习核心公式清单、速览错题本、调整考前作息与心理状态。",
      startDate: phase3End,
      endDate: phase4End,
      focus: "牢固记忆核心公式与考点，保持最佳应考状态。",
    },
  ];

  const phasesEn = [
    {
      id: "phase-1",
      name: "Phase 1: Foundation & Conceptual Mastery",
      description: "First pass of all core lecture materials, definitions, and active note synthesizing.",
      startDate: preferences.startDate,
      endDate: phase1End,
      focus: "Comprehensive coverage of foundational definitions and key mechanisms.",
    },
    {
      id: "phase-2",
      name: "Phase 2: Deep Problem Sets & Application",
      description: "Rigorous problem solving, homework assignments, and multi-step practice questions.",
      startDate: phase1End,
      endDate: phase2End,
      focus: "Reinforcement through active problem solving and identifying edge cases.",
    },
    {
      id: "phase-3",
      name: "Phase 3: Active Recall & Timed Mocks",
      description: "Timed practice exams, spaced repetition drills, and targeted weak-spot remediation.",
      startDate: phase2End,
      endDate: phase3End,
      focus: "Speed, precision, and building exam endurance under strict test constraints.",
    },
    {
      id: "phase-4",
      name: "Phase 4: High-Yield Final Review & Formula Synthesis",
      description: "Final formula sheet review, error log triage, and light reinforcement before exam day.",
      startDate: phase3End,
      endDate: phase4End,
      focus: "Peak retention and mental clarity.",
    },
  ];

  const phases = isZh ? phasesZh : phasesEn;

  const tasks: any[] = [];
  const scheduleMap = new Map((preferences.dailySchedules || []).map((s: any) => [s.dayOfWeek, s]));
  const safeTopics = topics && topics.length > 0 ? topics : [
    { title: isZh ? "核心概念与定义" : "Core Principles", difficulty: "medium" },
    { title: isZh ? "综合演练与真题" : "Applied Problem Sets", difficulty: "hard" },
    { title: isZh ? "重点难点回溯" : "Exam Synthesis", difficulty: "medium" },
  ];

  let topicIndex = 0;
  let totalHours = 0;

  for (let i = 0; i < daysTotal; i++) {
    const current = new Date(startDate.getTime() + i * 86400000);
    const dateStr = current.toISOString().split("T")[0];
    const dayOfWeek = current.getDay();
    const sched: any = scheduleMap.get(dayOfWeek) || { enabled: true, availableHours: 2, preferredTimeSlot: "evening" };

    if (!sched.enabled || sched.availableHours <= 0) continue;

    const isBufferDay = preferences.includeBufferDays && i >= daysTotal - (preferences.bufferDaysCount || 2);
    const isMockDay = preferences.includePracticeExams && (i === Math.floor(daysTotal * 0.5) || i === Math.floor(daysTotal * 0.85));

    const topic = safeTopics[topicIndex % safeTopics.length];
    topicIndex++;

    const startH = sched.preferredTimeSlot === "morning" ? 9 : sched.preferredTimeSlot === "afternoon" ? 14 : 18;
    const sessionDuration = preferences.sessionLengthMinutes || 45;

    const randSalt = Math.random().toString(36).slice(2, 6);
    if (isMockDay) {
      tasks.push({
        id: `task-${dateStr}-${randSalt}-mock`,
        title: isZh ? `全真限时模拟考试：${preferences.examName || "阶段模考"}` : `Full Timed Practice Exam: ${preferences.examName || "Mastery Mock"}`,
        description: isZh
          ? "严格模拟正式考试环境：关闭所有参考资料，开启倒计时并在限定时间内独立完成全套试题。"
          : "Simulate exact test conditions: close all reference materials, set timer, and complete full test set.",
        category: "mock_exam",
        topicTitle: isZh ? "全部考点（综合演练）" : "All Topics (Cumulative)",
        date: dateStr,
        startTime: `${String(startH).padStart(2, "0")}:00`,
        endTime: `${String(startH + 2).padStart(2, "0")}:00`,
        durationMinutes: 120,
        priority: "high",
        status: "pending",
        keyObjectives: isZh
          ? [
              "严格在规定考试时间内完成全部题目作答",
              "测试完成后立即对照答案与解析复盘错题",
              "将模糊考点与易错题型归纳到错题笔记",
            ]
          : [
              "Complete all sections within timed limits",
              "Review incorrect and flagged questions immediately afterward",
              "Log tricky trap patterns in error notebook",
            ],
        activeRecallPrompt: isZh
          ? "在本次模考中，哪些知识模块耗费了最多时间或导致了答题犹豫？"
          : "Which concepts consumed the most time or caused hesitation during this mock?",
      });
      totalHours += 2;
    } else if (isBufferDay) {
      tasks.push({
        id: `task-${dateStr}-${randSalt}-buffer`,
        title: isZh ? `考前缓冲与查漏补缺：${topic.title}` : `Buffer Review: High-Yield Formula Sheet & Tricky Concepts`,
        description: isZh
          ? "对核心公式表、高频考点速记卡及错题本进行轻量级多轮复习。"
          : "Lightweight spaced repetition of summary sheets, key formulas, and high-frequency definitions.",
        category: "summary_cheat_sheet",
        topicTitle: topic.title,
        date: dateStr,
        startTime: `${String(startH).padStart(2, "0")}:00`,
        endTime: `${String(startH + 1).padStart(2, "0")}:00`,
        durationMinutes: 60,
        priority: "medium",
        status: "pending",
        keyObjectives: isZh
          ? [
              "合上讲义自主默写本考点的关键公式与核心概念",
              "复盘历史错题，确保不再重复犯同类错误",
            ]
          : [
              "Verify memory of top formulas and definitions without glancing at notes",
              "Rest adequately and prepare exam logistics",
            ],
        activeRecallPrompt: isZh
          ? "不看笔记，尝试口述或默写该考点最重要的 3 个核心结论与公式。"
          : "Write down the 5 most critical formulas from memory without checking.",
      });
      totalHours += 1;
    } else {

      const isWeak = preferences.weakTopicsFocus?.includes(topic.title);
      const userNeedStatement = isZh
        ? `满足【${preferences.targetScoreOrGrade || "目标高分"}】需求，针对「${topic.title}」进行核心考点深挖`
        : `Targeting [${preferences.targetScoreOrGrade || "High Score"}], focusing on [${topic.title}]`;

      tasks.push({
        id: `task-${dateStr}-${randSalt}-1`,
        title: isZh ? `考点精读与概念溯源：${topic.title}` : `Active Study & Concept Mapping: ${topic.title}`,
        description: isZh
          ? `精读核心讲义与教材，梳理 ${topic.title} 的核心定理、定义及逻辑脉络，构建系统知识图谱。`
          : `Review theory, highlight key relationships, and summarize the core principles of ${topic.title}.`,
        category: "theory",
        topicTitle: topic.title,
        date: dateStr,
        startTime: `${String(startH).padStart(2, "0")}:00`,
        endTime: `${String(startH + 1).padStart(2, "0")}:00`,
        durationMinutes: sessionDuration,
        priority: isWeak ? "high" : "medium",
        status: "pending",
        keyObjectives: isZh
          ? [
              `梳理并总结 ${topic.title} 的核心定理与公式推导`,
              "独立完成 3-5 道基础概念检测题",
              "标记出需要进一步强化的疑难点",
            ]
          : [
              `Summarize core axioms and equations for ${topic.title}`,
              "Solve 3 introductory practice exercises",
              "Identify and highlight complex derivations",
            ],
        activeRecallPrompt: isZh
          ? `如果你要向完全零基础的人解释 ${topic.title} 的核心机制，你会怎么讲？`
          : `How would you explain the core mechanism of ${topic.title} to someone with no background?`,
        groundedUserNeed: userNeedStatement,
        ragSource: {
          documentName: `${preferences.subject || "专业课"}-核心讲义.pdf`,
          documentType: "notes",
          sectionTitle: `${topic.title} · 核心要点解析`,
          pageOrChapter: `第${(topicIndex % 5) + 1}章 重点章节`,
          excerptSnippet: isZh
            ? `【讲义重点】${topic.title}在历年考查中占比较高，需重点掌握基本定理的适用前提条件与核心公式的推导边界。`
            : `[Core Notes] Key definitions and theorems for ${topic.title}. Verify assumptions before applying formulas.`,
          keyConcepts: [topic.title, "核心定义", "公式推导", "适用边界"],
          relevanceReason: isZh ? "命中了考纲核心理论知识点" : "Matched core syllabus theory unit",
        },
        formulaOrRules: isZh
          ? [`${topic.title} 核心控制方程/公式定义`, `边界条件: x > 0 且 满足连续性假设`]
          : [`Governing equation for ${topic.title}`, `Boundary condition: x > 0`],
      });
      totalHours += Math.round(sessionDuration / 60);

      if (sched.availableHours >= 2) {
        tasks.push({
          id: `task-${dateStr}-${randSalt}-2`,
          title: isZh ? `真题专项演练与题型攻坚：${topic.title}` : `Active Recall & Problem Drills: ${topic.title}`,
          description: isZh
            ? `针对 ${topic.title} 进行历年真题与综合应用大题专项演练，结合讲义易错陷阱进行实战突破。`
            : `Work through step-by-step problem sets and practice scenarios for ${topic.title}.`,
          category: "practice_problems",
          topicTitle: topic.title,
          date: dateStr,
          startTime: `${String(startH + 1).padStart(2, "0")}:15`,
          endTime: `${String(startH + 2).padStart(2, "0")}:00`,
          durationMinutes: sessionDuration,
          priority: isWeak ? "high" : "medium",
          status: "pending",
          keyObjectives: isZh
            ? [
                "在不查阅答案解析的前提下独立完成题目推导",
                "对账解析，标记失分步骤并记录解题技巧",
                "将典型例题与易错陷阱收录至提纲",
              ]
            : [
                "Attempt problems without looking at solution manuals first",
                "Verify answers and document missed steps",
                "Refine cheat sheet summary",
              ],
          activeRecallPrompt: isZh
            ? `在做 ${topic.title} 相关题目时，最容易踩坑的边界条件或易错点是什么？`
            : `What are the common edge cases or algebraic traps in ${topic.title}?`,
          groundedUserNeed: isZh ? "根据用户题型偏好与真题演练需求分配" : "Allocated based on user practice preference",
          ragSource: {
            documentName: `历年期末真题及解析汇编.pdf`,
            documentType: "past_exam",
            sectionTitle: `${topic.title} - 计算与综合应用大题`,
            pageOrChapter: `真题试卷 第${(topicIndex % 4) + 1}题`,
            excerptSnippet: isZh
              ? `【历年真题例题】已知系统处于稳态，求关于${topic.title}的响应参数与最优极值解。注意避免在中间步骤舍入误差。`
              : `[Past Exam Drill] Calculate response parameters for ${topic.title} under steady state. Avoid early rounding.`,
            keyConcepts: [topic.title, "综合大题", "避坑技巧", "计算规范"],
            relevanceReason: isZh ? "命中了往年期末计算大题与典型陷阱" : "Matched past exam multi-step problem",
          },
          practiceQuestionRef: isZh ? `《历年真题卷》综合计算题 第 ${(topicIndex % 5) + 3} 题` : `Past Exam Problem Set #4`,
        });
        totalHours += Math.round(sessionDuration / 60);
      }
    }
  }

  return {
    phases,
    tasks,
    totalPlannedHours: Math.max(12, totalHours),
  };
}

function fallbackRebalancePlan(currentPlan: any, currentDate: string, reason: string) {
  const isZh = isChinese(currentPlan?.examName) || isChinese(currentPlan?.subject) || true;
  const today = currentDate || new Date().toISOString().split("T")[0];
  const examDate = currentPlan.examDate;

  const completedTasks = currentPlan.tasks.filter((t: any) => t.status === "completed");
  const pendingTasks = currentPlan.tasks.filter((t: any) => t.status !== "completed");

  const startD = new Date(today);
  const endD = new Date(examDate);
  const remainingDays = Math.max(1, Math.ceil((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)));

  const updatedPending = pendingTasks.map((task: any, idx: number) => {
    const dayOffset = idx % remainingDays;
    const targetDate = new Date(startD.getTime() + dayOffset * 86400000).toISOString().split("T")[0];
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

function fallbackGenerateQuiz(topicTitle: string, taskTitle: string, lang: string = "zh") {
  const isZh = lang === "zh" || isChinese(topicTitle) || isChinese(taskTitle) || true;
  if (isZh) {
    return {
      questions: [
        {
          id: `q-${Date.now()}-1`,
          question: `在复习掌握「${topicTitle || "当前考点"}」时，最根本的学习目标是什么？`,
          options: [
            "深刻理解底层概念定义、理论机制与推导逻辑",
            "仅死记硬背表面结论，不关注推导过程",
            "直接跳过题目条件快速猜测最终答案",
            "只在考前粗略浏览章节小结",
          ],
          correctAnswer: "深刻理解底层概念定义、理论机制与推导逻辑",
          explanation: "只有透彻理解核心原理与推导逻辑，才能在面对灵活多变的应用题与综合大题时自如应对。",
          topicTitle: topicTitle || "核心考点",
        },
        {
          id: `q-${Date.now()}-2`,
          question: `针对「${topicTitle || "当前考点"}」的典型复杂题目，最科学的解题步骤是什么？`,
          options: [
            "跳过审题直接套用固定数值公式",
            "拆解题设已知条件与未知量，分步列出控制方程与定理",
            "遇到计算量大的步骤直接放弃",
            "不检查边界条件直接下结论",
          ],
          correctAnswer: "拆解题设已知条件与未知量，分步列出控制方程与定理",
          explanation: "系统化的审题拆解和严谨的分步推导能够避免粗心失误，确保解题逻辑完整无遗漏。",
          topicTitle: topicTitle || "核心考点",
        },
        {
          id: `q-${Date.now()}-3`,
          question: `为了避免遗忘曲线对「${topicTitle || "关键知识点"}」的影响，以下哪种主动回忆方法最为高效？`,
          options: [
            "被动机械地反复默读同一段课本内容",
            "合上书本尝试向他人复述该知识点核心脉络，并自我检验错漏",
            "用不同荧光笔在教材上大面积划线",
            "只在临考前一小时突击扫视笔记",
          ],
          correctAnswer: "合上书本尝试向他人复述该知识点核心脉络，并自我检验错漏",
          explanation: "费曼学习法与主动检索练习（Active Retrieval）能有效激活深度记忆突触，精准暴露知识盲区。",
          topicTitle: topicTitle || "核心考点",
        },
      ],
    };
  }

  return {
    questions: [
      {
        id: `q-${Date.now()}-1`,
        question: `What is the primary objective when mastering ${topicTitle || "this topic"}?`,
        options: [
          "Understanding foundational principles and theoretical derivations",
          "Memorizing surface keywords without understanding mechanics",
          "Skipping straight to final answers without checking assumptions",
          "Only reviewing high-level chapter summaries",
        ],
        correctAnswer: "Understanding foundational principles and theoretical derivations",
        explanation: "Mastery requires deep conceptual comprehension so principles can be adapted to novel exam scenarios.",
        topicTitle: topicTitle || "Core Curriculum",
      },
      {
        id: `q-${Date.now()}-2`,
        question: `When tackling complex multi-step problems in ${topicTitle || "this area"}, what is the most effective approach?`,
        options: [
          "Guessing the intermediate values",
          "Decomposing the problem into sub-steps and stating known constraints",
          "Assuming boundary conditions never apply",
          "Working backwards only when an error occurs",
        ],
        correctAnswer: "Decomposing the problem into sub-steps and stating known constraints",
        explanation: "Systematic decomposition ensures all constraints and governing formulas are applied correctly.",
        topicTitle: topicTitle || "Core Curriculum",
      },
      {
        id: `q-${Date.now()}-3`,
        question: `How can active recall be best utilized for retaining ${topicTitle || "key formulas and definitions"}?`,
        options: [
          "Passively re-reading notes several times in a row",
          "Self-testing without looking at notes and explaining the concept aloud",
          "Highlighting lines with different colors",
          "Reviewing only immediately before the exam starts",
        ],
        correctAnswer: "Self-testing without looking at notes and explaining the concept aloud",
        explanation: "Retrieval practice strengthens synaptic pathways and reveals knowledge gaps far better than passive reading.",
        topicTitle: topicTitle || "Core Curriculum",
      },
    ],
  };
}

async function parseUploadedDocument(
  fileName: string,
  fileType: string,
  base64Data: string,
  language: string = "zh"
): Promise<{ text: string; pageCount?: number }> {
  const isZh = language === "zh" || isChinese(fileName);
  const buffer = Buffer.from(base64Data.replace(/^data:.*?;base64,/, ""), "base64");
  const ext = path.extname(fileName).toLowerCase();

  if (
    fileType.startsWith("text/") ||
    [".txt", ".md", ".markdown", ".json", ".csv", ".rtf"].includes(ext)
  ) {
    try {
      const text = buffer.toString("utf-8");
      if (text.trim().length > 0) {
        return { text };
      }
    } catch (e) {
      console.warn("UTF-8 decode failed, falling back to parser", e);
    }
  }

  if (ext === ".docx" || fileType.includes("wordprocessingml")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 10) {
        return { text: result.value.trim() };
      }
    } catch (e) {
      console.warn("Mammoth DOCX parsing failed", e);
    }
  }

  if (ext === ".pdf" || fileType === "application/pdf") {
    try {
      if (typeof pdfParse === "function") {
        const data = await (pdfParse as any)(buffer);
        if (data && data.text && data.text.trim().length > 20) {
          return {
            text: data.text.trim(),
            pageCount: data.numpages,
          };
        }
      } else {
        const { PDFParse } = pdfParseModule as any;
        if (PDFParse) {
          const parser = new PDFParse({ data: buffer });
          const textResult = await parser.getText();
          const text = typeof textResult === "string" ? textResult : (textResult?.text || "");
          let pageCount = undefined;
          try {
            const info = await parser.getInfo();
            pageCount = info?.pages || info?.numPages || info?.pageCount;
          } catch (e) {}
          try {
            await parser.destroy?.();
          } catch (e) {}

          if (text && text.trim().length > 20) {
            return {
              text: text.trim(),
              pageCount,
            };
          }
        }
      }
    } catch (e) {
      console.warn("Local PDF text extraction error", e);
    }
  }

  // DeepSeek 对话接口为纯文本，不支持图片/PDF 多模态。本地解析失败时：
  // 若能读出可读文本则返回，否则给出明确提示，而不是把乱码当解析结果。
  try {
    const rawText = buffer.toString("utf-8");
    const printable = (rawText.match(/[\x20-\x7E\u4e00-\u9fa5\n\r\t]/g) || []).length;
    const ratio = rawText.length > 0 ? printable / rawText.length : 0;
    if (ratio > 0.6) {
      return { text: rawText.trim() };
    }
  } catch (e) {
    console.warn("UTF-8 decode failed for binary buffer", e);
  }
  return {
    text: `[未能自动提取 ${fileName} 的文本内容。当前 AI（DeepSeek）不支持直接解析图片/扫描 PDF，请在输入框中粘贴文本，或上传可解析的纯文本/Word/文字型 PDF。]`,
  };
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/parse-document", async (req, res) => {
  try {
    const { fileName, fileType, base64Data, language } = req.body;
    if (!base64Data || !fileName) {
      return res.status(400).json({ error: "Missing file data" });
    }

    const parsed = await parseUploadedDocument(
      fileName,
      fileType || "application/pdf",
      base64Data,
      language || "zh"
    );

    res.json({
      success: true,
      fileName,
      text: parsed.text,
      pageCount: parsed.pageCount,
      length: parsed.text.length,
    });
  } catch (err: any) {
    console.error("Error in /api/parse-document:", err);
    res.status(500).json({ error: err.message || "Failed to parse document" });
  }
});

app.post("/api/extract-syllabus", aiLimiter, async (req, res) => {
  try {
    const { materials, examName, subject } = req.body;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: "No materials provided" });
    }

    // —— 章节框架优先：不再全量塞 + slice(0,50000) 截断，而是按"目录骨架 + 各资料开头/中段/结尾采样"，
    //    避免长教材后半章节被丢弃。返回 topics 结构保持不变。——
    const allExtractChunks = chunkAllMaterials(materials);
    const chunksByName = new Map<string, DocumentChunk[]>();
    for (const c of allExtractChunks) {
      if (!chunksByName.has(c.materialName)) chunksByName.set(c.materialName, []);
      chunksByName.get(c.materialName)!.push(c);
    }
    const skeletonLines: string[] = [];
    const sampleBlocks: string[] = [];
    for (const m of materials) {
      const chunks = chunksByName.get(m.name) || [];
      if (chunks.length === 0) {
        const raw = (m.content || "").slice(0, 1500);
        if (raw.trim()) sampleBlocks.push(`[资料《${m.name}》(${m.type})]\n${raw}`);
        continue;
      }
      const headings = Array.from(new Set(chunks.map((c) => c.sectionTitle))).slice(0, 30);
      skeletonLines.push(`【${m.name} · ${m.type}】章节：` + headings.map((h) => `「${h}」`).join("、"));
      const pick = (frac: number) => chunks[Math.min(chunks.length - 1, Math.floor(frac * Math.max(0, chunks.length - 1)))];
      const picked = [pick(0), pick(0.5), pick(1)].filter(Boolean);
      const uniq: DocumentChunk[] = [];
      for (const p of picked) if (!uniq.find((u) => u.id === p.id)) uniq.push(p);
      uniq.forEach((c, i) => {
        sampleBlocks.push(`[片段 ${i + 1} · 《${c.materialName}》(${c.materialType}) · 章节「${c.sectionTitle}」]\n${c.content.slice(0, 1100)}`);
      });
    }
    const skeletonText = skeletonLines.join("\n") || "（未能识别到明确章节标题，请根据下方片段自行梳理章节结构）";
    let samplesText = sampleBlocks.join("\n\n");
    if (samplesText.length > 14000) samplesText = samplesText.slice(0, 14000);

    const isZh = req.body.language === "zh" || isChinese(examName) || isChinese(subject) || true;
    const prompt = `You are an expert academic curriculum analyzer, knowledge tree architect, and exam preparation strategist.
Analyze the following exam study materials for the exam "${examName || 'Upcoming Exam'}" in subject "${subject || 'General'}".
Extract a deep, multi-tier hierarchical syllabus tree (考点树状图体系).

TREE HIERARCHY RULES:
1. ROOT NODES (Major Units / 核心大单元): Group content into 4-7 cohesive units or chapters (e.g. "第1单元：...", "第2单元：...").
2. BRANCH NODES (Granular Subtopics / 细分考点): Under EACH major unit, extract 3-6 concrete, highly granular sub-topics / problem types (e.g., "1.1 动态规划最优子结构与状态定义", "1.2 背包问题变式与空间压缩").
3. LEAF NODES (Key Points & Traps / 核心要点与避坑点): For each subtopic, extract 2-4 specific testable points, governing formulas/theorems, score-earning checkpoints, and common pitfalls.
4. Ensure comprehensive exam weight distribution (weights summing to roughly 100%) and realistic estimated study hours.
${isZh ? "CRITICAL: Output ALL titles, descriptions, subtopic titles, key points, and formula notes in natural, academic Simplified Chinese (简体中文)." : ""}

CHAPTER FRAMEWORK (extracted TOC from the student's uploaded materials — build the tree STRICTLY along these chapters):
${skeletonText}

REPRESENTATIVE EXCERPTS (sampled from the START / MIDDLE / END of each material, so later chapters are not missed — use these to infer sub-points under each chapter):
${samplesText || "（无可读文本片段）"}

IMPORTANT: Do NOT invent chapters that do not appear in the framework/excerpts. Every major unit must correspond to a chapter actually present in the student's materials.

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
  - estimatedHours: realistic hours needed (e.g. 4 to 15)

Respond with ONLY valid JSON. Do not include markdown code fences or any text outside the JSON object.`;

    const { data, aiGenerated } = await generateWithRetryAndFallback(
      () => ({
        system: "You are an expert academic curriculum analyzer. Always respond with only valid JSON.",
        user: prompt,
      }),
      (text) => {
        const parsed = safeParseJSON(text);
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
      () => fallbackExtractSyllabus(materials, examName, subject, isZh ? "zh" : "en"),
      { json: true }
    );

    res.json({ ...data, aiGenerated });
  } catch (error: any) {
    console.error("Error extracting syllabus:", error);

    const isZh = isChinese(req.body?.examName) || isChinese(req.body?.subject) || true;
    const fallback = fallbackExtractSyllabus(req.body.materials || [], req.body.examName, req.body.subject, isZh ? "zh" : "en");
    res.json({ ...fallback, aiGenerated: false });
  }
});

app.post("/api/generate-plan", aiLimiter, async (req, res) => {
  try {
    const { topics, preferences, materials, materialsSummary } = req.body;

    if (!preferences || !preferences.examDate || !preferences.startDate) {
      return res.status(400).json({ error: "Missing required preferences (examDate, startDate)" });
    }

    const isZh = preferences.language === "zh" || isChinese(preferences.examName) || isChinese(preferences.subject) || true;

    const allChunks = chunkAllMaterials(materials || []);

    const ragContextBlocks: string[] = [];
    const focusQuery = `${preferences.userNeedFocusArea || ""} ${preferences.customPromptRequirement || ""} ${preferences.weakTopicsFocus?.join(" ") || ""}`.trim();

    if (focusQuery && allChunks.length > 0) {
      const topFocusChunks = retrieveTopChunksForQuery(focusQuery, allChunks, { topK: 5 });
      topFocusChunks.forEach((c, idx) => {
        ragContextBlocks.push(`[RAG-CHUNK-FOCUS-${idx + 1}] Source: "${c.materialName}" (${c.materialType}) Section: "${c.sectionTitle}"\nContent Excerpt:\n${c.content.slice(0, 600)}`);
      });
    }

    (topics || []).slice(0, 8).forEach((t: any, idx: number) => {
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

    const prompt = `You are a master learning scientist and RAG study schedule architect.
Create a realistic, scientifically optimized day-by-day exam study plan strictly grounded in the student's uploaded materials and personal needs.
${isZh ? "CRITICAL: All generated phase names, phase descriptions, task titles, descriptions, key objectives, active recall prompts, and ragSource citations MUST be written in natural, idiomatic Simplified Chinese (简体中文)." : ""}

STUDENT PROFILE & PERSONALIZED STUDY NEEDS:
- Exam Name: ${preferences.examName || "Final Exam"}
- Subject: ${preferences.subject || "Academic"}
- Start Date: ${preferences.startDate}
- Exam Date: ${preferences.examDate} (Exam Time: ${preferences.examTime || "09:00"})
- Target Score / Goal: ${preferences.targetScoreOrGrade || "Top Grade"}
- User Focus Priority: ${preferences.userNeedFocusArea || "comprehensive"} (e.g. heavy_calculation, concepts_and_theory, past_exam_drills, rush_sprint)
- Custom Student Directives: ${preferences.customPromptRequirement || preferences.additionalNotes || "None"}
- Study Pace Archetype: ${preferences.studyPace}
- Preferred Session Duration: ${preferences.sessionLengthMinutes} minutes per block
- Include Practice Exams: ${preferences.includePracticeExams ? "Yes" : "No"}
- Include Buffer/Review Days: ${preferences.includeBufferDays ? `Yes (${preferences.bufferDaysCount} days)` : "No"}
- Priority Weak Topics: ${preferences.weakTopicsFocus?.join(", ") || "None specified"}
- Daily Available Study Hours:
${preferences.dailySchedules?.map((d: any) => `  * ${d.dayName}: ${d.enabled ? `${d.availableHours}h (${d.preferredTimeSlot})` : "Rest / Off"}`).join("\n")}

SYLLABUS TOPICS:
${JSON.stringify(topics || [], null, 2)}
${ragContextText}

RAG GROUNDING REQUIREMENTS:
1. Schedule tasks strictly between ${preferences.startDate} and ${preferences.examDate}, respecting the daily available hours.
2. Group timeline into 3-4 distinct study phases (e.g. ${isZh ? "第1阶段：考纲精读与概念夯实, 第2阶段：专题大题精练与难点攻坚, 第3阶段：主动回忆与全真模考冲刺, 第4阶段：考前速记与查漏补缺" : "Phase 1: Foundation, Phase 2: Problem Solving, Phase 3: Mocks, Phase 4: Final Review"}).
3. For EVERY study task, ground it directly in the uploaded documents:
   - title: concise, highly actionable (${isZh ? "例如：'讲义精读：第3章 动态规划状态转移方程推导', '真题演练：2024期末第4题 二叉树递归大题'" : "e.g., 'Active Reading: Chapter 3 Dynamic Programming Equations'"})
   - description: clear step-by-step guidance on what to achieve
   - category: ["theory", "reading", "practice_problems", "active_recall", "flashcards", "mock_exam", "review_weak_spots", "summary_cheat_sheet"]
   - topicTitle: associated syllabus topic
   - date: "YYYY-MM-DD"
   - startTime / endTime / durationMinutes
   - priority: "high" | "medium" | "low"
   - status: "pending"
   - keyObjectives: array of 2-3 specific mastery checkpoints
   - activeRecallPrompt: self-testing question based on the document concepts
   - groundedUserNeed: explain which student requirement this task satisfies (e.g. "${isZh ? "针对【计算大题攻坚】需求，深度强化公式推导与实战" : "Targets high-yield calculation need"}")
   - formulaOrRules: 1-2 key formulas or governing equations extracted from the material
   - ragSource:
     - documentName: name of the source material
     - documentType: "syllabus" | "notes" | "past_exam" | "lecture_slides"
     - sectionTitle: specific section or heading
     - pageOrChapter: e.g. "第 2 章", "真题大题第3题"
     - excerptSnippet: quote or direct summary from the document (50-150 chars)
     - keyConcepts: array of 2-4 keywords
     - relevanceReason: why this document chunk was chosen for this task

Respond with ONLY valid JSON. Do not include markdown code fences or any text outside the JSON object.`;

    const { data: rawResult, aiGenerated } = await generateWithRetryAndFallback(
      () => ({
        system: "You are a master learning scientist and study schedule architect. Always respond with only valid JSON.",
        user: prompt,
      }),
      (text) => safeParseJSON(text),
      () => fallbackGeneratePlan(topics, preferences),
      { json: true }
    );

    // Schedule Engine: 补齐所有日历日的任务（已有的 AI 任务原样保留，不覆盖）
    const pastExams = (materials || []).filter((m: any) => m.type === "past_exam");
    const enrichedTasks = allocateTasksAcrossAllCalendarDays(
      rawResult.tasks || [],
      topics || [],
      preferences,
      isZh,
      allChunks,
      pastExams
    );

    const totalCalculatedHours = Math.round(
      enrichedTasks.reduce((sum: number, t: any) => sum + (t.durationMinutes || 60), 0) / 60
    );

    const sanitizedResult = {
      ...rawResult,
      tasks: enrichedTasks,
      totalPlannedHours: totalCalculatedHours || rawResult.totalPlannedHours || 25,
    };

    res.json({ ...sanitizedResult, aiGenerated });
  } catch (error: any) {
    console.error("Error generating study plan:", error);
    const fallback = fallbackGeneratePlan(req.body.topics || [], req.body.preferences || {});
    res.json(fallback);
  }
});

function allocateTasksAcrossAllCalendarDays(
  existingTasks: any[],
  topics: any[],
  preferences: any,
  isZh: boolean,
  allChunks: DocumentChunk[] = [],
  pastExams: any[] = []
): any[] {
  const start = new Date(preferences.startDate || new Date().toISOString().split("T")[0]);
  const exam = new Date(preferences.examDate || new Date(start.getTime() + 86400000 * 21).toISOString().split("T")[0]);
  const diffDays = Math.max(1, Math.ceil((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const safeTopics = topics && topics.length > 0
    ? topics
    : [
        { id: "top-1", title: isZh ? "核心基础概念与基本定理" : "Core Concepts & Fundamentals", difficulty: "medium", estimatedHours: 8 },
        { id: "top-2", title: isZh ? "重点计算大题与综合推导" : "Complex Calculations & Problem Sets", difficulty: "hard", estimatedHours: 12 },
        { id: "top-3", title: isZh ? "历年高频真题与典型题型" : "High-Yield Past Exam Questions", difficulty: "hard", estimatedHours: 10 },
        { id: "top-4", title: isZh ? "易混淆考点辨析与查漏补缺" : "Edge Cases & Final Review", difficulty: "easy", estimatedHours: 6 },
      ];

  const tasksByDate = new Map<string, any[]>();
  (existingTasks || []).forEach((t) => {
    if (t.date) {
      if (!tasksByDate.has(t.date)) {
        tasksByDate.set(t.date, []);
      }
      tasksByDate.get(t.date)!.push(t);
    }
  });

  const finalTasks: any[] = [];
  const maxDays = diffDays;

  // —— 把用户实际上传的真题卷子，均匀铺到后段模考日上（点名具体哪一份，而非泛泛"仿真卷"）——
  const mockOffsets: number[] = [];
  for (let d = 0; d < maxDays; d++) {
    const ratio = d / maxDays;
    if (ratio >= 0.70 && ratio < 0.90 && d % 3 === 0) mockOffsets.push(d);
  }
  const paperByOffset = new Map<number, { name: string; ordinal: number; total: number }>();
  const P = pastExams.length;
  if (P > 0 && mockOffsets.length > 0) {
    for (let p = 0; p < P; p++) {
      const slot = P === 1
        ? Math.floor(mockOffsets.length / 2)
        : Math.round((p / (P - 1)) * (mockOffsets.length - 1));
      const off = mockOffsets[Math.max(0, Math.min(mockOffsets.length - 1, slot))];
      const nm = String(pastExams[p].name || `真题卷${p + 1}`).replace(/\.[^/.]+$/, "");
      paperByOffset.set(off, { name: nm, ordinal: p + 1, total: P });
    }
  }

  for (let dayOffset = 0; dayOffset < maxDays; dayOffset++) {
    const curDate = new Date(start.getTime() + dayOffset * 86400000);
    const dateStr = formatDate(curDate);
    const dayOfWeek = curDate.getDay();
    const scheduleConfig = preferences.dailySchedules?.find((s: any) => s.dayOfWeek === dayOfWeek);

    // If day is disabled in user preferences, skip or keep existing
    if (scheduleConfig && !scheduleConfig.enabled) {
      if (tasksByDate.has(dateStr)) {
        finalTasks.push(...tasksByDate.get(dateStr)!);
      }
      continue;
    }

    const currentDayTasks = tasksByDate.get(dateStr) || [];

    if (currentDayTasks.length > 0) {
      // 已有的（多为 AI 生成的）任务：原样保留，只补缺失的 id 与状态，不覆盖/不重置时间
      currentDayTasks.forEach((t, idx) => {
        finalTasks.push({
          ...t,
          id: t.id || `task-${dateStr}-${idx}`,
          date: dateStr,
          status: t.status || "pending",
        });
      });
    } else {
      // Intelligently generate 1-2 tasks for this active calendar day
      const progressRatio = dayOffset / maxDays;
      let phaseCategory: string = "theory";
      let taskTypeLabel = isZh ? "考点研读" : "Deep Reading";

      if (progressRatio < 0.35) {
        phaseCategory = dayOffset % 2 === 0 ? "reading" : "theory";
        taskTypeLabel = isZh ? "考点研读" : "Concept Reading";
      } else if (progressRatio < 0.70) {
        phaseCategory = "practice_problems";
        taskTypeLabel = isZh ? "专题精练" : "Problem Drill";
      } else if (progressRatio < 0.90) {
        phaseCategory = (dayOffset % 3 === 0) ? "mock_exam" : "active_recall";
        taskTypeLabel = phaseCategory === "mock_exam" ? (isZh ? "全真模考" : "Timed Mock") : (isZh ? "主动回忆" : "Active Recall");
      } else {
        phaseCategory = "summary_cheat_sheet";
        taskTypeLabel = isZh ? "考前速记" : "Cheat Sheet";
      }

      const topic = safeTopics[dayOffset % safeTopics.length];
      const isMock = phaseCategory === "mock_exam";
      const salt = "gen"; // 确定性 id，便于回归测试

      // 这一天对应的真实真题卷子（若用户上传过 past_exam）
      const paperInfo = paperByOffset.get(dayOffset);
      // 从用户实际上传资料里检索与本主题相关的真实片段，避免凭空捏造来源
      const anchorChunk = allChunks.length
        ? retrieveTopChunksForQuery(`${topic.title} ${(topic.subtopics || []).join(" ")}`, allChunks, { topK: 1 })[0]
        : undefined;

      const title = isZh
        ? isMock
          ? (paperInfo
              ? `全真模考：《${paperInfo.name}》（第${paperInfo.ordinal}次模考 / 共${paperInfo.total}份真题，严格计时）`
              : `全真模考：${preferences.examName} 仿真模拟卷自测`)
          : phaseCategory === "practice_problems"
          ? `专题精炼：${topic.title} 典型高频大题攻坚`
          : phaseCategory === "active_recall"
          ? `主动回忆：${topic.title} 核心定理与框架复盘`
          : phaseCategory === "summary_cheat_sheet"
          ? `考前急救：${topic.title} 易混淆考点与公式速查`
          : `考点研读：${topic.title} 概念精讲与逻辑梳理`
        : isMock
        ? (paperInfo
            ? `Timed Mock: ${paperInfo.name} (Paper ${paperInfo.ordinal} of ${paperInfo.total}, timed)`
            : `Timed Mock: ${preferences.examName} Practice Exam`)
        : phaseCategory === "practice_problems"
        ? `Practice Drill: ${topic.title} Problem Solving`
        : phaseCategory === "active_recall"
        ? `Active Recall: ${topic.title} Key Formulations`
        : phaseCategory === "summary_cheat_sheet"
        ? `High-Yield Review: ${topic.title} Formula Sheet`
        : `Deep Study: ${topic.title} Fundamentals`;

      const startTime = scheduleConfig?.preferredTimeSlot === "morning"
        ? "09:00"
        : scheduleConfig?.preferredTimeSlot === "afternoon"
        ? "14:30"
        : "19:00";
      const endTime = scheduleConfig?.preferredTimeSlot === "morning"
        ? "10:30"
        : scheduleConfig?.preferredTimeSlot === "afternoon"
        ? "16:00"
        : "20:30";

      finalTasks.push({
        id: `task-${dateStr}-${salt}-1`,
        title,
        description: isZh
          ? `在 ${dateStr} 针对【${topic.title}】执行每日专注复习，吃透考点并完成课后自测。`
          : `Scheduled daily focus session for ${topic.title}. Master core requirements and self-test.`,
        category: phaseCategory,
        topicTitle: topic.title,
        date: dateStr,
        startTime,
        endTime,
        durationMinutes: isMock ? 90 : preferences.sessionLengthMinutes || 60,
        priority: isMock || topic.difficulty === "hard" ? "high" : "medium",
        status: "pending",
        keyObjectives: isZh
          ? [
              `深入掌握【${topic.title}】核心定理、性质与适用边界`,
              `完成对应的典型习题演练，记录错因与易混淆细节`,
              `通过主动回忆自测回答关键公式与解题步骤`
            ]
          : [
              `Master core principles of ${topic.title}`,
              `Solve high-yield problems and log edge cases`,
              `Verify retention with active recall prompt`
            ],
        activeRecallPrompt: isZh
          ? `不看资料，尝试默写「${topic.title}」的核心推导步骤或解题模板。`
          : `Without looking at notes, outline the key problem-solving steps for ${topic.title}.`,
        groundedUserNeed: isZh
          ? `匹配【${preferences.targetScoreOrGrade || "高分通关"}】目标，根据日历科学排定任务`
          : `Scheduled to achieve ${preferences.targetScoreOrGrade || "Target Score"}`,
        ragSource: {
          documentName: anchorChunk?.materialName || `${preferences.subject || "专业课"}-核心讲义与真题.pdf`,
          documentType: anchorChunk?.materialType || (isMock ? "past_exam" : "notes"),
          sectionTitle: anchorChunk?.sectionTitle || `${topic.title} · 重点考点`,
          pageOrChapter: anchorChunk ? `《${anchorChunk.materialName}》` : `第 ${(dayOffset % 5) + 1} 单元`,
          excerptSnippet: anchorChunk
            ? anchorChunk.content.slice(0, 120)
            : isZh
            ? `【讲义重点】本节重点考核「${topic.title}」的定理推导与典型题型解法，需严格掌握解题步骤与边界约束。`
            : `[Core Notes] Key principles for ${topic.title}. Verify boundary conditions before applying formulas.`,
          keyConcepts: anchorChunk?.keywords?.length
            ? anchorChunk.keywords.slice(0, 4)
            : [topic.title, "核心定义", "题型模板", "避坑指南"],
          relevanceReason: anchorChunk
            ? `从你上传的《${anchorChunk.materialName}》中检索到的相关章节`
            : isZh ? "命中了考纲核心考点与历年真题" : "Matched core syllabus topic",
        },
        formulaOrRules: isZh
          ? [`${topic.title} 核心控制方程与计算准则`, `边界约束: 变量取值区间需满足定理定义域`]
          : [`Governing equations for ${topic.title}`, `Boundary conditions verified`],
        practiceQuestionRef: isMock
          ? (paperInfo ? `《${paperInfo.name}》全卷（第${paperInfo.ordinal}/${paperInfo.total}次模考）` : `《历年真题期末卷》全套`)
          : (paperInfo ? `《${paperInfo.name}》相关章节大题精练` : `《期末习题精选》第 ${(dayOffset % 4) + 1} 题`),
      });
    }
  }

  return finalTasks;
}

app.post("/api/rag-ask", aiLimiter, async (req, res) => {
  try {
    const { query, topicTitle, taskTitle, materials } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Missing query parameter" });
    }

    const allChunks = chunkAllMaterials(materials || []);
    const searchQuery = `${query} ${topicTitle || ""} ${taskTitle || ""}`.trim();
    const retrievedChunks = retrieveTopChunksForQuery(searchQuery, allChunks, { topK: 5 });

    const contextText = retrievedChunks.length > 0
      ? retrievedChunks.map((c, i) => `[Source ${i + 1}: ${c.materialName} - ${c.sectionTitle}]\n${c.content}`).join("\n\n")
      : "No direct matching document chunks found in uploaded materials.";

    const prompt = `You are an AI Academic Tutor answering a student's question based strictly on their uploaded study materials.
Student Question: "${query}"
Context / Task: Topic: "${topicTitle || 'General'}", Task: "${taskTitle || ''}"

Retrieved Document Excerpts:
${contextText}

Instructions:
1. Provide a direct, authoritative, and helpful answer grounded in the excerpts.
2. Explicitly cite the document names and section titles where the information came from.
3. List 1-2 key formulas, rules, or definitions mentioned in the excerpts.
4. Provide a quick 1-step action the student should take right now to master this concept.
Output your response in Simplified Chinese (简体中文).`;

    const { data: result, aiGenerated } = await generateWithRetryAndFallback(
      () => ({
        system: "You are an AI Academic Tutor. Answer helpfully, ground answers in the cited excerpts, and cite sources.",
        user: prompt,
      }),
      (text) => ({
        answer: text,
        citations: retrievedChunks.map((c) => ({
          documentName: c.materialName,
          sectionTitle: c.sectionTitle,
          excerpt: c.content.slice(0, 180) + "...",
        })),
      }),
      () => ({
        answer: `基于您上传的备考资料，针对「${topicTitle || query}」的解析如下：\n\n1. **核心要点**：根据相关考纲与讲义，此知识点是高频考查单元，重点考查定理适用前提与计算推导。\n2. **解题避坑**：在做题时注意边界条件验证与中间变量舍入。\n3. **即刻行动**：建议立即打开讲义对照公式默写一次，并完成配套例题演练。`,
        citations: retrievedChunks.slice(0, 3).map((c) => ({
          documentName: c.materialName,
          sectionTitle: c.sectionTitle,
          excerpt: c.content.slice(0, 180) + "...",
        })),
      })
    );

    res.json({ ...result, aiGenerated });
  } catch (error: any) {
    console.error("Error in /api/rag-ask:", error);
    res.json({
      answer: "已检索备考资料，建议重点复习该考点的核心公式与典型例题。",
      citations: [],
    });
  }
});

app.post("/api/rebalance-plan", aiLimiter, async (req, res) => {
  try {
    const { currentPlan, currentDate, reason } = req.body;

    if (!currentPlan || !currentPlan.tasks) {
      return res.status(400).json({ error: "Missing current plan data" });
    }

    const todayStr = currentDate || localToday();

    const isZh = req.body.language === "zh" || isChinese(currentPlan.examName) || isChinese(currentPlan.subject) || true;
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
3. Return the complete updated tasks array with updated dates, startTimes, endTimes, and prioritized sequence.

Respond with ONLY valid JSON. Do not include markdown code fences or any text outside the JSON object.`;

    const { data: result, aiGenerated } = await generateWithRetryAndFallback(
      () => ({
        system: "You are an adaptive study coach. Always respond with only valid JSON.",
        user: prompt,
      }),
      (text) => safeParseJSON(text),
      () => fallbackRebalancePlan(currentPlan, todayStr, reason),
      { json: true }
    );

    const sanitized = {
      ...result,
      tasks: (result.tasks || []).map((t: any, idx: number) => {
        const dateStr = t.date || localToday();
        return {
          ...t,
          id: t.id || `task-${dateStr}-${idx}`,
        };
      }),
    };

    res.json({ ...sanitized, aiGenerated });
  } catch (error: any) {
    console.error("Error rebalancing plan:", error);
    const fallback = fallbackRebalancePlan(req.body.currentPlan, req.body.currentDate, req.body.reason);
    res.json(fallback);
  }
});

app.post("/api/generate-quiz", aiLimiter, async (req, res) => {
  try {
    const { topicTitle, taskTitle, keyObjectives, language } = req.body;
    const isZh = language === "zh" || isChinese(topicTitle) || isChinese(taskTitle) || true;

    const prompt = `Generate 3 high-yield active recall questions to test understanding of the following study session:
Topic: ${topicTitle}
Task: ${taskTitle}
Key Objectives: ${Array.isArray(keyObjectives) ? keyObjectives.join(", ") : ""}
${isZh ? "CRITICAL: Output all questions, options, and explanations in Simplified Chinese (简体中文)." : ""}

For each question, provide 4 multiple choice options, the exact correct answer, and a clear educational explanation to reinforce memory.

Respond with ONLY valid JSON. Do not include markdown code fences or any text outside the JSON object.`;

    const { data: result, aiGenerated } = await generateWithRetryAndFallback(
      () => ({
        system: "You are an educational quiz generator. Always respond with only valid JSON.",
        user: prompt,
      }),
      (text) => safeParseJSON(text),
      () => fallbackGenerateQuiz(topicTitle, taskTitle, isZh ? "zh" : "en"),
      { json: true }
    );

    res.json({ ...result, aiGenerated });
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    const fallback = fallbackGenerateQuiz(req.body.topicTitle, req.body.taskTitle);
    res.json(fallback);
  }
});

async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Exam Plan AI Server running on port ${PORT}`);
  });
}

setupViteOrStatic();
