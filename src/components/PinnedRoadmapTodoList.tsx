import React, { useState, useRef, useEffect } from "react";
import {
  Check,
  Play,
  Sparkles,
  Trash2,
  Calendar as CalendarIcon,
  Plus,
  FileText,
} from "lucide-react";
import { StudyTask, ExamStudyPlan } from "../types";
import { generateGoogleCalendarUrl } from "../lib/calendarExport";
import { useI18n } from "../lib/i18n";

interface PinnedRoadmapTodoListProps {
  plan?: ExamStudyPlan | null;
  tasks: StudyTask[];
  onToggleComplete: (taskId: string) => void;
  onUpdateConfidence: (taskId: string, rating: 1 | 2 | 3 | 4 | 5) => void;
  onSaveNotes: (taskId: string, notes: string) => void;
  onDeleteTask: (taskId: string) => void;
  onStartTimer: (task: StudyTask) => void;
  onStartQuiz: (task: StudyTask) => void;
  onStartRag: (task: StudyTask) => void;
  onAddNewTask: () => void;
  selectedDate: string;
}

// 4 App Brand Themes (Canary Yellow, Concrete Gray, Stone Gray, Dark Slate)
interface NoteTheme {
  id: string;
  name: string;
  pinGradient: string;
  pinShadow: string;
  pinRing: string;
  headerBg: string;
  headerBorder: string;
  badgeColor: string;
  titleColor: string;
  subTextColor: string;
  timeBg: string;
  timeText: string;
  timeBorder: string;
}

