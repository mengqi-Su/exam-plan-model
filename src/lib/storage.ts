import { ExamStudyPlan, StudyMaterial, UserStudyPreferences, UserProfile, AppSettings } from "../types";

const STORAGE_KEY_PLANS = "exam_planner_saved_plans_v1";
const STORAGE_KEY_ACTIVE_ID = "exam_planner_active_plan_id_v1";
const STORAGE_KEY_MATERIALS = "exam_planner_materials_v1";

export const DEFAULT_WEEK_SCHEDULE = [
  { dayOfWeek: 0, dayName: "周日", availableHours: 4, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 1, dayName: "周一", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 2, dayName: "周二", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 3, dayName: "周三", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 4, dayName: "周四", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 5, dayName: "周五", availableHours: 2, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 6, dayName: "周六", availableHours: 5, preferredTimeSlot: "morning" as const, enabled: true },
];

export const SAMPLE_MATERIALS = [
  {
    name: "CS 301：高级数据结构与算法 课程大纲",
    subject: "计算机科学",
    text: `课程大纲：CS 301 高级数据结构与算法
考试时间：3周后，期末统考（3小时全真闭卷）。

模块 1：平衡搜索树与堆结构 (考点分值占比: 20%)
- 红黑树：旋转平衡操作、插入与删除的平衡不变性定理
- AVL 树：平衡因子与旋转调整
- B 树与 B+ 树：磁盘页索引结构、多路搜索节点
- 斐波那契堆与二项队列：平摊时间复杂度分析

模块 2：图算法与网络流 (考点分值占比: 25%)
- 最短路径：Dijkstra 堆优化、Bellman-Ford 负权环检测、Floyd-Warshall
- 最小生成树：Kruskal 并查集、Prim 算法
- 最大流与最小割：Ford-Fulkerson、Edmonds-Karp、Dinic 算法
- 强连通分量：Tarjan 算法与 Kosaraju 算法

模块 3：动态规划与分治策略 (考点分值占比: 30%)
- 经典 DP：0/1 背包、完全背包、最长公共子序列 (LCS)、矩阵链乘法
- 状态压缩 DP 与状压位运算
- 树形 DP 与 DAG 最长路
- 主定理 (Master Theorem) 与递归复杂度推导

模块 4：NP 完全性与近似算法 (考点分值占比: 15%)
- 复杂度类别：P、NP、NP-Hard、NP-Complete
- 多项式时间归约：3-SAT 归约至顶点覆盖与独立集
- 顶点覆盖与旅行商问题 (TSP) 2-近似算法

模块 5：随机算法与平摊分析 (考点分值占比: 10%)
- 通用哈希与布隆过滤器 (Bloom Filters)
- 跳表 (Skip List) 概率分析
- 聚合分析、记账法与势能法 (Potential Method)`,
  },
  {
    name: "生物学与人体生理学 综合期末大纲",
    subject: "生物医学",
    text: `课程大纲：人体生理学与细胞生物化学
期末综合统考。

第 1 单元：细胞跨膜转运与膜电位 (占比: 20%)
- 神经元与心肌细胞动作电位离子流机制
- 钠钾泵 (Na+/K+ ATPase) 与电压门控离子通道
- 第二信使级联反应：cAMP、IP3/DAG、受体酪氨酸激酶

第 2 单元：心血管与呼吸系统生理 (占比: 30%)
- 心动周期：Wiggers 图、前负荷、后负荷与心肌收缩力
- 血液动力学：泊肃叶定律、外周阻力与血压神经体液调节
- 气体交换：氧离曲线 (Bohr 效应与 Haldane 效应)
- 酸碱平衡：Henderson-Hasselbalch 方程与呼吸性/代谢性酸碱中毒鉴别

第 3 单元：肾脏生理与电解质水平衡 (占比: 25%)
- 肾小球滤过率 (GFR) 自身调节
- 肾小管重吸收：髓袢逆流倍增机制
- 肾素-血管紧张素-醛固酮系统 (RAAS) 与抗利尿激素 (ADH)

第 4 单元：内分泌与糖脂代谢通路 (占比: 25%)
- 下丘脑-垂体-靶腺轴调控
- 血糖稳态：胰岛素与胰高血糖素、糖酵解与糖异生
- 禁食状态下的脂质动员与酮体代谢`,
  },
];

