import React, { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Clock,
  GraduationCap,
  Layers,
  Plus,
  Sun,
  TrendingUp,
} from "lucide-react";
import { AppTab, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { CourseAccordionGallery } from "./CourseAccordionGallery";
import { parseLocalDate, toLocalDateString } from "../lib/date";

interface MasterDashboardProps {
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNavigateToTab: (tab: AppTab, planId?: string) => void;
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onAddNewSubject: () => void;
}

export function MasterDashboard({
  plans,
  activePlan,
  onSelectPlan,
  onNavigateToTab,
  onDeletePlan,
  onRequestDeletePlan,
  onAddNewSubject,
}: MasterDashboardProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  const todayStr = useMemo(() => toLocalDateString(), []);

  const getDaysRemaining = (examDateStr?: string) => {
    if (!examDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const examDate = parseLocalDate(examDateStr);
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const workspaceMetrics = useMemo(() => {
    const totalSubjects = plans.length;
    let totalTasks = 0;
    let completedTasks = 0;

    plans.forEach((p) => {
      totalTasks += p.tasks.length;
      completedTasks += p.tasks.filter((t) => t.status === "completed").length;
    });

    const globalProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const sortedByDate = [...plans]
      .filter((p) => p.examDate)
      .sort((a, b) => (a.examDate || "").localeCompare(b.examDate || ""));
    const nearestPlan = sortedByDate[0] || null;
    const nearestDays = nearestPlan ? getDaysRemaining(nearestPlan.examDate) : null;

    let todayTotal = 0;
    let todayCompleted = 0;
    plans.forEach((p) => {
      const todayPlanTasks = p.tasks.filter((t) => t.date === todayStr);
      todayTotal += todayPlanTasks.length;
      todayCompleted += todayPlanTasks.filter((t) => t.status === "completed").length;
    });

    return {
      totalSubjects,
      totalTasks,
      completedTasks,
      globalProgress,
      nearestPlan,
      nearestDays,
      todayTotal,
      todayCompleted,
    };
  }, [plans, todayStr]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8 animate-fadeIn text-[#111111]">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-3 border-b border-[#111111]">
          <div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#666666]">
              WORKSPACE // {isZh ? "科目" : "SUBJECTS"}
            </div>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5">
              <GraduationCap className="w-7 h-7" />
              <span>{isZh ? "科目看板" : "Subjects"}</span>
            </h1>
            <p className="mt-1 text-[13px] text-[#555555] leading-relaxed">
              {isZh
                ? "查看各科考试倒计时与整体进度，每日执行在「今日」完成。"
                : "Track exam countdowns and progress. Daily execution lives in Today."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateToTab("today")}
              className="inline-flex items-center gap-2 px-3 min-h-10 border border-[#111111] bg-white text-[13px] font-semibold hover:bg-[#f2f0ea] cursor-pointer"
            >
              <Sun className="w-4 h-4" />
              {isZh ? "回到今日" : "TODAY"}
            </button>
            <button
              onClick={onAddNewSubject}
              className="inline-flex items-center gap-2 px-3 min-h-10 bg-[#111111] text-white text-[13px] font-bold hover:bg-[#333333] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {isZh ? "新建科目" : "NEW SUBJECT"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
          <div className="bg-[#FCD33B] border border-[#111111] p-4 flex flex-col justify-between gap-3 shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>[ {isZh ? "备考科目" : "COURSES"} ]</span>
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="font-mono text-3xl font-bold tracking-tight">{workspaceMetrics.totalSubjects}</div>
          </div>

          <div className="bg-[#D8D8D8] border border-[#111111] p-4 flex flex-col justify-between gap-3 shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>[ {isZh ? "最近考试" : "NEAREST EXAM"} ]</span>
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-mono text-3xl font-bold tracking-tight">
                {workspaceMetrics.nearestDays !== null
                  ? workspaceMetrics.nearestDays <= 0
                    ? isZh
                      ? "今天"
                      : "TODAY"
                    : `D-${workspaceMetrics.nearestDays}`
                  : "--"}
              </div>
              {workspaceMetrics.nearestPlan && (
                <div className="mt-1 truncate text-[11px] text-[#444444]">
                  {workspaceMetrics.nearestPlan.examName}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#B5B5B5] border border-[#111111] p-4 flex flex-col justify-between gap-3 shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider">
              <span>[ {isZh ? "今日进度" : "TODAY"} ]</span>
              <CheckSquare className="w-4 h-4" />
            </div>
            <div className="font-mono text-3xl font-bold tracking-tight">
              {workspaceMetrics.todayCompleted}
              <span className="text-lg font-semibold"> / {workspaceMetrics.todayTotal}</span>
            </div>
          </div>

          <div className="bg-[#282828] border border-[#111111] p-4 flex flex-col justify-between gap-3 text-white shadow-xs transition-transform hover:-translate-y-0.5">
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-wider text-[#D8D8D8]">
              <span>[ {isZh ? "总进度" : "PROGRESS"} ]</span>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="font-mono text-3xl font-bold tracking-tight">{workspaceMetrics.globalProgress}%</div>
              <div className="mt-1.5 h-2 w-full overflow-hidden border border-white/30 bg-black/40">
                <div
                  className="h-full bg-[#FCD33B] transition-all duration-500"
                  style={{ width: `${workspaceMetrics.globalProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="border border-[#111111] bg-[#282828] text-white p-5 sm:p-6 shadow-[4px_4px_0px_#111111] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#FCD33B]">
            <Sun className="w-4 h-4" />
            [ {isZh ? "今日执行" : "TODAY"} ]
          </div>
          <h2 className="text-xl font-bold tracking-tight">
            {isZh ? "把今天要做的，集中在一个页面" : "One page for today's work"}
          </h2>
          <p className="text-[13px] leading-relaxed text-[#D6D3CA]">
            {isZh
              ? `今日 ${workspaceMetrics.todayCompleted} / ${workspaceMetrics.todayTotal} 项已完成。查看下一项、记录笔记，或在日终统一收尾。`
              : `${workspaceMetrics.todayCompleted} / ${workspaceMetrics.todayTotal} tasks done today. See what's next, take notes, or wrap up at day's end.`}
          </p>
        </div>
        <button
          onClick={() => onNavigateToTab("today")}
          className="inline-flex items-center justify-center gap-2 px-4 min-h-11 shrink-0 bg-[#FCD33B] text-[#111111] text-[13px] font-bold hover:bg-[#e9c331] cursor-pointer"
        >
          {isZh ? "打开今日" : "OPEN TODAY"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#111111]" />
            <h2 className="text-base font-bold text-[#111111]">{isZh ? "备考科目" : "COURSES"}</h2>
          </div>
          <span className="font-mono text-[10px] font-bold text-[#666666]">[{plans.length}]</span>
        </div>

        <CourseAccordionGallery
          plans={plans}
          activePlan={activePlan}
          onSelectPlan={onSelectPlan}
          onNavigateToTab={onNavigateToTab}
          onDeletePlan={onDeletePlan}
          onRequestDeletePlan={onRequestDeletePlan}
          onAddNewSubject={onAddNewSubject}
          language={language}
          todayStr={todayStr}
        />
      </section>
    </div>
  );
}
