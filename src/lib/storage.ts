import { ExamStudyPlan, StudyMaterial, UserStudyPreferences, UserProfile, AppSettings, DailyMemoNote } from "../types";

const STORAGE_KEY_PLANS = "exam_planner_saved_plans_v1";
const STORAGE_KEY_ACTIVE_ID = "exam_planner_active_plan_id_v1";
const STORAGE_KEY_MATERIALS = "exam_planner_materials_v1";
const STORAGE_KEY_DAILY_MEMOS = "exam_planner_daily_memos_v1";

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
    id: "doc-syllabus-1",
    name: "CS 301 高级算法与数据结构 官方考试大纲与分值权重分布",
    type: "syllabus",
    categoryGroup: "course_syllabus",
    topicTag: "官方考试大纲",
    difficulty: "medium",
    yearOrTerm: "2025/2026 学年大纲",
    uploadedAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    sizeBytes: 1024 * 16,
    summaryNotes: "官方考试大纲明确规定了 5 大核心板块（平衡搜索树、图算法与网络流、动态规划、NP完全性、随机算法与平摊分析）及对应分值权重占比。",
    content: `【CS 301 高级算法与数据结构 官方课程考纲】
考试形式：闭卷统考 (180分钟，满分 100 分)

一、各模块权重与核心考查要求：
1. 平衡搜索树与优先队列 (占比 20%)：
   - 红黑树五大性质、插入/删除旋转修复推导
   - 斐波那契堆平摊复杂度分析 (Potential Method)
2. 图算法与网络流建模 (占比 25%)：
   - 最短路径 Dijkstra、Bellman-Ford 负权环判断
   - 最大流最小割定理、Ford-Fulkerson 与 Dinic 算法
   - 强连通分量 Tarjan 算法
3. 动态规划与贪心策略 (占比 30%)：
   - 背包问题、最长公共子序列、区间 DP
   - 树形 DP (最大权独立集)、状态压缩 DP (旅行商 TSP)
4. 计算复杂性与 NP 完全性 (占比 15%)：
   - P、NP、NP-Hard、NP-Complete 定义与多项式归约
   - 3-SAT 到顶点覆盖/独立集的归约构造
5. 随机化算法与平摊分析 (占比 10%)：
   - 跳表 (Skip List) 查找期望、布隆过滤器`,
  },
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
    id: "doc-slides-1",
    name: "高级算法与数据结构 核心授课讲义 (第1-5周精编)",
    type: "lecture_slides",
    categoryGroup: "study_material",
    topicTag: "动态规划与状压位运算",
    difficulty: "hard",
    yearOrTerm: "教授授课课件",
    uploadedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    sizeBytes: 1024 * 22,
    summaryNotes: "包含背包问题、区间 DP、树形 DP、状压 DP 及斜率优化 DP 状态转移范式与经典例题推导。",
    content: `【高级算法与数据结构 核心授课讲义】

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
  {
    id: "doc-notes-1",
    name: "算法复杂度、主定理与平衡搜索树 核心公式速查笔记",
    type: "notes",
    categoryGroup: "study_material",
    topicTag: "平衡搜索树与堆结构",
    difficulty: "medium",
    yearOrTerm: "学生速查笔记",
    uploadedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    sizeBytes: 1024 * 15,
    summaryNotes: "整理了红黑树 5 大不变性定律、主定理 (Master Theorem) 3 种情况分界线、势能法证明公式。",
    content: `【CS 301 核心定理与公式速查笔记】

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
        title: "第 1 单元：平衡搜索树与堆结构",
        category: "数据结构",
        difficulty: "medium",
        userKnowledgeLevel: "intermediate",
        weightPercentage: 20,
        estimatedHours: 8,
        subtopics: ["红黑树旋转平衡", "AVL 树平衡因子", "B+ 树磁盘索引", "斐波那契堆"],
        subtopicTree: [
          {
            title: "红黑树 (Red-Black Tree) 性质与旋转平衡",
            keyPoints: ["黑高一致性定理推导", "插入时叔节点为红/黑的处理", "删除黑色节点双黑调整"],
            difficulty: "hard",
            examFrequency: "high",
            formulaOrTrap: "最长路径长度不超过最短路径长度的 2 倍",
          },
          {
            title: "AVL 树与自平衡搜索",
            keyPoints: ["LL、RR、LR、RL 四种单双旋转判定", "平衡因子 Balance Factor 计算"],
            difficulty: "medium",
            examFrequency: "medium",
          },
          {
            title: "B 树与 B+ 树磁盘索引结构",
            keyPoints: ["阶数 m 与关键字个数范围 [ceil(m/2)-1, m-1]", "B+ 树叶子节点双向链表与范围查询"],
            difficulty: "medium",
            examFrequency: "high",
          },
          {
            title: "斐波那契堆与平摊时间复杂度",
            keyPoints: ["Decrease-Key 级联剪枝 (Cascading Cut)", "平摊复杂度 O(1) 与 Extract-Min O(log n)"],
            difficulty: "hard",
            examFrequency: "low",
          },
        ],
      },
      {
        id: "top-2",
        title: "第 2 单元：图算法与网络流",
        category: "图论",
        difficulty: "hard",
        userKnowledgeLevel: "beginner",
        weightPercentage: 25,
        estimatedHours: 12,
        subtopics: ["Dijkstra 与 Bellman-Ford", "Floyd-Warshall", "Edmonds-Karp 最大流", "Tarjan 强连通分量"],
        subtopicTree: [
          {
            title: "单源最短路 (SSSP) 算法对比",
            keyPoints: ["Dijkstra 贪心策略与斐波那契堆优化 O(V log V + E)", "Bellman-Ford 负权环检测与 SPFA 队列优化"],
            difficulty: "medium",
            examFrequency: "high",
            formulaOrTrap: "Dijkstra 无法处理负权边的本质原因",
          },
          {
            title: "多源最短路与传递闭包",
            keyPoints: ["Floyd-Warshall 三重循环 k 的外层枚举次序", "动态规划矩阵状态转移 d[i][j] = min(d[i][j], d[i][k]+d[k][j])"],
            difficulty: "medium",
            examFrequency: "medium",
          },
          {
            title: "网络流与最大流最小割定理",
            keyPoints: ["Edmonds-Karp 与 Dinic 算法残量网络构建", "增广路 (Augmenting Path) 与反向边流量回退", "最大流最小割 (Max-Flow Min-Cut) 等价证明"],
            difficulty: "hard",
            examFrequency: "high",
            formulaOrTrap: "割的容量计算仅统计从 S 到 T 方向的有向边",
          },
          {
            title: "有向图连通性与 Tarjan 算法",
            keyPoints: ["深度优先搜索生成树与返祖边/横叉边", "时间戳 dfn 与追溯值 low 的更新条件", "二分图最大匹配与 Kőnig 最小点覆盖定理"],
            difficulty: "hard",
            examFrequency: "high",
          },
        ],
      },
      {
        id: "top-3",
        title: "第 3 单元：动态规划与状压位运算",
        category: "算法设计",
        difficulty: "hard",
        userKnowledgeLevel: "beginner",
        weightPercentage: 30,
        estimatedHours: 14,
        subtopics: ["0/1 与完全背包", "最长公共子序列 (LCS)", "矩阵链乘法", "状态压缩 DP"],
        subtopicTree: [
          {
            title: "背包问题模型族",
            keyPoints: ["0/1 背包空间优化逆序枚举容量", "完全背包正序枚举容量", "多重背包单调队列/二进制拆分优化"],
            difficulty: "medium",
            examFrequency: "high",
          },
          {
            title: "区间与序列 DP",
            keyPoints: ["最长公共子序列 (LCS) 与最长递增子序列 (LIS) O(n log n)", "矩阵链乘法最优加括号与区间长度枚举"],
            difficulty: "medium",
            examFrequency: "high",
          },
          {
            title: "树形动态规划",
            keyPoints: ["树的最大独立集 (包含根/不包含根)", "树的直径两遍 DFS 或单遍 DP 推导"],
            difficulty: "hard",
            examFrequency: "high",
          },
          {
            title: "状态压缩 DP 与 TSP 问题",
            keyPoints: ["二进制状态集合表示与位运算 `mask & (1 << j)`", "旅行商 TSP 状态转移方程 O(n^2 * 2^n)"],
            difficulty: "hard",
            examFrequency: "high",
            formulaOrTrap: "外层循环必须按 mask 升序递增以保证无后效性",
          },
        ],
      },
      {
        id: "top-4",
        title: "第 4 单元：NP 完全性与归约证明",
        category: "计算复杂度",
        difficulty: "medium",
        userKnowledgeLevel: "intermediate",
        weightPercentage: 15,
        estimatedHours: 5,
        subtopics: ["P 与 NP 概念", "3-SAT 经典归约", "顶点覆盖与独立集", "近似算法"],
        subtopicTree: [
          {
            title: "计算复杂性分类理论",
            keyPoints: ["P、NP、NP-Hard、NP-Complete 严格定义", "多项式时间判定与多项式时间可验证证书 (Certificate)"],
            difficulty: "medium",
            examFrequency: "high",
          },
          {
            title: "经典多项式时间归约证明链",
            keyPoints: ["Cook-Levin 定理与 SAT/3-SAT 问题", "3-SAT -> Independent Set (独立集) Gadget 构造", "Independent Set <-> Vertex Cover (顶点覆盖) 补图等价性"],
            difficulty: "hard",
            examFrequency: "high",
            formulaOrTrap: "证明新问题 Q 是 NPC：先证 Q 属于 NP，再将已知 NPC 问题归约至 Q",
          },
          {
            title: "NP 难问题的近似算法",
            keyPoints: ["近似比 (Approximation Ratio) 定义", "顶点覆盖 2-近似算法极长匹配证明"],
            difficulty: "medium",
            examFrequency: "medium",
          },
        ],
      },
      {
        id: "top-5",
        title: "第 5 单元：随机算法与平摊分析",
        category: "高级数据结构",
        difficulty: "easy",
        userKnowledgeLevel: "advanced",
        weightPercentage: 10,
        estimatedHours: 3,
        subtopics: ["布隆过滤器原理", "跳表概率分析", "势能法平摊分析"],
        subtopicTree: [
          {
            title: "概率数据结构与布隆过滤器",
            keyPoints: ["k 个独立哈希函数位图映射", "假阳性 (False Positive) 冲突率推导与最优 k = (m/n)ln2", "无假阴性 (No False Negative) 本质"],
            difficulty: "medium",
            examFrequency: "high",
          },
          {
            title: "跳表 (Skip List) 随机化索引",
            keyPoints: ["节点层高几何分布随机生成 (p = 1/2)", "期望空间复杂度 O(n) 与期望查询步数 O(log n)"],
            difficulty: "easy",
            examFrequency: "medium",
          },
          {
            title: "平摊分析三种方法",
            keyPoints: ["聚合分析法 (Aggregate Analysis)", "记账法 (Accounting Method)", "势能函数法 (Potential Method) 与动态数组扩容分析"],
            difficulty: "medium",
            examFrequency: "medium",
          },
        ],
      },
    ],
    tasks: generateSample21DaysTasks(startDateStr, examDateStr, formatDate),
    materials: INITIAL_SAMPLE_DOCUMENTS,
  };
}

