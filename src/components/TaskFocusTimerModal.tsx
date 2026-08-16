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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-[#e9e9e7] rounded-xl w-full max-w-lg text-[#37352f] shadow-xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-[#f7f6f3] border-b border-[#e9e9e7] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#448361]" />
            <span className="text-xs font-semibold text-[#5a5a57]">
              {t("focusModalTitle")}
            </span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1 rounded hover:bg-[#efefed] text-[#787774] transition-colors"
              title={soundEnabled ? (language === "zh" ? "关闭提示音" : "Mute Bell") : (language === "zh" ? "开启提示音" : "Enable Sound")}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-[#9b9a97]" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[#efefed] text-[#787774] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Clock Dial */}
        <div className="p-6 text-center space-y-5 flex flex-col items-center">
          <div>
            <span className="notion-tag-purple px-2 py-0.5 rounded text-[10px] font-semibold">
              {task.topicTitle}
            </span>
            <h3 className="text-base font-bold text-[#37352f] mt-1.5 max-w-sm mx-auto">
              {task.title}
            </h3>
          </div>

          {/* Circular Countdown Display */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="5"
                className="text-[#efefed] fill-none"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="42"
                stroke="currentColor"
                strokeWidth="5"
                strokeDasharray="264"
                strokeDashoffset={264 - (264 * progressPercent) / 100}
                strokeLinecap="round"
                className="text-[#37352f] fill-none transition-all duration-500"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold font-mono text-[#37352f]">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="text-[10px] text-[#787774] font-medium mt-0.5">
                {isRunning ? t("deepFocusing") : timeLeft === 0 ? t("sessionComplete") : t("readyToStart")}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleResetTimer}
              className="p-2 rounded-md bg-[#f7f6f3] hover:bg-[#efefed] text-[#787774] transition-colors border border-[#e9e9e7]"
              title={language === "zh" ? "重置倒计时" : "Reset Timer"}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleTimer}
              className={`px-6 py-2 rounded-md font-semibold text-xs transition-colors flex items-center space-x-1.5 shadow-xs ${
                isRunning
                  ? "bg-[#d9730d] hover:bg-[#c26508] text-white"
                  : "bg-[#37352f] hover:bg-[#201f1c] text-white"
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

          {/* Key Objectives Checklist */}
          {task.keyObjectives && task.keyObjectives.length > 0 && (
            <div className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-3 text-left space-y-1.5">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#787774]">
                {t("objectivesForSession")}
              </h4>
              <div className="space-y-1">
                {task.keyObjectives.map((obj, i) => (
                  <div
                    key={i}
                    onClick={() => toggleObjective(i)}
                    className="flex items-start space-x-2 cursor-pointer text-xs p-1 rounded hover:bg-[#efefed] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={!!checkedObjectives[i]}
                      onChange={() => {}}
                      className="rounded-sm border-[#dfdfde] text-[#37352f] focus:ring-0 mt-0.5"
                    />
                    <span className={checkedObjectives[i] ? "line-through text-[#9b9a97]" : "text-[#37352f]"}>
                      {obj}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Self-Rating & Completion Action */}
          <div className="w-full pt-3 border-t border-[#e9e9e7] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-[#787774]">{t("selfMasteryRating")}</span>
              <div className="flex space-x-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(star as any)}
                    className={`p-0.5 text-xs font-bold transition-colors ${
                      selectedRating >= star ? "text-[#cb912f]" : "text-[#dfdfde]"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinishAndSave}
              className="w-full sm:w-auto flex items-center justify-center space-x-1.5 px-4 py-1.5 bg-[#448361] hover:bg-[#376b4f] text-white font-semibold text-xs rounded-md shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t("markDoneAndLogTime")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
