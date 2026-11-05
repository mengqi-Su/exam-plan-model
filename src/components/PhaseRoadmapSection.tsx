import React, { useMemo } from "react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { SectionBlock } from "./SectionBlock";

interface PhaseRoadmapSectionProps {
  plan: ExamStudyPlan;
}

/**
 * 阶段路线：只剩纵向时间线本身。
 * 「距考试几天」由页头倒计时负责，这里不再复述一个天数圆点。
 */
export function PhaseRoadmapSection({ plan }: PhaseRoadmapSectionProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  const phases = plan.phases || [];
  const currentIdx = useMemo(() => {
    if (phases.length === 0) return -1;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < phases.length; i += 1) {
      const end = phases[i].endDate ? new Date(phases[i].endDate as string) : null;
      if (!end || Number.isNaN(end.getTime())) return 0;
      if (end.getTime() >= today.getTime()) return i;
    }
    return phases.length - 1;
  }, [phases]);

  if (phases.length === 0) return null;

  return (
    <SectionBlock
      title={isZh ? "备考阶段路线" : "Phase roadmap"}
      hint={
        isZh
          ? `共 ${phases.length} 个阶段，当前在第 ${currentIdx + 1} 阶段`
          : `${phases.length} phases, currently in ${currentIdx + 1}`
      }
    >
      <div className="ui-card p-5 sm:p-7 select-none">
        <ol className="relative space-y-6">
          <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[#eae7e1]" aria-hidden="true" />

          {phases.map((phase, pIdx) => {
            const isCurrent = pIdx === currentIdx;
            const isDone = pIdx < currentIdx;
            return (
              <li key={phase.id || `phase-step-${pIdx}`} className="relative flex gap-4 group">
                <span
                  className={`relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-white transition-transform group-hover:scale-125 ${
                    isCurrent ? "bg-[#1c1b1a]" : isDone ? "bg-[#cfc9c0]" : "bg-[#e5e2dc]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[11px] font-medium tabular-nums ui-subtle">
                      {String(pIdx + 1).padStart(2, "0")}
                    </span>
                    <span className="ui-row-title">{phase.name}</span>
                    <span className="ui-chip tabular-nums">
                      {phase.startDate?.slice(5)} ~ {phase.endDate?.slice(5)}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-[#1c1b1a] text-white px-2 py-0.5 text-[10px] font-medium">
                        {isZh ? "进行中" : "Current"}
                      </span>
                    )}
                  </div>
                  {(phase.description || phase.focus) && (
                    <p className="mt-1 ui-row-meta leading-relaxed max-w-xl">
                      {phase.description || phase.focus}
                    </p>
                  )}
                </div>
              </li>
            );
          })}

          <li className="relative flex gap-4">
            <span className="relative z-10 mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-white bg-[#FCD33B]" />
            <div className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[11px] font-medium tabular-nums ui-subtle">
                {String(phases.length + 1).padStart(2, "0")}
              </span>
              <span className="ui-subgroup-title">{isZh ? "终点 · 考试日" : "Final · Exam day"}</span>
              <span className="ui-chip tabular-nums">{plan.examDate || "—"}</span>
            </div>
          </li>
        </ol>
      </div>
    </SectionBlock>
  );
}