function generateSample21DaysTasks(startDateStr: string, examDateStr: string, formatDate: (d: Date) => string) {
  const start = new Date(startDateStr);
  const tasks: any[] = [];

  const syllabusUnits = [
    {
      topic: "平衡搜索树与堆结构",
      cat: "theory",
      title: "红黑树 4 种旋转情况与黑高不变性推导",
      desc: "手绘红黑树插入删除 4 种旋转情形，推导树高上限 h <= 2*log(n+1)。",
      obj: ["掌握左旋与右旋操作及指针维护", "验证黑高一致性规则与性质定理"],
      recall: "红黑树插入修复中，叔父节点为红色与黑色时分别如何处理？",
      need: "匹配高分目标：深入掌握平衡树核心理论与定理推导",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "一、选择题 第1题",
        excerpt: "在一棵包含 n 个节点的红黑树中，从根到叶最长路径最多是最短路径的 2 倍。性质：根为黑，无连续红节点，黑高一致。",
      }
    },
    {
      topic: "平衡搜索树与堆结构",
      cat: "practice_problems",
      title: "B 树与 B+ 树特性对比与磁盘 I/O 范围查询实战",
      desc: "分析 B+ 树叶子双向链表在大数据范围检索中的磁盘 I/O 优势。",
      obj: ["计算分支因子 B 下树高及节点上限", "追踪双向叶子节点范围遍历流程"],
      recall: "为什么数据库索引普遍采用 B+ 树而不是红黑树或标准 B 树？",
      need: "针对【大题计算与综合推导】需求，强化外存索引模型",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 1：平衡搜索树与堆结构",
        excerpt: "B 树与 B+ 树：磁盘页索引结构、多路搜索节点。要求重点掌握阶数 M 下最大关键字数推导及范围扫描复杂度。",
      }
    },
    {
      topic: "图算法与网络流",
      cat: "practice_problems",
      title: "Dijkstra 与 Bellman-Ford 边界用例专项强化",
      desc: "精解 5 道图论最短路真题，对比非负权图与负权环图的算法行为。",
      obj: ["解释为何 Dijkstra 在负权边下失效", "推导 Bellman-Ford 松弛 |V|-1 轮检测负环的原理"],
      recall: "Bellman-Ford 算法如何严格判断有向图中是否存在负权回路？",
      need: "针对用户薄弱知识点【图算法与网络流】分配专项攻坚学时",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "一、选择题 第2题 & 二、图论大题",
        excerpt: "斐波那契堆实现 Dijkstra 算法时，整体时间复杂度为 O(V log V + E)。当存在负权回路时需采用 Bellman-Ford 松弛判断。",
      }
    },
    {
      topic: "图算法与网络流",
      cat: "theory",
      title: "Edmonds-Karp 与 Dinic 算法最大流最小割定理证明",
      desc: "推导残留网络、增广路定理以及最大流最小割容量等价性定理。",
      obj: ["准确计算残留容量与反向弧流量更新", "从可达残留点集确定最小 s-t 割集"],
      recall: "请复述最大流最小割定理，并说明为什么最小割容量必然等于最大流流量？",
      need: "重点攻坚历年期末 30 分大题【网络流建模归约】",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "二、网络流与图论建模大题 第3-4题",
        excerpt: "二分图最大匹配转化为最大流：源点 S 连 L，L 连 R，R 连 T。证明最大流值等于二分图最大匹配数。利用 Ford-Fulkerson 整数定理证明。",
      }
    },
    {
      topic: "动态规划与状压位运算",
      cat: "practice_problems",
      title: "0/1 背包状态转移矩阵与空间压缩演练",
      desc: "构建 2D DP 状态转移表并将其优化为单行 1D 数组倒序遍历。",
      obj: ["推导状态转移方程 DP[i][w] = max(DP[i-1][w], DP[i-1][w-wt[i]] + val[i])", "解释 1D 数组为何必须倒序遍历"],
      recall: "0/1 背包一维滚动数组中，为什么内层循环必须从后向前倒序遍历？",
      need: "强化高分核心模块【动态规划与状压位运算】",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 3：动态规划与分治策略",
        excerpt: "经典 DP：0/1 背包、完全背包、最长公共子序列 (LCS)、矩阵链乘法。要求熟练推导状态转移方程并掌握滚动数组空间优化。",
      }
    },
    {
      topic: "动态规划与状压位运算",
      cat: "theory",
      title: "树形 DP 与最长无相交独立集状态设计",
      desc: "精讲树形 DP 经典例题：选择根节点与不选择根节点时的子树最优权值转移。",
      obj: ["设计 dp[u][0] 与 dp[u][1] 的自底向上树形递归遍历", "分析时间复杂度 O(N)"],
      recall: "树形最大独立集问题中，当节点 u 被选中时，其子节点 v 允许被选中吗？",
      need: "攻坚期末高分大题【树形 DP 状态转移】",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "三、动态规划大题 第5题",
        excerpt: "树形最大独立集：dp[u][0] = ∑ max(dp[v][0], dp[v][1])，dp[u][1] = w[u] + ∑ dp[v][0]。",
      }
    },
    {
      topic: "动态规划与状压位运算",
      cat: "mock_exam",
      title: "阶段诊断限时小模考 (45分钟)",
      desc: "全真限时闭卷：涵盖平衡树、图论最短路与背包 DP 综合大题。",
      obj: ["全真模拟考试作答节奏与时间分配", "自评批改并记录第 2 阶段需攻坚的易错盲区"],
      recall: "交卷后立即归纳本次模考用时最长或犹豫的知识点类型。",
      need: "满足【智能穿插全真阶段模考】设置，检验阶段知识吸收效果",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "综合阶段测验卷",
        excerpt: "限时 45 分钟全真模考，精选历年期末核心必考大题，考察综合建模能力与定理推导严谨性。",
      }
    },
    {
      topic: "NP 完全性与归约证明",
      cat: "theory",
      title: "P vs NP 体系与多项式时间归约基本法则",
      desc: "梳理判定问题、可验证性与 3-SAT 经典规约到顶点覆盖的构造方法。",
      obj: ["理解多项式时间归约 A <=p B 的保真性", "写出从 3-SAT 到 Independent Set 的构造组件"],
      recall: "如果发现某个 NP-Complete 问题能在多项式时间内求解，将引发什么结论？",
      need: "掌握大纲占比 15% 的理论证明大题",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 4：NP 完全性与近似算法",
        excerpt: "复杂度类别：P、NP、NP-Hard、NP-Complete。多项式时间归约：3-SAT 归约至顶点覆盖与独立集。",
      }
    },
    {
      topic: "NP 完全性与归约证明",
      cat: "practice_problems",
      title: "顶点覆盖与独立集 2-近似算法真题推导",
      desc: "求解近似比证明：证明贪心极长匹配边集给出的顶点覆盖大小 <= 2 * OPT。",
      obj: ["推导近似比下界与上界", "掌握常见 NP-Hard 问题的近似策略"],
      recall: "顶点覆盖 2-近似算法中，为什么选出的极长匹配边数 <= OPT？",
      need: "突破理论大题证明与近似算法分析",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "四、NP 完全性证明大题 第7题",
        excerpt: "已知 3-SAT 问题是 NP-Complete，请通过构造多项式时间归约证明 独立集 (Independent Set) 问题也是 NP-Complete。",
      }
    },
    {
      topic: "随机算法与跳表分析",
      cat: "reading",
      title: "布隆过滤器哈希冲突率与跳表概率结构研读",
      desc: "推导布隆过滤器在 m 位数组、k 个哈希函数下的最佳 k 值公式 k = (m/n)*ln2。",
      obj: ["掌握布隆过滤器的假阳性 (False Positive) 概率推导", "理解跳表层高几何分布及 O(log n) 期望查找步数"],
      recall: "布隆过滤器能否产生假阴性 (False Negative)？为什么？",
      need: "掌握高级数据结构与概率算法考点",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 5：随机算法与平摊分析",
        excerpt: "通用哈希与布隆过滤器 (Bloom Filters)。跳表 (Skip List) 概率分析。聚合分析与势能法。",
      }
    },
    {
      topic: "图算法与网络流",
      cat: "active_recall",
      title: "Tarjan 强连通分量与二分图最大匹配主动回忆",
      desc: "不看讲义，独立画出 Tarjan 算法的 dfn 与 low 数组更新逻辑与缩点步骤。",
      obj: ["默写 Tarjan 算法栈维护与回溯更新条件", "推导二分图最小点覆盖等于最大匹配数 (Kőnig 定理)"],
      recall: "Tarjan 算法中，什么时候 `low[u] = min(low[u], dfn[v])`？为什么此时用的是 dfn[v]？",
      need: "艾宾浩斯强化：主动检索图论高难度知识点",
      rag: {
        docName: "图论网络流与最短路 经典易错考题精编",
        docType: "past_exam",
        section: "题 2：Tarjan 算法求强连通分量",
        excerpt: "Tarjan 算法中 dfn[u] 与 low[u] 的更新条件区分（搜索树边 vs 栈内反向边）。",
      }
    },
    {
      topic: "动态规划与状压位运算",
      cat: "practice_problems",
      title: "状态压缩 DP 旅行商 TSP 经典大题演练",
      desc: "使用 dp[mask][i] 表示经过集合 mask 且当前停在节点 i 时的最短路径转移演练。",
      obj: ["掌握位运算 `mask & (1 << j)` 与 `mask | (1 << j)` 的状态转移", "分析时间复杂度 O(n^2 * 2^n)"],
      recall: "在状压 TSP 中，外层循环为什么必须按 mask 从 1 到 (1<<n)-1 递增遍历？",
      need: "攻克 15 分状压 DP 期末压轴大题",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "三、动态规划大题 第6题",
        excerpt: "状态压缩 DP：给定 n ≤ 16 个城市的旅行商问题 (TSP)，求从起点 0 出发经过所有城市恰好一次的最短路径。dp[mask][i] 转移方程。",
      }
    },
    {
      topic: "平衡搜索树与堆结构",
      cat: "active_recall",
      title: "斐波那契堆势能法平摊时间分析与主动回忆",
      desc: "定义势能函数 Φ(H) = t(H) + 2*m(H)，推导 Decrease-Key 的 O(1) 平摊复杂度。",
      obj: ["掌握级联剪切 (Cascading Cut) 机制", "严谨写出势能差 ΔΦ 的放缩推导"],
      recall: "为什么斐波那契堆的 Decrease-Key 操作平摊时间为 O(1)？",
      need: "突破平摊分析难点与高级堆结构原理",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 1：平衡搜索树与堆结构",
        excerpt: "斐波那契堆与二项队列：平摊时间复杂度分析，势能法证明。",
      }
    },
    {
      topic: "图算法与网络流",
      cat: "mock_exam",
      title: "网络流与图论综合模块深度模考 (60分钟)",
      desc: "限时闭卷演练：Dijkstra 堆优化、Bellman-Ford 负环判定、二分图匹配与最大流建模。",
      obj: ["检验图论大题在时间压力下的建模与规范答题能力", "总结常见建图易错边界与反向边残留容量遗漏"],
      recall: "在网络流建图中，当遇到'点容量'限制时，通常采用什么标准拆点技巧？",
      need: "强化图论压轴大题答题手感与得分率",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "二、网络流与图论建模大题 第3-4题",
        excerpt: "综合网络流建模与复杂度分析试题。",
      }
    },
    {
      topic: "动态规划与状压位运算",
      cat: "practice_problems",
      title: "最长公共子序列 (LCS) 与矩阵链乘法最优括号化",
      desc: "推导区间 DP 状态转移方程与动态规划填表几何方向。",
      obj: ["掌握区间 DP 循环枚举长度 len 的标准写法", "熟练还原括号化路径解"],
      recall: "区间 DP 填表时，为什么最外层循环必须按区间长度 len 递增？",
      need: "巩固动态规划基础大题，确保拿满基础过程分",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 3：动态规划与分治策略",
        excerpt: "经典 DP：最长公共子序列 (LCS)、矩阵链乘法最优括号化。",
      }
    },
    {
      topic: "NP 完全性与归约证明",
      cat: "active_recall",
      title: "NP 经典问题规约链图谱默写与框架复盘",
      desc: "闭卷默写 3-SAT -> Independent Set -> Vertex Cover -> Set Cover 规约链。",
      obj: ["在白纸上完整画出 NP-Complete 经典归约关系网", "复述每个归约中的 Gadget 构造部件"],
      recall: "如何证明一个新问题 Q 是 NP-Complete 的？需要满足哪两个严格条件？",
      need: "理论大题考前框架固化，防止概念混淆",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "模块 4：NP 完全性与近似算法",
        excerpt: "多项式时间归约：3-SAT 归约至顶点覆盖与独立集。",
      }
    },
    {
      topic: "综合全真模拟",
      cat: "mock_exam",
      title: "2025年 期末统考全真模拟卷 (3小时完整仿真)",
      desc: "严格按照考试时间 180 分钟闭卷全真作答，覆盖选择题、图论、DP 与 NP 证明全题型。",
      obj: ["体验 180 分钟真实考试作答节奏与体能分配", "严格对照参考评分标准自评纠错"],
      recall: "交卷后统计各题型失分比例，锁定最后 3 天需冲刺急救的考点。",
      need: "全真模拟，校准实战答题节奏与临场心理状态",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "全套期末模拟试卷 (100分)",
        excerpt: "2025年 秋季学期 CS 301 高级算法与数据结构 期末全真试卷 (A卷)，考试时间 180 分钟，满分 100 分。",
      }
    },
    {
      topic: "错题归纳与专项攻坚",
      cat: "review_weak_spots",
      title: "全真模考错题精析与高频失分点深度复盘",
      desc: "针对模考中扣分的树形 DP 边界与 Tarjan 缩点细节重新推导。",
      obj: ["重做模考错题并书写标准解题得分步骤", "建立个人避坑清单"],
      recall: "回顾本次模考中最容易马虎的 2 个计算或边界细节。",
      need: "查漏补缺，消除所有已暴露的扣分漏洞",
      rag: {
        docName: "图论网络流与最短路 经典易错考题精编",
        docType: "past_exam",
        section: "易错考题汇总",
        excerpt: "错题归纳与解题避坑要点。",
      }
    },
    {
      topic: "全科目考前冲刺",
      cat: "summary_cheat_sheet",
      title: "考前核心公式定理急救清单与速记卡片速览",
      desc: "快速过一遍红黑树黑高定理、Dijkstra 堆优化复杂度、最大流最小割、DP 转移方程与 NP 归约关系图。",
      obj: ["熟记所有控制方程与渐近复杂度上界", "保持清晰敏锐的头脑与专注度"],
      recall: "闭眼在脑海中快速过一遍 5 个模块的核心思维导图主干。",
      need: "考前 2 天高密度强化记忆，建立峰值知识调用能力",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "全模块重点速查表",
        excerpt: "全课程考点速览与高频公式总结。",
      }
    },
    {
      topic: "考前心态与答题规范",
      cat: "summary_cheat_sheet",
      title: "考前答题规范确认、文具证件准备与心理调适",
      desc: "核对准考证、考试时间与考场规则，早睡早起，以饱满自信的精神状态迎考。",
      obj: ["确认考试时间地点与必需文具", "温习大题规范书写步骤，确保拿满步骤分"],
      recall: "大题如果遇到完全没思路的题目，如何写出部分定义和已知条件拿步骤分？",
      need: "考前最后一天，确保生理与心理处于最佳竞技状态",
      rag: {
        docName: "CS 301：高级数据结构与算法 课程大纲",
        docType: "syllabus",
        section: "期末考试考生须知",
        excerpt: "闭卷考试，请携带学生证与黑色签字笔。规范书写解题步骤。",
      }
    },
    {
      topic: "期末考试",
      cat: "mock_exam",
      title: "期末统考：CS 301 高级算法与数据结构",
      desc: "正式参加期末大考。保持自信，沉着冷静，斩获 A+ 卓越成绩！",
      obj: ["认真审题，规范答题", "合理分配 180 分钟时间，先易后难"],
      recall: "沉着冷静，发挥出平时复习的最高水平！",
      need: "达成目标【A (95分+ / 卓越)】",
      rag: {
        docName: "2025年 高级算法与数据结构 期末统考真题 (A卷)",
        docType: "past_exam",
        section: "正式考场",
        excerpt: "CS 301 期末统考。",
      }
    },
  ];

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const curDate = new Date(start.getTime() + dayOffset * 86400000);
    const dateStr = formatDate(curDate);
    const unit = syllabusUnits[dayOffset % syllabusUnits.length];
    const isToday = dayOffset === 0;

    tasks.push({
      id: `task-d${dayOffset}-1`,
      title: unit.title,
      description: unit.desc,
      category: unit.cat,
      topicTitle: unit.topic,
      date: dateStr,
      startTime: dayOffset % 2 === 0 ? "18:00" : "19:00",
      endTime: dayOffset % 2 === 0 ? "19:15" : "20:30",
      durationMinutes: unit.cat === "mock_exam" ? (dayOffset === 16 ? 180 : 60) : 45,
      priority: unit.cat === "mock_exam" || dayOffset >= 16 ? "high" : "medium",
      status: isToday ? "completed" : "pending",
      keyObjectives: unit.obj,
      activeRecallPrompt: unit.recall,
      confidenceRating: isToday ? 4 : undefined,
      notes: isToday ? "复习效果良好，已完全理解核心推导。" : undefined,
      actualMinutesSpent: isToday ? 50 : undefined,
      groundedUserNeed: unit.need,
      ragSource: {
        documentName: unit.rag.docName,
        documentType: unit.rag.docType as any,
        sectionTitle: unit.rag.section,
        pageOrChapter: `第 ${(dayOffset % 5) + 1} 单元`,
        excerptSnippet: unit.rag.excerpt,
        keyConcepts: [unit.topic, "核心定理", "典型题型", "易错点"],
        relevanceReason: "命中了考纲核心考点与历年高频真题",
      },
      formulaOrRules: [`${unit.topic} 核心控制方程与推导准则`, `边界约束: 变量取值区间需满足定理定义域`],
      practiceQuestionRef: `《历年真题期末卷》第 ${(dayOffset % 6) + 1} 题`,
    });
  }

  return tasks;
}

