import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Sun,
  Target,
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { FlipCountdown } from "./FlipCountdown";
import { RealTimeManager } from "./RealTimeManager";
import { CourseKnowledgeHub } from "./CourseKnowledgeHub";
import { getPaletteByString } from "../lib/themePalettes";

interface CourseDetailPageProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onNavigateToTab: (tab: "today" | "dashboard" | "master_calendar" | "course" | "settings") => void;
}

export function CourseDetailPage({
  plan,
  onUpdatePlan,
  onRequestDeletePlan,
  onNavigateToTab,
}: CourseDetailPageProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  // Secondary reference detail is disclosed on demand; progress stays primary.
  const [showKnowledge, setShowKnowledge] = useState(false);

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

  const palette = useMemo(() => {
    return getPaletteByString(plan.id || plan.examName);
  }, [plan.id, plan.examName]);

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

  const daysLeft = useMemo(() => {
    if (!plan.examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = plan.examDate.split("-").map(Number);
    const diff = Math.ceil((new Date(y, m - 1, d).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [plan.examDate]);

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

            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#1c1b1a] leading-tight">
              {plan.examName}
            </h1>

            {plan.examDate && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] ui-muted pt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span className="text-[#1c1b1a] font-medium tabular-nums">
                    {plan.examDate} {plan.examTime || "09:00"}
                  </span>
                </span>
                {plan.preferences?.targetScoreOrGrade && (
                  <span className="inline-flex items-center gap-1.5">
                    <Target className="w-4 h-4" />
                    <span>
                      {isZh ? "目标" : "Target"}{" "}
                      <b className="text-[#1c1b1a] font-medium">{plan.preferences.targetScoreOrGrade}</b>
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          {plan.examDate && (
            <div className="shrink-0 flex flex-col items-start lg:items-end gap-1.5">
              <span className="text-[12px] ui-muted inline-flex items-center gap-1.5">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-8">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="ui-card p-4">
            <span className="text-[12px] ui-muted">{isZh ? "任务进度" : "Task progress"}</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{stats.progressPercent}%</span>
              <span className="text-[12px] ui-subtle tabular-nums">
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

          <div className="ui-card p-4">
            <span className="text-[12px] ui-muted">{isZh ? "学习投入" : "Time invested"}</span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{stats.investedHours}</span>
              <span className="text-[12px] ui-subtle tabular-nums">
                / {stats.plannedHours} {isZh ? "小时" : "hrs"}
              </span>
            </div>
          </div>

          <div className="ui-card p-4">
            <span className="text-[12px] ui-muted">{isZh ? "资料与考点" : "Materials & topics"}</span>
            <div className="mt-2 flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="w-4 h-4 ui-subtle" />
                <b className="text-lg font-semibold tabular-nums">{stats.materialsCount}</b>
                <span className="text-[12px] ui-subtle">{isZh ? "份" : "files"}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 ui-subtle" />
                <b className="text-lg font-semibold tabular-nums">{stats.topicsCount}</b>
                <span className="text-[12px] ui-subtle">{isZh ? "考点" : "topics"}</span>
              </span>
            </div>
          </div>

          <div className="ui-card p-4">
            <span className="text-[12px] ui-muted">{isZh ? "距离考试" : "Days left"}</span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">{daysLeft}</span>
              <span className="text-[12px] ui-subtle">{isZh ? "天" : "days"}</span>
            </div>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#eae7e1] bg-white px-4 py-3">
          <div className="flex items-start gap-2.5 text-[13px] ui-muted">
            <Sun className="w-4 h-4 shrink-0 text-[#8a8580] mt-0.5" />
            <span className="leading-relaxed">
              {isZh
                ? "每日任务只在「今日」执行与勾选，本页专注于进度、阶段与课程资料。"
                : "Daily tasks are executed in Today. This page focuses on progress, phases and course materials."}
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab("today")}
            className="ui-btn ui-btn-primary shrink-0 px-3.5 py-1.5 text-[12px]"
          >
            <span>{isZh ? "前往今日" : "Open Today"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <section className="space-y-4">
          <h2 className="ui-section-title">
            {isZh ? "进度、阶段与动态重排" : "Progress, phases & rebalance"}
          </h2>
          <RealTimeManager plan={plan} onUpdatePlan={onUpdatePlan} />
        </section>

        <section className="ui-card overflow-hidden">
          <button
            onClick={() => setShowKnowledge((prev) => !prev)}
            aria-expanded={showKnowledge}
            className="flex w-full items-center justify-between gap-3 px-4 sm:px-5 py-4 text-left hover:bg-[#faf9f6] transition-colors cursor-pointer"
          >
            <span className="text-[14px] font-semibold text-[#1c1b1a] truncate min-w-0">
              {isZh ? "课程资料与考点体系" : "Materials & topic tree"}
            </span>
            <span className="flex items-center gap-2.5 shrink-0">
              <span className="hidden sm:inline ui-chip tabular-nums">
                {stats.materialsCount} {isZh ? "份资料" : "files"} · {stats.topicsCount} {isZh ? "个考点" : "topics"}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-[#a39e97] transition-transform ${showKnowledge ? "rotate-180" : ""}`}
              />
            </span>
          </button>
          {showKnowledge && (
            <div className="border-t border-[#f0ede8] p-4 sm:p-5">
              <CourseKnowledgeHub
                plan={plan}
                onUpdatePlan={onUpdatePlan}
                onRequestDeleteCourse={onRequestDeletePlan}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}