export const INITIAL_SAMPLE_DOCUMENTS: StudyMaterial[] = [
  {
    id: "doc-exam-1",
    name: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
    type: "past_exam",
    categoryGroup: "exam_question",
    topicTag: "动态规划与图论综合",
    difficulty: "hard",
    yearOrTerm: "2025 秋季期末",
    questionCount: 10,
    uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    sizeBytes: 1024 * 18,
    summaryNotes: "包含 4 道平衡树与堆选择题、2 道网络流建模大题、2 道树形 DP 状态转移推导题、2 道 NP 归约证明大题。",
    keyTraps: [
      "红黑树删除黑色节点时双黑节点（Double Black）向上传递的旋转修复边界",
      "Dijkstra 无法处理负权边的本质原因，以及 Edmonds-Karp 增广路反向边的更新遗漏",
      "树形 DP 在求子树最大独立集时包含根与不包含根的状态转移边界",
    ],
    content: `【2025年 秋季学期 CS 301 高级算法与数据结构 期末全真试题 (A卷)】
考试时间：180 分钟  满分：100 分

一、算法理论与数据结构选择题 (每题 4 分，共 20 分)
1. 在一棵包含 n 个节点的红黑树中，从根节点到任意叶子节点的最长路径长度最多是从根节点到叶子节点最短路径长度的多少倍？
   A. 1.5 倍    B. 2 倍    C. log n 倍    D. 3 倍
   [参考解析]：根据红黑树性质（没有两个连续红节点，每条路径黑高相同），最长路径为红黑交替，最短全为黑，因此最长最多为最短的 2 倍。

2. 使用斐波那契堆实现 Dijkstra 算法时，整体时间复杂度为：
   A. O(V log V + E)    B. O((V + E) log V)    C. O(V^2)    D. O(E log E)
   [参考解析]：Decrease-Key 平摊为 O(1)，Extract-Min 为 O(log V)，总复杂度 O(V log V + E)。

二、网络流与图论建模大题 (共 30 分)
3. (15分) 给定一个二分图 G = (L, R, E)，请通过构造最大流网络将其转化为求最大匹配问题，并证明最大流值等于该二分图的最大匹配数。
   [参考步骤]：设立源点 S 与汇点 T，S 向 L 中各点连容量 1 的有向边，L 与 R 间原边连容量 1，R 各点向 T 连容量 1。利用 Ford-Fulkerson 整数定理证明。

4. (15分) 设某通信网络中有 V 个节点，部分链路具有容量限制且存在双向带宽。请设计一个基于 Dinic 算法的多源多汇最大流求解方案。

三、动态规划与状态转移方程设计大题 (共 30 分)
5. (15分) 树形最大独立集问题：给定一棵有 n 个节点的无向树 T，每个节点有权重 w[i]。请写出求该树最大权独立集的动态规划状态定义及转移方程，并分析时间复杂度。
   [状态定义]：dp[u][0] 表示不选节点 u 时以 u 为根的子树最大权，dp[u][1] 表示选中节点 u 时的最大权。
   [转移方程]：
   dp[u][0] = ∑ max(dp[v][0], dp[v][1]),  v ∈ children(u)
   dp[u][1] = w[u] + ∑ dp[v][0],  v ∈ children(u)

6. (15分) 状态压缩 DP：给定 n ≤ 16 个城市的旅行商问题 (TSP)，求从起点 0 出发经过所有城市恰好一次并返回起点的最短路径。写出 dp[mask][i] 的转移方程。

四、NP 完全性证明大题 (共 20 分)
7. 已知 3-SAT 问题是 NP-Complete，请通过构造多项式时间归约证明 独立集 (Independent Set) 问题也是 NP-Complete。`,
  },
  {
    id: "doc-exam-2",
    name: "图论网络流与最短路 经典易错考题精编",
    type: "past_exam",
    categoryGroup: "exam_question",
    topicTag: "图算法与网络流",
    difficulty: "medium",
    yearOrTerm: "2024 中期测验",
    questionCount: 6,
    uploadedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    sizeBytes: 1024 * 12,
    summaryNotes: "聚焦 Bellman-Ford 负权环检测、Tarjan 强连通分量缩点、最小割定理的实际应用题。",
    keyTraps: [
      "Tarjan 算法中 dfn[u] 与 low[u] 的更新条件区分（搜索树边 vs 栈内反向边）",
      "最大流最小割定理中最小割容量等于最大流值，而非割中边的数量",
    ],
    content: `【图论网络流与最短路 历年典型易错考题汇编】

题 1：Bellman-Ford 算法在进行 V-1 轮松弛后，如何判定图中是否存在从源点可达的负权回路？
[答案及解题要点]：第 V 轮若仍能发生距离松弛（dist[v] > dist[u] + w），则说明存在可达负权回路。

题 2：Tarjan 算法求强连通分量中，何时将节点从栈中弹出并归为一个强连通分量？
[答案及解题要点]：当回溯时发现 dfn[u] == low[u]，说明以 u 为根的整个强连通分量已遍历完毕，将栈中直到 u 为止的所有节点全部弹出。

题 3：最小割模型应用：如何利用最大割/最小割将二值图像分割问题建模为网络流？`,
  },
  {
    id: "doc-notes-1",
    name: "算法复杂度、主定理与平衡搜索树 核心公式速查讲义",
    type: "notes",
    categoryGroup: "study_material",
    topicTag: "平衡搜索树与堆结构",
    difficulty: "medium",
    yearOrTerm: "教授精编讲义",
    uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    sizeBytes: 1024 * 15,
    summaryNotes: "包含红黑树 5 大不变性定律、主定理 (Master Theorem) 3 种情况分界线、势能法证明公式。",
    content: `【CS 301 核心定理与公式速查讲义】

1. 红黑树的五大不变性性质：
- 性质 1：每个节点要么是红色，要么是黑色。
- 性质 2：根节点必定是黑色。
- 性质 3：所有叶子节点 (NIL) 都是黑色。
- 性质 4：如果一个节点是红色，则它的两个子节点必须都是黑色（不能有连续红节点）。
- 性质 5：从任一节点到其每个叶子的所有简单路径上，均包含相同数目的黑色节点（黑高相等）。

2. 主定理 (Master Theorem) 递归式 T(n) = a*T(n/b) + f(n)：
- 设关键指数 c_crit = log_b(a)
- 情况 1：若 f(n) = O(n^(c_crit - ε))，则 T(n) = Θ(n^(log_b a))
- 情况 2：若 f(n) = Θ(n^(c_crit) * log^k(n))，则 T(n) = Θ(n^(log_b a) * log^(k+1)(n))
- 情况 3：若 f(n) = Ω(n^(c_crit + ε)) 且满足正则性条件，则 T(n) = Θ(f(n))

3. 平摊分析 (Amortized Analysis) 势能法 (Potential Method)：
- a_i = c_i + Φ(D_i) - Φ(D_{i-1})
- 只要保证对所有 i 均有 Φ(D_i) ≥ Φ(D_0)，则平摊成本总和即为实际成本的上界。`,
  },
  {
    id: "doc-notes-2",
    name: "动态规划 10 大经典模型与状态设计清单",
    type: "lecture_slides",
    categoryGroup: "study_material",
    topicTag: "动态规划与状压位运算",
    difficulty: "hard",
    yearOrTerm: "考前必背提纲",
    uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    sizeBytes: 1024 * 22,
    summaryNotes: "整理了背包问题、区间 DP、树形 DP、状压 DP 及斜率优化 DP 状态转移范式。",
    content: `【动态规划核心范式与状态转移方程精粹】

一、0/1 背包 vs 完全背包
- 0/1 背包：dp[v] = max(dp[v], dp[v - w[i]] + c[i])  (容量倒序遍历)
- 完全背包：dp[v] = max(dp[v], dp[v - w[i]] + c[i])  (容量正序遍历)

二、最长公共子序列 (LCS)
- 若 s1[i] == s2[j]: dp[i][j] = dp[i-1][j-1] + 1
- 若 s1[i] != s2[j]: dp[i][j] = max(dp[i-1][j], dp[i][j-1])

三、状态压缩 DP (旅行商 TSP)
- dp[mask][i] 表示已经访问过的城市集合为 mask，当前处于城市 i 的最小花费
- dp[mask | (1<<j)][j] = min(dp[mask | (1<<j)][j], dp[mask][i] + dist[i][j])`,
  },
];

