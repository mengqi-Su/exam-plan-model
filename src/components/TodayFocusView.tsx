import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sun,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AppTab, ExamStudyPlan, StudyTask } from "../types";
import { addDays, daysBetween, toLocalDateString } from "../lib/date";
import { useI18n } from "../lib/i18n";
import { playCompletionChime } from "../lib/audio";
import { PinnedRoadmapTodoList } from "./PinnedRoadmapTodoList";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { RagKnowledgeModal } from "./RagKnowledgeModal";

interface TodayFocusViewProps {
  plans: ExamStudyPlan[];
  onNavigateToTab: (tab: AppTab, planId?: string) => void;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onAddNewSubject: () => void;
  onNotice?: (message: string | null) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
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
}: TodayFocusViewProps) {
  const { language } = useI18n();
  const isZh = language === "zh";
  const todayStr = useMemo(() => toLocalDateString(), []);

  const [activeTimer, setActiveTimer] = useState<DayItem | null>(null);
  const [activeRag, setActiveRag] = useState<DayItem | null>(null);

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
      playCompletionChime();
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
    playCompletionChime();
    setActiveTimer(null);
  };

  const isToday = selectedDate === todayStr;
  const completedCount = dayItems.filter((item) => item.task.status === "completed").length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 animate-fadeIn text-[#111111] font-mono">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#111111]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#666666]">
              DAILY TASKS
            </span>
            {nearestExam && (
              <span className="inline-flex items-center gap-1 border border-[#111111] bg-white px-2 py-0.5 font-mono text-[10px] font-bold">
                <CalendarDays className="w-3 h-3" />
                {nearestExam.plan.examName} ·{" "}
                {nearestExam.days === 0
                  ? isZh
                    ? "今天考试"
                    : "EXAM TODAY"
                  : `D-${nearestExam.days}`}
              </span>
            )}
          </div>

          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Sun className="w-6 h-6" />
            <span>{isZh ? "今日待办" : "Today Tasks"}</span>
          </h1>
          <p className="mt-1 text-[13px] text-[#666666]">
            {selectedDate}
            {" · "}
            {dayItems.length === 0
              ? isZh
                ? "暂无任务"
                : "No tasks"
              : `${completedCount} / ${dayItems.length} ${isZh ? "已完成" : "completed"}`}
          </p>
        </div>

        <div className="flex items-center space-x-1 self-start sm:self-auto">
          <button
            onClick={() => onSelectDate(addDays(selectedDate, -1))}
            className="p-1.5 min-w-9 min-h-9 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
            title={isZh ? "前一天" : "Previous day"}
            aria-label={isZh ? "前一天" : "Previous day"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectDate(todayStr)}
            className={`px-2.5 min-h-9 text-xs font-bold border transition-colors cursor-pointer ${
              isToday
                ? "bg-[#111111] text-white border-[#111111]"
                : "bg-white text-[#111111] border-[#111111] hover:bg-[#ededed]"
            }`}
          >
            {isZh ? "今天" : "Today"}
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => event.target.value && onSelectDate(event.target.value)}
            aria-label={isZh ? "选择日期" : "Choose date"}
            className="px-2 min-h-9 text-xs bg-white border border-[#111111] text-[#111111] outline-none cursor-pointer font-mono font-bold"
          />
          <button
            onClick={() => onSelectDate(addDays(selectedDate, 1))}
            className="p-1.5 min-w-9 min-h-9 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
            title={isZh ? "后一天" : "Next day"}
            aria-label={isZh ? "后一天" : "Next day"}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {plans.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-4 bg-white border border-[#111111] shadow-[4px_4px_0px_#111111]">
          <div className="w-12 h-12 bg-[#FCD33B] border border-[#111111] flex items-center justify-center mx-auto">
            <Sun className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold">{isZh ? "还没有备考科目" : "No exam subjects yet"}</h2>
            <p className="text-[13px] text-[#666666] leading-relaxed max-w-md mx-auto">
              {isZh
                ? "上传课程资料和考试日期，AI 会自动整理考点并排好每天的复习任务。"
                : "Upload your course materials and exam date. AI will organize the syllabus and schedule daily study tasks."}
            </p>
          </div>
          <button
            onClick={onAddNewSubject}
            className="inline-flex items-center gap-2 px-4 min-h-11 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isZh ? "新建备考科目" : "CREATE SUBJECT"}
          </button>
        </div>
      ) : dayItems.length === 0 ? (
        <div className="py-14 px-6 text-center space-y-3 bg-[#fafafa] border border-dashed border-[#111111]/40">
          <CheckCircle2 className="w-8 h-8 text-[#888888] mx-auto" />
          <p className="text-xs text-[#666666] font-mono">
            {isZh
              ? `[${selectedDate}] 这一天没有排程的学习任务。`
              : `NO STUDY TASKS SCHEDULED FOR [${selectedDate}].`}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              onClick={() => onNavigateToTab("master_calendar")}
              className="px-3 min-h-10 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
            >
              <CalendarDays className="inline w-4 h-4 mr-1.5" />
              {isZh ? "查看全科日历" : "VIEW CALENDAR"}
            </button>
            {!isToday && (
              <button
                onClick={() => onSelectDate(todayStr)}
                className="px-3 min-h-10 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
              >
                {isZh ? "回到今天" : "BACK TO TODAY"}
              </button>
            )}
          </div>
        </div>
      ) : (
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
          onStartRag={(task) => {
            const item = findItem(task.id);
            if (item) setActiveRag(item);
          }}
          onAddNewTask={onAddNewSubject}
          selectedDate={selectedDate}
        />
      )}

      {activeTimer && (
        <TaskFocusTimerModal
          task={activeTimer.task}
          isOpen={true}
          onClose={() => setActiveTimer(null)}
          onTaskCompleted={handleTimerCompleted}
        />
      )}

      {activeRag && (
        <RagKnowledgeModal
          task={activeRag.task}
          plan={activeRag.plan}
          isOpen={true}
          onClose={() => setActiveRag(null)}
        />
      )}
    </div>
  );
}
