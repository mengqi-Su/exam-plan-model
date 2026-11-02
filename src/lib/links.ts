export const STARQUIZ_URL = "https://starquiz-zfc3er164xi.qoder.zone";

export interface StarquizPracticeContext {
  /** 科目名称，用于在 StarQuiz 中定位/新建对应学科文件夹 */
  subject?: string;
  /** 考点（大单元或细分考点）名称，作为出题聚焦提示 */
  topic?: string;
  /** 考试名称，用于在 StarQuiz 中展示备考上下文 */
  examName?: string;
}

/**
 * 构造跳转到 StarQuiz 的「考点级」深链。
 * StarQuiz 读取 from=exam-plan 后会定位/新建学科、预开 AI 出题弹窗，
 * 并以 subject/topic/exam 作为上下文横幅与返回入口的依据。
 * 仅做导航跳转，不跨域同步任何本地数据。
 */
export function starquizPracticeUrl(ctx: StarquizPracticeContext = {}): string {
  const params = new URLSearchParams();
  params.set("from", "exam-plan");
  const subject = (ctx.subject || "").trim();
  const topic = (ctx.topic || "").trim();
  const exam = (ctx.examName || "").trim();
  if (subject) params.set("subject", subject);
  if (topic) params.set("topic", topic);
  if (exam) params.set("exam", exam);
  return `${STARQUIZ_URL}/?${params.toString()}`;
}