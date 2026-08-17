import React, { useState } from "react";
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  Calendar as CalendarIcon, 
  Play, 
  Sparkles, 
  Plus, 
  Trash2, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Flame, 
  MessageSquare, 
  Star,
  Layers,
  HelpCircle,
  Table as TableIcon,
  List as ListIcon,
  Check,
  Filter
} from "lucide-react";
import confetti from "canvas-confetti";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { playCompletionChime } from "../lib/audio";
import { generateGoogleCalendarUrl } from "../lib/calendarExport";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { QuizModal } from "./QuizModal";
import { useI18n } from "../lib/i18n";

interface DailyTodoListProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  searchQuery?: string;
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

export function DailyTodoList({
  plan,
  onUpdatePlan,
  selectedDate,
  onSelectDate,
  searchQuery = "",
}: DailyTodoListProps) {
  const { t, language } = useI18n();
  const [viewStyle, setViewStyle] = useState<"table" | "list">("table");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTimerTask, setActiveTimerTask] = useState<StudyTask | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<StudyTask | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [isAddingInline, setIsAddingInline] = useState(false);

  // New inline task state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("practice_problems");
  const [newTopic, setNewTopic] = useState(plan.topics[0]?.title || (language === "zh" ? "核心考点" : "General Topic"));
  const [newDuration, setNewDuration] = useState(45);
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

  // Get tasks for selected date
  const dayTasks = React.useMemo(() => {
    return (plan.tasks || []).filter((t) => t.date === selectedDate);
  }, [plan.tasks, selectedDate]);

  const filteredTasks = React.useMemo(() => {
    return dayTasks.filter((t) => {
      const matchCat = filterCategory === "all" || t.category === filterCategory;
      const matchSearch = !searchQuery || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.topicTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [dayTasks, filterCategory, searchQuery]);

  const completedCount = dayTasks.filter((t) => t.status === "completed").length;
  const totalPlannedMins = dayTasks.reduce((acc, t) => acc + t.durationMinutes, 0);
  const completedMins = dayTasks
    .filter((t) => t.status === "completed")
    .reduce((acc, t) => acc + (t.actualMinutesSpent || t.durationMinutes), 0);
  const completionPercent = dayTasks.length > 0 ? Math.round((completedCount / dayTasks.length) * 100) : 0;

  // Date navigation helpers
  const handleShiftDate = (days: number) => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const curr = new Date(y, m - 1, d);
    curr.setDate(curr.getDate() + days);
    const pad = (n: number) => n.toString().padStart(2, "0");
    onSelectDate(`${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`);
  };

  const handleJumpToToday = () => {
    const today = new Date().toISOString().split("T")[0];
    onSelectDate(today);
  };

  // Toggle completion
  const handleToggleComplete = (taskId: string) => {
    const nextTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        const isNowCompleted = t.status !== "completed";
        if (isNowCompleted) {
          playCompletionChime();
          if (completedCount + 1 === dayTasks.length) {
            confetti({
              particleCount: 60,
              spread: 60,
              origin: { y: 0.6 },
            });
          }
        }
        return {
          ...t,
          status: (isNowCompleted ? "completed" : "pending") as StudyTask["status"],
          completedAt: isNowCompleted ? new Date().toISOString() : undefined,
        };
      }
      return t;
    });

    onUpdatePlan({
      ...plan,
      updatedAt: new Date().toISOString(),
      tasks: nextTasks,
    });
  };

  // Update confidence rating
  const handleUpdateConfidence = (taskId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    const nextTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, confidenceRating: rating };
      }
      return t;
    });
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

  // Save notes
  const handleSaveNotes = (taskId: string, notes: string) => {
    const nextTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, notes };
      }
      return t;
    });
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

  // Delete task
  const handleDeleteTask = (taskId: string) => {
    const nextTasks = plan.tasks.filter((t) => t.id !== taskId);
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

  // Add custom task inline
  const handleCreateTask = () => {
    if (!newTitle.trim()) return;

    const newTask: StudyTask = {
      id: `task-${Date.now()}`,
      title: newTitle.trim(),
      description: language === "zh" ? `排定于 ${selectedDate} 的复习任务。` : `Study session scheduled for ${selectedDate}.`,
      category: newCategory,
      topicTitle: newTopic,
      date: selectedDate,
      startTime: "18:00",
      durationMinutes: newDuration,
      priority: newPriority,
      status: "pending",
      keyObjectives: language === "zh" ? ["阅读核心材料并梳理知识点提纲", "进行主动回忆与课后自我检测"] : ["Read core materials & formulate summary", "Active recall self-check"],
    };

    onUpdatePlan({
      ...plan,
      tasks: [...plan.tasks, newTask],
    });

    setNewTitle("");
    setIsAddingInline(false);
  };

  // Human friendly date format
  const formattedDate = React.useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [selectedDate, language]);

  const getCategoryLabel = (cat: TaskCategory) => {
    switch (cat) {
      case "theory": return t("catTheory");
      case "reading": return t("catReading");
      case "practice_problems": return t("catPracticeProblems");
      case "active_recall": return t("catActiveRecall");
      case "flashcards": return t("catFlashcards");
      case "mock_exam": return t("catMockExam");
      case "review_weak_spots": return t("catReviewWeakSpots");
      case "summary_cheat_sheet": return t("catSummaryCheatSheet");
      default: return cat;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Notion Database Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e9e9e7]">
        {/* Date Navigator */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 rounded hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
              title={t("previousDay")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleJumpToToday}
              className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-[#efefed] text-[#37352f] transition-colors border border-[#e9e9e7]"
            >
              {t("today")}
            </button>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 rounded hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
              title={t("nextDay")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-2">
            <h2 className="text-base font-bold text-[#37352f] flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-[#787774]" />
              <span>{formattedDate}</span>
            </h2>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="text-xs text-[#787774] hover:text-[#37352f] bg-transparent border-none focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* View Switcher & Category Filter & Progress */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Progress Mini Pill */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#f7f6f3] border border-[#e9e9e7] rounded-md text-xs text-[#5a5a57]">
            <span className="font-semibold text-[#37352f]">
              {t("tasksCountDone", { done: completedCount, total: dayTasks.length, percent: completionPercent })}
            </span>
            <span className="text-[#9b9a97]">•</span>
            <span className="text-[#2b78a0] font-medium">
              {t("timeLoggedSummary", { completed: completedMins, planned: totalPlannedMins })}
            </span>
          </div>

          {/* Filter dropdown */}
          <div className="flex items-center space-x-1 text-xs text-[#787774] bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1">
            <Filter className="w-3 h-3" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-xs text-[#37352f] focus:outline-none cursor-pointer"
            >
              <option value="all">{t("allCategories")}</option>
              <option value="practice_problems">{t("catPracticeProblems")}</option>
              <option value="theory">{t("catTheory")}</option>
              <option value="active_recall">{t("catActiveRecall")}</option>
              <option value="mock_exam">{t("catMockExam")}</option>
              <option value="review_weak_spots">{t("catReviewWeakSpots")}</option>
            </select>
          </div>

          {/* Table / List View Toggle */}
          <div className="flex items-center border border-[#e9e9e7] rounded-md bg-[#f7f6f3] p-0.5">
            <button
              onClick={() => setViewStyle("table")}
              className={`p-1 rounded text-xs flex items-center space-x-1 transition-colors ${
                viewStyle === "table" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774] hover:text-[#37352f]"
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewStyle("list")}
              className={`p-1 rounded text-xs flex items-center space-x-1 transition-colors ${
                viewStyle === "list" ? "bg-white text-[#37352f] shadow-xs" : "text-[#787774] hover:text-[#37352f]"
              }`}
              title="List View"
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* + New Button */}
          <button
            onClick={() => setIsAddingInline(true)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#37352f] hover:bg-[#201f1c] text-white rounded-md text-xs font-semibold transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("btnNewTask")}</span>
          </button>
        </div>
      </div>

      {/* Notion Callout Box if no tasks or general daily guidance */}
      {filteredTasks.length === 0 ? (
        <div className="notion-callout p-6 text-center space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-[#787774]" />
          <h3 className="font-semibold text-sm text-[#37352f]">
            {t("noTasksToday", { date: formattedDate })}
          </h3>
          <p className="text-xs text-[#787774] max-w-md mx-auto">
            {t("noTasksTodayDesc")}
          </p>
          <button
            onClick={() => setIsAddingInline(true)}
            className="mt-2 px-3 py-1.5 bg-[#efefed] hover:bg-[#e3e2e0] text-[#37352f] rounded-md text-xs font-medium transition-colors"
          >
            {t("btnAddTaskThisDate")}
          </button>
        </div>
      ) : viewStyle === "table" ? (
        /* ================= Notion Database Table View ================= */
        <div className="border border-[#e9e9e7] rounded-lg overflow-x-auto shadow-xs bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f7f6f3] border-b border-[#e9e9e7] text-[#787774] font-medium select-none">
                <th className="py-2.5 px-3 w-10 text-center font-normal">{t("colDone")}</th>
                <th className="py-2.5 px-3 min-w-[240px]">{t("colTaskName")}</th>
                <th className="py-2.5 px-3 w-36">{t("colCategory")}</th>
                <th className="py-2.5 px-3 w-40">{t("colTopic")}</th>
                <th className="py-2.5 px-3 w-24">{t("colDuration")}</th>
                <th className="py-2.5 px-3 w-28">{t("colPriority")}</th>
                <th className="py-2.5 px-3 w-28">{t("colMastery")}</th>
                <th className="py-2.5 px-3 w-44 text-right pr-4">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e9e7]">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === "completed";
                const catClass = CATEGORY_TAG_CLASS[task.category] || "notion-tag-gray";

                return (
                  <React.Fragment key={task.id}>
                    <tr
                      className={`hover:bg-[#f7f6f3]/80 transition-colors group ${
                        isCompleted ? "bg-[#fbfbfa] text-[#9b9a97]" : "text-[#37352f]"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleToggleComplete(task.id)}
                          className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                            isCompleted
                              ? "bg-[#448361] border-[#448361] text-white"
                              : "border-[#dfdfde] hover:border-[#37352f] bg-white"
                          }`}
                        >
                          {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      </td>

                      {/* Title & Description */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-start space-x-2">
                          <div className="flex-1 min-w-0">
                            <span
                              className={`font-medium block truncate ${
                                isCompleted ? "line-through text-[#9b9a97]" : "text-[#37352f]"
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="text-[11px] text-[#787774] block truncate mt-0.5">
                                {task.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Tag */}
                      <td className="py-2 px-3">
                        <span className={`${catClass} px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap`}>
                          {getCategoryLabel(task.category)}
                        </span>
                      </td>

                      {/* Topic */}
                      <td className="py-2 px-3">
                        <span className="text-[#5a5a57] text-[11px] truncate block max-w-[150px]">
                          {task.topicTitle}
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-2 px-3 text-[#787774]">
                        <span className="flex items-center space-x-1 font-mono text-[11px]">
                          <Clock className="w-3 h-3 text-[#9b9a97]" />
                          <span>{task.durationMinutes}m</span>
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-2 px-3">
                        {task.priority === "high" ? (
                          <span className="notion-tag-red px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            {t("priorityHigh")}
                          </span>
                        ) : task.priority === "low" ? (
                          <span className="notion-tag-gray px-1.5 py-0.5 rounded text-[10px]">
                            {t("priorityLow")}
                          </span>
                        ) : (
                          <span className="notion-tag-yellow px-1.5 py-0.5 rounded text-[10px]">
                            {t("priorityMedium")}
                          </span>
                        )}
                      </td>

                      {/* Mastery Rating */}
                      <td className="py-2 px-3">
                        <div className="flex space-x-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleUpdateConfidence(task.id, star as any)}
                              className={`p-0.5 transition-colors ${
                                (task.confidenceRating || 0) >= star
                                  ? "text-[#cb912f]"
                                  : "text-[#dfdfde] hover:text-[#9b9a97]"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Action Tools */}
                      <td className="py-2 px-3 text-right pr-4">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Focus Session */}
                          <button
                            onClick={() => setActiveTimerTask(task)}
                            className="p-1 rounded hover:bg-[#efefed] text-[#2b78a0] transition-colors"
                            title={t("startFocusTimer")}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>

                          {/* Active Recall Quiz */}
                          <button
                            onClick={() => setActiveQuizTask(task)}
                            className="p-1 rounded hover:bg-[#efefed] text-[#9065b0] transition-colors"
                            title={t("generateQuiz")}
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {/* Notes */}
                          <button
                            onClick={() => setExpandedNotesId(expandedNotesId === task.id ? null : task.id)}
                            className={`p-1 rounded transition-colors ${
                              task.notes
                                ? "text-[#d9730d] bg-[#faece3]"
                                : "text-[#787774] hover:bg-[#efefed]"
                            }`}
                            title={t("viewNotes")}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          {/* Google Calendar Link */}
                          <a
                            href={generateGoogleCalendarUrl(task, plan)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-[#787774] hover:text-[#2b78a0] hover:bg-[#efefed] transition-colors"
                            title={t("addToGCal")}
                          >
                            <CalendarIcon className="w-3.5 h-3.5" />
                          </a>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 rounded text-[#787774] hover:text-[#d44c47] hover:bg-[#fdebec] transition-colors opacity-60 group-hover:opacity-100"
                            title={t("delete")}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Inline Notes Expanded Row */}
                    {expandedNotesId === task.id && (
                      <tr className="bg-[#fbfbfa]">
                        <td colSpan={8} className="px-6 py-3 border-t border-b border-[#e9e9e7]">
                          <div className="space-y-1.5 max-w-3xl">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#787774]">
                              {t("notesSectionTitle", { title: task.title })}
                            </span>
                            <textarea
                              rows={2}
                              value={task.notes || ""}
                              onChange={(e) => handleSaveNotes(task.id, e.target.value)}
                              placeholder={t("notesPlaceholder")}
                              className="w-full bg-white border border-[#e9e9e7] rounded-md p-2 text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0]"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Inline Add Row */}
              {isAddingInline ? (
                <tr className="bg-[#f7f6f3]">
                  <td className="py-2 px-3 text-center text-[#9b9a97]">+</td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={t("inlineTaskTitlePlaceholder")}
                      className="w-full bg-white border border-[#e9e9e7] rounded px-2 py-1 text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
                      autoFocus
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="bg-white border border-[#e9e9e7] rounded px-1.5 py-1 text-xs text-[#37352f] focus:outline-none"
                    >
                      <option value="practice_problems">{t("catPracticeProblems")}</option>
                      <option value="theory">{t("catTheory")}</option>
                      <option value="active_recall">{t("catActiveRecall")}</option>
                      <option value="mock_exam">{t("catMockExam")}</option>
                      <option value="review_weak_spots">{t("catReviewWeakSpots")}</option>
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="bg-white border border-[#e9e9e7] rounded px-1.5 py-1 text-xs text-[#37352f] focus:outline-none max-w-[130px]"
                    >
                      {plan.topics.map((t) => (
                        <option key={t.id} value={t.title}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={10}
                      max={240}
                      step={5}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="w-16 bg-white border border-[#e9e9e7] rounded px-1.5 py-1 text-xs text-[#37352f]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="bg-white border border-[#e9e9e7] rounded px-1.5 py-1 text-xs text-[#37352f]"
                    >
                      <option value="high">{t("priorityHigh")}</option>
                      <option value="medium">{t("priorityMedium")}</option>
                      <option value="low">{t("priorityLow")}</option>
                    </select>
                  </td>
                  <td colSpan={2} className="py-2 px-3 text-right pr-4">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setIsAddingInline(false)}
                        className="px-2 py-1 text-xs text-[#787774] hover:text-[#37352f]"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        onClick={handleCreateTask}
                        disabled={!newTitle.trim()}
                        className="px-3 py-1 bg-[#37352f] hover:bg-[#201f1c] disabled:opacity-50 text-white rounded text-xs font-semibold"
                      >
                        {t("btnAddInlineTask")}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} className="py-2 px-4">
                    <button
                      onClick={() => setIsAddingInline(true)}
                      className="flex items-center space-x-1.5 text-xs text-[#787774] hover:text-[#37352f] transition-colors py-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t("btnNewTask")}</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ================= Notion Database List View ================= */
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const catClass = CATEGORY_TAG_CLASS[task.category] || "notion-tag-gray";

            return (
              <div
                key={task.id}
                className={`p-3.5 border rounded-lg bg-white transition-all shadow-2xs hover:border-[#dfdfde] flex items-start justify-between gap-3 ${
                  isCompleted ? "border-[#e9e9e7] bg-[#fbfbfa]" : "border-[#e9e9e7]"
                }`}
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(task.id)}
                    className={`mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center transition-colors ${
                      isCompleted
                        ? "bg-[#448361] border-[#448361] text-white"
                        : "border-[#dfdfde] hover:border-[#37352f] bg-white"
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${catClass} px-2 py-0.5 rounded text-[10px] font-medium`}>
                        {getCategoryLabel(task.category)}
                      </span>
                      <span className="text-[11px] text-[#787774]">• {task.topicTitle}</span>
                      {task.priority === "high" && (
                        <span className="notion-tag-red px-1.5 py-0.2 rounded text-[10px] font-semibold">
                          {t("priorityHigh")}
                        </span>
                      )}
                    </div>

                    <h4
                      className={`text-sm font-semibold ${
                        isCompleted ? "line-through text-[#9b9a97]" : "text-[#37352f]"
                      }`}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-[#787774] leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {task.activeRecallPrompt && (
                      <div className="notion-callout p-2.5 text-xs text-[#37352f] flex items-start space-x-2 mt-2">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold text-[11px] block">{t("activeRecallPromptTitle")}</strong>
                          <span className="text-[11px] text-[#5a5a57]">{task.activeRecallPrompt}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2 shrink-0">
                  <span className="text-xs text-[#787774] font-mono">{task.durationMinutes} {language === "zh" ? "分钟" : "mins"}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setActiveTimerTask(task)}
                      className="px-2.5 py-1 bg-[#f7f6f3] hover:bg-[#efefed] border border-[#e9e9e7] rounded text-xs font-semibold text-[#2b78a0] flex items-center space-x-1"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{t("focusSessionBtn")}</span>
                    </button>

                    <button
                      onClick={() => setActiveQuizTask(task)}
                      className="p-1 rounded text-[#9065b0] hover:bg-[#f4f0f7] border border-[#e4daf0]"
                      title={t("generateQuiz")}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Focus Timer Modal */}
      {activeTimerTask && (
        <TaskFocusTimerModal
          task={activeTimerTask}
          isOpen={!!activeTimerTask}
          onClose={() => setActiveTimerTask(null)}
          onTaskCompleted={(mins, rating) => {
            const nextTasks = plan.tasks.map((t) => {
              if (t.id === activeTimerTask.id) {
                return {
                  ...t,
                  status: "completed" as const,
                  actualMinutesSpent: mins,
                  confidenceRating: rating || t.confidenceRating,
                  completedAt: new Date().toISOString(),
                };
              }
              return t;
            });
            onUpdatePlan({ ...plan, tasks: nextTasks });
          }}
        />
      )}

      {/* Active Recall Quiz Modal */}
      {activeQuizTask && (
        <QuizModal
          task={activeQuizTask}
          isOpen={!!activeQuizTask}
          onClose={() => setActiveQuizTask(null)}
          onMasteryUpdated={(rating) => {
            handleUpdateConfidence(activeQuizTask.id, rating);
          }}
        />
      )}
    </div>
  );
}
