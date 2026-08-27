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

  const topics: SyllabusTopic[] = defaultZh.map((item, idx) => {
    const customHeading = foundHeadings[idx]?.replace(/^[#*\-•\d\.\s]+/, "").trim();
    const title = customHeading && customHeading.length > 3 && customHeading.length < 50
      ? `第 ${idx + 1} 单元：${customHeading}`
      : item.unit;

    const subtopicTree = item.subtopics.map((sub, sIdx) => ({
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
      category: item.category,
      description: isZh ? `涵盖「${title}」的大单元考点树，包含 ${subtopicTree.length} 个细分知识点体系与高频题型。` : `Covers key theorems and drills for ${title}.`,
      weightPercentage: weight,
      difficulty: item.diff,
      userKnowledgeLevel: "intermediate",
      subtopics,
      subtopicTree,
      estimatedHours: item.diff === "hard" ? 8 : item.diff === "medium" ? 6 : 4,
    };
  });

  return {
    summary: isZh
      ? `已解析备考资料，提炼出 ${topics.length} 个大单元考点树，细分出 ${topics.reduce((acc, t) => acc + (t.subtopics?.length || 0), 0)} 个颗粒度考点及核心考查要点。`
      : `Extracted ${topics.length} core topic units covering foundational theory, key methodology, problem-solving drills, and timed exam preparation.`,
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