function getSamplePlan(): ExamStudyPlan {
  const today = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const d0 = new Date(today);
  const d1 = new Date(today); d1.setDate(d1.getDate() + 1);
  const d2 = new Date(today); d2.setDate(d2.getDate() + 2);
  const d3 = new Date(today); d3.setDate(d3.getDate() + 3);
  const d4 = new Date(today); d4.setDate(d4.getDate() + 4);
  const d5 = new Date(today); d5.setDate(d5.getDate() + 5);
  const d7 = new Date(today); d7.setDate(d7.getDate() + 7);
  const d14 = new Date(today); d14.setDate(d14.getDate() + 14);
  const d21 = new Date(today); d21.setDate(d21.getDate() + 21);

  const startDateStr = formatDate(d0);
  const examDateStr = formatDate(d21);

  return {
    id: "sample-plan-cs301",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    examName: "CS 301：高级算法与数据结构期末考试",
    subject: "计算机科学",
    startDate: startDateStr,
    examDate: examDateStr,
    examTime: "09:00",
    totalPlannedHours: 42,
    materialsSummary: "涵盖平衡搜索树、图论网络流、动态规划范式、NP 完全性证明与平摊分析。",
    preferences: {
      examName: "CS 301：高级算法与数据结构期末考试",
      subject: "计算机科学",
      startDate: startDateStr,
      examDate: examDateStr,
      examTime: "09:00",
      targetScoreOrGrade: "A (95分+ / 卓越)",
      dailySchedules: DEFAULT_WEEK_SCHEDULE,
      studyPace: "deep_mastery",
      sessionLengthMinutes: 45,
      includePracticeExams: true,
      includeBufferDays: true,
      bufferDaysCount: 3,
      weakTopicsFocus: ["树形动态规划与状压", "网络流建模归约"],
      additionalNotes: "重点攻坚多步公式推导与真题大题解答证明题。",
    },
    phases: [
      {
        id: "phase-1",
        name: "第 1 阶段：知识框架与核心数据结构不变性",
        description: "全面梳理平衡树、堆结构以及图遍历核心定理与性质证明。",
        startDate: startDateStr,
        endDate: formatDate(d5),
        focus: "平衡搜索树与堆结构",
      },
      {
        id: "phase-2",
        name: "第 2 阶段：图论进阶与网络流建模",
        description: "深入掌握最短路、最小生成树、最大流最小割及 Tarjan 算法。",
        startDate: formatDate(d7),
        endDate: formatDate(d14),
        focus: "图算法与网络流",
      },
      {
        id: "phase-3",
        name: "第 3 阶段：高频动态规划与全真限时模考",
        description: "强化背包与树形 DP 难题求解，并完成多套全真模拟演练。",
        startDate: formatDate(d14),
        endDate: formatDate(d21),
        focus: "动态规划大题与全真模考",
      },
    ],
    topics: [
      {
        id: "top-1",
        title: "平衡搜索树与堆结构",
        category: "数据结构",
        difficulty: "medium",
        userKnowledgeLevel: "intermediate",
        weightPercentage: 20,
        estimatedHours: 8,
        subtopics: ["红黑树旋转平衡", "AVL 树平衡因子", "B+ 树磁盘索引", "斐波那契堆"],
      },
      {
        id: "top-2",
        title: "图算法与网络流",
        category: "图论",
        difficulty: "hard",
        userKnowledgeLevel: "beginner",
        weightPercentage: 25,
        estimatedHours: 12,
        subtopics: ["Dijkstra 与 Bellman-Ford", "Floyd-Warshall", "Edmonds-Karp 最大流", "Tarjan 强连通分量"],
      },
      {
        id: "top-3",
        title: "动态规划与状压位运算",
        category: "算法设计",
        difficulty: "hard",
        userKnowledgeLevel: "beginner",
        weightPercentage: 30,
        estimatedHours: 14,
        subtopics: ["0/1 与完全背包", "最长公共子序列 (LCS)", "矩阵链乘法", "状态压缩 DP"],
      },
      {
        id: "top-4",
        title: "NP 完全性与归约证明",
        category: "计算复杂度",
        difficulty: "medium",
        userKnowledgeLevel: "intermediate",
        weightPercentage: 15,
        estimatedHours: 5,
        subtopics: ["P 与 NP 概念", "3-SAT 经典归约", "顶点覆盖与独立集", "近似算法"],
      },
      {
        id: "top-5",
        title: "随机算法与跳表分析",
        category: "高级数据结构",
        difficulty: "easy",
        userKnowledgeLevel: "advanced",
        weightPercentage: 10,
        estimatedHours: 3,
        subtopics: ["布隆过滤器原理", "跳表概率分析", "势能法平摊分析"],
      },
    ],
    tasks: [
      {
        id: "task-d0-1",
        title: "红黑树 4 种旋转情况与黑高不变性推导",
        description: "手绘红黑树插入删除 4 种旋转情形，推导树高上限 h <= 2*log(n+1)。",
        category: "theory",
        topicTitle: "平衡搜索树与堆结构",
        date: startDateStr,
        startTime: "18:00",
        endTime: "19:00",
        durationMinutes: 60,
        priority: "high",
        status: "completed",
        keyObjectives: ["掌握左旋与右旋操作及指针维护", "验证黑高一致性规则与性质定理"],
        activeRecallPrompt: "红黑树插入修复中，叔父节点为红色与黑色时分别如何处理？",
        confidenceRating: 4,
        notes: "彻底理清了叔父节点颜色判定分支。插入平衡调整平摊时间为 O(log n)。",
        actualMinutesSpent: 55,
        groundedUserNeed: "匹配用户目标【A (95分+ / 卓越)】：深入掌握平衡树核心理论与定理推导",
        ragSource: {
          documentName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
          documentType: "past_exam",
          sectionTitle: "一、算法理论与数据结构选择题 第1题",
          pageOrChapter: "真题试卷 第 1 题",
          excerptSnippet: "在一棵包含 n 个节点的红黑树中，从根节点到任意叶子节点的最长路径长度最多是从根节点到叶子节点最短路径长度的2倍。性质：根为黑，无连续红节点，黑高一致。",
          keyConcepts: ["红黑树性质", "黑高定理", "单双旋转", "平摊复杂度"],
          relevanceReason: "命中了历年高频真题选择题第 1 题与性质定理考查",
        },
        formulaOrRules: ["树高界限: h <= 2 * log2(n + 1)", "黑高性质: 根到任意叶子路径上的黑节点数严格恒等"],
        practiceQuestionRef: "《2025期末全真真题A卷》第1题",
      },
      {
        id: "task-d0-2",
        title: "B 树与 B+ 树特性对比与范围查询实战",
        description: "分析 B+ 树叶子链表在大数据范围查询中的磁盘 I/O 优势。",
        category: "practice_problems",
        topicTitle: "平衡搜索树与堆结构",
        date: startDateStr,
        startTime: "19:15",
        endTime: "20:00",
        durationMinutes: 45,
        priority: "medium",
        status: "pending",
        keyObjectives: ["计算分支因子 B 下树高及节点上限", "追踪双向叶子节点范围遍历流程"],
        activeRecallPrompt: "为什么数据库索引普遍采用 B+ 树而不是红黑树或标准 B 树？",
        groundedUserNeed: "针对【大题计算与综合推导】需求，强化外存索引模型",
        ragSource: {
          documentName: "CS 301：高级数据结构与算法 课程大纲",
          documentType: "syllabus",
          sectionTitle: "模块 1：平衡搜索树与堆结构",
          pageOrChapter: "大纲考点 1.3",
          excerptSnippet: "B 树与 B+ 树：磁盘页索引结构、多路搜索节点。要求重点掌握阶数 M 下最大关键字数推导及范围扫描复杂度。",
          keyConcepts: ["B+ 树", "磁盘页 I/O", "范围搜索", "平衡多路查找"],
          relevanceReason: "大纲重点标记的实际工程应用考点",
        },
        formulaOrRules: ["树高估计: h <= ceil(log_B(N))", "叶子节点通过双向指针串联实现 O(1) 连续范围检索"],
      },
      {
        id: "task-d1-1",
        title: "Dijkstra 与 Bellman-Ford 边界用例专项强化",
        description: "精解 5 道图论最短路真题，对比非负权图与负权环图的算法行为。",
        category: "practice_problems",
        topicTitle: "图算法与网络流",
        date: formatDate(d1),
        startTime: "18:30",
        endTime: "19:45",
        durationMinutes: 75,
        priority: "high",
        status: "pending",
        keyObjectives: ["解释为何 Dijkstra 在负权边下失效", "推导 Bellman-Ford 松弛 |V|-1 轮检测负环的原理"],
        activeRecallPrompt: "Bellman-Ford 算法如何严格判断有向图中是否存在负权回路？",
        groundedUserNeed: "针对用户指定薄弱知识点【图算法与网络流】分配额外巩固学时",
        ragSource: {
          documentName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
          documentType: "past_exam",
          sectionTitle: "一、选择题 第2题 & 二、图论大题",
          pageOrChapter: "真题 第 2 题",
          excerptSnippet: "斐波那契堆实现 Dijkstra 算法时，整体时间复杂度为 O(V log V + E)。当存在负权回路时需采用 Bellman-Ford 松弛判断。",
          keyConcepts: ["Dijkstra 堆优化", "Bellman-Ford 负环检测", "松弛定理"],
          relevanceReason: "考查算法边界条件与时间复杂度对比",
        },
        formulaOrRules: ["Dijkstra + Fib-Heap: O(|V| log |V| + |E|)", "Bellman-Ford 循环: 迭代 |V|-1 次后若仍可松弛则存在负环"],
        practiceQuestionRef: "《2025期末真题A卷》第2题",
      },
      {
        id: "task-d2-1",
        title: "Edmonds-Karp 与 Dinic 算法最大流最小割定理证明",
        description: "推导残留网络、增广路定理以及最大流最小割容量等价性定理。",
        category: "theory",
        topicTitle: "图算法与网络流",
        date: formatDate(d2),
        startTime: "18:00",
        endTime: "19:30",
        durationMinutes: 90,
        priority: "high",
        status: "pending",
        keyObjectives: ["准确计算残留容量与反向弧流量更新", "从可达残留点集确定最小 s-t 割集"],
        activeRecallPrompt: "请复述最大流最小割定理，并说明为什么最小割容量必然等于最大流流量？",
        groundedUserNeed: "重点攻坚历年期末 30 分大题【网络流建模归约】",
        ragSource: {
          documentName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
          documentType: "past_exam",
          sectionTitle: "二、网络流与图论建模大题 第3-4题",
          pageOrChapter: "大题第 3 题 (15分)",
          excerptSnippet: "二分图最大匹配转化为最大流：源点 S 连 L，L 连 R，R 连 T。证明最大流值等于二分图最大匹配数。利用 Ford-Fulkerson 整数定理证明。",
          keyConcepts: ["最大流最小割", "二分图匹配建模", "残留网络", "Dinic 分层图"],
          relevanceReason: "期末考试必考 15 分网络流建模证明大题",
        },
        formulaOrRules: ["最大流最小割定理: max_flow(S, T) == min_capacity(cut(S, T))", "Dinic 时间复杂度: O(V^2 * E)，在单位网络中为 O(E * sqrt(V))"],
        practiceQuestionRef: "《2025期末真题A卷》大题第3题",
      },
      {
        id: "task-d3-1",
        title: "0/1 背包状态转移矩阵与空间压缩演练",
        description: "构建 2D DP 状态转移表并将其优化为单行 1D 数组倒序遍历。",
        category: "practice_problems",
        topicTitle: "动态规划与状压位运算",
        date: formatDate(d3),
        startTime: "18:30",
        endTime: "19:30",
        durationMinutes: 60,
        priority: "high",
        status: "pending",
        keyObjectives: ["推导状态转移方程 DP[i][w] = max(DP[i-1][w], DP[i-1][w-wt[i]] + val[i])", "解释 1D 数组为何必须倒序遍历"],
        activeRecallPrompt: "0/1 背包一维滚动数组中，为什么内层循环必须从后向前倒序遍历？",
        groundedUserNeed: "强化高分核心模块【动态规划与状压位运算】",
        ragSource: {
          documentName: "CS 301：高级数据结构与算法 课程大纲",
          documentType: "syllabus",
          sectionTitle: "模块 3：动态规划与分治策略",
          pageOrChapter: "大纲 3.1 核心 DP 专题",
          excerptSnippet: "经典 DP：0/1 背包、完全背包、最长公共子序列 (LCS)、矩阵链乘法。要求熟练推导状态转移方程并掌握滚动数组空间优化。",
          keyConcepts: ["0/1 背包", "空间压缩", "倒序遍历", "无后效性"],
          relevanceReason: "大纲分值占比高达 30% 的核心专题",
        },
        formulaOrRules: ["2D方程: dp[i][j] = max(dp[i-1][j], dp[i-1][j-w[i]] + v[i])", "1D优化: for j from W downTo w[i]: dp[j] = max(dp[j], dp[j-w[i]] + v[i])"],
        practiceQuestionRef: "《2025期末真题A卷》大题第5题",
      },
      {
        id: "task-d4-1",
        title: "阶段诊断限时小模考 (45分钟)",
        description: "全真限时闭卷：涵盖平衡树、图论最短路与背包 DP 综合大题。",
        category: "mock_exam",
        topicTitle: "动态规划与状压位运算",
        date: formatDate(d4),
        startTime: "19:00",
        endTime: "19:45",
        durationMinutes: 45,
        priority: "high",
        status: "pending",
        keyObjectives: ["全真模拟考试作答节奏与时间分配", "自评批改并记录第 2 阶段需攻坚的易错盲区"],
        activeRecallPrompt: "交卷后立即归纳本次模考用时最长或犹豫的知识点类型。",
        groundedUserNeed: "满足【智能穿插全真阶段模考】设置，检验前 4 天知识吸收效果",
        ragSource: {
          documentName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
          documentType: "past_exam",
          sectionTitle: "综合阶段测验卷 (包含平衡树、最短路与 DP)",
          pageOrChapter: "期末统考真题 综合模拟题",
          excerptSnippet: "限时 45 分钟全真模考，精选历年期末核心必考大题，考察综合建模能力与定理推导严谨性。",
          keyConcepts: ["阶段自测", "作答节奏", "查漏补缺", "错题归纳"],
          relevanceReason: "科学复习法中的阶段性输出检索练习",
        },
        formulaOrRules: ["考前自测: 规范书写步骤得分点，避免跳跃性推导失分"],
        practiceQuestionRef: "《2025期末真题A卷》阶段模拟题",
      },
    ],
    materials: INITIAL_SAMPLE_DOCUMENTS,
  };
}

