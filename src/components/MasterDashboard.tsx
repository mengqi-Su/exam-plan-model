import React, { useState, useMemo } from "react";
import {
  LayoutDashboard,
  GraduationCap,
  Calendar,
  CheckSquare,
  Clock,
  Zap,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Flame,
  CheckCircle2,
  Circle,
  Play,
  Sparkles,
  HelpCircle,
  BookOpen,
  ChevronRight,
  RefreshCw,
  Target,
  FileText,
  Trash2,
  ExternalLink,
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
import { MasterCalendarView } from "./MasterCalendarView";

interface MasterDashboardProps {
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNavigateToTab: (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "add_subject", planId?: string) => void;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onDeletePlan?: (planId: string) => void;
  onAddNewSubject: () => void;
}

const CATEGORY_TAG_CLASS: Record<TaskCategory, string> = {
  theory: "notion-tag-purple",
  reading: "notion-tag-blue",
  practice_problems: "notion-tag-green",
  active_recall: "notion-tag-pink",
  flashcards: "notion-tag-orange",
  mock_exam: "notion-tag-red",
  review_weak_spots: "notion-tag-yellow",
  summary_cheat_sheet: "notion-tag-brown",
};

export function MasterDashboard({
  plans,
  activePlan,
  onSelectPlan,
  onNavigateToTab,
  onUpdatePlan,
  onDeletePlan,
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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8 animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. HERO & WORKSPACE METRICS BANNER                                       */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-[#787774] mb-1">
              <LayoutDashboard className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span className="font-medium">{t("workspace")}</span>
              <span>/</span>
              <span className="text-[#37352f] font-semibold">{language === "zh" ? "总览看板" : "Master Study Hub"}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352f] flex items-center space-x-2.5">
              <GraduationCap className="w-7 h-7 text-[#37352f]" />
              <span>{language === "zh" ? "科目看板" : "Exam Subjects Command Board"}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#787774] mt-1">
              {language === "zh"
                ? "一站式管理所有在考科目、倒计时排程、考纲知识图谱与今日跨学科复习日程。"
                : "Centralized workspace for multi-subject syllabus tracking, exam countdowns, and cross-subject daily schedules."}
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onAddNewSubject}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#37352f] hover:bg-[#201f1d] text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "zh" ? "新建科目" : "Add Exam Subject"}</span>
            </button>
          </div>
        </div>

        {/* Top 4 Notion Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          {/* Card 1: Active Subjects */}
          <div className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#787774]">
              <span className="font-medium">{language === "zh" ? "在考科目" : "Enrolled Subjects"}</span>
              <BookOpen className="w-4 h-4 text-[#2b78a0]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#37352f] tracking-tight">
                {workspaceMetrics.totalSubjects} <span className="text-xs font-normal text-[#787774]">{language === "zh" ? "门科目" : "Courses"}</span>
              </div>
              <span className="text-[11px] text-[#787774] block mt-0.5">
                {workspaceMetrics.totalEstimatedHours} {language === "zh" ? "总规划学时" : "Planned Hours"}
              </span>
            </div>
          </div>

          {/* Card 2: Nearest Exam Countdown */}
          <div className="bg-[#fbf3db] border border-[#f5e0b7] rounded-xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#cb912f]">
              <span className="font-semibold">{language === "zh" ? "最近大考" : "Nearest Exam"}</span>
              <Clock className="w-4 h-4 text-[#cb912f]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#cb912f] tracking-tight">
                {workspaceMetrics.nearestDays !== null ? (
                  workspaceMetrics.nearestDays <= 0 ? (
                    language === "zh" ? "今日考试" : "Today"
                  ) : (
                    <>
                      D-{workspaceMetrics.nearestDays}{" "}
                      <span className="text-xs font-normal text-[#787774]">{language === "zh" ? "天" : "Days"}</span>
                    </>
                  )
                ) : (
                  "--"
                )}
              </div>
              <span className="text-[11px] text-[#787774] block mt-0.5 truncate font-medium">
                {workspaceMetrics.nearestPlan ? workspaceMetrics.nearestPlan.examName : (language === "zh" ? "暂无排期" : "No exam date")}
              </span>
            </div>
          </div>

          {/* Card 3: Today's Tasks */}
          <div className="bg-[#edf3ec] border border-[#d5e5d3] rounded-xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#448361]">
              <span className="font-semibold">{language === "zh" ? "今日待办" : "Today's Tasks"}</span>
              <CheckSquare className="w-4 h-4 text-[#448361]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#448361] tracking-tight">
                {workspaceMetrics.todayCompleted} / {workspaceMetrics.todayTotal}
              </div>
              <span className="text-[11px] text-[#787774] block mt-0.5">
                {workspaceMetrics.todayTotal === 0
                  ? (language === "zh" ? "今日暂无排程任务" : "No tasks scheduled")
                  : workspaceMetrics.todayCompleted === workspaceMetrics.todayTotal
                  ? (language === "zh" ? "今日任务已全部清零!" : "All done today!")
                  : (language === "zh" ? `还剩 ${workspaceMetrics.todayTotal - workspaceMetrics.todayCompleted} 个待完成` : `${workspaceMetrics.todayTotal - workspaceMetrics.todayCompleted} remaining`)}
              </span>
            </div>
          </div>

          {/* Card 4: Global Progress */}
          <div className="bg-[#f0f4f8] border border-[#dce7f2] rounded-xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#2b78a0]">
              <span className="font-semibold">{language === "zh" ? "总体进度" : "Global Progress"}</span>
              <TrendingUp className="w-4 h-4 text-[#2b78a0]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#2b78a0] tracking-tight">
                {workspaceMetrics.globalProgress}%
              </div>
              <div className="w-full bg-[#dbe8f5] h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-[#2b78a0] h-full rounded-full transition-all duration-500"
                  style={{ width: `${workspaceMetrics.globalProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ALL EXAM SUBJECTS KANBAN / CARD GRID                                   */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#e9e9e7]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#37352f]" />
            <h2 className="font-bold text-base text-[#37352f]">
              {language === "zh" ? "科目卡片" : "Enrolled Course Subject Boards"}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#efefed] text-[#787774] font-medium">
              {displayedPlans.length}
            </span>
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9b9a97] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "zh" ? "搜索科目或考点..." : "Search subject or topic..."}
                className="pl-8 pr-3 py-1 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none focus:border-[#37352f] w-36 sm:w-48 transition-all"
              />
            </div>

            {/* Category Dropdown */}
            {subjectCategories.length > 1 && (
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="px-2 py-1 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none text-[#37352f]"
              >
                <option value="all">{language === "zh" ? "全部类别" : "All Categories"}</option>
                {subjectCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {/* Sort options */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as any)}
              className="px-2 py-1 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none text-[#37352f]"
            >
              <option value="urgent">{language === "zh" ? "按倒计时" : "Sort by Exam Date"}</option>
              <option value="progress">{language === "zh" ? "按总进度" : "Sort by Progress"}</option>
              <option value="name">{language === "zh" ? "按科目名" : "Sort by Name"}</option>
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
            const todayTasksForThisPlan = plan.tasks.filter((t) => t.date === todayStr && t.status !== "completed");
            const overdueCount = plan.tasks.filter((t) => t.date < todayStr && t.status !== "completed").length;

            return (
              <div
                key={plan.id}
                className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between transition-all hover:shadow-md hover:border-[#b4b4b0] relative group ${
                  isCurrentActive ? "border-[#2b78a0]/60 ring-1 ring-[#2b78a0]/20" : "border-[#e9e9e7]"
                }`}
              >
                {/* Top Badge Row */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#f7f6f3] border border-[#e9e9e7] flex items-center justify-center text-[#37352f] shrink-0 font-bold">
                        <GraduationCap className="w-4 h-4 text-[#2b78a0]" />
                      </div>
                      <div className="min-w-0">
                        <span className="notion-tag-gray px-1.5 py-0.5 rounded text-[10px] font-medium truncate block max-w-[140px]">
                          {plan.subject || (language === "zh" ? "通用学科" : "General")}
                        </span>
                      </div>
                    </div>

                    {/* Countdown Pill */}
                    {daysLeft !== null && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-tight shrink-0 ${
                          daysLeft <= 3
                            ? "bg-[#fbf3f2] text-[#d44c47] border border-[#f5d5d3]"
                            : daysLeft <= 7
                            ? "bg-[#fbf3db] text-[#cb912f] border border-[#f6e3b5]"
                            : "bg-[#edf3ec] text-[#448361] border border-[#d5e5d3]"
                        }`}
                      >
                        {daysLeft <= 0
                          ? (language === "zh" ? "今日考试" : "Today")
                          : `${language === "zh" ? "倒计时 " : ""}${daysLeft}${language === "zh" ? " 天" : "d left"}`}
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
                      className="font-bold text-sm text-[#37352f] hover:text-[#2b78a0] cursor-pointer transition-colors line-clamp-2 leading-snug"
                    >
                      {plan.examName}
                    </h3>
                    <div className="flex items-center space-x-2 text-[11px] text-[#787774] mt-1">
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3 text-[#9b9a97]" />
                        <span>{plan.examDate || (language === "zh" ? "待定日期" : "TBD")}</span>
                      </span>
                      <span>•</span>
                      <span>{plan.topics?.length || 0} {language === "zh" ? "个考点" : "topics"}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#787774]">{language === "zh" ? "备考进度" : "Progress"}</span>
                      <span className="font-semibold text-[#37352f]">{progress}% ({completedCount}/{totalCount})</span>
                    </div>
                    <div className="w-full bg-[#f0f0ee] h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          progress >= 100
                            ? "bg-[#448361]"
                            : progress >= 50
                            ? "bg-[#2b78a0]"
                            : "bg-[#cb912f]"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Overdue / Urgent Alert notice if any */}
                  {overdueCount > 0 && (
                    <div className="p-2 bg-[#fbf3db]/70 border border-[#f5e0b7] rounded-md text-[10px] text-[#cb912f] flex items-center space-x-1.5 font-medium">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>{language === "zh" ? `${overdueCount} 个往日待办积压，建议自适应重排` : `${overdueCount} past tasks overdue`}</span>
                    </div>
                  )}

                  {/* Key Topics Tag Chips */}
                  {plan.topics && plan.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {plan.topics.slice(0, 3).map((top) => (
                        <span
                          key={top.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#f7f6f3] text-[#5a5a57] border border-[#e9e9e7] truncate max-w-[120px]"
                        >
                          {top.title}
                        </span>
                      ))}
                      {plan.topics.length > 3 && (
                        <span className="text-[10px] px-1 py-0.5 text-[#9b9a97]">
                          +{plan.topics.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 mt-3 border-t border-[#f0f0ee] flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("todo", plan.id);
                      }}
                      className="px-2.5 py-1 rounded bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] font-medium transition-colors flex items-center space-x-1"
                      title={language === "zh" ? "打开该科目每日待办" : "Open Daily To-Do"}
                    >
                      <CheckSquare className="w-3 h-3 text-[#787774]" />
                      <span>{language === "zh" ? "待办" : "To-Do"}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("course", plan.id);
                      }}
                      className="px-2.5 py-1 rounded bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] font-medium transition-colors flex items-center space-x-1"
                      title={language === "zh" ? "考纲资料" : "Knowledge Base"}
                    >
                      <BookOpen className="w-3 h-3 text-[#787774]" />
                      <span>{language === "zh" ? "资料" : "Docs"}</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("realtime", plan.id);
                      }}
                      className="p-1 rounded hover:bg-[#fbf3db] text-[#cb912f] transition-colors"
                      title={language === "zh" ? "智能重排" : "Adaptive Rebalance"}
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => downloadICSFile(plan)}
                      className="p-1 rounded hover:bg-[#edf3ec] text-[#448361] transition-colors"
                      title={language === "zh" ? "导出日历" : "Export .ics"}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onSelectPlan(plan.id);
                      onNavigateToTab("course", plan.id);
                    }}
                    className="flex items-center space-x-1 font-semibold text-[#2b78a0] hover:text-[#1e5876] transition-colors"
                  >
                    <span>{language === "zh" ? "进入主页" : "Enter"}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Quick Add Subject Card */}
          <div
            onClick={onAddNewSubject}
            className="border-2 border-dashed border-[#e9e9e7] hover:border-[#37352f] bg-[#fafaf9] hover:bg-[#f7f6f3] rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-2.5 cursor-pointer transition-all min-h-[220px]"
          >
            <div className="w-10 h-10 rounded-full bg-white border border-[#e9e9e7] flex items-center justify-center text-[#787774] shadow-2xs group-hover:scale-110 transition-transform">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#37352f]">
                {language === "zh" ? "新建科目" : "Add Another Exam Subject"}
              </h4>
              <p className="text-xs text-[#787774] mt-1 max-w-[200px]">
                {language === "zh" ? "支持上传 PPT、讲义、大纲与历年真题" : "Upload syllabus, lecture notes or past papers"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. MASTER CALENDAR ACCESS ACTION BANNER                                   */}
      {/* ========================================================================= */}
      <section>
        <div className="bg-[#f7f6f3] border border-[#e9e9e7] hover:border-[#b4b4b0] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-2xs group">
          <div className="flex items-center space-x-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-white border border-[#e9e9e7] flex items-center justify-center text-[#2b78a0] shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#37352f] flex items-center space-x-2">
                <span>{language === "zh" ? "全科复习日历" : "Master Study Calendar"}</span>
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white border border-[#e9e9e7] text-[#787774]">
                  {language === "zh" ? `共 ${workspaceMetrics.totalTasks} 项任务 · 支持科目筛选` : `${workspaceMetrics.totalTasks} Tasks · Filterable`}
                </span>
              </h3>
              <p className="text-xs text-[#787774] mt-0.5 truncate">
                {language === "zh"
                  ? "按月查看所有科目的排程任务与大考里程碑，支持按科目独立过滤与实时打卡。"
                  : "View multi-course study schedules, filter by subject, and manage daily milestones."}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigateToTab("master_calendar")}
            className="px-4 py-2 bg-[#37352f] hover:bg-[#201f1d] text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{language === "zh" ? "进入全科日历" : "Access Calendar"}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. TODAY'S CROSS-SUBJECT TASK SCHEDULE QUEUE                              */}
      {/* ========================================================================= */}
      <section className="bg-white border border-[#e9e9e7] rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0ee]">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-[#448361]" />
            <h2 className="font-bold text-base text-[#37352f]">
              {language === "zh" ? "今日日程" : "Cross-Subject Daily Schedule"}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-[#edf3ec] text-[#448361] font-semibold">
              {crossSubjectDailyTasks.filter((t) => t.task.status === "completed").length} / {crossSubjectDailyTasks.length} {language === "zh" ? "已完成" : "Done"}
            </span>
          </div>

          {/* Date Selector Navigation */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1 rounded hover:bg-[#efefed] text-[#787774] transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 text-xs rounded font-medium border transition-colors ${
                selectedDate === todayStr
                  ? "bg-[#37352f] text-white border-[#37352f]"
                  : "bg-white text-[#787774] border-[#d3d2cf] hover:bg-[#efefed]"
              }`}
            >
              {language === "zh" ? "今天" : "Today"}
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-xs bg-white border border-[#d3d2cf] rounded text-[#37352f] outline-none"
            />
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1 rounded hover:bg-[#efefed] text-[#787774] transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task List Items */}
        {crossSubjectDailyTasks.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#9b9a97] mx-auto opacity-60" />
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? `${selectedDate} 暂无任何科目的排程复习任务。`
                : `No study tasks scheduled across all subjects for ${selectedDate}.`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {crossSubjectDailyTasks.map(({ task, plan }, index) => {
              const isCompleted = task.status === "completed";
              const tagClass = CATEGORY_TAG_CLASS[task.category] || "notion-tag-gray";

              return (
                <div
                  key={`${plan.id}-${task.id}-${index}`}
                  className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCompleted
                      ? "bg-[#fafaf9] border-[#e9e9e7] opacity-70"
                      : "bg-white border-[#e9e9e7] hover:border-[#b4b4b0] shadow-2xs"
                  }`}
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTaskStatus(plan.id, task.id)}
                      className="mt-0.5 text-[#787774] hover:text-[#37352f] transition-colors shrink-0"
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-[#448361] fill-[#448361]/10" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#9b9a97]" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Course Tag */}
                        <span className="notion-tag-blue px-1.5 py-0.2 rounded text-[10px] font-semibold truncate max-w-[140px]">
                          {plan.examName}
                        </span>

                        {/* Category Tag */}
                        <span className={`${tagClass} px-1.5 py-0.2 rounded text-[10px]`}>
                          {t(`cat_${task.category}` as any) || task.category}
                        </span>

                        {/* Estimated Duration */}
                        <span className="text-[10px] text-[#787774] flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-[#9b9a97]" />
                          <span>{task.durationMinutes} {language === "zh" ? "分钟" : "min"}</span>
                        </span>
                      </div>

                      {/* Task Title */}
                      <p
                        className={`text-xs font-semibold ${
                          isCompleted ? "line-through text-[#9b9a97]" : "text-[#37352f]"
                        }`}
                      >
                        {task.title}
                      </p>

                      {/* Objectives or prompt */}
                      {task.keyObjectives && task.keyObjectives.length > 0 && (
                        <p className="text-[11px] text-[#787774] line-clamp-1">
                          {task.keyObjectives.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Interactive Quick Tools */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {task.activeRecallPrompt && (
                      <button
                        onClick={() => setActiveQuizTask({ task, planId: plan.id })}
                        className="px-2 py-1 rounded text-[11px] bg-[#fbf3db] hover:bg-[#faebc7] text-[#cb912f] font-medium transition-colors flex items-center space-x-1"
                        title="Start Active Recall Quiz"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>{language === "zh" ? "快速测验" : "Quiz"}</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTimerTask({ task, planId: plan.id })}
                      className="px-2.5 py-1 rounded text-[11px] bg-[#efefed] hover:bg-[#e3e2e0] text-[#37352f] font-medium transition-colors flex items-center space-x-1"
                      title="Launch Focus Pomodoro Timer"
                    >
                      <Play className="w-3 h-3 text-[#448361]" />
                      <span>{language === "zh" ? "专注计时" : "Focus"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. EXAM MILESTONES & TIMELINE ROADMAP                                     */}
      {/* ========================================================================= */}
      <section className="bg-[#f7f6f3] border border-[#e9e9e7] rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-[#2b78a0]" />
          <h3 className="font-bold text-sm text-[#37352f]">
            {language === "zh" ? "考试日程" : "Multi-Course Exam Milestones & Timeline"}
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans
            .filter((p) => p.examDate)
            .sort((a, b) => (a.examDate || "").localeCompare(b.examDate || ""))
            .map((p, idx) => {
              const days = getDaysRemaining(p.examDate);
              return (
                <div
                  key={p.id}
                  className="bg-white border border-[#e9e9e7] rounded-lg p-3.5 flex items-start justify-between space-x-3 shadow-2xs"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-5 h-5 rounded-full bg-[#efefed] text-[#37352f] font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-[#37352f] truncate block max-w-[150px]">
                        {p.examName}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#787774] block">
                      {p.examDate}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      days !== null && days <= 3
                        ? "bg-[#fbf3f2] text-[#d44c47]"
                        : "bg-[#edf3ec] text-[#448361]"
                    }`}
                  >
                    {days !== null ? (days <= 0 ? "Today" : `D-${days}`) : "--"}
                  </span>
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
