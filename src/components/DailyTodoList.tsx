import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Filter,
  Pin
} from "lucide-react";
import confetti from "canvas-confetti";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { playCompletionChime } from "../lib/audio";
import { TaskFocusTimerModal } from "./TaskFocusTimerModal";
import { QuizModal } from "./QuizModal";
import { RagKnowledgeModal } from "./RagKnowledgeModal";
import { PinnedRoadmapTodoList } from "./PinnedRoadmapTodoList";
import { useI18n } from "../lib/i18n";
import { getPaletteByString } from "../lib/themePalettes";

interface DailyTodoListProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  searchQuery?: string;
}

export function DailyTodoList({
  plan,
  onUpdatePlan,
  selectedDate,
  onSelectDate,
  searchQuery = "",
}: DailyTodoListProps) {
  const { t, language } = useI18n();
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [activeTimerTask, setActiveTimerTask] = useState<StudyTask | null>(null);
  const [activeQuizTask, setActiveQuizTask] = useState<StudyTask | null>(null);
  const [activeRagTask, setActiveRagTask] = useState<StudyTask | null>(null);
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
              className="p-1.5 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer rounded-lg shadow-xs"
              title={t("previousDay")}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleJumpToToday}
              className="px-2.5 py-1 text-xs font-mono font-bold hover:bg-[#111111] hover:text-white text-[#111111] transition-colors border border-[#111111] cursor-pointer rounded-lg shadow-xs"
            >
              [{language === "zh" ? "今日" : "TODAY"}]
            </button>

            <button
              onClick={() => handleShiftDate(1)}
              className="p-1.5 border border-[#111111] hover:bg-[#ededed] text-[#111111] transition-colors cursor-pointer rounded-lg shadow-xs"
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
              className="text-xs font-mono text-[#111111] bg-white border border-[#111111] px-2 py-1 focus:outline-none cursor-pointer rounded-lg shadow-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">

          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-white border border-[#111111] text-xs font-mono text-[#111111] rounded-lg shadow-xs">
            <span
              className="w-2.5 h-2.5 border border-[#111111] shrink-0 rounded-xs"
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

          <div className="flex items-center space-x-1 text-xs font-mono text-[#111111] bg-white border border-[#111111] px-2 py-1 rounded-lg shadow-xs">
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

          <button
            onClick={() => setIsAddingInline(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-medium rounded-lg transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{language === "zh" ? "新建待办" : "Add Task"}</span>
          </button>
        </div>
      </div>

      {/* Inline Quick Add Task Box when triggered */}
      {isAddingInline && (
        <div className="p-4 bg-white border border-[#111111] rounded-xl shadow-md space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center space-x-2 font-bold text-xs text-gray-900">
              <Pin className="w-4 h-4 text-[#111111]" />
              <span>{language === "zh" ? "钉入新待办" : "Pin New Study Task"}</span>
              <span className="text-gray-400 font-normal">({selectedDate})</span>
            </div>
            <button
              onClick={() => setIsAddingInline(false)}
              className="text-xs text-gray-400 hover:text-gray-800 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                {language === "zh" ? "任务名称" : "Task Name"}
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={language === "zh" ? "例如：复习动态规划核心状态转移方程" : "e.g. Dynamic Programming Review"}
                className="w-full bg-[#FAF9F6] border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-[#111111] focus:outline-none focus:border-gray-900 font-sans font-medium"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                {language === "zh" ? "任务类型" : "Category"}
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="w-full bg-[#FAF9F6] border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
              >
                <option value="practice_problems">{t("catPracticeProblems")}</option>
                <option value="theory">{t("catTheory")}</option>
                <option value="active_recall">{t("catActiveRecall")}</option>
                <option value="mock_exam">{t("catMockExam")}</option>
                <option value="review_weak_spots">{t("catReviewWeakSpots")}</option>
                <option value="summary_cheat_sheet">{t("catSummaryCheatSheet")}</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                {language === "zh" ? "所属知识点/章节" : "Topic"}
              </label>
              <select
                value={newTopic}
                onChange={(e) => setNewTopic(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#111111] focus:outline-none"
              >
                {plan.topics.map((t) => (
                  <option key={t.id} value={t.title}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                {language === "zh" ? "预计时长 (分钟)" : "Duration (Mins)"}
              </label>
              <input
                type="number"
                min={10}
                max={240}
                step={5}
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                className="w-full bg-[#FAF9F6] border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#111111] font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-[#666666] block mb-1">
                {language === "zh" ? "优先级" : "Priority"}
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as any)}
                className="w-full bg-[#FAF9F6] border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-[#111111] font-medium"
              >
                <option value="high">{t("priorityHigh")}</option>
                <option value="medium">{t("priorityMedium")}</option>
                <option value="low">{t("priorityLow")}</option>
              </select>
            </div>

            <div className="sm:col-span-2 flex items-end justify-end space-x-2 pt-2 sm:pt-0">
              <button
                onClick={() => setIsAddingInline(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 cursor-pointer font-medium"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTitle.trim()}
                className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-medium rounded-lg cursor-pointer shadow-xs"
              >
                {language === "zh" ? "钉入待办" : "Pin Task"}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredTasks.length === 0 ? (
        <div className="p-12 text-center space-y-3 border-2 border-dashed border-[#111111]/30 bg-[#faf8f5] rounded-2xl">
          <BookOpen className="w-8 h-8 mx-auto text-[#888888]" />
          <h3 className="font-mono font-bold text-sm text-[#111111]">
            {t("noTasksToday", { date: formattedDate })}
          </h3>
          <p className="text-xs font-mono text-[#666666] max-w-md mx-auto">
            {t("noTasksTodayDesc")}
          </p>
          <button
            onClick={() => setIsAddingInline(true)}
            className="mt-2 px-4 py-2 bg-[#111111] hover:bg-[#333333] text-white text-xs font-mono font-bold rounded-lg transition-all shadow-xs cursor-pointer"
          >
            [{language === "zh" ? "+ 为此日期钉入新待办" : "+ PIN TASK FOR THIS DATE"}]
          </button>
        </div>
      ) : (
        <PinnedRoadmapTodoList
          plan={plan}
          tasks={filteredTasks}
          onToggleComplete={handleToggleComplete}
          onUpdateConfidence={handleUpdateConfidence}
          onSaveNotes={handleSaveNotes}
          onDeleteTask={handleDeleteTask}
          onStartTimer={(task) => setActiveTimerTask(task)}
          onStartQuiz={(task) => setActiveQuizTask(task)}
          onStartRag={(task) => setActiveRagTask(task)}
          onAddNewTask={() => setIsAddingInline(true)}
          selectedDate={selectedDate}
        />
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
