import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Calendar,
  CheckSquare,
  Clock,
  Zap,
  Plus,
  TrendingUp,
  AlertTriangle,
  Download,
  Search,
  CheckCircle2,
  Circle,
  Play,
  Sparkles,
  BookOpen,
  ChevronRight,
  Target,
  Trash2,
  Layers,
  ChevronLeft
} from "lucide-react";
import confetti from "canvas-confetti";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { QuizModal } from "./QuizModal";

interface MasterDashboardProps {
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNavigateToTab: (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "add_subject", planId?: string) => void;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onAddNewSubject: () => void;
}

const CATEGORY_TAG_CLASS: Record<TaskCategory, string> = {
  theory: "border border-[#111111] bg-white text-[#111111]",
  reading: "border border-[#111111] bg-white text-[#111111]",
  practice_problems: "border border-[#111111] bg-[#111111] text-white",
  active_recall: "border border-[#111111] bg-white text-[#111111]",
  flashcards: "border border-[#111111] bg-white text-[#111111]",
  mock_exam: "border border-[#111111] bg-white text-[#111111] font-bold",
  review_weak_spots: "border border-[#111111] bg-white text-[#111111]",
  summary_cheat_sheet: "border border-[#111111] bg-white text-[#111111]",
};

export function MasterDashboard({
  plans,
  activePlan,
  onSelectPlan,
  onNavigateToTab,
  onUpdatePlan,
  onDeletePlan,
  onRequestDeletePlan,
  onAddNewSubject,
}: MasterDashboardProps) {
  const { t, language } = useI18n();

  // Search & Filter state for dashboard cards
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [sortOption, setSortOption] = useState<"urgent" | "progress" | "name">("urgent");

  // Selected date for aggregated daily tasks view
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Task execution modals state
  const [activeTimerTask, setActiveTimerTask] = useState<{ task: StudyTask; planId: string } | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<{ task: StudyTask; planId: string } | null>(null);

  // Today's formatted date string
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Calculate days remaining helper
  const getDaysRemaining = (examDateStr?: string) => {
    if (!examDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDateStr.split("-").map(Number);
    const examDate = new Date(y, m - 1, d);
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Aggregated Workspace Metrics
  const workspaceMetrics = useMemo(() => {
    const totalSubjects = plans.length;
    let totalTasks = 0;
    let completedTasks = 0;
    let totalEstimatedHours = 0;

    plans.forEach((p) => {
      totalTasks += p.tasks.length;
      completedTasks += p.tasks.filter((t) => t.status === "completed").length;
      totalEstimatedHours += p.tasks.reduce((sum, t) => sum + (t.durationMinutes || 0), 0) / 60;
    });

    const globalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Find nearest exam
    const sortedByDate = [...plans]
      .filter((p) => p.examDate)
      .sort((a, b) => (a.examDate || "").localeCompare(b.examDate || ""));
    const nearestPlan = sortedByDate[0] || null;
    const nearestDays = nearestPlan ? getDaysRemaining(nearestPlan.examDate) : null;

    // Aggregated today's tasks count
    let todayTotal = 0;
    let todayCompleted = 0;
    plans.forEach((p) => {
      const todayPlanTasks = p.tasks.filter((t) => t.date === selectedDate);
      todayTotal += todayPlanTasks.length;
      todayCompleted += todayPlanTasks.filter((t) => t.status === "completed").length;
    });

    return {
      totalSubjects,
      totalTasks,
      completedTasks,
      globalProgress,
      nearestPlan,
      nearestDays,
      todayTotal,
      todayCompleted,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    };
  }, [plans, selectedDate]);

  // Filtered & Sorted Plans for Kanban / Grid
  const displayedPlans = useMemo(() => {
    let result = [...plans];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.examName.toLowerCase().includes(q) ||
          p.subject.toLowerCase().includes(q) ||
          p.topics?.some((top) => top.title.toLowerCase().includes(q))
      );
    }

    // Filter by subject category
    if (filterSubject !== "all") {
      result = result.filter((p) => p.subject === filterSubject);
    }

    // Sorting
    if (sortOption === "urgent") {
      result.sort((a, b) => {
        const da = getDaysRemaining(a.examDate) ?? 999;
        const db = getDaysRemaining(b.examDate) ?? 999;
        return da - db;
      });
    } else if (sortOption === "progress") {
      result.sort((a, b) => {
        const pa = a.tasks.length > 0 ? a.tasks.filter((t) => t.status === "completed").length / a.tasks.length : 0;
        const pb = b.tasks.length > 0 ? b.tasks.filter((t) => t.status === "completed").length / b.tasks.length : 0;
        return pb - pa;
      });
    } else if (sortOption === "name") {
      result.sort((a, b) => a.examName.localeCompare(b.examName));
    }

    return result;
  }, [plans, searchQuery, filterSubject, sortOption]);

  // Unique subject categories
  const subjectCategories = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.subject) set.add(p.subject);
    });
    return Array.from(set);
  }, [plans]);

  // Aggregated Tasks for the selected Date across ALL plans
  const crossSubjectDailyTasks = useMemo(() => {
    const items: Array<{ task: StudyTask; plan: ExamStudyPlan }> = [];
    plans.forEach((p) => {
      p.tasks
        .filter((t) => t.date === selectedDate)
        .forEach((task) => {
          items.push({ task, plan: p });
        });
    });

    return items.sort((a, b) => {
      if (a.task.status === "completed" && b.task.status !== "completed") return 1;
      if (a.task.status !== "completed" && b.task.status === "completed") return -1;
      return (a.task.startTime || "").localeCompare(b.task.startTime || "");
    });
  }, [plans, selectedDate]);

  // Toggle task completion from Master Dashboard
  const handleToggleTaskStatus = (planId: string, taskId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    const targetTask = targetPlan.tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const newStatus = targetTask.status === "completed" ? "pending" : "completed";
    const updatedPlan: ExamStudyPlan = {
      ...targetPlan,
      tasks: targetPlan.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              completedAt: newStatus === "completed" ? new Date().toISOString() : undefined,
            }
          : t
      ),
    };

    onUpdatePlan(updatedPlan);

    if (newStatus === "completed") {
      playCompletionChime();
      const allTodayCompleted = crossSubjectDailyTasks.every(
        (item) => item.task.id === taskId || item.task.status === "completed"
      );
      if (allTodayCompleted && crossSubjectDailyTasks.length > 0) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
      }
    }
  };

  // Handle timer finish on a task
  const handleTimerCompleted = (actualMinutes: number, rating?: 1 | 2 | 3 | 4 | 5) => {
    if (!activeTimerTask) return;
    const targetPlan = plans.find((p) => p.id === activeTimerTask.planId);
    if (!targetPlan) return;

    const updatedPlan: ExamStudyPlan = {
      ...targetPlan,
      tasks: targetPlan.tasks.map((t) =>
        t.id === activeTimerTask.task.id
          ? {
              ...t,
              status: "completed",
              actualMinutesSpent: actualMinutes,
              confidenceRating: rating || t.confidenceRating,
              completedAt: new Date().toISOString(),
            }
          : t
      ),
    };
    onUpdatePlan(updatedPlan);
    playCompletionChime();
    setActiveTimerTask(null);
  };

  // Handle date stepping
  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10 animate-fadeIn text-[#111111] font-mono">
      {/* ========================================================================= */}
      {/* 1. HEADER & TOP METRICS                                                   */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#111111]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] flex items-center space-x-2.5">
              <GraduationCap className="w-7 h-7 text-[#111111]" />
              <span>{language === "zh" ? "科目总控看板" : "EXAM SUBJECTS COMMAND BOARD"}</span>
            </h1>
            <p className="text-xs text-[#666666] mt-1 font-sans">
              {language === "zh"
                ? "一站式管理在考科目、今日待办日程与大考时间线"
                : "Centralized workspace for multi-course tracking, daily task schedules, and exam timelines."}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onNavigateToTab("master_calendar")}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-[#ededed] text-[#111111] border border-[#111111] text-xs font-mono font-bold transition-all cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "[全科日历]" : "[CALENDAR]"}</span>
            </button>

            <button
              onClick={onAddNewSubject}
              className="flex items-center space-x-1.5 px-3 py-2 bg-[#111111] hover:bg-[#333333] text-white text-xs font-mono font-bold transition-all cursor-pointer border border-[#111111]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "[+ 新建科目]" : "[+ NEW SUBJECT]"}</span>
            </button>
          </div>
        </div>

        {/* Top 4 Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Card 1: Active Subjects */}
          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#666666] font-bold">
              <span>[{language === "zh" ? "在考科目" : "COURSES"}]</span>
              <BookOpen className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.totalSubjects} <span className="text-xs font-bold text-[#666666]">{language === "zh" ? "门" : "ITEMS"}</span>
              </div>
              <span className="text-[11px] text-[#666666] block mt-0.5 font-bold">
                {workspaceMetrics.totalEstimatedHours} {language === "zh" ? "总规划学时" : "PLANNED HOURS"}
              </span>
            </div>
          </div>

          {/* Card 2: Nearest Exam Countdown */}
          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "最近大考" : "NEAREST EXAM"}]</span>
              <Clock className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.nearestDays !== null ? (
                  workspaceMetrics.nearestDays <= 0 ? (
                    language === "zh" ? "TODAY" : "TODAY"
                  ) : (
                    <>
                      D-{workspaceMetrics.nearestDays}{" "}
                      <span className="text-xs font-bold text-[#666666]">{language === "zh" ? "天" : "DAYS"}</span>
                    </>
                  )
                ) : (
                  "--"
                )}
              </div>
              <span className="text-[11px] text-[#666666] block mt-0.5 truncate font-bold">
                {workspaceMetrics.nearestPlan ? workspaceMetrics.nearestPlan.examName : (language === "zh" ? "暂无排期" : "NO EXAM DATE")}
              </span>
            </div>
          </div>

          {/* Card 3: Today's Tasks */}
          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "今日待办" : "TODAY TASKS"}]</span>
              <CheckSquare className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.todayCompleted} / {workspaceMetrics.todayTotal}
              </div>
              <span className="text-[11px] text-[#666666] block mt-0.5 font-bold">
                {workspaceMetrics.todayTotal === 0
                  ? (language === "zh" ? "今日暂无排程任务" : "NO TASKS SCHEDULED")
                  : workspaceMetrics.todayCompleted === workspaceMetrics.todayTotal
                  ? (language === "zh" ? "今日任务已全部清零!" : "ALL DONE TODAY!")
                  : (language === "zh" ? `还剩 ${workspaceMetrics.todayTotal - workspaceMetrics.todayCompleted} 个待完成` : `${workspaceMetrics.todayTotal - workspaceMetrics.todayCompleted} REMAINING`)}
              </span>
            </div>
          </div>

          {/* Card 4: Global Progress */}
          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "总体进度" : "GLOBAL PROGRESS"}]</span>
              <TrendingUp className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.globalProgress}%
              </div>
              <div className="w-full bg-white border border-[#111111] h-2 overflow-hidden mt-1.5">
                <div
                  className="bg-[#111111] h-full transition-all duration-500"
                  style={{ width: `${workspaceMetrics.globalProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. 科目卡片 (COURSE SUBJECT CARDS)                                         */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#111111]" />
            <h2 className="font-bold text-sm uppercase text-[#111111]">
              [{language === "zh" ? "科目卡片" : "COURSE SUBJECT CARDS"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {displayedPlans.length} {language === "zh" ? "门科目" : "COURSES"}
            </span>
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "zh" ? "搜索科目..." : "Search subject..."}
                className="pl-8 pr-3 py-1 text-xs bg-white border border-[#111111] text-[#111111] outline-none w-36 sm:w-48 font-mono"
              />
            </div>

            {/* Category Dropdown */}
            {subjectCategories.length > 1 && (
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-[#111111] text-[#111111] outline-none font-mono cursor-pointer font-bold"
              >
                <option value="all">{language === "zh" ? "[全部类别]" : "[ALL CATEGORIES]"}</option>
                {subjectCategories.map((c) => (
                  <option key={c} value={c}>
                    [{c}]
                  </option>
                ))}
              </select>
            )}

            {/* Sort options */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="px-2 py-1 text-xs bg-white border border-[#111111] text-[#111111] outline-none font-mono cursor-pointer font-bold"
            >
              <option value="urgent">{language === "zh" ? "[按倒计时]" : "[SORT: DATE]"}</option>
              <option value="progress">{language === "zh" ? "[按总进度]" : "[SORT: PROGRESS]"}</option>
              <option value="name">{language === "zh" ? "[按科目名]" : "[SORT: NAME]"}</option>
            </select>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedPlans.map((plan) => {
            const isCurrentActive = activePlan?.id === plan.id;
            const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
            const totalCount = plan.tasks.length;
            const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
            const daysLeft = getDaysRemaining(plan.examDate);
            const overdueCount = plan.tasks.filter((t) => t.date < todayStr && t.status !== "completed").length;

            return (
              <div
                key={plan.id}
                className={`bg-white border border-[#111111] p-5 flex flex-col justify-between transition-all relative ${
                  isCurrentActive ? "bg-[#fafafa] ring-2 ring-[#111111]" : ""
                }`}
              >
                {/* Top Badge Row */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-8 h-8 bg-white border border-[#111111] flex items-center justify-center text-[#111111] shrink-0 font-bold">
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="border border-[#111111] bg-white px-1.5 py-0.5 text-[10px] font-bold truncate block max-w-[130px] uppercase">
                          [{plan.subject || (language === "zh" ? "通用学科" : "General")}]
                        </span>
                      </div>
                    </div>

                    {/* Countdown Pill */}
                    {daysLeft !== null && (
                      <span
                        className="px-2 py-0.5 border border-[#111111] bg-[#111111] text-white text-[11px] font-bold tracking-tight shrink-0 font-mono"
                      >
                        {daysLeft <= 0
                          ? (language === "zh" ? "TODAY" : "TODAY")
                          : `D-${daysLeft} ${language === "zh" ? "天" : "d"}`}
                      </span>
                    )}
                  </div>

                  {/* Exam Title */}
                  <div>
                    <h3
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("course", plan.id);
                      }}
                      className="font-bold text-sm text-[#111111] hover:underline cursor-pointer transition-colors line-clamp-2 leading-snug"
                    >
                      {plan.examName}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-[#666666] mt-1.5 font-bold">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{plan.examDate || (language === "zh" ? "待定日期" : "TBD")}</span>
                      </span>
                      <span>•</span>
                      <span>{plan.topics?.length || 0} {language === "zh" ? "考点" : "TOPICS"}</span>
                      <span>•</span>
                      <span>{plan.tasks?.length || 0} {language === "zh" ? "任务" : "TASKS"}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1 font-bold">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#666666]">[{language === "zh" ? "备考进度" : "PROGRESS"}]</span>
                      <span className="text-[#111111]">{progress}% ({completedCount}/{totalCount})</span>
                    </div>
                    <div className="w-full bg-white border border-[#111111] h-2 overflow-hidden">
                      <div
                        className="h-full bg-[#111111] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Overdue / Urgent Alert notice if any */}
                  {overdueCount > 0 && (
                    <div className="p-2 bg-white border border-[#111111] text-[10px] text-[#111111] flex items-center space-x-1.5 font-bold">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>[{language === "zh" ? `${overdueCount} 个往日待办积压` : `${overdueCount} OVERDUE`}]</span>
                    </div>
                  )}

                  {/* Key Topics Tag Chips */}
                  {plan.topics && plan.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {plan.topics.slice(0, 3).map((top) => (
                        <span
                          key={top.id}
                          className="text-[10px] px-1.5 py-0.5 bg-white text-[#111111] border border-[#111111] truncate max-w-[110px] font-mono font-bold"
                        >
                          [{top.title}]
                        </span>
                      ))}
                      {plan.topics.length > 3 && (
                        <span className="text-[10px] px-1 py-0.5 text-[#666666] font-bold">
                          +{plan.topics.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-3.5 mt-3 border-t border-[#111111] flex items-center justify-between gap-1 text-xs font-mono">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("todo", plan.id);
                      }}
                      className="px-2 py-1 bg-white hover:bg-[#ededed] text-[#111111] font-bold transition-colors flex items-center space-x-1 border border-[#111111] cursor-pointer"
                      title={language === "zh" ? "打开该科目每日待办" : "Open Daily To-Do"}
                    >
                      <CheckSquare className="w-3 h-3" />
                      <span>{language === "zh" ? "待办" : "TO-DO"}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("course", plan.id);
                      }}
                      className="px-2 py-1 bg-white hover:bg-[#ededed] text-[#111111] font-bold transition-colors flex items-center space-x-1 border border-[#111111] cursor-pointer"
                      title={language === "zh" ? "考纲资料" : "Knowledge Base"}
                    >
                      <BookOpen className="w-3 h-3" />
                      <span>{language === "zh" ? "资料" : "DOCS"}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("realtime", plan.id);
                      }}
                      className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                      title={language === "zh" ? "自适应智能重排" : "Adaptive Rebalance"}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => downloadICSFile(plan)}
                      className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                      title={language === "zh" ? "导出日历" : "Export .ics"}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {(onRequestDeletePlan || onDeletePlan) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRequestDeletePlan) {
                            onRequestDeletePlan(plan);
                          } else if (onDeletePlan) {
                            onDeletePlan(plan.id);
                          }
                        }}
                        className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                        title={language === "zh" ? "删除此科目" : "Delete Subject"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      onSelectPlan(plan.id);
                      onNavigateToTab("course", plan.id);
                    }}
                    className="flex items-center space-x-1 font-bold text-[#111111] hover:underline transition-colors text-xs cursor-pointer"
                  >
                    <span>[{language === "zh" ? "进入" : "ENTER"}]</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Quick Add Subject Card */}
          <div
            onClick={onAddNewSubject}
            className="border-2 border-dashed border-[#111111] hover:bg-[#ededed] bg-[#fafafa] p-6 flex flex-col items-center justify-center text-center space-y-2.5 cursor-pointer transition-all min-h-[200px]"
          >
            <div className="w-9 h-9 bg-white border border-[#111111] flex items-center justify-center text-[#111111]">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#111111] uppercase">
                [{language === "zh" ? "新建科目" : "ADD EXAM SUBJECT"}]
              </h4>
              <p className="text-xs text-[#666666] mt-1 max-w-[200px] font-mono">
                {language === "zh" ? "支持上传大纲、讲义、PPT 与历年真题" : "Upload syllabus, lecture notes or past papers"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. 今日日程 (TODAY'S SCHEDULE QUEUE)                                       */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-[#111111]" />
            <h2 className="font-bold text-sm uppercase text-[#111111]">
              [{language === "zh" ? "今日跨科日程" : "CROSS-SUBJECT DAILY SCHEDULE"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {crossSubjectDailyTasks.filter((t) => t.task.status === "completed").length} / {crossSubjectDailyTasks.length} [{language === "zh" ? "已完成" : "DONE"}]
            </span>
          </div>

          {/* Date Selector Navigation */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto font-mono">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer ${
                selectedDate === todayStr
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
              }`}
            >
              [{language === "zh" ? "今天" : "TODAY"}]
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-xs bg-white border border-[#111111] text-[#111111] outline-none cursor-pointer font-mono font-bold"
            />
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task List Items */}
        {crossSubjectDailyTasks.length === 0 ? (
          <div className="py-10 text-center space-y-2 bg-[#fafafa] border border-dashed border-[#111111]/40">
            <CheckCircle2 className="w-8 h-8 text-[#888888] mx-auto" />
            <p className="text-xs text-[#666666] font-mono">
              {language === "zh"
                ? `[${selectedDate}] 暂无任何科目的排程复习任务。`
                : `NO STUDY TASKS SCHEDULED FOR [${selectedDate}].`}
            </p>
          </div>
        ) : (
          <div className="space-y-2 font-mono">
            {crossSubjectDailyTasks.map(({ task, plan }, index) => {
              const isCompleted = task.status === "completed";
              const tagClass = CATEGORY_TAG_CLASS[task.category] || "border border-[#111111] bg-white text-[#111111]";

              return (
                <div
                  key={`${plan.id}-${task.id}-${index}`}
                  className={`p-3.5 border border-[#111111] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCompleted
                      ? "bg-[#fafafa] text-[#888888]"
                      : "bg-white text-[#111111]"
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTaskStatus(plan.id, task.id)}
                      className="mt-0.5 shrink-0 cursor-pointer"
                    >
                      {isCompleted ? (
                        <CheckSquare className="w-4 h-4 text-[#111111]" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#888888] hover:text-[#111111]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Course Tag */}
                        <span className="border border-[#111111] bg-[#111111] text-white px-1.5 py-0.2 text-[10px] font-bold truncate max-w-[140px]">
                          [{plan.examName}]
                        </span>

                        {/* Category Tag */}
                        <span className={`${tagClass} px-1.5 py-0.2 text-[10px] font-bold uppercase`}>
                          [{t(`cat_${task.category}` as any) || task.category}]
                        </span>

                        {/* Estimated Duration */}
                        <span className="text-[10px] text-[#666666] flex items-center space-x-1 font-bold">
                          <Clock className="w-3 h-3 text-[#666666]" />
                          <span>{task.durationMinutes} {language === "zh" ? "分钟" : "MIN"}</span>
                        </span>
                      </div>

                      {/* Task Title */}
                      <p
                        className={`text-xs font-bold ${
                          isCompleted ? "line-through text-[#888888]" : "text-[#111111]"
                        }`}
                      >
                        {task.title}
                      </p>

                      {/* Objectives or prompt */}
                      {task.keyObjectives && task.keyObjectives.length > 0 && (
                        <p className="text-[11px] text-[#666666] line-clamp-1">
                          {task.keyObjectives.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Interactive Quick Tools */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center font-mono">
                    {task.activeRecallPrompt && (
                      <button
                        onClick={() => setActiveQuizTask({ task, planId: plan.id })}
                        className="px-2.5 py-1 text-[11px] bg-white hover:bg-[#111111] hover:text-white text-[#111111] font-bold transition-colors flex items-center space-x-1 cursor-pointer border border-[#111111]"
                        title="Start Active Recall Quiz"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>[{language === "zh" ? "快速测验" : "QUIZ"}]</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTimerTask({ task, planId: plan.id })}
                      className="px-2.5 py-1 text-[11px] bg-[#111111] hover:bg-[#333333] text-white font-bold transition-colors flex items-center space-x-1 cursor-pointer border border-[#111111]"
                      title="Launch Focus Pomodoro Timer"
                    >
                      <Play className="w-3 h-3" />
                      <span>[{language === "zh" ? "专注计时" : "FOCUS"}]</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. 考试日程 (EXAM MILESTONES & TIMELINE)                                   */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-[#111111]" />
            <h3 className="font-bold text-sm uppercase text-[#111111]">
              [{language === "zh" ? "考试日程" : "EXAM SCHEDULE & MILESTONES"}]
            </h3>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {plans.filter((p) => p.examDate).length} {language === "zh" ? "场考试" : "EXAMS"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 font-mono">
          {plans
            .filter((p) => p.examDate)
            .sort((a, b) => (a.examDate || "").localeCompare(b.examDate || ""))
            .map((p, idx) => {
              const days = getDaysRemaining(p.examDate);
              const completedCount = p.tasks.filter((t) => t.status === "completed").length;
              const totalCount = p.tasks.length;
              const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPlan(p.id);
                    onNavigateToTab("course", p.id);
                  }}
                  className="bg-white hover:bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-3 transition-all cursor-pointer group"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5 min-w-0">
                        <span className="w-5 h-5 bg-[#111111] text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="border border-[#111111] bg-white px-1.5 py-0.2 text-[10px] font-bold truncate max-w-[120px] uppercase">
                          [{p.subject || (language === "zh" ? "通用" : "Course")}]
                        </span>
                      </div>

                      <span
                        className="px-2 py-0.5 border border-[#111111] bg-[#111111] text-white text-[11px] font-bold shrink-0 font-mono"
                      >
                        {days !== null ? (days <= 0 ? (language === "zh" ? "TODAY" : "TODAY") : `D-${days} ${language === "zh" ? "天" : "d"}`) : "--"}
                      </span>
                    </div>

                    <h4 className="font-bold text-xs text-[#111111] group-hover:underline transition-colors truncate">
                      {p.examName}
                    </h4>

                    <div className="flex items-center space-x-2 text-[11px] text-[#666666] font-bold">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{p.examDate}</span>
                      </span>
                      <span>•</span>
                      <span>{progress}% [{language === "zh" ? "完成度" : "DONE"}]</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#111111] flex items-center justify-between text-[11px] text-[#666666] font-bold">
                    <span>{p.tasks.length} {language === "zh" ? "个复习任务" : "TASKS"}</span>
                    <span className="flex items-center space-x-0.5 text-[#111111] font-bold">
                      <span>[{language === "zh" ? "进入科目" : "VIEW"}]</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </section>

      {/* Focus Timer Modal */}
      {activeTimerTask && (
        <TaskFocusTimerModal
          task={activeTimerTask.task}
          isOpen={true}
          onClose={() => setActiveTimerTask(null)}
          onTaskCompleted={handleTimerCompleted}
        />
      )}

      {/* Active Recall Quiz Modal */}
      {activeQuizTask && (
        <QuizModal
          task={activeQuizTask.task}
          isOpen={true}
          onClose={() => setActiveQuizTask(null)}
          onMasteryUpdated={(rating) => {
            const targetPlan = plans.find((p) => p.id === activeQuizTask.planId);
            if (targetPlan) {
              const updated = {
                ...targetPlan,
                tasks: targetPlan.tasks.map((t) =>
                  t.id === activeQuizTask.task.id ? { ...t, confidenceRating: rating } : t
                ),
              };
              onUpdatePlan(updated);
            }
          }}
        />
      )}
    </div>
  );
}
