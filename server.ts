import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import * as pdfParseModule from "pdf-parse";
import mammoth from "mammoth";

const pdfParse = (pdfParseModule as any).default || pdfParseModule;

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "25mb" }));

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper for sleep/backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resilient Gemini caller with exponential backoff and model cascade
 */
async function generateWithRetryAndFallback<T>(
  buildParams: (modelName: string) => any,
  parseResult: (text: string) => T,
  fallbackGenerator: () => T
): Promise<T> {
  // Use recommended standard models with priority on gemini-3.7-flash and gemini-3.1-flash-lite
  const models = ["gemini-3.7-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-flash-latest"];

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const params = buildParams(model);
        const response = await ai.models.generateContent(params);
        const text = response.text || "";
        if (!text.trim()) {
          throw new Error("Empty response received from AI model");
        }
        const parsed = parseResult(text);
        return parsed;
      } catch (err: any) {
        const status = err?.status || err?.code || err?.statusCode;
        const msg = String(err?.message || "");
        
        const is503HighDemand =
          status === 503 ||
          msg.includes("503") ||
          msg.includes("high demand") ||
          msg.includes("UNAVAILABLE");

        const isRateLimit =
          status === 429 ||
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED");

        if (attempt === 1 && (is503HighDemand || isRateLimit)) {
          // Quick backoff before retrying once on same model
          await sleep(400);
          continue;
        }

        // If still failing after retry, log and cascade to next model
        break;
      }
    }
  }

  // If all upstream AI models are temporarily unavailable, return algorithmic generation
  return fallbackGenerator();
}

