import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  Play,
  Trash2,
  X,
  Calendar as CalendarIcon,
  FileText,
} from "lucide-react";
import { StudyTask, ExamStudyPlan } from "../types";
import { generateGoogleCalendarUrl } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";
import { MasteryStars } from "./MasteryStars";

interface PinnedRoadmapTodoListProps {
  plan?: ExamStudyPlan | null;
  tasks: StudyTask[];
  onToggleComplete: (taskId: string) => void;
  onUpdateConfidence: (taskId: string, rating: 1 | 2 | 3 | 4 | 5) => void;
  onSaveNotes: (taskId: string, notes: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartTimer: (task: StudyTask) => void;
  selectedDate: string;
}

// 4 App Brand Themes (Canary Yellow, Concrete Gray, Stone Gray, Dark Slate)
interface NoteTheme {
  id: string;
  name: string;
  pinGradient: string;
  pinShadow: string;
  headerBg: string;
  badgeColor: string;
  titleColor: string;
}

const FOUR_NOTE_THEMES: NoteTheme[] = [
  // 01: Canary Yellow (明黄档案)
  {
    id: "canary-yellow",
    name: "Canary Yellow",
    pinGradient: "radial-gradient(circle at 35% 35%, #FFF9C4 0%, #FCD33B 45%, #F59E0B 85%, #B45309 100%)",
    pinShadow: "rgba(180, 83, 9, 0.4)",
    headerBg: "#FCD33B",
    badgeColor: "#1c1b1a",
    titleColor: "#1c1b1a",
  },
  // 02: Concrete Gray (水泥浅灰)
  {
    id: "concrete-gray",
    name: "Concrete Gray",
    pinGradient: "radial-gradient(circle at 35% 35%, #FFFFFF 0%, #D8D8D8 45%, #9E9E9E 85%, #616161 100%)",
    pinShadow: "rgba(97, 97, 97, 0.4)",
    headerBg: "#D8D8D8",
    badgeColor: "#1c1b1a",
    titleColor: "#1c1b1a",
  },
  // 03: Stone Gray (岩石中灰)
  {
    id: "stone-gray",
    name: "Stone Gray",
    pinGradient: "radial-gradient(circle at 35% 35%, #F5F5F5 0%, #B5B5B5 45%, #757575 85%, #424242 100%)",
    pinShadow: "rgba(66, 66, 66, 0.4)",
    headerBg: "#B5B5B5",
    badgeColor: "#1c1b1a",
    titleColor: "#1c1b1a",
  },
  // 04: Dark Slate (黑曜曜岩)
  {
    id: "dark-slate",
    name: "Dark Slate",
    pinGradient: "radial-gradient(circle at 35% 35%, #6B7280 0%, #374151 45%, #1F2937 85%, #111111 100%)",
    pinShadow: "rgba(17, 17, 17, 0.5)",
    headerBg: "#282828",
    badgeColor: "#FCD33B",
    titleColor: "#FFFFFF",
  },
];

// 3D Translucent Pushpin Matching the 4 App Themes
export function JellyPushpin({
  theme,
  size = 26,
  className = "",
}: {
  theme: NoteTheme;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Pin Shadow on paper */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.9,
          height: size * 0.4,
          bottom: -size * 0.15,
          right: -size * 0.1,
          backgroundColor: theme.pinShadow,
          filter: "blur(3px)",
          opacity: 0.7,
          transform: "rotate(-15deg)",
        }}
      />

      {/* Pin Base Flange */}
      <div
        className="absolute rounded-full border border-black/30"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: theme.pinGradient,
          boxShadow: `0 3px 6px -1px ${theme.pinShadow}, inset 0 -2px 3px rgba(0,0,0,0.35), inset 0 2px 3px rgba(255,255,255,0.7)`,
        }}
      />

      {/* Pin Central Dome */}
      <div
        className="absolute rounded-full border border-white/60"
        style={{
          width: size * 0.62,
          height: size * 0.62,
          background: theme.pinGradient,
          boxShadow: `0 2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.85)`,
        }}
      >
        {/* Specular Gloss Dot */}
        <div
          className="absolute rounded-full bg-white/90"
          style={{
            width: size * 0.2,
            height: size * 0.14,
            top: size * 0.08,
            left: size * 0.12,
            transform: "rotate(-35deg)",
          }}
        />
      </div>
    </div>
  );
}

