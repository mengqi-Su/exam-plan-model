import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Link2 } from "lucide-react";
import { DaySchedulePreference } from "../types";
import { DEFAULT_DAILY_HOURS, dayName } from "../lib/dailyHours";

interface RulerTimePickerProps {
  language: "zh" | "en";
  dailySchedules: DaySchedulePreference[];
  onUpdateDayHours: (dayOfWeek: number, hours: number) => void;
  onToggleDayEnabled: (dayOfWeek: number) => void;
}

const STEP_PIXELS = 26;
const MIN_HOURS = 0;
const MAX_HOURS = 12;
const STEP_HOURS = 0.5;
const TOTAL_STEPS = Math.round((MAX_HOURS - MIN_HOURS) / STEP_HOURS);

const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0];

// 判成横向手势的门槛（px）：竖向的份量一律交还给外层对话框，转盘和标尺都不再抢滚动。
const SWIPE_TRIGGER = 24;

const clampHours = (hours: number) => Math.max(MIN_HOURS, Math.min(MAX_HOURS, hours));

export const RulerTimePicker: React.FC<RulerTimePickerProps> = ({
  language,
  dailySchedules,
  onUpdateDayHours,
  onToggleDayEnabled,
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [syncToAll, setSyncToAll] = useState<boolean>(false);

  const isZh = language !== "en";
  const dayLabel = useCallback((dayOfWeek: number) => dayName(dayOfWeek, isZh), [isZh]);

  const arcContainerRef = useRef<HTMLDivElement>(null);

  const rulerContainerRef = useRef<HTMLDivElement>(null);
  const isRulerDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);

  // 星期的中英文名统一来自 lib/dailyHours，这里只留界面需要的序号和周末标记。
  const dayMeta: Record<number, { indexStr: string; isWeekend: boolean }> = {
    1: { indexStr: "01", isWeekend: false },
    2: { indexStr: "02", isWeekend: false },
    3: { indexStr: "03", isWeekend: false },
    4: { indexStr: "04", isWeekend: false },
    5: { indexStr: "05", isWeekend: false },
    6: { indexStr: "06", isWeekend: true },
    0: { indexStr: "07", isWeekend: true },
  };

  const currentSchedule = useMemo(() => {
    const sched = dailySchedules.find((s) => s.dayOfWeek === selectedDay);
    return (
      sched || {
        dayOfWeek: selectedDay,
        dayName: dayLabel(selectedDay),
        availableHours: DEFAULT_DAILY_HOURS,
        preferredTimeSlot: "flexible" as const,
        enabled: true,
      }
    );
  }, [dailySchedules, selectedDay, dayLabel]);

  const activeHours = currentSchedule.enabled ? currentSchedule.availableHours : 0;

  const formattedTime = useMemo(() => {
    const totalMinutes = Math.round(activeHours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  }, [activeHours]);

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

  const commitRulerScroll = useCallback(() => {
    const el = rulerContainerRef.current;
    if (!el) return;
    const step = Math.round(el.scrollLeft / STEP_PIXELS);
    const hours = clampHours(step * STEP_HOURS);
    if (hours !== activeHours) {
      handleHoursChange(hours);
    }
  }, [activeHours, handleHoursChange]);

  const endRulerDrag = useCallback(() => {
    if (!isRulerDraggingRef.current) return;
    isRulerDraggingRef.current = false;
    commitRulerScroll();
    const el = rulerContainerRef.current;
    if (el) {
      const targetScroll = Math.round(el.scrollLeft / STEP_PIXELS) * STEP_PIXELS;
      el.scrollTo({ left: targetScroll, behavior: "smooth" });
    }
  }, [commitRulerScroll]);

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
    commitRulerScroll();
  };

  const handleMouseUpOrLeave = endRulerDrag;

  // 拖动 / 手指滑标尺的过程中不提交，免得每个 scroll 事件都反向改写 scrollLeft，
  // 把用户的手势顶回去；松手那一下统一结算。
  const handleRulerScroll = () => {
    if (isRulerDraggingRef.current) return;
    commitRulerScroll();
  };

  const shiftDay = useCallback((direction: 1 | -1) => {
    setSelectedDay((prev) => {
      const idx = ORDERED_DAYS.indexOf(prev);
      return ORDERED_DAYS[Math.min(ORDERED_DAYS.length - 1, Math.max(0, idx + direction))];
    });
  }, []);

  useEffect(() => {
    const el = arcContainerRef.current;
    if (!el) return;

    // 转盘只认横向手势。竖向滚轮/手指一律交还给外层对话框——
    // 之前这里无条件 preventDefault，鼠标停在转盘上就滚不动弹窗，看起来像「页面卡住了」。
    const onArcWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (Math.abs(e.deltaX) >= SWIPE_TRIGGER) shiftDay(e.deltaX > 0 ? 1 : -1);
    };

    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      axis = null;
    };

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
      if (axis !== "x") return;
      e.preventDefault();
      if (Math.abs(dx) >= SWIPE_TRIGGER) {
        shiftDay(dx < 0 ? 1 : -1);
        startX = touch.clientX;
      }
    };

    const onTouchEnd = () => {
      axis = null;
    };

    el.addEventListener("wheel", onArcWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("wheel", onArcWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [shiftDay]);

  useEffect(() => {
    const rulerEl = rulerContainerRef.current;
    if (!rulerEl) return;

    const onRulerWheel = (e: WheelEvent) => {
      // 同上：竖向滚轮属于对话框，横向滑动才用来挪标尺（一格 = 0.5 小时）。
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const step = Math.round(rulerEl.scrollLeft / STEP_PIXELS) + (e.deltaX > 0 ? 1 : -1);
      const clampedStep = Math.max(0, Math.min(TOTAL_STEPS, step));
      rulerEl.scrollLeft = clampedStep * STEP_PIXELS;
      commitRulerScroll();
    };

    // 手指横向拖标尺交给浏览器原生 scroll（touch-action: pan-x），这里只负责开始/结算，
    // 不再 preventDefault，竖向滑动才能正常滚弹窗。
    const onRulerTouchStart = () => {
      isRulerDraggingRef.current = true;
    };

    const onRulerTouchEnd = () => {
      endRulerDrag();
    };

    rulerEl.addEventListener("wheel", onRulerWheel, { passive: false });
    rulerEl.addEventListener("touchstart", onRulerTouchStart, { passive: true });
    rulerEl.addEventListener("touchend", onRulerTouchEnd, { passive: true });
    rulerEl.addEventListener("touchcancel", onRulerTouchEnd, { passive: true });

    return () => {
      rulerEl.removeEventListener("wheel", onRulerWheel);
      rulerEl.removeEventListener("touchstart", onRulerTouchStart);
      rulerEl.removeEventListener("touchend", onRulerTouchEnd);
      rulerEl.removeEventListener("touchcancel", onRulerTouchEnd);
    };
  }, [commitRulerScroll, endRulerDrag]);

  const activeIndex = ORDERED_DAYS.indexOf(selectedDay);

  const ARC_RADIUS = 195;
  const ANGLE_STEP_DEG = 22;

  return (
    <div className="space-y-3">

      <div className="flex items-center justify-between gap-2 border-b border-[#eeebe4] pb-2.5">
        <span className="text-xs font-bold text-[#111111] uppercase tracking-wide">
          {isZh ? "周一至周日学习时间规划" : "Weekly Study Cadence & Duration"}
        </span>
      </div>

      <div className="relative rounded-2xl bg-[#faf9f6] border border-[#e8e6df] p-5 sm:p-7 overflow-hidden select-none">

        <div className="flex items-center justify-between pb-3.5 border-b border-[#eeebe3]">
          <div className="flex items-center space-x-2 font-mono text-xs text-[#888888]">
            <span className="font-bold text-[#111111] uppercase tracking-wider">
              {/* 中文时补一个大写英文名当装饰；英文界面下再拼一次就成了 "Monday · MONDAY"。 */}
              {isZh ? `${dayLabel(selectedDay)} · ${dayName(selectedDay, false).toUpperCase()}` : dayLabel(selectedDay)}
            </span>
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-center pt-5">

          {/* 转盘这一列只放序号。以前把「周几 + 几小时」写在序号右边，桌面下这一列只有 ~210px，
              列上的 overflow-hidden 正好把后半截裁掉，看上去就像被什么东西挡住了。
              现在详情挪到转盘下方单独一行，宽度不够自己换行，不会再被裁。 */}
          <div className="md:col-span-6 flex flex-col md:border-r border-[#eeebe3] md:pr-4">
            <div
              ref={arcContainerRef}
              style={{ touchAction: "pan-y" }}
              className="relative h-56 sm:h-64 overflow-hidden flex items-center select-none cursor-grab active:cursor-grabbing"
            >

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

            <div className="relative w-full h-full">
              {ORDERED_DAYS.map((dayNum, idx) => {
                const diff = idx - activeIndex;
                const isSelected = diff === 0;
                const meta = dayMeta[dayNum];

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

                    <div
                      className={`rounded-full transition-all duration-200 ${
                        isSelected
                          ? "w-2.5 h-2.5 bg-[#111111] shadow-sm -ml-[5px]"
                          : "w-1.5 h-1.5 bg-[#a39f96] group-hover:bg-[#111111] -ml-[3px]"
                      }`}
                    />

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
                  </div>
                );
              })}
            </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 pb-1 text-center">
              <span className="text-sm font-bold text-[#111111]">{dayLabel(selectedDay)}</span>
              {dayMeta[selectedDay].isWeekend && (
                <span className="text-[9px] px-1 py-0.5 bg-[#111111] text-white font-mono rounded">
                  {language === "zh" ? "周末" : "WE"}
                </span>
              )}
              <span className="text-xs text-[#777777] font-mono">
                {activeHours === 0
                  ? language === "zh"
                    ? "休息蓄力 · 0h"
                    : "Rest Day · 0h"
                  : `${activeHours} ${language === "zh" ? "小时学习时间" : "hrs target"}`}
              </span>
            </div>
          </div>

          <div className="md:col-span-6 flex flex-col items-center justify-center space-y-3.5 py-1">

            <div className="relative w-full max-w-md h-20 flex items-center justify-center">

              <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-[#faf9f6] to-transparent z-20" />
              <div className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-[#faf9f6] to-transparent z-20" />

              <div className="pointer-events-none absolute z-30 flex flex-col items-center justify-between w-11 h-20 bg-white rounded-xl border border-[#111111] shadow-sm py-1.5">
                <span className="text-[11px] font-mono font-bold text-[#111111]">
                  {Math.floor(activeHours).toString().padStart(2, "0")}
                </span>
                <div className="w-[2px] h-6 bg-[#111111] rounded-full" />
                <span className="text-[9px] font-mono text-[#888888]">
                  {activeHours % 1 === 0 ? "00" : "30"}
                </span>
              </div>

              <div
                ref={rulerContainerRef}
                onScroll={handleRulerScroll}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x", overscrollBehaviorX: "contain" }}
                className="w-full h-full overflow-x-scroll no-scrollbar cursor-grab active:cursor-grabbing flex items-center select-none"
              >
                {/* 留白要让「第 i 格」的中心正好落在中间指针上：格子宽 STEP_PIXELS，所以留 50% - 半格 */}
                <div className="flex-shrink-0" style={{ width: `calc(50% - ${STEP_PIXELS / 2}px)` }} />

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

                {/* 留白要让「第 i 格」的中心正好落在中间指针上：格子宽 STEP_PIXELS，所以留 50% - 半格 */}
                <div className="flex-shrink-0" style={{ width: `calc(50% - ${STEP_PIXELS / 2}px)` }} />
              </div>
            </div>

            <div className="text-center space-y-0.5">
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-[#111111] italic">
                {activeHours > 0 ? formattedTime : "--:--"}
              </div>
              <div className="text-[11px] text-[#888888] font-mono uppercase tracking-wider">
                {language === "zh" ? "单日备考投入时长" : "Daily Target Hours"}
              </div>
            </div>

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
                {dayLabel(d)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
