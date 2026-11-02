import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Loader2,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DaySchedulePreference,
  ExamStudyPlan,
  StudyMaterial,
  SyllabusTopic,
  UserStudyPreferences,
} from "../types";
import { useI18n } from "../lib/i18n";
import { parseDocumentFile } from "../lib/documentParser";
import { GenerationError, MAX_AI_MATERIALS, prepareMaterialsForAI, runGeneration } from "../lib/aiClient";
import { daysBetween, toLocalDateString } from "../lib/date";
import { DEFAULT_WEEK_SCHEDULE } from "../lib/storage";
import { RulerTimePicker } from "./RulerTimePicker";

interface AddExamSubjectWizardProps {
  onPlanCreated: (newPlan: ExamStudyPlan, notice?: string | null) => void;
  onCancel: () => void;
  existingPlans: ExamStudyPlan[];
  defaultStudyPace: UserStudyPreferences["studyPace"];
}

const DAY_NAMES_ZH = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function inferDocumentType(fileName: string): {
  type: StudyMaterial["type"];
  categoryGroup: StudyMaterial["categoryGroup"];
} {
  const lower = fileName.toLowerCase();
  if (["大纲", "syllabus", "curriculum", "考纲"].some((k) => lower.includes(k))) {
    return { type: "syllabus", categoryGroup: "course_syllabus" };
  }
  if (["真题", "试卷", "exam", "quiz", "test", "paper"].some((k) => lower.includes(k))) {
    return { type: "past_exam", categoryGroup: "exam_question" };
  }
  if (["讲义", "课件", "slide", "ppt", "lecture"].some((k) => lower.includes(k))) {
    return { type: "lecture_slides", categoryGroup: "study_material" };
  }
  if (["公式", "提纲", "cheat", "summary", "速查"].some((k) => lower.includes(k))) {
    return { type: "textbook_outline", categoryGroup: "study_material" };
  }
  return { type: "notes", categoryGroup: "study_material" };
}

