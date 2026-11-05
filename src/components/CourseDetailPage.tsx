import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  Target,
} from "lucide-react";
import { ExamStudyPlan, PracticeEvent } from "../types";
import type { FocusTarget } from "../lib/inbound";
import { useI18n } from "../lib/i18n";
import { toLocalDateString } from "../lib/date";
import { FlipCountdown } from "./FlipCountdown";
import { SectionBlock } from "./SectionBlock";
import { PhaseRoadmapSection } from "./PhaseRoadmapSection";
import { TopicMasterySection } from "./TopicMasterySection";
import { RebalanceSection } from "./RebalanceSection";
import { CourseKnowledgeHub } from "./CourseKnowledgeHub";
import { PracticeReceiptCard } from "./PracticeReceiptCard";
import { getPaletteByString } from "../lib/themePalettes";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

interface ExamForm {
  examName: string;
  subject: string;
  examDate: string;
  examTime: string;
  target: string;
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

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ExamForm>(() => toForm(plan));
  const [formError, setFormError] = useState<string | null>(null);
  const [scheduleNotice, setScheduleNotice] = useState<string | null>(null);

  const activeFocus = focusTarget && focusTarget.planId === plan.id ? focusTarget : null;

  // 知识区默认收起，只切到本标签页并不会露出考点树：回程定位必须显式展开
  useEffect(() => {
    if (activeFocus) setShowKnowledge(true);
  }, [activeFocus?.planId, activeFocus?.topicId, activeFocus?.subtopicTitle, focusNonce]);

