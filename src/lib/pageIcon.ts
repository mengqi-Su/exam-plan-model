import { ExamStudyPlan } from "../types";

/**
 * 页面图标 = 「这份科目文档是什么」的第一线索。
 *
 * 规则只有一条：凡是把科目当作一份文档来点名的地方（侧栏条目、总览卡、日详情标签、页头），
 * 都取同一个 planIcon；而日历格里那颗按课程上色的点是「任务色标」，不承担身份，两者不混用。
 *
 * 没显式选图标时按学科/名称关键词自动配，配不出就落到中性的 📚。绝不随机——
 * 同一科目在不同位置渲染成不同图标，身份就散了。
 */

/** 编辑窗口里可挑的图标；按备考常见学科排布，够用且不铺满一屏。 */
export const PAGE_ICON_CHOICES = [
  "📐",
  "🧮",
  "📊",
  "⚗️",
  "🔬",
  "🧬",
  "🧲",
  "🌍",
  "💻",
  "🧠",
  "🩺",
  "📜",
  "⚖️",
  "🏛️",
  "💹",
  "🔤",
  "🎼",
  "🎨",
  "🏗️",
  "⚙️",
  "🗄️",
  "🎓",
  "🧭",
  "📚",
];

const KEYWORD_ICONS: [string[], string][] = [
  [["数学", "高数", "线性代数", "概率", "统计", "微积分", "math", "calculus", "algebra", "statistic", "geometry"], "📐"],
  [["经济", "金融", "会计", "财务", "market", "finance", "economi", "account"], "💹"],
  [["物理", "力学", "电磁", "quantum", "physics"], "🧲"],
  [["化学", "chemical", "chemistry", "organic"], "⚗️"],
  [["生物", "生物化", "genetic", "biology", "molecu"], "🧬"],
  [["医学", "护理", "解剖", "临床", "medic", "nursing", "anatom"], "🩺"],
  [["心理", "cognit", "psycholog"], "🧠"],
  [["计算机", "软件", "程序", "算法", "数据", "code", "programming", "computer", "algorithm", "database", "network"], "💻"],
  [["语文", "中文", "文学", "汉语", "历史", "考古", "literature", "chinese", "history"], "📜"],
  [["政治", "法律", "法学", "马克思", "philosoph", "politic", "law", "legal"], "⚖️"],
  [["英语", "日语", "韩语", "法语", "德语", "俄语", "外语", "雅思", "托福", "english", "japanese", "french", "german"], "🔤"],
  [["地理", "地质", "环境", "environment", "geograph", "geolog"], "🌍"],
  [["建筑", "工程", "机械", "电气", "土木", "architect", "engineer", "mechanic", "civil"], "🏗️"],
  [["音乐", "美术", "设计", "艺术", "music", "art", "design"], "🎨"],
  [["管理", "工商", "人力", "营销", "management", "business", "marketing"], "🗄️"],
  [["教育", "师范", "teach", "educat"], "🎓"],
  [["导游", "旅游", "酒店", "travel", "tourism", "hospitality"], "🧭"],
];

/** 按学科与名称自动配一个图标；关键词命中第一个就用，命不中落到 📚。 */
export function autoPageIcon(subject?: string, examName?: string): string {
  const haystack = `${subject || ""} ${examName || ""}`.toLowerCase();
  for (const [keys, emoji] of KEYWORD_ICONS) {
    if (keys.some((key) => haystack.includes(key.toLowerCase()))) return emoji;
  }
  return "📚";
}

/** 计划自己的图标优先，其次自动配。 */
export function planIcon(plan: Pick<ExamStudyPlan, "icon" | "subject" | "examName">): string {
  const custom = (plan?.icon || "").trim();
  if (custom) return custom;
  return autoPageIcon(plan?.subject, plan?.examName);
}
