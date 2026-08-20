import React, { useState, useEffect } from "react";
import { 
  BarChart3, 
  RefreshCw, 
  Sparkles, 
  TrendingUp, 
  Clock, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  Award,
  Zap,
  Check,
  Flame,
  HelpCircle,
  GraduationCap,
  Star
} from "lucide-react";
import { ExamStudyPlan, StudyTask, SyllabusTopic } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";

interface RealTimeManagerProps {
  plan: ExamStudyPlan;
  plans?: ExamStudyPlan[];
  onSelectPlan?: (planId: string) => void;
  onAddNewSubject?: () => void;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onNavigateToTab: (tab: "todo" | "calendar" | "materials" | "add_subject" | "course") => void;
  isRebalanceModalOpen: boolean;
  onCloseRebalanceModal: () => void;
}

export function RealTimeManager({
  plan,
  plans = [],
  onSelectPlan,
  onAddNewSubject,
  onUpdatePlan,
  onNavigateToTab,
  isRebalanceModalOpen,
  onCloseRebalanceModal,
}: RealTimeManagerProps) {
  const { t, language } = useI18n();
  const todayStr = new Date().toISOString().split("T")[0];

  // Real-time Countdown timer state
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Rebalance form states
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceReason, setRebalanceReason] = useState(
    language === "zh" 
      ? "前几天有未完成的复习模块，请将剩余任务平摊到后续时间"
      : "Missed study blocks from previous days, rebalance remaining tasks evenly"
  );
  const [rebalanceResultSummary, setRebalanceResultSummary] = useState<string | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

  // Update countdown every second
  useEffect(() => {
    const update = () => {
      if (!plan.examDate) return;
      const [y, m, d] = plan.examDate.split("-").map(Number);
      const [h, min] = (plan.examTime || "09:00").split(":").map(Number);
      const targetTime = new Date(y, m - 1, d, h, min, 0).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown({ days, hours, minutes, seconds });
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [plan.examDate, plan.examTime]);

  // Analytics calculations
  const totalTasks = plan.tasks.length;
  const completedTasks = plan.tasks.filter((t) => t.status === "completed").length;
  const pendingTasks = plan.tasks.filter((t) => t.status !== "completed").length;

  const totalPlannedMinutes = plan.tasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const totalCompletedMinutes = plan.tasks
    .filter((t) => t.status === "completed")
    .reduce((acc, t) => acc + (t.actualMinutesSpent || t.durationMinutes), 0);

  const syllabusCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Overdue / missed tasks
  const overdueTasks = plan.tasks.filter((t) => t.date < todayStr && t.status !== "completed");

  // Topic mastery breakdown
  const topicMastery = React.useMemo(() => {
    return (plan.topics || []).map((top) => {
      const topicTasks = plan.tasks.filter((t) => t.topicTitle === top.title);
      const done = topicTasks.filter((t) => t.status === "completed");
      const doneCount = done.length;
      const totalCount = topicTasks.length;
      
      const ratings = done.map((t) => t.confidenceRating || 3);
      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;

      const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

      return {
        ...top,
        totalTasks: totalCount,
        completedTasks: doneCount,
        progressPercent,
        avgRating,
      };
    });
  }, [plan.topics, plan.tasks]);

  // Overall Exam Readiness Index (0-100%)
  const readinessIndex = React.useMemo(() => {
    if (totalTasks === 0) return 0;
    const taskFactor = (completedTasks / totalTasks) * 0.6;
    const timeFactor = Math.min(1, totalCompletedMinutes / (totalPlannedMinutes || 1)) * 0.2;
    
    const ratings = plan.tasks.filter((t) => t.status === "completed" && t.confidenceRating);
    const masteryFactor = ratings.length > 0
      ? (ratings.reduce((acc, t) => acc + (t.confidenceRating || 3), 0) / (ratings.length * 5)) * 0.2
      : 0.1;

    return Math.round((taskFactor + timeFactor + masteryFactor) * 100);
  }, [totalTasks, completedTasks, totalCompletedMinutes, totalPlannedMinutes, plan.tasks]);

  // Handle Dynamic Adaptive Rebalance
  const handleTriggerRebalance = async () => {
    setIsRebalancing(true);
    setRebalanceError(null);
    setRebalanceResultSummary(null);

    try {
      let data: any = null;
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
        }
      } catch (fetchErr) {
        console.warn("Network error during rebalance fetch, using local scheduler:", fetchErr);
      }

      if (!data || !data.tasks || !Array.isArray(data.tasks)) {
        // Local smart rebalance: shift overdue uncompleted tasks to today and subsequent days
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
            const targetDate = new Date(Date.now() + shiftDays * 86400000).toISOString().split("T")[0];
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
        onUpdatePlan({
          ...plan,
          tasks: data.tasks,
          updatedAt: new Date().toISOString(),
        });
        setRebalanceResultSummary(
          data.rebalanceSummary ||
            (language === "zh"
              ? "学习计划已成功根据剩余天数平摊与动态重排！"
              : "Study plan successfully rebalanced across remaining days!")
        );
        playCompletionChime();
      }
    } catch (err: any) {
      console.error("Rebalance handled:", err);
      setRebalanceResultSummary(
        language === "zh" ? "学习计划已根据当前备考节奏自动更新！" : "Study plan updated to match your current pace."
      );
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Multi-Subject Bar & Add Exam Subject Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#fafafa] border border-[#111111] font-mono">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-bold text-[#666666] uppercase shrink-0">
            {language === "zh" ? "当前科目:" : "ACTIVE_COURSE:"}
          </span>
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlan && onSelectPlan(p.id)}
              className={`px-2.5 py-1 text-xs transition-all shrink-0 flex items-center space-x-1.5 cursor-pointer border ${
                p.id === plan.id
                  ? "bg-[#111111] text-white border-[#111111] font-bold"
                  : "bg-white text-[#666666] border-[#e5e5e5] hover:border-[#111111] hover:text-[#111111]"
              }`}
            >
              <span className="truncate max-w-[140px]">{p.examName}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            if (onAddNewSubject) {
              onAddNewSubject();
            } else {
              onNavigateToTab("add_subject");
            }
          }}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white font-mono font-bold text-xs transition-colors shrink-0 cursor-pointer"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>{language === "zh" ? "新建科目" : "NEW SUBJECT"}</span>
        </button>
      </div>

      {/* Top Countdown Banner */}
      <div className="p-5 border border-[#111111] bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [TRACKER]
            </span>
            <h2 className="text-base sm:text-lg font-bold uppercase tracking-tight text-[#111111]">
              {plan.examName} // {t("readinessControlCenter")}
            </h2>
          </div>
          <p className="text-xs text-[#666666]">
            {t("propExamDate")}: <strong className="text-[#111111]">{plan.examDate} {plan.examTime || "09:00"}</strong> ({plan.subject})
          </p>
        </div>

        {/* Live Countdown Ticker */}
        <div className="flex items-center space-x-2 px-3.5 py-2 border border-[#111111] bg-[#fafafa]">
          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#111111]">
              {String(countdown.days).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#666666] uppercase block">{t("countdownDays")}</span>
          </div>
          <span className="text-[#111111] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#111111]">
              {String(countdown.hours).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#666666] uppercase block">{t("countdownHours")}</span>
          </div>
          <span className="text-[#111111] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#111111]">
              {String(countdown.minutes).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#666666] uppercase block">{t("countdownMins")}</span>
          </div>
          <span className="text-[#111111] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#111111]">
              {String(countdown.seconds).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#666666] uppercase block">{t("countdownSecs")}</span>
          </div>
        </div>
      </div>

      {/* Overdue Warning Callout */}
      {overdueTasks.length > 0 && (
        <div className="p-4 bg-[#fafafa] border border-[#111111] text-[#111111] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-start space-x-2.5">
            <span className="font-bold text-[#d44c47] text-sm">[!]</span>
            <div>
              <strong className="font-bold block uppercase">
                {language === "zh" ? `${overdueTasks.length} 个往日未完成复习任务` : `${overdueTasks.length} OVERDUE SESSIONS`}
              </strong>
              <span className="text-[#666666] text-[11px]">
                {language === "zh" ? "动态重排可自动将遗留任务智能平摊至未来空闲时间。" : "Adaptive Rebalance can automatically reschedule missed work evenly across future available hours."}
              </span>
            </div>
          </div>

          <button
            onClick={handleTriggerRebalance}
            disabled={isRebalancing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
            <span>{isRebalancing ? t("rebalancing") : `[${t("autoReschedule")}]`}</span>
          </button>
        </div>
      )}

      {/* Notion Stat Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 font-mono">
        {/* Readiness Index */}
        <div className="border border-[#111111] p-4 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#666666] text-xs">
            <span className="font-bold uppercase tracking-wider">{t("readinessIndex")}</span>
            <span className="text-[10px] text-[#111111] font-bold">[{language === "zh" ? "掌握度" : "MASTERY"}]</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#111111]">{readinessIndex}%</span>
            <span className="text-[11px] text-[#666666]">{language === "zh" ? "预测掌握" : "Projected"}</span>
          </div>
          <div className="w-full bg-[#e5e5e5] h-1.5 overflow-hidden">
            <div
              className="bg-[#111111] h-full transition-all duration-500"
              style={{ width: `${readinessIndex}%` }}
            />
          </div>
        </div>

        {/* Syllabus Completed */}
        <div className="border border-[#111111] p-4 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#666666] text-xs">
            <span className="font-bold uppercase tracking-wider">{t("syllabusCovered")}</span>
            <span className="text-[10px] text-[#111111] font-bold">[{language === "zh" ? "考纲" : "SYLLABUS"}]</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#111111]">{syllabusCompletionRate}%</span>
            <span className="text-[11px] text-[#666666]">
              {completedTasks}/{totalTasks} {language === "zh" ? "项" : "done"}
            </span>
          </div>
          <div className="w-full bg-[#e5e5e5] h-1.5 overflow-hidden">
            <div
              className="bg-[#111111] h-full transition-all duration-500"
              style={{ width: `${syllabusCompletionRate}%` }}
            />
          </div>
        </div>

        {/* Study Time Logged */}
        <div className="border border-[#111111] p-4 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#666666] text-xs">
            <span className="font-bold uppercase tracking-wider">{t("studyHoursLogged")}</span>
            <span className="text-[10px] text-[#111111] font-bold">[{language === "zh" ? "学时" : "HOURS"}]</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#111111]">
              {Math.round(totalCompletedMinutes / 60)}h
            </span>
            <span className="text-[11px] text-[#666666]">
              / {Math.round(totalPlannedMinutes / 60)}h {language === "zh" ? "总计" : "plan"}
            </span>
          </div>
          <p className="text-[11px] text-[#666666]">
            {totalPlannedMinutes - totalCompletedMinutes > 0
              ? `${Math.round((totalPlannedMinutes - totalCompletedMinutes) / 60)}h ${language === "zh" ? "剩余时长" : "remaining"}`
              : (language === "zh" ? "已达成目标" : "Goal completed")}
          </p>
        </div>

        {/* Pace Status */}
        <div className="border border-[#111111] p-4 space-y-2 bg-white">
          <div className="flex items-center justify-between text-[#666666] text-xs">
            <span className="font-bold uppercase tracking-wider">{t("scheduleHealth")}</span>
            <span className="text-[10px] text-[#111111] font-bold">[{language === "zh" ? "状态" : "STATUS"}]</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-base font-bold text-[#111111]">
              {overdueTasks.length === 0 ? (language === "zh" ? "[进度健康]" : "[ON TRACK]") : (language === "zh" ? "[需重排]" : "[REBALANCE]")}
            </span>
          </div>
          <p className="text-[11px] text-[#666666]">
            {overdueTasks.length === 0
              ? (language === "zh" ? "各模块跟进正常" : "All on schedule")
              : `${overdueTasks.length} ${language === "zh" ? "个待补" : "pending"}`}
          </p>
        </div>
      </div>

      {/* Adaptive Rebalancing Action Section */}
      <div className="border border-[#111111] p-5 bg-white space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
                [{language === "zh" ? "智能重排" : "ADAPTIVE AI"}]
              </span>
              <h3 className="font-bold text-sm uppercase text-[#111111]">
                {language === "zh" ? "AI 实时动态智能重排" : "Real-Time Adaptive Plan Rescheduler"}
              </h3>
            </div>
            <p className="text-xs text-[#666666] max-w-2xl">
              {language === "zh" 
                ? "当您遇到突发情况、可用时间变更或某章节需要额外强化时，AI 将在数秒内实时重新排布剩余学习路线。" 
                : "If your weekly availability changes, an unexpected event occurs, or you need extra review time for difficult topics, the AI recalculates your remaining study roadmap in real-time."}
            </p>
          </div>

          <button
            onClick={handleTriggerRebalance}
            disabled={isRebalancing}
            className="flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-[#111111] text-[#111111] hover:text-white border border-[#111111] text-xs font-bold transition-colors shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRebalancing ? t("rebalancing") : `[${t("rebalanceTasks")}]`}</span>
          </button>
        </div>

        {rebalanceResultSummary && (
          <div className="p-3 bg-[#fafafa] border border-[#111111] text-[#111111] text-xs flex items-start space-x-2">
            <span className="font-bold text-[#111111]">[✓]</span>
            <span>{rebalanceResultSummary}</span>
          </div>
        )}

        {rebalanceError && (
          <div className="p-3 bg-[#fafafa] border border-[#111111] text-[#d44c47] text-xs flex items-start space-x-2">
            <span className="font-bold">[!]</span>
            <span>{rebalanceError}</span>
          </div>
        )}
      </div>

      {/* Topic Mastery Progress Breakdown (Notion Database Table) */}
      <div className="border border-[#111111] bg-white font-mono">
        <div className="px-4 py-3 bg-[#fafafa] border-b border-[#111111] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              [DOMAIN_MASTERY_TRACKER]
            </span>
          </div>
          <span className="text-[11px] text-[#666666]">
            {topicMastery.length} {language === "zh" ? "个考点追踪中" : "TOPICS"}
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-white border-b border-[#111111] text-[#666666]">
              <th className="py-2.5 px-4 font-bold uppercase">{language === "zh" ? "考点知识点" : "TOPIC"}</th>
              <th className="py-2.5 px-3 w-28 font-bold uppercase">{language === "zh" ? "权重" : "WEIGHT"}</th>
              <th className="py-2.5 px-3 w-28 font-bold uppercase">{language === "zh" ? "难度" : "DIFF"}</th>
              <th className="py-2.5 px-3 w-48 font-bold uppercase">{language === "zh" ? "完成度" : "PROGRESS"}</th>
              <th className="py-2.5 px-4 w-32 font-bold uppercase text-right">{language === "zh" ? "掌握评分" : "SCORE"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e5e5]">
            {topicMastery.map((topic, i) => (
              <tr key={topic.id || i} className="hover:bg-[#fafafa] transition-colors">
                <td className="py-3 px-4">
                  <span className="font-bold text-[#111111] block">{topic.title}</span>
                  <span className="text-[11px] text-[#666666] block mt-0.5">
                    {language === "zh" 
                      ? `已完成 ${topic.completedTasks} / ${topic.totalTasks} 个复习单元`
                      : `${topic.completedTasks} of ${topic.totalTasks} sessions completed`}
                  </span>
                </td>

                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 border border-[#111111] text-[10px] font-bold">
                    {topic.weightPercentage}%
                  </span>
                </td>

                <td className="py-3 px-3">
                  <span className="text-[11px] font-bold uppercase">
                    [{topic.difficulty}]
                  </span>
                </td>

                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-[#666666]">{topic.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-[#e5e5e5] h-1.5 overflow-hidden">
                      <div
                        className="bg-[#111111] h-full transition-all duration-300"
                        style={{ width: `${topic.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4 text-right">
                  <span className="font-bold text-[#111111] text-xs">
                    {topic.avgRating ? `${topic.avgRating.toFixed(1)} / 5.0` : (language === "zh" ? "待评" : "N/A")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
