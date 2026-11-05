import React, { useState, useEffect } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Clock,
  Timer,
  Volume2,
  VolumeX,
  Star,
  Check
} from "lucide-react";
import { StudyTask } from "../types";
import { playCompletionChime, playTimerFinishBell } from "../lib/audio";
import { useI18n } from "../lib/i18n";

interface TaskFocusTimerModalProps {
  task: StudyTask;
  isOpen: boolean;
  onClose: () => void;
  onTaskCompleted: (actualMinutesSpent: number, rating?: 1 | 2 | 3 | 4 | 5) => void;
  soundAlertsEnabled: boolean;
  defaultFocusDuration: number;
}

export function TaskFocusTimerModal({
  task,
  isOpen,
  onClose,
  onTaskCompleted,
  soundAlertsEnabled,
  defaultFocusDuration,
}: TaskFocusTimerModalProps) {
  const { t, language } = useI18n();
  const initialSeconds = defaultFocusDuration * 60;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundAlertsEnabled);
  const [checkedObjectives, setCheckedObjectives] = useState<Record<number, boolean>>({});
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5>(4);

  useEffect(() => {
    if (task) {
      setTimeLeft(defaultFocusDuration * 60);
      setIsRunning(false);
      setSoundEnabled(soundAlertsEnabled);
      setCheckedObjectives({});
    }
  }, [task, defaultFocusDuration, soundAlertsEnabled]);

  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsRunning(false);
            if (soundEnabled) playTimerFinishBell();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft, soundEnabled]);

  if (!isOpen || !task) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const progressPercent = Math.max(0, Math.min(100, ((initialSeconds - timeLeft) / initialSeconds) * 100));

  const handleToggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const handleResetTimer = () => {
    setIsRunning(false);
    setTimeLeft(initialSeconds);
  };

  const handleFinishAndSave = () => {
    const elapsedMinutes = Math.max(1, Math.round((initialSeconds - timeLeft) / 60));
    if (soundEnabled) playCompletionChime();
    onTaskCompleted(elapsedMinutes, selectedRating);
    onClose();
  };

  const toggleObjective = (index: number) => {
    setCheckedObjectives((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm select-none">
      <div className="ui-card w-full max-w-lg bg-white text-[#1c1b1a] overflow-hidden flex flex-col">

        <div className="px-5 py-3.5 bg-[#faf9f6] border-b ui-divider flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Timer className="w-4 h-4 text-[#8a8580]" />
            <span className="text-[15px] font-semibold tracking-tight text-[#1c1b1a]">
              {t("focusModalTitle")}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 min-w-9 min-h-9 rounded-lg border border-transparent hover:border-[#eae7e1] hover:bg-white text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
              title={soundEnabled ? (language === "zh" ? "关闭提示音" : "Mute Bell") : (language === "zh" ? "开启提示音" : "Enable Sound")}
              aria-label={soundEnabled ? (language === "zh" ? "关闭提示音" : "Mute bell") : (language === "zh" ? "开启提示音" : "Enable sound")}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[#a39e97]" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 min-w-9 min-h-9 rounded-lg border border-transparent hover:border-[#eae7e1] hover:bg-white text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
              aria-label={language === "zh" ? "关闭专注计时" : "Close focus timer"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 text-center space-y-5 flex flex-col items-center">
          <div>
            <span className="ui-chip">{task.topicTitle}</span>
            <h3 className="text-[13px] font-medium text-[#1c1b1a] mt-2 max-w-sm mx-auto leading-snug">
              {task.title}
            </h3>
          </div>

          {/* Duration presets */}
          <div className="flex items-center gap-0.5 rounded-lg bg-[#f1efe9] p-0.5 text-[11px] font-medium">
            <button
              onClick={() => { setTimeLeft(25 * 60); setIsRunning(false); }}
              className="px-2.5 py-1 rounded-[7px] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
            >
              25 · {language === "zh" ? "番茄" : "Pomodoro"}
            </button>
            <button
              onClick={() => { setTimeLeft(45 * 60); setIsRunning(false); }}
              className="px-2.5 py-1 rounded-[7px] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
            >
              45 · {language === "zh" ? "标准" : "Standard"}
            </button>
            <button
              onClick={() => { setTimeLeft(60 * 60); setIsRunning(false); }}
              className="px-2.5 py-1 rounded-[7px] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
            >
              60 · {language === "zh" ? "深度" : "Deep"}
            </button>
            <button
              onClick={() => { setTimeLeft(90 * 60); setIsRunning(false); }}
              className="px-2.5 py-1 rounded-[7px] text-[#6b6660] hover:text-[#1c1b1a] transition-colors cursor-pointer"
            >
              90 · {language === "zh" ? "模考" : "Mock"}
            </button>
          </div>

          <div className="relative w-48 h-48 rounded-xl border border-[#eae7e1] bg-[#faf9f6] flex flex-col items-center justify-center overflow-hidden">
            <span className="text-4xl font-semibold tracking-tight text-[#1c1b1a] tabular-nums">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[12px] text-[#8a8580] mt-2">
              {isRunning ? t("deepFocusing") : timeLeft === 0 ? t("timerComplete") : t("timerReady")}
            </span>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#f0ede8] overflow-hidden">
              <div
                className="h-full bg-[#FCD33B] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetTimer}
              className="ui-btn ui-btn-ghost p-2 min-w-9"
              title={language === "zh" ? "重置倒计时" : "Reset Timer"}
              aria-label={language === "zh" ? "重置倒计时" : "Reset timer"}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleTimer}
              className={`ui-btn px-6 ${
                isRunning ? "ui-btn-ghost bg-white" : "ui-btn-primary"
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>{t("pauseTimer")}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t("startFocusTimer")}</span>
                </>
              )}
            </button>
          </div>

          {task.keyObjectives && task.keyObjectives.length > 0 && (
            <div className="w-full bg-[#faf9f6] rounded-xl border border-[#eae7e1] p-3 text-left space-y-1.5">
              <h4 className="text-[12px] font-medium text-[#8a8580]">
                {t("objectivesForSession")}
              </h4>
              <div className="space-y-1">
                {task.keyObjectives.map((obj, i) => (
                  <div
                    key={i}
                    onClick={() => toggleObjective(i)}
                    className="flex items-start gap-2 cursor-pointer text-[13px] p-1.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <span
                      className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        checkedObjectives[i]
                          ? "bg-[#1c1b1a] border-[#1c1b1a] text-white"
                          : "bg-white border-[#e5e2dc] text-transparent"
                      }`}
                    >
                      <Check className="w-2.5 h-2.5" strokeWidth={3} />
                    </span>
                    <span className={checkedObjectives[i] ? "line-through text-[#a39e97]" : "text-[#1c1b1a]"}>
                      {obj}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="w-full pt-4 border-t ui-divider flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-[#8a8580]">{t("selfMasteryRating")}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star as any)}
                    aria-label={`${star} / 5`}
                    aria-pressed={selectedRating >= star}
                    className={`p-0.5 rounded-md transition-colors cursor-pointer ${
                      selectedRating >= star ? "text-[#FCD33B]" : "text-[#d8d4cc] hover:text-[#FCD33B]"
                    }`}
                  >
                    <Star className="w-4 h-4" fill="currentColor" strokeWidth={0} />
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinishAndSave}
              className="ui-btn ui-btn-primary w-full sm:w-auto"
            >
              <span>{t("markDoneAndLogTime")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
