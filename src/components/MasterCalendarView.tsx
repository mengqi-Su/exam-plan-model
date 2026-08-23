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
import { getPaletteByString, getPaletteByIndex } from "../lib/themePalettes";

interface MasterCalendarViewProps {
  plans: ExamStudyPlan[];
  onToggleTaskStatus: (planId: string, taskId: string) => void;
  onStartFocusTimer: (task: StudyTask, planId: string) => void;
  onStartQuiz: (task: StudyTask, planId: string) => void;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
}

const CATEGORY_TAG_CLASS: Record<TaskCategory, string> = {
  theory: "border border-[#111111] bg-white text-[#111111]",
  reading: "border border-[#111111] bg-white text-[#111111]",
  practice_problems: "border border-[#111111] bg-white text-[#111111]",
  active_recall: "border border-[#111111] bg-white text-[#111111]",
  flashcards: "border border-[#111111] bg-white text-[#111111]",
  mock_exam: "border border-[#111111] bg-[#111111] text-white",
  review_weak_spots: "border border-[#111111] bg-white text-[#111111]",
  summary_cheat_sheet: "border border-[#111111] bg-white text-[#111111]",
};

const COURSE_COLORS = [
  "border border-[#111111] bg-white text-[#111111]",
  "border border-[#111111] bg-[#fafafa] text-[#111111]",
  "border border-[#111111] bg-white text-[#111111]",
  "border border-[#111111] bg-[#fafafa] text-[#111111]",
  "border border-[#111111] bg-white text-[#111111]",
  "border border-[#111111] bg-[#fafafa] text-[#111111]",
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

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    return propSelectedDate ? new Date(propSelectedDate) : new Date();
  });

  const [courseFilter, setCourseFilter] = useState<string>("all");

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");

  const [keyword, setKeyword] = useState<string>("");

  const [activeDayDate, setActiveDayDate] = useState<string>(() => {
    return propSelectedDate || new Date().toISOString().split("T")[0];
  });

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const planColorMap = useMemo(() => {
    const map = new Map<string, string>();
    plans.forEach((p, idx) => {
      map.set(p.id, COURSE_COLORS[idx % COURSE_COLORS.length]);
    });
    return map;
  }, [plans]);

  const allAggregatedTasks = useMemo(() => {
    const list: Array<{ task: StudyTask; plan: ExamStudyPlan }> = [];
    plans.forEach((plan) => {

      if (courseFilter !== "all" && plan.id !== courseFilter) {
        return;
      }

      plan.tasks.forEach((task) => {

        if (statusFilter === "pending" && task.status === "completed") return;
        if (statusFilter === "completed" && task.status !== "completed") return;

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

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

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

  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const prevMonthFiller: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateStr = prevDate.toISOString().split("T")[0];
      prevMonthFiller.push({ dateStr, dayNum, isCurrentMonth: false });
    }

    const currentMonthDays: Array<{ dateStr: string; dayNum: number; isCurrentMonth: boolean }> = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);

      const yStr = date.getFullYear();
      const mStr = String(date.getMonth() + 1).padStart(2, "0");
      const dStr = String(date.getDate()).padStart(2, "0");
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      currentMonthDays.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

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
    <div className="bg-white border border-[#111111] overflow-hidden">

      <div className="p-4 sm:p-5 border-b border-[#111111] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <CalendarIcon className="w-4 h-4 text-[#111111]" />
              <h2 className="text-base font-bold font-mono text-[#111111] tracking-tight uppercase">
                {monthTitle}
              </h2>
            </div>

            <div className="flex items-center space-x-1 border border-[#111111] p-0.5 bg-[#fafafa]">
              <button
                onClick={handlePrevMonth}
                className="p-1 hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleJumpToToday}
                className={`px-2 py-0.5 text-xs font-mono font-bold transition-colors cursor-pointer ${
                  todayStr.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
                    ? "bg-[#111111] text-white"
                    : "text-[#111111] hover:bg-[#ededed]"
                }`}
              >
                [{language === "zh" ? "今日" : "TODAY"}]
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1 hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <div className="flex items-center space-x-1.5 bg-white border border-[#111111] px-2 py-1">
              <Layers className="w-3.5 h-3.5 text-[#111111]" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="text-xs font-mono bg-transparent text-[#111111] outline-none cursor-pointer"
              >
                <option value="all">
                  {language === "zh" ? "全部科目" : "ALL COURSES"} ({plans.length})
                </option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.examName}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5 bg-white border border-[#111111] px-2 py-1">
              <Filter className="w-3.5 h-3.5 text-[#111111]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs font-mono bg-transparent text-[#111111] outline-none cursor-pointer"
              >
                <option value="all">{language === "zh" ? "全部任务" : "ALL STATUS"}</option>
                <option value="pending">{language === "zh" ? "仅待完成" : "PENDING"}</option>
                <option value="completed">{language === "zh" ? "仅已完成" : "COMPLETED"}</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#888888] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={language === "zh" ? "搜索考点..." : "SEARCH..."}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8 pr-2.5 py-1 text-xs font-mono bg-white border border-[#111111] text-[#111111] placeholder-[#888888] outline-none focus:bg-[#fafafa] w-28 sm:w-36 transition-all"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10px] font-mono text-[#666666] border-t border-[#e5e5e5]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-[#d44c47]" />
              <span>{language === "zh" ? "考试日" : "EXAM DAY"}</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-[#111111]" />
              <span>{language === "zh" ? "复习任务" : "TASK"}</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 bg-[#448361]" />
              <span>{language === "zh" ? "已完成" : "DONE"}</span>
            </span>
          </div>

          <div className="font-bold">
            {language === "zh"
              ? `本月共排定 ${allAggregatedTasks.length} 个任务`
              : `${allAggregatedTasks.length} TOTAL TASKS`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#111111] font-mono">

        <div className="lg:col-span-8 p-3 sm:p-4 bg-white">

          <div className="grid grid-cols-7 gap-1 text-center font-mono font-bold text-[10px] text-[#111111] mb-1.5 py-1 bg-[#fafafa] border border-[#111111]">
            {weekHeaders.map((w, idx) => (
              <div key={idx} className={idx === 0 || idx === 6 ? "text-[#666666]" : ""}>
                [{w}]
              </div>
            ))}
          </div>

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
                  className={`min-h-[92px] sm:min-h-[105px] p-1.5 border flex flex-col justify-between transition-all cursor-pointer select-none relative font-mono ${
                    isSelected
                      ? "border-[#111111] bg-[#111111] text-white z-10"
                      : isToday
                      ? "border-2 border-[#111111] bg-[#ededed] text-[#111111]"
                      : isCurrentMonth
                      ? "border border-[#111111] bg-white hover:bg-[#ededed] text-[#111111]"
                      : "border border-dashed border-[#111111]/30 bg-[#fafafa] opacity-40 hover:opacity-80 text-[#111111]"
                  }`}
                >

                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center ${
                        isSelected
                          ? "bg-white text-[#111111]"
                          : isToday
                          ? "bg-[#111111] text-white"
                          : isCurrentMonth
                          ? "text-[#111111]"
                          : "text-[#666666]"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className={`text-[10px] font-bold ${isSelected ? "text-white" : "text-[#666666]"}`}>
                        [{completedInDay}/{dayTasks.length}]
                      </span>
                    )}
                  </div>

                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">

                    {dayExams.map((exam) => (
                      <div
                        key={`exam-${exam.id}`}
                        className={`border border-[#111111] px-1 py-0.5 text-[9px] font-bold truncate flex items-center space-x-0.5 ${
                          isSelected ? "bg-white text-[#111111]" : "bg-[#111111] text-white"
                        }`}
                        title={`大考日: ${exam.examName}`}
                      >
                        <Target className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate uppercase">[{exam.examName}]</span>
                      </div>
                    ))}

                    {dayTasks.slice(0, 2).map(({ task, plan }) => {
                      const isTaskDone = task.status === "completed";

                      return (
                        <div
                          key={`task-${task.id}`}
                          className={`px-1 py-0.5 text-[9px] border truncate flex items-center space-x-1 font-bold ${
                            isSelected
                              ? isTaskDone
                                ? "bg-[#222222] border-white/40 text-white/50 line-through"
                                : "bg-white border-white text-[#111111]"
                              : isTaskDone
                              ? "bg-[#ededed] border-[#111111] text-[#666666] line-through"
                              : "bg-white border-[#111111] text-[#111111]"
                          }`}
                          title={`${plan.examName}: ${task.title}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 shrink-0 ${
                              isTaskDone ? "bg-[#666666]" : "bg-current"
                            }`}
                          />
                          <span className="truncate flex-1">
                            {task.title}
                          </span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 2 && (
                      <div className={`text-[9px] font-bold pl-1 ${isSelected ? "text-white/80" : "text-[#666666]"}`}>
                        +{dayTasks.length - 2} {language === "zh" ? "项" : "MORE"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 p-4 sm:p-5 bg-white flex flex-col justify-between space-y-4 font-mono">
          <div className="space-y-3">

            <div className="flex items-center justify-between pb-2 border-b border-[#111111]">
              <div>
                <span className="text-[11px] font-bold text-[#666666] uppercase tracking-wider block">
                  [{language === "zh" ? "选中日期任务" : "SELECTED DATE TASKS"}]
                </span>
                <h3 className="text-base font-bold text-[#111111] flex items-center space-x-1.5">
                  <span>{activeDayDate}</span>
                  {activeDayDate === todayStr && (
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#111111] text-white font-bold">
                      [{language === "zh" ? "今日" : "TODAY"}]
                    </span>
                  )}
                </h3>
              </div>

              <span className="text-xs font-bold text-[#111111] bg-white border border-[#111111] px-2 py-0.5">
                {activeDayTasks.length} {language === "zh" ? "项" : "TASKS"}
              </span>
            </div>

            {activeDayExams.length > 0 && (
              <div className="p-3 bg-[#fafafa] border border-[#111111] space-y-1">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#111111] uppercase">
                  <Target className="w-4 h-4" />
                  <span>[{language === "zh" ? "考试日提醒" : "EXAM DAY ALERT"}]</span>
                </div>
                {activeDayExams.map((ex) => (
                  <p key={ex.id} className="text-xs font-bold text-[#111111]">
                    [{ex.examName}] ({ex.subject})
                  </p>
                ))}
              </div>
            )}

            {activeDayTasks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#111111] mx-auto opacity-40" />
                <p className="text-xs text-[#666666] font-bold">
                  [{language === "zh" ? "该日期无任何排定的复习任务" : "NO TASKS SCHEDULED FOR THIS DAY"}]
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {activeDayTasks.map(({ task, plan }) => {
                  const isCompleted = task.status === "completed";
                  const tagClass = CATEGORY_TAG_CLASS[task.category] || "border border-[#111111] bg-white text-[#111111]";
                  const coursePalette = getPaletteByString(plan.id || plan.examName);

                  return (
                    <div
                      key={`${plan.id}-${task.id}`}
                      className={`p-2.5 border transition-all space-y-2 font-mono ${
                        isCompleted
                          ? "bg-[#fafafa] border-[#111111] opacity-70"
                          : "bg-white border-[#111111]"
                      }`}
                    >
                      <div className="flex items-start space-x-2">

                        <button
                          onClick={() => onToggleTaskStatus(plan.id, task.id)}
                          className="mt-0.5 text-[#111111] hover:text-[#000000] transition-colors shrink-0 cursor-pointer"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#111111]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#111111]" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">

                          <div className="flex flex-wrap items-center gap-1 font-bold">
                            <span
                              className="border border-[#111111] px-1.5 py-0.2 text-[9px] uppercase truncate max-w-[120px]"
                              style={{
                                backgroundColor: coursePalette.accentColor,
                                color: coursePalette.id === "dark-slate" ? "#FFFFFF" : "#111111"
                              }}
                            >
                              [{plan.examName}]
                            </span>
                            <span className={`${tagClass} px-1.5 py-0.2 text-[9px] uppercase`}>
                              [{t(`cat_${task.category}` as any) || task.category}]
                            </span>
                            <span className="text-[10px] text-[#666666] flex items-center space-x-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{task.durationMinutes}M</span>
                            </span>
                          </div>

                          <p
                            className={`text-xs font-bold leading-snug ${
                              isCompleted ? "line-through text-[#666666]" : "text-[#111111]"
                            }`}
                          >
                            {task.title}
                          </p>

                          {task.topicTitle && (
                            <p className="text-[10px] text-[#666666] truncate font-bold">
                              [{task.topicTitle}]
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end space-x-1.5 pt-1 border-t border-[#111111]">
                        {task.activeRecallPrompt && (
                          <button
                            onClick={() => onStartQuiz(task, plan.id)}
                            className="px-2 py-0.5 text-[10px] bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>[{language === "zh" ? "测验" : "QUIZ"}]</span>
                          </button>
                        )}
                        <button
                          onClick={() => onStartFocusTimer(task, plan.id)}
                          className="px-2 py-0.5 text-[10px] bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                        >
                          <Play className="w-2.5 h-2.5" />
                          <span>[{language === "zh" ? "专注" : "FOCUS"}]</span>
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
