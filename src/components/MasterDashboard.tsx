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
  Play,
  Sparkles,
  BookOpen,
  ChevronRight,
  Target,
  Trash2,
  Layers,
  ChevronLeft,
  Pin
} from "lucide-react";
import confetti from "canvas-confetti";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { playCompletionChime } from "../lib/audio";
import { useI18n } from "../lib/i18n";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { QuizModal } from "./QuizModal";
import { CourseAccordionGallery } from "./CourseAccordionGallery";
import { PinnedRoadmapTodoList } from "./PinnedRoadmapTodoList";

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

          {/* Card 1: Canary Yellow */}
          <div className="bg-[#FCD33B] border border-[#111111] p-4 flex flex-col justify-between space-y-2 shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs text-[#111111] font-bold">
              <span>[{language === "zh" ? "在考科目" : "COURSES"}]</span>
              <BookOpen className="w-4 h-4 text-[#111111]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">
                {workspaceMetrics.totalSubjects}
              </div>
            </div>
          </div>

          {/* Card 2: Concrete Gray */}
          <div className="bg-[#D8D8D8] border border-[#111111] p-4 flex flex-col justify-between space-y-2 shadow-xs transition-transform hover:-translate-y-0.5">
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

          {/* Card 3: Stone Gray */}
          <div className="bg-[#B5B5B5] border border-[#111111] p-4 flex flex-col justify-between space-y-2 shadow-xs transition-transform hover:-translate-y-0.5">
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

          {/* Card 4: Dark Slate */}
          <div className="bg-[#282828] border border-[#111111] p-4 flex flex-col justify-between space-y-2 text-white shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-xs text-[#D8D8D8] font-bold">
              <span>[{language === "zh" ? "总进度" : "PROGRESS"}]</span>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white tracking-tight">
                {workspaceMetrics.globalProgress}%
              </div>
              <div className="w-full bg-black/40 border border-white/30 h-2 overflow-hidden mt-1.5">
                <div
                  className="bg-[#FCD33B] h-full transition-all duration-500"
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
            <h2 className="font-bold text-sm text-[#111111]">
              {language === "zh" ? "今日待办" : "Today Tasks"}
            </h2>
          </div>

          <div className="flex items-center space-x-1 font-mono self-start sm:self-auto">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer rounded"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2.5 py-1 text-xs font-bold border transition-colors cursor-pointer rounded ${
                selectedDate === todayStr
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
              }`}
            >
              {language === "zh" ? "今天" : "Today"}
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2 py-1 text-xs bg-white border border-[#111111] text-[#111111] outline-none cursor-pointer font-mono font-bold rounded"
            />
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer rounded"
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
              {plans.length === 0
                ? (language === "zh"
                    ? "尚未添加备考科目。点击上方「新建备考计划」添加首门科目，系统将自动排程每日待办。"
                    : "No exam subjects added yet. Create a subject above to generate your daily adaptive tasks.")
                : (language === "zh"
                    ? `[${selectedDate}] 暂无任何科目的排程复习任务。`
                    : `NO STUDY TASKS SCHEDULED FOR [${selectedDate}].`)}
            </p>
          </div>
        ) : (
          <PinnedRoadmapTodoList
            tasks={crossSubjectDailyTasks.map((t) => ({
              ...t.task,
              topicTitle: `[${t.plan.examName}] ${t.task.topicTitle || ""}`,
            }))}
            onToggleComplete={(taskId) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === taskId);
              if (matched) {
                handleToggleTaskStatus(matched.plan.id, taskId);
              }
            }}
            onUpdateConfidence={(taskId, rating) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === taskId);
              if (matched) {
                const updatedPlan = {
                  ...matched.plan,
                  tasks: matched.plan.tasks.map((t) => (t.id === taskId ? { ...t, confidenceRating: rating } : t)),
                };
                onUpdatePlan(updatedPlan);
              }
            }}
            onSaveNotes={(taskId, notes) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === taskId);
              if (matched) {
                const updatedPlan = {
                  ...matched.plan,
                  tasks: matched.plan.tasks.map((t) => (t.id === taskId ? { ...t, notes } : t)),
                };
                onUpdatePlan(updatedPlan);
              }
            }}
            onDeleteTask={(taskId) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === taskId);
              if (matched) {
                const updatedPlan = {
                  ...matched.plan,
                  tasks: matched.plan.tasks.filter((t) => t.id !== taskId),
                };
                onUpdatePlan(updatedPlan);
              }
            }}
            onStartTimer={(task) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === task.id);
              if (matched) {
                setActiveTimerTask({ task, planId: matched.plan.id });
              }
            }}
            onStartQuiz={(task) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === task.id);
              if (matched) {
                setActiveQuizTask({ task, planId: matched.plan.id });
              }
            }}
            onStartRag={(task) => {
              const matched = crossSubjectDailyTasks.find((t) => t.task.id === task.id);
              if (matched) {
                onSelectPlan(matched.plan.id);
              }
            }}
            onAddNewTask={() => {
              if (plans.length > 0) {
                onSelectPlan(plans[0].id);
              }
            }}
            selectedDate={selectedDate}
          />
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
