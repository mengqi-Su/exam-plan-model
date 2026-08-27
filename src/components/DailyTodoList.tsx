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
  Filter,
  Zap,
  FileText
} from "lucide-react";
import confetti from "canvas-confetti";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { playCompletionChime } from "../lib/audio";
import { generateGoogleCalendarUrl } from "../lib/calendarExport";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { QuizModal } from "./QuizModal";
import { RagKnowledgeModal } from "./RagKnowledgeModal";
import { useI18n } from "../lib/i18n";
import { getPaletteByString } from "../lib/themePalettes";

interface DailyTodoListProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  searchQuery?: string;
}

const CATEGORY_TAG_CLASS: Record<TaskCategory, string> = {
  theory: "border border-[#111111] bg-[#FCD33B] text-[#111111] font-bold",
  summary_cheat_sheet: "border border-[#111111] bg-[#FCD33B] text-[#111111] font-bold",
  reading: "border border-[#111111] bg-[#D8D8D8] text-[#111111] font-bold",
  flashcards: "border border-[#111111] bg-[#D8D8D8] text-[#111111] font-bold",
  active_recall: "border border-[#111111] bg-[#B5B5B5] text-[#111111] font-bold",
  review_weak_spots: "border border-[#111111] bg-[#B5B5B5] text-[#111111] font-bold",
  practice_problems: "border border-[#111111] bg-[#282828] text-white font-bold",
  mock_exam: "border border-[#111111] bg-[#111111] text-white font-bold",
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
  const [activeRagTask, setActiveRagTask] = useState<StudyTask | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [isAddingInline, setIsAddingInline] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("practice_problems");
  const [newTopic, setNewTopic] = useState(plan.topics[0]?.title || (language === "zh" ? "核心考点" : "General Topic"));
  const [newDuration, setNewDuration] = useState(45);
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");

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

  const handleUpdateConfidence = (taskId: string, rating: 1 | 2 | 3 | 4 | 5) => {
    const nextTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, confidenceRating: rating };
      }
      return t;
    });
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

  const handleSaveNotes = (taskId: string, notes: string) => {
    const nextTasks = plan.tasks.map((t) => {
      if (t.id === taskId) {
        return { ...t, notes };
      }
      return t;
    });
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

  const handleDeleteTask = (taskId: string) => {
    const nextTasks = plan.tasks.filter((t) => t.id !== taskId);
    onUpdatePlan({ ...plan, tasks: nextTasks });
  };

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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#111111]">

        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1.5 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
              title={t("previousDay")}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleJumpToToday}
              className="px-2.5 py-1 text-xs font-mono font-bold hover:bg-[#111111] hover:text-white text-[#111111] transition-colors border border-[#111111] cursor-pointer"
            >
              [{language === "zh" ? "今日" : "TODAY"}]
            </button>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer"
              title={t("nextDay")}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate(e.target.value)}
              className="text-xs font-mono text-[#111111] bg-white border border-[#111111] px-2 py-1 focus:outline-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-[#111111] text-xs font-mono text-[#111111]">
            <span
              className="w-2.5 h-2.5 border border-[#111111] shrink-0"
              style={{ backgroundColor: getPaletteByString(plan.id || plan.examName).accentColor }}
            />
            <span className="font-bold">
              {completedCount}/{dayTasks.length} {language === "zh" ? "已完成" : "DONE"} ({completionPercent}%)
            </span>
            <span className="text-[#888888]">•</span>
            <span className="font-mono">
              {completedMins}{language === "zh" ? "分钟" : "m"} / {totalPlannedMins}{language === "zh" ? "分钟" : "m"}
            </span>
          </div>

          <div className="flex items-center space-x-1 text-xs font-mono text-[#111111] bg-white border border-[#111111] px-2 py-1">
            <Filter className="w-3 h-3" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent text-xs font-mono text-[#111111] focus:outline-none cursor-pointer"
            >
              <option value="all">{t("allCategories")}</option>
              <option value="practice_problems">{t("catPracticeProblems")}</option>
              <option value="theory">{t("catTheory")}</option>
              <option value="active_recall">{t("catActiveRecall")}</option>
              <option value="mock_exam">{t("catMockExam")}</option>
              <option value="review_weak_spots">{t("catReviewWeakSpots")}</option>
            </select>
          </div>

          <div className="flex items-center border border-[#111111] bg-white p-0.5">
            <button
              onClick={() => setViewStyle("table")}
              className={`p-1 text-xs flex items-center space-x-1 transition-colors cursor-pointer ${
                viewStyle === "table" ? "bg-[#111111] text-white" : "text-[#666666] hover:text-[#111111]"
              }`}
              title={language === "zh" ? "表格视图" : "Table View"}
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewStyle("list")}
              className={`p-1 text-xs flex items-center space-x-1 transition-colors cursor-pointer ${
                viewStyle === "list" ? "bg-[#111111] text-white" : "text-[#666666] hover:text-[#111111]"
              }`}
              title={language === "zh" ? "列表视图" : "List View"}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsAddingInline(true)}
            className="flex items-center space-x-1 px-3 py-1 bg-[#111111] hover:bg-[#333333] text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>[{language === "zh" ? "+ 新建任务" : "+ TASK"}]</span>
          </button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center space-y-2 border border-dashed border-[#111111]/40 bg-[#fafafa]">
          <BookOpen className="w-7 h-7 mx-auto text-[#888888]" />
          <h3 className="font-mono font-bold text-sm text-[#111111]">
            {t("noTasksToday", { date: formattedDate })}
          </h3>
          <p className="text-xs font-mono text-[#666666] max-w-md mx-auto">
            {t("noTasksTodayDesc")}
          </p>
          <button
            onClick={() => setIsAddingInline(true)}
            className="mt-2 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            [{language === "zh" ? "+ 为此日期添加任务" : "+ ADD TASK FOR THIS DATE"}]
          </button>
        </div>
      ) : viewStyle === "table" ? (

        <div className="border border-[#111111] overflow-x-auto bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#fafafa] border-b border-[#111111] text-[#111111] font-mono font-bold uppercase text-[10px] tracking-wider select-none">
                <th className="py-2.5 px-3 w-10 text-center">{t("colDone")}</th>
                <th className="py-2.5 px-3 min-w-[240px]">{t("colTaskName")}</th>
                <th className="py-2.5 px-3 w-36">{t("colCategory")}</th>
                <th className="py-2.5 px-3 w-40">{t("colTopic")}</th>
                <th className="py-2.5 px-3 w-24">{t("colDuration")}</th>
                <th className="py-2.5 px-3 w-28">{t("colPriority")}</th>
                <th className="py-2.5 px-3 w-28">{t("colMastery")}</th>
                <th className="py-2.5 px-3 w-44 text-right pr-4">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e5e5]">
              {filteredTasks.map((task) => {
                const isCompleted = task.status === "completed";
                const catClass = CATEGORY_TAG_CLASS[task.category] || "border border-[#111111] bg-white text-[#111111]";

                return (
                  <React.Fragment key={task.id}>
                    <tr
                      className={`hover:bg-[#f2f2f2] transition-colors group font-mono ${
                        isCompleted ? "bg-[#fafafa] text-[#888888]" : "text-[#111111]"
                      }`}
                    >

                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleToggleComplete(task.id)}
                          className={`w-4 h-4 border border-[#111111] flex items-center justify-center transition-colors cursor-pointer ${
                            isCompleted
                              ? "bg-[#111111] text-white"
                              : "bg-white hover:bg-[#ededed]"
                          }`}
                        >
                          {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                        </button>
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex items-start space-x-2">
                          <div className="flex-1 min-w-0">
                            <span
                              className={`font-bold block truncate text-xs ${
                                isCompleted ? "line-through text-[#888888]" : "text-[#111111]"
                              }`}
                            >
                              {task.title}
                            </span>
                            {task.description && (
                              <span className="text-[10px] text-[#666666] block truncate mt-0.5">
                                {task.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className={`${catClass} px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap`}>
                          [{getCategoryLabel(task.category)}]
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="text-[#666666] text-[11px] truncate block max-w-[150px] font-mono">
                          {task.topicTitle}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-[#111111]">
                        <span className="flex items-center space-x-1 font-mono text-[11px] font-bold">
                          <Clock className="w-3 h-3 text-[#666666]" />
                          <span>{task.durationMinutes}m</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3">
                        {task.priority === "high" ? (
                          <span className="border border-[#111111] bg-[#FCD33B] text-[#111111] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            [{language === "zh" ? "高优" : "HIGH"}]
                          </span>
                        ) : task.priority === "low" ? (
                          <span className="border border-[#111111] bg-[#B5B5B5] text-[#111111] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            [{language === "zh" ? "低优" : "LOW"}]
                          </span>
                        ) : (
                          <span className="border border-[#111111] text-[#111111] bg-[#D8D8D8] px-1.5 py-0.5 text-[10px] font-bold uppercase">
                            [{language === "zh" ? "中优" : "MED"}]
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <div className="flex space-x-0.5 text-xs">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleUpdateConfidence(task.id, star as any)}
                              className={`p-0.5 transition-colors cursor-pointer ${
                                (task.confidenceRating || 0) >= star
                                  ? "text-[#111111] font-bold"
                                  : "text-[#cccccc] hover:text-[#111111]"
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right pr-4 font-mono">
                        <div className="flex items-center justify-end space-x-1">

                          <button
                            onClick={() => setActiveRagTask(task)}
                            className="p-1 hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] transition-colors cursor-pointer"
                            title={language === "zh" ? "RAG 资料溯源与问答" : "RAG Material Grounding & QA"}
                          >
                            <Zap className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => setActiveTimerTask(task)}
                            className="p-1 hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] transition-colors cursor-pointer"
                            title={t("startFocusTimer")}
                          >
                            <Play className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => setActiveQuizTask(task)}
                            className="p-1 hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] transition-colors cursor-pointer"
                            title={t("generateQuiz")}
                          >
                            <Sparkles className="w-3 h-3" />
                          </button>

                          <button
                            onClick={() => setExpandedNotesId(expandedNotesId === task.id ? null : task.id)}
                            className={`p-1 border border-[#111111] transition-colors cursor-pointer ${
                              task.notes
                                ? "bg-[#111111] text-white"
                                : "text-[#111111] hover:bg-[#111111] hover:text-white"
                            }`}
                            title={t("viewNotes")}
                          >
                            <MessageSquare className="w-3 h-3" />
                          </button>

                          <a
                            href={generateGoogleCalendarUrl(task, plan)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                            title={t("addToGCal")}
                          >
                            <CalendarIcon className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors opacity-60 group-hover:opacity-100 cursor-pointer"
                            title={t("delete")}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedNotesId === task.id && (
                      <tr className="bg-[#fafafa]">
                        <td colSpan={8} className="px-6 py-3 border-t border-b border-[#111111]">
                          <div className="space-y-1.5 max-w-3xl font-mono">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                              [{t("notesSectionTitle", { title: task.title })}]
                            </span>
                            <textarea
                              rows={2}
                              value={task.notes || ""}
                              onChange={(e) => handleSaveNotes(task.id, e.target.value)}
                              placeholder={t("notesPlaceholder")}
                              className="w-full bg-white border border-[#111111] p-2 text-xs text-[#111111] placeholder-[#888888] focus:outline-none font-mono"
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {isAddingInline ? (
                <tr className="bg-[#fafafa] font-mono">
                  <td className="py-2 px-3 text-center text-[#111111] font-bold">+</td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder={t("inlineTaskTitlePlaceholder")}
                      className="w-full bg-white border border-[#111111] px-2 py-1 text-xs text-[#111111] focus:outline-none font-mono"
                      autoFocus
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="bg-white border border-[#111111] px-1.5 py-1 text-xs text-[#111111] focus:outline-none font-mono font-bold"
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
                      className="bg-white border border-[#111111] px-1.5 py-1 text-xs text-[#111111] focus:outline-none max-w-[130px] font-mono font-bold"
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
                      className="w-16 bg-white border border-[#111111] px-1.5 py-1 text-xs text-[#111111] font-mono font-bold"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                      className="bg-white border border-[#111111] px-1.5 py-1 text-xs text-[#111111] font-mono font-bold"
                    >
                      <option value="high">{t("priorityHigh")}</option>
                      <option value="medium">{t("priorityMedium")}</option>
                      <option value="low">{t("priorityLow")}</option>
                    </select>
                  </td>
                  <td colSpan={2} className="py-2 px-3 text-right pr-4">
                    <div className="flex items-center justify-end space-x-2 font-mono">
                      <button
                        onClick={() => setIsAddingInline(false)}
                        className="px-2 py-1 text-xs text-[#666666] hover:text-[#111111] cursor-pointer"
                      >
                        [{t("cancel")}]
                      </button>
                      <button
                        onClick={handleCreateTask}
                        disabled={!newTitle.trim()}
                        className="px-3 py-1 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-bold font-mono cursor-pointer border border-[#111111]"
                      >
                        [{t("btnAddInlineTask")}]
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} className="py-2 px-4 font-mono">
                    <button
                      onClick={() => setIsAddingInline(true)}
                      className="flex items-center space-x-1.5 text-xs text-[#666666] hover:text-[#111111] transition-colors py-1 cursor-pointer font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>[{t("btnNewTask")}]</span>
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (

        <div className="space-y-2 font-mono">
          {filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const catClass = CATEGORY_TAG_CLASS[task.category] || "border border-[#111111] bg-white text-[#111111]";

            return (
              <div
                key={task.id}
                className={`p-3.5 border border-[#111111] bg-white transition-all flex items-start justify-between gap-3 ${
                  isCompleted ? "bg-[#fafafa] text-[#888888]" : "text-[#111111]"
                }`}
              >
                <div className="flex items-start space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => handleToggleComplete(task.id)}
                    className={`mt-0.5 w-4 h-4 border border-[#111111] flex items-center justify-center transition-colors cursor-pointer ${
                      isCompleted
                        ? "bg-[#111111] text-white"
                        : "bg-white hover:bg-[#ededed]"
                    }`}
                  >
                    {isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${catClass} px-1.5 py-0.2 text-[10px] font-bold uppercase`}>
                        [{getCategoryLabel(task.category)}]
                      </span>
                      <span className="text-[11px] text-[#666666] font-mono">• {task.topicTitle}</span>
                      {task.priority === "high" && (
                        <span className="border border-[#111111] bg-[#FCD33B] text-[#111111] px-1.5 py-0.2 text-[10px] font-bold">
                          [{language === "zh" ? "高优" : "HIGH"}]
                        </span>
                      )}
                      {task.priority === "medium" && (
                        <span className="border border-[#111111] bg-[#D8D8D8] text-[#111111] px-1.5 py-0.2 text-[10px] font-bold">
                          [{language === "zh" ? "中优" : "MED"}]
                        </span>
                      )}
                      {task.priority === "low" && (
                        <span className="border border-[#111111] bg-[#B5B5B5] text-[#111111] px-1.5 py-0.2 text-[10px] font-bold">
                          [{language === "zh" ? "低优" : "LOW"}]
                        </span>
                      )}
                    </div>

                    <h4
                      className={`text-xs font-bold ${
                        isCompleted ? "line-through text-[#888888]" : "text-[#111111]"
                      }`}
                    >
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-[#666666] leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {task.activeRecallPrompt && (
                      <div className="p-2.5 bg-[#fafafa] border border-[#111111] text-xs text-[#111111] flex items-start space-x-2 mt-2">
                        <Sparkles className="w-4 h-4 text-[#111111] shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold text-[10px] uppercase block">[{t("activeRecallPromptTitle")}]</strong>
                          <span className="text-[11px] text-[#333333]">{task.activeRecallPrompt}</span>
                        </div>
                      </div>
                    )}

                    {task.ragSource && (
                      <div className="flex items-center space-x-1.5 text-[10px] text-[#111111] bg-[#fafafa] px-2 py-1 border border-[#111111] mt-1.5 w-fit font-mono">
                        <FileText className="w-3 h-3" />
                        <span className="font-bold truncate max-w-[280px]">
                          [{task.ragSource.documentName} {task.ragSource.pageOrChapter ? `(${task.ragSource.pageOrChapter})` : ""}]
                        </span>
                        {task.groundedUserNeed && (
                          <span className="text-[#666666] border-l border-[#111111] pl-1.5 ml-1">
                            {task.groundedUserNeed}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end space-y-2 shrink-0 font-mono">
                  <span className="text-xs text-[#666666] font-bold">{task.durationMinutes} {language === "zh" ? "分钟" : "MIN"}</span>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setActiveRagTask(task)}
                      className="px-2 py-1 bg-white hover:bg-[#111111] hover:text-white border border-[#111111] text-xs font-bold text-[#111111] flex items-center space-x-1 cursor-pointer transition-colors"
                      title={language === "zh" ? "RAG 资料溯源与问答" : "RAG Grounding"}
                    >
                      <Zap className="w-3 h-3" />
                      <span>[{language === "zh" ? "溯源" : "RAG"}]</span>
                    </button>

                    <button
                      onClick={() => setActiveTimerTask(task)}
                      className="px-2.5 py-1 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      <span>[{language === "zh" ? "专注" : "FOCUS"}]</span>
                    </button>

                    <button
                      onClick={() => setActiveQuizTask(task)}
                      className="p-1 border border-[#111111] text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
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

      {activeRagTask && (
        <RagKnowledgeModal
          task={activeRagTask}
          plan={plan}
          isOpen={!!activeRagTask}
          onClose={() => setActiveRagTask(null)}
        />
      )}
    </div>
  );
}
