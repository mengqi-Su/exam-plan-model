import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { ExamStudyPlan } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { getAiFallbackNotice, runGeneration } from "../lib/aiClient";
import { addDays, toLocalDateString } from "../lib/date";
import { SectionBlock } from "./SectionBlock";

interface RebalanceSectionProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
}

/**
 * 动态重排：低频工具，所以默认只留一个动作。
 * 点了「重排剩余任务」才展开原因输入与确认，跑完的结果留在内容区。
 */
export function RebalanceSection({ plan, onUpdatePlan }: RebalanceSectionProps) {
  const { language } = useI18n();
  const isZh = language === "zh";
  const todayStr = useMemo(() => toLocalDateString(), []);

  const [armed, setArmed] = useState(false);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceReason, setRebalanceReason] = useState(
    isZh
      ? "前几天有未完成的复习模块，请将剩余任务平摊到后续时间"
      : "Missed study blocks from previous days, rebalance remaining tasks evenly"
  );
  const [rebalanceResultSummary, setRebalanceResultSummary] = useState<string | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const overdueCount = useMemo(
    () =>
      (plan.tasks || []).filter(
        (t) => t.date < todayStr && t.status !== "completed" && t.status !== "skipped"
      ).length,
    [plan.tasks, todayStr]
  );

  const localRebalance = () => {
    const overdueTasks = (plan.tasks || []).filter(
      (t) => t.date < todayStr && t.status !== "completed" && t.status !== "skipped"
    );
    const completedOrCurrent = (plan.tasks || []).filter(
      (t) => t.date >= todayStr || t.status === "completed" || t.status === "skipped"
    );
    return {
      tasks: [
        ...completedOrCurrent,
        ...overdueTasks.map((t, idx) => ({
          ...t,
          date: addDays(todayStr, Math.floor(idx / 2)),
          priority: "high" as const,
          status: "pending" as const,
        })),
      ],
      rebalanceSummary: isZh
        ? `已为您将 ${overdueTasks.length} 项积压任务智能重新平摊排程至今天及未来几天，避免考前突击负担。`
        : `Successfully rescheduled ${overdueTasks.length} overdue tasks into upcoming study sessions.`,
    };
  };

  const handleTriggerRebalance = async () => {
    setIsRebalancing(true);
    setRebalanceError(null);
    setRebalanceResultSummary(null);
    setAiNotice(null);

    try {
      let data: { rebalanceSummary?: string; tasks?: ExamStudyPlan["tasks"] } | null = null;
      let notice: string | null = null;
      try {
        const { result, meta } = await runGeneration<{ rebalanceSummary?: string; tasks?: any[] }>(
          "rebalance",
          { currentPlan: plan, currentDate: todayStr, reason: rebalanceReason },
          { language }
        );
        data = result;
        notice = getAiFallbackNotice(meta, language);
      } catch (fetchErr: any) {
        console.warn("Rebalance via AI failed, using local scheduler:", fetchErr);
        const msg = fetchErr?.message;
        notice = msg
          ? isZh
            ? `${msg} 已改用本地排程规则。`
            : `${msg} A local scheduling rule was used instead.`
          : isZh
            ? "无法连接 AI 服务，已改用本地排程规则重排计划。"
            : "Could not reach the AI service. A local scheduling rule was used instead.";
      }

      if (!data || !Array.isArray(data.tasks)) {
        if (!notice) {
          notice = isZh
            ? "AI 未返回有效排程，已改用本地排程规则。"
            : "AI returned no usable schedule. A local scheduling rule was used instead.";
        }
        data = localRebalance();
      }

      setAiNotice(notice);
      onUpdatePlan({ ...plan, tasks: data.tasks, updatedAt: new Date().toISOString() });
      setRebalanceResultSummary(
        data.rebalanceSummary ||
          (isZh ? "学习计划已根据剩余天数平摊与动态重排！" : "Study plan successfully rebalanced across remaining days!")
      );
      playCompletionChime();
      setArmed(false);
    } catch (err: any) {
      console.error("Rebalance failed:", err);
      setRebalanceError(isZh ? "计划重排失败，请稍后重试。" : "Rebalance failed. Please try again later.");
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <SectionBlock
      title={isZh ? "计划动态重排" : "Adaptive rebalance"}
      aside={
        <span className="inline-flex items-center gap-1.5 ui-row-meta tabular-nums">
          <span
            className={`w-1.5 h-1.5 rounded-full ${overdueCount > 0 ? "bg-[#B42318]" : "bg-[#cfc9c0]"}`}
            aria-hidden="true"
          />
          {isZh ? `积压 ${overdueCount} 项` : `${overdueCount} overdue`}
        </span>
      }
      action={
        !armed && (
          <button
            onClick={() => setArmed(true)}
            disabled={isRebalancing}
            className="ui-btn ui-btn-ghost px-2.5 py-1 text-[12px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
            <span>{isRebalancing ? (isZh ? "重排中…" : "Rebalancing…") : isZh ? "重排剩余任务" : "Rebalance tasks"}</span>
          </button>
        )
      }
    >
      {armed && (
        <div className="ui-card p-4 sm:p-5 space-y-3 animate-fadeIn">
          <textarea
            value={rebalanceReason}
            onChange={(e) => setRebalanceReason(e.target.value)}
            rows={2}
            placeholder={isZh ? "例如：这几天加班，只周末能学" : "e.g. busy on weekdays, only weekends free"}
            className="ui-field resize-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleTriggerRebalance}
              disabled={isRebalancing}
              className="ui-btn ui-btn-primary px-3.5 py-1.5 text-[12px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
              <span>{isRebalancing ? (isZh ? "正在重排…" : "Rebalancing…") : isZh ? "确认重排" : "Confirm"}</span>
            </button>
            <button
              onClick={() => setArmed(false)}
              disabled={isRebalancing}
              className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
            >
              {isZh ? "取消" : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {aiNotice && (
        <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-[#f0e2c0] bg-[#FFF6DD] px-3.5 py-3 text-[12px] text-[#8A5A00] animate-fadeIn">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{aiNotice}</span>
          </div>
          <button
            onClick={() => setAiNotice(null)}
            className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
          >
            {isZh ? "知道了" : "Dismiss"}
          </button>
        </div>
      )}

      {rebalanceError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f0d0cc] bg-[#FDF0EE] p-2.5 text-[12px] text-[#B42318]">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{rebalanceError}</span>
        </div>
      )}

      {rebalanceResultSummary && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#d8e4dc] bg-[#EEF4EF] p-2.5 text-[12px] text-[#3F6B4F]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{rebalanceResultSummary}</span>
        </div>
      )}
    </SectionBlock>
  );
}