export function loadSavedPlans(): ExamStudyPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    if (!raw) {
      const sample = getSamplePlan();
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify([sample]));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, sample.id);
      return [sample];
    }
    const parsed: ExamStudyPlan[] = JSON.parse(raw);

    if (Array.isArray(parsed) && parsed.length > 0) {
      const hasLegacySample = parsed.some(
        (p) => p.id === "sample-plan-cs301" && (p.examName.includes("Final") || p.examName === "CS 301: Advanced Algorithms Final" || (p.tasks && p.tasks[0]?.title.includes("Red-Black")))
      );
      if (hasLegacySample) {
        const sample = getSamplePlan();
        const updated = parsed.map((p) => (p.id === "sample-plan-cs301" ? sample : p));
        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(updated));
        return updated;
      }
      return parsed;
    }
    return [getSamplePlan()];
  } catch (e) {
    console.error("Failed to load plans from localStorage", e);
    return [getSamplePlan()];
  }
}

export function savePlans(plans: ExamStudyPlan[]) {
  try {
    localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(plans));
  } catch (e) {
    console.error("Failed to save plans", e);
  }
}

export function getActivePlanId(): string {
  return localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || "sample-plan-cs301";
}

export function setActivePlanId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
}

export function loadUploadedMaterials(): StudyMaterial[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MATERIALS);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveUploadedMaterials(materials: StudyMaterial[]) {
  try {
    localStorage.setItem(STORAGE_KEY_MATERIALS, JSON.stringify(materials));
  } catch (e) {
    console.error("Failed to save materials", e);
  }
}

