import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import { AppTab, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { CourseAccordionGallery } from "./CourseAccordionGallery";
import { countdownDnLabel, examCountdown, toLocalDateString } from "../lib/date";

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

  const getDaysRemaining = (examDateStr?: string, examTime?: string) => {
    const countdown = examCountdown(examDateStr, examTime);
    return countdown ? countdownDnLabel(countdown, isZh) : null;
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
    const nearestDays = nearestPlan ? getDaysRemaining(nearestPlan.examDate, nearestPlan.examTime) : null;

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
      // 一门课没排出任务时，「0%」说的是「还没开始」，不是「一点都没推进」。
      // 口径与 lib/planReadiness 一致：待生成的科目不参与百分数。
      awaitingSchedule: plans.length > 0 && totalTasks === 0,
      nearestPlan,
      nearestDays,
      todayTotal,
      todayCompleted,
    };
  }, [plans, todayStr]);

  const nearestDisplay =
    workspaceMetrics.nearestDays !== null
      ? workspaceMetrics.nearestDays
      : "—";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-fadeIn text-[#1c1b1a]">
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <h1 className="ui-page-title min-w-0">{isZh ? "科目" : "Subjects"}</h1>
        <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary shrink-0">
          <Plus className="w-4 h-4" />
          {isZh ? "新建科目" : "New subject"}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[#eae7e1] bg-white px-4 py-3 text-[13px] text-[#6b6660]">
        <span>
          {isZh ? "科目" : "Subjects"} <b className="font-semibold tabular-nums text-[#1c1b1a]">{workspaceMetrics.totalSubjects}</b>
        </span>
        <span>
          {isZh ? "最近考试" : "Nearest"}{" "}
          <b className="font-semibold tabular-nums text-[#1c1b1a]">{nearestDisplay}</b>
          {workspaceMetrics.nearestPlan && (
            <span className="ml-1.5 text-[12px] text-[#6b6660]">{workspaceMetrics.nearestPlan.examName}</span>
          )}
        </span>
        <span>
          {isZh ? "今日" : "Today"}{" "}
          <b className="font-semibold tabular-nums text-[#1c1b1a]">
            {workspaceMetrics.todayCompleted}/{workspaceMetrics.todayTotal}
          </b>
        </span>
        <span className="ml-auto">
          {isZh ? "总进度" : "Progress"}{" "}
          <b className="font-semibold tabular-nums text-[#1c1b1a]">
            {workspaceMetrics.awaitingSchedule ? "—" : `${workspaceMetrics.globalProgress}%`}
          </b>
        </span>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2.5">
          <h2 className="ui-section-title">{isZh ? "备考科目" : "Your subjects"}</h2>
          <span className="ui-chip tabular-nums">{plans.length}</span>
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