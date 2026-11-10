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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-10 space-y-8 animate-fadeIn text-[#1c1b1a]">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="ui-page-title">{isZh ? "科目" : "Subjects"}</h1>
            {/* 计数只在这里数一遍。原来页头、这条读数、下面的段头各有一份 plans.length，
                第三份还起名叫「备考科目」——和 h1 是同一件事的两种叫法。 */}
            {plans.length > 0 && (
              <span className="ui-chip tabular-nums">{plans.length}</span>
            )}
          </div>

          {/* 元信息不该住盒子：一条带边框的白卡把四个短读数框成了「一块内容」，
              而它只是页头的附属说明。改成与「今日」页同一口径的一行裸字，
              项与项之间用一个中点断开（独立成元素的「·」被 design-scale 禁掉，句子内的连接符才合法）。
              没值的项直接不写，不摆「—」占位——那等于告诉用户这里有一个数，而这个数不存在。 */}
          {plans.length > 0 && (
            <p className="ui-row-meta mt-2 tabular-nums">
              {workspaceMetrics.todayTotal === 0
                ? isZh
                  ? "今日无任务"
                  : "No tasks today"
                : (
                  <>
                    {isZh ? "今日" : "Today"}{" "}
                    <span className="ui-row-value">
                      {workspaceMetrics.todayCompleted}/{workspaceMetrics.todayTotal}
                    </span>
                  </>
                )}
              {workspaceMetrics.nearestDays !== null && (
                <>
                  {" · "}
                  {isZh ? "最近考试" : "Next exam"}{" "}
                  {workspaceMetrics.nearestPlan?.subject || workspaceMetrics.nearestPlan?.examName}{" "}
                  <span className="ui-row-value">{workspaceMetrics.nearestDays}</span>
                </>
              )}
              {!workspaceMetrics.awaitingSchedule && (
                <>
                  {" · "}
                  {isZh ? "总进度" : "Overall"}{" "}
                  <span className="ui-row-value">{workspaceMetrics.globalProgress}%</span>
                  {/* 完成度是个比例，条比裸数字一眼读得出来（GitHub Pulse 的口径），
                      所以它跟在数字后面，而不是再开一处读数。 */}
                  <span
                    aria-hidden="true"
                    className="ml-1.5 inline-block h-1 w-10 overflow-hidden rounded-full bg-[#f1efe9] align-middle"
                  >
                    <span
                      className="block h-full rounded-full bg-[#1c1b1a]"
                      style={{ width: `${workspaceMetrics.globalProgress}%` }}
                    />
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary shrink-0">
          <Plus className="w-4 h-4" />
          {isZh ? "新建科目" : "New subject"}
        </button>
      </header>

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
    </div>
  );
}