// ---------------- ALGORITHMIC FALLBACKS ----------------

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

  const topicTitlesZh = [
    "基础概念、核心定义与理论体系",
    "核心算法、推导机制与方法论",
    "典型例题精析与高频题型演练",
    "综合应用、复杂综合题与进阶难点",
    "全真模拟、真题回溯与查漏补缺",
  ];

  const topicTitlesEn = [
    "Foundational Principles & Core Definitions",
    "Key Methodologies & Analytical Frameworks",
    "Intermediate Problem Solving & Case Studies",
    "Advanced Theorems, Derivations & Edge Cases",
    "Synthesis, Comprehensive Review & Exam Drills",
  ];

  const topicTitles = foundHeadings.length >= 3
    ? foundHeadings.slice(0, 6).map((h) => h.replace(/^[#*\-•\d\.\s]+/, "").trim())
    : (isZh ? topicTitlesZh : topicTitlesEn);

  const topics = topicTitles.map((title, idx) => {
    const diffs: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard", "hard", "medium"];
    const diff = diffs[idx % diffs.length];
    const weight = Math.round(100 / topicTitles.length);
    return {
      id: `topic-${idx + 1}`,
      title,
      category: subject || (isZh ? "核心大纲" : "Core Curriculum"),
      description: isZh
        ? `深度掌握 ${title}，包括核心概念推导、公式记忆及典型考题应用演练。`
        : `In-depth mastery of ${title}, conceptual derivations, and exam-style application problems.`,
      weightPercentage: weight,
      difficulty: diff,
      userKnowledgeLevel: diff === "hard" ? "beginner" : "intermediate",
      subtopics: isZh
        ? [
            `${title} - 核心定理与关键名词解释`,
            `${title} - 解题规范与标准解题模板`,
            `${title} - 历年高频易错考点与避坑指南`,
          ]
        : [
            `${title} - Fundamental Theorems & Terminology`,
            `${title} - Step-by-Step Problem Solving Method`,
            `${title} - High-Yield Exam Pitfalls & Trap Avoidance`,
          ],
      estimatedHours: diff === "hard" ? 8 : diff === "medium" ? 6 : 4,
    };
  });

  return {
    summary: isZh
      ? `针对 ${examName || "目标考试"}（${subject || "综合"}）的结构化考纲，共拆解为 ${topics.length} 个重点知识模块，已按科学复习梯度完成学时分配与主动回忆规划。`
      : `Structured syllabus for ${examName || "Upcoming Exam"} (${subject || "General"}), organized into ${topics.length} prioritized learning units with calibrated study hours and active recall checkpoints.`,
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

    if (isMockDay) {
      tasks.push({
        id: `task-${dateStr}-mock`,
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
        id: `task-${dateStr}-buffer`,
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
      // Regular study session
      const isWeak = preferences.weakTopicsFocus?.includes(topic.title);
      tasks.push({
        id: `task-${dateStr}-1`,
        title: isZh ? `考点精读与笔记梳理：${topic.title}` : `Active Study & Concept Mapping: ${topic.title}`,
        description: isZh
          ? `精读讲义与教材，梳理 ${topic.title} 的核心定理、定义及逻辑脉络。`
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
      });
      totalHours += Math.round(sessionDuration / 60);

      // Add a practice / active recall task if available hours >= 2
      if (sched.availableHours >= 2) {
        tasks.push({
          id: `task-${dateStr}-2`,
          title: isZh ? `习题专项演练与主动回忆：${topic.title}` : `Active Recall & Problem Drills: ${topic.title}`,
          description: isZh
            ? `针对 ${topic.title} 进行真题与课后综合应用题演练，提升解题熟练度。`
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

// ---------------- DOCUMENT PARSER ENGINE ----------------

// Helper to parse any uploaded file (PDF, Word DOCX, TXT, MD, Images) into clean, human-readable text
async function parseUploadedDocument(
  fileName: string,
  fileType: string,
  base64Data: string,
  language: string = "zh"
): Promise<{ text: string; pageCount?: number }> {
  const isZh = language === "zh" || isChinese(fileName);
  const cleanBase64 = base64Data.replace(/^data:.*?;base64,/, "");
  const buffer = Buffer.from(cleanBase64, "base64");
  const ext = path.extname(fileName).toLowerCase();

  // 1. Plain Text / Markdown / Code / JSON / CSV
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

  // 2. Word DOCX
  if (ext === ".docx" || fileType.includes("wordprocessingml")) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      if (result.value && result.value.trim().length > 10) {
        return { text: result.value.trim() };
      }
    } catch (e) {
      console.warn("Mammoth DOCX parsing failed, escalating to Gemini multimodal parser", e);
    }
  }

  // 3. PDF Parsing with pdf-parse (Fast local extraction)
  if (ext === ".pdf" || fileType === "application/pdf") {
    try {
      const data = await (pdfParse as any)(buffer);
      if (data && data.text && data.text.trim().length > 50) {
        return {
          text: data.text.trim(),
          pageCount: data.numpages,
        };
      }
    } catch (e) {
      console.warn("Local PDF text extraction produced empty text or failed, escalating to Gemini OCR parser", e);
    }
  }

  // 4. Multimodal AI Extraction (For scanned PDFs, image-based slides, photos, or complex layout)
  try {
    const mime = fileType || (ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : "image/jpeg");
    const prompt = isZh
      ? `你是一位专业的高校备考与教辅文档解析专家。请将上传的文档或试卷内容完整、准确、结构化地转录为清晰易读的文本/Markdown格式。
要求：
1. 完整保留所有章节大纲、考点要求、题目序号、核心公式与要点。
2. 保持排版层级清晰，禁止输出不可读的乱码或丢失核心考点。
3. 如果是试卷或习题，请完整保留题目要求与选项。`
      : `You are an expert academic document parsing specialist. Transcribe all text, syllabus outlines, chapters, formulas, and questions from this uploaded document accurately into clean, readable Markdown format. Preserve structural hierarchy and all key concepts verbatim.`;

    const result = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mime.startsWith("image/") || mime === "application/pdf" ? mime : "application/pdf",
            },
          },
          prompt,
        ],
      }),
      (text) => text,
      () => {
        const textFallback = buffer.toString("utf-8").replace(/[^\x20-\x7E\u4e00-\u9fa5\n\r\t]/g, " ");
        return textFallback.trim() || `[已成功上传 ${fileName}，内容已录入]`;
      }
    );

    return { text: result };
  } catch (err) {
    console.error("AI document extraction failed:", err);
    return {
      text: `[已接收 ${fileName} 文件（${Math.round(buffer.length / 1024)} KB）。请继续提取考纲或生成练习题]`,
    };
  }
}

// ---------------- API ENDPOINTS ----------------

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 0. Parse uploaded document (PDF, Word, TXT, Images) into clean text
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

// 1. Extract syllabus & topics from uploaded study materials
app.post("/api/extract-syllabus", async (req, res) => {
  try {
    const { materials, examName, subject } = req.body;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: "No materials provided" });
    }

    const aggregatedContent = materials
      .map((m: any, idx: number) => `--- DOCUMENT ${idx + 1}: ${m.name} (${m.type}) ---\n${m.content}`)
      .join("\n\n");

    const isZh = req.body.language === "zh" || isChinese(examName) || isChinese(subject) || true;
    const prompt = `You are an expert academic curriculum analyzer and exam preparation strategist.
Analyze the following exam study materials for the exam "${examName || 'Upcoming Exam'}" in subject "${subject || 'General'}".
Extract the complete, structured syllabus breakdown with all major topics, chapters, estimated study hours needed, difficulty rating (easy, medium, hard), relative exam weight percentage (must sum to roughly 100%), and concrete subtopics/concepts.
${isZh ? "CRITICAL: Output ALL titles, summaries, descriptions, and subtopics in Simplified Chinese (简体中文)." : ""}

Documents content:
${aggregatedContent.slice(0, 50000)}

Output a clean JSON object containing:
- summary: A concise 2-sentence summary of the syllabus scope and high-yield focus areas.
- topics: An array of syllabus topics, each having:
  - id: unique string (e.g. topic-1, topic-2)
  - title: topic or chapter title
  - category: broad domain or module
  - description: key concepts covered in this topic
  - weightPercentage: estimated weight in exam (number 5 to 40)
  - difficulty: "easy" | "medium" | "hard"
  - userKnowledgeLevel: default to "intermediate" (or "beginner" for hard topics)
  - subtopics: array of specific concept strings
  - estimatedHours: realistic hours needed for first pass + practice (e.g. 3 to 12)`;

    const result = await generateWithRetryAndFallback(
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
      (text) => JSON.parse(text),
      () => fallbackExtractSyllabus(materials, examName, subject, isZh ? "zh" : "en")
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error extracting syllabus:", error);
    // Provide algorithmic response instead of hard 500 error
    const isZh = isChinese(req.body?.examName) || isChinese(req.body?.subject) || true;
    const fallback = fallbackExtractSyllabus(req.body.materials || [], req.body.examName, req.body.subject, isZh ? "zh" : "en");
    res.json(fallback);
  }
});

