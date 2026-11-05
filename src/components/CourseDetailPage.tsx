import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Hourglass,
  Layers,
  Pencil,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ExamStudyPlan, PracticeEvent } from "../types";
import type { FocusTarget } from "../lib/inbound";
import { useI18n } from "../lib/i18n";
import { toLocalDateString } from "../lib/date";
import { SectionBlock } from "./SectionBlock";
import { PageIconGlyph } from "./PageIconGlyph";
import { PageCover } from "./PageCover";
import { hasCover } from "../lib/pageCover";
import { EditSubjectModal, type ExamDraft } from "./EditSubjectModal";
import { PhaseRoadmapSection } from "./PhaseRoadmapSection";
import { TopicMasterySection } from "./TopicMasterySection";
import { RebalanceSection } from "./RebalanceSection";
import { CourseKnowledgeHub } from "./CourseKnowledgeHub";
import { PracticeReceiptCard } from "./PracticeReceiptCard";

interface CourseDetailPageProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onNavigateToTab: (tab: "today" | "dashboard" | "master_calendar" | "course" | "settings") => void;
  /** 回程联动定位到的考点；只有属于当前计划时才展开知识区并滚动 */
  focusTarget?: FocusTarget | null;
  /** 同一考点重复点「定位」时用它重新触发滚动 */
  focusNonce?: number;
  /** 本机已落盘的练习回执（仅当前计划） */
  practiceEvents?: PracticeEvent[];
  onLocateReceipt?: (event: PracticeEvent) => void;
  onDismissReceipt?: (attemptId: string) => void;
}

