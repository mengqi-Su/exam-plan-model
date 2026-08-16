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
  HelpCircle
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

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rebalance study plan");
      }

      const data = await res.json();

      if (data.tasks && Array.isArray(data.tasks)) {
        onUpdatePlan({
          ...plan,
          tasks: data.tasks,
          updatedAt: new Date().toISOString(),
        });
        setRebalanceResultSummary(data.rebalanceSummary || (language === "zh" ? "学习计划已成功根据剩余天数平摊与动态重排！" : "Study plan successfully rebalanced across remaining days!"));
        playCompletionChime();
      }
    } catch (err: any) {
      console.error(err);
      setRebalanceError(err.message || "Failed to execute adaptive rebalance");
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Multi-Subject Bar & Add Exam Subject Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#f7f6f3] rounded-xl border border-[#e9e9e7]">
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-1">
          <span className="text-xs font-semibold text-[#787774] shrink-0">
            {language === "zh" ? "当前备考科目：" : "Active Subject:"}
          </span>
          {plans.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPlan && onSelectPlan(p.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0 flex items-center space-x-1.5 ${
                p.id === plan.id
                  ? "bg-white text-[#37352f] shadow-xs border border-[#d3d2cf] font-bold"
                  : "text-[#787774] hover:bg-[#efefed] hover:text-[#37352f]"
              }`}
            >
              <span>🎓</span>
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
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#37352f] hover:bg-[#201f1c] text-white font-semibold text-xs rounded-lg shadow-xs transition-colors shrink-0"
        >
          <span className="text-sm font-bold leading-none">+</span>
          <span>{language === "zh" ? "添加新考试科目" : "Add Exam Subject"}</span>
        </button>
      </div>

      {/* Top Countdown Notion Callout Block */}
      <div className="notion-callout p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#e9e9e7]">
        <div className="flex items-start space-x-3">
          <span className="text-3xl">⏳</span>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-[#37352f]">
                {plan.examName} {t("readinessControlCenter")}
              </h2>
              <span className="notion-tag-blue px-2 py-0.5 rounded text-[10px] font-semibold">
                {t("realTimeTracking")}
              </span>
            </div>
            <p className="text-xs text-[#787774] mt-0.5">
              {t("propExamDate")}: <strong className="text-[#37352f]">{plan.examDate} {plan.examTime || "09:00"}</strong> ({plan.subject})
            </p>
          </div>
        </div>

        {/* Live Countdown Ticker */}
        <div className="flex items-center space-x-2 bg-white border border-[#e9e9e7] px-3.5 py-2 rounded-lg shadow-2xs">
          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#37352f]">
              {String(countdown.days).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#787774] uppercase block">{t("countdownDays")}</span>
          </div>
          <span className="text-[#9b9a97] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#37352f]">
              {String(countdown.hours).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#787774] uppercase block">{t("countdownHours")}</span>
          </div>
          <span className="text-[#9b9a97] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#37352f]">
              {String(countdown.minutes).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#787774] uppercase block">{t("countdownMins")}</span>
          </div>
          <span className="text-[#9b9a97] font-bold">:</span>

          <div className="text-center px-1.5">
            <span className="text-xl font-bold font-mono text-[#37352f]">
              {String(countdown.seconds).padStart(2, "0")}
            </span>
            <span className="text-[9px] text-[#787774] uppercase block">{t("countdownSecs")}</span>
          </div>
        </div>
      </div>

      {/* Overdue Warning Callout */}
      {overdueTasks.length > 0 && (
        <div className="p-4 bg-[#fbf3db] border border-[#f6e3b5] rounded-lg text-[#37352f] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start space-x-2.5">
            <span className="text-base">⚠️</span>
            <div>
              <strong className="font-semibold block text-[#cb912f]">
                {language === "zh" ? `${overdueTasks.length} 个往日未完成的复习任务` : `${overdueTasks.length} Unfinished Study Sessions from Past Days`}
              </strong>
              <span className="text-[#787774] text-[11px]">
                {language === "zh" ? "动态重排可自动将遗留任务智能平摊至未来空闲时间。" : "Adaptive Rebalance can automatically reschedule missed work evenly across future available hours."}
              </span>
            </div>
          </div>

          <button
            onClick={handleTriggerRebalance}
            disabled={isRebalancing}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#37352f] hover:bg-[#201f1c] text-white font-semibold text-xs rounded-md shadow-2xs transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRebalancing ? "animate-spin" : ""}`} />
            <span>{isRebalancing ? t("rebalancing") : t("autoReschedule")}</span>
          </button>
        </div>
      )}

      {/* Notion Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Readiness Index */}
        <div className="bg-white border border-[#e9e9e7] rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-[#787774] text-xs">
            <span className="font-medium">{t("readinessIndex")}</span>
            <Award className="w-4 h-4 text-[#448361]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#448361]">{readinessIndex}%</span>
            <span className="text-[11px] text-[#787774]">{language === "zh" ? "预测掌握度" : "Projected Mastery"}</span>
          </div>
          <div className="w-full bg-[#efefed] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#448361] h-full rounded-full transition-all duration-500"
              style={{ width: `${readinessIndex}%` }}
            />
          </div>
        </div>

        {/* Syllabus Completed */}
        <div className="bg-white border border-[#e9e9e7] rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-[#787774] text-xs">
            <span className="font-medium">{t("syllabusCovered")}</span>
            <CheckCircle2 className="w-4 h-4 text-[#2b78a0]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#2b78a0]">{syllabusCompletionRate}%</span>
            <span className="text-[11px] text-[#787774]">
              {completedTasks}/{totalTasks} {language === "zh" ? "项任务" : "tasks"}
            </span>
          </div>
          <div className="w-full bg-[#efefed] h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-[#2b78a0] h-full rounded-full transition-all duration-500"
              style={{ width: `${syllabusCompletionRate}%` }}
            />
          </div>
        </div>

        {/* Study Time Logged */}
        <div className="bg-white border border-[#e9e9e7] rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-[#787774] text-xs">
            <span className="font-medium">{t("studyHoursLogged")}</span>
            <Clock className="w-4 h-4 text-[#9065b0]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-[#9065b0]">
              {Math.round(totalCompletedMinutes / 60)}h
            </span>
            <span className="text-[11px] text-[#787774]">
              / {Math.round(totalPlannedMinutes / 60)}h {language === "zh" ? "规划" : "planned"}
            </span>
          </div>
          <p className="text-[11px] text-[#787774]">
            {totalPlannedMinutes - totalCompletedMinutes > 0
              ? `${Math.round((totalPlannedMinutes - totalCompletedMinutes) / 60)}h ${language === "zh" ? "剩余" : "remaining"}`
              : (language === "zh" ? "规划目标已达成" : "Planned target completed")}
          </p>
        </div>

        {/* Pace Status */}
        <div className="bg-white border border-[#e9e9e7] rounded-lg p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-[#787774] text-xs">
            <span className="font-medium">{t("scheduleHealth")}</span>
            <TrendingUp className="w-4 h-4 text-[#cb912f]" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span
              className={`text-lg font-bold ${
                overdueTasks.length === 0 ? "text-[#448361]" : "text-[#cb912f]"
              }`}
            >
              {overdueTasks.length === 0 ? (language === "zh" ? "进度良好 🎯" : "On Track 🎯") : (language === "zh" ? "建议动态重排" : "Rebalance Advised")}
            </span>
          </div>
          <p className="text-[11px] text-[#787774]">
            {overdueTasks.length === 0
              ? (language === "zh" ? "所有阶段任务跟进正常" : "All milestones up to date")
              : `${overdueTasks.length} ${language === "zh" ? "个待补任务" : "pending past sessions"}`}
          </p>
        </div>
      </div>

      {/* Adaptive Rebalancing Action Card */}
      <div className="bg-white border border-[#e9e9e7] rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-2.5">
            <span className="text-lg">⚡</span>
            <div>
              <h3 className="font-bold text-sm text-[#37352f]">
                {language === "zh" ? "AI 实时动态智能重排" : "Real-Time Adaptive Plan Rescheduler"}
              </h3>
              <p className="text-xs text-[#787774] mt-0.5 max-w-2xl">
                {language === "zh" 
                  ? "当您遇到突发情况、可用时间变更或某章节需要额外强化时，AI 将在数秒内实时重新排布剩余学习路线。" 
                  : "If your weekly availability changes, an unexpected event occurs, or you need extra review time for difficult topics, the AI recalculates your remaining study roadmap in real-time."}
              </p>
            </div>
          </div>

          <button
            onClick={handleTriggerRebalance}
            disabled={isRebalancing}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#efefed] hover:bg-[#e3e2e0] text-[#37352f] rounded-md text-xs font-semibold transition-colors shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#cb912f]" />
            <span>{isRebalancing ? t("rebalancing") : t("rebalanceTasks")}</span>
          </button>
        </div>

        {rebalanceResultSummary && (
          <div className="p-3 bg-[#edf3ec] border border-[#d5e5d3] text-[#448361] text-xs rounded-md flex items-start space-x-2">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{rebalanceResultSummary}</span>
          </div>
        )}

        {rebalanceError && (
          <div className="p-3 bg-[#fdebec] border border-[#f9d3d5] text-[#d44c47] text-xs rounded-md flex items-start space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{rebalanceError}</span>
          </div>
        )}
      </div>

      {/* Topic Mastery Progress Breakdown (Notion Database Table) */}
      <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
        <div className="px-4 py-3 bg-[#f7f6f3] border-b border-[#e9e9e7] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-sm">🎯</span>
            <h3 className="font-semibold text-xs text-[#37352f]">
              {language === "zh" ? "考点掌握度与信心评级" : "Syllabus Domain Mastery & Confidence"}
            </h3>
          </div>
          <span className="text-[11px] text-[#787774]">
            {topicMastery.length} {language === "zh" ? "个考点追踪中" : "Topics Tracked"}
          </span>
        </div>

        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#fbfbfa] border-b border-[#e9e9e7] text-[#787774] font-medium">
              <th className="py-2.5 px-4 font-normal">{language === "zh" ? "考点知识点" : "Topic Name"}</th>
              <th className="py-2.5 px-3 w-28 font-normal">{language === "zh" ? "考试权重" : "Weight"}</th>
              <th className="py-2.5 px-3 w-28 font-normal">{language === "zh" ? "难度" : "Difficulty"}</th>
              <th className="py-2.5 px-3 w-48 font-normal">{language === "zh" ? "完成度" : "Completion"}</th>
              <th className="py-2.5 px-4 w-32 font-normal text-right">{language === "zh" ? "掌握评分" : "Mastery Score"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e9e9e7]">
            {topicMastery.map((topic, i) => (
              <tr key={topic.id || i} className="hover:bg-[#f7f6f3]/60 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-medium text-[#37352f] block">{topic.title}</span>
                  <span className="text-[11px] text-[#787774] block mt-0.5">
                    {language === "zh" 
                      ? `已完成 ${topic.completedTasks} / ${topic.totalTasks} 个复习单元`
                      : `${topic.completedTasks} of ${topic.totalTasks} study sessions completed`}
                  </span>
                </td>

                <td className="py-3 px-3">
                  <span className="notion-tag-gray px-2 py-0.5 rounded text-[11px] font-mono">
                    {topic.weightPercentage}%
                  </span>
                </td>

                <td className="py-3 px-3">
                  {topic.difficulty === "hard" ? (
                    <span className="notion-tag-red px-2 py-0.5 rounded text-[10px] font-semibold">
                      🔥 {language === "zh" ? "高难" : "Hard"}
                    </span>
                  ) : topic.difficulty === "easy" ? (
                    <span className="notion-tag-green px-2 py-0.5 rounded text-[10px]">
                      {language === "zh" ? "简单" : "Easy"}
                    </span>
                  ) : (
                    <span className="notion-tag-yellow px-2 py-0.5 rounded text-[10px]">
                      {language === "zh" ? "中等" : "Medium"}
                    </span>
                  )}
                </td>

                <td className="py-3 px-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#787774]">{topic.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-[#efefed] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#448361] h-full rounded-full transition-all duration-300"
                        style={{ width: `${topic.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="py-3 px-4 text-right">
                  <span className="font-bold text-[#cb912f] text-xs">
                    {topic.avgRating ? `${topic.avgRating.toFixed(1)} / 5.0 ★` : (language === "zh" ? "待评" : "Pending")}
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