export function loadSavedPlans(): ExamStudyPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    if (!raw) {
      return [];
    }
    const parsed: ExamStudyPlan[] = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      // Remove any legacy sample plan so user starts with a clean slate
      const realPlans = parsed.filter(
        (p) =>
          p.id !== "sample-plan-cs301" &&
          !p.id?.startsWith("sample-") &&
          !p.examName?.includes("CS 301") &&
          !p.examName?.includes("高级算法与数据结构")
      );
      if (realPlans.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(realPlans));
        if (localStorage.getItem(STORAGE_KEY_ACTIVE_ID) === "sample-plan-cs301") {
          localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
        }
      }
      return realPlans;
    }
    return [];
  } catch (e) {
    console.error("Failed to load plans from localStorage", e);
    return [];
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
  const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  if (!activeId || activeId === "sample-plan-cs301" || activeId.startsWith("sample-")) {
    return "";
  }
  return activeId;
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

// 本地访客模式：无需登录，默认即为已登录的本地访客，数据保存在当前浏览器
export const DEFAULT_USER_PROFILE: UserProfile = {
  id: "local-guest",
  name: "本地访客",
  email: "",
  avatar: "🎓",
  institution: "",
  major: "",
  targetDegreeOrGoal: "",
  isLoggedIn: true,
  memberSince: new Date().toISOString().slice(0, 10),
  membershipTier: "Free",
  totalStudyMinutes: 0,
  studyStreakDays: 0,
  completedExamsCount: 0,
};

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 仅清理遗留的演示账号；游客模式下其余档案一律保留并视为已登录（本地访客）
      if (
        !parsed ||
        typeof parsed !== "object" ||
        parsed.id === "user-default-101" ||
        parsed.id === "user-alex" ||
        parsed.id === "user-sarah" ||
        parsed.id === "user-david" ||
        parsed.id?.startsWith("user-demo") ||
        parsed.email?.includes("alex.chen") ||
        parsed.email?.includes("sarah.li") ||
        parsed.email?.includes("david.zhang") ||
        parsed.name === "Alex Chen" ||
        parsed.name === "陈博宇" ||
        parsed.name === "李晓萱" ||
        parsed.name === "张浩然" ||
        parsed.name === "备考学员"
      ) {
        localStorage.removeItem(STORAGE_KEY_USER);
        return DEFAULT_USER_PROFILE;
      }
      return { ...parsed, isLoggedIn: true };
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

export function clearUserSessionData() {
  try {
    localStorage.removeItem(STORAGE_KEY_PLANS);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
    localStorage.removeItem(STORAGE_KEY_MATERIALS);
    localStorage.removeItem(STORAGE_KEY_DAILY_MEMOS);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch (e) {
    console.error("Failed to clear user session data", e);
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

export function getDailyMemos(): Record<string, DailyMemoNote> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DAILY_MEMOS);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error("Failed to parse daily memos", e);
    return {};
  }
}

export function getDailyMemo(date: string): DailyMemoNote | null {
  const all = getDailyMemos();
  return all[date] || null;
}

export function saveDailyMemo(date: string, data: { content?: string; mood?: DailyMemoNote["mood"]; tags?: string[] }): Record<string, DailyMemoNote> {
  try {
    const all = getDailyMemos();
    const existing = all[date] || { date, content: "", updatedAt: new Date().toISOString() };
    const updated: DailyMemoNote = {
      ...existing,
      ...data,
      date,
      updatedAt: new Date().toISOString(),
    };

    if (!updated.content?.trim() && !updated.mood && (!updated.tags || updated.tags.length === 0)) {
      delete all[date];
    } else {
      all[date] = updated;
    }

    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
    return all;
  } catch (e) {
    console.error("Failed to save daily memo", e);
    return {};
  }
}

export function deleteDailyMemo(date: string): Record<string, DailyMemoNote> {
  try {
    const all = getDailyMemos();
    delete all[date];
    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
    return all;
  } catch (e) {
    console.error("Failed to delete daily memo", e);
    return {};
  }
}
