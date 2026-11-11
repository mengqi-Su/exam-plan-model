import React, { useState } from "react";
import {
  Calendar,
  BookOpen,
  Trash2,
  ArrowUpRight,
  ChevronDown,
  Plus,
} from "lucide-react";
import { AppTab, ExamStudyPlan } from "../types";
import { countdownDnLabel, examCountdown } from "../lib/date";
import { PageIconGlyph } from "./PageIconGlyph";
import { planReadiness, readinessCopy } from "../lib/planReadiness";
import { newSubjectEntry } from "../lib/text";

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
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("add_new");

  const effectiveExpandedId = activeHoverId !== null ? activeHoverId : selectedId;

  const requestDelete = (plan: ExamStudyPlan) => {
    if (onRequestDeletePlan) onRequestDeletePlan(plan);
    else if (onDeletePlan) onDeletePlan(plan.id);
  };

  /**
   * 卡组每门科目对外说的那几个数：只有真的排出过任务，进度才是一个百分数。
   * 「先建科目、资料回头再传」的门不报 0%——它不是落后，是还没开始，
   * 口径由 lib/planReadiness 一处决定，卡片只负责把它摆出来。
   */
  const cardFacts = (plan: ExamStudyPlan) => {
    const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
    const totalCount = plan.tasks.length;
    const countdown = examCountdown(plan.examDate, plan.examTime);
    return {
      pending: readinessCopy(planReadiness(plan), isZh),
      progress: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
      // D-N 和今日页、科目页那条倒计时是同一个数：都由 lib/date 算，卡片不再自己数天
      examLabel: countdown ? countdownDnLabel(countdown, isZh) : null,
    };
  };

  const enterCourse = (planId: string) => {
    onSelectPlan(planId);
    onNavigateToTab("course", planId);
  };

  if (!plans || plans.length === 0) {
    return (
      <div className="ui-card p-10 sm:p-14 flex flex-col items-center justify-center text-center space-y-5 animate-fadeIn">
        <div className="w-14 h-14 rounded-xl bg-[#f1efe9] flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-[#6b6660]" />
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-[20px] font-semibold tracking-tight text-[#1c1b1a]">
            {isZh ? "还没有科目" : "No subjects yet"}
          </h3>
        </div>
        <button onClick={onAddNewSubject} className="ui-btn ui-btn-primary">
          <Plus className="w-4 h-4" />
          <span>{newSubjectEntry(isZh)}</span>
        </button>
      </div>
    );
  }

  const isAddNewExpanded = effectiveExpandedId === "add_new";

  return (
    <div className="space-y-3">
      {/* Desktop: expand-on-hover accordion */}
      <div
        className="hidden md:flex w-full h-[400px] gap-3 overflow-hidden items-stretch"
        onMouseLeave={() => setActiveHoverId(null)}
      >
        {plans.map((plan) => {
          const isExpanded = effectiveExpandedId === plan.id;
          const { pending, progress, examLabel } = cardFacts(plan);

          return (
            <div
              key={plan.id}
              role="button"
              tabIndex={0}
              aria-expanded={isExpanded}
              aria-label={
                isZh
                  ? `${plan.examName}，${isExpanded ? "收起" : "展开"}科目`
                  : `${plan.examName}, ${isExpanded ? "collapse" : "expand"} subject`
              }
              onMouseEnter={() => setActiveHoverId(plan.id)}
              onClick={() => {
                setSelectedId(plan.id);
                onSelectPlan(plan.id);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedId(plan.id);
                  setActiveHoverId(plan.id);
                  onSelectPlan(plan.id);
                }
              }}
              style={{
                flex: isExpanded ? "5" : "1",
                minWidth: isExpanded ? "380px" : "60px",
              }}
              className={`relative overflow-hidden rounded-xl border bg-white transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer flex flex-col ${
                isExpanded
                  ? "border-[#ddd8d0] shadow-[0_2px_12px_rgba(28,27,26,0.08)] p-5 justify-between"
                  : "border-[#eae7e1] p-3 items-center justify-between hover:border-[#ddd8d0]"
              }`}
            >
              {isExpanded ? (
                <div className="flex flex-col justify-between h-full w-full space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      {/* 科目身份就是页面图标，与详情页页头、侧栏取同一个值；不再靠一根色条区分。 */}
                      <div className="flex min-w-0 flex-1 items-start gap-2.5">
                        <PageIconGlyph plan={plan} className="mt-[3px] text-[20px]" />
                        <h3
                          onClick={(e) => {
                            e.stopPropagation();
                            enterCourse(plan.id);
                          }}
                          className="min-w-0 text-[20px] font-semibold text-[#1c1b1a] hover:underline cursor-pointer tracking-tight leading-snug line-clamp-2"
                        >
                          {plan.examName}
                        </h3>
                      </div>
                      {examLabel && (
                        <span className="ui-chip shrink-0 tabular-nums">
                          {examLabel}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[12px] ui-muted">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        {plan.examDate || (isZh ? "待定" : "TBD")}
                        {plan.examTime ? ` · ${plan.examTime}` : ""}
                      </span>
                    </div>

                    {pending ? (
                      <div className="pt-1">
                        <span className="ui-chip">{pending.title}</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="ui-muted">{isZh ? "备考进度" : "Progress"}</span>
                          <span className="font-medium tabular-nums text-[#1c1b1a]">{progress}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-[#f1efe9] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#1c1b1a] transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#f0ede8] flex items-center justify-between gap-2">
                    {onRequestDeletePlan || onDeletePlan ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(plan);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#B42318] hover:bg-[#FDF0EE] transition-colors cursor-pointer"
                        title={isZh ? "删除此科目" : "Delete subject"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isZh ? "删除" : "Delete"}</span>
                      </button>
                    ) : (
                      <div />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        enterCourse(plan.id);
                      }}
                      className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px]"
                    >
                      <span>{isZh ? "进入" : "Open"}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-between h-full w-full py-2">
                  <PageIconGlyph plan={plan} className="text-[20px]" />
                  <div className="flex-1 flex items-center justify-center overflow-hidden pt-2">
                    <span className="text-[12px] font-medium text-[#6b6660] whitespace-nowrap rotate-90 origin-center max-w-[220px] truncate">
                      {plan.examName}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-1 w-full pt-2">
                    {examLabel && (
                      <span className="text-[11px] font-medium tabular-nums text-[#6b6660]">{examLabel}</span>
                    )}
                    {/* 没排任务的科目在窄条上不给百分数：一格 0% 只会读成「落后了」。 */}
                    {!pending && (
                      <>
                        <span className="text-[11px] font-semibold tabular-nums text-[#1c1b1a]">{progress}%</span>
                        <div className="w-full h-1 rounded-full bg-[#f1efe9] overflow-hidden">
                          <div className="h-full rounded-full bg-[#1c1b1a]" style={{ width: `${progress}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {onAddNewSubject && (
          <div
            role="button"
            tabIndex={0}
            aria-label={newSubjectEntry(isZh)}
            onMouseEnter={() => setActiveHoverId("add_new")}
            onClick={() => {
              setSelectedId("add_new");
              onAddNewSubject();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedId("add_new");
                onAddNewSubject();
              }
            }}
            style={{
              flex: isAddNewExpanded ? "5" : "1",
              minWidth: isAddNewExpanded ? "360px" : "60px",
            }}
            className={`relative overflow-hidden rounded-xl border-2 border-dashed transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer flex flex-col justify-between ${
              isAddNewExpanded
                ? "border-[#ddd8d0] bg-white p-5"
                : "border-[#e5e2dc] bg-[#faf9f6]/60 p-3 items-center justify-between hover:border-[#cfc9c0] hover:bg-[#f5f3ee]"
            }`}
          >
            {isAddNewExpanded ? (
              <div className="flex flex-col justify-between h-full w-full">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-[#1c1b1a] text-white flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </span>
                  <span className="text-[13px] font-medium text-[#6b6660]">
                    {newSubjectEntry(isZh)}
                  </span>
                </div>

                <div className="my-auto py-6">
                  <h3 className="text-[20px] font-semibold text-[#1c1b1a] tracking-tight">
                    {newSubjectEntry(isZh)}
                  </h3>
                </div>

                <div className="pt-3 border-t border-[#f0ede8] flex items-center justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNewSubject();
                    }}
                    className="ui-btn ui-btn-primary"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isZh ? "立即创建" : "Create now"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-between h-full w-full py-2">
                <span className="w-7 h-7 rounded-lg bg-white border border-[#e5e2dc] text-[#6b6660] flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <div className="flex-1 flex items-center justify-center my-3 overflow-hidden">
                  <span className="text-[12px] font-medium text-[#6b6660] whitespace-nowrap rotate-90 origin-center">
                    {newSubjectEntry(isZh)}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#6b6660]" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile: stacked expandable cards */}
      <div className="md:hidden space-y-2.5">
        {onAddNewSubject && (
          <div
            role="button"
            tabIndex={0}
            onClick={onAddNewSubject}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onAddNewSubject();
              }
            }}
            className="rounded-xl border-2 border-dashed border-[#e5e2dc] bg-[#faf9f6]/60 p-4 cursor-pointer transition-colors hover:border-[#cfc9c0] hover:bg-[#f5f3ee] flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-lg bg-[#1c1b1a] text-white flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </span>
              <span className="text-[13px] font-medium text-[#1c1b1a]">
                {newSubjectEntry(isZh)}
              </span>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#6b6660]" />
          </div>
        )}

        {plans.map((plan) => {
          const isExpanded = effectiveExpandedId === plan.id;
          const { pending, progress, examLabel } = cardFacts(plan);

          return (
            <div key={plan.id} className="ui-card overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => {
                  setSelectedId(isExpanded ? "add_new" : plan.id);
                  onSelectPlan(plan.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedId(isExpanded ? "add_new" : plan.id);
                    onSelectPlan(plan.id);
                  }
                }}
                className="p-4 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PageIconGlyph plan={plan} className="text-[20px]" />
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-semibold text-[#1c1b1a] truncate">{plan.examName}</h4>
                    <span className="text-[12px] ui-muted block mt-0.5 truncate">
                      {plan.subject} ·{" "}
                      {pending ? pending.title : `${progress}% ${isZh ? "完成" : "done"}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {examLabel && <span className="ui-chip tabular-nums">{examLabel}</span>}
                  <ChevronDown
                    className={`w-4 h-4 text-[#6b6660] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-3 space-y-3 border-t border-[#f0ede8]">
                  {pending ? (
                    <div className="space-y-1.5">
                      <span className="ui-chip">{pending.title}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="ui-muted">{isZh ? "进度" : "Progress"}</span>
                        <span className="font-medium tabular-nums text-[#1c1b1a]">{progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#f1efe9] overflow-hidden">
                        <div className="h-full rounded-full bg-[#1c1b1a]" style={{ width: `${progress}%` }} />
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    {(onRequestDeletePlan || onDeletePlan) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          requestDelete(plan);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-[#B42318] hover:bg-[#FDF0EE] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isZh ? "删除" : "Delete"}</span>
                      </button>
                    )}
                    <button
                      onClick={() => enterCourse(plan.id)}
                      className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px] ml-auto"
                    >
                      <span>{isZh ? "进入" : "Open"}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}