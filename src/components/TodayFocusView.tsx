import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  HardDrive,
  ListChecks,
  Play,
  Settings2,
  Sun,
  X,
} from "lucide-react";
import confetti from "canvas-confetti";
import { AppTab, DaySchedulePreference, ExamStudyPlan, StudyTask } from "../types";
import { addDays, daysBetween, parseLocalDate, toLocalDateString } from "../lib/date";
import { useI18n } from "../lib/i18n";
import { playCompletionChime } from "../lib/audio";
import { DEFAULT_WEEK_SCHEDULE } from "../lib/storage";
import { STARQUIZ_URL } from "../lib/links";
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
type ShutdownAction = "keep" | "complete" | "skip" | "postpone";
type NotesEditor = { planId: string; taskId: string; value: string } | null;

const CATEGORY_COPY: Record<StudyTask["category"], { zh: string; en: string }> = {
  theory: { zh: "理论学习", en: "Theory" },
  reading: { zh: "资料精读", en: "Reading" },
  practice_problems: { zh: "专题演练", en: "Practice" },
  active_recall: { zh: "主动回忆", en: "Recall" },
  flashcards: { zh: "记忆卡", en: "Flashcards" },
  mock_exam: { zh: "模拟考试", en: "Mock exam" },
  review_weak_spots: { zh: "查漏补缺", en: "Weak spots" },
  summary_cheat_sheet: { zh: "考前速记", en: "Cheat sheet" },
};

function itemKey(item: DayItem) {
  return `${item.plan.id}:${item.task.id}`;
}

function statusRank(status: StudyTask["status"]) {
  if (status === "in_progress") return 0;
  if (status === "pending") return 1;
  if (status === "completed") return 2;
  return 3;
}

function formatHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function taskTimeLabel(task: StudyTask, isZh: boolean) {
  if (task.startTime && task.endTime) return `${task.startTime}–${task.endTime}`;
  return task.startTime || (isZh ? "待安排" : "Unscheduled");
}

function availableHoursForDate(plan: ExamStudyPlan, date: string) {
  const dateObj = parseLocalDate(date);
  if (Number.isNaN(dateObj.getTime())) return 0;
  const schedule = plan.preferences?.dailySchedules?.find(
    (day) => day.dayOfWeek === dateObj.getDay() && day.enabled
  );
  return schedule?.availableHours || 0;
}

