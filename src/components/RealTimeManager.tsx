import React, { useState, useEffect, useMemo } from "react";
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
  Star,
  Calendar,
  Sliders,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  FolderOpen,
  FileText
} from "lucide-react";
import { ExamStudyPlan, StudyTask, SyllabusTopic, UserStudyPreferences, DaySchedulePreference } from "../types";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { DEFAULT_WEEK_SCHEDULE } from "../lib/storage";
import { fallbackGeneratePlanClient } from "../lib/fallbackPlanner";
import { RulerTimePicker } from "./RulerTimePicker";

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
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Personalized Study Plan Preferences State
  const defaultExamDate = useMemo(() => {
    if (plan?.examDate) return plan.examDate;
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  }, [plan?.examDate]);

  const [startDate, setStartDate] = useState(plan?.startDate || todayStr);
  const [examDate, setExamDate] = useState(plan?.examDate || defaultExamDate);
  const [examTime, setExamTime] = useState(plan?.examTime || "09:00");
  const [targetScore, setTargetScore] = useState(plan?.preferences?.targetScoreOrGrade || "A (90%+ / 优秀)");
  const [studyPace, setStudyPace] = useState<UserStudyPreferences["studyPace"]>(plan?.preferences?.studyPace || "deep_mastery");
  const [sessionLength, setSessionLength] = useState<number>(plan?.preferences?.sessionLengthMinutes || 45);
  const [includePracticeExams, setIncludePracticeExams] = useState(plan?.preferences?.includePracticeExams ?? true);
  const [includeBufferDays, setIncludeBufferDays] = useState(plan?.preferences?.includeBufferDays ?? true);
  const [bufferDaysCount, setBufferDaysCount] = useState(plan?.preferences?.bufferDaysCount ?? 2);
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(
    plan?.preferences?.dailySchedules || DEFAULT_WEEK_SCHEDULE
  );

  // Sync preference states if active plan changes
  useEffect(() => {
    if (plan) {
      if (plan.startDate) setStartDate(plan.startDate);
      if (plan.examDate) setExamDate(plan.examDate);
      if (plan.examTime) setExamTime(plan.examTime);
      if (plan.preferences?.targetScoreOrGrade) setTargetScore(plan.preferences.targetScoreOrGrade);
      if (plan.preferences?.studyPace) setStudyPace(plan.preferences.studyPace);
      if (plan.preferences?.sessionLengthMinutes) setSessionLength(plan.preferences.sessionLengthMinutes);
      if (plan.preferences?.dailySchedules) setDailySchedules(plan.preferences.dailySchedules);
    }
  }, [plan?.id]);

  // Plan Settings & Generation state
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [showScheduleRuler, setShowScheduleRuler] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerateError, setPlanGenerateError] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

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

  // Days until exam calculation
  const daysUntilExam = useMemo(() => {
    if (!examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [examDate]);

  // Total topics estimated hours
  const totalEstHours = useMemo(() => {
    return (plan.topics || []).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [plan.topics]);

  // Handle Schedule updates for RulerTimePicker
  const handleUpdateDayHours = (dayOfWeek: number, hours: number) => {
    setDailySchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, availableHours: hours, enabled: hours > 0 } : s))
    );
  };

  const handleToggleDayEnabled = (dayOfWeek: number) => {
    setDailySchedules((prev) =>
      prev.map((s) => (s.dayOfWeek === dayOfWeek ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Generate / Regenerate Study Plan using full preferences & topic architecture
  const handleGenerateStudyPlan = async () => {
    setIsGeneratingPlan(true);
    setPlanGenerateError(null);
    setPlanSuccessNotice(false);

    const preferences: UserStudyPreferences = {
      examName: plan.examName,
      subject: plan.subject,
      startDate,
      examDate,
      examTime,
      targetScoreOrGrade: targetScore,
      studyPace,
      sessionLengthMinutes: sessionLength,
      dailySchedules,
      includePracticeExams,
      includeBufferDays,
      bufferDaysCount,
      weakTopicsFocus: (plan.topics || []).filter(t => t.difficulty === "hard").map(t => t.title),
    };

    const topics = plan.topics && plan.topics.length > 0 ? plan.topics : [
      {
        id: "top-1",
        title: "基础概念与核心理论",
        category: "基础概念",
        weightPercentage: 30,
        difficulty: "easy" as const,
        subtopics: ["核心定理推导", "基础应用"],
        estimatedHours: 8,
      },
      {
        id: "top-2",
        title: "典型考题与高频题型精解",
        category: "实战演练",
        weightPercentage: 40,
        difficulty: "hard" as const,
        subtopics: ["经典大题演练", "易错点与解题模板"],
        estimatedHours: 14,
      },
      {
        id: "top-3",
        title: "全真模拟与真题冲刺",
        category: "模拟冲刺",
        weightPercentage: 30,
        difficulty: "hard" as const,
        subtopics: ["历年真题实战", "查漏补缺与考前押密"],
        estimatedHours: 10,
      },
    ];

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics,
            preferences,
            materialsSummary: plan.materialsSummary || "",
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network fetch error for generate-plan, generating local plan:", fetchErr);
      }

      if (!data || !data.tasks || data.tasks.length === 0) {
        data = fallbackGeneratePlanClient(topics, preferences);
      }

      const newPlan: ExamStudyPlan = {
        ...plan,
        updatedAt: new Date().toISOString(),
        examName: preferences.examName,
        subject: preferences.subject,
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: data.totalPlannedHours || totalEstHours || 35,
        phases: data.phases || plan.phases || [],
        topics: topics,
        tasks: data.tasks || [],
        preferences,
      };

      onUpdatePlan(newPlan);
      setPlanSuccessNotice(true);
      playCompletionChime();
      setTimeout(() => setPlanSuccessNotice(false), 5000);
    } catch (err: any) {
      console.error("Plan generation error, using safe fallback", err);
      const safeData = fallbackGeneratePlanClient(topics, preferences);
      const safePlan: ExamStudyPlan = {
        ...plan,
        updatedAt: new Date().toISOString(),
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: safeData.totalPlannedHours || 30,
        phases: safeData.phases || [],
        topics: topics,
        tasks: safeData.tasks,
        preferences,
      };
      onUpdatePlan(safePlan);
      setPlanSuccessNotice(true);
      setTimeout(() => setPlanSuccessNotice(false), 5000);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

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

      {/* Plan Generation Success Notice */}
      {planSuccessNotice && (
        <div className="p-3.5 bg-white border-2 border-[#111111] text-[#111111] font-mono text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#111111]" />
            <span className="font-bold">
              {language === "zh" ? "个性化复习排程已成功生成并同步至系统！" : "Personalized study schedule successfully updated!"}
            </span>
          </div>
          <button
            onClick={() => setPlanSuccessNotice(false)}
            className="px-2 py-0.5 border border-[#111111] text-[11px] hover:bg-[#111111] hover:text-white cursor-pointer"
          >
            [{language === "zh" ? "知道了" : "DISMISS"}]
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: 个性化复习排程规划 (Personalized Study Schedule Planning)           */}
      {/* ========================================================================= */}
      <section className="space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-bold uppercase text-[#111111]">
              [{language === "zh" ? "个性化复习排程规划" : "AI STUDY PLAN"}]
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPlanSettings(!showPlanSettings)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "调整作息参数" : "PREFERENCES"}]</span>
              {showPlanSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleGenerateStudyPlan}
              disabled={isGeneratingPlan}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              {isGeneratingPlan ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>[{language === "zh" ? "正在排程..." : "PLANNING..."}]</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>[{language === "zh" ? "重新生成复习计划" : "REGENERATE PLAN"}]</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {showPlanSettings && (
          <div className="bg-white border border-[#111111] p-5 space-y-4 animate-fadeIn font-mono">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "备考时间节点与复习偏好设置" : "TIMELINE & PACE PREFERENCES"}]
              </h4>
              <button
                onClick={() => setShowScheduleRuler(!showScheduleRuler)}
                className="text-xs font-bold text-[#111111] hover:underline flex items-center space-x-1 cursor-pointer"
              >
                <span>[{showScheduleRuler ? (language === "zh" ? "收起每周作息" : "HIDE SCHEDULE") : (language === "zh" ? "调整每周可用作息" : "EDIT WEEK SCHEDULE")}]</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#666666] mb-1">
                  [{language === "zh" ? "计划开始日期" : "START DATE"}]
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#666666] mb-1">
                  [{language === "zh" ? "目标考试日期" : "EXAM DATE"}]
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] font-bold outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#666666] mb-1">
                  [{language === "zh" ? "目标成绩" : "TARGET SCORE"}]
                </label>
                <select
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] font-bold outline-none cursor-pointer"
                >
                  <option value="A+ (95%+ / 卓越)">A+ (95%+ / 卓越)</option>
                  <option value="A (90%+ / 优秀)">A (90%+ / 优秀)</option>
                  <option value="B (80%+ / 良好)">B (80%+ / 良好)</option>
                  <option value="Pass (60%+ / 稳妥过关)">Pass (60%+ / 稳妥过关)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-[#666666] mb-1">
                  [{language === "zh" ? "复习节奏模式" : "STUDY PACE MODE"}]
                </label>
                <select
                  value={studyPace}
                  onChange={(e) => setStudyPace(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] font-bold outline-none cursor-pointer"
                >
                  <option value="deep_mastery">{language === "zh" ? "深度精通模式 (概念推导 + 主动回忆)" : "Deep Mastery"}</option>
                  <option value="spaced_repetition">{language === "zh" ? "艾宾浩斯间隔复习 (高频循环回顾)" : "Spaced Repetition"}</option>
                  <option value="cramming_intensive">{language === "zh" ? "考前冲刺强化 (高频考点速攻)" : "Cramming Intensive"}</option>
                  <option value="steady_pace">{language === "zh" ? "匀速平稳推进" : "Steady Pace"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#666666] mb-1">
                  [{language === "zh" ? "单次专注时长" : "SESSION DURATION"}]
                </label>
                <select
                  value={sessionLength}
                  onChange={(e) => setSessionLength(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] font-bold outline-none cursor-pointer"
                >
                  <option value={30}>30 {language === "zh" ? "分钟 (微习惯)" : "MINS"}</option>
                  <option value={45}>45 {language === "zh" ? "分钟 (标准番茄钟)" : "MINS"}</option>
                  <option value={60}>60 {language === "zh" ? "分钟 (深度专注)" : "MINS"}</option>
                  <option value={90}>90 {language === "zh" ? "分钟 (仿真大题演练)" : "MINS"}</option>
                </select>
              </div>
            </div>

            {/* Optional Weekly Ruler Picker */}
            {showScheduleRuler && (
              <div className="pt-2 border-t border-[#e5e5e5] space-y-2">
                <label className="block text-[11px] font-bold text-[#666666]">
                  [{language === "zh" ? "每周各天可用学习时长" : "WEEKLY AVAILABLE STUDY HOURS"}]
                </label>
                <RulerTimePicker
                  dailySchedules={dailySchedules}
                  onChangeHours={handleUpdateDayHours}
                  onToggleDay={handleToggleDayEnabled}
                />
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerateStudyPlan}
                disabled={isGeneratingPlan}
                className="px-4 py-1.5 bg-[#111111] text-white border border-[#111111] text-xs font-bold cursor-pointer hover:bg-[#333333] transition-colors"
              >
                [{language === "zh" ? "应用偏好并重新规划" : "APPLY & REGENERATE"}]
              </button>
            </div>
          </div>
        )}

        {/* Plan Highlights 4-Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
          <div className="p-4 bg-white border border-[#111111]">
            <span className="text-[11px] text-[#666666] font-bold block">[{language === "zh" ? "备考窗口" : "WINDOW"}]</span>
            <span className="text-xl font-bold text-[#111111] mt-0.5 block">
              {daysUntilExam} <span className="text-xs text-[#666666]">{language === "zh" ? "天" : "DAYS"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#111111]">
            <span className="text-[11px] text-[#666666] font-bold block">[{language === "zh" ? "总规划学时" : "PLANNED HOURS"}]</span>
            <span className="text-xl font-bold text-[#111111] mt-0.5 block">
              {plan?.totalPlannedHours || totalEstHours || 35} <span className="text-xs text-[#666666]">{language === "zh" ? "小时" : "HRS"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#111111]">
            <span className="text-[11px] text-[#666666] font-bold block">[{language === "zh" ? "总生成任务" : "TOTAL TASKS"}]</span>
            <span className="text-xl font-bold text-[#111111] mt-0.5 block">
              {plan?.tasks?.length || 0} <span className="text-xs text-[#666666]">{language === "zh" ? "项" : "TASKS"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#111111]">
            <span className="text-[11px] text-[#666666] font-bold block">[{language === "zh" ? "目标等级" : "TARGET"}]</span>
            <span className="text-xl font-bold text-[#111111] mt-0.5 block truncate">
              {targetScore.split(" ")[0]}
            </span>
          </div>
        </div>

        {/* Phase Roadmap Minimalist Editorial Vertical Timeline (Faithful replica of reference design) */}
        {plan?.phases && plan.phases.length > 0 && (
          <div className="space-y-3 pt-2 font-mono">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowRoadmap(!showRoadmap)}
                className="text-xs font-bold uppercase text-[#111111] flex items-center space-x-2 hover:opacity-75 cursor-pointer text-left"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>[{language === "zh" ? "备考阶段推进路线" : "PREPARATION ROADMAP"}]</span>
                {showRoadmap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              <div className="flex items-center space-x-3">
                <span className="text-[10px] text-[#666666]">
                  {language === "zh" ? `共 ${plan.phases.length} 个里程碑节点` : `${plan.phases.length} MILESTONES`}
                </span>
                <button
                  onClick={() => setShowRoadmap(!showRoadmap)}
                  className="text-xs font-bold text-[#111111] hover:underline cursor-pointer"
                >
                  [{showRoadmap ? (language === "zh" ? "收起" : "COLLAPSE") : (language === "zh" ? "展开" : "EXPAND")}]
                </button>
              </div>
            </div>

            {/* Editorial Stories-style Timeline Container */}
            {showRoadmap && (
              <div className="bg-[#faf9f6] border border-[#111111] py-8 px-6 sm:px-12 select-none animate-fadeIn">
              
              {/* Top Header Region (Matching screenshot: circle node, title & vertical STUDIO text) */}
              <div className="relative">
                {/* Vertical Axis running through the entire card */}
                <div className="absolute left-6 sm:left-12 top-10 bottom-0 w-[1px] bg-[#111111]" />

                {/* Top Row: Circle Node + Process text */}
                <div className="flex items-center space-x-4 mb-8">
                  {/* Top Circle Element */}
                  <div className="w-12 h-12 rounded-full border border-[#999999] bg-[#eae8e1] flex items-center justify-center shrink-0 z-10">
                    <span className="text-[10px] font-bold text-[#666666]">
                      {daysUntilExam}D
                    </span>
                  </div>
                  {/* Process text in screenshot */}
                  <div className="text-xs text-[#555555] font-sans">
                    <span className="font-bold text-[#111111] text-sm tracking-wide">
                      process
                    </span>{" "}
                    <span className="text-xs text-[#888888]">
                      {language === "zh" ? `阶段路线 · ${daysUntilExam}天倒计时` : `roadmap · ${daysUntilExam}d left`}
                    </span>
                  </div>
                </div>

                {/* Mid Section: Vertical Rotated 'STUDIO' / 'EXAM' Label beside the vertical line */}
                <div className="relative h-20 mb-3">
                  <div className="absolute left-[-16px] sm:left-0 top-3 text-[11px] font-bold tracking-[0.3em] text-[#111111] uppercase select-none -rotate-90 origin-center w-12 text-center">
                    STUDIO
                  </div>
                </div>

                {/* Horizontal Divider Line with 00 Pill Badge directly on intersection */}
                <div className="relative w-full border-t border-[#111111] my-4">
                  {/* 00 Badge Pill centered exactly on the vertical axis (left-6 / sm:left-12) */}
                  <div className="absolute left-6 sm:left-12 -translate-x-1/2 -top-3.5 bg-[#111111] text-white text-[11px] font-bold px-3.5 py-0.5 rounded-full flex items-center justify-center tracking-widest z-20 shadow-sm">
                    00
                  </div>
                </div>

                {/* Lower Timeline Items Section */}
                <div className="pt-8 space-y-10 sm:space-y-12">
                  {plan.phases.map((phase, pIdx) => {
                    const currentNum = String(pIdx + 1).padStart(2, "0");
                    const isCurrent = pIdx === 0;

                    return (
                      <div
                        key={phase.id || `phase-step-${pIdx}`}
                        className="relative flex items-center group"
                      >
                        {/* Solid Dot centered on the vertical line (left-6 / sm:left-12) */}
                        <div className="absolute left-6 sm:left-12 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-[#111111] z-20 transition-transform group-hover:scale-125" />

                        {/* Content Line: Indented past the vertical line */}
                        <div className="pl-16 sm:pl-28 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-12 flex-1">
                          {/* 01, 02 Numbering (Pure 2-digit format) */}
                          <span className="text-sm sm:text-base font-bold text-[#111111] tracking-widest shrink-0 w-10">
                            {currentNum}
                          </span>

                          {/* Phase Title & Details */}
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="text-sm sm:text-base font-normal font-sans text-[#111111] tracking-tight">
                                {phase.name}
                              </span>

                              {/* Dates indicator */}
                              <span className="text-[10px] text-[#777777] font-mono border-b border-[#cccccc] pb-0.5">
                                {phase.startDate?.slice(5)} ~ {phase.endDate?.slice(5)}
                              </span>

                              {isCurrent && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-[#111111] text-white font-bold uppercase font-mono">
                                  {language === "zh" ? "进行中" : "CURRENT"}
                                </span>
                              )}
                            </div>

                            {/* Phase Focus Description */}
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

                  {/* Final Exam Milestone */}
                  <div className="relative flex items-center pt-2">
                    {/* Final Node Dot on the vertical line */}
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
          </div>
        )}

        {/* Upcoming Tasks Preview */}
        {plan?.tasks && plan.tasks.length > 0 && (
          <div className="space-y-2.5 pt-2 font-mono">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "近期备考任务预览" : "UPCOMING TASKS PREVIEW"}]
              </h4>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("todo")}
                  className="text-xs font-bold text-[#111111] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>[{language === "zh" ? "前往每日待办查看全部" : "VIEW ALL IN DAILY TO-DO"}]</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {plan.tasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-white border border-[#111111] text-xs"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className="w-2 h-2 bg-[#111111] shrink-0" />
                    <span className="text-[#111111] font-bold truncate">{task.title}</span>
                    <span className="text-[11px] text-[#666666] font-bold shrink-0 flex items-center space-x-1">
                      <span>{task.date} · {task.durationMinutes} MIN</span>
                    </span>
                  </div>
                  {task.topicTitle && (
                    <span className="text-[10px] px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold shrink-0 ml-2">
                      [{task.topicTitle}]
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

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
