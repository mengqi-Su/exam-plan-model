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
import { MAX_AI_MATERIALS, prepareMaterialsForAI, readApiError } from "../lib/aiClient";
import { daysBetween, toLocalDateString } from "../lib/date";

interface AddExamSubjectWizardProps {
  onPlanCreated: (newPlan: ExamStudyPlan, notice?: string | null) => void;
  onCancel: () => void;
  existingPlans: ExamStudyPlan[];
  defaultStudyPace: UserStudyPreferences["studyPace"];
}

class GenerationError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "GenerationError";
    this.code = code;
  }
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
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.aiConfigured === "boolean") {
          setAiReady(data.aiConfigured);
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

  // Progressive enabling: each step unlocks the next only when its own inputs are ready.
  const step1Ready = courseDocuments.length > 0 && !isParsingFiles;
  const step2Ready =
    !!examName.trim() &&
    !!startDate &&
    !!examDate &&
    daysBetween(startDate, examDate) >= 0 &&
    dailyHoursValid;
  const step2Hint = !examName.trim()
    ? tt("请先填写考试 / 课程名称", "Enter the exam or course name first")
    : !examDate
      ? tt("请选择考试日期", "Pick the exam date")
      : daysBetween(startDate, examDate) < 0
        ? tt("考试日期不能早于开始日期", "Exam date is before the start date")
        : !dailyHoursValid
          ? tt("每天时长需在 0.5–12 小时之间", "Daily study time must be 0.5–12 hours")
          : "";

  const steps = [
    { n: 1 as const, label: tt("上传资料", "MATERIALS"), icon: Upload },
    { n: 2 as const, label: tt("考试信息", "EXAM DETAILS"), icon: CalendarDays },
    { n: 3 as const, label: tt("生成计划", "GENERATE"), icon: Sparkles },
  ];

  const goToStep = (target: 1 | 2 | 3) => {
    if (isWorking || target > step) return;
    clearTransientError();
    setStep(target);
  };

  const handleNext = () => {
    clearTransientError();
    if (step === 1 && step1Ready) setStep(2);
    else if (step === 2 && step2Ready) setStep(3);
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

  const invalidateAiResult = () => {
    setTopics([]);
    setShowTopics(false);
    setError(null);
  };

  // Validation and upload errors become stale as soon as the user edits the form.
  // Service errors keep their API code and stay visible until dismissed.
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
    let res: Response;
    try {
      res = await fetch("/api/extract-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: prepareMaterialsForAI(courseDocuments),
          examName: examName.trim(),
          subject: subject.trim(),
          language,
        }),
      });
    } catch {
      throw new GenerationError(
        tt("无法连接服务，请检查网络后重试。", "Could not reach the server. Check your connection and try again.")
      );
    }

    if (!res.ok) {
      const apiError = await readApiError(res, language);
      throw new GenerationError(apiError.message, apiError.code);
    }

    const data = await res.json().catch(() => null);
    const extracted: SyllabusTopic[] = Array.isArray(data?.topics)
      ? data.topics.filter((topic: any) => topic && typeof topic.title === "string" && topic.title.trim())
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
    const hours = Number(dailyHoursInput);
    const preferences: UserStudyPreferences = {
      examName: examName.trim(),
      subject: subject.trim() || tt("综合学科", "General"),
      examDate,
      examTime: examTime || "09:00",
      startDate,
      targetScoreOrGrade: targetScore.trim(),
      dailySchedules: buildDailySchedules(hours),
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

    let res: Response;
    try {
      res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topics: activeTopics,
          preferences,
          materials: prepareMaterialsForAI(courseDocuments),
          materialsSummary: courseDocuments.map((doc) => doc.name).join("、"),
          language,
        }),
      });
    } catch {
      throw new GenerationError(
        tt("无法连接服务，请检查网络后重试。", "Could not reach the server. Check your connection and try again.")
      );
    }

    if (!res.ok) {
      const apiError = await readApiError(res, language);
      throw new GenerationError(apiError.message, apiError.code);
    }

    const data = await res.json().catch(() => null);
    const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
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
        Number(data?.totalPlannedHours) ||
        Math.round(tasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60),
      createdAt: now,
      updatedAt: now,
      preferences,
      topics: activeTopics,
      materials: courseDocuments,
      phases: Array.isArray(data?.phases) ? data.phases : [],
      tasks,
      materialsSummary: tt(
        `${courseDocuments.length} 份资料 · AI 识别 ${activeTopics.length} 个考点`,
        `${courseDocuments.length} materials · ${activeTopics.length} topics extracted by AI`
      ),
    };
  };

  const handleGenerate = async () => {
    if (workingRef.current || isParsingFiles) return;

    if (!examName.trim()) {
      setError({ message: tt("请填写考试或课程名称。", "Enter the exam or course name.") });
      setStep(2);
      return;
    }
    if (!startDate) {
      setError({ message: tt("请选择开始复习日期。", "Choose the start date.") });
      setStep(2);
      return;
    }
    if (!examDate) {
      setError({ message: tt("请选择考试日期。", "Choose the exam date.") });
      setStep(2);
      return;
    }
    if (daysBetween(startDate, examDate) < 0) {
      setError({
        message: tt("考试日期不能早于开始复习日期。", "The exam date cannot be earlier than the start date."),
      });
      setStep(2);
      return;
    }
    if (!dailyHoursValid) {
      setError({
        message: tt("每天可学习时长需在 0.5–12 小时之间。", "Daily study time must be between 0.5 and 12 hours."),
      });
      setStep(2);
      return;
    }
    if (courseDocuments.length === 0) {
      setError({
        message: tt(
          "请至少上传一份考纲、讲义、真题或笔记。",
          "Upload at least one syllabus, slide deck, past paper, or notes file."
        ),
      });
      setStep(1);
      return;
    }

    setError(null);
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
    "w-full border border-[#111111] bg-[#fafafa] px-3 py-2.5 font-mono text-xs outline-none focus:bg-white";
  const labelClass =
    "mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-wider text-[#555]";

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 font-sans text-[#111111] space-y-5">
      <div className="flex items-center justify-between border-b border-[#111111] pb-4">
        <button
          onClick={onCancel}
          disabled={isWorking}
          className="flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{tt("返回现有计划", "BACK TO PLANS")}</span>
        </button>
        <span className="font-mono text-[10px] font-bold uppercase text-[#777]">
          {tt(`本地已有 ${existingPlans.length} 门科目`, `${existingPlans.length} SUBJECT(S) SAVED`)}
        </span>
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-[#111111] bg-[#FCD33B] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider">
            AI GENERATED
          </span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#777]">
            {tt("没有预设模板 · 只依据你的资料", "NO TEMPLATES · YOUR MATERIALS ONLY")}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {tt("从资料生成学习计划", "Build a plan from your materials")}
        </h1>
        <p className="max-w-2xl text-xs leading-relaxed text-[#555]">
          {tt(
            "三步完成：上传资料 → 填写考试信息 → AI 生成每日任务。没有示例考点，也没有内置周计划模板。",
            "Three steps: upload materials → set exam details → AI schedules daily tasks. No sample topics, no built-in weekly template."
          )}
        </p>
      </header>

      {/* Step indicator: one topic per step, completed steps revisitable */}
      <ol className="flex items-stretch border border-[#111111] bg-white font-mono">
        {steps.map((s, index) => {
          const isCurrent = s.n === step;
          const isDone = s.n < step;
          const Icon = s.icon;
          return (
            <li key={s.n} className={`flex-1 ${index > 0 ? "border-l border-[#111111]" : ""}`}>
              <button
                onClick={() => goToStep(s.n)}
                disabled={isWorking || s.n > step}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex w-full items-center justify-center gap-2 px-2 py-3 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  isCurrent
                    ? "bg-[#111111] text-white"
                    : isDone
                      ? "bg-[#FFF4CC] text-[#111111] hover:bg-[#FCD33B] cursor-pointer"
                      : "bg-white text-[#999] cursor-not-allowed"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] ${
                    isCurrent
                      ? "border-white bg-white text-[#111111]"
                      : isDone
                        ? "border-[#111111] bg-[#111111] text-white"
                        : "border-[#bbb] text-[#999]"
                  }`}
                >
                  {isDone ? <Check className="h-3 w-3" /> : s.n}
                </span>
                <Icon className="hidden h-3.5 w-3.5 sm:block" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.n}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {aiReady === false && (
        <div className="flex items-start gap-2.5 border border-[#111111] bg-[#FFF4CC] px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-xs">
            <p className="font-bold">{tt("当前服务未配置 AI，暂时无法自动生成", "AI is not configured on this server")}</p>
            <p className="mt-0.5 leading-relaxed text-[#555]">
              {tt(
                "请在部署环境配置 GEMINI_API_KEY 后刷新页面。生成失败时不会用模板代替。",
                "Set GEMINI_API_KEY in your deployment and refresh. Failures are reported, never replaced with a template."
              )}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 border border-[#111111] bg-[#FDEAE6] px-4 py-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 text-xs">
              <p className="font-bold">
                {error.code === "AI_NOT_CONFIGURED"
                  ? tt("AI 尚未配置", "AI is not configured")
                  : tt("生成未完成", "Generation failed")}
              </p>
              <p className="mt-0.5 leading-relaxed">{error.message}</p>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="shrink-0 border border-[#111111] bg-white p-1 hover:bg-[#111111] hover:text-white cursor-pointer"
            aria-label={tt("关闭提示", "Dismiss error")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* STEP 1 — Materials (the core value, shown first) */}
      {step === 1 && (
        <section className="border border-[#111111] bg-white">
          <div className="flex items-center justify-between border-b border-[#111111] bg-[#fafafa] px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider">
              <Upload className="h-4 w-4" />
              <span>{tt("第 1 步 · 上传备考资料", "STEP 1 · STUDY MATERIALS")}</span>
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#777]">
              {courseDocuments.length} / {MAX_AI_MATERIALS}
            </span>
          </div>

          <fieldset disabled={isWorking} className="min-w-0 space-y-3 p-4 sm:p-5">
            <p className="text-xs leading-relaxed text-[#555]">
              {tt(
                "先放入你的考纲、讲义、真题或笔记。资料越完整，AI 排出的考点与每日任务越准确。",
                "Start with your syllabus, slides, past papers, or notes. More complete materials produce better topics and daily tasks."
              )}
            </p>
            <label
              onDragOver={(event) => {
                event.preventDefault();
                if (!isParsingFiles && !isWorking) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex cursor-pointer flex-col items-center justify-center border border-dashed border-[#111111] px-4 py-8 text-center transition-colors ${
                isDragging ? "bg-[#FCD33B]" : "bg-[#fafafa] hover:bg-[#FFF4CC]"
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
              <div className="mb-2 flex h-12 w-12 items-center justify-center border border-[#111111] bg-[#111111] text-white">
                {isParsingFiles ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              </div>
              <p className="text-sm font-bold">
                {isParsingFiles
                  ? parsingStatus || tt("正在读取资料...", "Reading materials...")
                  : tt("拖拽资料到这里，或点击选择文件", "Drop materials here, or click to browse")}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
                {tt(
                  "考纲 / 讲义 / 真题 / 笔记 · PDF、DOCX、PPTX、TXT、MD、CSV · 单个文件 ≤ 10 MB",
                  "Syllabus / slides / past papers / notes · PDF, DOCX, PPTX, TXT, MD, CSV · max 10 MB each"
                )}
              </p>
            </label>

            {materialLimitReached && (
              <p className="font-mono text-[10px] font-bold text-[#8A5A00]">
                {tt(
                  `已达到 ${MAX_AI_MATERIALS} 份资料上限，删除文件后可继续添加。`,
                  `Material limit of ${MAX_AI_MATERIALS} reached. Delete a file to add more.`
                )}
              </p>
            )}

            {courseDocuments.length > 0 && (
              <ul className="divide-y divide-[#e5e2da] border border-[#111111] bg-white">
                {courseDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-[#111111]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold">{doc.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-[#777]">
                        {typeLabels[doc.type]} ·{" "}
                        {Math.max(1, Math.round((doc.sizeBytes || doc.content.length) / 1024))} KB ·{" "}
                        {doc.content.length.toLocaleString()} {tt("字", "chars")}
                      </p>
                    </div>
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="border border-[#111111] bg-white p-1.5 hover:bg-[#111111] hover:text-white cursor-pointer"
                      title={tt("预览内容", "Preview content")}
                      aria-label={tt("预览内容", "Preview content")}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="border border-[#111111] bg-white p-1.5 hover:bg-[#111111] hover:text-white cursor-pointer"
                      title={tt("删除资料", "Delete material")}
                      aria-label={tt("删除资料", "Delete material")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] leading-relaxed text-[#777]">
                {tt(
                  "没有文件？也可以直接粘贴文字。AI 不会使用资料以外的内容。",
                  "No files? You can paste text instead. AI will not use content outside your materials."
                )}
              </p>
              <button
                onClick={() => setShowPasteForm((prev) => !prev)}
                disabled={materialLimitReached || isWorking}
                className="flex shrink-0 items-center gap-1 border border-[#111111] bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase transition-colors hover:bg-[#111111] hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>{tt("粘贴文字", "PASTE TEXT")}</span>
              </button>
            </div>

            {showPasteForm && (
              <div className="space-y-2 border border-[#111111] bg-[#fafafa] p-3">
                <input
                  type="text"
                  value={pasteDocTitle}
                  onChange={(event) => setPasteDocTitle(event.target.value)}
                  placeholder={tt("资料名称（可选），例如：第三章公式速记", "Title (optional), e.g. Chapter 3 formula sheet")}
                  maxLength={200}
                  className="w-full border border-[#111111] bg-white px-3 py-2 font-mono text-xs outline-none"
                />
                <textarea
                  rows={5}
                  value={pasteDocContent}
                  onChange={(event) => setPasteDocContent(event.target.value)}
                  placeholder={tt(
                    "直接粘贴考纲章节、课堂笔记或典型题目...",
                    "Paste syllabus sections, lecture notes, or sample problems..."
                  )}
                  className="w-full resize-y border border-[#111111] bg-white px-3 py-2 font-mono text-xs leading-relaxed outline-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowPasteForm(false);
                      setPasteDocTitle("");
                      setPasteDocContent("");
                    }}
                    className="border border-[#111111] bg-white px-3 py-1.5 text-[11px] font-bold hover:bg-[#f0eee8] cursor-pointer"
                  >
                    {tt("取消", "Cancel")}
                  </button>
                  <button
                    onClick={handleAddPastedDocument}
                    disabled={!pasteDocContent.trim() || isWorking}
                    className="border border-[#111111] bg-[#111111] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#333333] disabled:opacity-40 cursor-pointer"
                  >
                    {tt("加入资料", "Add material")}
                  </button>
                </div>
              </div>
            )}
          </fieldset>
        </section>
      )}

      {/* STEP 2 — Exam details */}
      {step === 2 && (
        <section className="border border-[#111111] bg-white">
          <div className="flex items-center justify-between border-b border-[#111111] bg-[#fafafa] px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider">
              <CalendarDays className="h-4 w-4" />
              <span>{tt("第 2 步 · 考试信息", "STEP 2 · EXAM DETAILS")}</span>
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#C62828]">* {tt("必填", "REQUIRED")}</span>
          </div>

          <fieldset
            disabled={isWorking}
            className="grid min-w-0 grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5"
          >
            <label className="sm:col-span-2">
              <span className={`${labelClass} flex items-center gap-1`}>
                {tt("考试 / 课程名称", "EXAM OR COURSE NAME")} <span className="text-[#C62828]">*</span>
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
              <span className={labelClass}>{tt("开始复习日期", "START DATE")}</span>
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
                {tt("考试日期", "EXAM DATE")} <span className="text-[#C62828]">*</span>
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
              <span className={labelClass}>{tt("每天可学习时长", "STUDY TIME PER DAY")}</span>
              <div className="flex border border-[#111111] bg-[#fafafa] focus-within:bg-white">
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
                  className="w-full min-w-0 bg-transparent px-3 py-2.5 font-mono text-xs outline-none"
                />
                <span className="flex items-center border-l border-[#111111] bg-[#FCD33B] px-3 font-mono text-[10px] font-bold uppercase">
                  {tt("小时 / 天", "H / DAY")}
                </span>
              </div>
            </label>

            <label>
              <span className={labelClass}>{tt("考试时间（可选）", "EXAM TIME (OPTIONAL)")}</span>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777]" />
                <input
                  type="time"
                  value={examTime}
                  onChange={(event) => setExamTime(event.target.value)}
                  className="w-full border border-[#111111] bg-[#fafafa] py-2.5 pl-9 pr-3 font-mono text-xs outline-none focus:bg-white"
                />
              </div>
            </label>

            {/* Secondary, optional fields grouped below the essentials */}
            <div className="sm:col-span-2 grid grid-cols-1 gap-4 border-t border-dashed border-[#ccc] pt-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>{tt("学科 / 专业（可选）", "SUBJECT (OPTIONAL)")}</span>
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
                <span className={labelClass}>{tt("目标成绩（可选）", "TARGET SCORE (OPTIONAL)")}</span>
                <input
                  type="text"
                  value={targetScore}
                  onChange={(event) => setTargetScore(event.target.value)}
                  placeholder={tt("例如：90+ / A", "e.g. 90+ / A")}
                  maxLength={200}
                  className={inputClass}
                />
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#111111] bg-[#fafafa] px-4 py-2.5 font-mono text-[11px] sm:px-5">
            {daysDiff !== null && daysDiff >= 0 && dailyHoursValid ? (
              <>
                <span>
                  {tt("备考周期", "SPAN")} <strong>{daysDiff}</strong> {tt("天", "days")}
                </span>
                <span className="text-[#bbb]">/</span>
                <span>
                  {tt("每天", "PER DAY")} <strong>{parsedDailyHours}</strong>h
                </span>
                <span className="text-[#bbb]">/</span>
                <span>
                  {tt("预计总复习量", "TOTAL")} <strong>{totalPlannedHours}</strong>h
                </span>
                {daysDiff > 60 && (
                  <span className="text-[#8A5A00]">
                    {tt("单次生成前 60 天，剩余可稍后调整", "First 60 days per generation")}
                  </span>
                )}
              </>
            ) : (
              <span className="text-[#777]">
                {tt("选择考试日期后自动计算备考周期", "Pick an exam date to see your timeframe")}
              </span>
            )}
          </div>
        </section>
      )}

      {/* STEP 3 — Generate */}
      {step === 3 && (
        <section className="border border-[#111111] bg-white">
          <div className="flex items-center justify-between border-b border-[#111111] bg-[#fafafa] px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>{tt("第 3 步 · 生成计划", "STEP 3 · GENERATE")}</span>
            </h2>
            <span className="font-mono text-[10px] font-bold text-[#777]">AI</span>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {/* Confirmation summary so the user sees what will be generated */}
            <div className="grid grid-cols-1 gap-2 border border-[#111111] bg-[#fafafa] p-3 font-mono text-[11px] sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase text-[#777]">{tt("考试", "EXAM")}</div>
                <div className="mt-0.5 truncate font-bold">{examName || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#777]">{tt("周期", "SPAN")}</div>
                <div className="mt-0.5 font-bold">
                  {daysDiff !== null && daysDiff >= 0 ? `${daysDiff} ${tt("天", "days")} · ${parsedDailyHours}h/${tt("天", "day")}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-[#777]">{tt("资料", "MATERIALS")}</div>
                <div className="mt-0.5 font-bold">
                  {courseDocuments.length} {tt("份", "files")}
                </div>
              </div>
            </div>

            <label className="block">
              <span className={labelClass}>{tt("补充要求（可选）", "EXTRA REQUIREMENTS (OPTIONAL)")}</span>
              <textarea
                rows={3}
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
                disabled={isWorking}
                maxLength={2000}
                placeholder={tt(
                  "例如：基础较弱，请把证明题拆细；重点复习第三、四章；周末安排真题模拟；考前留两天总复习...",
                  "e.g. My foundations are weak, break proofs into smaller steps; focus on chapters 3–4; reserve weekends for mock papers; keep the last two days for review..."
                )}
                className="w-full resize-y border border-[#111111] bg-[#fafafa] px-3 py-2.5 text-xs leading-relaxed outline-none focus:bg-white"
              />
            </label>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-[#111111] bg-[#fafafa] px-3 py-2.5 font-mono text-[10px] font-bold uppercase text-[#555]">
              <span>01 {tt("读取资料", "READ")}</span>
              <span className="text-[#bbb]">→</span>
              <span>02 {tt("提取考点", "EXTRACT")}</span>
              <span className="text-[#bbb]">→</span>
              <span>03 {tt("编排每日任务", "SCHEDULE")}</span>
            </div>

            {topics.length > 0 && !isWorking && (
              <div className="border border-[#111111]">
                <button
                  onClick={() => setShowTopics((prev) => !prev)}
                  className="flex w-full items-center justify-between gap-2 bg-[#FFF4CC] px-3 py-2.5 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {tt(
                      `AI 已识别 ${topics.length} 个考点，约 ${topicsHours} 小时`,
                      `AI found ${topics.length} topics (~${topicsHours}h)`
                    )}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition-transform ${showTopics ? "rotate-180" : ""}`}
                  />
                </button>
                {showTopics && (
                  <div className="divide-y divide-[#e5e2da]">
                    {topics.map((topic, index) => (
                      <div key={topic.id || index} className="flex items-start justify-between gap-3 px-3 py-2">
                        <span className="text-xs font-semibold leading-relaxed">
                          {index + 1}. {topic.title}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-[#777]">
                          {topic.weightPercentage || 0}% · ~{topic.estimatedHours || 0}h
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isWorking && (
              <div className="space-y-1.5 border border-[#111111] bg-[#FFF4CC] px-3 py-3 font-mono text-[11px]">
                <div className={`flex items-center gap-2 ${workStage === "planning" ? "opacity-60" : "font-bold"}`}>
                  {workStage === "planning" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>{tt("01 读取资料并提取考点", "01 Reading materials & extracting topics")}</span>
                </div>
                <div className={`flex items-center gap-2 ${workStage === "planning" ? "font-bold" : "opacity-40"}`}>
                  {workStage === "planning" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <span className="inline-block h-3.5 w-3.5 border border-[#111111]" />
                  )}
                  <span>{tt("02 按日历编排每日任务", "02 Scheduling daily tasks")}</span>
                </div>
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-[#777]">
              {tt(
                "生成期间请保持页面打开，通常需要 1–2 分钟。失败会明确提示，不会塞入模板内容。",
                "Keep this page open; generation usually takes 1–2 minutes. Failures are explicit, never padded with template content."
              )}
            </p>
          </div>
        </section>
      )}

      {/* Single primary action per step, with a quiet back affordance */}
      <div className="flex flex-col gap-3 border-t border-[#111111] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => (step === 1 ? onCancel() : goToStep((step - 1) as 1 | 2 | 3))}
          disabled={isWorking}
          className="flex items-center justify-center gap-1.5 border border-[#111111] bg-white px-4 py-2.5 font-mono text-[11px] font-bold uppercase tracking-wider hover:bg-[#f0eee8] disabled:opacity-40 cursor-pointer sm:w-auto"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{step === 1 ? tt("返回现有计划", "BACK TO PLANS") : tt("上一步", "BACK")}</span>
        </button>

        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 ? !step1Ready : !step2Ready}
              className="flex w-full items-center justify-center gap-2 border border-[#111111] bg-[#111111] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#333333] disabled:opacity-40 sm:w-auto cursor-pointer"
            >
              <span>
                {step === 1
                  ? tt("下一步：填写考试信息", "NEXT: EXAM DETAILS")
                  : tt("下一步：生成计划", "NEXT: GENERATE")}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={isWorking || isParsingFiles}
              className="flex w-full items-center justify-center gap-2 border border-[#111111] bg-[#111111] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#333333] disabled:opacity-40 sm:w-auto cursor-pointer"
            >
              {isWorking ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>
                    {workStage === "extracting"
                      ? tt("正在提取考点...", "EXTRACTING TOPICS...")
                      : tt("正在生成计划...", "BUILDING PLAN...")}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {topics.length > 0
                      ? tt("重新生成学习计划", "REGENERATE PLAN")
                      : tt("生成学习计划", "GENERATE STUDY PLAN")}
                  </span>
                </>
              )}
            </button>
          )}
          {step === 1 && !step1Ready && (
            <span className="text-center font-mono text-[10px] text-[#777] sm:text-right">
              {tt("上传至少一份资料后继续", "Add at least one material to continue")}
            </span>
          )}
          {step === 2 && !step2Ready && step2Hint && (
            <span className="text-center font-mono text-[10px] text-[#777] sm:text-right">{step2Hint}</span>
          )}
        </div>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col border border-[#111111] bg-white font-mono">
            <div className="flex items-center justify-between gap-3 border-b border-[#111111] bg-[#fafafa] p-4">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-[#111111]" />
                <span className="truncate text-xs font-bold uppercase">{previewDoc.name}</span>
                <span className="shrink-0 border border-[#111111] bg-white px-2 py-0.5 text-[10px] font-bold">
                  {typeLabels[previewDoc.type]}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="shrink-0 p-1 text-[#111111] hover:bg-[#111111] hover:text-white cursor-pointer"
                aria-label={tt("关闭预览", "Close preview")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto whitespace-pre-wrap bg-white p-4 font-mono text-xs leading-relaxed text-[#111111]">
              {previewDoc.content || tt("文档内容为空", "Empty document content")}
            </div>

            <div className="flex items-center justify-between border-t border-[#111111] bg-[#fafafa] p-3 text-xs text-[#666]">
              <span className="font-bold">
                [{previewDoc.content.length.toLocaleString()} {tt("字符", "CHARS")}]
              </span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="border border-[#111111] bg-[#111111] px-4 py-1.5 text-xs font-bold uppercase text-white hover:bg-[#333333] cursor-pointer"
              >
                [{tt("关闭", "CLOSE")}]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}