import React, { useMemo, useState } from "react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { countdownDnLabel, examCountdown, toLocalDateString } from "../lib/date";
import { SectionBlock } from "./SectionBlock";

interface PhaseRoadmapSectionProps {
  plan: ExamStudyPlan;
}

type NodeState = "done" | "current" | "todo" | "exam";

interface AxisNode {
  key: string;
  name: string;
  /** 节点下面那行读数：阶段是起止日期，考试日是 D-N */
  meta: string;
  state: NodeState;
  detail?: string;
}

/**
 * 节点上的圆点。三种状态原来靠 #1c1b1a / #cfc9c0 / #e5e2dc 三个色阶区分，
 * 后两个在白卡上只有 1.62 和 1.31:1——「已完成」和「未开始」看着是同一个灰点。
 * 现在仍是实心／加深／空心三种形状各自能读，颜色只做补充（清单 UI-03）；
 * 考试日那条粗环是整条路线唯一的目标标记。底色是纸色不是白卡，所以光环也跟纸色走。
 */
function AxisDot({ state }: { state: NodeState }) {
  const shape =
    state === "current"
      ? "bg-[#1c1b1a] scale-125"
      : state === "done"
        ? "bg-[#6b6660]"
        : state === "exam"
          ? "border-[3px] border-[#1c1b1a] bg-[#f8f7f4]"
          : "border border-[#6b6660] bg-[#f8f7f4]";
  return (
    <span
      className={`relative z-10 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-[#f8f7f4] transition-transform ${shape}`}
      aria-hidden="true"
    />
  );
}

/**
 * 备考路线：一条「今天 → 各个阶段 → 考试日」的横轴。
 *
 * 原来它是一整段纵向时间线，包在一张 p-7 的白卡里，独占一段 40px 留白——
 * 可它真正要说的一句话只有「共 4 段，当前第 2 段」，尾部还得把页头写过的考试日期再写一遍。
 * 现在轴本身就是那块内容的全部：日期上轴、描述点开才看（渐进披露），
 * 考试日就是轴的最右端，D-N 只在这一处出现——页头那条「距考试」属性因此可以删掉，
 * 同一门考试在这页不再有三个天数口径。窄屏不换排，改回纵向列表：横轴等分下去
 * 每个节点只剩几十字，日期会被截断；纵向本来就好读，也不必造第二个组件。
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

  // 轴末端就是考试日：天数与总览卡组、今日页同一个数，都由 lib/date 算。
  const examCount = useMemo(() => examCountdown(plan.examDate, plan.examTime), [plan.examDate, plan.examTime]);

  const nodes = useMemo<AxisNode[]>(() => {
    const list: AxisNode[] = phases.map((phase, idx) => ({
      key: phase.id || `phase-${idx}`,
      name: phase.name,
      meta: phase.startDate || phase.endDate
        ? `${phase.startDate?.slice(5) ?? ""} ~ ${phase.endDate?.slice(5) ?? ""}`
        : "",
      state: idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo",
      detail: phase.description || phase.focus || "",
    }));
    // 只有考试日没有阶段时，轴不能只剩一个孤点：那看不出「走到哪」，只看得出「有一天要考」。
    // 补一个「今天」在左端，两点一线才说得出这一段还剩多远。
    if (list.length === 0 && examCount) {
      const today = new Date();
      list.push({
        key: "today",
        name: isZh ? "今天" : "Today",
        meta: toLocalDateString(today),
        state: "current",
      });
    }
    if (examCount) {
      list.push({
        key: "exam-day",
        name: isZh ? "考试日" : "Exam day",
        meta: countdownDnLabel(examCount, isZh),
        state: examCount.passed ? "done" : "exam",
      });
    }
    return list;
  }, [phases, currentIdx, examCount, isZh]);

  const [selIdx, setSelIdx] = useState(() => (currentIdx >= 0 ? currentIdx : 0));
  // 换科目时把选中态还给这一门自己的当前阶段，不然会把上一门点到哪一段带过来。
  const [selFrom, setSelFrom] = useState(plan.id);
  if (selFrom !== plan.id) {
    setSelFrom(plan.id);
    setSelIdx(currentIdx >= 0 ? currentIdx : 0);
  }
  const active = nodes[Math.max(0, Math.min(selIdx, nodes.length - 1))];
  const hasDetail = (list: AxisNode[]) => list.some((n) => !!n.detail);

  if (nodes.length === 0) return null;

  return (
    <SectionBlock
      title={isZh ? "备考路线" : "Roadmap"}
      hint={
        phases.length > 0 ? (
          <span className="flex flex-wrap items-center gap-x-3">
            <span>{isZh ? `共 ${phases.length} 段` : `${phases.length} phases`}</span>
            {currentIdx >= 0 && (
              <span>
                {isZh ? `当前第 ${currentIdx + 1} 段` : `In phase ${currentIdx + 1}`}
              </span>
            )}
          </span>
        ) : null
      }
    >
      {/* 宽屏：等分的一排节点，连接线从每个节点圆心画到下一个节点圆心。
          分数留白（left-1/2 -right-1/2）跟着 flex-1 走，节点数变了也不用改魔法数字。 */}
      <ol className="hidden items-start md:flex">
        {nodes.map((node, idx) => {
          const isLast = idx === nodes.length - 1;
          return (
            <li key={node.key} className="relative min-w-0 flex-1">
              {!isLast && (
                <span
                  className="absolute left-1/2 -right-1/2 top-[5px] h-px bg-[#e5e2dc]"
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={() => setSelIdx(idx)}
                aria-pressed={active?.key === node.key}
                aria-current={node.state === "current" ? "step" : undefined}
                className="group relative z-10 flex w-full cursor-pointer flex-col items-center gap-1.5 px-1 text-center"
              >
                <AxisDot state={node.state} />
                <span
                  className={`max-w-full truncate ${
                    node.state === "exam" || node.state === "current" ? "ui-row-title" : "ui-group-title ui-muted"
                  }`}
                >
                  {node.name}
                </span>
                {node.meta && <span className="ui-row-meta tabular-nums">{node.meta}</span>}
              </button>
            </li>
          );
        })}
      </ol>

      {/* 窄屏：同一份节点数据换成纵向列表，日期不会被等分挤断。 */}
      <ol className="relative space-y-4 md:hidden">
        <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[#eae7e1]" aria-hidden="true" />
        {nodes.map((node, idx) => (
          <li key={node.key}>
            <button
              type="button"
              onClick={() => setSelIdx(idx)}
              aria-pressed={active?.key === node.key}
              aria-current={node.state === "current" ? "step" : undefined}
              className="relative flex w-full cursor-pointer items-center gap-3 text-left"
            >
              <AxisDot state={node.state} />
              <span className="min-w-0 flex-1 truncate ui-row-title">{node.name}</span>
              {node.meta && <span className="shrink-0 ui-row-meta tabular-nums">{node.meta}</span>}
            </button>
          </li>
        ))}
      </ol>

      {/* 描述是「点开才看」的那一层：只说选中这一段要做什么，别的一段都不占行。 */}
      {active?.detail && (
        <p className="mt-3 ui-note leading-relaxed">
          {hasDetail(nodes) && (
            <span className="mr-2 ui-chip">
              {active.state === "current" ? (isZh ? "进行中" : "Current") : `${nodes.indexOf(active) + 1}`}
            </span>
          )}
          {active.detail}
        </p>
      )}
    </SectionBlock>
  );
}
