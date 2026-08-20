import React, { useState, useEffect } from "react";
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  Clock, 
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
}

export function TaskFocusTimerModal({
  task,
  isOpen,
  onClose,
  onTaskCompleted,
}: TaskFocusTimerModalProps) {
  const { t, language } = useI18n();
  const initialSeconds = (task?.durationMinutes || 45) * 60;
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [checkedObjectives, setCheckedObjectives] = useState<Record<number, boolean>>({});
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3 | 4 | 5>(4);

  // Reset when task changes
  useEffect(() => {
    if (task) {
      setTimeLeft((task.durationMinutes || 45) * 60);
      setIsRunning(false);
      setCheckedObjectives({});
    }
  }, [task]);

  // Timer Tick Loop
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
    playCompletionChime();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-white border border-[#111111] w-full max-w-lg text-[#111111] font-mono shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#fafafa] border-b border-[#111111] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [{language === "zh" ? "专注计时" : "FOCUS-TIMER"}]
            </span>
            <span className="text-xs font-bold text-[#111111]">
              {t("focusModalTitle")}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer text-xs"
              title={soundEnabled ? (language === "zh" ? "关闭提示音" : "Mute Bell") : (language === "zh" ? "开启提示音" : "Enable Sound")}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-[#999999]" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Clock Dial */}
        <div className="p-6 text-center space-y-5 flex flex-col items-center font-mono">
          <div>
            <span className="border border-[#111111] bg-[#fafafa] text-[#111111] px-2 py-0.5 text-[10px] font-bold">
              {task.topicTitle}
            </span>
            <h3 className="text-sm font-bold text-[#111111] mt-2 max-w-sm mx-auto">
              {task.title}
            </h3>
          </div>

          {/* Countdown Display Box */}
          <div className="relative w-48 h-48 border border-[#111111] bg-[#fafafa] flex flex-col items-center justify-center">
            <span className="text-4xl font-bold tracking-widest text-[#111111]">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
            <span className="text-[10px] text-[#666666] font-bold mt-2 uppercase tracking-wider">
              {isRunning ? `// ${t("deepFocusing")}` : timeLeft === 0 ? `// ${t("sessionComplete")}` : `// ${t("readyToStart")}`}
            </span>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#e5e5e5]">
              <div 
                className="h-full bg-[#111111] transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleResetTimer}
              className="p-2 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer text-xs"
              title={language === "zh" ? "重置倒计时" : "Reset Timer"}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleTimer}
              className={`px-6 py-2 border border-[#111111] font-bold text-xs transition-colors flex items-center space-x-2 cursor-pointer ${
                isRunning
                  ? "bg-[#fafafa] text-[#111111] hover:bg-[#111111] hover:text-white"
                  : "bg-[#111111] text-white hover:bg-[#333333]"
              }`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>[{t("pauseTimer")}]</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>[{t("startFocusTimer")}]</span>
                </>
              )}
            </button>
          </div>

          {/* Key Objectives Checklist */}
          {task.keyObjectives && task.keyObjectives.length > 0 && (
            <div className="w-full bg-[#fafafa] border border-[#111111] p-3 text-left space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                [{t("objectivesForSession")}]
              </h4>
              <div className="space-y-1">
                {task.keyObjectives.map((obj, i) => (
                  <div
                    key={i}
                    onClick={() => toggleObjective(i)}
                    className="flex items-start space-x-2 cursor-pointer text-xs p-1 hover:bg-white border border-transparent hover:border-[#111111] transition-colors"
                  >
                    <span className="font-bold text-[#111111]">
                      {checkedObjectives[i] ? "[x]" : "[ ]"}
                    </span>
                    <span className={checkedObjectives[i] ? "line-through text-[#888888]" : "text-[#111111]"}>
                      {obj}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Self-Rating & Completion Action */}
          <div className="w-full pt-3 border-t border-[#111111] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-[#666666] font-bold">[{t("selfMasteryRating")}]:</span>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star as any)}
                    className={`px-1.5 py-0.2 border text-xs font-bold transition-colors cursor-pointer ${
                      selectedRating >= star ? "border-[#111111] bg-[#111111] text-white" : "border-[#e5e5e5] text-[#999999]"
                    }`}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinishAndSave}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white font-bold text-xs border border-[#111111] transition-colors cursor-pointer"
            >
              <span>[{t("markDoneAndLogTime")}]</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