export function PinnedRoadmapTodoList({
  plan,
  tasks,
  onToggleComplete,
  onUpdateConfidence,
  onSaveNotes,
  onDeleteTask,
  onStartTimer,
}: PinnedRoadmapTodoListProps) {
  const { t, language } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [activeNotesId, setActiveNotesId] = useState<string | null>(null);
  const [svgPaths, setSvgPaths] = useState<string[]>([]);

  // Calculate dynamic dashed curve connecting all 4-theme pins
  const updateConnectorLines = () => {
    if (!containerRef.current || tasks.length < 2) {
      setSvgPaths([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const positions: Array<{ x: number; y: number }> = [];

    tasks.forEach((task) => {
      const el = cardRefs.current.get(task.id);
      if (el) {
        const pinEl = el.querySelector(".pin-anchor");
        if (pinEl) {
          const pinRect = pinEl.getBoundingClientRect();
          positions.push({
            x: pinRect.left + pinRect.width / 2 - containerRect.left,
            y: pinRect.top + pinRect.height / 2 - containerRect.top,
          });
        } else {
          const cardRect = el.getBoundingClientRect();
          positions.push({
            x: cardRect.left + cardRect.width / 2 - containerRect.left,
            y: cardRect.top + 16 - containerRect.top,
          });
        }
      }
    });

    const paths: string[] = [];
    for (let i = 0; i < positions.length - 1; i++) {
      const p1 = positions[i];
      const p2 = positions[i + 1];
      const midY = (p1.y + p2.y) / 2;
      const cp1x = p1.x + (p2.x - p1.x) * 0.12;
      const cp1y = midY;
      const cp2x = p2.x - (p2.x - p1.x) * 0.12;
      const cp2y = midY;

      paths.push(`M ${p1.x} ${p1.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
    }

    setSvgPaths(paths);
  };

  useEffect(() => {
    updateConnectorLines();
    const handleResize = () => updateConnectorLines();
    window.addEventListener("resize", handleResize);

    const observer = new ResizeObserver(() => {
      updateConnectorLines();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    const tId = setTimeout(updateConnectorLines, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      clearTimeout(tId);
    };
  }, [tasks, activeNotesId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full p-4 sm:p-6 min-h-[420px] overflow-hidden select-text rounded-xl border border-[#eae7e1] bg-[#faf9f6] shadow-[0_1px_2px_rgba(28,27,26,0.04)]"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-3 mb-5 border-b ui-divider">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#1c1b1a] inline-block shrink-0" />
          <h2 className="text-[15px] font-semibold tracking-tight text-[#1c1b1a]">
            {language === "zh" ? "今日任务路线" : "Study roadmap"}
          </h2>
          <span className="ui-chip tabular-nums">
            {tasks.filter((t) => t.status === "completed").length} / {tasks.length}
          </span>
        </div>
      </div>

      {/* SVG Dashed Connecting Path in Background */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-0"
        style={{ overflow: "visible" }}
      >
        {svgPaths.map((d, idx) => (
          <path
            key={idx}
            d={d}
            fill="none"
            stroke="#d8d4cc"
            strokeWidth="1.5"
            strokeDasharray="5 6"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Alternating Zigzag Pinned Cards */}
      <div className="relative z-10 flex flex-col space-y-6 sm:space-y-7 pb-2">
        {tasks.map((task, index) => {
          const isCompleted = task.status === "completed";
          // Strict rotation through the 4 app palettes
          const theme = FOUR_NOTE_THEMES[index % FOUR_NOTE_THEMES.length];
          const isRightAligned = index % 2 === 1;
          const numberStr = String(index + 1).padStart(2, "0");

          // Natural subtle tilt
          const rotationAngles = [-1.2, 1.4, -0.9, 1.1];
          const currentRotation = isCompleted ? 0 : rotationAngles[index % rotationAngles.length];

          return (
            <div
              key={task.id}
              ref={(el) => {
                if (el) cardRefs.current.set(task.id, el);
                else cardRefs.current.delete(task.id);
              }}
              className={`w-full flex ${
                isRightAligned ? "justify-end sm:pl-12 md:pl-24" : "justify-start sm:pr-12 md:pr-24"
              } transition-all duration-300`}
            >
              {/* Sticky card: keeps the coloured note head and pushpin, uses the shared card language */}
              <div
                className={`relative w-full max-w-sm sm:max-w-md rounded-xl bg-white overflow-visible transition-all duration-300 group ${
                  isCompleted
                    ? "border border-[#eae7e1] shadow-[0_1px_2px_rgba(28,27,26,0.04)]"
                    : "ui-card ui-card-hover hover:-translate-y-0.5"
                }`}
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                }}
              >
                {/* 3D Pushpin Centered Top */}
                <button
                  type="button"
                  className="pin-anchor absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 cursor-pointer transition-transform duration-200 group-hover:scale-110 active:scale-95"
                  onClick={() => onToggleComplete(task.id)}
                  title={isCompleted ? t("statusPending") : t("statusDone")}
                  aria-label={isCompleted ? t("statusPending") : t("statusDone")}
                >
                  <JellyPushpin theme={theme} size={24} />
                </button>

                {/* Card Top Block in One of the 4 App Theme Colors */}
                <div
                  className="px-4 pt-5 pb-3 rounded-t-xl border-b border-black/10 transition-colors"
                  style={{
                    backgroundColor: theme.headerBg,
                  }}
                >
                  <div className="flex items-center justify-between">
                    {/* Number (01, 02, 03...) */}
                    <span
                      className="text-[15px] font-semibold leading-none select-none tabular-nums"
                      style={{ color: theme.badgeColor }}
                    >
                      {numberStr}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Duration Tag */}
                      <span
                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.72)",
                          color: theme.titleColor,
                        }}
                      >
                        {task.durationMinutes} {language === "zh" ? "分钟" : "min"}
                      </span>

                      {/* Complete Checkbox */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                          isCompleted
                            ? "bg-[#1c1b1a] border-[#1c1b1a] text-white"
                            : "bg-white/80 border-black/15 text-transparent hover:text-[#6b6660]"
                        }`}
                        title={isCompleted ? t("statusPending") : t("statusDone")}
                        aria-label={isCompleted ? t("statusPending") : t("statusDone")}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Title directly inside colored header block */}
                  <h3
                    className={`mt-2 text-[13px] font-medium leading-snug cursor-pointer transition-colors ${
                      isCompleted ? "line-through" : ""
                    }`}
                    style={{ color: theme.titleColor }}
                    onClick={() => onToggleComplete(task.id)}
                  >
                    {task.title}
                  </h3>
                </div>

                {/* Card White Body */}
                <div className="p-4 space-y-2.5 bg-white rounded-b-xl">
                  {/* Task Description */}
                  {task.description && (
                    <p
                      className={`text-[13px] leading-relaxed ${
                        isCompleted ? "line-through text-[#6b6660]" : "text-[#1c1b1a]"
                      }`}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* Bullet Sub-points */}
                  {task.keyObjectives && task.keyObjectives.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      {task.keyObjectives.map((obj, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[13px] leading-relaxed text-[#6b6660]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#d8d4cc] mt-1.5 shrink-0" />
                          <span className={isCompleted ? "line-through text-[#6b6660]" : ""}>
                            {obj}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes Drawer */}
                  {activeNotesId === task.id && (
                    <div className="pt-2.5 border-t ui-divider space-y-1.5">
                      <div className="flex items-center justify-between text-[12px] font-medium text-[#6b6660]">
                        <span>{language === "zh" ? "任务笔记" : "Task notes"}</span>
                        <button
                          onClick={() => setActiveNotesId(null)}
                          className="p-1 rounded-lg text-[#6b6660] hover:text-[#1c1b1a] cursor-pointer"
                          aria-label={language === "zh" ? "关闭笔记" : "Close notes"}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={3}
                        value={task.notes || ""}
                        onChange={(e) => onSaveNotes(task.id, e.target.value)}
                        placeholder={language === "zh" ? "记录卡点、易错点或下一步..." : "Capture blockers, traps, or the next step..."}
                        className="w-full bg-[#faf9f6] rounded-lg border border-[#e5e2dc] p-2.5 text-[13px] text-[#1c1b1a] placeholder-[#716c65] focus:border-[#1c1b1a] leading-relaxed"
                        autoFocus
                        aria-label={language === "zh" ? "任务笔记" : "Task notes"}
                      />
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="pt-2.5 border-t ui-divider flex items-center justify-between">
                    {/* Mastery rating */}
                    <MasteryStars
                      value={task.confidenceRating || 0}
                      onChange={(rating) => onUpdateConfidence(task.id, rating)}
                      labelFor={(star) => (language === "zh" ? `掌握程度 ${star} 星` : `Confidence ${star} of 5`)}
                    />

                    {/* Tool Buttons */}
                    <div className="flex items-center gap-1">
                      {/* Focus Timer */}
                      <button
                        onClick={() => onStartTimer(task)}
                        className="p-2 min-w-8 min-h-8 rounded-lg border border-transparent hover:border-[#eae7e1] hover:bg-[#f1efe9] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
                        title={t("startFocusTimer")}
                        aria-label={t("startFocusTimer")}
                      >
                        <Play className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setActiveNotesId(activeNotesId === task.id ? null : task.id)}
                        className={`p-2 min-w-8 min-h-8 rounded-lg border transition-colors cursor-pointer ${
                          task.notes
                            ? "border-[#f0e4c0] bg-[#FFF6DD] text-[#8A5A00]"
                            : "border-transparent text-[#6b6660] hover:border-[#eae7e1] hover:bg-[#f1efe9] hover:text-[#1c1b1a]"
                        }`}
                        title={language === "zh" ? "任务笔记" : "Task notes"}
                        aria-label={language === "zh" ? "任务笔记" : "Task notes"}
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <a
                        href={generateGoogleCalendarUrl(task, plan)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 min-w-8 min-h-8 rounded-lg border border-transparent hover:border-[#eae7e1] hover:bg-[#f1efe9] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
                        title={t("addToGCal")}
                        aria-label={t("addToGCal")}
                      >
                        <CalendarIcon className="w-4 h-4" />
                      </a>

                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-2 min-w-8 min-h-8 rounded-lg border border-transparent text-[#6b6660] hover:border-[#FDF0EE] hover:bg-[#FDF0EE] hover:text-[#B42318] transition-colors cursor-pointer"
                        title={t("delete")}
                        aria-label={t("delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

