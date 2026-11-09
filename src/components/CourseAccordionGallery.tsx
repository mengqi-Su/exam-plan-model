import React from "react";
import { Calendar, BookOpen, Trash2, ArrowUpRight, Plus } from "lucide-react";
import { AppTab, ExamStudyPlan } from "../types";
import { countdownDnLabel, examCountdown } from "../lib/date";
import { PageIconGlyph } from "./PageIconGlyph";
import { planReadiness, readinessCopy } from "../lib/planReadiness";

interface CourseAccordionGalleryProps {
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNavigateToTab: (tab: AppTab, planId?: string) => void;
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onAddNewSubject?: () => void;
  language?: "zh" | "en";
  todayStr: string;
}

export function CourseAccordionGallery({
  plans,
  activePlan,
  onSelectPlan,
  onNavigateToTab,
  onDeletePlan,
  onRequestDeletePlan,
  onAddNewSubject,
  language = "zh",
  todayStr,
}: CourseAccordionGalleryProps) {
  const isZh = language === "zh";

  const requestDelete = (plan: ExamStudyPlan) => {
    if (onRequestDeletePlan) onRequestDeletePlan(plan);
    else if (onDeletePlan) onDeletePlan(plan.id);
  };

  const enterCourse = (planId: string) => {
    onSelectPlan(planId);
    onNavigateToTab("course", planId);
  };

  const cardFacts = (plan: ExamStudyPlan) => {
    const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
    const totalCount = plan.tasks.length;
    const todayTasks = plan.tasks.filter((t) => t.date === todayStr);
    const countdown = examCountdown(plan.examDate, plan.examTime);
    return {
      pending: readinessCopy(planReadiness(plan), isZh),
      progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      examLabel: countdown ? countdownDnLabel(countdown, isZh) : null,
      todayDone: todayTasks.filter((t) => t.status === "completed").length,
      todayTotal: todayTasks.length,
    };
  };

  if (!plans || plans.length === 0) {
    return (
      <div className="ui-card p-10 sm:p-14 flex flex-col items-center justify-center text-center space-y-5 animate-fadeIn">
        <div className="w-14 h-14 rounded-xl bg-[#f1efe9] flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-[#6b6660]" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-[20px] font-semibold tracking-tight text-[#1c1b1a]">
            {isZh ? "还没有备考科目" : "No subjects yet"}
          </h3>
        </div>
        <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary">
          <Plus className="w-4 h-4" />
          <span>{isZh ? "新建备考科目" : "Create subject"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {plans.map((plan) => {
        const { pending, progress, examLabel, todayDone, todayTotal } = cardFacts(plan);
        const title = plan.examName || plan.subject || (isZh ? "未命名科目" : "Untitled");
        const genericSubject = !plan.subject || plan.subject === "综合学科" || plan.subject === "General";
        const subtitle = genericSubject ? "" : plan.subject;
        return (
          <article
            key={plan.id}
            className={`ui-card p-4 sm:p-5 flex flex-col gap-3 transition-shadow hover:shadow-[0_2px_10px_rgba(28,27,26,0.07)] ${
              activePlan?.id === plan.id ? "ring-1 ring-[#1c1b1a]/15" : ""
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <PageIconGlyph plan={plan} className="mt-[3px] text-[20px]" />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-semibold tracking-tight text-[#1c1b1a]">{title}</h3>
                {subtitle && <p className="mt-0.5 truncate text-[12px] ui-muted">{subtitle}</p>}
                <div className="mt-1 flex items-center gap-1.5 text-[12px] ui-muted">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>
                    {plan.examDate || (isZh ? "考试日期待定" : "Date TBD")}
                    {plan.examTime ? ` · ${plan.examTime}` : ""}
                  </span>
                </div>
              </div>
              {examLabel && <span className="ui-chip shrink-0 tabular-nums">{examLabel}</span>}
            </div>

            {pending ? (
              <div className="space-y-1">
                <span className="ui-chip">{pending.title}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="ui-muted">{isZh ? "整科进度" : "Progress"}</span>
                  <span className="font-medium tabular-nums text-[#1c1b1a]">{progress}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#f1efe9] overflow-hidden">
                  <div className="h-full rounded-full bg-[#1c1b1a]" style={{ width: `${progress}%` }} />
                </div>
                {todayTotal > 0 && (
                  <p className="text-[11px] ui-muted tabular-nums">
                    {isZh ? `今日 ${todayDone}/${todayTotal} 项` : `Today ${todayDone}/${todayTotal}`}
                  </p>
                )}
              </div>
            )}

            <div className="mt-auto pt-3 border-t border-[#f0ede8] flex items-center justify-between gap-2">
              {(onRequestDeletePlan || onDeletePlan) ? (
                <button
                  type="button"
                  onClick={() => requestDelete(plan)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-[#B42318] hover:bg-[#FDF0EE] transition-colors cursor-pointer"
                  title={isZh ? "删除此科目" : "Delete subject"}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isZh ? "删除" : "Delete"}</span>
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={() => enterCourse(plan.id)}
                className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px]"
              >
                <span>{pending ? (isZh ? "去处理" : "Open") : (isZh ? "进入" : "Open")}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        );
      })}

      {onAddNewSubject && (
        <button
          type="button"
          onClick={onAddNewSubject}
          className="min-h-[180px] rounded-xl border-2 border-dashed border-[#e5e2dc] bg-[#faf9f6]/60 p-5 flex flex-col items-center justify-center gap-2 text-[#6b6660] transition-colors hover:border-[#cfc9c0] hover:bg-[#f5f3ee]"
        >
          <span className="w-9 h-9 rounded-lg bg-[#1c1b1a] text-white flex items-center justify-center">
            <Plus className="w-4 h-4" />
          </span>
          <span className="text-[13px] font-medium">{isZh ? "新建科目" : "New subject"}</span>
          <span className="text-[11px] ui-muted">{isZh ? "填考试信息，资料可稍后补" : "Exam details first, materials later"}</span>
        </button>
      )}
    </div>
  );
}
