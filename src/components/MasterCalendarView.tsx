import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Layers,
  Sparkles,
  Play,
  Target,
  Search,
  CheckSquare,
  BookOpen
} from "lucide-react";
import { ExamStudyPlan, StudyTask, TaskCategory } from "../types";
import { useI18n } from "../lib/i18n";

interface MasterCalendarViewProps {
  plans: ExamStudyPlan[];
  onToggleTaskStatus: (planId: string, taskId: string) => void;
  onStartFocusTimer: (task: StudyTask, planId: string) => void;
  onStartQuiz: (task: StudyTask, planId: string) => void;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
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

// Course badge color helper by index
const COURSE_COLORS = [
  "border-[#2b78a0] bg-[#eaf4fc] text-[#1e5875]",
  "border-[#448361] bg-[#edf3ec] text-[#2b593f]",
  "border-[#cb912f] bg-[#fbf3db] text-[#8f641e]",
  "border-[#9065b0] bg-[#f7f0fc] text-[#633b82]",
  "border-[#d44c47] bg-[#fbf3f2] text-[#932724]",
  "border-[#937264] bg-[#f5f0ed] text-[#61473d]",
];

export function MasterCalendarView({
  plans,
  onToggleTaskStatus,
  onStartFocusTimer,
  onStartQuiz,
  onSelectDate,
  selectedDate: propSelectedDate,
}: MasterCalendarViewProps) {
  const { t, language } = useI18n();

  // Current viewed month date state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    return propSelectedDate ? new Date(propSelectedDate) : new Date();
  });

  // Course filter: 'all' or planId
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // Status filter: 'all' | 'pending' | 'completed'
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");

  // Search keyword inside calendar
  const [keyword, setKeyword] = useState<string>("");

  // Selected date inside calendar
  const [activeDayDate, setActiveDayDate] = useState<string>(() => {
    return propSelectedDate || new Date().toISOString().split("T")[0];
  });

  // Today string
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Map each plan to an assigned color class for easy visual distinction
  const planColorMap = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach((p, idx) => {
      map.set(p.id, COURSE_COLORS[idx % COURSE_COLORS.length]);
    });
    return map;
  }, [plans]);

  // Aggregate all tasks across plans with plan reference
  const allAggregatedTasks = useMemo(() => {
    const list: Array<{ task: StudyTask; plan: ExamStudyPlan }> = [];
    plans.forEach((plan) => {
      // Filter by course
      if (courseFilter !== "all" && plan.id !== courseFilter) {
        return;
      }

      plan.tasks.forEach((task) => {
        // Filter by status
        if (statusFilter === "pending" && task.status === "completed") return;
        if (statusFilter === "completed" && task.status !== "completed") return;

        // Filter by keyword
        if (keyword.trim()) {
          const q = keyword.toLowerCase();
          const matches =
            task.title.toLowerCase().includes(q) ||
            task.topicTitle.toLowerCase().includes(q) ||
            plan.examName.toLowerCase().includes(q);
          if (!matches) return;
        }

        list.push({ task, plan });
      });
    });
    return list;
  }, [plans, courseFilter, statusFilter, keyword]);

  // Group tasks by date string 'YYYY-MM-DD'
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Array<{ task: StudyTask; plan: ExamStudyPlan }>>();
    allAggregatedTasks.forEach((item) => {
      const d = item.task.date;
      if (!map.has(d)) {
        map.set(d, []);
      }
      map.get(d)!.push(item);
    });
    return map;
  }, [allAggregatedTasks]);

  // Exam milestone dates by date string
  const examDatesByDate = useMemo(() => {
    const map = new Map<string, ExamStudyPlan[]>();
    plans.forEach((plan) => {
      if (courseFilter !== "all" && plan.id !== courseFilter) return;
      if (!plan.examDate) return;
      if (!map.has(plan.examDate)) {
        map.set(plan.examDate, []);
      }
      map.get(plan.examDate)!.push(plan);
    });
    return map;
  }, [plans, courseFilter]);

  // Month navigation helpers
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setCurrentMonthDate(now);
    const today = now.toISOString().split("T")[0];
    setActiveDayDate(today);
    if (onSelectDate) onSelectDate(today);
  };

  // Build calendar matrix (6 weeks x 7 days)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Previous month filler
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const prevMonthFiller: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = prevDate.toISOString().split("T")[0];
      prevMonthFiller.push({ dateStr, dayNum, isCurrentMonth: false });
    }

    // Current month days
    const currentMonthDays: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      // Format YYYY-MM-DD reliably with local date components
      const yStr = date.getFullYear();
      const mStr = String(date.getMonth() + 1).padStart(2, "0");
      const dStr = String(date.getDate()).padStart(2, "0");
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      currentMonthDays.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Next month filler to complete matrix (up to 35 or 42 cells)
    const totalFilled = prevMonthFiller.length + currentMonthDays.length;
    const totalSlots = totalFilled > 35 ? 42 : 35;
    const nextMonthFiller: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    for (let d = 1; d <= totalSlots - totalFilled; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().split("T")[0];
      nextMonthFiller.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return [...prevMonthFiller, ...currentMonthDays, ...nextMonthFiller];
  }, [year, month]);

  // Tasks for currently selected day in calendar side drawer/detail
  const activeDayTasks = useMemo(() => {
    return tasksByDate.get(activeDayDate) || [];
  }, [tasksByDate, activeDayDate]);

  const activeDayExams = useMemo(() => {
    return examDatesByDate.get(activeDayDate) || [];
  }, [examDatesByDate, activeDayDate]);

  const weekHeaders = language === "zh" 
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthTitle = language === "zh"
    ? `${year}年 ${month + 1}月`
    : currentMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xs overflow-hidden">
      {/* Header Bar: Navigation & Filters */}
      <div className="p-4 sm:p-5 border-b border-[#f0f0ee] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Month Title & Prev/Next/Today */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-[#2b78a0]" />
              <h2 className="text-lg font-bold text-[#37352f] tracking-tight">
                {monthTitle}
              </h2>
            </div>

            <div className="flex items-center space-x-1 border border-[#e9e9e7] rounded-lg p-0.5 bg-[#f7f6f3]">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-[#e3e2e0] text-[#5a5a57] transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleJumpToToday}
                className={`px-2 py-0.5 text-xs font-semibold rounded transition-colors ${
                  todayStr.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
                    ? "bg-white text-[#37352f] shadow-2xs"
                    : "text-[#5a5a57] hover:bg-[#e3e2e0]"
                }`}
              >
                {language === "zh" ? "今天" : "Today"}
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-[#e3e2e0] text-[#5a5a57] transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Side: Course Filter & Status Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Course Filter Dropdown */}
            <div className="flex items-center space-x-1.5 bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1">
              <Layers className="w-3.5 h-3.5 text-[#787774]" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="text-xs bg-transparent text-[#37352f] font-medium outline-none cursor-pointer"
              >
                <option value="all">
                  {language === "zh" ? "全部科目" : "All Courses"} ({plans.length})
                </option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.examName}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-1.5 bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-[#787774]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs bg-transparent text-[#37352f] font-medium outline-none cursor-pointer"
              >
                <option value="all">{language === "zh" ? "全部任务" : "All Status"}</option>
                <option value="pending">{language === "zh" ? "仅待完成" : "Pending"}</option>
                <option value="completed">{language === "zh" ? "仅已完成" : "Completed"}</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#9b9a97] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === "zh" ? "搜索考点..." : "Search tasks..."}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs bg-white border border-[#e9e9e7] rounded-md text-[#37352f] placeholder-[#9b9a97] outline-none focus:border-[#37352f] w-28 sm:w-36 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Legend / Quick Stats */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-[#787774] border-t border-[#f0f0ee]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#d44c47]" />
              <span>{language === "zh" ? "考试日" : "Exam Day"}</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#2b78a0]" />
              <span>{language === "zh" ? "复习任务" : "Study Task"}</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-[#448361]" />
              <span>{language === "zh" ? "已打卡" : "Completed"}</span>
            </span>
          </div>

          <div className="font-medium">
            {language === "zh" 
              ? `本月共排定 ${allAggregatedTasks.length} 个任务`
              : `${allAggregatedTasks.length} total tasks scheduled`}
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar Matrix & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#e9e9e7]">
        {/* Left / Center: 7-Column Calendar Grid */}
        <div className="lg:col-span-8 p-3 sm:p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-[#787774] mb-1.5 py-1 bg-[#f7f6f3] rounded-md">
            {weekHeaders.map((w, idx) => (
              <div key={idx} className={idx === 0 || idx === 6 ? "text-[#cb912f]" : ""}>
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
              const dayTasks = tasksByDate.get(dateStr) || [];
              const dayExams = examDatesByDate.get(dateStr) || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === activeDayDate;
              const completedInDay = dayTasks.filter((t) => t.task.status === "completed").length;

              return (
                <div
                  key={`${dateStr}-${idx}`}
                  onClick={() => {
                    setActiveDayDate(dateStr);
                    if (onSelectDate) onSelectDate(dateStr);
                  }}
                  className={`min-h-[92px] sm:min-h-[105px] p-1.5 rounded-lg border flex flex-col justify-between transition-all cursor-pointer select-none relative ${
                    isSelected
                      ? "border-[#37352f] ring-2 ring-[#37352f]/10 bg-white shadow-2xs z-10"
                      : isToday
                      ? "border-[#2b78a0] bg-[#f4f9fd]"
                      : isCurrentMonth
                      ? "border-[#e9e9e7] bg-white hover:border-[#b4b4b0] hover:bg-[#fafaf9]"
                      : "border-transparent bg-[#fbfbfa] opacity-40 hover:opacity-75"
                  }`}
                >
                  {/* Top: Day Number & Mini Indicators */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                        isToday
                          ? "bg-[#2b78a0] text-white font-bold"
                          : isSelected
                          ? "bg-[#37352f] text-white"
                          : isCurrentMonth
                          ? "text-[#37352f]"
                          : "text-[#9b9a97]"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-[#787774] font-medium">
                        {completedInDay}/{dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Middle: Exam Tags & Task Chips */}
                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                    {/* Exam day banner */}
                    {dayExams.map((exam) => (
                      <div
                        key={`exam-${exam.id}`}
                        className="bg-[#fbf3f2] border border-[#f5c6cb] text-[#d44c47] rounded px-1 py-0.5 text-[9px] font-bold truncate flex items-center space-x-0.5 shadow-2xs"
                        title={`大考日: ${exam.examName}`}
                      >
                        <Target className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{exam.examName}</span>
                      </div>
                    ))}

                    {/* Study tasks (top 2 preview) */}
                    {dayTasks.slice(0, 2).map(({ task, plan }) => {
                      const isTaskDone = task.status === "completed";
                      const colorClass = planColorMap.get(plan.id) || "border-[#e9e9e7] bg-[#f7f6f3] text-[#37352f]";

                      return (
                        <div
                          key={`task-${task.id}`}
                          className={`px-1 py-0.5 rounded text-[9px] border truncate flex items-center space-x-1 ${
                            isTaskDone
                              ? "bg-[#fafaf9] border-[#e9e9e7] text-[#9b9a97] line-through"
                              : colorClass
                          }`}
                          title={`${plan.examName}: ${task.title}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              isTaskDone ? "bg-[#9b9a97]" : "bg-current"
                            }`}
                          />
                          <span className="truncate flex-1 font-medium">
                            {task.title}
                          </span>
                        </div>
                      );
                    })}

                    {/* More count pill */}
                    {dayTasks.length > 2 && (
                      <div className="text-[9px] text-[#787774] font-medium pl-1">
                        +{dayTasks.length - 2} {language === "zh" ? "项任务" : "more"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Date Task Detail Side-Panel */}
        <div className="lg:col-span-4 p-4 sm:p-5 bg-[#fafaf9] flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Header: Selected Date Info */}
            <div className="flex items-center justify-between pb-2 border-b border-[#e9e9e7]">
              <div>
                <span className="text-[11px] font-semibold text-[#787774] uppercase tracking-wider block">
                  {language === "zh" ? "选中日期任务" : "Selected Date Tasks"}
                </span>
                <h3 className="text-base font-bold text-[#37352f] flex items-center space-x-1.5">
                  <span>{activeDayDate}</span>
                  {activeDayDate === todayStr && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#2b78a0] text-white rounded-full font-semibold">
                      {language === "zh" ? "今日" : "Today"}
                    </span>
                  )}
                </h3>
              </div>

              <span className="text-xs font-semibold text-[#37352f] bg-white border border-[#e9e9e7] px-2 py-0.5 rounded-md">
                {activeDayTasks.length} {language === "zh" ? "项" : "Tasks"}
              </span>
            </div>

            {/* Exam Day Alert if any */}
            {activeDayExams.length > 0 && (
              <div className="p-3 rounded-lg bg-[#fbf3f2] border border-[#f5c6cb] space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#d44c47]">
                  <Target className="w-4 h-4" />
                  <span>{language === "zh" ? "考试日提醒" : "Exam Day Alert"}</span>
                </div>
                {activeDayExams.map((ex) => (
                  <p key={ex.id} className="text-xs font-semibold text-[#37352f]">
                    🎯 {ex.examName} ({ex.subject})
                  </p>
                ))}
              </div>
            )}

            {/* Tasks List */}
            {activeDayTasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#9b9a97] mx-auto opacity-50" />
                <p className="text-xs text-[#787774]">
                  {language === "zh" ? "该日期无任何排定的复习任务" : "No tasks scheduled for this day"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {activeDayTasks.map(({ task, plan }) => {
                  const isCompleted = task.status === "completed";
                  const tagClass = CATEGORY_TAG_CLASS[task.category] || "notion-tag-gray";

                  return (
                    <div
                      key={`${plan.id}-${task.id}`}
                      className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                        isCompleted
                          ? "bg-[#fafaf9] border-[#e9e9e7] opacity-65"
                          : "bg-white border-[#e9e9e7] shadow-2xs hover:border-[#b4b4b0]"
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {/* Checkbox */}
                        <button
                          onClick={() => onToggleTaskStatus(plan.id, task.id)}
                          className="mt-0.5 text-[#787774] hover:text-[#37352f] transition-colors shrink-0"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#448361] fill-[#448361]/10" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#9b9a97]" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          {/* Tags row */}
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="notion-tag-blue px-1.5 py-0.2 rounded text-[9px] font-semibold truncate max-w-[120px]">
                              {plan.examName}
                            </span>
                            <span className={`${tagClass} px-1.5 py-0.2 rounded text-[9px]`}>
                              {t(`cat_${task.category}` as any) || task.category}
                            </span>
                            <span className="text-[10px] text-[#787774] flex items-center space-x-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{task.durationMinutes}m</span>
                            </span>
                          </div>

                          {/* Task title */}
                          <p
                            className={`text-xs font-semibold leading-snug ${
                              isCompleted ? "line-through text-[#9b9a97]" : "text-[#37352f]"
                            }`}
                          >
                            {task.title}
                          </p>

                          {task.topicTitle && (
                            <p className="text-[10px] text-[#787774] truncate">
                              📚 {task.topicTitle}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quick tool buttons */}
                      <div className="flex items-center justify-end space-x-1.5 pt-1 border-t border-[#f0f0ee]">
                        {task.activeRecallPrompt && (
                          <button
                            onClick={() => onStartQuiz(task, plan.id)}
                            className="px-2 py-0.5 text-[10px] bg-[#fbf3db] hover:bg-[#faebc7] text-[#cb912f] rounded font-medium transition-colors flex items-center space-x-1"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{language === "zh" ? "测验" : "Quiz"}</span>
                          </button>
                        )}
                        <button
                          onClick={() => onStartFocusTimer(task, plan.id)}
                          className="px-2 py-0.5 text-[10px] bg-[#efefed] hover:bg-[#e3e2e0] text-[#37352f] rounded font-medium transition-colors flex items-center space-x-1"
                        >
                          <Play className="w-2.5 h-2.5 text-[#448361]" />
                          <span>{language === "zh" ? "专注" : "Focus"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
