import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { ExamStudyPlan } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { getAiFallbackNotice, localRebalanceNotice, runGeneration } from "../lib/aiClient";
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
      ? "前几天有没完成的复习模块，请把剩余任务平摊到后面几天"
      : "Some study blocks slipped in the last few days, spread the remaining tasks over the next days"
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
      /* 一句实话：一项都没积压时不能说「已平摊 N 项」，N=0 的句子等于宣布了一件没发生的事。 */
      rebalanceSummary: overdueTasks.length
        ? isZh
          ? `已把 ${overdueTasks.length} 项积压任务平摊到今天起的几天里。`
          : `Rescheduled ${overdueTasks.length} overdue tasks over the next few days.`
        : isZh
          ? "没有积压的任务，计划保持不变。"
          : "Nothing was behind schedule, so the plan stayed as it was.",
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
        notice = localRebalanceNotice(fetchErr?.message, isZh);
      }

      if (!data || !Array.isArray(data.tasks)) {
        if (!notice) {
          notice = localRebalanceNotice(isZh ? "AI 没有返回可用的排程" : "AI returned no usable schedule", isZh);
        }
        data = localRebalance();
      }

      setAiNotice(notice);
      onUpdatePlan({ ...plan, tasks: data.tasks, updatedAt: new Date().toISOString() });
      setRebalanceResultSummary(
        data.rebalanceSummary ||
          (isZh ? "学习计划已按剩余天数重新平摊。" : "Study plan rebalanced across the remaining days.")
      );
      playCompletionChime();
      setArmed(false);
    } catch (err: any) {
      console.error("Rebalance failed:", err);
      setRebalanceError(isZh ? "计划重排没有成功，请重试。" : "Rebalance failed. Try again.");
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
              <span>{isRebalancing ? (isZh ? "重排中…" : "Rebalancing…") : isZh ? "确认重排" : "Confirm"}</span>
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
