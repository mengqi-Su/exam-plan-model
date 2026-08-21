import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Link2 } from "lucide-react";
import { DaySchedulePreference } from "../types";

interface RulerTimePickerProps {
  language: "zh" | "en";
  dailySchedules: DaySchedulePreference[];
  onUpdateDayHours: (dayOfWeek: number, hours: number) => void;
  onToggleDayEnabled: (dayOfWeek: number) => void;
  onApplyPreset?: (type: "weekday_weekend" | "balanced_3h" | "intensive_5h" | "light_1_5h") => void;
  daysDiff: number;
}

const STEP_PIXELS = 26; // pixels per 0.5 hour step
const MIN_HOURS = 0;
const MAX_HOURS = 12;
const STEP_HOURS = 0.5;
const TOTAL_STEPS = Math.round((MAX_HOURS - MIN_HOURS) / STEP_HOURS);

// Ordered days: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

export const RulerTimePicker: React.FC<RulerTimePickerProps> = ({
  language,
  dailySchedules,
  onUpdateDayHours,
  onToggleDayEnabled,
  daysDiff,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [syncToAll, setSyncToAll] = useState<boolean>(false);

  // Left Arc ref & Touch/Wheel tracking
  const arcContainerRef = useRef<HTMLDivElement>(null);
  const arcTouchStartYRef = useRef<number | null>(null);

  // Right Ruler ref & drag
  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const isRulerDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  const dayMeta: Record<number, { indexStr: string; zh: string; en: string; isWeekend: boolean }> = {
    1: { indexStr: "01", zh: "周一", en: "Monday", isWeekend: false },
    2: { indexStr: "02", zh: "周二", en: "Tuesday", isWeekend: false },
    3: { indexStr: "03", zh: "周三", en: "Wednesday", isWeekend: false },
    4: { indexStr: "04", zh: "周四", en: "Thursday", isWeekend: false },
    5: { indexStr: "05", zh: "周五", en: "Friday", isWeekend: false },
    6: { indexStr: "06", zh: "周六", en: "Saturday", isWeekend: true },
    0: { indexStr: "07", zh: "周日", en: "Sunday", isWeekend: true },
  };

  // Active schedule
  const currentSchedule = useMemo(() => {
    const sched = dailySchedules.find((s) => s.dayOfWeek === selectedDay);
    return (
      sched || {
        dayOfWeek: selectedDay,
        dayName: dayMeta[selectedDay]?.zh || "周一",
        availableHours: 2.5,
        preferredTimeSlot: "evening",
        enabled: true,
      }
    );
  }, [dailySchedules, selectedDay]);

  const activeHours = currentSchedule.enabled ? currentSchedule.availableHours : 0;

  // Stats calculation
  const weeklyTotalHours = useMemo(() => {
    return dailySchedules.reduce((acc, curr) => (curr.enabled ? acc + curr.availableHours : acc), 0);
  }, [dailySchedules]);

  const totalPlannedStudyHours = useMemo(() => {
    const start = new Date();
    let total = 0;
    for (let i = 0; i < daysDiff; i++) {
      const cur = new Date(start.getTime() + i * 86400000);
      const dayOfWeek = cur.getDay();
      const sched = dailySchedules.find((s) => s.dayOfWeek === dayOfWeek);
      if (sched && sched.enabled) {
        total += sched.availableHours;
      }
    }
    return Math.round(total * 10) / 10;
  }, [daysDiff, dailySchedules]);

  const formattedTime = useMemo(() => {
    const totalMinutes = Math.round(activeHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }, [activeHours]);

  // Sync scroll position when active hours change
  useEffect(() => {
    if (rulerContainerRef.current && !isRulerDraggingRef.current) {
      const targetStep = activeHours / STEP_HOURS;
      const targetScroll = targetStep * STEP_PIXELS;
      rulerContainerRef.current.scrollLeft = targetScroll;
    }
  }, [activeHours, selectedDay]);

  const handleHoursChange = useCallback(
    (newHours: number) => {
      const clamped = Math.max(MIN_HOURS, Math.min(MAX_HOURS, Math.round(newHours * 2) / 2));
      if (syncToAll) {
        ORDERED_DAYS.forEach((d) => onUpdateDayHours(d, clamped));
      } else {
        onUpdateDayHours(selectedDay, clamped);
      }
    },
    [selectedDay, syncToAll, onUpdateDayHours]
  );

  const handleRulerScroll = () => {
    if (!rulerContainerRef.current || isRulerDraggingRef.current) return;
    const scrollLeft = rulerContainerRef.current.scrollLeft;
    const step = Math.round(scrollLeft / STEP_PIXELS);
    const hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, step * STEP_HOURS));
    if (hours !== activeHours) {
      handleHoursChange(hours);
    }
  };

  // Ruler Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!rulerContainerRef.current) return;
    isRulerDraggingRef.current = true;
    startXRef.current = e.pageX - rulerContainerRef.current.offsetLeft;
    startScrollLeftRef.current = rulerContainerRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isRulerDraggingRef.current || !rulerContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - rulerContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    rulerContainerRef.current.scrollLeft = startScrollLeftRef.current - walk;

    const step = Math.round(rulerContainerRef.current.scrollLeft / STEP_PIXELS);
    const hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, step * STEP_HOURS));
    if (hours !== activeHours) {
      handleHoursChange(hours);
    }
  };

  const handleMouseUpOrLeave = () => {
    if (!isRulerDraggingRef.current) return;
    isRulerDraggingRef.current = false;
    if (rulerContainerRef.current) {
      const step = Math.round(rulerContainerRef.current.scrollLeft / STEP_PIXELS);
      const targetScroll = step * STEP_PIXELS;
      rulerContainerRef.current.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  };

  // Prevent page scrolling on Left Arc wheel & touch gestures
  useEffect(() => {
    const el = arcContainerRef.current;
    if (!el) return;

    const onArcWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY > 15) {
        setSelectedDay((prev) => {
          const idx = ORDERED_DAYS.indexOf(prev);
          const nextIdx = Math.min(ORDERED_DAYS.length - 1, idx + 1);
          return ORDERED_DAYS[nextIdx];
        });
      } else if (e.deltaY < -15) {
        setSelectedDay((prev) => {
          const idx = ORDERED_DAYS.indexOf(prev);
          const prevIdx = Math.max(0, idx - 1);
          return ORDERED_DAYS[prevIdx];
        });
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        arcTouchStartYRef.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (arcTouchStartYRef.current === null || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const diffY = arcTouchStartYRef.current - currentY;
      if (Math.abs(diffY) > 20) {
        e.preventDefault(); // Prevent whole page scrolling!
        if (diffY > 20) {
          setSelectedDay((prev) => {
            const idx = ORDERED_DAYS.indexOf(prev);
            const nextIdx = Math.min(ORDERED_DAYS.length - 1, idx + 1);
            return ORDERED_DAYS[nextIdx];
          });
          arcTouchStartYRef.current = currentY;
        } else if (diffY < -20) {
          setSelectedDay((prev) => {
            const idx = ORDERED_DAYS.indexOf(prev);
            const prevIdx = Math.max(0, idx - 1);
            return ORDERED_DAYS[prevIdx];
          });
          arcTouchStartYRef.current = currentY;
        }
      }
    };

    const onTouchEnd = () => {
      arcTouchStartYRef.current = null;
    };

    el.addEventListener("wheel", onArcWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", onArcWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Prevent page scrolling on Right Ruler touch & wheel gestures
  useEffect(() => {
    const rulerEl = rulerContainerRef.current;
    if (!rulerEl) return;

    const onRulerWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      rulerEl.scrollLeft += delta * 0.8;
      const step = Math.round(rulerEl.scrollLeft / STEP_PIXELS);
      const hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, step * STEP_HOURS));
      handleHoursChange(hours);
    };

    const onRulerTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        isRulerDraggingRef.current = true;
        startXRef.current = e.touches[0].pageX - rulerEl.offsetLeft;
        startScrollLeftRef.current = rulerEl.scrollLeft;
      }
    };

    const onRulerTouchMove = (e: TouchEvent) => {
      if (!isRulerDraggingRef.current || e.touches.length === 0) return;
      e.preventDefault(); // Stop entire page from swiping/scrolling!
      const x = e.touches[0].pageX - rulerEl.offsetLeft;
      const walk = (x - startXRef.current) * 1.2;
      rulerEl.scrollLeft = startScrollLeftRef.current - walk;

      const step = Math.round(rulerEl.scrollLeft / STEP_PIXELS);
      const hours = Math.max(MIN_HOURS, Math.min(MAX_HOURS, step * STEP_HOURS));
      if (hours !== activeHours) {
        handleHoursChange(hours);
      }
    };

    const onRulerTouchEnd = () => {
      if (!isRulerDraggingRef.current) return;
      isRulerDraggingRef.current = false;
      const step = Math.round(rulerEl.scrollLeft / STEP_PIXELS);
      const targetScroll = step * STEP_PIXELS;
      rulerEl.scrollTo({ left: targetScroll, behavior: "smooth" });
    };

    rulerEl.addEventListener("wheel", onRulerWheel, { passive: false });
    rulerEl.addEventListener("touchstart", onRulerTouchStart, { passive: false });
    rulerEl.addEventListener("touchmove", onRulerTouchMove, { passive: false });
    rulerEl.addEventListener("touchend", onRulerTouchEnd, { passive: false });
    rulerEl.addEventListener("touchcancel", onRulerTouchEnd, { passive: false });

    return () => {
      rulerEl.removeEventListener("wheel", onRulerWheel);
      rulerEl.removeEventListener("touchstart", onRulerTouchStart);
      rulerEl.removeEventListener("touchmove", onRulerTouchMove);
      rulerEl.removeEventListener("touchend", onRulerTouchEnd);
      rulerEl.removeEventListener("touchcancel", onRulerTouchEnd);
    };
  }, [handleHoursChange, activeHours]);

  const activeIndex = ORDERED_DAYS.indexOf(selectedDay);

  // Precise mathematical circular arc geometry
  const ARC_RADIUS = 195;
  const ANGLE_STEP_DEG = 22;

  return (
    <div className="space-y-3">
      {/* 1. Header with Stats & Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#eeebe4] pb-2.5">
        <span className="text-xs font-bold text-[#111111] uppercase tracking-wide">
          {language === "zh" ? "周一至周日学习时间规划" : "Weekly Study Cadence & Duration"}
        </span>
        <div className="flex items-center space-x-3 text-xs text-[#777777] font-mono">
          <span>
            {language === "zh" ? "周总学时" : "Weekly"}: <strong className="text-[#111111]">{weeklyTotalHours}h</strong>
          </span>
          <span className="text-[#dcd8cf]">/</span>
          <span>
            {language === "zh" ? "全程预计" : "Total"}: <strong className="text-[#111111]">{totalPlannedStudyHours}h</strong>
            <span className="text-[#999999] text-[10px] ml-1">({daysDiff}{language === "zh" ? "天" : "d"})</span>
          </span>
        </div>
      </div>

      {/* 2. Unified Canvas Module */}
      <div className="relative rounded-2xl bg-[#faf9f6] border border-[#e8e6df] p-5 sm:p-7 overflow-hidden select-none">
        
        {/* Top Control Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#eeebe3]">
          <div className="flex items-center space-x-2 font-mono text-xs text-[#888888]">
            <span className="font-bold text-[#111111] uppercase tracking-wider">
              {dayMeta[selectedDay].zh} · {dayMeta[selectedDay].en.toUpperCase()}
            </span>
            <span>·</span>
            <span>{activeHours > 0 ? `${activeHours}h / 天` : (language === "zh" ? "休整" : "Rest")}</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onToggleDayEnabled(selectedDay)}
              className={`text-xs px-2.5 py-1 rounded border font-mono transition-colors cursor-pointer ${
                activeHours === 0
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#dedad1] hover:border-[#111111]"
              }`}
            >
              {activeHours === 0 ? (language === "zh" ? "已设为休息" : "Resting") : (language === "zh" ? "设为休息日" : "Set Rest")}
            </button>

            <button
              type="button"
              onClick={() => setSyncToAll(!syncToAll)}
              className={`text-xs px-2.5 py-1 rounded border font-mono transition-colors flex items-center space-x-1 cursor-pointer ${
                syncToAll
                  ? "bg-[#111111] text-white border-[#111111]"
                  : "bg-white text-[#666666] border-[#dedad1] hover:border-[#111111]"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>{syncToAll ? (language === "zh" ? "已全周联动" : "Linked All") : (language === "zh" ? "全周同步" : "Link Days")}</span>
            </button>
          </div>
        </div>

        {/* Main Body Grid: 5 : 7 Balanced Proportion */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-center pt-5">
          
          {/* ================= LEFT: TRUE CIRCULAR ARC DIAL (5 COLS) ================= */}
          <div
            ref={arcContainerRef}
            style={{ touchAction: "none", overscrollBehavior: "contain" }}
            className="md:col-span-5 relative h-56 sm:h-64 overflow-hidden flex items-center md:border-r border-[#eeebe3] md:pr-4 select-none cursor-grab active:cursor-grabbing"
          >
            {/* SVG Real Circle Arc Guide */}
            <svg
              className="absolute left-0 top-0 w-full h-full pointer-events-none"
              viewBox="0 0 240 240"
              fill="none"
            >
              <circle
                cx="-40"
                cy="120"
                r={ARC_RADIUS}
                stroke="#dedad1"
                strokeWidth="1.5"
              />
            </svg>

            {/* Render items dynamically on the true arc */}
            <div className="relative w-full h-full">
              {ORDERED_DAYS.map((dayNum, idx) => {
                const diff = idx - activeIndex; // Distance from selected day (-3 .. +3)
                const isSelected = diff === 0;
                const meta = dayMeta[dayNum];
                const sched = dailySchedules.find((s) => s.dayOfWeek === dayNum);
                const hours = sched && sched.enabled ? sched.availableHours : 0;
                const isRest = hours === 0;

                // Math for true circular placement
                const angleDeg = diff * ANGLE_STEP_DEG;
                const angleRad = (angleDeg * Math.PI) / 180;
                
                const centerX = -40;
                const centerY = 120;
                const posX = centerX + ARC_RADIUS * Math.cos(angleRad);
                const posY = centerY + ARC_RADIUS * Math.sin(angleRad);

                const opacity = isSelected ? 1 : Math.abs(diff) === 1 ? 0.4 : Math.abs(diff) === 2 ? 0.18 : 0;
                if (Math.abs(diff) > 2) return null;

                return (
                  <div
                    key={dayNum}
                    onClick={() => setSelectedDay(dayNum)}
                    style={{
                      left: `${posX}px`,
                      top: `${posY}px`,
                      transform: `translate(-4px, -50%)`,
                      opacity,
                    }}
                    className={`absolute transition-all duration-300 ease-out cursor-pointer flex items-center space-x-3 group ${
                      isSelected ? "z-20 scale-100" : "z-10 scale-90 hover:opacity-75"
                    }`}
                  >
                    {/* The Dot Tick on the Arc */}
                    <div
                      className={`rounded-full transition-all duration-200 ${
                        isSelected
                          ? "w-2.5 h-2.5 bg-[#111111] shadow-sm -ml-[5px]"
                          : "w-1.5 h-1.5 bg-[#a39f96] group-hover:bg-[#111111] -ml-[3px]"
                      }`}
                    />

                    {/* Big Stylized Number (00, 01, 02...) */}
                    <span
                      style={{ transform: `rotate(${angleDeg * 0.65}deg)` }}
                      className={`font-black font-mono transition-all duration-300 italic select-none ${
                        isSelected
                          ? "text-3xl sm:text-4xl text-[#111111] tracking-tight"
                          : "text-2xl text-[#999999]"
                      }`}
                    >
                      {meta.indexStr}
                    </span>

                    {/* Active Label & Description */}
                    {isSelected && (
                      <div className="flex flex-col justify-center pl-1 select-none animate-fadeIn">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-sm font-bold text-[#111111]">
                            {language === "zh" ? meta.zh : meta.en}
                          </span>
                          {meta.isWeekend && (
                            <span className="text-[9px] px-1 py-0.2 bg-[#111111] text-white font-mono rounded">
                              {language === "zh" ? "周末" : "WE"}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-[#777777] font-mono mt-0.5 whitespace-nowrap">
                          {isRest
                            ? language === "zh" ? "休息蓄力 · 0h" : "Rest Day · 0h"
                            : `${hours} ${language === "zh" ? "小时学习时间" : "hrs target"}`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= RIGHT: SEAMLESS RULER TIME DIAL (7 COLS) ================= */}
          <div className="md:col-span-7 flex flex-col items-center justify-center space-y-3.5 py-1">
            
            {/* Center Ruler Horizontal Scale */}
            <div className="relative w-full max-w-md h-20 flex items-center justify-center">
              {/* Soft Fade Edges */}
              <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#faf9f6] to-transparent z-20" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#faf9f6] to-transparent z-20" />

              {/* Center Needle Cursor */}
              <div className="pointer-events-none absolute z-30 flex flex-col items-center justify-between w-11 h-20 bg-white rounded-xl border border-[#111111] shadow-sm py-1.5">
                <span className="text-[11px] font-mono font-bold text-[#111111]">
                  {Math.floor(activeHours).toString().padStart(2, "0")}
                </span>
                <div className="w-[2px] h-6 bg-[#111111] rounded-full" />
                <span className="text-[9px] font-mono text-[#888888]">
                  {activeHours % 1 === 0 ? "00" : "30"}
                </span>
              </div>

              {/* Scrollable / Draggable Scale Track */}
              <div
                ref={rulerContainerRef}
                onScroll={handleRulerScroll}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "none", overscrollBehavior: "contain" }}
                className="w-full h-full overflow-x-scroll no-scrollbar cursor-grab active:cursor-grabbing flex items-center select-none"
              >
                <div className="flex-shrink-0" style={{ width: "calc(50% - 6px)" }} />

                <div className="flex items-center h-full">
                  {Array.from({ length: TOTAL_STEPS + 1 }).map((_, index) => {
                    const stepHours = index * STEP_HOURS;
                    const isWholeHour = index % 2 === 0;
                    const hourNum = Math.floor(stepHours);
                    const isCurrent = Math.abs(stepHours - activeHours) < 0.1;

                    return (
                      <div
                        key={index}
                        onClick={() => handleHoursChange(stepHours)}
                        style={{ width: `${STEP_PIXELS}px` }}
                        className="flex-shrink-0 h-full flex flex-col items-center justify-between py-1 group cursor-pointer"
                      >
                        {/* Top Hour */}
                        <div className="h-3.5 flex items-center justify-center">
                          {isWholeHour ? (
                            <span
                              className={`text-[10px] font-mono transition-colors ${
                                isCurrent ? "text-transparent" : "text-[#999999] group-hover:text-[#111111]"
                              }`}
                            >
                              {hourNum.toString().padStart(2, "0")}
                            </span>
                          ) : (
                            <span className="w-1" />
                          )}
                        </div>

                        {/* Tick Mark */}
                        <div className="flex items-center justify-center h-7">
                          {isWholeHour ? (
                            <div
                              className={`w-[1.5px] h-6 transition-colors ${
                                isCurrent ? "bg-transparent" : "bg-[#111111] group-hover:bg-[#111111]"
                              }`}
                            />
                          ) : (
                            <div
                              className={`w-[1px] h-3 transition-colors ${
                                isCurrent ? "bg-transparent" : "bg-[#c5c1b8] group-hover:bg-[#555555]"
                              }`}
                            />
                          )}
                        </div>

                        {/* Bottom Tag */}
                        <div className="h-3.5 flex items-center justify-center">
                          {isWholeHour ? (
                            <span
                              className={`text-[8px] font-mono ${
                                isCurrent ? "text-transparent" : "text-[#a6a298]"
                              }`}
                            >
                              {hourNum}h
                            </span>
                          ) : (
                            <span className="w-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex-shrink-0" style={{ width: "calc(50% - 6px)" }} />
              </div>
            </div>

            {/* Time Typography (02:30 / 单日备考投入时长) */}
            <div className="text-center space-y-0.5">
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-[#111111] italic">
                {activeHours > 0 ? formattedTime : "--:--"}
              </div>
              <div className="text-[11px] text-[#888888] font-mono uppercase tracking-wider">
                {language === "zh" ? "单日备考投入时长" : "Daily Target Hours"}
              </div>
            </div>

            {/* Monochrome Quick Adjustment Chips */}
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {[1.5, 2.5, 3.5, 5.0].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHoursChange(h)}
                  className={`px-2.5 py-0.5 text-xs rounded font-mono transition-colors cursor-pointer border ${
                    activeHours === h
                      ? "bg-[#111111] text-white border-[#111111] font-bold"
                      : "bg-white text-[#444444] border-[#dedad1] hover:border-[#111111]"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Quick Day Jump Bar (01 - 07) */}
        <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-[#eeebe3] text-xs font-mono">
          <span className="text-[11px] text-[#999999]">
            {language === "zh" ? "快捷星期跳转" : "Quick Day Switch"}:
          </span>
          <div className="flex items-center space-x-1.5">
            {ORDERED_DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                  selectedDay === d
                    ? "bg-[#111111] text-white font-bold"
                    : "text-[#666666] bg-white border border-[#dedad1] hover:border-[#111111]"
                }`}
              >
                {dayMeta[d].zh}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
