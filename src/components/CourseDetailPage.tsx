import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  TrendingUp,
  BookOpen,
  X,
  Sparkles
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { FlipCountdown } from "./FlipCountdown";
import { DailyTodoList } from "./DailyTodoList";
import { RealTimeManager } from "./RealTimeManager";
import { CourseKnowledgeHub } from "./CourseKnowledgeHub";
import { getPaletteByString } from "../lib/themePalettes";

interface CourseDetailPageProps {
  plan: ExamStudyPlan;
  plans: ExamStudyPlan[];
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onDeletePlan: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onNavigateToTab: (tab: any, planId?: string) => void;
  initialDrawer?: "progress" | "syllabus" | null;
}

export function CourseDetailPage({
  plan,
  plans,
  onUpdatePlan,
  onDeletePlan,
  onRequestDeletePlan,
  onNavigateToTab,
  initialDrawer = null,
}: CourseDetailPageProps) {
  const { t, language } = useI18n();

  // Drawer state: null, 'progress', or 'syllabus'
  const [activeDrawer, setActiveDrawer] = useState<"progress" | "syllabus" | null>(initialDrawer);
  const [isHoveringRightZone, setIsHoveringRightZone] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [searchQuery, setSearchQuery] = useState("");

  // Sync drawer state if initialDrawer changes
  useEffect(() => {
    if (initialDrawer) {
      setActiveDrawer(initialDrawer);
    }
  }, [initialDrawer]);

  // Exam Countdown calculation
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!plan?.examDate) return;
    const calculateCountdown = () => {
      const targetStr = `${plan.examDate}T${plan.examTime || "09:00"}:00`;
      const target = new Date(targetStr).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff > 0) {
        setCountdown({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        });
      } else {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [plan?.examDate, plan?.examTime]);

  const palette = useMemo(() => {
    return getPaletteByString(plan.id || plan.examName);
  }, [plan.id, plan.examName]);

  const completedCount = useMemo(() => {
    return plan.tasks.filter((t) => t.status === "completed").length;
  }, [plan.tasks]);

  const totalCount = plan.tasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Escape key closes drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeDrawer) {
        setActiveDrawer(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDrawer]);

  return (
    <div className="relative min-h-screen bg-[#F8F7F4] text-[#111111] font-sans pb-20">
      {/* 1. Header (页头部分: 课程名称、考试时间、倒计时) */}
      <header className="w-full bg-[#FAF9F6] border-b border-[#111111] shadow-2xs">
        {/* Top Breadcrumb Navigation */}
        <div className="h-10 px-4 sm:px-8 flex items-center justify-between border-b border-[#DEDAD1] text-xs font-mono text-[#666666]">
          <div className="flex items-center space-x-2 truncate">
            <button
              onClick={() => onNavigateToTab("dashboard")}
              className="hover:text-[#111111] transition-colors cursor-pointer"
            >
              WORKSPACE
            </button>
            <span>/</span>
            <button
              onClick={() => onNavigateToTab("dashboard")}
              className="hover:text-[#111111] transition-colors cursor-pointer"
            >
              COURSES
            </button>
            <span>/</span>
            <span className="font-bold text-[#111111] truncate flex items-center space-x-1.5 font-sans">
              <span>[{plan.examName}]</span>
            </span>
          </div>
        </div>

        {/* Main Course Header Banner */}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            {/* Left: Course Name & Exam Date */}
            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex items-center space-x-2.5">
                <span
                  className="w-4 h-4 border border-[#111111] shrink-0 inline-block shadow-2xs"
                  style={{ backgroundColor: palette.accentColor }}
                />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#666666] bg-white px-2 py-0.5 border border-[#DEDAD1]">
                  {plan.subject || (language === "zh" ? "学科考试" : "EXAM SUBJECT")}
                </span>
                <span className="text-xs font-mono text-[#888888]">
                  ID: #{plan.id.slice(-6).toUpperCase()}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111] leading-tight font-sans">
                {plan.examName}
              </h1>

              {plan.examDate && (
                <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-[#444444] pt-1">
                  <span className="text-[#666666] uppercase font-bold flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-[#111111]" />
                    <span>{language === "zh" ? "考试时间" : "EXAM DATE"}:</span>
                  </span>
                  <strong className="text-[#111111] bg-white px-2.5 py-1 border border-[#111111] shadow-2xs font-bold text-xs">
                    {plan.examDate} {plan.examTime || "09:00"}
                  </strong>
                  {plan.preferences?.targetScoreOrGrade && (
                    <span className="text-[#666666] border border-[#DEDAD1] bg-white px-2 py-1">
                      {language === "zh" ? "目标" : "TARGET"}: <b className="text-[#111111]">{plan.preferences.targetScoreOrGrade}</b>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: Real-Time Flip / Digital Countdown */}
            {plan.examDate && (
              <div className="shrink-0 flex flex-col items-start lg:items-end space-y-1">
                <span className="text-[10px] font-mono font-bold text-[#888888] uppercase tracking-widest flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-[#111111]" />
                  <span>{language === "zh" ? "考试倒计时" : "EXAM COUNTDOWN"}</span>
                </span>
                <FlipCountdown
                  days={countdown.days}
                  hours={countdown.hours}
                  minutes={countdown.minutes}
                  seconds={countdown.seconds}
                  language={language}
                />
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Core Main Content: 每日待办 (Daily Todo List with Pin Roadmap) */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
        <DailyTodoList
          plan={plan}
          onUpdatePlan={onUpdatePlan}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          searchQuery={searchQuery}
        />
      </main>

      {/* 3. Right-Side Hover / Floating Side Tabs (鼠标移向右侧才有，否则完全隐藏) */}
      {/* Invisible hover trigger zone along the right screen edge (w-6 to catch hover) */}
      <div
        onMouseEnter={() => setIsHoveringRightZone(true)}
        onMouseLeave={() => setIsHoveringRightZone(false)}
        className="fixed right-0 top-0 bottom-0 w-8 z-30 pointer-events-auto flex flex-col justify-center items-end"
        style={{ pointerEvents: activeDrawer ? "none" : "auto" }}
      >
        <div
          className={`flex flex-col space-y-2.5 transition-all duration-300 transform ${
            isHoveringRightZone
              ? "translate-x-0 opacity-100 pointer-events-auto"
              : "translate-x-full opacity-0 pointer-events-none"
          }`}
        >
          {/* Tab 1: 进度追踪 */}
          <button
            onClick={() => setActiveDrawer("progress")}
            className="group/tab flex items-center bg-[#111111] text-white border-y border-l border-[#111111] px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.3)] rounded-l-lg cursor-pointer hover:bg-[#FCD33B] hover:text-[#111111] transition-all"
            title={language === "zh" ? "打开进度追踪" : "Open Progress Tracker"}
          >
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#FCD33B] group-hover/tab:text-[#111111] shrink-0" />
              <span className="font-bold text-xs tracking-tight font-mono whitespace-nowrap">
                {language === "zh" ? "进度追踪" : "PROGRESS"}
              </span>
            </div>
            <span className="ml-2 px-1.5 py-0.2 bg-white/20 group-hover/tab:bg-[#111111]/20 text-[10px] font-mono rounded font-bold">
              {progressPercent}%
            </span>
          </button>

          {/* Tab 2: 考纲资料 */}
          <button
            onClick={() => setActiveDrawer("syllabus")}
            className="group/tab flex items-center bg-[#FAF9F6] text-[#111111] border-y border-l border-[#111111] px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.2)] rounded-l-lg cursor-pointer hover:bg-[#111111] hover:text-white transition-all"
            title={language === "zh" ? "打开考纲资料" : "Open Syllabus & Materials"}
          >
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#111111] group-hover/tab:text-[#FCD33B] shrink-0" />
              <span className="font-bold text-xs tracking-tight font-mono whitespace-nowrap">
                {language === "zh" ? "考纲资料" : "SYLLABUS"}
              </span>
            </div>
            <span className="ml-2 px-1.5 py-0.2 bg-[#111111]/10 group-hover/tab:bg-white/20 text-[10px] font-mono rounded font-bold">
              {plan.topics?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Slide-Over Drawers (右侧抽屉面板) */}
      {activeDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop Overlay */}
          <div
            onClick={() => setActiveDrawer(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity animate-fadeIn"
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-3xl bg-[#F8F7F4] border-l-2 border-[#111111] shadow-2xl h-full flex flex-col z-10 animate-slideLeft">
            {/* Drawer Top Header */}
            <div className="p-4 bg-[#FAF9F6] border-b border-[#111111] flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-1.5 bg-[#111111] text-white">
                  {activeDrawer === "progress" ? (
                    <TrendingUp className="w-4 h-4 text-[#FCD33B]" />
                  ) : (
                    <BookOpen className="w-4 h-4 text-[#FCD33B]" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#111111] font-sans">
                    {activeDrawer === "progress"
                      ? (language === "zh" ? "进度追踪与智能排期" : "PROGRESS TRACKER & REBALANCER")
                      : (language === "zh" ? "考纲考点与资料库" : "SYLLABUS & KNOWLEDGE HUB")}
                  </h3>
                  <p className="text-[11px] text-[#666666] font-mono">
                    {plan.examName}
                  </p>
                </div>
              </div>

              {/* Drawer Switcher Tabs & Close Button */}
              <div className="flex items-center space-x-2 font-mono">
                <button
                  onClick={() => setActiveDrawer(activeDrawer === "progress" ? "syllabus" : "progress")}
                  className="px-2.5 py-1 text-xs border border-[#111111] bg-white hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                >
                  {activeDrawer === "progress"
                    ? (language === "zh" ? "切换至考纲资料 →" : "SWITCH TO SYLLABUS →")
                    : (language === "zh" ? "← 切换至进度追踪" : "← SWITCH TO PROGRESS")}
                </button>
                <button
                  onClick={() => setActiveDrawer(null)}
                  className="p-1.5 border border-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
                  title="Close Drawer (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {activeDrawer === "progress" ? (
                <div className="space-y-6">
                  <RealTimeManager
                    plan={plan}
                    plans={plans}
                    onUpdatePlan={onUpdatePlan}
                    onNavigateToTab={(tab) => {
                      if (tab === "todo") {
                        setActiveDrawer(null);
                      } else {
                        onNavigateToTab(tab);
                      }
                    }}
                    isRebalanceModalOpen={false}
                    onCloseRebalanceModal={() => {}}
                  />
                </div>
              ) : (
                <div className="space-y-6">
                  <CourseKnowledgeHub
                    plan={plan}
                    examName={plan.examName}
                    onExamNameChange={(name) => onUpdatePlan({ ...plan, examName: name })}
                    subject={plan.subject}
                    onSubjectChange={(subj) => onUpdatePlan({ ...plan, subject: subj })}
                    syllabusContent=""
                    onSyllabusContentChange={() => {}}
                    syllabusDocName=""
                    onSyllabusDocNameChange={() => {}}
                    topics={plan.topics || []}
                    onTopicsChange={(topics) => onUpdatePlan({ ...plan, topics })}
                    materialsSummary={plan.materialsSummary || ""}
                    onMaterialsSummaryChange={(summary) => onUpdatePlan({ ...plan, materialsSummary: summary })}
                    onUpdatePlan={onUpdatePlan}
                    onDeleteCourse={() => onDeletePlan(plan.id)}
                    onRequestDeleteCourse={(p) => onRequestDeletePlan && onRequestDeletePlan(p || plan)}
                    onProceedToPlanConfig={() => {}}
                    onNavigateToTab={(tab) => {
                      if (tab === "todo") {
                        setActiveDrawer(null);
                      } else {
                        onNavigateToTab(tab as any);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
