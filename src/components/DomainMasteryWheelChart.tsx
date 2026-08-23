import React, { useState, useMemo } from "react";
import { SyllabusTopic, StudyTask } from "../types";
import { Layers, PieChart, Table, Sparkles, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";
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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(0);

  const displayItems = useMemo(() => {
    if (!topics || topics.length === 0) {
      return [
        {
          id: "def-1",
          title: language === "zh" ? "核心概念" : "Core Concepts",
          category: "基础",
          weightPercentage: 25,
          difficulty: "easy" as const,
          subtopics: [],
          totalTasks: 4,
          completedTasks: 3,
          progressPercent: 75,
          avgRating: 4.5,
        },
        {
          id: "def-2",
          title: language === "zh" ? "典型例题" : "Practice Problems",
          category: "进阶",
          weightPercentage: 35,
          difficulty: "hard" as const,
          subtopics: [],
          totalTasks: 6,
          completedTasks: 4,
          progressPercent: 67,
          avgRating: 4.0,
        },
        {
          id: "def-3",
          title: language === "zh" ? "历年真题" : "Past Papers",
          category: "冲刺",
          weightPercentage: 25,
          difficulty: "hard" as const,
          subtopics: [],
          totalTasks: 5,
          completedTasks: 2,
          progressPercent: 40,
          avgRating: 3.5,
        },
        {
          id: "def-4",
          title: language === "zh" ? "错题总结" : "Review Weakspots",
          category: "巩固",
          weightPercentage: 15,
          difficulty: "medium" as const,
          subtopics: [],
          totalTasks: 3,
          completedTasks: 1,
          progressPercent: 33,
          avgRating: 3.0,
        },
      ];
    }
    return topics;
  }, [topics, language]);

  const numSectors = Math.max(displayItems.length, 4);
  const totalSectors = numSectors <= 8 ? numSectors : 8;
  const itemsToRender = displayItems.slice(0, totalSectors);

  const size = 360;
  const center = size / 2;
  const outerRadius = 160;
  const innerRadius = 38;
  const sectorAngle = (2 * Math.PI) / totalSectors;
  const gapAngle = (4 * Math.PI) / 180;

  const getPetalPath = (idx: number, fillFactor: number = 1.0) => {

    const midAngle = -Math.PI / 2 + idx * sectorAngle;
    const startAngle = midAngle - sectorAngle / 2 + gapAngle / 2;
    const endAngle = midAngle + sectorAngle / 2 - gapAngle / 2;

    const currentOuterRadius = innerRadius + (outerRadius - innerRadius) * Math.max(0.4, Math.min(1.0, fillFactor));

    const x1 = center + innerRadius * Math.cos(startAngle);
    const y1 = center + innerRadius * Math.sin(startAngle);

    const x2 = center + currentOuterRadius * Math.cos(startAngle);
    const y2 = center + currentOuterRadius * Math.sin(startAngle);

    const x3 = center + currentOuterRadius * Math.cos(endAngle);
    const y3 = center + currentOuterRadius * Math.sin(endAngle);

    const x4 = center + innerRadius * Math.cos(endAngle);
    const y4 = center + innerRadius * Math.sin(endAngle);

    const xMidOuter = center + (currentOuterRadius + 6) * Math.cos(midAngle);
    const yMidOuter = center + (currentOuterRadius + 6) * Math.sin(midAngle);

    return `
      M ${x1} ${y1}
      L ${x2} ${y2}
      Q ${xMidOuter} ${yMidOuter} ${x3} ${y3}
      L ${x4} ${y4}
      A ${innerRadius} ${innerRadius} 0 0 0 ${x1} ${y1}
      Z
    `;
  };

  const getTextCenter = (idx: number, radiusRatio: number = 0.68) => {
    const midAngle = -Math.PI / 2 + idx * sectorAngle;
    const r = innerRadius + (outerRadius - innerRadius) * radiusRatio;
    return {
      x: center + r * Math.cos(midAngle),
      y: center + r * Math.sin(midAngle),
      midAngle,
    };
  };

  const activeItem = selectedIdx !== null && itemsToRender[selectedIdx]
    ? itemsToRender[selectedIdx]
    : itemsToRender[0];

  return (
    <div className="flex flex-col lg:flex-row items-center justify-between gap-8 p-6 bg-white border border-[#111111] font-mono">

      <div className="flex flex-col items-center justify-center space-y-4">

        <div className="flex items-center space-x-1.5 p-1 bg-[#faf9f6] border border-[#111111] text-[10px] font-bold">
          <span className="text-[#888888] px-1.5">{language === "zh" ? "罗盘指标:" : "METRIC:"}</span>
          <button
            onClick={() => setActiveMetric("progress")}
            className={`px-2 py-0.5 transition-colors cursor-pointer ${
              activeMetric === "progress"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "掌握进度 %" : "Progress %"}
          </button>
          <button
            onClick={() => setActiveMetric("weight")}
            className={`px-2 py-0.5 transition-colors cursor-pointer ${
              activeMetric === "weight"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "考点权重 %" : "Weight %"}
          </button>
          <button
            onClick={() => setActiveMetric("tasks")}
            className={`px-2 py-0.5 transition-colors cursor-pointer ${
              activeMetric === "tasks"
                ? "bg-[#111111] text-white"
                : "text-[#111111] hover:bg-[#e4e1d8]"
            }`}
          >
            {language === "zh" ? "任务单元数" : "Tasks"}
          </button>
        </div>

        <div className="relative w-[320px] h-[320px] sm:w-[360px] sm:h-[360px] select-none">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-full h-full drop-shadow-sm overflow-visible"
          >

            {itemsToRender.map((item, idx) => {
              const isHovered = hoveredIdx === idx;
              const isSelected = selectedIdx === idx;
              const palette = getPaletteByIndex(idx);

              let valDisplay = "";
              let fillRatio = 1.0;

              if (activeMetric === "progress") {
                valDisplay = `${item.progressPercent}%`;
                fillRatio = Math.max(0.45, item.progressPercent / 100);
              } else if (activeMetric === "weight") {
                valDisplay = `${item.weightPercentage}%`;
                fillRatio = Math.max(0.45, item.weightPercentage / 50);
              } else if (activeMetric === "tasks") {
                valDisplay = `${item.completedTasks}/${item.totalTasks}`;
                fillRatio = Math.max(0.45, item.totalTasks > 0 ? item.completedTasks / item.totalTasks : 0.5);
              } else {
                valDisplay = item.avgRating ? `${item.avgRating.toFixed(1)}` : "3.5";
                fillRatio = Math.max(0.45, (item.avgRating || 3) / 5);
              }

              const { x: textX, y: textY } = getTextCenter(idx, 0.65);

              return (
                <g
                  key={item.id || `petal-${idx}`}
                  onClick={() => {
                    setSelectedIdx(idx);
                    if (onSelectTopic) onSelectTopic(item);
                  }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className="cursor-pointer transition-all duration-200"
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                    transform: isSelected || isHovered ? "scale(1.03)" : "scale(1.0)",
                  }}
                >

                  <path
                    d={getPetalPath(idx, 1.0)}
                    fill={isSelected ? "#111111" : palette.accentColor}
                    stroke="#111111"
                    strokeWidth={isSelected ? "2.5" : "1.5"}
                    className="transition-colors duration-150"
                  />

                  <path
                    d={getPetalPath(idx, isSelected ? 0.94 : 0.90)}
                    fill={isSelected ? "#ffffff" : isHovered ? "#ffffff" : "#faf9f6"}
                    fillOpacity="1"
                    stroke="#111111"
                    strokeWidth="1.2"
                    className="transition-all duration-300"
                  />

                  <text
                    x={textX}
                    y={textY - 4}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#111111"
                    className="font-bold font-mono text-[13px] sm:text-[14px]"
                  >
                    {valDisplay}
                  </text>

                  <text
                    x={textX}
                    y={textY + 12}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#333333"
                    className="font-mono font-bold text-[9px] sm:text-[10px]"
                  >
                    {item.title.length > 6 ? `${item.title.slice(0, 5)}..` : item.title}
                  </text>
                </g>
              );
            })}

            <circle
              cx={center}
              cy={center}
              r={innerRadius - 4}
              fill="#ffffff"
              stroke="#111111"
              strokeWidth="2"
            />

            <text
              x={center}
              y={center - 3}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[9px] font-bold fill-[#111111] uppercase font-mono"
            >
              DOMAIN
            </text>
            <text
              x={center}
              y={center + 8}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-[8px] font-bold fill-[#666666] font-mono"
            >
              {itemsToRender.length} SECTORS
            </text>
          </svg>
        </div>

        <span className="text-[10px] text-[#888888] text-center max-w-xs">
          {language === "zh"
            ? "✦ 点击或悬停花瓣扇区，查看对应考点的深度掌握详情与关联任务"
            : "✦ Click or hover any petal sector to inspect topic mastery and subtopics"}
        </span>
      </div>

      <div className="flex-1 w-full max-w-md bg-[#faf9f6] border border-[#111111] p-5 space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#111111] pb-3">
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 border border-[#111111]"
              style={{ backgroundColor: getPaletteByIndex(selectedIdx ?? 0).accentColor }}
            />
            <span className="text-xs font-bold uppercase text-[#111111]">
              [{language === "zh" ? "考点深度解构" : "TOPIC DECONSTRUCTION"}]
            </span>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 border border-[#111111] font-bold ${getPaletteByIndex(selectedIdx ?? 0).textPrimary}`}
            style={{
              backgroundColor: getPaletteByIndex(selectedIdx ?? 0).accentColor,
            }}
          >
            {activeItem.category || (language === "zh" ? "重点考点" : "CORE")}
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
            <span className="text-[#666666]">{language === "zh" ? "复习完成度" : "Completion Progress"}</span>
            <span className="text-[#111111]">
              {activeItem.progressPercent}% ({activeItem.completedTasks}/{activeItem.totalTasks} {language === "zh" ? "单元" : "tasks"})
            </span>
          </div>
          <div className="w-full bg-white border border-[#111111] h-2.5 overflow-hidden">
            <div
              className="h-full transition-all duration-300 border-r border-[#111111]"
              style={{
                width: `${activeItem.progressPercent}%`,
                backgroundColor: getPaletteByIndex(selectedIdx ?? 0).accentColor,
              }}
            />
          </div>
        </div>

        {activeItem.subtopics && activeItem.subtopics.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-[#e8e6df]">
            <span className="text-[11px] font-bold text-[#666666] uppercase block">
              {language === "zh" ? "核心子考点 / 概念清单" : "SUBTOPICS & CONCEPTS"}:
            </span>
            <div className="space-y-1.5">
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