  // 切换科目时丢掉上一份草稿，编辑表单始终跟着当前计划
  useEffect(() => {
    setEditing(false);
    setFormError(null);
    setScheduleNotice(null);
    setForm(toForm(plan));
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

  const palette = useMemo(() => getPaletteByString(plan.id || plan.examName), [plan.id, plan.examName]);

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

  const handleSaveExam = () => {
    const examDate = form.examDate.trim();
    const examTime = form.examTime.trim() || "09:00";
    if (!form.examName.trim()) {
      setFormError(isZh ? "请填写科目名称。" : "Exam title is required.");
      return;
    }
    if (!DATE_RE.test(examDate)) {
      setFormError(isZh ? "考试日期格式应为 2026-12-20。" : "Exam date must look like 2026-12-20.");
      return;
    }
    if (!TIME_RE.test(examTime)) {
      setFormError(isZh ? "考试时间格式应为 09:00。" : "Exam time must look like 09:00.");
      return;
    }
    if (plan.startDate && examDate < plan.startDate) {
      setFormError(
        isZh
          ? `考试日期不能早于计划开始日期（${plan.startDate}）。`
          : `Exam date cannot be earlier than the plan start date (${plan.startDate}).`
      );
      return;
    }

    const examName = form.examName.trim();
    const subject = form.subject.trim() || plan.subject;
    const target = form.target.trim();
    const dateChanged = examDate !== plan.examDate;

    onUpdatePlan({
      ...plan,
      examName,
      subject,
      examDate,
      examTime,
      preferences: { ...plan.preferences, examName, subject, examDate, examTime, targetScoreOrGrade: target },
      updatedAt: new Date().toISOString(),
    });

    setEditing(false);
    setFormError(null);
    if (dateChanged) {
      const stranded = plan.tasks.filter(
        (task) => task.date > examDate && task.status !== "completed" && task.status !== "skipped"
      ).length;
      setScheduleNotice(
        stranded > 0
          ? isZh
            ? `考试日期已改到 ${examDate}，仍有 ${stranded} 项任务排在它之后，可在下方「计划动态重排」重新平摊。`
            : `Exam moved to ${examDate}, but ${stranded} tasks fall after it. Use Adaptive rebalance below.`
          : isZh
            ? `考试日期已更新为 ${examDate} ${examTime}。`
            : `Exam date updated to ${examDate} ${examTime}.`
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

        <header className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 min-w-0 flex-1">
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: palette.accentColor }}
                aria-hidden="true"
              />
              <span className="ui-chip">{plan.subject || (isZh ? "学科考试" : "Subject")}</span>
            </div>

            <h1 className="ui-page-title leading-tight">{plan.examName}</h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 ui-row-meta pt-0.5">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span className="ui-row-title tabular-nums">
                  {plan.examDate} {plan.examTime || "09:00"}
                </span>
              </span>
              {plan.preferences?.targetScoreOrGrade && (
                <span className="inline-flex items-center gap-1.5">
                  <Target className="w-4 h-4" />
                  <span>
                    {isZh ? "目标" : "Target"}{" "}
                    <b className="ui-row-value">{plan.preferences.targetScoreOrGrade}</b>
                  </span>
                </span>
              )}
              <button
                onClick={() => {
                  setForm(toForm(plan));
                  setFormError(null);
                  setEditing((prev) => !prev);
                }}
                aria-expanded={editing}
                className="inline-flex items-center gap-1 ui-row-meta hover:text-[#1c1b1a] transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="font-medium">{editing ? (isZh ? "收起" : "Close") : t("edit")}</span>
              </button>
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

            {editing && (
              <div className="ui-card p-4 sm:p-5 space-y-4 animate-fadeIn">
                <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                  <label className="block min-w-0">
                    <span className="ui-row-meta">{isZh ? "科目名称" : "Exam title"}</span>
                    <input
                      value={form.examName}
                      onChange={(e) => setForm({ ...form, examName: e.target.value })}
                      className="ui-field mt-1.5"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="ui-row-meta">{isZh ? "学科" : "Subject"}</span>
                    <input
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="ui-field mt-1.5"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="ui-row-meta">{isZh ? "考试日期" : "Exam date"}</span>
                    <input
                      type="date"
                      value={form.examDate}
                      onChange={(e) => setForm({ ...form, examDate: e.target.value })}
                      className="ui-field mt-1.5 tabular-nums"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="ui-row-meta">{isZh ? "考试时间" : "Exam time"}</span>
                    <input
                      type="time"
                      value={form.examTime}
                      onChange={(e) => setForm({ ...form, examTime: e.target.value })}
                      className="ui-field mt-1.5 tabular-nums"
                    />
                  </label>
                  <label className="block min-w-0 sm:col-span-2">
                    <span className="ui-row-meta">{isZh ? "目标分数或等级（可选）" : "Target score or grade (optional)"}</span>
                    <input
                      value={form.target}
                      onChange={(e) => setForm({ ...form, target: e.target.value })}
                      placeholder={isZh ? "例如：90 分 / 优秀" : "e.g. 90 / A"}
                      className="ui-field mt-1.5"
                    />
                  </label>
                </div>

                {formError && <p className="text-[12px] text-[#B42318]">{formError}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={handleSaveExam} className="ui-btn ui-btn-primary px-3.5 py-1.5 text-[12px]">
                    {isZh ? "保存" : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setFormError(null);
                      setForm(toForm(plan));
                    }}
                    className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
                  >
                    {t("cancel")}
                  </button>
                  <span className="ui-row-meta">
                    {isZh ? "只改考试信息，已生成的任务不会被重写。" : "Only exam info changes; tasks stay as scheduled."}
                  </span>
                </div>
              </div>
            )}
          </div>

          {plan.examDate && (
            <div className="shrink-0 flex flex-col items-start lg:items-end gap-1.5">
              <span className="ui-row-meta inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {isZh ? "考试倒计时" : "Countdown"}
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
        </header>
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

function toForm(plan: ExamStudyPlan): ExamForm {
  return {
    examName: plan.examName || "",
    subject: plan.subject || "",
    examDate: plan.examDate || "",
    examTime: plan.examTime || "09:00",
    target: plan.preferences?.targetScoreOrGrade || "",
  };
}
