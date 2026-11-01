import React, { useState, useMemo } from "react";
import {
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { getAiFallbackNotice, readApiError } from "../lib/aiClient";
import { addDays, toLocalDateString } from "../lib/date";
import { DomainMasteryWheelChart } from "./DomainMasteryWheelChart";
import { PieChart } from "lucide-react";

interface RealTimeManagerProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
}

export function RealTimeManager({ plan, onUpdatePlan }: RealTimeManagerProps) {
  const { language } = useI18n();
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
        const res = await fetch("/api/rebalance-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPlan: plan,
            currentDate: todayStr,
            reason: rebalanceReason,
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
          notice = getAiFallbackNotice(data.meta, language);
        } else {
          const apiError = await readApiError(res, language);
          notice =
            language === "zh"
              ? `${apiError.message} 已改用本地排程规则。`
              : `${apiError.message} A local scheduling rule was used instead.`;
        }
      } catch (fetchErr) {
        console.warn("Network error during rebalance fetch, using local scheduler:", fetchErr);
        notice =
          language === "zh"
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
        <div className="p-3.5 bg-[#FCD33B] border border-[#111111] text-[#111111] font-mono text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="font-bold leading-relaxed">{aiNotice}</span>
          </div>
          <button
            onClick={() => setAiNotice(null)}
            className="px-2 py-0.5 border border-[#111111] text-[11px] hover:bg-[#111111] hover:text-white cursor-pointer shrink-0 ml-3"
          >
            [{language === "zh" ? "知道了" : "DISMISS"}]
          </button>
        </div>
      )}

      {plan?.phases && plan.phases.length > 0 && (
        <section className="space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-[#111111]">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#111111]" />
              <h3 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "备考阶段推进路线" : "PHASE REVIEW ROADMAP"}]
              </h3>
            </div>

            <button
              onClick={() => setShowRoadmap(!showRoadmap)}
              className="text-xs font-bold text-[#111111] hover:underline cursor-pointer"
            >
              [{showRoadmap ? (language === "zh" ? "收起" : "COLLAPSE") : (language === "zh" ? "展开" : "EXPAND")}]
            </button>
          </div>

          {showRoadmap && (
            <div className="bg-[#faf9f6] border border-[#111111] py-8 px-6 sm:px-12 select-none animate-fadeIn">
              <div className="relative">
                <div className="absolute left-6 sm:left-12 top-10 bottom-0 w-[1px] bg-[#111111]" />

                <div className="flex items-center space-x-4 mb-8">
                  <div className="w-12 h-12 rounded-full border border-[#999999] bg-[#eae8e1] flex items-center justify-center shrink-0 z-10">
                    <span className="text-[10px] font-bold text-[#666666]">
                      {daysUntilExam}D
                    </span>
                  </div>

                  <div className="text-xs text-[#555555] font-sans">
                    <span className="font-bold text-[#111111] text-sm tracking-wide">
                      {language === "zh" ? "备考推进全流程" : "Phase Timeline"}
                    </span>{" "}
                    <span className="text-xs text-[#888888]">
                      {language === "zh" ? `· 距离考试还有 ${daysUntilExam} 天` : `· ${daysUntilExam} days remaining`}
                    </span>
                  </div>
                </div>

                <div className="relative w-full border-t border-[#111111] my-4">
                  <div className="absolute left-6 sm:left-12 -translate-x-1/2 -top-3.5 bg-[#111111] text-white text-[11px] font-bold px-3.5 py-0.5 rounded-full flex items-center justify-center tracking-widest z-20 shadow-sm">
                    00
                  </div>
                </div>

                <div className="pt-8 space-y-10 sm:space-y-12">
                  {plan.phases.map((phase, pIdx) => {
                    const currentNum = String(pIdx + 1).padStart(2, "0");
                    const isCurrent = pIdx === 0;

                    return (
                      <div
                        key={phase.id || `phase-step-${pIdx}`}
                        className="relative flex items-center group"
                      >
                        <div className="absolute left-6 sm:left-12 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#111111] z-20 transition-transform group-hover:scale-125" />

                        <div className="pl-16 sm:pl-28 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-12 flex-1">
                          <span className="text-sm sm:text-base font-bold text-[#111111] tracking-widest shrink-0 w-10">
                            {currentNum}
                          </span>

                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-sm sm:text-base font-normal font-sans text-[#111111] tracking-tight">
                                {phase.name}
                              </span>

                              <span className="text-[10px] text-[#777777] font-mono border-b border-[#cccccc] pb-0.5">
                                {phase.startDate?.slice(5)} ~ {phase.endDate?.slice(5)}
                              </span>

                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-[#111111] text-white font-bold uppercase font-mono">
                                  {language === "zh" ? "进行中" : "CURRENT"}
                                </span>
                              )}
                            </div>

                            {phase.description && (
                              <p className="text-xs text-[#666666] leading-relaxed max-w-xl font-sans">
                                {phase.description || phase.focus}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="relative flex items-center pt-2">
                    <div className="absolute left-6 sm:left-12 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#111111] z-20" />

                    <div className="pl-16 sm:pl-28 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-12 flex-1">
                      <span className="text-sm sm:text-base font-bold text-[#111111] tracking-widest shrink-0 w-10">
                        {String(plan.phases.length + 1).padStart(2, "0")}
                      </span>
                      <div className="flex items-center space-x-3">
                        <span className="text-sm sm:text-base font-bold font-sans text-[#111111]">
                          {language === "zh" ? "终点 · 目标考试日" : "Final · Exam Day"}
                        </span>
                        <span className="text-xs text-[#111111] font-bold font-mono px-2 py-0.5 border border-[#111111] bg-white">
                          {plan.examDate || "--"} {plan.examTime || ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="space-y-3 font-mono">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#111111]">
          <RefreshCw className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold uppercase text-[#111111]">
            [{language === "zh" ? "计划动态重排" : "ADAPTIVE REBALANCE"}]
          </h3>
        </div>

        <div className="bg-white border border-[#111111] p-4 space-y-3">
          <p className="text-[11px] text-[#666666] leading-relaxed">
            {language === "zh"
              ? "当作息变动或出现积压任务时，可将未完成任务平摊到剩余备考时间。AI 不可用时会自动改用本地排程规则。"
              : "Redistribute overdue tasks across the remaining study days. If AI is unavailable, local scheduling rules are used automatically."}
          </p>

          <textarea
            value={rebalanceReason}
            onChange={(e) => setRebalanceReason(e.target.value)}
            rows={2}
            placeholder={language === "zh" ? "说明本次调整原因（可选）" : "Why are you rebalancing? (optional)"}
            className="w-full bg-[#faf9f6] border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none resize-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[10px] font-bold text-[#666666] uppercase">
              [{language === "zh" ? `积压任务 ${overdueCount} 项` : `${overdueCount} OVERDUE TASKS`}]
            </span>
            <button
              onClick={handleTriggerRebalance}
              disabled={isRebalancing}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
              <span>
                {isRebalancing
                  ? language === "zh"
                    ? "正在重排..."
                    : "REBALANCING..."
                  : language === "zh"
                    ? "重排剩余任务"
                    : "REBALANCE TASKS"}
              </span>
            </button>
          </div>

          {rebalanceError && (
            <div className="flex items-start space-x-2 p-2.5 bg-[#faf9f6] border border-[#111111] text-[11px] text-[#111111]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{rebalanceError}</span>
            </div>
          )}

          {rebalanceResultSummary && (
            <div className="flex items-start space-x-2 p-2.5 bg-[#faf9f6] border border-[#111111] text-[11px] text-[#111111]">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{rebalanceResultSummary}</span>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3 font-mono">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#111111]">
          <PieChart className="w-4 h-4 text-[#111111]" />
          <h3 className="text-xs font-bold uppercase text-[#111111]">
            [{language === "zh" ? "考点知识掌握度追踪" : "TOPIC MASTERY TRACKER"}]
          </h3>
        </div>

        <DomainMasteryWheelChart
          topics={topicMastery}
          language={language}
        />
      </section>
    </div>
  );
}