const STORAGE_KEY_USER = "exam_planner_user_profile_v1";

export const DEFAULT_USER_PROFILE = {
  id: "user-default-101",
  name: "Alex Chen",
  email: "alex.chen@university.edu",
  avatar: "🎓",
  institution: "Computer Science & Engineering Dept",
  major: "Computer Science",
  targetDegreeOrGoal: "Fall Final Exams & GRE prep",
  isLoggedIn: true,
  memberSince: "2026-01-15",
  membershipTier: "Pro Student" as const,
  totalStudyMinutes: 2460,
  studyStreakDays: 12,
  completedExamsCount: 3,
};

export const DEMO_ACCOUNTS = [
  {
    id: "user-alex",
    name: "Alex Chen (陈博宇)",
    email: "alex.chen@cs.edu",
    avatar: "🎓",
    institution: "School of Computing",
    major: "Computer Science",
    targetDegreeOrGoal: "期末算法统考 90+ 与 保研冲刺",
    membershipTier: "Pro Student" as const,
    totalStudyMinutes: 2460,
    studyStreakDays: 12,
    completedExamsCount: 3,
  },
  {
    id: "user-sarah",
    name: "Sarah Li (李晓萱)",
    email: "sarah.li@med.edu",
    avatar: "🔬",
    institution: "School of Medicine",
    major: "Clinical Medicine & Physiology",
    targetDegreeOrGoal: "生理学综合统考 A 等级",
    membershipTier: "Master Scholar" as const,
    totalStudyMinutes: 3890,
    studyStreakDays: 24,
    completedExamsCount: 5,
  },
  {
    id: "user-david",
    name: "David Zhang (张浩然)",
    email: "david.zhang@econ.edu",
    avatar: "📊",
    institution: "School of Economics & Finance",
    major: "Quantitative Finance",
    targetDegreeOrGoal: "CFA 一级 & 计量经济学期末",
    membershipTier: "Pro Student" as const,
    totalStudyMinutes: 1720,
    studyStreakDays: 7,
    completedExamsCount: 2,
  },
];

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      return JSON.parse(raw);
    }
    return DEFAULT_USER_PROFILE;
  } catch (e) {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(profile));
  } catch (e) {
    console.error("Failed to save user profile", e);
  }
}

