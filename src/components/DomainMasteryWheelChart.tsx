import React, { useState, useMemo } from "react";
import { SyllabusTopic } from "../types";
import { PieChart, CheckCircle2, Award, Zap, BookOpen, Clock, Target } from "lucide-react";
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

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-6 bg-white border border-[#111111] font-mono">
      {/* Left: Circular Dial / Wheel View */}
      <div className="flex flex-col items-center justify-center space-y-4">
        {/* Metric Selector Pills */}
        <div className="flex items-center space-x-1.5 p-1 bg-[#faf9f6] border border-[#111111] text-[10px] font-bold">
          <span className="text-[#888888] px-1.5">{language === "zh" ? "圆盘指标:" : "METRIC:"}</span>
          <button
            onClick={() => setActiveMetric("progress")}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              activeMetric === "progress"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "掌握进度 %" : "Progress %"}
          </button>
          <button
            onClick={() => setActiveMetric("weight")}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              activeMetric === "weight"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "考点权重 %" : "Weight %"}
          </button>
          <button
            onClick={() => setActiveMetric("tasks")}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              activeMetric === "tasks"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "任务单元数" : "Tasks"}
          </button>
          <button
            onClick={() => setActiveMetric("score")}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              activeMetric === "score"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "自评得分" : "Rating"}
          </button>
        </div>

        {/* SVG Circular Dial Container */}
        <div className="relative w-[320px] h-[320px] sm:w-[370px] sm:h-[370px] select-none flex items-center justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full drop-shadow-sm overflow-visible"
          >
            {/* Outer Precision Circular Rim & Tick Guides */}
            <circle
              cx={center}
              cy={center}
              r={outerRadius + 8}
              fill="none"
              stroke="#e5e5e5"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <circle
              cx={center}
              cy={center}
              r={outerRadius + 3}
              fill="none"
              stroke="#111111"
              strokeWidth="1"
            />

            {/* Concentric Guide Grid Rings */}
            {[0.25, 0.5, 0.75, 1.0].map((ratio) => {
              const r = innerRadius + (outerRadius - innerRadius) * ratio;
              return (
                <circle
                  key={ratio}
                  cx={center}
                  cy={center}
                  r={r}
                  fill="none"
                  stroke="#e0dfd5"
                  strokeWidth="0.75"
                  strokeDasharray="2 2"
                />
              );
            })}

            {/* Calibration tick marks on outer rim */}
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
                  stroke="#111111"
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

              // Clamp fillRatio between 0.15 and 1.0 for visual balance
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
                  {/* Background Full Sector Track */}
                  <path
                    d={getCircularSectorPath(idx, 1.0)}
                    fill={isSelected ? "#f5f5f0" : isHovered ? "#faf9f6" : "#ffffff"}
                    stroke="#111111"
                    strokeWidth={isSelected ? "2" : "1"}
                    className="transition-colors duration-150"
                  />

                  {/* Active Value Arc Fill */}
                  <path
                    d={getCircularSectorPath(idx, clampedRatio)}
                    fill={isSelected ? "#111111" : palette.accentColor}
                    fillOpacity={isSelected ? 1 : 0.85}
                    stroke="#111111"
                    strokeWidth={isSelected ? "2" : "1"}
                    className="transition-all duration-200"
                  />

                  {/* Sector Metric Value Text */}
                  <text
                    x={textX}
                    y={textY - 3}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? (clampedRatio > 0.45 ? "#ffffff" : "#111111") : "#111111"}
                    className="font-bold font-mono text-[12px] sm:text-[13px] pointer-events-none select-none"
                  >
                    {valDisplay}
                  </text>

                  {/* Sector Short Title Text */}
                  <text
                    x={textX}
                    y={textY + 11}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? (clampedRatio > 0.45 ? "#ffffff" : "#333333") : "#444444"}
                    className="font-mono font-bold text-[9px] sm:text-[10px] pointer-events-none select-none"
                  >
                    {item.title.length > 5 ? `${item.title.slice(0, 4)}..` : item.title}
                  </text>
                </g>
              );
            })}

            {/* Central Precision Hub Dial */}
            <circle
              cx={center}
              cy={center}
              r={innerRadius - 2}
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="2"
            />
            <circle
              cx={center}
              cy={center}
              r={innerRadius - 6}
              fill="#faf9f6"
              stroke="#e0dfd5"
              strokeWidth="1"
            />

            {/* Center Dial Information */}
            <text
              x={center}
              y={center - 11}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] font-bold fill-[#888888] uppercase tracking-wider font-mono"
            >
              {language === "zh" ? "平均掌握度" : "AVG MASTERY"}
            </text>
            <text
              x={center}
              y={center + 3}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[16px] font-bold fill-[#111111] font-mono tracking-tight"
            >
              {overallAvgProgress}%
            </text>
            <text
              x={center}
              y={center + 17}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] font-bold fill-[#666666] font-mono"
            >
              {totalSectors} {language === "zh" ? "考点扇区" : "SECTORS"}
            </text>
          </svg>
        </div>

        {/* Caption Hint */}
        <span className="text-[11px] text-[#666666] text-center max-w-xs">
          {language === "zh"
            ? "✦ 点击圆盘各考点扇区，右侧实时联动深度掌握明细"
            : "✦ Click circular sectors to inspect domain deconstruction and subtopics"}
        </span>
      </div>

      {/* Right: Topic Deconstruction Card */}
      <div className="flex-1 w-full max-w-md bg-[#faf9f6] border border-[#111111] p-5 space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#111111] pb-3">
          <div className="flex items-center space-x-2">
            <div
              className="w-3.5 h-3.5 border border-[#111111]"
              style={{ backgroundColor: getPaletteByIndex(selectedIdx).accentColor }}
            />
            <span className="text-xs font-bold uppercase text-[#111111]">
              [{language === "zh" ? "考点深度解构" : "TOPIC DECONSTRUCTION"}]
            </span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 border border-[#111111] font-bold ${getPaletteByIndex(selectedIdx).textPrimary}`}
            style={{
              backgroundColor: getPaletteByIndex(selectedIdx).accentColor,
            }}
          >
            {activeItem.category || (language === "zh" ? "重点考点" : "CORE DOMAIN")}
          </span>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-base font-bold text-[#111111]">{activeItem.title}</h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#666666]">
            <span className="font-bold text-[#111111]">
              {language === "zh" ? "权重占比" : "Weight"}: {activeItem.weightPercentage}%
            </span>
            <span>•</span>
            <span>
              {language === "zh" ? "难度等级" : "Difficulty"}: <strong className="text-[#111111] uppercase">[{activeItem.difficulty}]</strong>
            </span>
            <span>•</span>
            <span>
              {language === "zh" ? "预估学时" : "Est"}: {activeItem.estimatedHours || 6}h
            </span>
          </div>
        </div>

        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-[#666666]">{language === "zh" ? "复习完成进度" : "Completion Progress"}</span>
            <span className="text-[#111111]">
              {activeItem.progressPercent}% ({activeItem.completedTasks}/{activeItem.totalTasks} {language === "zh" ? "单元" : "tasks"})
            </span>
          </div>
          <div className="w-full bg-white border border-[#111111] h-3 overflow-hidden">
            <div
              className="h-full transition-all duration-300 border-r border-[#111111]"
              style={{
                width: `${activeItem.progressPercent}%`,
                backgroundColor: getPaletteByIndex(selectedIdx).accentColor,
              }}
            />
          </div>
        </div>

        {activeItem.subtopics && activeItem.subtopics.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#e8e6df]">
            <span className="text-[11px] font-bold text-[#666666] uppercase block">
              {language === "zh" ? "核心子考点 / 概念清单" : "SUBTOPICS & CONCEPTS"}:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {activeItem.subtopics.map((sub, sIdx) => (
                <div
                  key={sIdx}
                  className="flex items-center space-x-2 text-xs text-[#333333] bg-white p-2 border border-[#e5e5e5]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#111111] shrink-0" />
                  <span className="font-sans text-[11px]">{sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between p-2.5 bg-white border border-[#111111] text-xs">
          <span className="text-[#666666] font-bold">
            {language === "zh" ? "AI 掌握度自适应评分" : "Mastery Confidence"}:
          </span>
          <span className="font-bold text-[#111111]">
            {activeItem.avgRating ? `${activeItem.avgRating.toFixed(1)} / 5.0 ★` : (language === "zh" ? "待首次自测" : "Pending Quiz")}
          </span>
        </div>
      </div>
    </div>
  );
}
