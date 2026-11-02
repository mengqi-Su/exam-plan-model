import React, { useState, useMemo } from "react";
import {
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  PieChart,
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { getAiFallbackNotice, runGeneration } from "../lib/aiClient";
import { addDays, toLocalDateString } from "../lib/date";
import { DomainMasteryWheelChart } from "./DomainMasteryWheelChart";

interface RealTimeManagerProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
}

export function RealTimeManager({ plan, onUpdatePlan }: RealTimeManagerProps) {
  const { language } = useI18n();
  const isZh = language === "zh";
  const todayStr = useMemo(() => toLocalDateString(), []);

  const [showRoadmap, setShowRoadmap] = useState(true);

  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceReason, setRebalanceReason] = useState(
    language === "zh"
      ? "前几天有未完成的复习模块，请将剩余任务平摊到后续时间"
      : "Missed study blocks from previous days, rebalance remaining tasks evenly"
  );
  const [rebalanceResultSummary, setRebalanceResultSummary] = useState<string | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  const daysUntilExam = useMemo(() => {
    if (!plan.examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = plan.examDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [plan.examDate]);

  const overdueCount = useMemo(
    () =>
      (plan.tasks || []).filter(
        (t) => t.date < todayStr && t.status !== "completed" && t.status !== "skipped"
      ).length,
    [plan.tasks, todayStr]
  );

  const topicMastery = useMemo(() => {
    return (plan.topics || []).map((top) => {
      const topicTasks = plan.tasks.filter((t) => t.topicTitle === top.title);
      const done = topicTasks.filter((t) => t.status === "completed");

      const ratings = done.map((t) => t.confidenceRating || 3);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const progressPercent =
        topicTasks.length > 0 ? Math.round((done.length / topicTasks.length) * 100) : 0;

      return {
        ...top,
        totalTasks: topicTasks.length,
        completedTasks: done.length,
        progressPercent,
        avgRating,
      };
    });
  }, [plan.topics, plan.tasks]);

  const handleTriggerRebalance = async () => {
    setIsRebalancing(true);
    setRebalanceError(null);
    setRebalanceResultSummary(null);
    setAiNotice(null);

    try {
      let data: any = null;
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
          ? language === "zh"
            ? `${msg} 已改用本地排程规则。`
            : `${msg} A local scheduling rule was used instead.`
          : language === "zh"
            ? "无法连接 AI 服务，已改用本地排程规则重排计划。"
            : "Could not reach the AI service. A local scheduling rule was used instead.";
      }

      if (!data || !data.tasks || !Array.isArray(data.tasks)) {
        if (!notice) {
          notice =
            language === "zh"
              ? "AI 未返回有效排程，已改用本地排程规则。"
              : "AI returned no usable schedule. A local scheduling rule was used instead.";
        }

        const overdueTasks = (plan.tasks || []).filter(
          (t) => t.date < todayStr && t.status !== "completed" && t.status !== "skipped"
        );
        const completedOrCurrent = (plan.tasks || []).filter(
          (t) => t.date >= todayStr || t.status === "completed" || t.status === "skipped"
        );
        const rebalancedTasks = [
          ...completedOrCurrent,
          ...overdueTasks.map((t, idx) => {
            const shiftDays = Math.floor(idx / 2);
            const targetDate = addDays(todayStr, shiftDays);
            return {
              ...t,
              date: targetDate,
              priority: "high" as const,
              status: "pending" as const,
            };
          }),
        ];
        data = {
          tasks: rebalancedTasks,
          rebalanceSummary:
            language === "zh"
              ? `已为您将 ${overdueTasks.length} 项积压任务智能重新平摊排程至今天及未来几天，避免考前突击负担。`
              : `Successfully rescheduled ${overdueTasks.length} overdue tasks into upcoming study sessions.`,
        };
      }

      if (data.tasks && Array.isArray(data.tasks)) {
        setAiNotice(notice);
        onUpdatePlan({
          ...plan,
          tasks: data.tasks,
          updatedAt: new Date().toISOString(),
        });
        setRebalanceResultSummary(
          data.rebalanceSummary ||
            (language === "zh"
              ? "学习计划已根据剩余天数平摊与动态重排！"
              : "Study plan successfully rebalanced across remaining days!")
        );
        playCompletionChime();
      }
    } catch (err: any) {
      console.error("Rebalance failed:", err);
      setRebalanceError(
        language === "zh" ? "计划重排失败，请稍后重试。" : "Rebalance failed. Please try again later."
      );
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <div className="space-y-8">
      {aiNotice && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#f0e2c0] bg-[#FFF6DD] px-3.5 py-3 text-[12.5px] text-[#8A5A00] animate-fadeIn">
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

      {plan?.phases && plan.phases.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 ui-subtle" />
              <h3 className="text-[14px] font-semibold text-[#1c1b1a]">
                {isZh ? "备考阶段推进路线" : "Phase review roadmap"}
              </h3>
            </div>
            <button
              onClick={() => setShowRoadmap(!showRoadmap)}
              className="inline-flex items-center gap-1 text-[12px] font-medium ui-muted hover:text-[#1c1b1a] transition-colors cursor-pointer"
            >
              {showRoadmap ? (isZh ? "收起" : "Collapse") : isZh ? "展开" : "Expand"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showRoadmap ? "rotate-180" : ""}`} />
            </button>
          </div>

          {showRoadmap && (
            <div className="ui-card p-5 sm:p-7 select-none animate-fadeIn">
              <div className="flex items-center gap-3.5 mb-6">
                <div className="w-11 h-11 rounded-full bg-[#f1efe9] flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-semibold tabular-nums text-[#1c1b1a]">{daysUntilExam}D</span>
                </div>
                <div className="text-[13px] min-w-0">
                  <span className="font-semibold text-[#1c1b1a]">
                    {isZh ? "备考推进全流程" : "Phase timeline"}
                  </span>
                  <span className="ui-muted">
                    {" · "}
                    {isZh ? `距离考试还有 ${daysUntilExam} 天` : `${daysUntilExam} days remaining`}
                  </span>
                </div>
              </div>

              <ol className="relative space-y-6">
                <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[#eae7e1]" aria-hidden="true" />

                {plan.phases.map((phase, pIdx) => {
                  const isCurrent = pIdx === 0;
                  return (
                    <li key={phase.id || `phase-step-${pIdx}`} className="relative flex gap-4 group">
                      <span
                        className={`relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-white transition-transform group-hover:scale-125 ${
                          isCurrent ? "bg-[#1c1b1a]" : "bg-[#cfc9c0]"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="text-[11px] font-medium tabular-nums ui-subtle">
                            {String(pIdx + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[14px] font-medium text-[#1c1b1a] tracking-tight">
                            {phase.name}
                          </span>
                          <span className="ui-chip tabular-nums">
                            {phase.startDate?.slice(5)} ~ {phase.endDate?.slice(5)}
                          </span>
                          {isCurrent && (
                            <span className="inline-flex items-center rounded-full bg-[#1c1b1a] text-white px-2 py-0.5 text-[10px] font-medium">
                              {isZh ? "进行中" : "Current"}
                            </span>
                          )}
                        </div>
                        {phase.description && (
                          <p className="mt-1 text-[12.5px] ui-muted leading-relaxed max-w-xl">
                            {phase.description || phase.focus}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}

                <li className="relative flex gap-4">
                  <span className="relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-white bg-[#FCD33B]" />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[11px] font-medium tabular-nums ui-subtle">
                      {String(plan.phases.length + 1).padStart(2, "0")}
                    </span>
                    <span className="text-[14px] font-semibold text-[#1c1b1a]">
                      {isZh ? "终点 · 目标考试日" : "Final · Exam day"}
                    </span>
                    <span className="ui-chip tabular-nums">
                      {plan.examDate || "—"} {plan.examTime || ""}
                    </span>
                  </div>
                </li>
              </ol>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 ui-subtle" />
          <h3 className="text-[14px] font-semibold text-[#1c1b1a]">
            {isZh ? "计划动态重排" : "Adaptive rebalance"}
          </h3>
        </div>

        <div className="ui-card p-4 space-y-3">
          <p className="text-[12.5px] ui-muted leading-relaxed">
            {isZh
              ? "当作息变动或出现积压任务时，可将未完成任务平摊到剩余备考时间。AI 不可用时会自动改用本地排程规则。"
              : "Redistribute overdue tasks across the remaining study days. If AI is unavailable, local scheduling rules are used automatically."}
          </p>

          <textarea
            value={rebalanceReason}
            onChange={(e) => setRebalanceReason(e.target.value)}
            rows={2}
            placeholder={isZh ? "说明本次调整原因（可选）" : "Why are you rebalancing? (optional)"}
            className="w-full rounded-lg bg-[#faf9f6] border border-[#e5e2dc] px-3 py-2 text-[13px] text-[#1c1b1a] placeholder-[#a39e97] focus:outline-none focus:border-[#cfc9c0] resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] ui-muted tabular-nums">
              {isZh ? `积压任务 ${overdueCount} 项` : `${overdueCount} overdue tasks`}
            </span>
            <button
              onClick={handleTriggerRebalance}
              disabled={isRebalancing}
              className="ui-btn ui-btn-primary px-3.5 py-1.5 text-[12px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
              <span>
                {isRebalancing
                  ? isZh
                    ? "正在重排…"
                    : "Rebalancing…"
                  : isZh
                    ? "重排剩余任务"
                    : "Rebalance tasks"}
              </span>
            </button>
          </div>

          {rebalanceError && (
            <div className="flex items-start gap-2 rounded-lg border border-[#f0d0cc] bg-[#FDF0EE] p-2.5 text-[12px] text-[#B42318]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{rebalanceError}</span>
            </div>
          )}

          {rebalanceResultSummary && (
            <div className="flex items-start gap-2 rounded-lg border border-[#d8e4dc] bg-[#EEF4EF] p-2.5 text-[12px] text-[#3F6B4F]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{rebalanceResultSummary}</span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 ui-subtle" />
          <h3 className="text-[14px] font-semibold text-[#1c1b1a]">
            {isZh ? "考点知识掌握度追踪" : "Topic mastery tracker"}
          </h3>
        </div>

        <DomainMasteryWheelChart topics={topicMastery} language={language} />
      </section>
    </div>
  );
}