function suggestExamName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[（(][^)）]*[)）]/g, " ")
    .replace(/20\d{2}[-–_年]?(\d{2})?/g, " ")
    .replace(/(考试大纲|教学大纲|课程大纲|syllabus|期末|期中|考试|试卷|真题|讲义|课件|笔记|notes?)/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

export function AddExamSubjectWizard({
  onPlanCreated,
  onCancel,
  existingPlans,
  defaultStudyPace,
}: AddExamSubjectWizardProps) {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState(() => toLocalDateString());
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [dailyHoursInput, setDailyHoursInput] = useState("2");
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(DEFAULT_WEEK_SCHEDULE);
  const [advancedTouched, setAdvancedTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requirements, setRequirements] = useState("");

  const [courseDocuments, setCourseDocuments] = useState<StudyMaterial[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteForm, setShowPasteForm] = useState(false);
  const [pasteDocTitle, setPasteDocTitle] = useState("");
  const [pasteDocContent, setPasteDocContent] = useState("");

  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [showTopics, setShowTopics] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [workStage, setWorkStage] = useState<"extracting" | "planning">("extracting");
  const [genStatus, setGenStatus] = useState("");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/functions/v1/app/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.ai?.configured === "boolean") {
          setAiReady(data.ai.configured);
        }
      })
      .catch(() => {
        // Health check is advisory only; generation reports its own errors.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedDailyHours = Number(dailyHoursInput);
  const dailyHoursValid =
    Number.isFinite(parsedDailyHours) && parsedDailyHours >= 0.5 && parsedDailyHours <= 12;
  const hoursReady = advancedTouched
    ? dailySchedules.some((d) => d.enabled && d.availableHours > 0)
    : dailyHoursValid;

  const daysDiff = useMemo(() => {
    if (!examDate) return null;
    return daysBetween(startDate, examDate);
  }, [startDate, examDate]);

  const totalPlannedHours = useMemo(() => {
    if (daysDiff === null || daysDiff < 0 || !dailyHoursValid) return null;
    return Math.round(Math.max(1, daysDiff) * parsedDailyHours * 10) / 10;
  }, [daysDiff, parsedDailyHours, dailyHoursValid]);

  const topicsHours = useMemo(
    () => Math.round(topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0)),
    [topics]
  );

  const detailsReady =
    !!examName.trim() &&
    !!startDate &&
    !!examDate &&
    daysBetween(startDate, examDate) >= 0 &&
    hoursReady;
  const materialsReady = courseDocuments.length > 0 && !isParsingFiles;

  const steps = [
    { n: 1 as const, label: tt("考试信息", "Exam details"), icon: CalendarDays },
    { n: 2 as const, label: tt("上传资料", "Materials"), icon: Upload },
    { n: 3 as const, label: tt("生成计划", "Generate"), icon: Sparkles },
  ];

  const goToStep = (target: 1 | 2 | 3) => {
    if (isWorking || target > step) return;
    clearTransientError();
    setStep(target);
  };

  const handleNext = () => {
    clearTransientError();
    if (step === 1 && detailsReady) setStep(2);
    else if (step === 2 && materialsReady) setStep(3);
  };

  const typeLabels: Record<StudyMaterial["type"], string> = {
    syllabus: tt("考纲", "Syllabus"),
    notes: tt("笔记", "Notes"),
    lecture_slides: tt("讲义", "Slides"),
    past_exam: tt("真题", "Past exam"),
    textbook_outline: tt("提纲", "Outline"),
    custom: tt("资料", "Material"),
  };

  const buildDailySchedules = (hours: number): DaySchedulePreference[] =>
    [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      dayName: language === "zh" ? DAY_NAMES_ZH[dayOfWeek] : DAY_NAMES_EN[dayOfWeek],
      availableHours: hours,
      preferredTimeSlot: "flexible" as const,
      enabled: true,
    }));

  const effectiveSchedules = advancedTouched ? dailySchedules : buildDailySchedules(parsedDailyHours);

  const weeklyTotalHours = useMemo(
    () => dailySchedules.reduce((acc, d) => (d.enabled ? acc + d.availableHours : acc), 0),
    [dailySchedules]
  );

  const advancedTotalHours = useMemo(() => {
    if (daysDiff === null || daysDiff < 0) return 0;
    const start = new Date(startDate);
    let total = 0;
    for (let i = 0; i < daysDiff; i++) {
      const dow = new Date(start.getTime() + i * 86400000).getDay();
      const sched = dailySchedules.find((s) => s.dayOfWeek === dow);
      if (sched && sched.enabled) total += sched.availableHours;
    }
    return Math.round(total * 10) / 10;
  }, [startDate, daysDiff, dailySchedules]);

  const handleUpdateDayHours = (dayOfWeek: number, hours: number) => {
    const clamped = Math.max(0, Math.min(12, Math.round(hours * 2) / 2));
    setAdvancedTouched(true);
    setDailySchedules((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, availableHours: clamped, enabled: clamped > 0 } : d))
    );
  };

  const handleToggleDayEnabled = (dayOfWeek: number) => {
    setAdvancedTouched(true);
    setDailySchedules((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const nextEnabled = !d.enabled;
        return { ...d, enabled: nextEnabled, availableHours: nextEnabled && d.availableHours === 0 ? 2.5 : d.availableHours };
      })
    );
  };

  const handleApplyWeeklyPreset = (type: "weekday_weekend" | "balanced_3h" | "intensive_5h" | "light_1_5h") => {
    setAdvancedTouched(true);
    setDailySchedules((prev) =>
      prev.map((d) => {
        const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
        if (type === "weekday_weekend") return { ...d, availableHours: isWeekend ? 5 : 2.5, enabled: true };
        if (type === "balanced_3h") return { ...d, availableHours: 3, enabled: true };
        if (type === "intensive_5h") return { ...d, availableHours: 5, enabled: true };
        return { ...d, availableHours: isWeekend ? 2.5 : 1.5, enabled: true };
      })
    );
  };

  const invalidateAiResult = () => {
    setTopics([]);
    setShowTopics(false);
    setError(null);
  };

  const clearTransientError = () => {
    setError((prev) => (prev && !prev.code ? null : prev));
  };

  const handleFileUpload = async (files: FileList | File[] | null) => {
    if (!files || isParsingFiles || isWorking) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    if (courseDocuments.length >= MAX_AI_MATERIALS) {
      setError({
        message: tt(
          `一次最多添加 ${MAX_AI_MATERIALS} 份资料，请先删除部分文件。`,
          `Up to ${MAX_AI_MATERIALS} materials can be added. Remove some files first.`
        ),
      });
      return;
    }

    const remainingSlots = MAX_AI_MATERIALS - courseDocuments.length;
    const fileArray = incoming.slice(0, remainingSlots);
    if (incoming.length > remainingSlots) {
      setError({
        message: tt(
          `一次最多添加 ${MAX_AI_MATERIALS} 份资料，本次仅处理前 ${remainingSlots} 份。`,
          `Up to ${MAX_AI_MATERIALS} materials can be added. Only the first ${remainingSlots} files were processed.`
        ),
      });
    } else {
      setError(null);
    }

    setIsParsingFiles(true);
    const newDocs: StudyMaterial[] = [];
    const failures: string[] = [];
    let suggestedName = "";

    for (let i = 0; i < fileArray.length; i += 1) {
      const file = fileArray[i];
      setParsingStatus(
        tt(
          `正在读取 (${i + 1}/${fileArray.length})：${file.name}`,
          `Reading (${i + 1}/${fileArray.length}): ${file.name}`
        )
      );

      try {
        const parsed = await parseDocumentFile(file, language, (status) => setParsingStatus(status));
        const { type, categoryGroup } = inferDocumentType(file.name);
        newDocs.push({
          id: `mat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          type,
          categoryGroup,
          content: parsed.text,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          difficulty: type === "past_exam" ? "hard" : "medium",
          summaryNotes: parsed.text.slice(0, 160) + (parsed.text.length > 160 ? "..." : ""),
        });
        if (!suggestedName) {
          suggestedName = suggestExamName(file.name);
        }
      } catch (err: any) {
        failures.push(`${file.name}：${err?.message || tt("解析失败", "parse failed")}`);
      }
    }

    setIsParsingFiles(false);
    setParsingStatus("");

    if (newDocs.length > 0) {
      setCourseDocuments((prev) => [...prev, ...newDocs]);
      invalidateAiResult();
      if (!examName.trim() && suggestedName) {
        setExamName(suggestedName);
      }
    }

    if (failures.length > 0) {
      const extra =
        failures.length > 3
          ? tt(`（另有 ${failures.length - 3} 个失败）`, ` (+${failures.length - 3} more failed)`)
          : "";
      setError({ message: failures.slice(0, 3).join("；") + extra });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isParsingFiles) return;
    void handleFileUpload(event.dataTransfer.files);
  };

  const handleDeleteDocument = (id: string) => {
    if (isWorking) return;
    setCourseDocuments((prev) => prev.filter((doc) => doc.id !== id));
    invalidateAiResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddPastedDocument = () => {
    if (isWorking) return;
    const content = pasteDocContent.trim();
    if (!content) return;
    if (courseDocuments.length >= MAX_AI_MATERIALS) {
      setError({
        message: tt(
          `一次最多添加 ${MAX_AI_MATERIALS} 份资料，请先删除部分文件。`,
          `Up to ${MAX_AI_MATERIALS} materials can be added. Remove some files first.`
        ),
      });
      return;
    }

    const title =
      pasteDocTitle.trim() || `${tt("粘贴笔记", "Pasted notes")} ${courseDocuments.length + 1}`;

    setCourseDocuments((prev) => [
      ...prev,
      {
        id: `mat-paste-${Date.now()}`,
        name: title,
        type: "notes",
        categoryGroup: "study_material",
        content,
        sizeBytes: new Blob([content]).size,
        uploadedAt: new Date().toISOString(),
        difficulty: "medium",
        summaryNotes: content.slice(0, 160) + (content.length > 160 ? "..." : ""),
      },
    ]);
    invalidateAiResult();
    setPasteDocTitle("");
    setPasteDocContent("");
    setShowPasteForm(false);
  };

  const requestTopics = async (): Promise<SyllabusTopic[]> => {
    const { result } = await runGeneration<{ summary?: string; topics?: SyllabusTopic[] }>(
      "syllabus",
      {
        materials: prepareMaterialsForAI(courseDocuments),
        examName: examName.trim(),
        subject: subject.trim(),
      },
      { language, onStatus: setGenStatus }
    );

    const extracted: SyllabusTopic[] = Array.isArray(result?.topics)
      ? result.topics.filter((topic: any) => topic && typeof topic.title === "string" && topic.title.trim())
      : [];

    if (extracted.length === 0) {
      throw new GenerationError(
        tt(
          "AI 没有从这些资料中识别到可用考点，请补充更完整的考纲、讲义或真题后重试。",
          "AI found no usable topics in these materials. Add a fuller syllabus, notes, or past paper and try again."
        ),
        "SYLLABUS_EMPTY"
      );
    }

    return extracted;
  };

  const requestPlan = async (activeTopics: SyllabusTopic[]): Promise<ExamStudyPlan> => {
    const preferences: UserStudyPreferences = {
      examName: examName.trim(),
      subject: subject.trim() || tt("综合学科", "General"),
      examDate,
      examTime: examTime || "09:00",
      startDate,
      targetScoreOrGrade: targetScore.trim(),
      dailySchedules: effectiveSchedules,
      studyPace: defaultStudyPace,
      sessionLengthMinutes: 45,
      includePracticeExams: false,
      includeBufferDays: false,
      bufferDaysCount: 0,
      weakTopicsFocus: activeTopics.filter((topic) => topic.difficulty === "hard").map((topic) => topic.title),
      userNeedFocusArea: "comprehensive",
      customPromptRequirement: requirements.trim(),
      additionalNotes: "",
    };

    const { result } = await runGeneration<{ phases?: any[]; tasks?: any[]; totalPlannedHours?: number }>(
      "plan",
      {
        topics: activeTopics,
        preferences,
        materials: prepareMaterialsForAI(courseDocuments),
      },
      { language, onStatus: setGenStatus }
    );

    const tasks = Array.isArray(result?.tasks) ? result.tasks : [];
    if (tasks.length === 0) {
      throw new GenerationError(
        tt(
          "AI 没有返回可用的每日任务，请检查资料内容或调整要求后重试。",
          "AI returned no usable daily tasks. Check your materials or requirements and try again."
        ),
        "PLAN_EMPTY"
      );
    }

    const now = new Date().toISOString();
    return {
      id: `plan-${Date.now()}`,
      examName: examName.trim(),
      subject: preferences.subject,
      examDate,
      examTime: examTime || undefined,
      startDate,
      totalPlannedHours:
        Number(result?.totalPlannedHours) ||
        Math.round(tasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60),
      createdAt: now,
      updatedAt: now,
      preferences,
      topics: activeTopics,
      materials: courseDocuments,
      phases: Array.isArray(result?.phases) ? result.phases : [],
      tasks,
      materialsSummary: tt(
        `${courseDocuments.length} 份资料 · AI 识别 ${activeTopics.length} 个考点`,
        `${courseDocuments.length} materials · ${activeTopics.length} topics extracted by AI`
      ),
    };
  };

  const handleGenerate = async () => {
    if (workingRef.current || isParsingFiles) return;

    if (!examName.trim() || !startDate || !examDate || daysBetween(startDate, examDate) < 0 || !hoursReady) {
      setError({ message: tt("请先完善考试信息。", "Complete the exam details first.") });
      setStep(1);
      return;
    }
    if (courseDocuments.length === 0) {
      setError({
        message: tt(
          "请至少上传一份考纲、讲义、真题或笔记。",
          "Upload at least one syllabus, slide deck, past paper, or notes file."
        ),
      });
      setStep(2);
      return;
    }

    setError(null);
    setGenStatus("");
    workingRef.current = true;
    setIsWorking(true);

    try {
      let activeTopics = topics;
      if (activeTopics.length === 0) {
        setWorkStage("extracting");
        activeTopics = await requestTopics();
        setTopics(activeTopics);
      }
      setWorkStage("planning");
      const newPlan = await requestPlan(activeTopics);
      onPlanCreated(newPlan, null);
    } catch (err: any) {
      if (err instanceof GenerationError) {
        setError({ message: err.message, code: err.code });
      } else {
        console.error("Unexpected plan generation error:", err);
        setError({
          message: tt("生成过程中出现异常，请稍后重试。", "Something went wrong while generating the plan. Please try again."),
        });
      }
    } finally {
      workingRef.current = false;
      setIsWorking(false);
    }
  };

  const materialLimitReached = courseDocuments.length >= MAX_AI_MATERIALS;

  const inputClass =
    "w-full rounded-lg border border-[#e5e2dc] bg-white px-3 py-2.5 text-[13px] text-[#1c1b1a] outline-none transition-colors focus:border-[#cfc9c0] placeholder:text-[#a39e97]";
  const labelClass =
    "mb-1.5 block text-[11px] font-medium text-[#6b6660]";
  const sectionHeadCls =
    "flex items-center justify-between gap-3 border-b border-[#f0ede8] px-4 py-3 sm:px-5";
  const iconBtnCls =
    "rounded-lg border border-[#e5e2dc] bg-white p-1.5 text-[#6b6660] transition-colors hover:border-[#cfc9c0] hover:text-[#1c1b1a] cursor-pointer";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 font-sans text-[#1c1b1a] space-y-5">
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={isWorking}
          className="ui-btn ui-btn-ghost flex items-center gap-1.5 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{tt("返回现有计划", "Back to plans")}</span>
        </button>
        <span className="text-[12px] text-[#a39e97] tabular-nums">
          {tt(`本地已有 ${existingPlans.length} 门科目`, `${existingPlans.length} subjects saved`)}
        </span>
      </div>

      <header className="space-y-1">
        <h1 className="ui-page-title">
          {tt("从资料生成学习计划", "Build a plan from your materials")}
        </h1>
        <p className="text-[13px] text-[#8a8580]">
          {tt("上传考纲、讲义或笔记，AI 自动识别考点并编排每日复习。", "Upload a syllabus, slides, or notes — AI extracts topics and schedules your daily review.")}
        </p>
      </header>

      <ol className="flex items-center gap-2">
        {steps.map((s, index) => {
          const isCurrent = s.n === step;
          const isDone = s.n < step;
          const Icon = s.icon;
          return (
            <React.Fragment key={s.n}>
              {index > 0 && <span className="h-px w-4 shrink-0 bg-[#e7e4de] sm:w-6" aria-hidden />}
              <li className="min-w-0 flex-1">
                <button
                  onClick={() => goToStep(s.n)}
                  disabled={isWorking || s.n > step}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-[12px] transition-colors ${
                    isCurrent
                      ? "border-[#1c1b1a] bg-[#1c1b1a] text-white font-medium"
                      : isDone
                        ? "border-[#e7e4de] bg-white text-[#1c1b1a] font-medium hover:border-[#cfc9c0] cursor-pointer"
                        : "border-transparent bg-[#f1efe9] text-[#a39e97] cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium tabular-nums ${
                      isCurrent
                        ? "bg-white text-[#1c1b1a]"
                        : isDone
                          ? "bg-[#3F6B4F] text-white"
                          : "bg-[#e7e4de] text-[#a39e97]"
                    }`}
                  >
                    {isDone ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                  <Icon className="hidden h-3.5 w-3.5 sm:block" />
                  <span className="hidden truncate sm:inline">{s.label}</span>
                  <span className="sm:hidden tabular-nums">{s.n}</span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
      </ol>

      {aiReady === false && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#f0e2c0] bg-[#FFF6DD] px-4 py-3 text-[#8A5A00]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-[13px]">
            <p className="font-medium">{tt("AI 服务尚未配置，暂时无法自动生成", "AI is not configured on this site yet")}</p>
            <p className="mt-0.5 leading-relaxed text-[#8A5A00]/80">
              {tt(
                "请在站点设置中填写 DeepSeek API Key 后刷新重试。你的资料仍保存在本地。",
                "Add a DeepSeek API key in the site settings, then refresh. Your materials stay local."
              )}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[#f5d6d0] bg-[#FDF0EE] px-4 py-3 text-[#B42318]">
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 text-[13px]">
              <p className="font-medium">
                {error.code === "AI_NOT_CONFIGURED"
                  ? tt("AI 尚未配置", "AI is not configured")
                  : tt("生成未完成", "Generation failed")}
              </p>
              <p className="mt-0.5 leading-relaxed">{error.message}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 rounded-lg p-1 transition-colors hover:bg-[#B42318]/10 cursor-pointer"
            aria-label={tt("关闭提示", "Dismiss error")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* STEP 1 — Exam details */}
      {step === 1 && (
        <section className="ui-card overflow-hidden">
          <div className={sectionHeadCls}>
            <h2 className="ui-section-title flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#8a8580]" />
              <span>{tt("考试信息", "Exam details")}</span>
            </h2>
            <span className="text-[11px] font-medium text-[#a39e97]">* {tt("必填", "Required")}</span>
          </div>

          <fieldset disabled={isWorking} className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="sm:col-span-2">
              <span className={`${labelClass} flex items-center gap-1`}>
                {tt("考试 / 课程名称", "Exam or course name")} <span className="text-[#B42318]">*</span>
              </span>
              <input
                type="text"
                value={examName}
                onChange={(event) => {
                  setExamName(event.target.value);
                  clearTransientError();
                }}
                placeholder={tt("例如：数据结构期末考试 / 考研数学一", "e.g. Data Structures Final / Calculus II")}
                maxLength={200}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>{tt("开始复习日期", "Start date")}</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  clearTransientError();
                }}
                className={inputClass}
              />
            </label>

            <label>
              <span className={`${labelClass} flex items-center gap-1`}>
                {tt("考试日期", "Exam date")} <span className="text-[#B42318]">*</span>
              </span>
              <input
                type="date"
                value={examDate}
                min={startDate}
                onChange={(event) => {
                  setExamDate(event.target.value);
                  clearTransientError();
                }}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>{tt("每天可学习时长", "Study time per day")}</span>
              <div className="flex overflow-hidden rounded-lg border border-[#e5e2dc] bg-white focus-within:border-[#cfc9c0]">
                <input
                  type="number"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={dailyHoursInput}
                  onChange={(event) => {
                    setDailyHoursInput(event.target.value);
                    clearTransientError();
                  }}
                  className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#1c1b1a] tabular-nums outline-none"
                />
                <span className="flex items-center border-l border-[#f0ede8] bg-[#f1efe9] px-3 text-[11px] font-medium text-[#6b6660]">
                  {tt("小时 / 天", "h / day")}
                </span>
              </div>
            </label>

            <div className="overflow-hidden rounded-lg border border-[#e5e2dc] bg-[#faf9f6] sm:col-span-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((prev) => !prev)}
                aria-expanded={showAdvanced}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-[12px] font-medium text-[#1c1b1a] transition-colors hover:bg-white cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-[#8a8580]" />
                  {tt("高级设置", "Advanced settings")}
                </span>
                <ChevronDown className={`h-4 w-4 text-[#8a8580] transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
              {showAdvanced && (
                <div className="border-t border-[#f0ede8] bg-white p-3 sm:p-4">
                  <RulerTimePicker
                    language={language}
                    dailySchedules={dailySchedules}
                    onUpdateDayHours={handleUpdateDayHours}
                    onToggleDayEnabled={handleToggleDayEnabled}
                    onApplyPreset={handleApplyWeeklyPreset}
                    daysDiff={daysDiff ?? 0}
                  />
                </div>
              )}
            </div>

            <label>
              <span className={labelClass}>{tt("考试时间（可选）", "Exam time (optional)")}</span>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a39e97]" />
                <input
                  type="time"
                  value={examTime}
                  onChange={(event) => setExamTime(event.target.value)}
                  className="w-full rounded-lg border border-[#e5e2dc] bg-white py-2.5 pl-9 pr-3 text-[13px] text-[#1c1b1a] outline-none transition-colors focus:border-[#cfc9c0]"
                />
              </div>
            </label>

            <label>
              <span className={labelClass}>{tt("学科 / 专业（可选）", "Subject (optional)")}</span>
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder={tt("例如：计算机科学", "e.g. Computer Science")}
                maxLength={200}
                className={inputClass}
              />
            </label>

            <label>
              <span className={labelClass}>{tt("目标成绩（可选）", "Target score (optional)")}</span>
              <input
                type="text"
                value={targetScore}
                onChange={(event) => setTargetScore(event.target.value)}
                placeholder={tt("例如：90+ / A", "e.g. 90+ / A")}
                maxLength={200}
                className={inputClass}
              />
            </label>
          </fieldset>

          {daysDiff !== null && daysDiff >= 0 && hoursReady && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f0ede8] bg-[#faf9f6] px-4 py-2.5 text-[12px] text-[#6b6660] sm:px-5">
              <span className="tabular-nums">
                {tt("备考周期", "Span")} <strong className="font-semibold text-[#1c1b1a]">{daysDiff}</strong> {tt("天", "days")}
              </span>
              <span className="text-[#d6d2cb]">·</span>
              {advancedTouched ? (
                <>
                  <span className="tabular-nums">
                    {tt("周总学时", "Weekly")} <strong className="font-semibold text-[#1c1b1a]">{weeklyTotalHours}</strong>h
                  </span>
                  <span className="text-[#d6d2cb]">·</span>
                  <span className="tabular-nums">
                    {tt("全程预计", "Total")} <strong className="font-semibold text-[#1c1b1a]">{advancedTotalHours}</strong>h
                  </span>
                </>
              ) : (
                <>
                  <span className="tabular-nums">
                    {tt("每天", "Per day")} <strong className="font-semibold text-[#1c1b1a]">{parsedDailyHours}</strong>h
                  </span>
                  <span className="text-[#d6d2cb]">·</span>
                  <span className="tabular-nums">
                    {tt("预计总复习量", "Total")} <strong className="font-semibold text-[#1c1b1a]">{totalPlannedHours}</strong>h
                  </span>
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* STEP 2 — Materials */}
      {step === 2 && (
        <section className="ui-card overflow-hidden">
          <div className={sectionHeadCls}>
            <h2 className="ui-section-title flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#8a8580]" />
              <span>{tt("上传资料", "Materials")}</span>
            </h2>
            <span className="text-[12px] text-[#a39e97] tabular-nums">
              {courseDocuments.length} / {MAX_AI_MATERIALS}
            </span>
          </div>

          <fieldset disabled={isWorking} className="min-w-0 space-y-3 p-4 sm:p-5">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                if (!isParsingFiles && !isWorking) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
                isDragging ? "border-[#1c1b1a] bg-[#f1efe9]" : "border-[#ddd8d0] bg-[#faf9f6] hover:border-[#cfc9c0] hover:bg-[#f1efe9]"
              } ${materialLimitReached || isParsingFiles || isWorking ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json,.rtf"
                onChange={(event) => {
                  void handleFileUpload(event.target.files);
                  event.target.value = "";
                }}
                className="hidden"
                disabled={materialLimitReached || isParsingFiles || isWorking}
              />
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#1c1b1a] shadow-sm">
                {isParsingFiles ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              </div>
              <p className="text-[14px] font-medium text-[#1c1b1a]">
                {isParsingFiles
                  ? parsingStatus || tt("正在读取资料...", "Reading materials...")
                  : tt("拖拽资料到这里，或点击选择文件", "Drop materials here, or click to browse")}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-[#8a8580]">
                {tt(
                  "PDF、DOCX、PPTX、TXT、MD、CSV · 单个文件 ≤ 10 MB",
                  "PDF, DOCX, PPTX, TXT, MD, CSV · max 10 MB each"
                )}
              </p>
            </label>

            {courseDocuments.length > 0 && (
              <ul className="divide-y divide-[#f0ede8] overflow-hidden rounded-xl border border-[#eae7e1] bg-white">
                {courseDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1efe9] text-[#6b6660]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#1c1b1a]">{doc.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#8a8580] tabular-nums">
                        {typeLabels[doc.type]} ·{" "}
                        {Math.max(1, Math.round((doc.sizeBytes || doc.content.length) / 1024))} KB ·{" "}
                        {doc.content.length.toLocaleString()} {tt("字", "chars")}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className={iconBtnCls}
                      title={tt("预览内容", "Preview content")}
                      aria-label={tt("预览内容", "Preview content")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className={iconBtnCls}
                      title={tt("删除资料", "Delete material")}
                      aria-label={tt("删除资料", "Delete material")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowPasteForm((prev) => !prev)}
                disabled={materialLimitReached || isWorking}
                className="ui-btn ui-btn-ghost flex shrink-0 items-center gap-1 text-[12px] disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{tt("粘贴文字", "Paste text")}</span>
              </button>
            </div>

            {showPasteForm && (
              <div className="space-y-2 rounded-xl border border-[#eae7e1] bg-[#faf9f6] p-3">
                <input
                  type="text"
                  value={pasteDocTitle}
                  onChange={(event) => setPasteDocTitle(event.target.value)}
                  placeholder={tt("资料名称（可选）", "Title (optional)")}
                  maxLength={200}
                  className={inputClass}
                />
                <textarea
                  rows={5}
                  value={pasteDocContent}
                  onChange={(event) => setPasteDocContent(event.target.value)}
                  placeholder={tt("粘贴考纲章节、课堂笔记或典型题目...", "Paste syllabus sections, notes, or sample problems...")}
                  className="w-full resize-y rounded-lg border border-[#e5e2dc] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1c1b1a] outline-none transition-colors focus:border-[#cfc9c0] placeholder:text-[#a39e97]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowPasteForm(false);
                      setPasteDocTitle("");
                      setPasteDocContent("");
                    }}
                    className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
                  >
                    {tt("取消", "Cancel")}
                  </button>
                  <button
                    onClick={handleAddPastedDocument}
                    disabled={!pasteDocContent.trim() || isWorking}
                    className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px] disabled:opacity-40"
                  >
                    {tt("加入资料", "Add material")}
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        </section>
      )}

      {/* STEP 3 — Generate */}
      {step === 3 && (
        <section className="ui-card overflow-hidden">
          <div className={sectionHeadCls}>
            <h2 className="ui-section-title flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8a8580]" />
              <span>{tt("生成计划", "Generate")}</span>
            </h2>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-[#eae7e1] bg-[#faf9f6] p-4 text-[13px] sm:grid-cols-3">
              <div className="min-w-0">
                <div className="text-[11px] text-[#8a8580]">{tt("考试", "Exam")}</div>
                <div className="mt-0.5 truncate font-medium text-[#1c1b1a]">{examName || "—"}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#8a8580]">{tt("周期", "Span")}</div>
                <div className="mt-0.5 font-medium text-[#1c1b1a] tabular-nums">
                  {daysDiff !== null && daysDiff >= 0 ? `${daysDiff} ${tt("天", "days")} · ${parsedDailyHours}h/${tt("天", "day")}` : "—"}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#8a8580]">{tt("资料", "Materials")}</div>
                <div className="mt-0.5 font-medium text-[#1c1b1a] tabular-nums">
                  {courseDocuments.length} {tt("份", "files")}
                </div>
              </div>
            </div>

            <label className="block">
              <span className={labelClass}>{tt("补充要求（可选）", "Extra requirements (optional)")}</span>
              <textarea
                rows={3}
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                disabled={isWorking}
                maxLength={2000}
                placeholder={tt(
                  "例如：重点复习第三、四章；周末安排真题模拟；考前留两天总复习...",
                  "e.g. Focus on chapters 3–4; reserve weekends for mock papers; keep the last two days for review..."
                )}
                className="w-full resize-y rounded-lg border border-[#e5e2dc] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1c1b1a] outline-none transition-colors focus:border-[#cfc9c0] placeholder:text-[#a39e97]"
              />
            </label>

            {topics.length > 0 && !isWorking && (
              <div className="overflow-hidden rounded-xl border border-[#eae7e1]">
                <button
                  onClick={() => setShowTopics((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 bg-[#EEF4EF] px-3 py-2.5 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-[13px] font-medium text-[#3F6B4F]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {tt(
                      `AI 已识别 ${topics.length} 个考点，约 ${topicsHours} 小时`,
                      `AI found ${topics.length} topics (~${topicsHours}h)`
                    )}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#3F6B4F] transition-transform ${showTopics ? "rotate-180" : ""}`} />
                </button>
                {showTopics && (
                  <div className="divide-y divide-[#f0ede8] bg-white">
                    {topics.map((topic, index) => (
                      <div key={topic.id || index} className="flex items-start justify-between gap-3 px-3 py-2">
                        <span className="text-[13px] leading-relaxed text-[#1c1b1a]">
                          <span className="text-[#a39e97] tabular-nums">{index + 1}.</span> {topic.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-[#8a8580] tabular-nums">
                          {topic.weightPercentage || 0}% · ~{topic.estimatedHours || 0}h
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isWorking && (
              <div className="space-y-2 rounded-xl border border-[#eae7e1] bg-[#faf9f6] px-4 py-3 text-[13px]">
                <div className={`flex items-center gap-2 ${workStage === "planning" ? "text-[#8a8580]" : "font-medium text-[#1c1b1a]"}`}>
                  {workStage === "planning" ? (
                    <CheckCircle2 className="h-4 w-4 text-[#3F6B4F]" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-[#1c1b1a]" />
                  )}
                  <span>{tt("读取资料并提取考点", "Reading materials & extracting topics")}</span>
                </div>
                <div className={`flex items-center gap-2 ${workStage === "planning" ? "font-medium text-[#1c1b1a]" : "text-[#a39e97]"}`}>
                  {workStage === "planning" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[#1c1b1a]" />
                  ) : (
                    <span className="inline-block h-4 w-4 rounded-full border border-[#ddd8d0]" />
                  )}
                  <span>{tt("按日历编排每日任务", "Scheduling daily tasks")}</span>
                </div>
                {genStatus && (
                  <p className="border-t border-[#eeeae3] pt-2 text-[12px] leading-relaxed text-[#8a8580] tabular-nums">
                    {genStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 border-t border-[#f0ede8] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => (step === 1 ? onCancel() : goToStep((step - 1) as 1 | 2 | 3))}
          disabled={isWorking}
          className="ui-btn ui-btn-ghost flex items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] disabled:opacity-40 sm:w-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{step === 1 ? tt("返回现有计划", "Back to plans") : tt("上一步", "Back")}</span>
        </button>

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={step === 1 ? !detailsReady : !materialsReady}
            className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 px-6 py-3 text-[13px] font-medium disabled:opacity-40 sm:w-auto"
          >
            <span>
              {step === 1 ? tt("下一步：上传资料", "Next: Materials") : tt("下一步：生成计划", "Next: Generate")}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={isWorking || isParsingFiles}
            className="ui-btn ui-btn-primary flex w-full items-center justify-center gap-2 px-6 py-3 text-[13px] font-medium disabled:opacity-40 sm:w-auto"
          >
            {isWorking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  {workStage === "extracting"
                    ? tt("正在提取考点...", "Extracting topics...")
                    : tt("正在生成计划...", "Building plan...")}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>
                  {topics.length > 0 ? tt("重新生成学习计划", "Regenerate plan") : tt("生成学习计划", "Generate study plan")}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1b1a]/40 backdrop-blur-sm p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#eae7e1] bg-white shadow-[0_12px_40px_rgba(28,27,26,0.18)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#f0ede8] bg-[#faf9f6] p-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1efe9] text-[#6b6660]">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="truncate text-[13px] font-medium text-[#1c1b1a]">{previewDoc.name}</span>
                <span className="ui-chip shrink-0">
                  {typeLabels[previewDoc.type]}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="shrink-0 rounded-lg p-1.5 text-[#6b6660] transition-colors hover:bg-[#f1efe9] hover:text-[#1c1b1a] cursor-pointer"
                aria-label={tt("关闭预览", "Close preview")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto whitespace-pre-wrap bg-white p-4 text-[13px] leading-relaxed text-[#1c1b1a]">
              {previewDoc.content || tt("文档内容为空", "Empty document content")}
            </div>

            <div className="flex items-center justify-between border-t border-[#f0ede8] bg-[#faf9f6] p-3 text-[12px] text-[#8a8580]">
              <span className="tabular-nums">
                {previewDoc.content.length.toLocaleString()} {tt("字符", "chars")}
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
              >
                {tt("关闭", "Close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}