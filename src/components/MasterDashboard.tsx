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
import { CourseAccordionGallery } from "./CourseAccordionGallery";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState<string>("all");
  const [sortOption, setSortOption] = useState<"urgent" | "progress" | "name">("urgent");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const [activeTimerTask, setActiveTimerTask] = useState<{ task: StudyTask; planId: string } | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<{ task: StudyTask; planId: string } | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const getDaysRemaining = (examDateStr?: string) => {
    if (!examDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDateStr.split("-").map(Number);
    const examDate = new Date(y, m - 1, d);
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

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

    const sortedByDate = [...plans]
      .filter((p) => p.examDate)
      .sort((a, b) => (a.examDate || "").localeCompare(b.examDate || ""));
    const nearestPlan = sortedByDate[0] || null;
    const nearestDays = nearestPlan ? getDaysRemaining(nearestPlan.examDate) : null;

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

  const displayedPlans = useMemo(() => {
    let result = [...plans];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.examName.toLowerCase().includes(q) ||
          p.subject.toLowerCase().includes(q) ||
          p.topics?.some((top) => top.title.toLowerCase().includes(q))
      );
    }

    if (filterSubject !== "all") {
      result = result.filter((p) => p.subject === filterSubject);
    }

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

  const subjectCategories = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.subject) set.add(p.subject);
    });
    return Array.from(set);
  }, [plans]);

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

  const handleShiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10 animate-fadeIn text-[#111111] font-mono">

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#111111]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111111] flex items-center space-x-2.5">
              <GraduationCap className="w-7 h-7 text-[#111111]" />
              <span>{language === "zh" ? "科目总览" : "SUBJECTS"}</span>
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">

          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#666666] font-bold">
              <span>[{language === "zh" ? "在考科目" : "COURSES"}]</span>
              <BookOpen className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.totalSubjects}
              </div>
            </div>
          </div>

          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "最近考试" : "NEAREST EXAM"}]</span>
              <Clock className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.nearestDays !== null ? (
                  workspaceMetrics.nearestDays <= 0 ? (
                    language === "zh" ? "TODAY" : "TODAY"
                  ) : (
                    <>
                      D-{workspaceMetrics.nearestDays}
                    </>
                  )
                ) : (
                  "--"
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "今日待办" : "TODAY"}]</span>
              <CheckSquare className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.todayCompleted} / {workspaceMetrics.todayTotal}
              </div>
            </div>
          </div>

          <div className="bg-[#fafafa] border border-[#111111] p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "总进度" : "PROGRESS"}]</span>
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

      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#111111]" />
            <h2 className="font-bold text-sm uppercase text-[#111111]">
              [{language === "zh" ? "科目清单" : "COURSES"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {plans.length}
            </span>
          </div>
        </div>

        <CourseAccordionGallery
          plans={plans}
          activePlan={activePlan}
          onSelectPlan={onSelectPlan}
          onNavigateToTab={onNavigateToTab}
          onDeletePlan={onDeletePlan}
          onRequestDeletePlan={onRequestDeletePlan}
          onAddNewSubject={onAddNewSubject}
          language={language}
          todayStr={todayStr}
        />
      </section>

      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <CheckSquare className="w-4 h-4 text-[#111111]" />
            <h2 className="font-bold text-sm uppercase text-[#111111]">
              [{language === "zh" ? "今日待办" : "TODAY TASKS"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {crossSubjectDailyTasks.filter((t) => t.task.status === "completed").length} / {crossSubjectDailyTasks.length}
            </span>
          </div>

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

                        <span className="border border-[#111111] bg-[#111111] text-white px-1.5 py-0.2 text-[10px] font-bold truncate max-w-[140px]">
                          [{plan.examName}]
                        </span>

                        <span className={`${tagClass} px-1.5 py-0.2 text-[10px] font-bold uppercase`}>
                          [{t(`cat_${task.category}` as any) || task.category}]
                        </span>

                        <span className="text-[10px] text-[#666666] flex items-center space-x-1 font-bold">
                          <Clock className="w-3 h-3 text-[#666666]" />
                          <span>{task.durationMinutes} {language === "zh" ? "分钟" : "MIN"}</span>
                        </span>
                      </div>

                      <p
                        className={`text-xs font-bold ${
                          isCompleted ? "line-through text-[#888888]" : "text-[#111111]"
                        }`}
                      >
                        {task.title}
                      </p>

                      {task.keyObjectives && task.keyObjectives.length > 0 && (
                        <p className="text-[11px] text-[#666666] line-clamp-1">
                          {task.keyObjectives.join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

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

      {activeTimerTask && (
        <TaskFocusTimerModal
          task={activeTimerTask.task}
          isOpen={true}
          onClose={() => setActiveTimerTask(null)}
          onTaskCompleted={handleTimerCompleted}
        />
      )}

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