function remainingHoursBeforeExam(plan: ExamStudyPlan, fromDate: string, examDate: string) {
  const days = daysBetween(fromDate, examDate);
  if (days <= 0) return 0;

  let total = 0;
  for (let index = 0; index < days; index += 1) {
    total += availableHoursForDate(plan, addDays(fromDate, index));
  }
  return Math.round(total * 10) / 10;
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
  const todayStr = toLocalDateString();
  const isToday = selectedDate === todayStr;

  const [activeTimer, setActiveTimer] = useState<DayItem | null>(null);
  const [activeRag, setActiveRag] = useState<DayItem | null>(null);
  const [notesEditor, setNotesEditor] = useState<NotesEditor>(null);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const [shutdownActions, setShutdownActions] = useState<Record<string, ShutdownAction>>({});
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [capacityPlanId, setCapacityPlanId] = useState("");
  const [capacityDraft, setCapacityDraft] = useState<DaySchedulePreference[] | null>(null);

  useEffect(() => {
    setNotesEditor(null);
  }, [selectedDate]);

  useEffect(() => {
    if (!shutdownOpen && !capacityOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShutdownOpen(false);
        setCapacityOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [shutdownOpen, capacityOpen]);

  const dayItems = useMemo(() => {
    const rows: DayItem[] = [];
    plans.forEach((plan) => {
      (plan.tasks || []).forEach((task) => {
        if (task.date === selectedDate) rows.push({ task, plan });
      });
    });
    return rows.sort((a, b) => {
      const rankDiff = statusRank(a.task.status) - statusRank(b.task.status);
      if (rankDiff !== 0) return rankDiff;
      return (a.task.startTime || "99:99").localeCompare(b.task.startTime || "99:99");
    });
  }, [plans, selectedDate]);

  const activeItems = useMemo(
    () => dayItems.filter((item) => item.task.status === "pending" || item.task.status === "in_progress"),
    [dayItems]
  );
  const finishedItems = useMemo(
    () => dayItems.filter((item) => item.task.status === "completed" || item.task.status === "skipped"),
    [dayItems]
  );
  const nextItem = activeItems[0] || null;
  const queueItems = activeItems.filter((item) => !nextItem || itemKey(item) !== itemKey(nextItem));
  const completedCount = dayItems.filter((item) => item.task.status === "completed").length;
  const skippedCount = dayItems.filter((item) => item.task.status === "skipped").length;

  const load = useMemo(() => {
    const counted = dayItems.filter((item) => item.task.status !== "skipped");
    const plannedMinutes = counted.reduce((sum, item) => sum + (item.task.durationMinutes || 0), 0);
    const maxAvailable = plans.reduce((max, plan) => {
      return Math.max(max, availableHoursForDate(plan, selectedDate));
    }, 0);
    const plannedHours = plannedMinutes / 60;
    const overload = maxAvailable > 0 && plannedHours > maxAvailable + 0.01;
    const leftover = maxAvailable - plannedHours;
    return {
      plannedHours,
      availableHours: maxAvailable,
      overload,
      leftover,
      percent: maxAvailable > 0 ? Math.min(100, Math.round((plannedHours / maxAvailable) * 100)) : plannedHours > 0 ? 100 : 0,
    };
  }, [dayItems, plans, selectedDate]);

  const exams = useMemo(() => {
    return plans
      .filter((plan) => !!plan.examDate)
      .map((plan) => {
        const days = daysBetween(todayStr, plan.examDate);
        return {
          plan,
          days,
          remainingHours: days >= 0 && days <= 7 ? remainingHoursBeforeExam(plan, todayStr, plan.examDate) : null,
        };
      })
      .filter((exam) => exam.days >= 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 4);
  }, [plans, todayStr]);

  const dateLabel = useMemo(() => {
    const date = parseLocalDate(selectedDate);
    if (Number.isNaN(date.getTime())) return selectedDate;
    return date.toLocaleDateString(isZh ? "zh-CN" : "en-US", {
      month: "long",
      day: "numeric",
      weekday: "long",
      ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" as const } : {}),
    });
  }, [selectedDate, isZh]);

  const applyTaskPatch = (item: DayItem, patch: Partial<StudyTask>) => {
    onUpdatePlan({
      ...item.plan,
      updatedAt: new Date().toISOString(),
      tasks: item.plan.tasks.map((task) => (task.id === item.task.id ? { ...task, ...patch } : task)),
    });
  };

  const toggleComplete = (item: DayItem) => {
    const willComplete = item.task.status !== "completed";
    applyTaskPatch(item, {
      status: willComplete ? "completed" : "pending",
      completedAt: willComplete ? new Date().toISOString() : undefined,
    });
    if (willComplete) {
      playCompletionChime();
      const remaining = activeItems.filter((active) => itemKey(active) !== itemKey(item)).length;
      if (remaining === 0) confetti({ particleCount: 55, spread: 65, origin: { y: 0.7 } });
    }
  };

  const handleTimerCompleted = (minutes: number, rating?: 1 | 2 | 3 | 4 | 5) => {
    if (!activeTimer) return;
    applyTaskPatch(activeTimer, {
      status: "completed",
      actualMinutesSpent: minutes,
      confidenceRating: rating || activeTimer.task.confidenceRating,
      completedAt: new Date().toISOString(),
    });
    playCompletionChime();
    if (activeItems.length <= 1) confetti({ particleCount: 70, spread: 70, origin: { y: 0.7 } });
    setActiveTimer(null);
  };

  const openNotes = (item: DayItem) => {
    if (notesEditor && notesEditor.planId === item.plan.id && notesEditor.taskId === item.task.id) {
      setNotesEditor(null);
      return;
    }
    setNotesEditor({
      planId: item.plan.id,
      taskId: item.task.id,
      value: item.task.notes || "",
    });
  };

  const saveNotes = () => {
    if (!notesEditor) return;
    const plan = plans.find((candidate) => candidate.id === notesEditor.planId);
    if (!plan) return;
    onUpdatePlan({
      ...plan,
      updatedAt: new Date().toISOString(),
      tasks: plan.tasks.map((task) =>
        task.id === notesEditor.taskId ? { ...task, notes: notesEditor.value.trim() || undefined } : task
      ),
    });
    setNotesEditor(null);
  };

  const openShutdown = () => {
    const initialActions: Record<string, ShutdownAction> = {};
    activeItems.forEach((item) => {
      initialActions[itemKey(item)] = "keep";
    });
    setShutdownActions(initialActions);
    setShutdownOpen(true);
  };

  const setShutdownAction = (item: DayItem, action: ShutdownAction) => {
    setShutdownActions((prev) => ({ ...prev, [itemKey(item)]: action }));
  };

  const postponeAll = () => {
    const nextActions: Record<string, ShutdownAction> = {};
    activeItems.forEach((item) => {
      nextActions[itemKey(item)] = "postpone";
    });
    setShutdownActions(nextActions);
  };

  const applyShutdown = () => {
    const changed = activeItems.filter((item) => (shutdownActions[itemKey(item)] || "keep") !== "keep");
    const plansToUpdate = new Map<string, ExamStudyPlan>();

    changed.forEach((item) => {
      let updatedPlan = plansToUpdate.get(item.plan.id);
      if (!updatedPlan) {
        updatedPlan = {
          ...item.plan,
          updatedAt: new Date().toISOString(),
          tasks: item.plan.tasks.map((task) => ({ ...task })),
        };
        plansToUpdate.set(item.plan.id, updatedPlan);
      }
      const target = updatedPlan.tasks.find((task) => task.id === item.task.id);
      if (!target) return;
      const action = shutdownActions[itemKey(item)];
      if (action === "complete") {
        target.status = "completed";
        target.completedAt = new Date().toISOString();
      } else if (action === "skip") {
        target.status = "skipped";
        target.completedAt = undefined;
      } else if (action === "postpone") {
        target.date = addDays(selectedDate, 1);
        target.status = "pending";
        target.completedAt = undefined;
      }
    });

    plansToUpdate.forEach((plan) => onUpdatePlan(plan));
    setShutdownOpen(false);

    if (changed.length > 0) {
      onNotice?.(
        isZh
          ? `已调整 ${changed.length} 项任务，计划已同步保存到本机。`
          : `${changed.length} task${changed.length === 1 ? "" : "s"} updated and saved locally.`
      );
      if (changed.some((item) => shutdownActions[itemKey(item)] === "complete")) {
        playCompletionChime();
      }
    }
  };

  const capacityPlan = useMemo(
    () => plans.find((plan) => plan.id === capacityPlanId) || null,
    [plans, capacityPlanId]
  );

  const capacityWeeklyTotal = useMemo(
    () => (capacityDraft || []).reduce((sum, day) => sum + (day.enabled ? day.availableHours : 0), 0),
    [capacityDraft]
  );

  const draftForPlan = (plan: ExamStudyPlan): DaySchedulePreference[] => {
    const source = plan.preferences?.dailySchedules?.length
      ? plan.preferences.dailySchedules
      : DEFAULT_WEEK_SCHEDULE;
    return source.map((day) => ({ ...day }));
  };

  const openCapacity = () => {
    if (plans.length === 0) return;
    const preferred = capacityPlan || exams[0]?.plan || plans[0];
    setCapacityPlanId(preferred.id);
    setCapacityDraft(draftForPlan(preferred));
    setCapacityOpen(true);
  };

  const selectCapacityPlan = (planId: string) => {
    const plan = plans.find((candidate) => candidate.id === planId);
    setCapacityPlanId(planId);
    setCapacityDraft(plan ? draftForPlan(plan) : null);
  };

  const toggleCapacityDay = (dayOfWeek: number) => {
    setCapacityDraft((prev) =>
      prev
        ? prev.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, enabled: !day.enabled } : day))
        : prev
    );
  };

  const updateCapacityHours = (dayOfWeek: number, rawValue: string) => {
    const parsed = rawValue === "" ? 0 : Number(rawValue);
    const hours = Number.isFinite(parsed)
      ? Math.max(0, Math.min(12, Math.round(parsed * 2) / 2))
      : 0;
    setCapacityDraft((prev) =>
      prev
        ? prev.map((day) =>
            day.dayOfWeek === dayOfWeek ? { ...day, availableHours: hours } : day
          )
        : prev
    );
  };

  const saveCapacity = () => {
    if (!capacityPlan || !capacityDraft) return;
    onUpdatePlan({
      ...capacityPlan,
      updatedAt: new Date().toISOString(),
      preferences: {
        ...capacityPlan.preferences,
        dailySchedules: capacityDraft.map((day) => ({ ...day })),
      },
    });
    setCapacityOpen(false);
    onNotice?.(
      isZh
        ? `已更新「${capacityPlan.examName}」的每周可用时间，今日负荷重新计算。`
        : `Weekly capacity updated for ${capacityPlan.examName}. Today's load recalculated.`
    );
  };

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayLabels = isZh
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const renderNotesEditor = (item: DayItem) => {
    if (!notesEditor || notesEditor.planId !== item.plan.id || notesEditor.taskId !== item.task.id) {
      return null;
    }
    return (
      <div className="mt-3 border border-[#111111] bg-[#FAF9F6] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666666]">
            {isZh ? "任务笔记 / NOTES" : "TASK NOTES"}
          </span>
          <button
            onClick={() => setNotesEditor(null)}
            className="p-1 text-[#666666] hover:text-[#111111] cursor-pointer"
            aria-label={isZh ? "关闭笔记" : "Close notes"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          autoFocus
          rows={3}
          value={notesEditor.value}
          onChange={(event) =>
            setNotesEditor((prev) => (prev ? { ...prev, value: event.target.value } : prev))
          }
          placeholder={isZh ? "记录卡点、易错点或下一步..." : "Capture blockers, traps, or the next step..."}
          aria-label={isZh ? "任务笔记" : "Task notes"}
          className="w-full bg-white border border-[#111111] p-2.5 text-[13px] leading-relaxed text-[#111111] placeholder-[#999999] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setNotesEditor(null)}
            className="px-3 py-1.5 border border-[#111111] bg-white text-[12px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
          >
            {isZh ? "取消" : "CANCEL"}
          </button>
          <button
            onClick={saveNotes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-[12px] font-semibold hover:bg-[#333333] cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            {isZh ? "保存笔记" : "SAVE"}
          </button>
        </div>
      </div>
    );
  };

  const renderCompactRow = (item: DayItem) => {
    const isCompleted = item.task.status === "completed";
    const isSkipped = item.task.status === "skipped";
    return (
      <div
        key={itemKey(item)}
        className={`px-4 py-3 flex items-start gap-3 ${isCompleted || isSkipped ? "bg-[#FAF9F6]" : "bg-white"} border-t border-[#e5e1d8] first:border-t-0`}
      >
        <button
          onClick={() => toggleComplete(item)}
          aria-label={
            isCompleted
              ? isZh
                ? "标记为未完成"
                : "Mark as incomplete"
              : isZh
                ? "标记完成"
                : "Mark complete"
          }
          className={`mt-0.5 w-6 h-6 shrink-0 border-2 border-[#111111] flex items-center justify-center transition-colors cursor-pointer ${
            isCompleted ? "bg-[#111111] text-white" : "bg-white text-transparent hover:text-[#999999]"
          }`}
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] font-bold text-[#666666]">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {taskTimeLabel(item.task, isZh)}
            </span>
            <span>·</span>
            <span>{item.task.durationMinutes}m</span>
            <span>·</span>
            <span className="truncate max-w-[65%]">{item.plan.examName}</span>
          </div>
          <h3
            className={`mt-1 text-[13px] sm:text-sm font-semibold leading-snug ${
              isCompleted ? "line-through text-[#777777]" : isSkipped ? "text-[#777777]" : "text-[#111111]"
            }`}
          >
            {item.task.title}
          </h3>
          {item.task.notes && (
            <p className="mt-1 text-[11px] text-[#777777] line-clamp-1">
              <FileText className="inline w-3 h-3 mr-1" />
              {item.task.notes}
            </p>
          )}
          {renderNotesEditor(item)}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => setActiveTimer(item)}
            className="p-2 min-w-9 min-h-9 border border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333] cursor-pointer"
            title={isZh ? "开始专注" : "Start focus timer"}
            aria-label={isZh ? "开始专注" : "Start focus timer"}
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={() => openNotes(item)}
            className={`p-2 min-w-9 min-h-9 border cursor-pointer ${
              item.task.notes
                ? "border-[#111111] bg-[#FCD33B] text-[#111111]"
                : "border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333]"
            }`}
            title={isZh ? "任务笔记" : "Task notes"}
            aria-label={isZh ? "任务笔记" : "Task notes"}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveRag(item)}
            className="p-2 min-w-9 min-h-9 border border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333] cursor-pointer"
            title={isZh ? "向资料提问" : "Ask materials"}
            aria-label={isZh ? "向资料提问" : "Ask materials"}
          >
            <BookOpen className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-6 animate-fadeIn text-[#111111]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-[#111111] pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#666666]">
              FOCUS // {isToday ? "TODAY" : "PLANNED DAY"}
            </span>
            <span className="inline-flex items-center gap-1 border border-[#111111] bg-white px-2 py-0.5 font-mono text-[10px] font-bold">
              <HardDrive className="w-3 h-3" />
              {isZh ? "本地保存" : "LOCAL"}
            </span>
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
            {isZh ? (isToday ? "今日" : "计划日") : isToday ? "Today" : "Planned day"}
          </h1>
          <p className="mt-1 text-[13px] sm:text-sm text-[#555555] leading-relaxed">
            {dateLabel} · {activeItems.length} {isZh ? "项待办" : "open tasks"} · {formatHours(load.plannedHours)}h{" "}
            {isZh ? "计划" : "planned"}
          </p>
        </div>

        <div className="flex items-center gap-1.5 font-mono">
          <button
            onClick={() => onSelectDate(addDays(selectedDate, -1))}
            className="p-2 min-w-9 min-h-9 border border-[#111111] bg-white hover:bg-[#f2f0ea] cursor-pointer"
            aria-label={isZh ? "前一天" : "Previous day"}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSelectDate(todayStr)}
            className={`px-3 min-h-9 text-xs font-bold border transition-colors cursor-pointer ${
              isToday
                ? "bg-[#111111] text-white border-[#111111]"
                : "bg-white text-[#111111] border-[#111111] hover:bg-[#f2f0ea]"
            }`}
          >
            {isZh ? "今天" : "Today"}
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(event) => event.target.value && onSelectDate(event.target.value)}
            aria-label={isZh ? "选择日期" : "Choose date"}
            className="px-2 min-h-9 text-xs bg-white border border-[#111111] text-[#111111] outline-none cursor-pointer font-bold"
          />
          <button
            onClick={() => onSelectDate(addDays(selectedDate, 1))}
            className="p-2 min-w-9 min-h-9 border border-[#111111] bg-white hover:bg-[#f2f0ea] cursor-pointer"
            aria-label={isZh ? "后一天" : "Next day"}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {exams.length > 0 && (
        <section className="border border-[#111111] bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[#111111]">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                {isZh ? "考试跑道 / EXAM RUNWAY" : "EXAM RUNWAY"}
              </h2>
            </div>
            <button
              onClick={onAddNewSubject}
              className="font-mono text-[10px] font-bold underline underline-offset-2 hover:text-[#555555] cursor-pointer"
            >
              {isZh ? "添加科目" : "ADD SUBJECT"}
            </button>
          </div>
          <div className="flex overflow-x-auto divide-x divide-[#e5e1d8]">
            {exams.map(({ plan, days, remainingHours }) => (
              <button
                key={plan.id}
                onClick={() => onNavigateToTab("course", plan.id)}
                className="min-w-[190px] flex-1 p-3.5 text-left hover:bg-[#FAF9F6] cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[13px] font-semibold leading-snug line-clamp-2">{plan.examName}</span>
                  <span
                    className={`shrink-0 border border-[#111111] px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                      days <= 7 ? "bg-[#FCD33B]" : "bg-white"
                    }`}
                  >
                    {days === 0
                      ? isZh
                        ? "今天"
                        : "TODAY"
                      : days === 1
                        ? isZh
                          ? "明天"
                          : "T-1"
                        : `D-${days}`}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-[#666666]">
                  {plan.examDate}
                  {plan.examTime ? ` · ${plan.examTime}` : ""}
                </div>
                {remainingHours !== null && (
                  <div className="mt-1 font-mono text-[10px] font-bold text-[#111111]">
                    {isZh ? `剩余可用 ${formatHours(remainingHours)}h` : `${formatHours(remainingHours)}h available`}
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
        <div className="space-y-4 min-w-0">
          {plans.length === 0 ? (
            <section className="border border-[#111111] bg-white p-6 sm:p-8 shadow-[4px_4px_0px_#111111] space-y-4">
              <div className="w-12 h-12 bg-[#FCD33B] border border-[#111111] flex items-center justify-center">
                <Sun className="w-6 h-6" />
              </div>
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#666666]">
                  START HERE
                </div>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {isZh ? "从第一门备考科目开始" : "Start with your first exam subject"}
                </h2>
                <p className="mt-2 text-[13px] sm:text-sm text-[#555555] leading-relaxed max-w-xl">
                  {isZh
                    ? "添加考试日期和课程资料，生成每天能执行的计划。所有数据只保存在当前浏览器，不需要账号。"
                    : "Add an exam date and course materials to generate a daily plan. Everything stays in this browser — no account required."}
                </p>
              </div>
              <button
                onClick={onAddNewSubject}
                className="inline-flex items-center gap-2 px-4 min-h-11 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                {isZh ? "新建备考科目" : "CREATE SUBJECT"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          ) : nextItem ? (
            <section className="border border-[#111111] bg-white shadow-[4px_4px_0px_#111111] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 bg-[#FCD33B] border-b border-[#111111]">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                  [ {isZh ? "下一项" : "UP NEXT"} ]
                </span>
                <button
                  onClick={() => onNavigateToTab("course", nextItem.plan.id)}
                  className="max-w-[60%] truncate font-mono text-[10px] font-bold underline underline-offset-2 hover:text-[#444444] cursor-pointer"
                  title={isZh ? "打开科目" : "Open subject"}
                >
                  {nextItem.plan.examName} ↗
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-bold text-[#666666]">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {taskTimeLabel(nextItem.task, isZh)}
                      </span>
                      <span className="border border-[#111111] bg-white px-1.5 py-0.5">
                        {CATEGORY_COPY[nextItem.task.category]?.[isZh ? "zh" : "en"] || nextItem.task.category}
                      </span>
                      <span>{nextItem.task.durationMinutes}m</span>
                    </div>
                    <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight leading-snug">
                      {nextItem.task.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => toggleComplete(nextItem)}
                    className="mt-0.5 p-2 min-w-10 min-h-10 shrink-0 border-2 border-[#111111] bg-white hover:bg-[#FAF9F6] cursor-pointer"
                    title={isZh ? "标记完成" : "Mark complete"}
                    aria-label={isZh ? "标记完成" : "Mark complete"}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>

                {nextItem.task.description && (
                  <p className="text-[13px] sm:text-sm text-[#444444] leading-relaxed">
                    {nextItem.task.description}
                  </p>
                )}

                {nextItem.task.keyObjectives?.length > 0 && (
                  <div className="space-y-1.5 border-l-2 border-[#111111] pl-3">
                    {nextItem.task.keyObjectives.slice(0, 3).map((objective, index) => (
                      <div key={index} className="flex items-start gap-2 text-[13px] leading-relaxed text-[#444444]">
                        <span className="w-1.5 h-1.5 bg-[#111111] mt-2 shrink-0" />
                        <span>{objective}</span>
                      </div>
                    ))}
                  </div>
                )}

                {nextItem.task.ragSource?.documentName && (
                  <div className="flex items-start gap-2 border border-[#e5e1d8] bg-[#FAF9F6] p-2.5 text-[12px] text-[#555555] leading-relaxed">
                    <BookOpen className="w-4 h-4 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">
                      {isZh ? "资料线索：" : "Material: "}
                      {nextItem.task.ragSource.documentName}
                      {nextItem.task.ragSource.pageOrChapter ? ` · ${nextItem.task.ragSource.pageOrChapter}` : ""}
                    </span>
                  </div>
                )}

                {renderNotesEditor(nextItem)}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => setActiveTimer(nextItem)}
                    className="inline-flex items-center gap-2 px-4 min-h-11 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
                  >
                    <Play className="w-4 h-4" />
                    {isZh ? "开始专注" : "START FOCUS"}
                  </button>
                  <button
                    onClick={() => openNotes(nextItem)}
                    aria-label={isZh ? "任务笔记" : "Task notes"}
                    className="inline-flex items-center gap-2 px-3 min-h-11 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#FAF9F6] cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    {isZh ? "任务笔记" : "NOTES"}
                  </button>
                  <button
                    onClick={() => setActiveRag(nextItem)}
                    aria-label={isZh ? "向资料提问" : "Ask your materials"}
                    className="inline-flex items-center gap-2 px-3 min-h-11 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#FAF9F6] cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    {isZh ? "向资料提问" : "ASK MATERIALS"}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <section className="border border-[#111111] bg-[#282828] text-white p-6 sm:p-8 shadow-[4px_4px_0px_#111111] space-y-3">
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FCD33B]">
                <CheckCircle2 className="w-4 h-4" />
                {isZh ? "收工 / CLEAR" : "QUEUE CLEAR"}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {isZh ? "今天的任务已处理完" : "Everything is handled for this day"}
              </h2>
              <p className="text-[13px] sm:text-sm text-[#D6D3CA] leading-relaxed">
                {isZh
                  ? `完成 ${completedCount} 项${skippedCount > 0 ? `，跳过 ${skippedCount} 项` : ""}。让队列保持清爽，明天再继续。`
                  : `${completedCount} completed${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}. Keep the queue clear for tomorrow.`}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => onNavigateToTab("master_calendar")}
                  className="inline-flex items-center gap-2 px-3 min-h-10 bg-[#FCD33B] text-[#111111] text-[13px] font-bold hover:bg-[#e9c331] cursor-pointer"
                >
                  <CalendarDays className="w-4 h-4" />
                  {isZh ? "查看全科日历" : "OPEN CALENDAR"}
                </button>
                <a
                  href={STARQUIZ_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 min-h-10 border border-white/40 text-white text-[13px] font-semibold hover:bg-white/10"
                >
                  <BookOpen className="w-4 h-4" />
                  {isZh ? "去 StarQuiz 刷题" : "PRACTICE IN STARQUIZ"}
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
                <button
                  onClick={() => onNavigateToTab("dashboard")}
                  className="inline-flex items-center gap-2 px-3 min-h-10 border border-white/40 text-white text-[13px] font-semibold hover:bg-white/10 cursor-pointer"
                >
                  {isZh ? "查看科目" : "VIEW SUBJECTS"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {queueItems.length > 0 && (
            <section className="border border-[#111111] bg-white">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#111111]">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4" />
                  <h2 className="text-[13px] font-bold">{isZh ? "今日队列" : "TODAY QUEUE"}</h2>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#666666]">
                  {queueItems.length} {isZh ? "项" : "LEFT"}
                </span>
              </div>
              {queueItems.map(renderCompactRow)}
            </section>
          )}

          {finishedItems.length > 0 && (
            <details className="border border-[#111111] bg-white group">
              <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#3F6B4F]" />
                  <span className="text-[13px] font-semibold">
                    {isZh ? "已完成 / 已跳过" : "COMPLETED / SKIPPED"}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-bold text-[#666666]">
                  {finishedItems.length} <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <div className="border-t border-[#e5e1d8]">
                {finishedItems.map(renderCompactRow)}
              </div>
            </details>
          )}

          {plans.length > 0 && activeItems.length === 0 && dayItems.length === 0 && (
            <section className="border border-dashed border-[#111111]/40 bg-[#FAF9F6] p-6 text-center space-y-3">
              <Sun className="w-7 h-7 mx-auto text-[#777777]" />
              <h2 className="text-lg font-bold">
                {isZh ? (isToday ? "今天没有安排任务" : "这一天没有安排任务") : "No tasks scheduled for this day"}
              </h2>
              <p className="text-[13px] text-[#666666] leading-relaxed">
                {isZh
                  ? "可以休息，或去科目里调整计划与节奏。"
                  : "Take a rest, or adjust the plan inside the subject."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  onClick={() => onNavigateToTab("dashboard")}
                  className="px-3 min-h-10 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
                >
                  {isZh ? "查看科目" : "VIEW SUBJECTS"}
                </button>
                {!isToday && (
                  <button
                    onClick={() => onSelectDate(todayStr)}
                    className="px-3 min-h-10 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
                  >
                    {isZh ? "回到今天" : "BACK TO TODAY"}
                  </button>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="border border-[#111111] bg-[#FCD33B] p-4 shadow-[3px_3px_0px_#111111] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                [ {isZh ? "今日负荷" : "TODAY LOAD"} ]
              </h2>
              <AlertTriangle className={`w-4 h-4 ${load.overload ? "text-[#B42318]" : "text-[#111111]"}`} />
            </div>
            <div className="flex items-end justify-between gap-2">
              <div className="text-3xl font-bold tracking-tight">
                {formatHours(load.plannedHours)}
                <span className="text-base font-semibold">h</span>
              </div>
              <div className="text-right text-[12px] font-semibold leading-snug">
                {load.availableHours > 0 ? (
                  <>
                    <div>{isZh ? `可用 ${formatHours(load.availableHours)}h` : `${formatHours(load.availableHours)}h available`}</div>
                    <div className="font-mono text-[10px] text-[#444444]">
                      {load.overload
                        ? isZh
                          ? `超出 ${formatHours(load.plannedHours - load.availableHours)}h`
                          : `${formatHours(load.plannedHours - load.availableHours)}h over`
                        : isZh
                          ? `余量 ${formatHours(Math.max(0, load.leftover))}h`
                          : `${formatHours(Math.max(0, load.leftover))}h left`}
                    </div>
                  </>
                ) : (
                  <span className="text-[12px]">{isZh ? "可用时长未设置" : "No capacity set"}</span>
                )}
              </div>
            </div>
            <div className="h-2.5 border border-[#111111] bg-white overflow-hidden" role="progressbar" aria-valuenow={load.percent} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full transition-all duration-500 ${load.overload ? "bg-[#B42318]" : "bg-[#111111]"}`}
                style={{ width: `${load.percent}%` }}
              />
            </div>
            <p className="text-[12px] leading-relaxed text-[#333333]">
              {load.availableHours > 0
                ? load.overload
                  ? isZh
                    ? "计划超出当日容量，建议在收尾时顺延或重排。"
                    : "The plan exceeds today's capacity. Postpone or rebalance during shutdown."
                  : isZh
                    ? "负荷在可用时间内，按队列推进即可。"
                    : "The load fits your available time. Work the queue."
                : isZh
                  ? "按科目设置每周可用时间后，才能计算每日负荷。"
                  : "Set weekly hours per subject to calculate the daily load."}
            </p>
            <button
              onClick={openCapacity}
              disabled={plans.length === 0}
              className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold underline underline-offset-2 hover:text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Settings2 className="w-3 h-3" />
              {isZh ? "调整可用时间" : "ADJUST CAPACITY"}
            </button>
          </section>

          {plans.length > 0 && (
            <section className="border border-[#111111] bg-white p-4 space-y-3">
              <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">
                [ {isZh ? "日终收尾" : "SHUTDOWN"} ]
              </h2>
              <p className="text-[13px] leading-relaxed text-[#555555]">
                {activeItems.length > 0
                  ? isZh
                    ? `${activeItems.length} 项未完成。完成、跳过或顺延，让明天从清晰的队列开始。`
                    : `${activeItems.length} open task${activeItems.length === 1 ? "" : "s"}. Complete, skip, or postpone to start tomorrow clean.`
                  : isZh
                    ? "今天的队列已经处理完。"
                    : "Today's queue is handled."}
              </p>
              <button
                onClick={openShutdown}
                disabled={activeItems.length === 0}
                className="inline-flex items-center gap-2 px-3.5 min-h-10 border border-[#111111] bg-white text-[13px] font-bold hover:bg-[#f2f0ea] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isZh ? "打开收尾" : "OPEN SHUTDOWN"}
              </button>
            </section>
          )}
        </aside>
      </div>

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

      {shutdownOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setShutdownOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden bg-white border border-[#111111] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#111111] bg-[#FAF9F6]">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#666666]">
                  [ {isZh ? "日终收尾" : "SHUTDOWN"} ]
                </div>
                <h2 className="mt-1 text-lg font-bold">{isZh ? "处理未完成任务" : "Handle open tasks"}</h2>
                <p className="mt-1 text-[12px] text-[#666666] leading-relaxed">
                  {isZh
                    ? "顺延会移动到次日并保持原时间。调整会立即保存到本机。"
                    : "Postpone moves a task to the next day and keeps its time. Changes save locally."}
                </p>
              </div>
              <button
                onClick={() => setShutdownOpen(false)}
                className="p-2 min-w-9 min-h-9 text-[#666666] hover:text-[#111111] hover:bg-[#e5e1d8] cursor-pointer"
                aria-label={isZh ? "关闭收尾" : "Close shutdown"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-[#e5e1d8]">
              <span className="font-mono text-[10px] font-bold text-[#666666]">
                {activeItems.length} {isZh ? "项未完成" : "OPEN"}
              </span>
              <button
                onClick={postponeAll}
                className="font-mono text-[10px] font-bold underline underline-offset-2 hover:text-[#555555] cursor-pointer"
              >
                {isZh ? "全部顺延到次日" : "POSTPONE ALL"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#e5e1d8]">
              {activeItems.map((item) => {
                const action = shutdownActions[itemKey(item)] || "keep";
                const options: Array<{ id: ShutdownAction; zh: string; en: string }> = [
                  { id: "keep", zh: "保持", en: "Keep" },
                  { id: "complete", zh: "完成", en: "Done" },
                  { id: "skip", zh: "跳过", en: "Skip" },
                  { id: "postpone", zh: "顺延", en: "Move" },
                ];
                return (
                  <div key={itemKey(item)} className="px-5 py-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] font-bold text-[#666666]">
                          {taskTimeLabel(item.task, isZh)} · {item.plan.examName}
                        </div>
                        <h3 className="mt-1 text-[13px] font-semibold leading-snug">{item.task.title}</h3>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] font-bold text-[#666666]">
                        {item.task.durationMinutes}m
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {options.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setShutdownAction(item, option.id)}
                          aria-pressed={action === option.id}
                          className={`px-2.5 min-h-8 border text-[12px] font-semibold transition-colors cursor-pointer ${
                            action === option.id
                              ? "bg-[#111111] text-white border-[#111111]"
                              : "bg-white text-[#333333] border-[#111111]/30 hover:border-[#111111]"
                          }`}
                        >
                          {isZh ? option.zh : option.en}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#111111] bg-[#FAF9F6]">
              <button
                onClick={() => setShutdownOpen(false)}
                className="px-3.5 min-h-10 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
              >
                {isZh ? "取消" : "CANCEL"}
              </button>
              <button
                onClick={applyShutdown}
                className="px-4 min-h-10 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
              >
                {isZh ? "应用调整" : "APPLY CHANGES"}
              </button>
            </div>
          </div>
        </div>
      )}

      {capacityOpen && capacityDraft && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setCapacityOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="capacity-dialog-title"
            className="w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden bg-white border border-[#111111] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#111111] bg-[#FAF9F6]">
              <div>
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#666666]">
                  [ {isZh ? "可用时间" : "CAPACITY"} ]
                </div>
                <h2 id="capacity-dialog-title" className="mt-1 text-lg font-bold">
                  {isZh ? "每周可用时间" : "Weekly available hours"}
                </h2>
                <p className="mt-1 text-[12px] text-[#666666] leading-relaxed">
                  {isZh
                    ? "每天大概能投入多少小时？用于计算今日负荷和考前剩余可用时间。"
                    : "How many hours can you realistically study each day? Used for load and exam runway estimates."}
                </p>
              </div>
              <button
                onClick={() => setCapacityOpen(false)}
                className="p-2 min-w-9 min-h-9 text-[#666666] hover:text-[#111111] hover:bg-[#e5e1d8] cursor-pointer"
                aria-label={isZh ? "关闭可用时间设置" : "Close capacity settings"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-3 border-b border-[#e5e1d8] bg-white space-y-1.5">
              <label
                htmlFor="capacity-plan-select"
                className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666666]"
              >
                {isZh ? "科目" : "SUBJECT"}
              </label>
              <select
                id="capacity-plan-select"
                value={capacityPlanId}
                onChange={(event) => selectCapacityPlan(event.target.value)}
                className="w-full min-h-10 border border-[#111111] bg-white px-2.5 text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] cursor-pointer"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.examName}
                    {plan.examDate ? ` · ${plan.examDate}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#e5e1d8]">
              {weekdayOrder.map((dayOfWeek) => {
                const day = capacityDraft.find((entry) => entry.dayOfWeek === dayOfWeek);
                if (!day) return null;
                return (
                  <div
                    key={dayOfWeek}
                    className="flex items-center justify-between gap-3 px-5 py-2.5"
                  >
                    <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={() => toggleCapacityDay(dayOfWeek)}
                        aria-label={
                          isZh
                            ? `${weekdayLabels[dayOfWeek]}安排学习`
                            : `Study on ${weekdayLabels[dayOfWeek]}`
                        }
                        className="w-4 h-4 accent-[#111111] cursor-pointer"
                      />
                      <span
                        className={`text-[13px] font-semibold ${
                          day.enabled ? "text-[#111111]" : "text-[#999999]"
                        }`}
                      >
                        {weekdayLabels[dayOfWeek]}
                      </span>
                      {!day.enabled && (
                        <span className="font-mono text-[10px] font-bold text-[#999999]">
                          {isZh ? "休息" : "REST"}
                        </span>
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={12}
                        step={0.5}
                        inputMode="decimal"
                        disabled={!day.enabled}
                        value={day.availableHours}
                        onChange={(event) => updateCapacityHours(dayOfWeek, event.target.value)}
                        aria-label={
                          isZh
                            ? `${weekdayLabels[dayOfWeek]}可用小时`
                            : `Hours available on ${weekdayLabels[dayOfWeek]}`
                        }
                        className="w-20 min-h-9 border border-[#111111] px-2 text-right font-mono text-[13px] font-bold text-[#111111] disabled:bg-[#F0EEE8] disabled:text-[#999999] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                      />
                      <span className="font-mono text-[11px] text-[#666666]">h</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-2.5 border-t border-[#e5e1d8] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[#666666]">
                {isZh ? "每周合计" : "WEEKLY TOTAL"}{" "}
                <strong className="text-[#111111]">{formatHours(capacityWeeklyTotal)}h</strong>
              </span>
              <span className="text-[11px] text-[#666666] leading-relaxed">
                {isZh ? "只影响负荷估算，不会移动已排任务。" : "Estimates only — existing tasks stay put."}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#111111] bg-white">
              <button
                onClick={() => setCapacityOpen(false)}
                className="px-3.5 min-h-10 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
              >
                {isZh ? "取消" : "CANCEL"}
              </button>
              <button
                onClick={saveCapacity}
                className="px-4 min-h-10 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
              >
                {isZh ? "保存可用时间" : "SAVE CAPACITY"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
