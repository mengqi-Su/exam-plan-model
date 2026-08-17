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
  
  // Default exam date is 3 weeks from today
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

  // Calculate days difference
  const daysDiff = React.useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(examDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, examDate]);

  // Update schedule for specific day of week
  const handleUpdateSchedule = (dayIdx: number, patch: Partial<DaySchedulePreference>) => {
    setDailySchedules((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d))
    );
  };

  // Toggle weak topic
  const handleToggleWeakTopic = (topicTitle: string) => {
    if (selectedWeakTopics.includes(topicTitle)) {
      setSelectedWeakTopics(selectedWeakTopics.filter(t => t !== topicTitle));
    } else {
      setSelectedWeakTopics([...selectedWeakTopics, topicTitle]);
    }
  };

  // Generate Plan Handler
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
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
        <button
          onClick={onBackToMaterials}
          className="flex items-center space-x-1 text-xs font-semibold text-[#787774] hover:text-[#37352f] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t("backToMaterials")}</span>
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="notion-tag-blue px-2 py-0.5 rounded text-[10px] font-semibold">
            {t("step2Badge")}
          </span>
          <span className="text-[#787774]">{t("scheduleAndPreferences")}</span>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white border border-[#e9e9e7] rounded-lg p-6 shadow-2xs space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#37352f]">
            {t("configureTimelineTitle")}
          </h2>
          <p className="text-xs text-[#787774] mt-0.5">
            {t("configureTimelineSubtitle")}
          </p>
        </div>

        {/* Section 1: Timeline */}
        <div className="space-y-3 pt-4 border-t border-[#e9e9e7]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#2b78a0]" />
            <span>1. {t("sectionTimeline")}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("startDateLabel")}
              </label>
              <input
                id="start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("examDateLabel")}
              </label>
              <input
                id="exam-date-input"
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("examTimeLabel")}
              </label>
              <input
                id="exam-time-input"
                type="time"
                value={examTime}
                onChange={(e) => setExamTime(e.target.value)}
                className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0] focus:bg-white"
              />
            </div>
          </div>

          <div className="p-2.5 bg-[#f7f6f3] border border-[#e9e9e7] rounded-md flex items-center justify-between text-xs text-[#5a5a57]">
            <span>
              {language === "zh" ? "备考窗口期: " : "Study Window: "}
              <strong className="text-[#37352f]">{daysDiff} {language === "zh" ? "天" : "Total Days"}</strong> ({Math.round(daysDiff / 7)} {language === "zh" ? "周" : "Weeks"})
            </span>
            <span className="text-[#787774]">
              {examName} • {subject}
            </span>
          </div>
        </div>

        {/* Section 2: Weekly Available Study Hours */}
        <div className="space-y-3 pt-4 border-t border-[#e9e9e7]">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-[#448361]" />
              <span>2. {t("sectionWeeklyHours")}</span>
            </h3>
            <span className="text-xs text-[#787774]">
              {language === "zh" ? "每周总计投入: " : "Total commitment: "}
              <strong className="text-[#37352f]">
                {dailySchedules.reduce((acc, d) => acc + (d.enabled ? d.availableHours : 0), 0)} {language === "zh" ? "小时/周" : "hrs/week"}
              </strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
            {dailySchedules.map((day, idx) => (
              <div
                key={day.dayOfWeek}
                className={`p-2.5 rounded-lg border text-xs transition-colors ${
                  day.enabled
                    ? "bg-white border-[#e9e9e7] text-[#37352f]"
                    : "bg-[#fbfbfa] border-[#e9e9e7] text-[#9b9a97] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-xs">{dayNames[idx] || day.dayName.slice(0, 3)}</span>
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) => handleUpdateSchedule(idx, { enabled: e.target.checked })}
                    className="rounded-sm border-[#dfdfde] text-[#37352f] focus:ring-0 cursor-pointer"
                  />
                </div>

                {day.enabled ? (
                  <div className="space-y-1.5">
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-[#787774]">
                        <span>{language === "zh" ? "时长:" : "Hours:"}</span>
                        <span className="font-semibold text-[#37352f]">{day.availableHours}h</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="8"
                        step="0.5"
                        value={day.availableHours}
                        onChange={(e) => handleUpdateSchedule(idx, { availableHours: Number(e.target.value) })}
                        className="w-full h-1 bg-[#efefed] rounded-lg appearance-none cursor-pointer accent-[#37352f]"
                      />
                    </div>

                    <select
                      value={day.preferredTimeSlot}
                      onChange={(e) => handleUpdateSchedule(idx, { preferredTimeSlot: e.target.value as any })}
                      className="w-full bg-[#f7f6f3] border border-[#e9e9e7] rounded px-1 py-0.5 text-[10px] text-[#37352f]"
                    >
                      <option value="morning">{t("slotMorning")}</option>
                      <option value="afternoon">{t("slotAfternoon")}</option>
                      <option value="evening">{t("slotEvening")}</option>
                      <option value="flexible">{t("slotFlexible")}</option>
                    </select>
                  </div>
                ) : (
                  <div className="py-2 text-center text-[10px] text-[#9b9a97]">{t("restDay")}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Study Pace Archetype & Focus Duration */}
        <div className="space-y-3 pt-4 border-t border-[#e9e9e7]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
            <BrainCircuit className="w-3.5 h-3.5 text-[#9065b0]" />
            <span>3. {t("sectionPace")}</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            {[
              {
                id: "deep_mastery",
                title: t("paceDeepMastery"),
                desc: t("paceDeepMasteryDesc"),
                icon: ShieldCheck,
                badge: language === "zh" ? "推荐" : "Recommended",
              },
              {
                id: "spaced_repetition",
                title: t("paceSpacedRepetition"),
                desc: t("paceSpacedRepetitionDesc"),
                icon: Target,
                badge: language === "zh" ? "长期记忆" : "Long-term",
              },
              {
                id: "balanced",
                title: t("paceBalanced"),
                desc: t("paceBalancedDesc"),
                icon: Sliders,
                badge: language === "zh" ? "稳健" : "Steady",
              },
              {
                id: "intensive_crash",
                title: t("paceIntensive"),
                desc: t("paceIntensiveDesc"),
                icon: Zap,
                badge: language === "zh" ? "快速突破" : "Fast Track",
              },
            ].map((pace) => {
              const Icon = pace.icon;
              const isSelected = studyPace === pace.id;
              return (
                <div
                  key={pace.id}
                  onClick={() => setStudyPace(pace.id as any)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#fbfbfa] border-[#37352f] shadow-xs"
                      : "bg-white border-[#e9e9e7] hover:border-[#dfdfde]"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className={`w-4 h-4 ${isSelected ? "text-[#37352f]" : "text-[#787774]"}`} />
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#f7f6f3] text-[#787774] font-medium">
                      {pace.badge}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-[#37352f]">{pace.title}</h4>
                  <p className="text-[11px] text-[#787774] mt-0.5 leading-relaxed">{pace.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Session Duration & Practice Exam Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("focusSessionDurationLabel")}
              </label>
              <select
                value={sessionLength}
                onChange={(e) => setSessionLength(Number(e.target.value))}
                className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5 text-xs text-[#37352f] focus:outline-none focus:border-[#2b78a0]"
              >
                <option value={25}>25 {language === "zh" ? "分钟 (番茄工作法)" : "Minutes (Pomodoro)"}</option>
                <option value={45}>45 {language === "zh" ? "分钟 (标准复习单元)" : "Minutes (Standard Study Block)"}</option>
                <option value={60}>60 {language === "zh" ? "分钟 (深度聚焦)" : "Minutes (Deep Focus)"}</option>
                <option value={90}>90 {language === "zh" ? "分钟 (高强度演练)" : "Minutes (Intensive Practice)"}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("practiceExamsLabel")}
              </label>
              <div className="flex items-center space-x-2 bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5">
                <input
                  type="checkbox"
                  id="include-mocks-checkbox"
                  checked={includePracticeExams}
                  onChange={(e) => setIncludePracticeExams(e.target.checked)}
                  className="rounded-sm border-[#dfdfde] text-[#37352f] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="include-mocks-checkbox" className="text-xs text-[#37352f] cursor-pointer">
                  {t("scheduleMocksCheck")}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#37352f] mb-1">
                {t("bufferDaysLabel")}
              </label>
              <div className="flex items-center space-x-1.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-2.5 py-1.5">
                <input
                  type="checkbox"
                  id="include-buffer-checkbox"
                  checked={includeBufferDays}
                  onChange={(e) => setIncludeBufferDays(e.target.checked)}
                  className="rounded-sm border-[#dfdfde] text-[#37352f] focus:ring-0 cursor-pointer"
                />
                <input
                  type="number"
                  min="1"
                  max="7"
                  disabled={!includeBufferDays}
                  value={bufferDaysCount}
                  onChange={(e) => setBufferDaysCount(Number(e.target.value))}
                  className="w-10 bg-white border border-[#e9e9e7] rounded px-1 text-xs text-[#37352f] disabled:opacity-50"
                />
                <span className="text-[11px] text-[#787774]">{language === "zh" ? "天考前冲刺机动期" : "days before exam"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Weak Spots */}
        {topics.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-[#e9e9e7]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
              <Target className="w-3.5 h-3.5 text-[#d44c47]" />
              <span>4. {t("sectionWeakTopics")}</span>
            </h3>
            <p className="text-xs text-[#787774]">
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
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors flex items-center space-x-1 ${
                      isSelected
                        ? "notion-tag-red border-[#f9d3d5]"
                        : "bg-[#f7f6f3] border-[#e9e9e7] text-[#5a5a57] hover:border-[#dfdfde]"
                    }`}
                  >
                    <span>{top.title}</span>
                    {top.difficulty === "hard" && <Flame className="w-3 h-3 text-[#eb5757]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Generate Action Button */}
        <div className="pt-4 border-t border-[#e9e9e7]">
          {generateError && (
            <div className="p-3 mb-3 bg-[#fdebec] border border-[#f9d3d5] text-[#d44c47] text-xs rounded-md flex items-start space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generateError}</span>
            </div>
          )}

          <button
            id="generate-plan-submit-btn"
            type="button"
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-[#37352f] hover:bg-[#201f1c] disabled:opacity-50 text-white font-semibold text-sm rounded-md shadow-xs transition-colors cursor-pointer"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{t("generatingPlanLoading")}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#cb912f]" />
                <span>{t("generatePlanBtn")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
