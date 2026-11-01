import { ExamStudyPlan, StudyMaterial, AppSettings, DailyMemoNote } from "../types";

const LEGACY_STORAGE_KEY_PLANS = "exam_planner_saved_plans_v1";
const STORAGE_KEY_ACTIVE_ID = "exam_planner_active_plan_id_v1";
const STORAGE_KEY_DAILY_MEMOS = "exam_planner_daily_memos_v1";

const DB_NAME = "exam_planner_local";
const DB_VERSION = 1;
const PLAN_STORE = "plans";

export const DEFAULT_WEEK_SCHEDULE = [
  { dayOfWeek: 0, dayName: "周日", availableHours: 4, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 1, dayName: "周一", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 2, dayName: "周二", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 3, dayName: "周三", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 4, dayName: "周四", availableHours: 2.5, preferredTimeSlot: "evening" as const, enabled: true },
  { dayOfWeek: 5, dayName: "周五", availableHours: 2, preferredTimeSlot: "afternoon" as const, enabled: true },
  { dayOfWeek: 6, dayName: "周六", availableHours: 5, preferredTimeSlot: "morning" as const, enabled: true },
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

function openPlanDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is unavailable in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PLAN_STORE)) {
        db.createObjectStore(PLAN_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open local database"));
  });
}

function readLegacyPlans(): ExamStudyPlan[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY_PLANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only the exact old demo entries are discarded. Never filter by course name.
    return parsed.filter(
      (plan) => plan && typeof plan.id === "string" && plan.id !== "sample-plan-cs301" && !plan.id.startsWith("sample-")
    );
  } catch (e) {
    console.warn("Failed to read legacy plans", e);
    return [];
  }
}

export async function loadSavedPlans(): Promise<ExamStudyPlan[]> {
  try {
    const db = await openPlanDatabase();
    const plans = await new Promise<ExamStudyPlan[]>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readonly");
      const request = tx.objectStore(PLAN_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []) as ExamStudyPlan[]);
      request.onerror = () => reject(request.error || new Error("Failed to read local plans"));
      tx.oncomplete = () => db.close();
    });
    if (plans.length > 0) {
      return plans.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
  } catch (e) {
    console.warn("IndexedDB read failed, checking legacy localStorage", e);
  }

  const legacyPlans = readLegacyPlans();
  if (legacyPlans.length > 0) {
    try {
      await savePlans(legacyPlans);
      localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
    } catch (e) {
      console.warn("Legacy plan migration failed, keeping localStorage copy", e);
    }
  }
  return legacyPlans;
}

export async function savePlans(plans: ExamStudyPlan[]): Promise<void> {
  let indexedDbError: unknown = null;
  try {
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readwrite");
      const store = tx.objectStore(PLAN_STORE);
      store.clear();
      plans.forEach((plan) => store.put(plan));
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error || new Error("Failed to write local plans"));
      tx.onabort = () => reject(tx.error || new Error("Local write was aborted"));
    });
    localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
    return;
  } catch (e) {
    indexedDbError = e;
    console.warn("IndexedDB write failed, trying localStorage fallback", e);
  }

  try {
    localStorage.setItem(LEGACY_STORAGE_KEY_PLANS, JSON.stringify(plans));
  } catch (fallbackError) {
    console.error("All local persistence attempts failed", indexedDbError, fallbackError);
    throw new Error("本地存储写入失败，请导出备份并清理浏览器空间后重试。");
  }
}

export function getActivePlanId(): string {
  try {
    const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
    if (!activeId || activeId === "sample-plan-cs301" || activeId.startsWith("sample-")) {
      return "";
    }
    return activeId;
  } catch (e) {
    return "";
  }
}

export function setActivePlanId(id: string) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
    else localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  } catch (e) {
    console.warn("Failed to persist active plan id", e);
  }
}

export async function clearPlannerData(): Promise<void> {
  try {
    const db = await openPlanDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLAN_STORE, "readwrite");
      tx.objectStore(PLAN_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error || new Error("Failed to clear local plans"));
    });
  } catch (e) {
    console.warn("Failed to clear IndexedDB plans", e);
  }
  localStorage.removeItem(LEGACY_STORAGE_KEY_PLANS);
  localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  localStorage.removeItem(STORAGE_KEY_DAILY_MEMOS);
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    return { usage: estimate.usage || 0, quota: estimate.quota || 0 };
  } catch (e) {
    return null;
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

export const APP_VERSION_DATA = {
  version: "v3.0.0",
  releaseName: "Local-First Planning Edition",
  buildDate: "2026-10-31",
  buildNumber: "build-20261031.300",
  environment: "Local Browser (IndexedDB)",
  changelog: [
    {
      version: "v3.0.0",
      date: "2026-10-31",
      title: "本地优先、专注规划与安全加固",
      highlights: [
        "移除登录与云端同步：全部备考计划仅保存在当前浏览器 (IndexedDB)，旧版本地数据自动迁移",
        "移除生成测验与刷题功能：Exam Plan AI 专注考试规划与进度管理，练习与刷题请使用 StarQuiz",
        "AI 接口新增请求限流、输入上限与超时保护，文档解析失败时不再伪造资料内容",
        "新增数据备份导入/导出、存储占用诊断与写入失败提示",
      ],
    },
    {
      version: "v2.4.0",
      date: "2026-08-18",
      title: "科目层级导航与多视图重构",
      highlights: [
        "左侧树形导航支持直接展开每日清单、复习日历、进度追踪与考纲资料",
        "优化全学科备考总览看板，减少科目之间的上下文切换成本",
      ],
    },
    {
      version: "v2.2.0",
      date: "2026-08-16",
      title: "Notion 风格视觉规范与 ICS 日历同步",
      highlights: [
        "还原 Notion 风格渐变封面、属性矩阵与轻量卡片布局",
        "支持一键导出备考排程为标准 .ICS 格式，导入 Google Calendar 与 Apple 日历",
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

export function mergeDailyMemos(memos: Record<string, DailyMemoNote>): void {
  if (!memos || typeof memos !== "object") return;
  try {
    const all = getDailyMemos();
    Object.entries(memos).forEach(([date, memo]) => {
      if (memo && typeof memo.content === "string") {
        all[date] = memo;
      }
    });
    localStorage.setItem(STORAGE_KEY_DAILY_MEMOS, JSON.stringify(all));
  } catch (e) {
    console.error("Failed to import daily memos", e);
  }
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
