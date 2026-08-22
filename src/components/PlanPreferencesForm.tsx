import React, { useState } from "react";
import {
  Calendar,
  Clock,
  Sparkles,
  Sliders,
  Target,
  BrainCircuit,
  ShieldCheck,
  Zap,
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Flame
} from "lucide-react";
import { DaySchedulePreference, ExamStudyPlan, StudyMaterial, SyllabusTopic, UserStudyPreferences } from "../types";
import { DEFAULT_WEEK_SCHEDULE } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { fallbackGeneratePlanClient } from "../lib/fallbackPlanner";
import { RulerTimePicker } from "./RulerTimePicker";

interface PlanPreferencesFormProps {
  examName: string;
  subject: string;
  topics: SyllabusTopic[];
  materials: StudyMaterial[];
  materialsSummary: string;
  onBackToMaterials: () => void;
  onPlanGenerated: (newPlan: ExamStudyPlan) => void;
}

export function PlanPreferencesForm({
  examName,
  subject,
  topics,
  materials,
  materialsSummary,
  onBackToMaterials,
  onPlanGenerated,
}: PlanPreferencesFormProps) {
  const { t, language } = useI18n();
  const todayStr = new Date().toISOString().split("T")[0];

  const defaultExamDate = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  }, []);

  const [startDate, setStartDate] = useState(todayStr);
  const [examDate, setExamDate] = useState(defaultExamDate);
  const [examTime, setExamTime] = useState("09:00");
  const [targetScore, setTargetScore] = useState("A (90%+ / 优秀)");
  const [studyPace, setStudyPace] = useState<UserStudyPreferences["studyPace"]>("deep_mastery");
  const [sessionLength, setSessionLength] = useState<number>(45);
  const [includePracticeExams, setIncludePracticeExams] = useState(true);
  const [includeBufferDays, setIncludeBufferDays] = useState(true);
  const [bufferDaysCount, setBufferDaysCount] = useState(2);
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(DEFAULT_WEEK_SCHEDULE);
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>(
    topics.filter(t => t.difficulty === "hard").map(t => t.title)
  );
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const daysDiff = React.useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(examDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, examDate]);

  const handleUpdateSchedule = (dayIdx: number, patch: Partial<DaySchedulePreference>) => {
    setDailySchedules((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d))
    );
  };

  const handleUpdateDayHours = (dayOfWeek: number, hours: number) => {
    const clamped = Math.max(0, Math.min(16, Math.round(hours * 10) / 10));
    setDailySchedules((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, availableHours: clamped, enabled: clamped > 0 } : d))
    );
  };

  const handleToggleDayEnabled = (dayOfWeek: number) => {
    setDailySchedules((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek === dayOfWeek) {
          const nextEnabled = !d.enabled;
          return {
            ...d,
            enabled: nextEnabled,
            availableHours: nextEnabled && d.availableHours === 0 ? 2.5 : d.availableHours,
          };
        }
        return d;
      })
    );
  };

  const handleApplyWeeklyPreset = (type: "weekday_weekend" | "balanced_3h" | "intensive_5h" | "light_1_5h") => {
    setDailySchedules((prev) =>
      prev.map((d) => {
        const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
        if (type === "weekday_weekend") {
          return { ...d, availableHours: isWeekend ? 5 : 2.5, enabled: true };
        } else if (type === "balanced_3h") {
          return { ...d, availableHours: 3, enabled: true };
        } else if (type === "intensive_5h") {
          return { ...d, availableHours: 5, enabled: true };
        } else {
          return { ...d, availableHours: isWeekend ? 2.5 : 1.5, enabled: true };
        }
      })
    );
  };

  const handleToggleWeakTopic = (topicTitle: string) => {
    if (selectedWeakTopics.includes(topicTitle)) {
      setSelectedWeakTopics(selectedWeakTopics.filter(t => t !== topicTitle));
    } else {
      setSelectedWeakTopics([...selectedWeakTopics, topicTitle]);
    }
  };

  const handleGeneratePlan = async () => {
    if (!examDate || !startDate) {
      setGenerateError(language === "zh" ? "请指定有效的开始日期和考试日期。" : "Please specify valid start and exam dates.");
      return;
    }
    if (daysDiff <= 0) {
      setGenerateError(language === "zh" ? "考试日期必须晚于开始日期。" : "Exam date must be after the start date.");
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const preferences: UserStudyPreferences = {
      examName: examName || (language === "zh" ? "期末/资格考试" : "Final Exam"),
      subject: subject || (language === "zh" ? "综合学科" : "General"),
      startDate,
      examDate,
      examTime,
      targetScoreOrGrade: targetScore,
      dailySchedules,
      studyPace,
      sessionLengthMinutes: sessionLength,
      includePracticeExams,
      includeBufferDays,
      bufferDaysCount,
      weakTopicsFocus: selectedWeakTopics,
      additionalNotes,
    };

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics,
            preferences,
            materialsSummary,
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network error during plan generation in preferences form:", fetchErr);
      }

      if (!data || !data.tasks || data.tasks.length === 0) {
        data = fallbackGeneratePlanClient(topics, preferences);
      }

      const createdPlan: ExamStudyPlan = {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        examName: preferences.examName,
        subject: preferences.subject,
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: data.totalPlannedHours || 35,
        phases: data.phases || [],
        topics,
        tasks: data.tasks || [],
        preferences,
        materialsSummary,
        materials: materials && materials.length > 0 ? materials : undefined,
      };

      onPlanGenerated(createdPlan);
    } catch (err: any) {
      console.error("Plan creation fallback handling:", err);
      const safeData = fallbackGeneratePlanClient(topics, preferences);
      const createdPlan: ExamStudyPlan = {
        id: `plan-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        examName: preferences.examName,
        subject: preferences.subject,
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: safeData.totalPlannedHours || 30,
        phases: safeData.phases,
        topics,
        tasks: safeData.tasks,
        preferences,
        materialsSummary,
        materials: materials && materials.length > 0 ? materials : undefined,
      };
      onPlanGenerated(createdPlan);
    } finally {
      setIsGenerating(false);
    }
  };

  const dayNames = language === "zh"
    ? ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-6 font-mono text-[#111111]">

      <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
        <button
          onClick={onBackToMaterials}
          className="flex items-center space-x-1 text-xs font-bold text-[#111111] hover:underline transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>[{t("backToMaterials")}]</span>
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="border border-[#111111] bg-[#111111] text-white px-2 py-0.5 text-[10px] font-bold">
            [{t("step2Badge")}]
          </span>
          <span className="text-[#666666] font-bold uppercase">{t("scheduleAndPreferences")}</span>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-tight text-[#111111]">
            {t("configureTimelineTitle")}
          </h2>
          <p className="text-xs text-[#666666] mt-1">
            {t("configureTimelineSubtitle")}
          </p>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#111111]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-1.5">
            <span>[1. {t("sectionTimeline")}]</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-white border border-[#111111]">
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("startDateLabel")}
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs text-[#111111] focus:outline-none focus:bg-white font-mono"
              />
            </div>

            <div className="p-3.5 bg-white border border-[#111111]">
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("examDateLabel")}
              </label>
              <input
                id="exam-date-input"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs text-[#111111] focus:outline-none focus:bg-white font-mono"
              />
            </div>

            <div className="p-3.5 bg-white border border-[#111111]">
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("examTimeLabel")}
              </label>
              <input
                id="exam-time-input"
                type="time"
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs text-[#111111] focus:outline-none focus:bg-white font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-[#fafafa] border border-[#111111] flex items-center justify-between text-xs text-[#111111]">
            <span>
              {language === "zh" ? "[备考窗口期]: " : "[STUDY WINDOW]: "}
              <strong className="font-bold">{daysDiff} {language === "zh" ? "天" : "DAYS"}</strong> ({Math.round(daysDiff / 7)} {language === "zh" ? "周" : "WEEKS"})
            </span>
            <span className="text-[#666666] font-bold">
              {examName}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-[#111111]">
          <RulerTimePicker
            language={language}
            dailySchedules={dailySchedules}
            onUpdateDayHours={handleUpdateDayHours}
            onToggleDayEnabled={handleToggleDayEnabled}
            onApplyPreset={handleApplyWeeklyPreset}
            daysDiff={daysDiff}
          />
        </div>

        <div className="space-y-3 pt-4 border-t border-[#111111]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-1.5">
            <span>[3. {t("sectionPace")}]</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {[
              {
                id: "deep_mastery",
                title: t("paceDeepMastery"),
                desc: t("paceDeepMasteryDesc"),
                icon: ShieldCheck,
                badge: language === "zh" ? "推荐" : "RECOMMENDED",
              },
              {
                id: "spaced_repetition",
                title: t("paceSpacedRepetition"),
                desc: t("paceSpacedRepetitionDesc"),
                icon: Target,
                badge: language === "zh" ? "长期记忆" : "SPACED",
              },
              {
                id: "balanced",
                title: t("paceBalanced"),
                desc: t("paceBalancedDesc"),
                icon: Sliders,
                badge: language === "zh" ? "稳健" : "STEADY",
              },
              {
                id: "intensive_crash",
                title: t("paceIntensive"),
                desc: t("paceIntensiveDesc"),
                icon: Zap,
                badge: language === "zh" ? "快速突破" : "FAST",
              },
            ].map((pace) => {
              const isSelected = studyPace === pace.id;
              return (
                <div
                  key={pace.id}
                  onClick={() => setStudyPace(pace.id as any)}
                  className={`p-3.5 border cursor-pointer transition-all font-mono ${
                    isSelected
                      ? "bg-[#111111] text-white border-[#111111]"
                      : "bg-white border-[#111111] hover:bg-[#fafafa] text-[#111111]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold uppercase">[{pace.id.split('_')[0]}]</span>
                    <span className={`text-[9px] px-1 py-0.2 border font-bold ${isSelected ? 'border-white text-white' : 'border-[#111111] text-[#111111]'}`}>
                      {pace.badge}
                    </span>
                  </div>
                  <h4 className="font-bold text-xs uppercase">{pace.title}</h4>
                  <p className={`text-[10px] mt-1 leading-relaxed ${isSelected ? 'text-[#cccccc]' : 'text-[#666666]'}`}>{pace.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono">
            <div>
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("focusSessionDurationLabel")}
              </label>
              <select
                value={sessionLength}
                onChange={(e) => setSessionLength(Number(e.target.value))}
                className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs text-[#111111] focus:outline-none font-mono font-bold"
              >
                <option value={25}>25 {language === "zh" ? "分钟 (番茄工作法)" : "Minutes (Pomodoro)"}</option>
                <option value={45}>45 {language === "zh" ? "分钟 (标准复习单元)" : "Minutes (Standard Study Block)"}</option>
                <option value={60}>60 {language === "zh" ? "分钟 (深度聚焦)" : "Minutes (Deep Focus)"}</option>
                <option value={90}>90 {language === "zh" ? "分钟 (高强度演练)" : "Minutes (Intensive Practice)"}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("practiceExamsLabel")}
              </label>
              <div className="flex items-center space-x-2 bg-[#fafafa] border border-[#111111] px-2.5 py-1.5">
                <input
                  type="checkbox"
                  id="include-mocks-checkbox"
                  checked={includePracticeExams}
                  onChange={(e) => setIncludePracticeExams(e.target.checked)}
                  className="cursor-pointer"
                />
                <label htmlFor="include-mocks-checkbox" className="text-xs text-[#111111] font-bold cursor-pointer">
                  {t("scheduleMocksCheck")}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                {t("bufferDaysLabel")}
              </label>
              <div className="flex items-center space-x-1.5 bg-[#fafafa] border border-[#111111] px-2.5 py-1.5">
                <input
                  type="checkbox"
                  id="include-buffer-checkbox"
                  checked={includeBufferDays}
                  onChange={(e) => setIncludeBufferDays(e.target.checked)}
                  className="cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="7"
                  disabled={!includeBufferDays}
                  value={bufferDaysCount}
                  onChange={(e) => setBufferDaysCount(Number(e.target.value))}
                  className="w-10 bg-white border border-[#111111] px-1 text-xs text-[#111111] font-bold disabled:opacity-50"
                />
                <span className="text-[10px] text-[#666666] font-bold uppercase">{language === "zh" ? "天考前冲刺机动期" : "days buffer"}</span>
              </div>
            </div>
          </div>
        </div>

        {topics.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-[#111111]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-1.5">
              <span>[4. {t("sectionWeakTopics")}]</span>
            </h3>
            <p className="text-xs text-[#666666]">
              {t("weakTopicsHint")}
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {topics.map((top) => {
                const isSelected = selectedWeakTopics.includes(top.title);
                return (
                  <button
                    key={top.id}
                    type="button"
                    onClick={() => handleToggleWeakTopic(top.title)}
                    className={`px-2.5 py-1 text-xs font-bold border transition-colors flex items-center space-x-1 cursor-pointer ${
                      isSelected
                        ? "bg-[#111111] text-white border-[#111111]"
                        : "bg-white border-[#111111] text-[#111111] hover:bg-[#fafafa]"
                    }`}
                  >
                    <span>[{top.title}]</span>
                    {top.difficulty === "hard" && <span className="text-[9px] font-bold text-[#ff3333]">[{language === "zh" ? "难点" : "HARD"}]</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-[#111111]">
          {generateError && (
            <div className="p-3 mb-3 bg-[#fafafa] border border-[#111111] text-[#111111] text-xs font-bold flex items-start space-x-1.5">
              <span>[ERROR: {generateError}]</span>
            </div>
          )}

          <button
            id="generate-plan-submit-btn"
            type="button"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin" />
                <span>[{t("generatingPlanLoading")}]</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>[{t("generatePlanBtn")}]</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