export function CourseDetailPage({
  plan,
  onUpdatePlan,
  onRequestDeletePlan,
  onNavigateToTab,
  focusTarget = null,
  focusNonce = 0,
  practiceEvents = [],
  onLocateReceipt,
  onDismissReceipt,
}: CourseDetailPageProps) {
  const { language, t } = useI18n();
  const isZh = language === "zh";

  // Secondary reference detail is disclosed on demand; progress stays primary.
  const [showKnowledge, setShowKnowledge] = useState(false);

  // 考试信息是低频动作，收进悬浮窗，页头只留身份与事实。
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const activeFocus = focusTarget && focusTarget.planId === plan.id ? focusTarget : null;

  // 知识区默认收起，只切到本标签页并不会露出考点树：回程定位必须显式展开
  useEffect(() => {
    if (activeFocus) setShowKnowledge(true);
  }, [activeFocus?.planId, activeFocus?.topicId, activeFocus?.subtopicTitle, focusNonce]);

  // 切换科目时收起上一份草稿与提示，页头事实跟着当前计划
  useEffect(() => {
    setEditOpen(false);
    setScheduleNotice(null);
  }, [plan.id]);

  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    if (!plan?.examDate) return;
    const calculateCountdown = () => {
      const [y, m, d] = plan.examDate.split("-").map(Number);
      const [h, min] = (plan.examTime || "09:00").split(":").map(Number);
      const target = new Date(y, m - 1, d, h, min, 0).getTime();
      const diff = target - new Date().getTime();

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

  // 倒计时收进页头属性行：一行文字，不再挂一块黑色翻页钟。
  const countdownText = useMemo(() => {
    if (!plan.examDate) return isZh ? "未设定" : "Not set";
    const pad = (value: number) => String(value).padStart(2, "0");
    const total = countdown.days * 86400 + countdown.hours * 3600 + countdown.minutes * 60 + countdown.seconds;
    if (total <= 0) return isZh ? "已到期" : "Passed";
    const clock = `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`;
    return isZh ? `${countdown.days} 天 ${clock}` : `${countdown.days}d ${clock}`;
  }, [countdown, plan.examDate, isZh]);

  // 日期和时间合成一条属性：属性行按「事实」分行，不按录入字段分行。
  const examWhenText = useMemo(() => {
    if (!plan.examDate) return notSet(isZh);
    return `${plan.examDate} ${plan.examTime || "09:00"}`;
  }, [plan.examDate, plan.examTime, isZh]);

  // 有没有封面决定页头怎么排：有就把图标压在带子下沿、编辑挪到右上角，没有就沿用原来的三段。
  const pageHasCover = hasCover(plan);

  const stats = useMemo(() => {
    const completedCount = plan.tasks.filter((task) => task.status === "completed").length;
    const totalCount = plan.tasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const totalPlannedMinutes = plan.tasks.reduce((sum, task) => sum + (task.durationMinutes || 0), 0);
    const completedMinutes = plan.tasks
      .filter((task) => task.status === "completed")
      .reduce((sum, task) => sum + (task.actualMinutesSpent || task.durationMinutes || 0), 0);

    return {
      completedCount,
      totalCount,
      progressPercent,
      plannedHours: Math.round((totalPlannedMinutes / 60) * 10) / 10,
      investedHours: Math.round((completedMinutes / 60) * 10) / 10,
      materialsCount: plan.materials?.length || 0,
      topicsCount: plan.topics?.length || 0,
    };
  }, [plan.tasks, plan.materials, plan.topics]);

  const todayStr = useMemo(() => toLocalDateString(), []);

  // 本页只列今天的任务；执行与勾选仍然只有「今日」一处。
  const todayTasks = useMemo(
    () =>
      plan.tasks
        .filter((task) => task.date === todayStr)
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [plan.tasks, todayStr]
  );

  const nextBatch = useMemo(() => {
    const upcoming = plan.tasks
      .filter((task) => task.date > todayStr && task.status !== "completed" && task.status !== "skipped")
      .sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length === 0) return null;
    return { date: upcoming[0].date, count: upcoming.filter((task) => task.date === upcoming[0].date).length };
  }, [plan.tasks, todayStr]);

  const emptyTodayLine = (() => {
    if (stats.totalCount === 0) return isZh ? "这份计划还没有排任务。" : "This plan has no tasks scheduled yet.";
    if (nextBatch) {
      return isZh
        ? `今天没有安排任务，下一批在 ${nextBatch.date}（${nextBatch.count} 项）。`
        : `Nothing today. Next batch is ${nextBatch.date} (${nextBatch.count} tasks).`;
    }
    return isZh ? "今天没有安排任务，后面也没有排任务。" : "Nothing scheduled today or later.";
  })();

  const handleSaveExam = (draft: ExamDraft) => {
    const dateChanged = draft.examDate !== plan.examDate;

    onUpdatePlan({
      ...plan,
      examName: draft.examName,
      subject: draft.subject || plan.subject,
      icon: draft.icon,
      cover: draft.cover,
      examDate: draft.examDate,
      examTime: draft.examTime,
      preferences: {
        ...plan.preferences,
        examName: draft.examName,
        subject: draft.subject || plan.subject,
        examDate: draft.examDate,
        examTime: draft.examTime,
        targetScoreOrGrade: draft.target,
      },
      updatedAt: new Date().toISOString(),
    });

    setEditOpen(false);
    if (dateChanged) {
      const stranded = plan.tasks.filter(
        (task) => task.date > draft.examDate && task.status !== "completed" && task.status !== "skipped"
      ).length;
      setScheduleNotice(
        stranded > 0
          ? isZh
            ? `考试日期已改到 ${draft.examDate}，仍有 ${stranded} 项任务排在它之后，可在下方「计划动态重排」重新平摊。`
            : `Exam moved to ${draft.examDate}, but ${stranded} tasks fall after it. Use Adaptive rebalance below.`
          : isZh
            ? `考试日期已更新为 ${draft.examDate} ${draft.examTime}。`
            : `Exam date updated to ${draft.examDate} ${draft.examTime}.`
      );
    }
  };

  return (
    <div className="relative min-h-screen bg-[#f8f7f4] text-[#1c1b1a] pb-20 animate-fadeIn">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 sm:pt-8">
        <button
          onClick={() => onNavigateToTab("dashboard")}
          className="inline-flex items-center gap-1.5 text-[13px] ui-muted hover:text-[#1c1b1a] transition-colors cursor-pointer mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {isZh ? "科目" : "Subjects"}
        </button>

        <header className="relative">
          {/* Notion 三段：页面图标 → 文档标题 → 属性，上面可以压一条封面带。
              封面只是底，不承载信息也不放内容；科目身份仍然是 planIcon。
              属性一条是「图标+标签+取值」，桌面两行两列、窄屏退成一行一条，
              标签定宽所以取值对齐成列；日期和时间合成一条，因为它们是同一个事实。 */}
          {pageHasCover && <PageCover plan={plan} />}

          {/* 编辑入口全站只有一个：没封面时是图标上方那行常驻小字，
              有封面时按 Notion 挪到封面右上角——同一颗按钮，不另加第二处。 */}
          <div className={pageHasCover ? "absolute right-1.5 top-1.5 z-10" : "mb-1 flex h-6 items-center"}>
            <button
              onClick={() => setEditOpen(true)}
              className={
                pageHasCover
                  ? "ui-btn-text rounded-md bg-white/80 px-2 py-1 shadow-[0_1px_3px_rgba(28,27,26,0.10)] backdrop-blur-sm"
                  : "ui-btn-text -ml-2"
              }
            >
              <Pencil className="w-3.5 h-3.5" />
              {t("edit")}
            </button>
          </div>

          <PageIconGlyph
            plan={plan}
            className={pageHasCover ? "ui-page-icon relative z-10 -mt-12" : "ui-page-icon"}
          />

          <h1 className="ui-doc-title mt-2 break-words">{plan.examName}</h1>

          <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <PropItem
              icon={Layers}
              label={isZh ? "学科" : "Subject"}
              value={plan.subject || notSet(isZh)}
              muted={!plan.subject}
            />
            <PropItem
              icon={CalendarDays}
              label={isZh ? "考试" : "Exam"}
              value={examWhenText}
              muted={!plan.examDate}
            />
            <PropItem
              icon={Target}
              label={isZh ? "目标" : "Target"}
              value={plan.preferences?.targetScoreOrGrade || notSet(isZh)}
              muted={!plan.preferences?.targetScoreOrGrade}
            />
            <PropItem icon={Hourglass} label={isZh ? "距考试" : "Days left"} value={countdownText} />
          </div>

          {scheduleNotice && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#f0e2c0] bg-[#FFF6DD] px-3.5 py-2.5 text-[12px] text-[#8A5A00] animate-fadeIn">
              <span className="leading-relaxed">{scheduleNotice}</span>
              <button
                onClick={() => setScheduleNotice(null)}
                className="shrink-0 font-medium underline underline-offset-2 cursor-pointer"
              >
                {isZh ? "知道了" : "Dismiss"}
              </button>
            </div>
          )}

        </header>

        <EditSubjectModal
          open={editOpen}
          plan={plan}
          onClose={() => setEditOpen(false)}
          onSave={handleSaveExam}
        />
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-8">
        {/* 段落靠左标栏 + 发丝分隔线排布；白卡只留给内容，不再一块块等宽平铺。 */}
        <div className="border-t border-[#eeece6] divide-y divide-[#eeece6]">
          <SectionBlock
            title={isZh ? "今日任务" : "Today"}
            hint={todayStr}
            aside={
              <span className="ui-chip tabular-nums">
                {todayTasks.filter((task) => task.status === "completed").length}/{todayTasks.length}
              </span>
            }
          >
            {todayTasks.length > 0 ? (
              <ul className="ui-card divide-y divide-[#f0ede8] overflow-hidden">
                {todayTasks.map((task) => {
                  const done = task.status === "completed";
                  return (
                    <li key={task.id} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">
                      <span className="mt-[3px] w-[46px] shrink-0 ui-row-value">{task.startTime || "—"}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`ui-row-title ${done ? "text-[#a39e97]" : ""}`}>{task.title}</p>
                        <p className="mt-1 ui-row-meta truncate">
                          {task.topicTitle}
                          {task.durationMinutes ? ` · ${task.durationMinutes} ${isZh ? "分钟" : "min"}` : ""}
                          {done && ` · ${isZh ? "已完成" : "done"}`}
                        </p>
                      </div>
                      {done && <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-[#3F6B4F]" />}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="ui-note">{emptyTodayLine}</p>
            )}

            {/* 两个计量挂在今天下面：进度是这套计划的进度，不再单独占一张大卡。 */}
            <div className="mt-4 ui-card px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:gap-0 gap-4">
              <div className="sm:flex-1 sm:pr-6 sm:border-r sm:border-[#f0ede8] min-w-0">
                <span className="ui-row-meta">{isZh ? "任务进度" : "Task progress"}</span>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="ui-stat-value">{stats.progressPercent}%</span>
                  <span className="ui-row-meta tabular-nums">
                    {stats.completedCount}/{stats.totalCount}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-[#f1efe9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1c1b1a] transition-all duration-300"
                    style={{ width: `${stats.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="sm:flex-1 sm:pl-6 min-w-0">
                <span className="ui-row-meta">{isZh ? "学习投入" : "Time invested"}</span>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="ui-stat-value">{stats.investedHours}</span>
                  <span className="ui-row-meta tabular-nums">
                    / {stats.plannedHours} {isZh ? "小时" : "hrs"}
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-[#f1efe9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#cfc9c0] transition-all duration-300"
                    style={{
                      width: `${
                        stats.plannedHours > 0
                          ? Math.min(100, Math.round((stats.investedHours / stats.plannedHours) * 100))
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <PracticeReceiptCard
              events={practiceEvents}
              onLocate={(event) => onLocateReceipt?.(event)}
              onDismiss={(attemptId) => onDismissReceipt?.(attemptId)}
            />
          </SectionBlock>

          <PhaseRoadmapSection plan={plan} />

          <TopicMasterySection plan={plan} />

          <SectionBlock
            title={isZh ? "课程资料与考点体系" : "Materials & topics"}
            hint={
              <span className="tabular-nums">
                {stats.materialsCount} {isZh ? "份资料" : "files"} · {stats.topicsCount}{" "}
                {isZh ? "个考点" : "topics"}
              </span>
            }
            action={
              <button
                onClick={() => setShowKnowledge((prev) => !prev)}
                aria-expanded={showKnowledge}
                className="inline-flex items-center gap-1 ui-row-meta hover:text-[#1c1b1a] transition-colors cursor-pointer"
              >
                <span className="font-medium">
                  {showKnowledge ? (isZh ? "收起" : "Collapse") : isZh ? "展开" : "Expand"}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#a39e97] transition-transform ${showKnowledge ? "rotate-180" : ""}`}
                />
              </button>
            }
          >
            {showKnowledge ? (
              <div className="ui-card p-4 sm:p-5 animate-fadeIn">
                <CourseKnowledgeHub
                  plan={plan}
                  onUpdatePlan={onUpdatePlan}
                  onRequestDeleteCourse={onRequestDeletePlan}
                  focusUnitId={activeFocus?.topicId ?? null}
                  focusSubtopicTitle={activeFocus?.subtopicTitle ?? ""}
                  focusNonce={focusNonce}
                />
              </div>
            ) : (
              <button
                onClick={() => setShowKnowledge(true)}
                className="w-full ui-card ui-card-hover px-4 sm:px-5 py-4 text-left flex items-center justify-between gap-3 cursor-pointer"
              >
                <span className="ui-note min-w-0 truncate">
                  {isZh ? "考点树与资料归档" : "Topic tree and material archive"}
                </span>
                <span className="ui-row-meta shrink-0">
                  {isZh ? "展开" : "Expand"}
                  <ChevronDown className="w-3.5 h-3.5 inline ml-1" />
                </span>
              </button>
            )}
          </SectionBlock>

          <RebalanceSection plan={plan} onUpdatePlan={onUpdatePlan} />
        </div>
      </main>
    </div>
  );
}

/**
 * 文档页头的一条属性：前导图标（ui-prop-icon，纯标记不可点）+ 定宽浅标签 + 同一档取值。
 * 三者的字号、标签列宽、取值字重都在 ui-prop-* token 里，组件只管内容不管排版。
 */
function PropItem({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon className="ui-prop-icon" aria-hidden="true" />
      <span className="ui-prop-label">{label}</span>
      <span className={muted ? "ui-prop-empty" : "ui-prop-value"}>{value}</span>
    </span>
  );
}

/** 属性还没填时的占位取值，与空状态同一档灰。 */
function notSet(isZh: boolean) {
  return isZh ? "未设定" : "Not set";
}

