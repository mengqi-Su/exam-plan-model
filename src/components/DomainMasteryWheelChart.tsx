import React, { useState, useMemo } from "react";
import { SyllabusTopic } from "../types";
import { CheckCircle2 } from "lucide-react";
import { getPaletteByIndex } from "../lib/themePalettes";

export interface TopicMasteryItem extends SyllabusTopic {
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
  avgRating: number;
}

interface DomainMasteryWheelChartProps {
  topics: TopicMasteryItem[];
  language?: "zh" | "en";
  onSelectTopic?: (topic: TopicMasteryItem) => void;
}

export function DomainMasteryWheelChart({
  topics,
  language = "zh",
  onSelectTopic,
}: DomainMasteryWheelChartProps) {
  const isZh = language === "zh";
  const [activeMetric, setActiveMetric] = useState<"progress" | "weight" | "tasks" | "score">("progress");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const displayItems = useMemo(() => {
    if (!topics || topics.length === 0) {
      return [
        {
          id: "def-1",
          title: language === "zh" ? "核心概念" : "Core Concepts",
          category: "基础",
          weightPercentage: 25,
          difficulty: "easy" as const,
          subtopics: ["概念定义", "基础定理", "公式推导"],
          totalTasks: 4,
          completedTasks: 3,
          progressPercent: 75,
          avgRating: 4.5,
          estimatedHours: 6,
        },
        {
          id: "def-2",
          title: language === "zh" ? "典型例题" : "Practice Problems",
          category: "进阶",
          weightPercentage: 35,
          difficulty: "hard" as const,
          subtopics: ["高频题型", "易错归纳", "解题套路"],
          totalTasks: 6,
          completedTasks: 4,
          progressPercent: 67,
          avgRating: 4.0,
          estimatedHours: 8,
        },
        {
          id: "def-3",
          title: language === "zh" ? "历年真题" : "Past Papers",
          category: "冲刺",
          weightPercentage: 25,
          difficulty: "hard" as const,
          subtopics: ["大题演练", "真题变式", "时间控制"],
          totalTasks: 5,
          completedTasks: 2,
          progressPercent: 40,
          avgRating: 3.5,
          estimatedHours: 6,
        },
        {
          id: "def-4",
          title: language === "zh" ? "错题重温" : "Review Weakspots",
          category: "巩固",
          weightPercentage: 15,
          difficulty: "medium" as const,
          subtopics: ["双黑调整", "负权回路", "剪枝边界"],
          totalTasks: 3,
          completedTasks: 1,
          progressPercent: 33,
          avgRating: 3.0,
          estimatedHours: 4,
        },
      ];
    }
    return topics;
  }, [topics, language]);

  const totalSectors = displayItems.length;
  const itemsToRender = displayItems;

  const size = 380;
  const center = size / 2;
  const outerRadius = 164;
  const innerRadius = 52;
  const sectorAngle = (2 * Math.PI) / totalSectors;
  // Precise gap in radians between sectors for crisp radial dividers
  const gapAngle = totalSectors > 1 ? Math.min(0.045, (sectorAngle * 0.12)) : 0;

  // Mathematically perfect circular arc sector path generator
  const getCircularSectorPath = (
    idx: number,
    fillFactor: number = 1.0,
    baseInnerR: number = innerRadius
  ) => {
    const midAngle = -Math.PI / 2 + (idx + 0.5) * sectorAngle;
    const halfSector = sectorAngle / 2;
    const effGap = totalSectors > 1 ? gapAngle : 0;
    const startAngle = midAngle - halfSector + effGap / 2;
    const endAngle = midAngle + halfSector - effGap / 2;

    const currentOuterR = baseInnerR + (outerRadius - baseInnerR) * Math.max(0.2, Math.min(1.0, fillFactor));

    const x1 = center + baseInnerR * Math.cos(startAngle);
    const y1 = center + baseInnerR * Math.sin(startAngle);

    const x2 = center + currentOuterR * Math.cos(startAngle);
    const y2 = center + currentOuterR * Math.sin(startAngle);

    const x3 = center + currentOuterR * Math.cos(endAngle);
    const y3 = center + currentOuterR * Math.sin(endAngle);

    const x4 = center + baseInnerR * Math.cos(endAngle);
    const y4 = center + baseInnerR * Math.sin(endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return `
      M ${x1} ${y1}
      L ${x2} ${y2}
      A ${currentOuterR} ${currentOuterR} 0 ${largeArc} 1 ${x3} ${y3}
      L ${x4} ${y4}
      A ${baseInnerR} ${baseInnerR} 0 ${largeArc} 0 ${x1} ${y1}
      Z
    `;
  };

  const getTextCenter = (idx: number, radiusRatio: number = 0.65) => {
    const midAngle = -Math.PI / 2 + (idx + 0.5) * sectorAngle;
    const r = innerRadius + (outerRadius - innerRadius) * radiusRatio;
    return {
      x: center + r * Math.cos(midAngle),
      y: center + r * Math.sin(midAngle),
      midAngle,
    };
  };

  // Overall average stats
  const overallAvgProgress = useMemo(() => {
    if (itemsToRender.length === 0) return 0;
    const sum = itemsToRender.reduce((acc, it) => acc + (it.progressPercent || 0), 0);
    return Math.round(sum / itemsToRender.length);
  }, [itemsToRender]);

  const activeItem = itemsToRender[selectedIdx] || itemsToRender[0];

  const metrics: { id: typeof activeMetric; label: string }[] = [
    { id: "progress", label: isZh ? "掌握进度" : "Progress" },
    { id: "weight", label: isZh ? "考点权重" : "Weight" },
    { id: "tasks", label: isZh ? "任务单元" : "Tasks" },
    { id: "score", label: isZh ? "自评得分" : "Rating" },
  ];

  const difficultyLabel = (d?: string) => {
    if (d === "easy") return isZh ? "基础" : "Easy";
    if (d === "hard") return isZh ? "困难" : "Hard";
    return isZh ? "中等" : "Medium";
  };

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-6 ui-card">
      {/* Left: Circular Dial / Wheel View */}
      <div className="flex flex-col items-center justify-center space-y-4">
        {/* Metric Selector (segmented) */}
        <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#f1efe9]">
          {metrics.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveMetric(m.id)}
              aria-pressed={activeMetric === m.id}
              className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                activeMetric === m.id
                  ? "bg-white text-[#1c1b1a] shadow-[0_1px_2px_rgba(28,27,26,0.08)]"
                  : "text-[#6b6660] hover:text-[#1c1b1a]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* SVG Circular Dial Container */}
        <div className="relative w-[320px] h-[320px] sm:w-[370px] sm:h-[370px] select-none flex items-center justify-center">
          <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
            {/* Outer rim & tick guides */}
            <circle cx={center} cy={center} r={outerRadius + 8} fill="none" stroke="#eae7e1" strokeWidth="1" strokeDasharray="2 3" />
            <circle cx={center} cy={center} r={outerRadius + 3} fill="none" stroke="#ddd8d0" strokeWidth="1" />

            {/* Concentric guide rings */}
            {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
              const r = innerRadius + (outerRadius - innerRadius) * ratio;
              return (
                <circle key={ratio} cx={center} cy={center} r={r} fill="none" stroke="#f0ede8" strokeWidth="0.75" strokeDasharray="2 2" />
              );
            })}

            {/* Calibration tick marks */}
            {Array.from({ length: 36 }).map((_, tickIdx) => {
              const angle = (tickIdx * 10 * Math.PI) / 180;
              const isMajor = tickIdx % 9 === 0;
              const r1 = outerRadius + 3;
              const r2 = outerRadius + (isMajor ? 7 : 5);
              return (
                <line
                  key={tickIdx}
                  x1={center + r1 * Math.cos(angle)}
                  y1={center + r1 * Math.sin(angle)}
                  x2={center + r2 * Math.cos(angle)}
                  y2={center + r2 * Math.sin(angle)}
                  stroke={isMajor ? "#a39e97" : "#ddd8d0"}
                  strokeWidth={isMajor ? "1.5" : "0.75"}
                />
              );
            })}

            {/* Sectors */}
            {itemsToRender.map((item, idx) => {
              const isHovered = hoveredIdx === idx;
              const isSelected = selectedIdx === idx;
              const palette = getPaletteByIndex(idx);

              let valDisplay = "";
              let fillRatio = 1.0;

              if (activeMetric === "progress") {
                valDisplay = `${item.progressPercent}%`;
                fillRatio = item.progressPercent / 100;
              } else if (activeMetric === "weight") {
                valDisplay = `${item.weightPercentage}%`;
                fillRatio = item.weightPercentage / 50;
              } else if (activeMetric === "tasks") {
                valDisplay = `${item.completedTasks}/${item.totalTasks}`;
                fillRatio = item.totalTasks > 0 ? item.completedTasks / item.totalTasks : 0.5;
              } else {
                valDisplay = item.avgRating ? `${item.avgRating.toFixed(1)}` : "3.5";
                fillRatio = (item.avgRating || 3.5) / 5;
              }

              const clampedRatio = Math.max(0.18, Math.min(1.0, fillRatio));
              const { x: textX, y: textY } = getTextCenter(idx, 0.64);

              return (
                <g
                  key={item.id || `sector-${idx}`}
                  onClick={() => {
                    setSelectedIdx(idx);
                    if (onSelectTopic) onSelectTopic(item);
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-200"
                >
                  {/* Background full sector track */}
                  <path
                    d={getCircularSectorPath(idx, 1.0)}
                    fill={isSelected ? "#f5f3ee" : isHovered ? "#faf9f6" : "#ffffff"}
                    stroke="#eae7e1"
                    strokeWidth={isSelected ? "1.5" : "1"}
                    className="transition-colors duration-150"
                  />

                  {/* Active value arc fill */}
                  <path
                    d={getCircularSectorPath(idx, clampedRatio)}
                    fill={isSelected ? "#1c1b1a" : palette.accentColor}
                    fillOpacity={isSelected ? 1 : 0.9}
                    stroke={isSelected ? "#1c1b1a" : "#ddd8d0"}
                    strokeWidth={isSelected ? "1.5" : "1"}
                    className="transition-all duration-200"
                  />

                  {/* Sector metric value */}
                  <text
                    x={textX}
                    y={textY - 3}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? (clampedRatio > 0.45 ? "#ffffff" : "#1c1b1a") : "#1c1b1a"}
                    className="font-semibold text-[12px] sm:text-[13px] pointer-events-none select-none"
                  >
                    {valDisplay}
                  </text>

                  {/* Sector short title */}
                  <text
                    x={textX}
                    y={textY + 11}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? (clampedRatio > 0.45 ? "#ffffff" : "#6b6660") : "#8a8580"}
                    className="font-medium text-[9px] sm:text-[10px] pointer-events-none select-none"
                  >
                    {item.title.length > 5 ? `${item.title.slice(0, 4)}..` : item.title}
                  </text>
                </g>
              );
            })}

            {/* Central hub */}
            <circle cx={center} cy={center} r={innerRadius - 2} fill="#ffffff" stroke="#ddd8d0" strokeWidth="1.5" />
            <circle cx={center} cy={center} r={innerRadius - 6} fill="#faf9f6" stroke="#f0ede8" strokeWidth="1" />

            <text x={center} y={center - 11} textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-medium fill-[#a39e97]">
              {isZh ? "平均掌握度" : "Avg mastery"}
            </text>
            <text x={center} y={center + 3} textAnchor="middle" dominantBaseline="middle" className="text-[16px] font-semibold fill-[#1c1b1a] tracking-tight">
              {overallAvgProgress}%
            </text>
            <text x={center} y={center + 17} textAnchor="middle" dominantBaseline="middle" className="text-[8px] font-medium fill-[#8a8580]">
              {totalSectors} {isZh ? "个考点" : "topics"}
            </text>
          </svg>
        </div>
      </div>

      {/* Right: Topic detail card */}
      <div className="flex-1 w-full max-w-md ui-card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#f0ede8] pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: getPaletteByIndex(selectedIdx).accentColor }}
              aria-hidden="true"
            />
            <span className="text-[14px] font-semibold text-[#1c1b1a] truncate">
              {isZh ? "考点深度解构" : "Topic details"}
            </span>
          </div>
          <span className="ui-chip shrink-0">
            {activeItem.category || (isZh ? "重点考点" : "Core")}
          </span>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-semibold text-[#1c1b1a] tracking-tight">{activeItem.title}</h4>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] ui-muted">
            <span>
              {isZh ? "权重" : "Weight"} <b className="text-[#1c1b1a] font-medium tabular-nums">{activeItem.weightPercentage}%</b>
            </span>
            <span className="ui-subtle">·</span>
            <span>
              {isZh ? "难度" : "Difficulty"} <b className="text-[#1c1b1a] font-medium">{difficultyLabel(activeItem.difficulty)}</b>
            </span>
            <span className="ui-subtle">·</span>
            <span>
              {isZh ? "预估" : "Est"} <b className="text-[#1c1b1a] font-medium tabular-nums">{activeItem.estimatedHours || 6}h</b>
            </span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="ui-muted">{isZh ? "复习完成进度" : "Completion"}</span>
            <span className="text-[#1c1b1a] font-medium tabular-nums">
              {activeItem.progressPercent}% ({activeItem.completedTasks}/{activeItem.totalTasks})
            </span>
          </div>
          <div className="w-full bg-[#f1efe9] h-2 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${activeItem.progressPercent}%`,
                backgroundColor: getPaletteByIndex(selectedIdx).accentColor,
              }}
            />
          </div>
        </div>

        {activeItem.subtopics && activeItem.subtopics.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#f0ede8]">
            <span className="text-[12px] font-medium ui-muted block">
              {isZh ? "核心子考点" : "Subtopics & concepts"}
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {activeItem.subtopics.map((sub, sIdx) => (
                <div
                  key={sIdx}
                  className="flex items-center gap-2 text-[12.5px] text-[#3f3b36] bg-[#faf9f6] rounded-lg p-2 border border-[#f0ede8]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#3F6B4F] shrink-0" />
                  <span>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-[#faf9f6] border border-[#f0ede8] p-2.5 text-[12.5px]">
          <span className="ui-muted">{isZh ? "掌握度自评" : "Confidence"}</span>
          <span className="font-semibold text-[#1c1b1a] tabular-nums">
            {activeItem.avgRating ? `${activeItem.avgRating.toFixed(1)} / 5.0` : isZh ? "待首次评分" : "Not rated yet"}
          </span>
        </div>
      </div>
    </div>
  );
}