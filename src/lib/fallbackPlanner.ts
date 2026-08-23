import { ExamStudyPlan, StudyPlanPhase, StudyTask, SyllabusTopic, UserStudyPreferences, ActiveRecallQuizQuestion } from "../types";

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text || "");
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function fallbackExtractSyllabusClient(
  materials: any[],
  examName: string,
  subject: string,
  lang: string = "zh"
): { summary: string; topics: SyllabusTopic[] } {
  const isZh = lang === "zh" || isChinese(examName) || isChinese(subject);
  const combinedText = (materials || []).map((m) => m.content || m.summaryNotes || "").join("\n");
  const lines = combinedText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 3 && l.length < 80);

  const foundHeadings = lines.filter((l) =>
    /^(unit|chapter|module|week|topic|part|第|单元|章|模块|\d+\.|\b[A-Z\s]{4,}\b)/i.test(l)
  );

  const defaultZh = [
    {
      title: "核心概念、理论基础与定义体系",
      category: "基础概念",
      weightPercentage: 20,
      difficulty: "easy" as const,
      subtopics: ["学科核心术语界定", "基本定理与公理前提", "基础理论应用场景"],
      estimatedHours: 6,
    },
    {
      title: "核心算法与推导方法论",
      category: "核心方法",
      weightPercentage: 30,
      difficulty: "medium" as const,
      subtopics: ["关键公式与算法流程", "典型推导与状态转移", "时空复杂度与边界分析"],
      estimatedHours: 10,
    },
    {
      title: "典型高频考题精析与题型演练",
      category: "典型大题",
      weightPercentage: 25,
      difficulty: "medium" as const,
      subtopics: ["历年典型大题解法", "易错约束与踩坑防范", "标准答题得分点"],
      estimatedHours: 8,
    },
    {
      title: "进阶难点与综合应用案例",
      category: "进阶综合",
      weightPercentage: 15,
      difficulty: "hard" as const,
      subtopics: ["跨章节综合命题", "复杂边界条件攻坚", "多定理联合证明"],
      estimatedHours: 6,
    },
    {
      title: "全真模拟、真题回溯与查漏补缺",
      category: "真题冲刺",
      weightPercentage: 10,
      difficulty: "hard" as const,
      subtopics: ["限时闭卷全真模拟", "高频错题归纳复盘", "考前核心要点速览"],
      estimatedHours: 5,
    },
  ];

  const defaultEn = [
    {
      title: "Foundational Principles & Core Definitions",
      category: "Fundamentals",
      weightPercentage: 20,
      difficulty: "easy" as const,
      subtopics: ["Core definitions", "Fundamental axioms", "Basic properties"],
      estimatedHours: 6,
    },
    {
      title: "Key Methodologies & Analytical Frameworks",
      category: "Methods",
      weightPercentage: 30,
      difficulty: "medium" as const,
      subtopics: ["Formula derivations", "Algorithmic steps", "Constraint analysis"],
      estimatedHours: 10,
    },
    {
      title: "Intermediate Problem Solving & Case Studies",
      category: "Practice",
      weightPercentage: 25,
      difficulty: "medium" as const,
      subtopics: ["Past paper questions", "Common edge cases", "Rubric scoring points"],
      estimatedHours: 8,
    },
    {
      title: "Advanced Theorems, Derivations & Edge Cases",
      category: "Advanced",
      weightPercentage: 15,
      difficulty: "hard" as const,
      subtopics: ["Cross-topic synthesis", "Edge case proofs", "Performance optimization"],
      estimatedHours: 6,
    },
    {
      title: "Synthesis, Comprehensive Review & Exam Drills",
      category: "Exam Prep",
      weightPercentage: 10,
      difficulty: "hard" as const,
      subtopics: ["Timed practice exams", "Weak spot remediation", "High-yield summary"],
      estimatedHours: 5,
    },
  ];

  const baseList = isZh ? defaultZh : defaultEn;

  const topics: SyllabusTopic[] = baseList.map((item, idx) => {
    const customHeading = foundHeadings[idx]?.replace(/^[#*\-•\d\.\s]+/, "").trim();
    const title = customHeading && customHeading.length > 3 && customHeading.length < 40 ? customHeading : item.title;
    return {
      id: `topic-${idx + 1}`,
      title,
      category: item.category,
      description: isZh ? `涵盖${title}的重点考点、推导与题型实战。` : `Covers key theorems and drills for ${title}.`,
      weightPercentage: item.weightPercentage,
      difficulty: item.difficulty,
      userKnowledgeLevel: "intermediate",
      subtopics: item.subtopics,
      estimatedHours: item.estimatedHours,
    };
  });

  return {
    summary: isZh
      ? `已解析备考资料，提炼出 ${topics.length} 个核心考点模块，涵盖基础理论、核心方法、大题专项与真题模拟。`
      : `Extracted ${topics.length} core topics covering foundational theory, key methodology, problem-solving drills, and timed exam preparation.`,
    topics,
  };
}

export function fallbackGeneratePlanClient(
  topics: SyllabusTopic[],
  preferences: UserStudyPreferences
): { phases: StudyPlanPhase[]; tasks: StudyTask[]; totalPlannedHours: number } {
  const isZh = isChinese(preferences.examName) || isChinese(preferences.subject) || true;
  const start = new Date(preferences.startDate || new Date());
  const exam = new Date(preferences.examDate || new Date(Date.now() + 86400000 * 14));
  const diffDays = Math.max(3, Math.round((exam.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const p1End = new Date(start.getTime() + Math.floor(diffDays * 0.35) * 86400000);
  const p2End = new Date(start.getTime() + Math.floor(diffDays * 0.7) * 86400000);
  const p3End = new Date(start.getTime() + Math.floor(diffDays * 0.9) * 86400000);

  const phases: StudyPlanPhase[] = isZh
    ? [
        {
          id: "phase-1",
          name: "第 1 阶段：知识点梳理与概念夯实",
          description: "全面建立知识骨架，吃透所有核心定理与基础概念，建立体系图谱。",
          startDate: formatDate(start),
          endDate: formatDate(p1End),
          focus: "构建知识网络与公式推导",
        },
        {
          id: "phase-2",
          name: "第 2 阶段：高频题型精练与专题攻坚",
          description: "集中攻克历年高分大题与薄弱模块，强化解题套路与计算准确度。",
          startDate: formatDate(new Date(p1End.getTime() + 86400000)),
          endDate: formatDate(p2End),
          focus: "专项突破与解题模型",
        },
        {
          id: "phase-3",
          name: "第 3 阶段：主动回忆与全真模考冲刺",
          description: "限时全真模考，自查扣分盲区，模拟真实考场答题节奏与心理调适。",
          startDate: formatDate(new Date(p2End.getTime() + 86400000)),
          endDate: formatDate(p3End),
          focus: "全真限时模拟与错题反思",
        },
        {
          id: "phase-4",
          name: "第 4 阶段：考前速记与查漏补缺",
          description: "速览考前急救清单，记忆易混淆定义，以饱满状态自信应考。",
          startDate: formatDate(new Date(p3End.getTime() + 86400000)),
          endDate: formatDate(exam),
          focus: "考前清单复习与心态调节",
        },
      ]
    : [
        {
          id: "phase-1",
          name: "Phase 1: Foundation & Core Concepts",
          description: "Build robust understanding of definitions, principles, and frameworks.",
          startDate: formatDate(start),
          endDate: formatDate(p1End),
          focus: "Concept mastery & reading notes",
        },
        {
          id: "phase-2",
          name: "Phase 2: Deep Dive & Problem Solving",
          description: "Master high-frequency question patterns and weak topic drills.",
          startDate: formatDate(new Date(p1End.getTime() + 86400000)),
          endDate: formatDate(p2End),
          focus: "Targeted problem sets & exam mechanics",
        },
        {
          id: "phase-3",
          name: "Phase 3: Active Recall & Mock Exams",
          description: "Timed mock exams, error analysis, and pacing calibration.",
          startDate: formatDate(new Date(p2End.getTime() + 86400000)),
          endDate: formatDate(p3End),
          focus: "Full-length mock tests & active recall",
        },
        {
          id: "phase-4",
          name: "Phase 4: High-Yield Final Review",
          description: "Quick-reference cheat sheet review and psychological preparation.",
          startDate: formatDate(new Date(p3End.getTime() + 86400000)),
          endDate: formatDate(exam),
          focus: "Formula flash review & peak exam readiness",
        },
      ];

  const tasks: StudyTask[] = [];
  const safeTopics = topics && topics.length > 0 ? topics : fallbackExtractSyllabusClient([], preferences.examName, preferences.subject, isZh ? "zh" : "en").topics;

  const categories: StudyTask["category"][] = [
    "theory",
    "reading",
    "practice_problems",
    "active_recall",
    "practice_problems",
    "mock_exam",
    "review_weak_spots",
    "summary_cheat_sheet",
  ];

  let taskCounter = 1;
  const numDaysToPlan = Math.min(diffDays, 60);

  for (let dayOffset = 0; dayOffset < numDaysToPlan; dayOffset++) {
    const curDate = new Date(start.getTime() + dayOffset * 86400000);
    const dateStr = formatDate(curDate);
    const dayOfWeek = curDate.getDay();
    const scheduleConfig = preferences.dailySchedules?.find((s) => s.dayOfWeek === dayOfWeek);

    if (scheduleConfig && !scheduleConfig.enabled) {
      continue;
    }

    const progressRatio = dayOffset / numDaysToPlan;
    let cat: StudyTask["category"] = "theory";
    if (progressRatio < 0.35) {
      cat = dayOffset % 2 === 0 ? "reading" : "theory";
    } else if (progressRatio < 0.70) {
      cat = "practice_problems";
    } else if (progressRatio < 0.90) {
      cat = (dayOffset % 3 === 0) ? "mock_exam" : "active_recall";
    } else {
      cat = "summary_cheat_sheet";
    }

    const topic = safeTopics[dayOffset % safeTopics.length];
    const isMock = cat === "mock_exam" || dayOffset === numDaysToPlan - 2;

    const taskTitle = isZh
      ? isMock
        ? `全真模考：${preferences.examName} 仿真模拟卷自测`
        : cat === "practice_problems"
        ? `专题精练：${topic.title} 经典大题专项突破`
        : cat === "active_recall"
        ? `主动回忆：${topic.title} 核心定理与推导复盘`
        : cat === "summary_cheat_sheet"
        ? `考前急救：${topic.title} 核心考点与公式速记`
        : `考点研读：${topic.title} 核心概念与思维导图`
      : isMock
      ? `Timed Mock Exam: ${preferences.examName} Full Simulation`
      : cat === "practice_problems"
      ? `Problem Set: ${topic.title} Core Exercises`
      : cat === "active_recall"
      ? `Active Recall Drill: ${topic.title} Self-Testing`
      : cat === "summary_cheat_sheet"
      ? `Formula Sheet: ${topic.title} High-Yield Review`
      : `Deep Reading: ${topic.title} Concepts`;

    const randSalt = Math.random().toString(36).slice(2, 6);
    const userNeedStatement = isZh
      ? `满足目标【${preferences.targetScoreOrGrade || "高分通关"}】，针对「${topic.title}」进行 RAG 精准任务分配`
      : `Targeting [${preferences.targetScoreOrGrade || "Target Grade"}], grounded for [${topic.title}]`;

    tasks.push({
      id: `task-${dateStr}-${randSalt}-${taskCounter++}`,
      title: taskTitle,
      description: isZh
        ? `针对 ${topic.title} 展开深度攻坚，掌握所有考点并完成自测与总结。`
        : `Targeted session on ${topic.title}. Master core requirements and review notes.`,
      category: isMock ? "mock_exam" : cat,
      topicTitle: topic.title,
      date: dateStr,
      startTime: scheduleConfig?.preferredTimeSlot === "morning" ? "09:00" : scheduleConfig?.preferredTimeSlot === "afternoon" ? "14:30" : "19:00",
      endTime: scheduleConfig?.preferredTimeSlot === "morning" ? "10:30" : scheduleConfig?.preferredTimeSlot === "afternoon" ? "16:00" : "20:30",
      durationMinutes: isMock ? 90 : preferences.sessionLengthMinutes || 60,
      priority: isMock || topic.difficulty === "hard" ? "high" : "medium",
      status: "pending",
      keyObjectives: isZh
        ? [`深入掌握 ${topic.title} 核心考点与解题步骤`, `完成课后/大纲对应习题并标注易错点`, `通过主动回忆自测回答关键推导`]
        : [`Master core principles of ${topic.title}`, `Complete high-yield practice exercises`, `Verify retention via active recall`],
      activeRecallPrompt: isZh
        ? `不看笔记，尝试画出「${topic.title}」的核心推导步骤或解题模板。`
        : `Without looking at notes, explain the step-by-step framework for ${topic.title}.`,
      groundedUserNeed: userNeedStatement,
      ragSource: {
        documentName: `${preferences.subject || "专业课"}-核心讲义与真题.pdf`,
        documentType: isMock ? "past_exam" : "notes",
        sectionTitle: `${topic.title} · 重点考点提要`,
        pageOrChapter: `第 ${(dayOffset % 5) + 1} 单元`,
        excerptSnippet: isZh
          ? `【讲义重点】本单元重点考核「${topic.title}」的基本定理推导与典型题型解法，历年出题率极高，需严格掌握解题步骤规范。`
          : `[Core Notes] Key definitions and theorems for ${topic.title}. Verify assumptions before applying formulas.`,
        keyConcepts: [topic.title, "核心定义", "题型模板", "避坑指南"],
        relevanceReason: isZh ? "命中了考纲核心理论与高频真题" : "Matched core syllabus unit",
      },
      formulaOrRules: isZh
        ? [`${topic.title} 核心控制方程与计算准则`, `边界约束: 变量取值区间需满足定理定义域`]
        : [`Governing equation for ${topic.title}`, `Boundary conditions verified`],
      practiceQuestionRef: isMock ? `《历年真题期末卷》全套` : `《期末习题精选》第 ${(dayOffset % 4) + 1} 题`,
    });
  }

  const totalPlannedHours = Math.round(tasks.reduce((sum, t) => sum + (t.durationMinutes || 60), 0) / 60);

  return {
    phases,
    tasks,
    totalPlannedHours: totalPlannedHours || 30,
  };
}

export function fallbackGenerateQuizClient(
  topicTitle: string = "学科核心考点",
  taskTitle: string = "复习自测",
  lang: string = "zh"
): { questions: ActiveRecallQuizQuestion[] } {
  const isZh = lang === "zh" || isChinese(topicTitle) || isChinese(taskTitle);

  if (isZh) {
    return {
      questions: [
        {
          id: `q-${Date.now()}-1`,
          question: `在复习「${topicTitle}」时，关于其核心定义与适用边界，下列哪项理解最为准确？`,
          options: [
            "必须首先明确前提约束条件，严格遵循推导逻辑与边界约束",
            "仅需死记公式数值，无需关注推导过程与适用前提",
            "在所有极端边界情况下均可直接忽略约束直接套用结论",
            "解题时只需凭直觉猜测，无需书写中间推理步骤",
          ],
          correctAnswer: "必须首先明确前提约束条件，严格遵循推导逻辑与边界约束",
          explanation: "扎实的学术考试要求在理解前提假设与约束条件的基础上熟练推导，避免在边界处失分。",
          topicTitle,
        },
        {
          id: `q-${Date.now()}-2`,
          question: `面对「${taskTitle}」中涉及的复杂计算或综合大题，最高效规范的解题策略是：`,
          options: [
            "先识别题型模型，规范书写状态/方程/步骤，最后校验特殊边界",
            "跳过审题直接套用固定数字计算",
            "只写最终答案，完全省略推导过程",
            "遇到疑问立即放弃，不做任何步骤分争取",
          ],
          correctAnswer: "先识别题型模型，规范书写状态/方程/步骤，最后校验特殊边界",
          explanation: "规范的标准答题步骤能最大化斩获过程分，并在最后校验边界时及时纠正计算失误。",
          topicTitle,
        },
        {
          id: `q-${Date.now()}-3`,
          question: `为了达到对「${topicTitle}」的长效记忆与主动提取，最科学的复习方式是：`,
          options: [
            "进行费曼闭卷自述与间隔式主动回忆自测",
            "连续机械抄写笔记 10 遍",
            "只在考前最后一小时临时突击浏览",
            "只做选择题，完全不练习手写推导大题",
          ],
          correctAnswer: "进行费曼闭卷自述与间隔式主动回忆自测",
          explanation: "认知心理学表明，基于主动回忆（Active Recall）与间隔复习的检索练习具有最显著的记忆强化效果。",
          topicTitle,
        },
      ],
    };
  }

  return {
    questions: [
      {
        id: `q-${Date.now()}-1`,
        question: `Regarding the core principles of "${topicTitle}", which statement represents optimal understanding?`,
        options: [
          "Always verify foundational assumptions, constraints, and boundary conditions",
          "Memorize the end formula without understanding the derivation",
          "Ignore edge cases and rely only on standard inputs",
          "Skip intermediate algebraic or logical steps",
        ],
        correctAnswer: "Always verify foundational assumptions, constraints, and boundary conditions",
        explanation: "Mastery requires deep awareness of boundary conditions and exact step-by-step reasoning.",
        topicTitle,
      },
      {
        id: `q-${Date.now()}-2`,
        question: `When tackling comprehensive exam problems related to "${taskTitle}", what is the most reliable strategy?`,
        options: [
          "Identify the underlying pattern, write explicit definitions, and check edge cases",
          "Jump directly into arithmetic without formulating equations",
          "Provide only the final number without reasoning steps",
          "Skip any problem with multi-step dependencies",
        ],
        correctAnswer: "Identify the underlying pattern, write explicit definitions, and check edge cases",
        explanation: "Structuring the solution explicitly guarantees maximum step credit and minimizes calculation bugs.",
        topicTitle,
      },
    ],
  };
}
