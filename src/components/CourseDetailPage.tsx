import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Sun,
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
  onNavigateToTab: (tab: "today" | "dashboard" | "master_calendar" | "course" | "add_subject" | "settings") => void;
}

export function CourseDetailPage({
  plan,
  onUpdatePlan,
  onRequestDeletePlan,
  onNavigateToTab,
}: CourseDetailPageProps) {
  const { language } = useI18n();

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
    <div className="relative min-h-screen bg-[#F8F7F4] text-[#111111] font-sans pb-20">
      <header className="w-full bg-[#FAF9F6] border-b border-[#111111] shadow-2xs">
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
            <span className="font-bold text-[#111111] truncate font-sans">
              [{plan.examName}]
            </span>
          </div>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-[#888888]">
            {language === "zh" ? "单页课程工作区" : "SINGLE-PAGE COURSE WORKSPACE"}
          </span>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-10">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#111111] bg-white font-mono">
          <div className="p-4 border-b sm:border-r border-[#111111] lg:border-b-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
              [{language === "zh" ? "任务进度" : "TASK PROGRESS"}]
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-[#111111]">{stats.progressPercent}%</span>
              <span className="text-xs text-[#666666]">
                {stats.completedCount}/{stats.totalCount}
              </span>
            </div>
            <div className="mt-2 h-1.5 bg-[#e5e5e5] border border-[#111111]/20">
              <div
                className="h-full bg-[#111111] transition-all duration-300"
                style={{ width: `${stats.progressPercent}%` }}
              />
            </div>
          </div>

          <div className="p-4 border-b lg:border-b-0 lg:border-r border-[#111111]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
              [{language === "zh" ? "学习投入" : "TIME INVESTED"}]
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-[#111111]">{stats.investedHours}</span>
              <span className="text-xs text-[#666666]">
                / {stats.plannedHours} {language === "zh" ? "小时" : "HRS"}
              </span>
            </div>
            <span className="mt-2 block text-[10px] text-[#888888]">
              {language === "zh" ? "已完成任务实际用时 / 计划总时长" : "Logged time / planned time"}
            </span>
          </div>

          <div className="p-4 border-b sm:border-b-0 sm:border-r border-[#111111]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
              [{language === "zh" ? "资料与考点" : "MATERIALS & TOPICS"}]
            </span>
            <div className="mt-2 flex items-center space-x-4">
              <span className="flex items-center space-x-1.5 text-[#111111]">
                <FileText className="w-3.5 h-3.5" />
                <b className="text-lg">{stats.materialsCount}</b>
                <span className="text-[10px] text-[#666666]">{language === "zh" ? "份资料" : "files"}</span>
              </span>
              <span className="flex items-center space-x-1.5 text-[#111111]">
                <BookOpen className="w-3.5 h-3.5" />
                <b className="text-lg">{stats.topicsCount}</b>
                <span className="text-[10px] text-[#666666]">{language === "zh" ? "个考点" : "topics"}</span>
              </span>
            </div>
            <span className="mt-2 block text-[10px] text-[#888888]">
              {language === "zh" ? "上传、预览与提炼都在这页完成" : "Upload, preview and extract on this page"}
            </span>
          </div>

          <div className="p-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
              [{language === "zh" ? "距离考试" : "DAYS LEFT"}]
            </span>
            <div className="mt-2 flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-[#111111]">{daysLeft}</span>
              <span className="text-xs text-[#666666]">{language === "zh" ? "天" : "DAYS"}</span>
            </div>
            <span className="mt-2 block text-[10px] text-[#888888]">
              {plan.examDate || "--"} {plan.examTime || "09:00"}
            </span>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-dashed border-[#111111] bg-[#FAF9F6] px-4 py-3 font-mono">
          <div className="flex items-start space-x-2 text-xs text-[#444444]">
            <Sun className="w-4 h-4 shrink-0 text-[#111111] mt-0.5" />
            <span className="leading-relaxed">
              {language === "zh"
                ? "每日任务只在「今日」执行与勾选，本页专注于进度、阶段与课程资料。"
                : "Daily tasks are executed in Today. This page focuses on progress, phases and course materials."}
            </span>
          </div>
          <button
            onClick={() => onNavigateToTab("today")}
            className="shrink-0 inline-flex items-center justify-center space-x-1.5 px-3.5 py-1.5 bg-[#111111] text-white text-xs font-bold border border-[#111111] hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <span>[{language === "zh" ? "前往今日" : "OPEN TODAY"}]</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <section className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b-2 border-[#111111] font-mono">
            <span className="px-1.5 py-0.5 bg-[#FCD33B] border border-[#111111] text-[#111111] text-[10px] font-bold">01</span>
            <h2 className="text-sm font-bold uppercase text-[#111111]">
              {language === "zh" ? "进度、阶段与动态重排" : "PROGRESS, PHASES & REBALANCE"}
            </h2>
            <span className="ml-auto text-[10px] font-bold uppercase text-[#888888]">
              {language === "zh" ? "主视图" : "PRIMARY"}
            </span>
          </div>
          <RealTimeManager plan={plan} onUpdatePlan={onUpdatePlan} />
        </section>

        <section className="border border-[#111111] bg-white">
          <button
            onClick={() => setShowKnowledge((prev) => !prev)}
            aria-expanded={showKnowledge}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left font-mono hover:bg-[#fafafa] transition-colors cursor-pointer"
          >
            <span className="flex items-center space-x-2 min-w-0">
              <span className="px-1.5 py-0.5 bg-white border border-[#111111] text-[#111111] text-[10px] font-bold">02</span>
              <span className="text-xs font-bold uppercase text-[#111111] truncate">
                {language === "zh" ? "课程资料与考点体系" : "COURSE MATERIALS & TOPIC TREE"}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0 text-[10px] font-bold text-[#666666]">
              <span className="hidden sm:inline">
                {stats.materialsCount} {language === "zh" ? "份资料" : "files"} · {stats.topicsCount} {language === "zh" ? "个考点" : "topics"}
              </span>
              <span className="text-[#888888]">
                {showKnowledge ? (language === "zh" ? "收起" : "COLLAPSE") : (language === "zh" ? "展开管理" : "EXPAND")}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showKnowledge ? "rotate-180" : ""}`} />
            </span>
          </button>
          {showKnowledge && (
            <div className="border-t border-[#111111] p-4 sm:p-5">
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
