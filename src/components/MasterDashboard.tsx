import React, { useMemo } from "react";
import {
  BookOpen,
  CheckSquare,
  Clock,
  Plus,
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
      ? workspaceMetrics.nearestDays <= 0
        ? isZh
          ? "今天"
          : "Today"
        : `D-${workspaceMetrics.nearestDays}`
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="ui-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] ui-muted">{isZh ? "备考科目" : "Subjects"}</span>
            <BookOpen className="w-4 h-4 ui-subtle" />
          </div>
          <div className="mt-2.5 text-3xl font-semibold tabular-nums tracking-tight">
            {workspaceMetrics.totalSubjects}
          </div>
        </div>

        <div className="ui-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] ui-muted">{isZh ? "最近考试" : "Nearest exam"}</span>
            <Clock className="w-4 h-4 ui-subtle" />
          </div>
          <div className="mt-2.5 text-3xl font-semibold tabular-nums tracking-tight">{nearestDisplay}</div>
          {workspaceMetrics.nearestPlan && (
            <div className="mt-1 truncate text-[12px] ui-subtle">
              {workspaceMetrics.nearestPlan.examName}
            </div>
          )}
        </div>

        <div className="ui-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] ui-muted">{isZh ? "今日进度" : "Today"}</span>
            <CheckSquare className="w-4 h-4 ui-subtle" />
          </div>
          <div className="mt-2.5 text-3xl font-semibold tabular-nums tracking-tight">
            {workspaceMetrics.todayCompleted}
            <span className="text-xl ui-subtle font-medium"> / {workspaceMetrics.todayTotal}</span>
          </div>
        </div>

        <div className="ui-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] ui-muted">{isZh ? "总进度" : "Progress"}</span>
            <TrendingUp className="w-4 h-4 ui-subtle" />
          </div>
          <div className="mt-2.5 text-3xl font-semibold tabular-nums tracking-tight">
            {workspaceMetrics.awaitingSchedule ? "—" : `${workspaceMetrics.globalProgress}%`}
          </div>
          {workspaceMetrics.awaitingSchedule ? (
            /* 全是「先建好、还没生成」的科目：0% 会被读成落后，这里只说它还没排任务。 */
            <div className="mt-1.5 text-[12px] ui-muted">
              {isZh ? "还没有排出的任务" : "Nothing scheduled yet"}
            </div>
          ) : (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[#f1efe9]">
              <div
                className="h-full rounded-full bg-[#1c1b1a] transition-all duration-500"
                style={{ width: `${workspaceMetrics.globalProgress}%` }}
              />
            </div>
          )}
        </div>
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