const STORAGE_KEY_SETTINGS = "exam_planner_app_settings_v1";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  defaultFocusDuration: 45,
  enableSoundAlerts: true,
  enableDailyReminders: true,
  firstDayOfWeek: "monday",
  dateFormat: "YYYY-MM-DD",
  rebalanceSensitivity: "balanced",
  defaultStudyPace: "spaced_repetition",
  autoSaveCloud: true,
  themeMode: "light",
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) {
      return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) };
    }
    return DEFAULT_APP_SETTINGS;
  } catch (e) {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save app settings", e);
  }
}

export const SAMPLE_PLANS: ExamStudyPlan[] = [getSamplePlan()];

export const APP_VERSION_DATA = {
  version: "v2.5.0",
  releaseName: "Notion Modular Hub & Intelligent Orchestrator",
  buildDate: "2026-08-18",
  buildNumber: "build-20260818.025",
  environment: "Production (Cloud Run Sandbox)",
  changelog: [
    {
      version: "v2.5.0",
      date: "2026-08-18",
      title: "系统配置中心、用户账户体系与多语言切换",
      highlights: [
        "全新多功能设置中心 (Configuration Modal)，涵盖专注时长、提醒音效与算法灵敏度配置",
        "完整用户登录与账户切换系统 (User Auth & Profiles)，支持多学科学生身份即时切换",
        "一键语言调节中心 (Multi-Language Settings)，支持中英双语即时切换与持久化存储",
        "版本档案与系统诊断看板 (Version Diagnostics & Changelog)，实时查看数据同步与运行状态",
      ],
    },
    {
      version: "v2.4.0",
      date: "2026-08-18",
      title: "科目专属层级化结构与子功能视图重构",
      highlights: [
        "重构左侧 Notion 树形导航：点击具体科目直接展开'每日清单'、'复习日历'、'进度追踪'与'知识库大纲'",
        "在页面顶部属性栏内置直观的子视图快速切换条，大幅提升科目备考上下文流转效率",
        "优化全学科备考总览主看板 (Master Study Hub) 作为统一工作区入口",
      ],
    },
    {
      version: "v2.3.0",
      date: "2026-08-17",
      title: "Active Recall 智能自测问答与考纲精通度跟踪",
      highlights: [
        "引入艾宾浩斯与费曼学习法的主动回忆 (Active Recall) 交互式测验弹窗",
        "支持考纲知识点掌握程度 (Mastery Score) 实时评级与薄弱考点重点标注",
        "新增考纲与真题试卷库分类知识库分类管理器 (Materials & Questions Hub)",
      ],
    },
    {
      version: "v2.2.0",
      date: "2026-08-16",
      title: "Notion 风格视觉规范与 ICS 日历同步",
      highlights: [
        "深度还原 Notion 风格渐变封面、属性矩阵与轻量卡片布局",
        "支持一键导出全套备考排程为标准 .ICS 格式，无缝导入 Google Calendar 与 Apple 日历",
      ],
    },
  ],
};
