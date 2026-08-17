import React, { useState } from "react";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  ExternalLink, 
  Clock, 
  Sparkles, 
  Flag, 
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight,
  Plus,
  Target,
  Compass
} from "lucide-react";
import { ExamStudyPlan, StudyTask } from "../types";
import { downloadICSFile } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";

interface CalendarViewProps {
  plan: ExamStudyPlan;
  onSelectDate: (dateStr: string) => void;
  onGoToDailyView: (dateStr: string) => void;
}

export function CalendarView({
  plan,
  onSelectDate,
  onGoToDailyView,
}: CalendarViewProps) {
  const { t, language } = useI18n();
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const handleJumpToCurrent = () => {
    const today = new Date();
    setCurrentMonthDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  // Group tasks by date
  const tasksByDate = React.useMemo(() => {
    const map: Record<string, StudyTask[]> = {};
    (plan.tasks || []).forEach((task) => {
      if (selectedCategory !== "all" && task.category !== selectedCategory) return;
      if (!map[task.date]) {
        map[task.date] = [];
      }
      map[task.date].push(task);
    });
    return map;
  }, [plan.tasks, selectedCategory]);

  // Calendar Grid Days Calculation
  const calendarDays = React.useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isExamDay: boolean;
      tasks: StudyTask[];
    }> = [];

    const pad = (n: number) => n.toString().padStart(2, "0");
    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevM = month === 0 ? 12 : month;
      const prevY = month === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${pad(prevM)}-${pad(dNum)}`;
      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isExamDay: dateStr === plan.examDate,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(i)}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isExamDay: dateStr === plan.examDate,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    // Next month padding to fill 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextM = month + 2 > 12 ? 1 : month + 2;
      const nextY = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${nextY}-${pad(nextM)}-${pad(i)}`;
      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isExamDay: dateStr === plan.examDate,
        tasks: tasksByDate[dateStr] || [],
      });
    }

    return days;
  }, [year, month, tasksByDate, plan.examDate]);

  const monthName = currentMonthDate.toLocaleDateString(language === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    year: "numeric",
  });

  const dayHeaders = language === "zh" 
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#e9e9e7]">
        {/* Month Navigation */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
              title={t("previousMonth")}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={handleJumpToCurrent}
              className="px-2.5 py-1 text-xs font-semibold rounded hover:bg-[#efefed] text-[#37352f] transition-colors border border-[#e9e9e7]"
            >
              {t("today")}
            </button>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
              title={t("nextMonth")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base font-bold text-[#37352f] min-w-[150px] pl-2">
            {monthName}
          </h2>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category filter */}
          <div className="flex items-center space-x-1 text-xs text-[#787774] bg-[#f7f6f3] border border-[#e9e9e7] rounded-md px-2 py-1">
            <Filter className="w-3 h-3" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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

          <button
            onClick={() => downloadICSFile(plan)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#edf3ec] hover:bg-[#d5e5d3] text-[#448361] border border-[#d5e5d3] rounded-md text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t("exportICS")}</span>
          </button>

          <a
            href="https://calendar.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2.5 py-1 bg-[#efefed] hover:bg-[#e3e2e0] text-[#37352f] border border-[#e9e9e7] rounded-md text-xs font-medium transition-colors"
          >
            <span>Google Calendar</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>

      {/* Notion Calendar Database View Grid */}
      <div className="border border-[#e9e9e7] rounded-lg overflow-hidden bg-white shadow-xs">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-[#f7f6f3] border-b border-[#e9e9e7] text-center py-2 text-xs font-medium text-[#787774]">
          {dayHeaders.map((dh, i) => (
            <span key={i}>{dh}</span>
          ))}
        </div>

        {/* Day Grid Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-[#e9e9e7]">
          {calendarDays.map((day, idx) => {
            const hasTasks = day.tasks.length > 0;
            const completedCount = day.tasks.filter((t) => t.status === "completed").length;
            const hasMock = day.tasks.some((t) => t.category === "mock_exam");

            return (
              <div
                key={idx}
                onClick={() => {
                  onSelectDate(day.dateStr);
                  onGoToDailyView(day.dateStr);
                }}
                className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors cursor-pointer relative group ${
                  day.isCurrentMonth
                    ? "bg-white hover:bg-[#fbfbfa]"
                    : "bg-[#f7f6f3]/50 text-[#9b9a97] hover:bg-[#f7f6f3]"
                } ${day.isExamDay ? "bg-[#fdebec]/40" : ""} ${
                  day.isToday ? "bg-[#e7f3f8]/20" : ""
                }`}
              >
                {/* Cell Header: Day Number & Badges */}
                <div className="flex items-center justify-between">
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded text-xs font-semibold ${
                      day.isToday
                        ? "bg-[#d44c47] text-white font-bold"
                        : day.isExamDay
                        ? "bg-[#d9730d] text-white font-bold"
                        : day.isCurrentMonth
                        ? "text-[#37352f]"
                        : "text-[#9b9a97]"
                    }`}
                  >
                    {day.dayNumber}
                  </span>

                  {day.isExamDay && (
                    <span className="notion-tag-red px-1.5 py-0.2 rounded text-[9px] font-bold uppercase flex items-center space-x-1">
                      <Target className="w-2.5 h-2.5 shrink-0" />
                      <span>{language === "zh" ? "考试日" : "Exam"}</span>
                    </span>
                  )}

                  {!day.isExamDay && hasMock && (
                    <span className="notion-tag-purple px-1.5 py-0.2 rounded text-[9px] font-semibold">
                      {language === "zh" ? "模拟" : "Mock"}
                    </span>
                  )}
                </div>

                {/* Task pills inside cell */}
                <div className="flex-1 my-1.5 space-y-1 overflow-hidden">
                  {day.tasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={`px-1.5 py-0.5 rounded text-[10px] truncate font-medium transition-colors ${
                        task.status === "completed"
                          ? "notion-tag-green opacity-70 line-through"
                          : task.category === "mock_exam"
                          ? "notion-tag-red"
                          : "notion-tag-blue"
                      }`}
                    >
                      {task.title}
                    </div>
                  ))}

                  {day.tasks.length > 2 && (
                    <div className="text-[10px] text-[#787774] font-medium pl-1">
                      +{day.tasks.length - 2} {language === "zh" ? "项" : "more"}
                    </div>
                  )}
                </div>

                {/* Cell Footer Metric */}
                {hasTasks && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#e9e9e7] text-[10px] text-[#787774]">
                    <span>{completedCount}/{day.tasks.length}</span>
                    <span className="font-mono text-[#5a5a57]">
                      {day.tasks.reduce((a, b) => a + b.durationMinutes, 0)}m
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Notion Callout: Study Plan Phases & Milestones */}
      {plan.phases && plan.phases.length > 0 && (
        <div className="notion-callout p-5 space-y-3">
          <div className="flex items-center space-x-2">
            <Compass className="w-4 h-4 text-[#787774]" />
            <h3 className="font-semibold text-sm text-[#37352f]">
              {language === "zh" ? "备考阶段规划与关键里程碑" : "Master Study Phases & Milestones"}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plan.phases.map((phase, i) => (
              <div
                key={phase.id || i}
                className="bg-white border border-[#e9e9e7] rounded-lg p-3.5 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="notion-tag-purple px-1.5 py-0.2 rounded text-[10px] font-semibold">
                    {language === "zh" ? `第 ${i + 1} 阶段` : `Phase ${i + 1}`}
                  </span>
                  <span className="text-[11px] text-[#787774]">
                    {phase.startDate} → {phase.endDate}
                  </span>
                </div>
                <h4 className="font-semibold text-xs text-[#37352f]">{phase.name}</h4>
                <p className="text-[11px] text-[#787774] leading-relaxed">{phase.description}</p>
                <div className="pt-1">
                  <span className="text-[10px] text-[#5a5a57] font-medium block">
                    {language === "zh" ? "阶段重点" : "Focus"}: {phase.focus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
