import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Sun,
  ArrowUpRight,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AppTab, ExamStudyPlan, StudyTask } from "../types";
import { addDays, daysBetween, toLocalDateString } from "../lib/date";
import { useI18n } from "../lib/i18n";
import { playCompletionChime } from "../lib/audio";
import { starquizPracticeUrlForTask } from "../lib/links";
import { primeHandoffForTask } from "../lib/handoff";
import { PinnedRoadmapTodoList } from "./PinnedRoadmapTodoList";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";

interface TodayFocusViewProps {
  plans: ExamStudyPlan[];
  onNavigateToTab: (tab: AppTab, planId?: string) => void;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onAddNewSubject: () => void;
  onNotice?: (message: string | null) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  soundAlertsEnabled: boolean;
  defaultFocusDuration: number;
}

type DayItem = { task: StudyTask; plan: ExamStudyPlan };

function sortDayItems(items: DayItem[]) {
  return [...items].sort((a, b) => {
    if (a.task.status === "completed" && b.task.status !== "completed") return 1;
    if (a.task.status !== "completed" && b.task.status === "completed") return -1;
    return (a.task.startTime || "").localeCompare(b.task.startTime || "");
  });
}

export function TodayFocusView({
  plans,
  onNavigateToTab,
  onUpdatePlan,
  onAddNewSubject,
  onNotice,
  selectedDate,
  onSelectDate,
  soundAlertsEnabled,
  defaultFocusDuration,
}: TodayFocusViewProps) {
  const { language } = useI18n();
  const isZh = language === "zh";
  const todayStr = useMemo(() => toLocalDateString(), []);

  const [activeTimer, setActiveTimer] = useState<DayItem | null>(null);

  const dayItems = useMemo(() => {
    const rows: DayItem[] = [];
    plans.forEach((plan) => {
      (plan.tasks || []).forEach((task) => {
        if (task.date === selectedDate) rows.push({ task, plan });
      });
    });
    return sortDayItems(rows);
  }, [plans, selectedDate]);

  const nearestExam = useMemo(() => {
    const upcoming = plans
      .filter((plan) => !!plan.examDate)
      .map((plan) => ({ plan, days: daysBetween(todayStr, plan.examDate) }))
      .filter((entry) => entry.days >= 0)
      .sort((a, b) => a.days - b.days);
    return upcoming[0] || null;
  }, [plans, todayStr]);

  const findItem = (taskId: string) => dayItems.find((item) => item.task.id === taskId);

  const patchPlanTask = (
    item: DayItem,
    updater: (task: StudyTask) => StudyTask,
    notice?: string
  ) => {
    onUpdatePlan({
      ...item.plan,
      updatedAt: new Date().toISOString(),
      tasks: item.plan.tasks.map((task) => (task.id === item.task.id ? updater(task) : task)),
    });
    if (notice) onNotice?.(notice);
  };

  const handleToggleComplete = (taskId: string) => {
    const item = findItem(taskId);
    if (!item) return;
    const willComplete = item.task.status !== "completed";
    patchPlanTask(item, (task) => ({
      ...task,
      status: willComplete ? "completed" : "pending",
      completedAt: willComplete ? new Date().toISOString() : undefined,
    }));

    if (willComplete) {
      if (soundAlertsEnabled) playCompletionChime();
      const allDone = dayItems.every(
        (candidate) => candidate.task.id === taskId || candidate.task.status === "completed"
      );
      if (allDone && dayItems.length > 0) {
        confetti({ particleCount: 55, spread: 65, origin: { y: 0.7 } });
      }
    }
  };

  const handleUpdateConfidence = (taskId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    const item = findItem(taskId);
    if (!item) return;
    patchPlanTask(item, (task) => ({ ...task, confidenceRating: rating }));
  };

  const handleSaveNotes = (taskId: string, notes: string) => {
    const item = findItem(taskId);
    if (!item) return;
    patchPlanTask(item, (task) => ({ ...task, notes }));
  };

  const handleDeleteTask = (taskId: string) => {
    const item = findItem(taskId);
    if (!item) return;
    onUpdatePlan({
      ...item.plan,
      updatedAt: new Date().toISOString(),
      tasks: item.plan.tasks.filter((task) => task.id !== taskId),
    });
    onNotice?.(
      isZh
        ? `已从「${item.plan.examName}」移除任务「${item.task.title}」。`
        : `Removed "${item.task.title}" from ${item.plan.examName}.`
    );
  };

  const handleTimerCompleted = (minutes: number, rating?: 1 | 2 | 3 | 4 | 5) => {
    if (!activeTimer) return;
    onUpdatePlan({
      ...activeTimer.plan,
      updatedAt: new Date().toISOString(),
      tasks: activeTimer.plan.tasks.map((task) =>
        task.id === activeTimer.task.id
          ? {
              ...task,
              status: "completed",
              actualMinutesSpent: minutes,
              confidenceRating: rating || task.confidenceRating,
              completedAt: new Date().toISOString(),
            }
          : task
      ),
    });
    if (soundAlertsEnabled) playCompletionChime();
    setActiveTimer(null);
  };

  const isToday = selectedDate === todayStr;
  const completedCount = dayItems.filter((item) => item.task.status === "completed").length;

  // One primary focus: the next pending task, surfaced above the overview list.
  const nextItem = useMemo(
    () => dayItems.find((item) => item.task.status !== "completed") || null,
    [dayItems]
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-5 animate-fadeIn text-[#1c1b1a]">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-1">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="ui-chip">{isZh ? "每日任务" : "Daily tasks"}</span>
            {nearestExam && (
              <span className="ui-chip gap-1 tabular-nums">
                <CalendarDays className="w-3 h-3" />
                {nearestExam.plan.examName} ·{" "}
                {nearestExam.days === 0
                  ? isZh
                    ? "今天考试"
                    : "Exam today"
                  : isZh
                    ? `还剩 ${nearestExam.days} 天`
                    : `${nearestExam.days} days left`}
              </span>
            )}
          </div>

          <h1 className="ui-page-title mt-2">{isZh ? "今日待办" : "Today Tasks"}</h1>
          <p className="mt-1 text-[13px] text-[#8a8580] tabular-nums">
            {selectedDate}
            {" · "}
            {dayItems.length === 0
              ? isZh
                ? "暂无任务"
                : "No tasks"
              : `${completedCount} / ${dayItems.length} ${isZh ? "已完成" : "completed"}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => onSelectDate(addDays(selectedDate, -1))}
            className="ui-btn ui-btn-ghost px-2 py-2 min-w-9 min-h-9"
            title={isZh ? "前一天" : "Previous day"}
            aria-label={isZh ? "前一天" : "Previous day"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-0.5 rounded-lg bg-[#f1efe9] p-0.5">
            <button
              onClick={() => onSelectDate(todayStr)}
              className={`px-3 min-h-8 rounded-[7px] text-[13px] font-medium transition-all cursor-pointer ${
                isToday
                  ? "bg-white text-[#1c1b1a] shadow-[0_1px_2px_rgba(28,27,26,0.08)]"
                  : "text-[#6b6660] hover:text-[#1c1b1a]"
              }`}
            >
              {isZh ? "今天" : "Today"}
            </button>
            <label className="relative min-h-8 flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => event.target.value && onSelectDate(event.target.value)}
                aria-label={isZh ? "选择日期" : "Choose date"}
                className="h-8 rounded-[7px] border-0 bg-transparent px-2 text-[13px] tabular-nums text-[#1c1b1a] outline-none cursor-pointer"
              />
            </label>
          </div>
          <button
            onClick={() => onSelectDate(addDays(selectedDate, 1))}
            className="ui-btn ui-btn-ghost px-2 py-2 min-w-9 min-h-9"
            title={isZh ? "后一天" : "Next day"}
            aria-label={isZh ? "后一天" : "Next day"}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="ui-card py-16 px-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#f1efe9] text-[#8a8580] flex items-center justify-center mx-auto">
            <Sun className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {isZh ? "还没有备考科目" : "No exam subjects yet"}
            </h2>
            <p className="ui-muted text-[13px] leading-relaxed max-w-md mx-auto">
              {isZh
                ? "上传课程资料和考试日期，AI 会自动整理考点并排好每天的复习任务。"
                : "Upload your course materials and exam date. AI will organize the syllabus and schedule daily study tasks."}
            </p>
          </div>
          <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary">
            <Plus className="w-4 h-4" />
            {isZh ? "新建备考科目" : "Create subject"}
          </button>
        </div>
      ) : dayItems.length === 0 ? (
        <div className="ui-card py-14 px-6 text-center space-y-3 border-dashed">
          <CheckCircle2 className="w-8 h-8 text-[#a39e97] mx-auto" />
          <p className="text-[13px] text-[#8a8580]">
            {isZh
              ? `${selectedDate} 这一天没有排程的学习任务。`
              : `No study tasks scheduled for ${selectedDate}.`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={() => onNavigateToTab("master_calendar")}
              className="ui-btn ui-btn-ghost"
            >
              <CalendarDays className="w-4 h-4" />
              {isZh ? "查看全科日历" : "View calendar"}
            </button>
            {!isToday && (
              <button
                onClick={() => onSelectDate(todayStr)}
                className="ui-btn ui-btn-primary"
              >
                {isZh ? "回到今天" : "Back to today"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {nextItem && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#f0e4c0] bg-[#FFF6DD] px-4 py-3.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-[#1c1b1a]">
                  {nextItem.task.title}
                </div>
                <div className="mt-0.5 truncate text-[12px] text-[#8A5A00] tabular-nums">
                  {nextItem.plan.examName} · {nextItem.task.topicTitle} · {nextItem.task.durationMinutes}{" "}
                  {isZh ? "分钟" : "min"}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <a
                  href={starquizPracticeUrlForTask(nextItem.plan, nextItem.task, {
                    examName: nextItem.plan.examName,
                    date: nextItem.task.date,
                    taskId: nextItem.task.id,
                  })}
                  onClick={() => primeHandoffForTask(nextItem.plan, nextItem.task)}
                  className="ui-btn ui-btn-ghost bg-white"
                  title={isZh ? "去 StarQuiz 练这个考点" : "Practice this topic in StarQuiz"}
                >
                  {isZh ? "练这个考点" : "Practice"}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => setActiveTimer(nextItem)}
                  className="ui-btn ui-btn-primary"
                >
                  <Play className="w-4 h-4 fill-current" />
                  {isZh ? "开始专注" : "Start focus"}
                </button>
              </div>
            </div>
          )}

          <PinnedRoadmapTodoList
            tasks={dayItems.map((item) => ({
              ...item.task,
              topicTitle: `[${item.plan.examName}] ${item.task.topicTitle || ""}`,
            }))}
            onToggleComplete={handleToggleComplete}
            onUpdateConfidence={handleUpdateConfidence}
            onSaveNotes={handleSaveNotes}
            onDeleteTask={handleDeleteTask}
            onStartTimer={(task) => {
              const item = findItem(task.id);
              if (item) setActiveTimer(item);
            }}
            selectedDate={selectedDate}
          />
        </div>
      )}

      {activeTimer && (
        <TaskFocusTimerModal
          task={activeTimer.task}
          isOpen={true}
          onClose={() => setActiveTimer(null)}
          onTaskCompleted={handleTimerCompleted}
          soundAlertsEnabled={soundAlertsEnabled}
          defaultFocusDuration={defaultFocusDuration}
        />
      )}

    </div>
  );
}
