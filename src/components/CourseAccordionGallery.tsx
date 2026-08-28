import React, { useState } from "react";
import {
  Calendar,
  CheckSquare,
  BookOpen,
  Zap,
  Download,
  Trash2,
  AlertTriangle,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { ExamStudyPlan } from "../types";
import { downloadICSFile } from "../lib/calendarExport";

interface CourseAccordionGalleryProps {
  plans: ExamStudyPlan[];
  activePlan: ExamStudyPlan | null;
  onSelectPlan: (planId: string) => void;
  onNavigateToTab: (tab: "dashboard" | "master_calendar" | "todo" | "realtime" | "course" | "add_subject", planId?: string) => void;
  onDeletePlan?: (planId: string) => void;
  onRequestDeletePlan?: (plan: ExamStudyPlan) => void;
  onAddNewSubject?: () => void;
  language?: "zh" | "en";
  todayStr: string;
}

const CARD_THEMES = [
  {
    name: "canary-yellow",
    isDark: false,
    bg: "bg-[#FCD33B]",
    hoverBg: "hover:bg-[#ebc433]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#333333]",
    badgeBg: "bg-[#111111] text-white border-[#111111]",
    circleBg: "bg-[#111111] text-white",
    cardBorder: "border-[#111111]",
    progressTrack: "bg-black/15 border-[#111111]",
    progressFill: "bg-[#111111]",
    darkBtn: "bg-[#111111] text-white hover:bg-[#262626] border border-[#111111]",
    whiteBtn: "bg-white text-[#111111] hover:bg-[#f2f2f2] border border-[#111111]",
    tagBg: "bg-[#111111]/10 text-[#111111] border-[#111111]",
    pillBg: "bg-[#111111] text-white border-[#111111]",
  },
  {
    name: "concrete-gray",
    isDark: false,
    bg: "bg-[#D8D8D8]",
    hoverBg: "hover:bg-[#cdcdcd]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#444444]",
    badgeBg: "bg-[#111111] text-white border-[#111111]",
    circleBg: "bg-[#111111] text-white",
    cardBorder: "border-[#111111]",
    progressTrack: "bg-white/60 border-[#111111]",
    progressFill: "bg-[#111111]",
    darkBtn: "bg-[#111111] text-white hover:bg-[#262626] border border-[#111111]",
    whiteBtn: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    tagBg: "bg-white/50 text-[#111111] border-[#111111]",
    pillBg: "bg-[#111111] text-white border-[#111111]",
  },
  {
    name: "stone-gray",
    isDark: false,
    bg: "bg-[#B5B5B5]",
    hoverBg: "hover:bg-[#a8a8a8]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#222222]",
    badgeBg: "bg-[#111111] text-white border-[#111111]",
    circleBg: "bg-[#111111] text-white",
    cardBorder: "border-[#111111]",
    progressTrack: "bg-white/60 border-[#111111]",
    progressFill: "bg-[#111111]",
    darkBtn: "bg-[#111111] text-white hover:bg-[#262626] border border-[#111111]",
    whiteBtn: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    tagBg: "bg-white/60 text-[#111111] border-[#111111]",
    pillBg: "bg-[#111111] text-white border-[#111111]",
  },
  {
    name: "dark-slate",
    isDark: true,
    bg: "bg-[#282828]",
    hoverBg: "hover:bg-[#333333]",
    textPrimary: "text-[#F5F5F5]",
    textSecondary: "text-[#BDBDBD]",
    badgeBg: "bg-white text-[#111111] border-white/40",
    circleBg: "bg-white text-[#111111]",
    cardBorder: "border-[#111111]",
    progressTrack: "bg-white/20 border-white/40",
    progressFill: "bg-white",
    darkBtn: "bg-white text-[#111111] hover:bg-[#E5E5E5] border border-white",
    whiteBtn: "bg-[#1A1A1A] text-white hover:bg-[#333333] border border-white/30",
    tagBg: "bg-white/10 text-white border-white/30",
    pillBg: "bg-white text-[#111111] border-white",
  },
];

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

  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("add_new");

  const effectiveExpandedId = activeHoverId !== null ? activeHoverId : selectedId;

  const getDaysRemaining = (examDateStr?: string) => {
    if (!examDateStr) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDateStr.split("-").map(Number);
    const examDate = new Date(y, m - 1, d);
    const diffTime = examDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  if (!plans || plans.length === 0) {
    return (
      <div
        onClick={onAddNewSubject}
        className="p-12 bg-[#faf9f6] border-2 border-dashed border-[#111111] text-center font-mono text-xs cursor-pointer hover:bg-[#f0eee6] transition-all flex flex-col items-center justify-center space-y-3"
      >
        <div className="w-10 h-10 bg-[#111111] text-white flex items-center justify-center font-bold">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-bold text-sm text-[#111111]">
            [{language === "zh" ? "暂无在考科目 · 点击新建首门备考计划" : "NO SUBJECTS · CLICK TO ADD FIRST COURSE"}]
          </h4>
        </div>
      </div>
    );
  }

  const isAddNewExpanded = effectiveExpandedId === "add_new";

  return (
    <div className="space-y-3 font-mono select-none">

      <div
        className="hidden md:flex w-full h-[400px] gap-2 overflow-hidden items-stretch p-2.5 bg-[#faf9f6] border border-[#111111]"
        onMouseLeave={() => setActiveHoverId(null)}
      >

        {plans.map((plan, idx) => {
          const isExpanded = effectiveExpandedId === plan.id;
          const theme = CARD_THEMES[idx % CARD_THEMES.length];
          const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
          const totalCount = plan.tasks.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const daysLeft = getDaysRemaining(plan.examDate);
          const overdueCount = plan.tasks.filter((t) => t.date < todayStr && t.status !== "completed").length;

          return (
            <div
              key={plan.id}
              onMouseEnter={() => setActiveHoverId(plan.id)}
              onClick={() => {
                setSelectedId(plan.id);
                onSelectPlan(plan.id);
              }}
              style={{
                flex: isExpanded ? "5" : "1",
                minWidth: isExpanded ? "400px" : "56px",
              }}
              className={`relative border ${theme.cardBorder} ${theme.bg} transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer flex flex-col justify-between overflow-hidden ${
                isExpanded ? "p-6" : "p-3 items-center justify-between"
              }`}
            >
              {isExpanded ? (
                <div className="flex flex-col justify-between h-full w-full space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center space-x-2 min-w-0">
                        <div className={`w-8 h-8 ${theme.circleBg} flex items-center justify-center font-bold text-xs shrink-0 font-mono border border-current`}>
                          0{idx + 1}
                        </div>
                      </div>

                      {daysLeft !== null && (
                        <div className={`px-2.5 py-0.5 border font-mono text-xs font-bold tracking-tight shrink-0 ${theme.pillBg}`}>
                          {daysLeft <= 0
                            ? (language === "zh" ? "[TODAY 考试]" : "[TODAY]")
                            : `[D-${daysLeft} ${language === "zh" ? "天" : "d"}]`}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlan(plan.id);
                          onNavigateToTab("course", plan.id);
                        }}
                        className={`text-xl font-bold ${theme.textPrimary} hover:underline cursor-pointer tracking-tight leading-snug line-clamp-2 font-mono`}
                      >
                        {plan.examName}
                      </h3>
                      <div className={`flex items-center space-x-2 text-xs mt-1.5 font-mono ${theme.textSecondary}`}>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{plan.examDate || "TBD"} {plan.examTime ? `· ${plan.examTime}` : ""}</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      <div className={`flex items-center justify-between text-xs font-mono font-bold ${theme.textPrimary}`}>
                        <span>[{language === "zh" ? "备考进度" : "PROGRESS"}]</span>
                        <span>{progress}%</span>
                      </div>
                      <div className={`w-full border h-2 overflow-hidden ${theme.progressTrack}`}>
                        <div
                          className={`h-full ${theme.progressFill} transition-all duration-500`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className={`pt-3 border-t flex items-center justify-between gap-2 text-xs font-mono ${
                    theme.isDark ? "border-white/20" : "border-[#111111]"
                  }`}>
                    {(onRequestDeletePlan || onDeletePlan) ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRequestDeletePlan) {
                            onRequestDeletePlan(plan);
                          } else if (onDeletePlan) {
                            onDeletePlan(plan.id);
                          }
                        }}
                        className={`px-2.5 py-1 ${theme.whiteBtn} font-bold transition-all flex items-center space-x-1 cursor-pointer`}
                        title={language === "zh" ? "删除此科目" : "Delete Subject"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>[{language === "zh" ? "删除" : "DELETE"}]</span>
                      </button>
                    ) : <div />}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPlan(plan.id);
                        onNavigateToTab("course", plan.id);
                      }}
                      className={`px-3 py-1 ${theme.darkBtn} font-bold flex items-center space-x-1 transition-all cursor-pointer`}
                    >
                      <span>[{language === "zh" ? "进入" : "ENTER"}]</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (

                <div className="flex flex-col items-center justify-between h-full w-full py-2.5 font-mono">

                  <div className={`w-7 h-7 ${theme.circleBg} flex items-center justify-center font-bold text-xs border border-current`}>
                    0{idx + 1}
                  </div>

                  <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                    <span className={`text-xs font-bold ${theme.textPrimary} uppercase tracking-widest whitespace-nowrap rotate-90 origin-center max-w-[180px] truncate`}>
                      {plan.examName}
                    </span>
                  </div>

                  <div className="flex flex-col items-center space-y-1.5 w-full">
                    {daysLeft !== null && (
                      <span className={`text-[10px] px-1.5 py-0.5 border font-bold whitespace-nowrap ${theme.pillBg}`}>
                        D-{daysLeft}
                      </span>
                    )}
                    <span className={`text-[11px] font-bold ${theme.textPrimary}`}>{progress}%</span>
                    <div className={`w-full border h-1.5 overflow-hidden ${theme.progressTrack}`}>
                      <div className={`h-full ${theme.progressFill}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {onAddNewSubject && (
          <div
            onMouseEnter={() => setActiveHoverId("add_new")}
            onClick={() => {
              setSelectedId("add_new");
              onAddNewSubject();
            }}
            style={{
              flex: isAddNewExpanded ? "5" : "1",
              minWidth: isAddNewExpanded ? "380px" : "56px",
            }}
            className={`relative border-2 border-dashed border-[#111111] bg-white transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] cursor-pointer flex flex-col justify-between overflow-hidden ${
              isAddNewExpanded ? "p-6 bg-[#faf9f6]" : "p-3 items-center justify-between hover:bg-[#ede9dc]"
            }`}
          >
            {isAddNewExpanded ? (
              <div className="flex flex-col justify-between h-full w-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 border border-[#111111] bg-[#111111] text-white uppercase tracking-wider inline-block font-mono">
                      [{language === "zh" ? "新建科目" : "NEW SUBJECT"}]
                    </span>
                  </div>

                  <div className="px-2.5 py-0.5 border border-[#111111] bg-white text-[#111111] font-mono text-xs font-bold tracking-tight shrink-0">
                    [+]
                  </div>
                </div>

                <div className="my-auto py-6">
                  <h3 className="text-2xl font-bold text-[#111111] tracking-tight font-mono">
                    {language === "zh" ? "创建全新考试科目计划" : "Create New Subject Plan"}
                  </h3>
                </div>

                <div className="pt-3 border-t border-[#111111] flex items-center justify-end font-mono">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNewSubject();
                    }}
                    className="px-5 py-2 bg-[#111111] text-white hover:bg-[#222222] border border-[#111111] font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>[{language === "zh" ? "立即创建" : "CREATE NOW"}]</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-between h-full w-full py-2.5 font-mono">
                <div className="w-7 h-7 bg-[#111111] text-white flex items-center justify-center font-bold text-xs">
                  <Plus className="w-4 h-4" />
                </div>

                <div className="flex-1 flex items-center justify-center my-4 overflow-hidden">
                  <span className="text-xs font-bold text-[#111111] uppercase tracking-widest whitespace-nowrap rotate-90 origin-center max-w-[180px] truncate">
                    {language === "zh" ? "+ 新建科目" : "+ NEW SUBJECT"}
                  </span>
                </div>

                <div className="w-6 h-6 border border-[#111111] flex items-center justify-center text-[#111111]">
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="md:hidden space-y-2 font-mono">

        {onAddNewSubject && (
          <div
            onClick={onAddNewSubject}
            className="p-4 bg-[#faf9f6] hover:bg-[#f0eee6] border-2 border-dashed border-[#111111] font-mono cursor-pointer transition-colors flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-[#111111] text-white flex items-center justify-center text-xs">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold text-xs text-[#111111]">
                [{language === "zh" ? "新建考试科目" : "ADD NEW SUBJECT"}]
              </span>
            </div>
            <span className="text-[10px] px-2 py-1 bg-[#111111] text-white font-bold">
              {language === "zh" ? "创建" : "CREATE"}
            </span>
          </div>
        )}

        {plans.map((plan, idx) => {
          const isExpanded = effectiveExpandedId === plan.id;
          const theme = CARD_THEMES[idx % CARD_THEMES.length];
          const completedCount = plan.tasks.filter((t) => t.status === "completed").length;
          const totalCount = plan.tasks.length;
          const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const daysLeft = getDaysRemaining(plan.examDate);

          return (
            <div
              key={plan.id}
              className={`border ${theme.cardBorder} ${theme.bg} ${theme.textPrimary} transition-all overflow-hidden`}
            >

              <div
                onClick={() => {
                  setSelectedId(isExpanded ? "add_new" : plan.id);
                  onSelectPlan(plan.id);
                }}
                className="p-3.5 flex items-center justify-between gap-2.5 cursor-pointer"
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className={`w-7 h-7 ${theme.circleBg} flex items-center justify-center text-xs font-bold shrink-0 border border-current`}>
                    0{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold truncate">{plan.examName}</h4>
                    <span className={`text-[10px] ${theme.textSecondary} block mt-0.5`}>
                      [{plan.subject}] · {progress}% {language === "zh" ? "完成" : "done"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  {daysLeft !== null && (
                    <span className={`px-2 py-0.5 border text-[10px] font-bold ${theme.pillBg}`}>
                      D-{daysLeft}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                    theme.isDark ? "border-white/30 bg-white/10" : "border-[#111111] bg-white"
                  }`}>
                    {isExpanded ? (language === "zh" ? "收起" : "COLLAPSE") : (language === "zh" ? "展开" : "EXPAND")}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className={`p-3.5 pt-0 space-y-2.5 border-t ${
                  theme.isDark ? "border-white/20" : "border-[#111111]"
                }`}>
                  <div className="flex items-center justify-between text-xs font-bold pt-2 font-mono">
                    <span className={theme.textSecondary}>[{language === "zh" ? "进度" : "PROGRESS"}]</span>
                    <span>{progress}%</span>
                  </div>
                  <div className={`w-full border h-1.5 overflow-hidden ${theme.progressTrack}`}>
                    <div className={`h-full ${theme.progressFill}`} style={{ width: `${progress}%` }} />
                  </div>

                  <div className="flex items-center justify-between pt-2 text-xs font-mono">
                    {(onRequestDeletePlan || onDeletePlan) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onRequestDeletePlan) {
                            onRequestDeletePlan(plan);
                          } else if (onDeletePlan) {
                            onDeletePlan(plan.id);
                          }
                        }}
                        className={`px-2 py-1 font-bold ${theme.whiteBtn} flex items-center space-x-1 cursor-pointer`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>[{language === "zh" ? "删除" : "DELETE"}]</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onSelectPlan(plan.id);
                        onNavigateToTab("course", plan.id);
                      }}
                      className={`px-3 py-1 font-bold ${theme.darkBtn} flex items-center space-x-1 cursor-pointer`}
                    >
                      <span>[{language === "zh" ? "进入" : "ENTER"}]</span>
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
