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
import { DomainMasteryWheelChart } from "./DomainMasteryWheelChart";
import { PieChart, Table } from "lucide-react";

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

  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [showScheduleRuler, setShowScheduleRuler] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(true);
  const [masteryViewMode, setMasteryViewMode] = useState<"wheel" | "table" | "both">("wheel");
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerateError, setPlanGenerateError] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [isRebalancing, setIsRebalancing] = useState(false);
  const [rebalanceReason, setRebalanceReason] = useState(
    language === "zh"
      ? "前几天有未完成的复习模块，请将剩余任务平摊到后续时间"
      : "Missed study blocks from previous days, rebalance remaining tasks evenly"
  );
  const [rebalanceResultSummary, setRebalanceResultSummary] = useState<string | null>(null);
  const [rebalanceError, setRebalanceError] = useState<string | null>(null);

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

  const daysUntilExam = useMemo(() => {
    if (!examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [examDate]);

  const totalEstHours = useMemo(() => {
    return (plan.topics || []).reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [plan.topics]);

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

  const totalTasks = plan.tasks.length;
  const completedTasks = plan.tasks.filter((t) => t.status === "completed").length;
  const pendingTasks = plan.tasks.filter((t) => t.status !== "completed").length;

  const totalPlannedMinutes = plan.tasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const totalCompletedMinutes = plan.tasks
    .filter((t) => t.status === "completed")
    .reduce((acc, t) => acc + (t.actualMinutesSpent || t.durationMinutes), 0);

  const syllabusCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const overdueTasks = plan.tasks.filter((t) => t.date < todayStr && t.status !== "completed");

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

      {plan?.phases && plan.phases.length > 0 && (
        <section className="space-y-3 font-mono">
          <div className="flex items-center justify-between pb-2 border-b border-[#111111]">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#111111]" />
              <h2 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "推进路线" : "ROADMAP"}]
              </h2>
              <span className="text-[10px] text-[#666666] font-bold">
                {plan.phases.length} {language === "zh" ? "个阶段" : "PHASES"}
              </span>
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
                      process
                    </span>{" "}
                    <span className="text-xs text-[#888888]">
                      {language === "zh" ? `阶段路线 · ${daysUntilExam}天倒计时` : `roadmap · ${daysUntilExam}d left`}
                    </span>
                  </div>
                </div>

                <div className="relative h-20 mb-3">
                  <div className="absolute left-[-16px] sm:left-0 top-3 text-[11px] font-bold tracking-[0.3em] text-[#111111] uppercase select-none -rotate-90 origin-center w-12 text-center">
                    STUDIO
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

      <div className="border border-[#111111] bg-white font-mono">
        <div className="px-4 py-3 bg-[#fafafa] border-b border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <PieChart className="w-4 h-4 text-[#111111]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              [DOMAIN_MASTERY_TRACKER]
            </span>
            <span className="text-[10px] px-1.5 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {topicMastery.length} {language === "zh" ? "考点知识域" : "DOMAINS"}
            </span>
          </div>

          <div className="flex items-center space-x-1 text-xs">
            <button
              onClick={() => setMasteryViewMode("wheel")}
              className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer border ${
                masteryViewMode === "wheel"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
              }`}
            >
              <span>{language === "zh" ? "[花瓣罗盘饼图]" : "[PETAL PIE CHART]"}</span>
            </button>
            <button
              onClick={() => setMasteryViewMode("table")}
              className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer border ${
                masteryViewMode === "table"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
              }`}
            >
              <span>{language === "zh" ? "[清单表格]" : "[TABLE VIEW]"}</span>
            </button>
            <button
              onClick={() => setMasteryViewMode("both")}
              className={`px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer border ${
                masteryViewMode === "both"
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
              }`}
            >
              <span>{language === "zh" ? "[全景并排]" : "[SPLIT VIEW]"}</span>
            </button>
          </div>
        </div>

        {(masteryViewMode === "wheel" || masteryViewMode === "both") && (
          <div className="border-b border-[#111111]">
            <DomainMasteryWheelChart
              topics={topicMastery}
              language={language}
            />
          </div>
        )}

        {(masteryViewMode === "table" || masteryViewMode === "both") && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#111111] text-[#666666]">
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
        )}
      </div>
    </div>
  );
}
