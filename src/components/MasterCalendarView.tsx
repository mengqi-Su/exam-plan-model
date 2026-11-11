import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  Circle,
  Clock,
  Filter,
  Layers,
  Play,
  Target,
  Search,
} from "lucide-react";
import { ExamStudyPlan, StudyTask, DailyMemoNote } from "../types";
import { useI18n } from "../lib/i18n";
import { getCourseAccent } from "../lib/courseAccents";
import { getDailyMemos } from "../lib/storage";
import { DailyMoodMemoPad } from "./DailyMoodMemoPad";
import { PageIconGlyph } from "./PageIconGlyph";
import { parseLocalDate, toLocalDateString } from "../lib/date";

interface MasterCalendarViewProps {
  plans: ExamStudyPlan[];
  onToggleTaskStatus: (planId: string, taskId: string) => void;
  onStartFocusTimer: (task: StudyTask, planId: string) => void;
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
}

// Subtle mood signal for the day-cell memo dot (replaces the old emoji badges).
/* 六个心情各自压到能在白格上认出 6px 点的深度（清单 UI-03）：
   原来 motivated #E0A800 / inspired #D9A521 / tired #8A8580 在白底只有 2.15 / 2.24 / 3.65:1，
   前两个基本是一个不存在的点。色相沿用科目身份色那四个，另两个补上紫和中性灰。 */
const MEMO_DOT: Record<string, string> = {
  motivated: "#8A6A12",
  calm: "#46658A",
  inspired: "#6B4E8E",
  breakthrough: "#4A7353",
  anxious: "#8A5348",
  tired: "#6b6660",
};