const FOUR_NOTE_THEMES: NoteTheme[] = [
  // 01: Canary Yellow (明黄档案)
  {
    id: "canary-yellow",
    name: "Canary Yellow",
    pinGradient: "radial-gradient(circle at 35% 35%, #FFF9C4 0%, #FCD33B 45%, #F59E0B 85%, #B45309 100%)",
    pinShadow: "rgba(180, 83, 9, 0.4)",
    pinRing: "#D97706",
    headerBg: "#FCD33B",
    headerBorder: "#111111",
    badgeColor: "#111111",
    titleColor: "#111111",
    subTextColor: "#333333",
    timeBg: "#FFFFFF",
    timeText: "#111111",
    timeBorder: "#111111",
  },
  // 02: Concrete Gray (水泥浅灰)
  {
    id: "concrete-gray",
    name: "Concrete Gray",
    pinGradient: "radial-gradient(circle at 35% 35%, #FFFFFF 0%, #D8D8D8 45%, #9E9E9E 85%, #616161 100%)",
    pinShadow: "rgba(97, 97, 97, 0.4)",
    pinRing: "#9E9E9E",
    headerBg: "#D8D8D8",
    headerBorder: "#111111",
    badgeColor: "#111111",
    titleColor: "#111111",
    subTextColor: "#444444",
    timeBg: "#FFFFFF",
    timeText: "#111111",
    timeBorder: "#111111",
  },
  // 03: Stone Gray (岩石中灰)
  {
    id: "stone-gray",
    name: "Stone Gray",
    pinGradient: "radial-gradient(circle at 35% 35%, #F5F5F5 0%, #B5B5B5 45%, #757575 85%, #424242 100%)",
    pinShadow: "rgba(66, 66, 66, 0.4)",
    pinRing: "#757575",
    headerBg: "#B5B5B5",
    headerBorder: "#111111",
    badgeColor: "#111111",
    titleColor: "#111111",
    subTextColor: "#222222",
    timeBg: "#FFFFFF",
    timeText: "#111111",
    timeBorder: "#111111",
  },
  // 04: Dark Slate (黑曜曜岩)
  {
    id: "dark-slate",
    name: "Dark Slate",
    pinGradient: "radial-gradient(circle at 35% 35%, #6B7280 0%, #374151 45%, #1F2937 85%, #111111 100%)",
    pinShadow: "rgba(17, 17, 17, 0.5)",
    pinRing: "#374151",
    headerBg: "#282828",
    headerBorder: "#111111",
    badgeColor: "#FCD33B",
    titleColor: "#FFFFFF",
    subTextColor: "#D1D5DB",
    timeBg: "#111111",
    timeText: "#FFFFFF",
    timeBorder: "#444444",
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
  onStartQuiz,
  onStartRag,
  onAddNewTask,
  selectedDate,
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
      className="relative w-full py-6 px-4 sm:px-8 md:px-12 min-h-[480px] overflow-hidden select-text border border-[#111111] bg-[#FAF9F6] shadow-xs"
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#111111]">
        <div className="flex items-center space-x-2 font-mono">
          <span className="w-2.5 h-2.5 bg-[#FCD33B] border border-[#111111] inline-block" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            {language === "zh" ? "今日待办轨迹" : "DAILY ROADMAP"}
          </h2>
          <span className="text-xs font-bold text-[#111111] bg-white border border-[#111111] px-2 py-0.2">
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
          <g key={idx}>
            <path
              d={d}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="4"
              strokeDasharray="6 6"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d={d}
              fill="none"
              stroke="#111111"
              strokeWidth="1.8"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          </g>
        ))}
      </svg>

      {/* Alternating Zigzag Pinned Cards */}
      <div className="relative z-10 flex flex-col space-y-8 sm:space-y-10 pb-4">
        {tasks.map((task, index) => {
          const isCompleted = task.status === "completed";
          // Strict rotation through the 4 app palettes
          const theme = FOUR_NOTE_THEMES[index % FOUR_NOTE_THEMES.length];
          const isRightAligned = index % 2 === 1;
          const numberStr = String(index + 1).padStart(2, "0");

          // Natural subtle tilt
          const rotationAngles = [-2.0, 2.2, -1.6, 2.4];
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
              {/* Sticky Card strictly matching the 4-color palette and brutalist borders */}
              <div
                className={`relative w-full max-w-sm sm:max-w-md bg-white border-2 border-[#111111] transition-all duration-300 group overflow-visible ${
                  isCompleted
                    ? "opacity-65 grayscale-[0.2] shadow-[2px_2px_0px_#111111]"
                    : "shadow-[4px_4px_0px_#111111] hover:shadow-[6px_6px_0px_#111111] hover:-translate-y-0.5"
                }`}
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                }}
              >
                {/* 3D Pushpin Centered Top */}
                <div
                  className="pin-anchor absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 cursor-pointer transition-transform duration-200 group-hover:scale-110 active:scale-95"
                  onClick={() => onToggleComplete(task.id)}
                  title={isCompleted ? t("pending") : t("completed")}
                >
                  <JellyPushpin theme={theme} size={26} />
                </div>

                {/* Card Top Block in One of the 4 App Theme Colors */}
                <div
                  className="px-4 pt-5 pb-3 border-b-2 border-[#111111] transition-colors"
                  style={{
                    backgroundColor: theme.headerBg,
                  }}
                >
                  <div className="flex items-center justify-between">
                    {/* Number (01, 02, 03...) */}
                    <span
                      className="text-xl sm:text-2xl font-bold font-mono tracking-tight leading-none select-none"
                      style={{ color: theme.badgeColor }}
                    >
                      {numberStr}
                    </span>

                    <div className="flex items-center space-x-2">
                      {/* Duration Tag */}
                      <span
                        className="text-[10px] font-mono font-bold px-2 py-0.5 border"
                        style={{
                          backgroundColor: theme.timeBg,
                          color: theme.timeText,
                          borderColor: theme.timeBorder,
                        }}
                      >
                        {task.durationMinutes}m
                      </span>

                      {/* Complete Checkbox */}
                      <button
                        onClick={() => onToggleComplete(task.id)}
                        className={`w-6 h-6 border-2 flex items-center justify-center transition-all cursor-pointer ${
                          isCompleted
                            ? "bg-[#111111] border-[#111111] text-white scale-105"
                            : "bg-white border-[#111111] text-transparent hover:text-gray-400"
                        }`}
                        title={isCompleted ? t("completed") : t("pending")}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>

                  {/* Title directly inside colored header block */}
                  <h3
                    className={`mt-2 text-sm sm:text-base font-bold leading-snug cursor-pointer transition-colors ${
                      isCompleted ? "line-through opacity-60" : ""
                    }`}
                    style={{ color: theme.titleColor }}
                    onClick={() => onToggleComplete(task.id)}
                  >
                    {task.title}
                  </h3>
                </div>

                {/* Card White Body */}
                <div className="p-4 space-y-2.5 bg-white">
                  {/* Task Description */}
                  {task.description && (
                    <p
                      className={`text-xs text-[#333333] leading-relaxed ${
                        isCompleted ? "line-through text-gray-400" : ""
                      }`}
                    >
                      {task.description}
                    </p>
                  )}

                  {/* Bullet Sub-points */}
                  {task.keyObjectives && task.keyObjectives.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      {task.keyObjectives.map((obj, i) => (
                        <div key={i} className="flex items-start space-x-1.5 text-xs text-[#444444]">
                          <span className="w-1.5 h-1.5 bg-[#111111] mt-1.5 shrink-0" />
                          <span className={isCompleted ? "line-through text-gray-400" : ""}>
                            {obj}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes Drawer */}
                  {activeNotesId === task.id && (
                    <div className="pt-2 border-t border-[#111111]/20 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#666666]">
                        <span>{language === "zh" ? "随堂笔记" : "NOTES"}</span>
                        <button
                          onClick={() => setActiveNotesId(null)}
                          className="text-gray-400 hover:text-[#111111] text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={task.notes || ""}
                        onChange={(e) => onSaveNotes(task.id, e.target.value)}
                        placeholder={language === "zh" ? "输入笔记..." : "Add notes..."}
                        className="w-full bg-[#FAF9F6] border border-[#111111] p-2 text-xs text-[#111111] placeholder-gray-400 focus:outline-none font-mono leading-relaxed"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Action Footer */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    {/* Mastery rating */}
                    <div className="flex items-center space-x-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => onUpdateConfidence(task.id, star as any)}
                          className={`p-0.5 transition-colors cursor-pointer text-xs ${
                            (task.confidenceRating || 0) >= star
                              ? "text-[#FCD33B] drop-shadow-xs font-bold"
                              : "text-gray-300 hover:text-amber-400"
                          }`}
                          title={`${star} / 5`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    {/* Tool Buttons */}
                    <div className="flex items-center space-x-1">
                      {/* Focus Timer */}
                      <button
                        onClick={() => onStartTimer(task)}
                        className="p-1 border border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333] transition-colors cursor-pointer"
                        title={t("startFocusTimer")}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>

                      {/* AI Quiz */}
                      <button
                        onClick={() => onStartQuiz(task)}
                        className="p-1 border border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333] transition-colors cursor-pointer"
                        title={t("generateQuiz")}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>

                      {/* Notes */}
                      <button
                        onClick={() => setActiveNotesId(activeNotesId === task.id ? null : task.id)}
                        className={`p-1 border transition-colors cursor-pointer ${
                          task.notes
                            ? "border-[#111111] bg-[#FCD33B] text-[#111111]"
                            : "border-transparent hover:border-[#111111] text-[#333333] hover:bg-[#FAF9F6]"
                        }`}
                        title={t("viewNotes")}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      {/* Google Calendar */}
                      <a
                        href={generateGoogleCalendarUrl(task, plan)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 border border-transparent hover:border-[#111111] hover:bg-[#FAF9F6] text-[#333333] transition-colors cursor-pointer"
                        title={t("addToGCal")}
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                      </a>

                      {/* Delete */}
                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="p-1 border border-transparent hover:border-red-600 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                        title={t("delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