// 2. Generate comprehensive schedule-aware study plan
app.post("/api/generate-plan", async (req, res) => {
  try {
    const { topics, preferences, materialsSummary } = req.body;

    if (!preferences || !preferences.examDate || !preferences.startDate) {
      return res.status(400).json({ error: "Missing required preferences (examDate, startDate)" });
    }

    const isZh = preferences.language === "zh" || isChinese(preferences.examName) || isChinese(preferences.subject) || true;
    const prompt = `You are a master learning scientist and study schedule architect.
Create a realistic, scientifically optimized day-by-day exam study plan.
${isZh ? "CRITICAL: All generated phase names, phase descriptions, task titles, descriptions, key objectives, and active recall prompts MUST be written in natural, idiomatic Simplified Chinese (简体中文)." : ""}

STUDENT PROFILE & PREFERENCES:
- Exam Name: ${preferences.examName || "Final Exam"}
- Subject: ${preferences.subject || "Academic"}
- Start Date: ${preferences.startDate}
- Exam Date: ${preferences.examDate} (Exam Time: ${preferences.examTime || "09:00"})
- Study Pace Archetype: ${preferences.studyPace} (e.g. balanced, intensive_crash, deep_mastery, spaced_repetition)
- Preferred Session Duration: ${preferences.sessionLengthMinutes} minutes per block
- Include Practice Exams: ${preferences.includePracticeExams ? "Yes" : "No"}
- Include Buffer/Review Days: ${preferences.includeBufferDays ? `Yes (${preferences.bufferDaysCount} days)` : "No"}
- Priority Weak Topics: ${preferences.weakTopicsFocus?.join(", ") || "None specified"}
- Daily Available Study Hours:
${preferences.dailySchedules?.map((d: any) => `  * ${d.dayName}: ${d.enabled ? `${d.availableHours}h (${d.preferredTimeSlot})` : "Rest / Off"}`).join("\n")}
- Additional Student Notes: ${preferences.additionalNotes || "None"}

SYLLABUS TOPICS:
${JSON.stringify(topics || [], null, 2)}

REQUIREMENTS FOR THE PLAN:
1. Schedule tasks strictly between ${preferences.startDate} and ${preferences.examDate}.
2. Group the overall timeline into 3-4 distinct study phases (e.g. ${isZh ? "第 1 阶段：考纲通读与概念夯实, 第 2 阶段：专题精练与典型题攻坚, 第 3 阶段：主动回忆与全真模考冲刺, 第 4 阶段：高频考点速记与考前查漏" : "Phase 1: Foundation & Core Concepts, Phase 2: Deep Dive & Problem Solving, Phase 3: Active Recall & Timed Mocks, Phase 4: High-Yield Final Review"}).
3. Generate individual study tasks for each available study day. Respect the student's daily available hours.
4. Each task must have:
   - id: unique string (e.g., "task-2026-08-17-1")
   - title: concise, actionable action (${isZh ? "例如：'理论精读：第 3 章 动态规划状态转移方程推导', '习题演练：15 道二叉树遍历与递归专项真题'" : "e.g., 'Active Reading: Chapter 3 Reaction Kinetics', 'Practice Problems: 15 Multi-step Thermodynamics Exercises'"})
   - description: clear step-by-step guidance on what to achieve in this session
   - category: one of ["theory", "reading", "practice_problems", "active_recall", "flashcards", "mock_exam", "review_weak_spots", "summary_cheat_sheet"]
   - topicTitle: associated syllabus topic
   - date: exact date in "YYYY-MM-DD" format
   - startTime: suggested start time "HH:MM" (e.g. "09:00", "14:00", "19:00")
   - endTime: suggested end time "HH:MM"
   - durationMinutes: realistic minutes (e.g., 25, 45, 60, 90, 120)
   - priority: "high" | "medium" | "low"
   - status: "pending"
   - keyObjectives: array of 2-3 specific mastery bullet points to tick off
   - activeRecallPrompt: a self-testing question the student must be able to answer after finishing the task.
5. If includePracticeExams is true, schedule full timed mock exams at strategic milestones (e.g., halfway through and 3-5 days before exam).
6. Prioritize weak topics with extra review blocks.`;

    const result = await generateWithRetryAndFallback(
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
      () => fallbackGeneratePlan(topics, preferences)
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error generating study plan:", error);
    const fallback = fallbackGeneratePlan(req.body.topics || [], req.body.preferences || {});
    res.json(fallback);
  }
});

// 3. Real-time Adaptive Plan Rebalancer
app.post("/api/rebalance-plan", async (req, res) => {
  try {
    const { currentPlan, currentDate, reason } = req.body;

    if (!currentPlan || !currentPlan.tasks) {
      return res.status(400).json({ error: "Missing current plan data" });
    }

    const todayStr = currentDate || new Date().toISOString().split("T")[0];

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
3. Return the complete updated tasks array with updated dates, startTimes, endTimes, and prioritized sequence.`;

    const result = await generateWithRetryAndFallback(
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
      () => fallbackRebalancePlan(currentPlan, todayStr, reason)
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error rebalancing plan:", error);
    const fallback = fallbackRebalancePlan(req.body.currentPlan, req.body.currentDate, req.body.reason);
    res.json(fallback);
  }
});

// 4. Quick Active Recall Quiz generation for a specific task / topic
app.post("/api/generate-quiz", async (req, res) => {
  try {
    const { topicTitle, taskTitle, keyObjectives, language } = req.body;
    const isZh = language === "zh" || isChinese(topicTitle) || isChinese(taskTitle) || true;

    const prompt = `Generate 3 high-yield active recall questions to test understanding of the following study session:
Topic: ${topicTitle}
Task: ${taskTitle}
Key Objectives: ${Array.isArray(keyObjectives) ? keyObjectives.join(", ") : ""}
${isZh ? "CRITICAL: Output all questions, options, and explanations in Simplified Chinese (简体中文)." : ""}

For each question, provide 4 multiple choice options, the exact correct answer, and a clear educational explanation to reinforce memory.`;

    const result = await generateWithRetryAndFallback(
      (modelName) => ({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    topicTitle: { type: Type.STRING },
                  },
                  required: ["id", "question", "options", "correctAnswer", "explanation"],
                },
              },
            },
            required: ["questions"],
          },
        },
      }),
      (text) => JSON.parse(text),
      () => fallbackGenerateQuiz(topicTitle, taskTitle, isZh ? "zh" : "en")
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error generating quiz:", error);
    const fallback = fallbackGenerateQuiz(req.body.topicTitle, req.body.taskTitle);
    res.json(fallback);
  }
});

// Vite Middleware for development & static file serving for production
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
    console.log(`Exam Plan AI Server running on http://localhost:${PORT}`);
  });
}

setupViteOrStatic();

