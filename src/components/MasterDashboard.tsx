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
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="ui-page-title">{isZh ? "科目" : "Subjects"}</h1>
            {/* 计数只在这里数一遍。原来页头、这条读数、下面的段头各有一份 plans.length，
                第三份还起名叫「备考科目」——和 h1 是同一件事的两种叫法。 */}
            {plans.length > 0 && (
              <span className="ui-chip tabular-nums">{plans.length}</span>
            )}
          </div>

          <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary shrink-0">
            <Plus className="w-4 h-4" />
            {isZh ? "新建科目" : "New subject"}
          </button>
        </div>

        {/* 三个数排成一排读数格：标签在上、数字在下，格与格之间只留空白（10 的间距），
            既不装盒子（带边框的白卡把附属说明抬成了「一块内容」），也不拼成一句话——
            散文那版要按顺序读完才知道哪个数属于哪件事，横排格子扫一眼就拿到三个数。
            数字是这条的落点：标签 13 灰、数字 20 加粗，见 index.css 的 ui-metric-*。
            没值的格整格不写，不摆「—」也不报 0/0——那等于说这里有一个数，而这个数不存在。 */}
        {plans.length > 0 && (
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
            <div className="min-w-0">
              <p className="ui-metric-label">{isZh ? "今日" : "Today"}</p>
              <p className="ui-metric-value">
                {workspaceMetrics.todayTotal === 0
                  ? isZh
                    ? "无"
                    : "None"
                  : `${workspaceMetrics.todayCompleted}/${workspaceMetrics.todayTotal}`}
              </p>
            </div>

            {workspaceMetrics.nearestDays !== null && (
              <div className="min-w-0">
                <p className="ui-metric-label">{isZh ? "最近考试" : "Next exam"}</p>
                <p className="ui-metric-value">
                  {workspaceMetrics.nearestDays}
                  {/* 科目名是词不是数，跟在倒计时后面走 13 medium，
                      让 D-42 成为这一格的落点；长名字截断（title 给全名），不把整排挤下去。 */}
                  <span
                    className="ui-row-title ml-2 inline-block max-w-[220px] truncate align-baseline"
                    title={workspaceMetrics.nearestPlan?.subject || workspaceMetrics.nearestPlan?.examName}
                  >
                    {workspaceMetrics.nearestPlan?.subject || workspaceMetrics.nearestPlan?.examName}
                  </span>
                </p>
              </div>
            )}

            {!workspaceMetrics.awaitingSchedule && (
              <div className="min-w-0">
                <p className="ui-metric-label">{isZh ? "总进度" : "Overall"}</p>
                <p className="ui-metric-value">
                  {workspaceMetrics.globalProgress}%
                  {/* 完成度是个比例，条比裸数字一眼读得出来（GitHub Pulse 的口径），
                      所以它跟在数字后面，而不是再开一格读数。 */}
                  <span
                    aria-hidden="true"
                    className="ml-2.5 inline-block h-1.5 w-16 overflow-hidden rounded-full bg-[#e5e2dc] align-middle"
                  >
                    <span
                      className="block h-full rounded-full bg-[#1c1b1a]"
                      style={{ width: `${workspaceMetrics.globalProgress}%` }}
                    />
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
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