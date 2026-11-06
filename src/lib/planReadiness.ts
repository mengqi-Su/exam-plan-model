import { ExamStudyPlan } from "../types";

/**
 * 「先把科目/考试建下来，资料回头再传」走的是一条数据线上的两种状态，不是两套科目。
 * 还差哪一步只在这里判一次：科目页的引导、总览卡的副标题与「进度」都读它。
 * 以前每个页面各自拿 tasks.length===0 猜，于是同一门科目一处写「待上传」、
 * 一处写「0% 进度」，用户分不清它是坏了还是还没开始。
 */
export type PlanReadiness = "ready" | "awaiting-materials" | "awaiting-generation";

export function planReadiness(plan?: ExamStudyPlan | null): PlanReadiness {
  if (!plan) return "ready";
  if (Array.isArray(plan.tasks) && plan.tasks.length > 0) return "ready";
  const hasMaterials = Array.isArray(plan.materials) && plan.materials.length > 0;
  const hasTopics = Array.isArray(plan.topics) && plan.topics.some((topic) => !!topic?.title?.trim());
  return hasMaterials || hasTopics ? "awaiting-generation" : "awaiting-materials";
}

/** 还没生成过计划的科目：任何「进度」口径都不该把它算成一个 0% 的正常计划。 */
export function isPlanPending(plan?: ExamStudyPlan | null): boolean {
  return planReadiness(plan) !== "ready";
}

export interface ReadinessCopy {
  title: string;
  action: string;
}

/**
 * 待生成状态下页头/卡片要说的那句话。生成动作本身只归向导一处，
 * 这里只负责把「差什么」说成一个词，不再补一段解释。
 */
export function readinessCopy(readiness: PlanReadiness, isZh: boolean): ReadinessCopy | null {
  if (readiness === "ready") return null;
  if (readiness === "awaiting-materials") {
    return {
      title: isZh ? "还没上传资料" : "No materials yet",
      action: isZh ? "去上传资料" : "Upload materials",
    };
  }
  return {
    title: isZh ? "还没生成计划" : "No plan yet",
    action: isZh ? "生成学习计划" : "Generate plan",
  };
}
