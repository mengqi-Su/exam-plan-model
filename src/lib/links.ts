import type { PlanTopicLevel } from "./topicKey";

export const STARQUIZ_URL = "https://starquiz-zfc3er164xi.qoder.zone";

/** 联动协议版本；StarQuiz 只在 v=1 且必要参数齐全时启用结果回流。 */
export const LINK_PROTOCOL_VERSION = "1";

export interface StarquizPracticeContext {
  /** 科目名称，用于在 StarQuiz 中定位/新建对应学科文件夹 */
  subject?: string;
  /** 目标考点展示名：单元级就是单元标题，子考点级是子考点标题 */
  topic?: string;
  /** 考试名称，用于在 StarQuiz 中展示备考上下文 */
  examName?: string;
  /** 联动协议 v1：Exam Plan 计划 ID，缺失时退化为普通跳转 */
  planId?: string;
  /** 联动协议 v1：目标层级，必须参与考点钥匙 */
  level?: PlanTopicLevel | string;
  /** 联动协议 v1：父单元标题；单元级目标时就是目标单元标题 */
  unit?: string;
  /** 来源任务日期，仅用于回程定位 */
  date?: string;
  /** 来源 StudyTask.id，仅用于回程定位任务，不作为考点身份 */
  taskId?: string;
}

function trimmed(value: unknown): string {
  return String(value === null || value === undefined ? "" : value).trim();
}

/**
 * 构造跳转到 StarQuiz 的「考点级」深链（同步函数，保持 `<a href>` 的即时交互）。
 *
 * 出站只传完整内容路径，不传考点钥匙：钥匙由 StarQuiz 入站后用同一算法异步计算，
 * 这样既不需要在点击事件里 await（会被浏览器当成非用户触发而拦截弹窗），
 * 也避免把可重算的派生值当权威数据传输。
 *
 * 必要参数（plan/level/subject/unit/topic）齐全时才带上 v=1 联动上下文；
 * 任一缺失就退化成旧的普通跳转，不启用练习结果自动回流。
 * 不传 back URL，回程固定使用 StarQuiz 里配置的 Exam Plan 站点地址，避免开放重定向。
 * 联动跳转使用当前标签页：Exam Plan 的 savePlans() 是防抖全量重写，
 * 双标签页并行会用旧状态覆盖新写入的数据。
 */
export function starquizPracticeUrl(ctx: StarquizPracticeContext = {}): string {
  const params = new URLSearchParams();
  params.set("from", "exam-plan");

  const subject = trimmed(ctx.subject);
  const topic = trimmed(ctx.topic);
  const exam = trimmed(ctx.examName);
  if (subject) params.set("subject", subject);
  if (topic) params.set("topic", topic);
  if (exam) params.set("exam", exam);

  const plan = trimmed(ctx.planId);
  const unit = trimmed(ctx.unit);
  const level = ctx.level === "unit" || ctx.level === "subtopic" ? ctx.level : "";
  if (plan && level && subject && unit && topic) {
    params.set("v", LINK_PROTOCOL_VERSION);
    params.set("plan", plan);
    params.set("level", level);
    params.set("unit", unit);
    const date = trimmed(ctx.date);
    if (date) params.set("date", date);
    const task = trimmed(ctx.taskId);
    if (task) params.set("task", task);
  }

  return `${STARQUIZ_URL}/?${params.toString()}`;
}

/** 从计划数据模型解析出的一条完整考点路径。 */
export interface PracticeTopicPath {
  level: PlanTopicLevel;
  subject: string;
  unit: string;
  topic: string;
}

interface PlanLike {
  id: string;
  subject?: string;
  examName?: string;
  preferences?: { subject?: string };
  topics?: Array<{
    id: string;
    title: string;
    subtopics?: string[];
    subtopicTree?: Array<{ title?: string; name?: string }>;
  }>;
}

interface TaskLike {
  topicId?: string;
  topicTitle: string;
}

/**
 * 把「今日任务」反解成完整内容路径：先按 task.topicId 找父单元，
 * 再用 task.topicTitle 精确匹配单元标题或该单元下的子考点标题。
 *
 * 找不到、匹配不唯一，或单元与子考点同时同名（层级本身有歧义）时返回 null，
 * 由调用方退化为旧链接——绝不按标题文本猜路径。
 */
export function resolvePracticeTopicPath(plan: PlanLike | undefined | null, task: TaskLike | undefined | null): PracticeTopicPath | null {
  if (!plan || !task) return null;
  const subject = trimmed(plan.subject) || trimmed(plan.preferences?.subject);
  const wanted = trimmed(task.topicTitle);
  if (!subject || !wanted) return null;

  const units = (plan.topics || []).filter((unit) => unit && unit.id === task.topicId);
  if (units.length !== 1) return null;
  const unit = units[0];
  const unitTitle = trimmed(unit.title);
  if (!unitTitle) return null;

  // subtopicTree 与 subtopics 是同一批子考点的两种表示（树视图优先读 tree，缺失才回退字符串），
  // 因此按标题去重后再判断命中，否则同名子考点会被计成两次、把可联动的路径误判为歧义。
  const subtitles = new Set([
    ...(unit.subtopicTree || []).map((sub) => trimmed(sub?.title || sub?.name || "")),
    ...(unit.subtopics || []).map((sub) => trimmed(sub)),
  ]);
  const subtopicMatches = subtitles.has(wanted);

  const unitMatches = unitTitle === wanted;
  if (unitMatches && subtopicMatches) return null; // 同名时层级歧义，不猜
  if (unitMatches) return { level: "unit", subject, unit: unitTitle, topic: unitTitle };
  if (subtopicMatches) return { level: "subtopic", subject, unit: unitTitle, topic: wanted };
  return null;
}

/** 今日任务入口：能解析出完整路径就带联动上下文，否则退化为旧链接。 */
export function starquizPracticeUrlForTask(plan: PlanLike | undefined | null, task: TaskLike | undefined | null, extra: { examName?: string; date?: string; taskId?: string } = {}): string {
  const path = resolvePracticeTopicPath(plan, task);
  if (!path) {
    return starquizPracticeUrl({
      subject: trimmed((plan && (plan.subject || plan.preferences?.subject)) || ""),
      topic: trimmed(task?.topicTitle),
      examName: extra.examName,
    });
  }
  return starquizPracticeUrl({
    subject: path.subject,
    unit: path.unit,
    topic: path.topic,
    level: path.level,
    planId: trimmed(plan?.id),
    examName: extra.examName,
    date: extra.date,
    taskId: extra.taskId,
  });
}