export function MasterCalendarView({
  plans,
  onToggleTaskStatus,
  onStartFocusTimer,
  onSelectDate,
  selectedDate: propSelectedDate,
}: MasterCalendarViewProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    return propSelectedDate ? parseLocalDate(propSelectedDate) : new Date();
  });

  const [courseFilter, setCourseFilter] = useState<string>("all");

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");

  const [keyword, setKeyword] = useState<string>("");

  const [activeDayDate, setActiveDayDate] = useState<string>(() => {
    return propSelectedDate || toLocalDateString();
  });

  const [dailyMemos, setDailyMemos] = useState<Record<string, DailyMemoNote>>(() => getDailyMemos());

  const refreshMemos = () => {
    setDailyMemos(getDailyMemos());
  };

  const todayStr = useMemo(() => toLocalDateString(), []);

  const getCourseAccentForPlan = (planId: string) => {
    const idx = plans.findIndex((p) => p.id === planId);
    return getCourseAccent(idx >= 0 ? idx : 0);
  };

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
    const today = toLocalDateString(now);
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
      const dateStr = toLocalDateString(prevDate);
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
      const dateStr = toLocalDateString(nextDate);
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

  const weekHeaders = isZh
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const monthTitle = isZh
    ? `${year}年 ${month + 1}月`
    : currentMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const viewingTodayMonth = todayStr.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);

  const selectCls =
    "text-[12px] bg-transparent text-[#1c1b1a] cursor-pointer";
  const filterWrapCls =
    "flex items-center gap-1.5 rounded-lg border border-[#e5e2dc] bg-white px-2.5 py-1.5";

  return (
    <div className="ui-card overflow-hidden">
      {/* Header: month navigation + filters */}
      <div className="p-4 sm:p-5 border-b border-[#f0ede8] space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-[#6b6660]" />
              <h2 className="text-[20px] font-semibold text-[#1c1b1a] tracking-tight tabular-nums">
                {monthTitle}
              </h2>
            </div>

            <div className="flex items-center gap-0.5 rounded-lg bg-[#f1efe9] p-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-[#6b6660] hover:bg-white hover:text-[#1c1b1a] transition-colors cursor-pointer"
                title={isZh ? "上个月" : "Previous month"}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleJumpToToday}
                className={`px-2.5 py-1 rounded-lg text-[12px] font-medium transition-colors cursor-pointer ${
                  viewingTodayMonth
                    ? "bg-white text-[#1c1b1a] shadow-sm"
                    : "text-[#6b6660] hover:bg-white/60"
                }`}
              >
                {isZh ? "今日" : "Today"}
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-[#6b6660] hover:bg-white hover:text-[#1c1b1a] transition-colors cursor-pointer"
                title={isZh ? "下个月" : "Next month"}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={filterWrapCls}>
              <Layers className="w-3.5 h-3.5 text-[#6b6660]" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className={selectCls}
              >
                <option value="all">{isZh ? "全部科目" : "All courses"}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.examName}
                  </option>
                ))}
              </select>
            </div>

            <div className={filterWrapCls}>
              <Filter className="w-3.5 h-3.5 text-[#6b6660]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className={selectCls}
              >
                <option value="all">{isZh ? "全部任务" : "All status"}</option>
                <option value="pending">{isZh ? "仅待完成" : "Pending"}</option>
                <option value="completed">{isZh ? "仅已完成" : "Completed"}</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6b6660] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isZh ? "搜索考点…" : "Search…"}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-8 pr-2.5 py-1.5 text-[12px] rounded-lg border border-[#e5e2dc] bg-white text-[#1c1b1a] placeholder-[#716c65] focus:border-[#cfc9c0] w-32 sm:w-40 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Calendar grid */}
        <div className="lg:col-span-8 p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[#6b6660] mb-1.5">
            {weekHeaders.map((w, idx) => (
              /* 周末用主墨、工作日用次墨：两档都读得清，层级靠深浅而不是靠「淡到看不见」（清单 UI-03） */
              <div key={idx} className={idx === 0 || idx === 6 ? "text-[#1c1b1a]" : ""}>
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
              const dayTasks = tasksByDate.get(dateStr) || [];
              const dayExams = examDatesByDate.get(dateStr) || [];
              const dayMemo = dailyMemos[dateStr];
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
                  className={`min-h-[92px] sm:min-h-[104px] p-1.5 rounded-lg border flex flex-col justify-between transition-all cursor-pointer select-none relative ${
                    isSelected
                      ? "border-[#1c1b1a] bg-[#1c1b1a] text-white z-10 shadow-sm"
                      : isToday
                      ? "border-[#cfc9c0] bg-[#f1efe9] text-[#1c1b1a]"
                      : isCurrentMonth
                      ? "border-[#eae7e1] bg-white hover:bg-[#faf9f6] hover:border-[#ddd8d0] text-[#1c1b1a]"
                      : "border-transparent bg-[#faf9f6] text-[#6b6660]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[12px] font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full ${
                        isSelected
                          ? "bg-white text-[#1c1b1a]"
                          : isToday
                          ? "bg-[#1c1b1a] text-white"
                          : isCurrentMonth
                          ? "text-[#1c1b1a]"
                          : "text-[#6b6660]"
                      }`}
                    >
                      {dayNum}
                    </span>

                    <div className="flex items-center gap-1">
                      {dayMemo && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            /* 选中格已经是墨底，它的强调色就是白（日期牌也是白底），便签点跟着走，
                               原来这里单独用一块明黄 #FCD33B，只有「这一格被选中」的意思，却多引入一个颜色。 */
                            backgroundColor: isSelected ? "#ffffff" : MEMO_DOT[dayMemo.mood || ""] || "#6b6660",
                          }}
                          title={isZh ? `随心便签: ${dayMemo.content || "有记录"}` : `Memo: ${dayMemo.content || "Recorded"}`}
                        />
                      )}

                      {dayTasks.length > 0 && (
                        <span className={`text-[11px] tabular-nums ${isSelected ? "text-white/70" : "text-[#6b6660]"}`}>
                          {completedInDay}/{dayTasks.length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-1 space-y-1 flex-1 overflow-hidden">
                    {dayExams.map((exam) => (
                      <div
                        key={`exam-${exam.id}`}
                        className={`rounded-lg px-1 py-0.5 text-[11px] font-medium truncate flex items-center gap-0.5 ${
                          isSelected ? "bg-white/15 text-white" : "bg-[#FDF0EE] text-[#B42318]"
                        }`}
                        title={isZh ? `大考日: ${exam.examName}` : `Exam day: ${exam.examName}`}
                      >
                        <Target className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{exam.examName}</span>
                      </div>
                    ))}

                    {dayTasks.slice(0, 2).map(({ task, plan }) => {
                      const isTaskDone = task.status === "completed";
                      const courseAccent = getCourseAccentForPlan(plan.id);

                      return (
                        <div
                          key={`task-${task.id}`}
                          className={`rounded-lg px-1 py-0.5 text-[11px] truncate flex items-center gap-1 ${
                            isSelected
                              ? isTaskDone
                                ? "bg-white/10 text-white/50 line-through"
                                : "bg-white/10 text-white/90"
                              : isTaskDone
                              ? "bg-[#f1efe9] text-[#6b6660] line-through"
                              : "bg-[#faf9f6] text-[#1c1b1a]"
                          }`}
                          title={`${plan.examName}: ${task.title}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: courseAccent }}
                          />
                          <span className="truncate flex-1">{task.title}</span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 2 && (
                      <div className={`text-[11px] pl-1 ${isSelected ? "text-white/60" : "text-[#6b6660]"}`}>
                        +{dayTasks.length - 2} {isZh ? "项" : "more"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected-day panel */}
        <div className="lg:col-span-4 p-4 sm:p-5 border-t lg:border-t-0 lg:border-l border-[#f0ede8] flex flex-col space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#f0ede8]">
              <div>
                <span className="text-[11px] font-medium text-[#6b6660] block">
                  {isZh ? "选中日期任务" : "Selected date"}
                </span>
                <h3 className="text-[15px] font-semibold text-[#1c1b1a] flex items-center gap-1.5 tabular-nums">
                  <span>{activeDayDate}</span>
                  {activeDayDate === todayStr && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-[#1c1b1a] text-white font-medium">
                      {isZh ? "今日" : "Today"}
                    </span>
                  )}
                </h3>
              </div>

              <span className="ui-chip tabular-nums">
                {activeDayTasks.length} {isZh ? "项" : "tasks"}
              </span>
            </div>

            {activeDayExams.length > 0 && (
              <div className="p-3 rounded-lg bg-[#FDF0EE] border border-[#f5d6d0] space-y-1">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-[#B42318]">
                  <Target className="w-4 h-4" />
                  <span>{isZh ? "考试日提醒" : "Exam day"}</span>
                </div>
                {activeDayExams.map((ex) => (
                  <p key={ex.id} className="text-[12px] text-[#B42318]">
                    {ex.examName}（{ex.subject}）
                  </p>
                ))}
              </div>
            )}

            {activeDayTasks.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#6b6660] mx-auto" />
                <p className="text-[12px] text-[#6b6660]">
                  {isZh ? "该日期没有排定的复习任务" : "No tasks scheduled for this day"}
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {activeDayTasks.map(({ task, plan }) => {
                  const isCompleted = task.status === "completed";

                  return (
                    <div
                      key={`${plan.id}-${task.id}`}
                      className={`p-2.5 rounded-lg border transition-all space-y-2 ${
                        /* 已完成已经有三个信号：绿勾、划线、次墨色。整块再压 75% 透明度是第四个，
                           而它会把行里的 11px 灰字带到 2.9:1，等于把信息删掉了（清单 UI-03）。 */
                        isCompleted
                          ? "bg-[#faf9f6] border-[#eae7e1]"
                          : "bg-white border-[#eae7e1] hover:border-[#ddd8d0]"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => onToggleTaskStatus(plan.id, task.id)}
                          className="mt-0.5 transition-colors shrink-0 cursor-pointer"
                          title={isCompleted ? (isZh ? "标记为未完成" : "Mark incomplete") : (isZh ? "标记为完成" : "Mark complete")}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-[#3F6B4F]" />
                          ) : (
                            <Circle className="w-4 h-4 text-[#6b6660] hover:text-[#1c1b1a]" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#f1efe9] px-2 py-0.5 text-[11px] font-medium text-[#6b6660] truncate max-w-[140px]">
                              {/* 点名科目就用页面图标，和侧栏 / 总览 / 页头一致；日历格里的色点留给任务色标。 */}
                              <PageIconGlyph plan={plan} className="text-[11px]" />
                              <span className="truncate">{plan.examName}</span>
                            </span>
                            <span className="text-[11px] text-[#6b6660] flex items-center gap-0.5 tabular-nums">
                              <Clock className="w-2.5 h-2.5" />
                              <span>{task.durationMinutes}{isZh ? "分钟" : "m"}</span>
                            </span>
                          </div>

                          <p
                            className={`text-[13px] font-medium leading-snug ${
                              isCompleted ? "line-through text-[#6b6660]" : "text-[#1c1b1a]"
                            }`}
                          >
                            {task.title}
                          </p>

                          {task.topicTitle && (
                            <p className="text-[11px] text-[#6b6660] truncate">
                              {task.topicTitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-end pt-1.5 border-t border-[#f0ede8]">
                        <button
                          onClick={() => onStartFocusTimer(task, plan.id)}
                          className="ui-btn ui-btn-primary px-2.5 py-1 text-[11px] flex items-center gap-1"
                        >
                          <Play className="w-3 h-3" />
                          <span>{isZh ? "专注" : "Focus"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Daily mood & note pad — sits below the task list */}
            <div className="pt-3 border-t border-[#f0ede8]">
              <DailyMoodMemoPad
                dateStr={activeDayDate}
                language={language}
                onMemoUpdated={refreshMemos}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}