import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  History,
  Loader2,
  Plus,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DaySchedulePreference,
  ExamStudyPlan,
  StudyMaterial,
  SyllabusTopic,
  TextbookOutline,
  UserStudyPreferences,
  WizardDraft,
} from "../types";
import { useI18n } from "../lib/i18n";
import { MAX_MATERIAL_CHARS, parseDocumentFile, UPLOAD_ACCEPT } from "../lib/documentParser";
import {
  GenerationError,
  MAX_AI_MATERIALS,
  MAX_LIBRARY_MATERIALS,
  aiSelectionNotice,
  defaultAiSelection,
  prepareMaterialsForAI,
  runGeneration,
} from "../lib/aiClient";
import { daysBetween, toLocalDateString } from "../lib/date";
import {
  DEFAULT_DAILY_HOURS,
  MAX_DAILY_HOURS,
  MIN_DAILY_HOURS,
  applyUniformDailyHours,
  clampDailyHours,
  estimateStudyWindow,
  hasStudyDays,
  uniformHoursOf,
  uniformWeekSchedules,
  weeklyTotalHours,
} from "../lib/dailyHours";
import { mergeTopics, nonTextbookTitles, replaceTextbookTopics } from "../lib/topics";
import { duplicateMaterialsNotice, mergeMaterials } from "../lib/materials";
import { visibleChars } from "../lib/text";
import {
  clearWizardDraft,
  loadWizardDraft,
  saveWizardDraft,
  type WizardDraftInput,
} from "../lib/wizardDraft";
import { RulerTimePicker } from "./RulerTimePicker";
import { TextbookOutlineDialog } from "./TextbookOutlineDialog";
import { ModalShell } from "./ModalShell";
import { NoticeBand } from "./NoticeBand";

interface AddExamSubjectWizardProps {
  onPlanCreated: (newPlan: ExamStudyPlan, notice?: string | null) => void;
  onCancel: () => void;
  existingPlans: ExamStudyPlan[];
  defaultStudyPace: UserStudyPreferences["studyPace"];
  /** "page" keeps the full-page tab layout; "modal" renders the floating one-layer-at-a-time card. */
  variant?: "page" | "modal";
  /**
   * 「先建科目，资料回头再传」的另一半：科目页带着这份已有计划回来补最后一步。
   * 给了它，这台向导就是这门科目的生成器——沿用同一个 id 更新，不会多出一门科目。
   */
  initialPlan?: ExamStudyPlan | null;
}

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
  variant = "page",
  initialPlan = null,
}: AddExamSubjectWizardProps) {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);
  const isModal = variant === "modal";
  // 带着已有科目进来补最后一步：标题、按钮都说「这门科目」，不说「新建」。
  const isRefill = !!initialPlan;

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [startDate, setStartDate] = useState(() => toLocalDateString());
  const [examDate, setExamDate] = useState("");
  const [examTime, setExamTime] = useState("");
  const [targetScore, setTargetScore] = useState("");
  // 每日时间只有一份真相：dailySchedules。
  // 「每天可学习时长」那个框是它的投影——七天一致才显示数字，被高级设置改成混合就空着显示「按天设置」。
  // 以前这里还有个 advancedTouched 开关，在「填的数字」和「一份看不见的默认周模板」之间来回切，
  // 用户一动高级设置，自己填的小时数就被模板顶掉了，于是出现「时间能改但计划不认」。
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(() =>
    uniformWeekSchedules(DEFAULT_DAILY_HOURS, language !== "en")
  );
  // 只在敲字的那几秒存在；一失焦就交还给 dailySchedules 的投影，界面上永远不留一个和真实排程无关的数字。
  const [dailyHoursDraft, setDailyHoursDraft] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [requirements, setRequirements] = useState("");

  const [courseDocuments, setCourseDocuments] = useState<StudyMaterial[]>([]);
  // 资料库能存 100 份，一次生成只吃 20 份：勾哪几份由用户决定，默认勾前 20 份。
  const [aiSelectedIds, setAiSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setAiSelectedIds((prev) => defaultAiSelection(courseDocuments, prev));
  }, [courseDocuments]);
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
  const [error, setError] = useState<{
    message: string;
    code?: string;
    tone?: "error" | "notice";
    headline?: string;
  } | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);
  const [textbookDialogOpen, setTextbookDialogOpen] = useState(false);
  const [textbookLabel, setTextbookLabel] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const workingRef = useRef(false);
  // ModalShell 里那段唯一会滚的内容区：换步骤回顶部、打开后聚焦第一个字段都靠它。
  const bodyRef = useRef<HTMLDivElement>(null);

  // Esc、锁背景滚动、点遮罩关闭都归 ModalShell（全站只做一次），这里只补「打开就落在第一个字段」。
  useEffect(() => {
    if (!isModal) return;
    const focusTimer = window.setTimeout(() => {
      if (textbookDialogOpen || previewDoc) return;
      const field = bodyRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden]), textarea");
      field?.focus();
    }, 60);
    return () => window.clearTimeout(focusTimer);
  }, [isModal, textbookDialogOpen, previewDoc]);

  // 换步骤、或冒出一条新报错时，把内容区拨回顶部。
  // 停在上一屏的滚动位置会让人既看不见提示，也够不着刚变的按钮。
  useEffect(() => {
    if (!isModal) return;
    bodyRef.current?.scrollTo({ top: 0 });
  }, [isModal, step, error]);

  /**
   * 从科目页带着一门已建好的科目回来：第一步的事实和已经传上来的资料先填上，
   * 用户不用重答一遍考试信息；直接从「考点来源」接着走。
   * 只在换科目时执行一次，之后这些字段就是这台向导自己的草稿。
   */
  useEffect(() => {
    if (!initialPlan) return;
    const prefs = initialPlan.preferences;
    setExamName(initialPlan.examName || "");
    setSubject(initialPlan.subject || "");
    setStartDate(initialPlan.startDate || toLocalDateString());
    setExamDate(initialPlan.examDate || "");
    setExamTime(initialPlan.examTime || "");
    setTargetScore(prefs?.targetScoreOrGrade || "");
    setRequirements(prefs?.customPromptRequirement || "");
    const storedSchedules = Array.isArray(prefs?.dailySchedules) ? prefs.dailySchedules : [];
    if (storedSchedules.length === 7 && storedSchedules.every((day) => typeof day?.availableHours === "number")) {
      setDailySchedules(storedSchedules);
    }
    setCourseDocuments(Array.isArray(initialPlan.materials) ? initialPlan.materials : []);
    setTopics(Array.isArray(initialPlan.topics) ? initialPlan.topics : []);
    // 教材名只存在于那句资料摘要里，回忆出来是为了摘要文案不变成「《教材》目录」。
    const summary = initialPlan.materialsSummary || "";
    setTextbookLabel(summary.startsWith("《") && summary.includes("》") ? summary.slice(1, summary.indexOf("》")) : "");
    setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPlan?.id]);

  /**
   * 还没变成科目的那份填写也存进本地库。值得落盘的是解析好的资料正文：
   * 一份 PDF 解析要几十秒，刷新、关掉标签页或浏览器崩了就等于重传一遍——
   * 之前只能靠用户「别刷新」，现在填到哪就存到哪，下次打开向导接回来。
   * 带着已有科目补最后一步用的是那门科目自己的数据，不碰这份新建草稿。
   */
  const [restoredDraft, setRestoredDraft] = useState<{ materials: number; topics: number; dropped: number } | null>(null);
  const draftSnapshotRef = useRef<WizardDraftInput | null>(null);
  const draftReadyRef = useRef(false);
  const draftTimerRef = useRef<number | null>(null);
  const draftSavedKeyRef = useRef("");
  const draftDroppedRef = useRef(false);
  const draftEnabled = !isRefill;

  // 只比「哪些值变了」，不比资料正文本身：正文只会跟着资料列表一起进出，
  // 把上百 KB 的文本拿来算指纹会让每次自动保存都变成一次全量字符串拼接。
  const draftSignature = (draft: WizardDraftInput) =>
    [
      draft.step,
      draft.examName,
      draft.subject,
      draft.startDate,
      draft.examDate,
      draft.examTime,
      draft.targetScore,
      draft.requirements,
      draft.dailySchedules.map((day) => `${day.dayOfWeek}:${day.availableHours}:${day.enabled ? 1 : 0}`).join(","),
      draft.materials.map((material) => material.id).join(","),
      draft.aiSelectedIds.join(","),
      draft.topics.map((topic) => topic.id).join(","),
      draft.textbookLabel,
    ].join("|");

  // 一份空表单不值得占草稿：接回来只会让用户以为上次填过什么
  const draftWorthSaving = (draft: WizardDraftInput) =>
    !!draft.examName.trim() ||
    !!draft.examDate ||
    !!draft.requirements.trim() ||
    draft.materials.length > 0 ||
    draft.topics.length > 0;

  const persistDraft = (draft: WizardDraftInput) => {
    if (!draftEnabled || draftDroppedRef.current) return;
    const key = draftSignature(draft);
    if (key === draftSavedKeyRef.current) return;
    draftSavedKeyRef.current = key;
    if (!draftWorthSaving(draft)) {
      void clearWizardDraft();
      return;
    }
    void saveWizardDraft(draft);
  };

  const stopDraftTimer = () => {
    if (draftTimerRef.current === null) return;
    window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = null;
  };

  /** 交出一门科目，草稿到此为止：别等下次打开又接回一份已经变成科目的填写。 */
  const dropDraft = () => {
    draftDroppedRef.current = true;
    stopDraftTimer();
    setRestoredDraft(null);
    void clearWizardDraft();
  };

  const applyDraft = (draft: WizardDraft) => {
    setExamName(draft.examName);
    setSubject(draft.subject);
    setStartDate(draft.startDate || toLocalDateString());
    setExamDate(draft.examDate);
    setExamTime(draft.examTime);
    setTargetScore(draft.targetScore);
    setRequirements(draft.requirements);
    setDailySchedules(draft.dailySchedules);
    setCourseDocuments(draft.materials);
    setAiSelectedIds(draft.aiSelectedIds);
    setTopics(draft.topics);
    setTextbookLabel(draft.textbookLabel);
    // 回到哪一步看的是「还差什么」，不是草稿里记的那个数字：
    // 停在生成那一步却什么资料都没有，点下去只会撞出一条本来不必出现的报错。
    const detailsOk =
      !!draft.examName.trim() &&
      !!draft.examDate &&
      daysBetween(draft.startDate, draft.examDate) >= 0 &&
      hasStudyDays(draft.dailySchedules);
    const sourceOk = (draft.materials.length > 0 && draft.aiSelectedIds.length > 0) || draft.topics.length > 0;
    setStep(draft.step === 3 && detailsOk && sourceOk ? 3 : draft.step >= 2 && detailsOk ? 2 : 1);
  };

  const handleDiscardDraft = () => {
    stopDraftTimer();
    setRestoredDraft(null);
    setExamName("");
    setSubject("");
    setStartDate(toLocalDateString());
    setExamDate("");
    setExamTime("");
    setTargetScore("");
    setRequirements("");
    setDailySchedules(uniformWeekSchedules(DEFAULT_DAILY_HOURS, language !== "en"));
    setCourseDocuments([]);
    setAiSelectedIds([]);
    setTopics([]);
    setTextbookLabel("");
    setShowTopics(false);
    setStep(1);
    setError(null);
    void clearWizardDraft();
  };

  useEffect(() => {
    if (!draftEnabled) return;
    let cancelled = false;
    void loadWizardDraft().then((draft) => {
      if (cancelled) return;
      if (draft) {
        applyDraft(draft);
        setError(null);
        setRestoredDraft({
          materials: draft.materials.length,
          topics: draft.topics.length,
          dropped: draft.droppedMaterials || 0,
        });
      }
      // 读完了才允许写：否则挂载那一次渲染会用空表单把上一份真草稿盖掉
      draftReadyRef.current = true;
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEnabled]);

  const draftPayload: WizardDraftInput = {
    step,
    examName,
    subject,
    startDate,
    examDate,
    examTime,
    targetScore,
    requirements,
    dailySchedules,
    materials: courseDocuments,
    aiSelectedIds,
    topics,
    textbookLabel,
  };

  useEffect(() => {
    if (!draftEnabled || !draftReadyRef.current) return;
    draftSnapshotRef.current = draftPayload;
    stopDraftTimer();
    draftTimerRef.current = window.setTimeout(() => {
      draftTimerRef.current = null;
      persistDraft(draftPayload);
    }, 600);
    return stopDraftTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftEnabled,
    step,
    examName,
    subject,
    startDate,
    examDate,
    examTime,
    targetScore,
    requirements,
    dailySchedules,
    courseDocuments,
    aiSelectedIds,
    topics,
    textbookLabel,
  ]);

  // 刷新和关标签页不会卸载组件，所以还在防抖里的那次改动要靠 pagehide / 切到后台补写；
  // 正常关闭向导走的是卸载，同一句 flush 再认一次。
  useEffect(() => {
    if (!draftEnabled) return;
    const flush = () => {
      const snapshot = draftSnapshotRef.current;
      if (!snapshot || draftTimerRef.current === null) return;
      stopDraftTimer();
      persistDraft(snapshot);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftEnabled]);

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

  // 能不能往下走只看一件事：周计划里还有没有肯学的那天。数字本身在失焦时会回写成真实值。
  const hoursReady = hasStudyDays(dailySchedules);
  // 七天不再同一个数（多半是高级设置里休息了某天或单独调过某天）时，简单框不假装自己还代表全局。
  const uniformDailyHours = useMemo(() => uniformHoursOf(dailySchedules), [dailySchedules]);
  const dailyHoursDisplay = dailyHoursDraft ?? (uniformDailyHours === null ? "" : String(uniformDailyHours));

  const daysDiff = useMemo(() => {
    if (!examDate) return null;
    return daysBetween(startDate, examDate);
  }, [startDate, examDate]);

  // 全程预计按后端同一口径算：跳过休息日、不含考试当天、窗口最多 PLANNING_WINDOW_DAYS 天。
  const windowEstimate = useMemo(
    () => estimateStudyWindow(dailySchedules, startDate, examDate),
    [dailySchedules, startDate, examDate]
  );

  const topicsHours = useMemo(
    () => Math.round(topics.reduce((sum, topic) => sum + (topic.estimatedHours || 0), 0)),
    [topics]
  );

  // 教材目录回忆的考点不依赖上传的文件，所以资料的增删只该作废「从资料提炼」那部分。
  const textbookTopics = useMemo(() => topics.filter((topic) => topic.source === "textbook"), [topics]);
  const textbookTopicCount = textbookTopics.length;

  const applyTextbookTopics = (nextTopics: SyllabusTopic[], outline: TextbookOutline) => {
    setTopics((prev) => replaceTextbookTopics(prev, nextTopics));
    setTextbookLabel(outline.textbook || "");
    setTextbookDialogOpen(false);
    setError(null);
  };

  const detailsReady =
    !!examName.trim() &&
    !!startDate &&
    !!examDate &&
    daysBetween(startDate, examDate) >= 0 &&
    hoursReady;
  // 考点有两种来路：上传资料提炼，或只填教材名让 AI 回忆目录。任意一条走通都算「有了输入」，
  // 所以只有两者都空时才拦住下一步。资料这条路还要求至少勾选一份——库里存着不等于这次会用。
  const materialsReady =
    ((courseDocuments.length > 0 && aiSelectedIds.length > 0) || topics.length > 0) && !isParsingFiles;

  const steps = [
    { n: 1 as const, label: tt("考试信息", "Exam details"), icon: CalendarDays },
    // 第二步现在有两个并列入口（上传资料 / 教材名整理目录），标签不能再只说「上传」。
    { n: 2 as const, label: tt("考点来源", "Topic source"), icon: Upload },
    { n: 3 as const, label: tt("生成计划", "Generate"), icon: Sparkles },
  ];

  const goToStep = (target: 1 | 2 | 3) => {
    if (isWorking || target > step) return;
    clearTransientError();
    setStep(target);
  };

  const requestClose = () => {
    // 生成中不许退；上面还浮着资料预览或教材目录时，Esc / 点遮罩只该退掉最上面那一层。
    if (isWorking || isParsingFiles || previewDoc || textbookDialogOpen) return;
    onCancel();
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

  // 「每天可学习时长」写的就是 dailySchedules 本身：七天一起改，不再有第二份数字。
  const handleDailyHoursChange = (raw: string) => {
    setDailyHoursDraft(raw);
    clearTransientError();
    const value = Number(raw);
    if (!Number.isFinite(value) || value < MIN_DAILY_HOURS || value > MAX_DAILY_HOURS) return;
    setDailySchedules((prev) => applyUniformDailyHours(prev, value, language !== "en"));
  };

  const handleUpdateDayHours = (dayOfWeek: number, hours: number) => {
    const clamped = clampDailyHours(hours);
    // 高级设置一动手，简单框里正在敲的那半截数字就该作废，重新显示真实值
    setDailyHoursDraft(null);
    setDailySchedules((prev) =>
      prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, availableHours: clamped, enabled: clamped > 0 } : d))
    );
  };

  const handleToggleDayEnabled = (dayOfWeek: number) => {
    setDailyHoursDraft(null);
    setDailySchedules((prev) =>
      prev.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const nextEnabled = !d.enabled;
        return {
          ...d,
          enabled: nextEnabled,
          // 重新启用一个休息日时给个能学的默认值，否则开关一关一开等于没恢复
          availableHours: nextEnabled && d.availableHours <= 0 ? DEFAULT_DAILY_HOURS : d.availableHours,
        };
      })
    );
  };

  const invalidateAiResult = () => {
    // 资料变了只作废资料提炼的考点；用户逐章勾选确认过的教材目录不是这份资料的产物，不该被抹掉。
    setTopics((prev) => prev.filter((topic) => topic.source === "textbook"));
    setShowTopics(false);
    setError(null);
  };

  const clearTransientError = () => {
    setError((prev) => (prev && !prev.code ? null : prev));
  };

  /* 一句话结果的两种说法，全站只在这里分一次：
     fail   = 这件事没做成（系统故障、文件读不出来）——红底，帽子说清是哪一步；
     remark = 这件事做成了，或者你的输入需要调整一下——纸色底，句子自己说完，不扣「生成未完成」。 */
  const fail = (message: string, headline: string, code?: string) =>
    setError({ message, headline, code, tone: "error" });
  const remark = (message: string) => setError({ message, tone: "notice" });

  const handleFileUpload = async (files: FileList | File[] | null) => {
    if (!files || isParsingFiles || isWorking) return;
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    if (courseDocuments.length >= MAX_LIBRARY_MATERIALS) {
      remark(
        tt(
          `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，请先删除部分文件。`,
          `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Remove some files first.`
        )
      );
      return;
    }

    const remainingSlots = MAX_LIBRARY_MATERIALS - courseDocuments.length;
    const fileArray = incoming.slice(0, remainingSlots);
    if (incoming.length > remainingSlots) {
      remark(
        tt(
          `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，本次仅处理前 ${remainingSlots} 份。`,
          `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Only the first ${remainingSlots} files were processed.`
        )
      );
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

    // 解析完才谈得上「内容一样」：按正文指纹去重，换个文件名的同一份资料不会进两遍
    const merged = newDocs.length > 0 ? await mergeMaterials(courseDocuments, newDocs, MAX_LIBRARY_MATERIALS) : null;
    const accepted = merged ? merged.accepted : [];
    const duplicates = merged ? merged.duplicates : 0;

    if (accepted.length > 0) {
      setCourseDocuments((prev) => [...prev, ...accepted]);
      invalidateAiResult();
      if (!examName.trim() && suggestedName) {
        setExamName(suggestedName);
      }
    }

    const notices: string[] = [];
    if (incoming.length > remainingSlots) {
      notices.push(
        tt(
          `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，本次仅处理前 ${remainingSlots} 份。`,
          `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Only the first ${remainingSlots} files were processed.`
        )
      );
    }
    if (duplicates > 0) notices.push(duplicateMaterialsNotice(duplicates, language !== "en"));
    // 「有文件没读出来」才是失败，「跳过了重复的」「只处理了前几份」只是这一批的结果。
    // 混进同一条红消息，用户会去查那个其实没坏的重复文件。
    if (failures.length > 0) {
      const extra =
        failures.length > 3
          ? tt(`（另有 ${failures.length - 3} 个失败）`, ` (+${failures.length - 3} more failed)`)
          : "";
      const detail = failures.slice(0, 3).join("；") + extra;
      fail(
        notices.length > 0 ? `${detail}；${notices.join("；")}` : detail,
        tt("有文件没读出来", "Some files could not be read")
      );
    } else if (notices.length > 0) {
      remark(notices.join("；"));
    } else {
      setError(null);
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

  const handleAddPastedDocument = async () => {
    if (isWorking) return;
    const content = pasteDocContent.trim();
    if (!content) return;
    // 一份资料的正文上限：粘贴这条路没有解析器替我们截断，超了就说清楚，别让它悄悄变短
    // 这里说「字符」（含空白的原始长度），因为上限管的就是这个；界面其他地方说「字」= 不数空白。
    if (content.length > MAX_MATERIAL_CHARS) {
      remark(
        tt(
          `粘贴的内容有 ${content.length.toLocaleString()} 字符，一份资料最多 ${MAX_MATERIAL_CHARS.toLocaleString()} 字符，请拆分后分次加入。`,
          `That paste is ${content.length.toLocaleString()} characters; one material holds up to ${MAX_MATERIAL_CHARS.toLocaleString()}. Split it and add it in parts.`
        )
      );
      return;
    }
    if (courseDocuments.length >= MAX_LIBRARY_MATERIALS) {
      remark(
        tt(
          `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，请先删除部分文件。`,
          `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Remove some files first.`
        )
      );
      return;
    }

    const title =
      pasteDocTitle.trim() || `${tt("粘贴笔记", "Pasted notes")} ${courseDocuments.length + 1}`;

    const pasted: StudyMaterial = {
      id: `mat-paste-${Date.now()}`,
      name: title,
      type: "notes",
      categoryGroup: "study_material",
      content,
      sizeBytes: new Blob([content]).size,
      uploadedAt: new Date().toISOString(),
      difficulty: "medium",
      summaryNotes: content.slice(0, 160) + (content.length > 160 ? "..." : ""),
    };
    // 粘出来的正文和库里已有的一模一样时不重复收：留着输入框里的字，让用户自己决定改哪一处
    const merged = await mergeMaterials(courseDocuments, [pasted], MAX_LIBRARY_MATERIALS);
    if (merged.accepted.length === 0) {
      remark(duplicateMaterialsNotice(merged.duplicates, language !== "en"));
      return;
    }
    setCourseDocuments((prev) => [...prev, ...merged.accepted]);
    invalidateAiResult();
    setPasteDocTitle("");
    setPasteDocContent("");
    setShowPasteForm(false);
  };

  const requestTopics = async (): Promise<SyllabusTopic[]> => {
    const { result } = await runGeneration<{ summary?: string; topics?: SyllabusTopic[] }>(
      "syllabus",
      {
        materials: prepareMaterialsForAI(courseDocuments, aiSelectedIds),
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

  /**
   * 一门科目的偏好只在这里拼一次。「先建科目」存下来的壳和「生成计划」发给 AI 的偏好
   * 必须是同一份，否则用户填的考试日期与时间表会在两条路上长成两个样子。
   */
  const buildPreferences = (activeTopics: SyllabusTopic[]): UserStudyPreferences => ({
    examName: examName.trim(),
    subject: subject.trim() || tt("综合学科", "General"),
    examDate,
    examTime: examTime || "09:00",
    startDate,
    targetScoreOrGrade: targetScore.trim(),
    dailySchedules,
    studyPace: defaultStudyPace,
    sessionLengthMinutes: 45,
    includePracticeExams: false,
    includeBufferDays: false,
    bufferDaysCount: 0,
    weakTopicsFocus: activeTopics.filter((topic) => topic.difficulty === "hard").map((topic) => topic.title),
    userNeedFocusArea: "comprehensive",
    customPromptRequirement: requirements.trim(),
    additionalNotes: "",
  });

  /**
   * 科目身份：从科目页带回来的那门科目沿用原 id 更新，只有新建才发新 id。
   * createdAt 是总览排序的依据，补生成计划不该把它改成「刚刚新建」。
   */
  const planIdentity = () => ({
    id: initialPlan?.id ?? `plan-${Date.now()}`,
    createdAt: initialPlan?.createdAt || new Date().toISOString(),
  });

  const requestPlan = async (activeTopics: SyllabusTopic[]): Promise<ExamStudyPlan> => {
    const preferences = buildPreferences(activeTopics);

    const { result } = await runGeneration<{ phases?: any[]; tasks?: any[]; totalPlannedHours?: number }>(
      "plan",
      {
        topics: activeTopics,
        preferences,
        materials: prepareMaterialsForAI(courseDocuments, aiSelectedIds),
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
    const identity = planIdentity();
    return {
      id: identity.id,
      examName: examName.trim(),
      subject: preferences.subject,
      examDate,
      examTime: examTime || undefined,
      startDate,
      totalPlannedHours:
        Number(result?.totalPlannedHours) ||
        Math.round(tasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60),
      createdAt: identity.createdAt,
      updatedAt: now,
      preferences,
      topics: activeTopics,
      materials: courseDocuments,
      phases: Array.isArray(result?.phases) ? result.phases : [],
      tasks,
      materialsSummary:
        courseDocuments.length > 0
          ? tt(
            `${courseDocuments.length} 份资料 · AI 识别 ${activeTopics.length} 个考点`,
            `${courseDocuments.length} materials · ${activeTopics.length} topics extracted by AI`
          )
          : tt(
            `《${textbookLabel || tt("教材", "textbook")}》目录 · AI 整理 ${activeTopics.length} 个考点`,
            `Outline of "${textbookLabel || "the textbook"}" · ${activeTopics.length} topics recalled by AI`
          ),
    };
  };

  const handleGenerate = async () => {
    if (workingRef.current || isParsingFiles) return;

    if (!examName.trim() || !startDate || !examDate || daysBetween(startDate, examDate) < 0 || !hoursReady) {
      remark(tt("请先完善考试信息。", "Complete the exam details first."));
      setStep(1);
      return;
    }
    if (courseDocuments.length === 0 && topics.length === 0) {
      remark(
        tt(
          "先上传一份考纲、讲义、真题或笔记，或者用「整理教材目录」按教材名拿考点。",
          "Upload a syllabus, slides, past paper, or notes first — or outline a textbook by name to get topics."
        )
      );
      setStep(2);
      return;
    }

    setError(null);
    setGenStatus("");
    workingRef.current = true;
    setIsWorking(true);

    try {
      let activeTopics = topics;
      // 已有资料但还没提炼过（教材目录先走了一步），这次就把资料也读进来；
      // 两条来路的考点按标题合并，排程看到的是完整的考点列表。
      const needsMaterialExtraction =
        courseDocuments.length > 0 && !activeTopics.some((topic) => topic.source !== "textbook");
      if (needsMaterialExtraction) {
        setWorkStage("extracting");
        const extracted = await requestTopics();
        activeTopics = mergeTopics(activeTopics, extracted);
        setTopics(activeTopics);
      }
      setWorkStage("planning");
      const newPlan = await requestPlan(activeTopics);
      dropDraft();
      onPlanCreated(newPlan, null);
    } catch (err: any) {
      if (err instanceof GenerationError) {
        fail(
          err.message,
          err.code === "AI_NOT_CONFIGURED"
            ? tt("AI 尚未配置", "AI is not configured")
            : tt("生成未完成", "Generation failed"),
          err.code
        );
      } else {
        console.error("Unexpected plan generation error:", err);
        fail(
          tt(
            "生成过程中出现异常，请稍后重试。",
            "Something went wrong while generating the plan. Please try again."
          ),
          tt("生成未完成", "Generation failed")
        );
      }
    } finally {
      workingRef.current = false;
      setIsWorking(false);
    }
  };

  /**
   * 「先把科目/考试建下来」：资料一条路都还没走，也允许交出一门科目。
   * 交出来的是同一张 ExamStudyPlan，只是 topics/tasks/phases 空着——
   * 它不是另一种数据，科目页照着 planReadiness 就知道它还差哪一步，接着往下走。
   */
  const handleCreateWithoutMaterials = () => {
    if (workingRef.current || isParsingFiles || !detailsReady) return;
    const now = new Date().toISOString();
    const identity = planIdentity();
    const preferences = buildPreferences([]);
    dropDraft();
    onPlanCreated(
      {
        id: identity.id,
        examName: examName.trim(),
        subject: preferences.subject,
        examDate,
        examTime: examTime || undefined,
        startDate,
        totalPlannedHours: 0,
        createdAt: identity.createdAt,
        updatedAt: now,
        preferences,
        topics: [],
        tasks: [],
        phases: [],
        materials: [],
      },
      tt(
        `「${examName.trim()}」已经建好`,
        `"${examName.trim()}" is saved`
      )
    );
  };

  const materialLimitReached = courseDocuments.length >= MAX_LIBRARY_MATERIALS;
  const aiSelectionFull = aiSelectedIds.length >= MAX_AI_MATERIALS;
  const selectionNotice = aiSelectionNotice(courseDocuments.length, aiSelectedIds.length, language);

  // 勾满 20 份后其余 checkbox 直接禁用：上限在勾选那一刻就说清，不留到生成时才报错。
  const toggleAiSelected = (id: string) => {
    if (isWorking) return;
    setAiSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= MAX_AI_MATERIALS) return prev;
      return [...prev, id];
    });
    invalidateAiResult();
  };

  const inputClass = "ui-field";
  const labelClass = "ui-field-label";
  const sectionHeadCls =
    "flex items-center justify-between gap-3 border-b border-[#f0ede8] px-4 py-3 sm:px-5";
  const iconBtnCls =
    "rounded-lg border border-[#e5e2dc] bg-white p-1.5 text-[#6b6660] transition-colors hover:border-[#cfc9c0] hover:text-[#1c1b1a] cursor-pointer";

  // 悬浮版只出文字，页头骨架由 ModalShell 统一画；页面版自己带页头。
  const modalTitle = isRefill
    ? tt(`${initialPlan?.examName || ""} · 生成学习计划`, `Plan ${initialPlan?.examName || "this subject"}`)
    : tt("从资料生成学习计划", "Build a plan from your materials");

  const modalEyebrow = (
    <>
      <span>{isRefill ? tt("继续这门科目", "Finish this subject") : tt("新建备考科目", "New subject")}</span>
      {!isRefill && (
        <span className="ui-chip tabular-nums">
          {tt(`已存 ${existingPlans.length} 门`, `${existingPlans.length} saved`)}
        </span>
      )}
    </>
  );

  const pageHeader = (
    <>
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
      </header>
    </>
  );

  const wizardStepRail = (
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
                  className={`flex w-full items-center justify-center gap-2 rounded-lg border px-2 py-2 text-[12px] transition-colors sm:py-2.5 ${
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
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            </React.Fragment>
          );
        })}
    </ol>
  );

  const wizardContent = (
    <>
      {restoredDraft && !isWorking && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-[#eae7e1] bg-[#faf9f6] px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <History className="h-3.5 w-3.5 shrink-0 text-[#8a8580]" />
            <span className="text-[13px] font-medium text-[#1c1b1a]">
              {tt("已接回上次未完成的草稿", "Your unfinished draft is back")}
            </span>
            {restoredDraft.materials > 0 && (
              <span className="ui-chip tabular-nums">
                {tt(`${restoredDraft.materials} 份资料`, `${restoredDraft.materials} materials`)}
              </span>
            )}
            {restoredDraft.topics > 0 && (
              <span className="ui-chip tabular-nums">
                {tt(`${restoredDraft.topics} 个考点`, `${restoredDraft.topics} topics`)}
              </span>
            )}
            {restoredDraft.dropped > 0 && (
              <span className="ui-chip tabular-nums">
                {tt(`${restoredDraft.dropped} 份太大没接回来`, `${restoredDraft.dropped} too large to keep`)}
              </span>
            )}
          </div>
          <button
            onClick={handleDiscardDraft}
            disabled={isParsingFiles}
            className="ui-btn ui-btn-ghost shrink-0 px-2.5 py-1 text-[12px] disabled:opacity-40"
          >
            {tt("丢掉草稿", "Discard draft")}
          </button>
        </div>
      )}

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
        <NoticeBand
          tone={error.tone ?? "error"}
          headline={error.headline}
          message={error.message}
          onDismiss={() => setError(null)}
        />
      )}

      {/* STEP 1 — Exam details */}
      {step === 1 && (
        <section className="ui-card overflow-hidden">
          <div className={sectionHeadCls}>
            <h2 className="ui-section-title flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#8a8580]" />
              <span>{tt("考试信息", "Exam details")}</span>
            </h2>
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
                  min={MIN_DAILY_HOURS}
                  max={MAX_DAILY_HOURS}
                  step={0.5}
                  value={dailyHoursDisplay}
                  onChange={(event) => handleDailyHoursChange(event.target.value)}
                  onBlur={() => setDailyHoursDraft(null)}
                  placeholder={tt("按天设置", "Per day")}
                  className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[13px] text-[#1c1b1a] tabular-nums outline-none placeholder:font-normal placeholder:text-[#a39e97]"
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

          {daysDiff !== null && daysDiff >= 0 && hoursReady && windowEstimate && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#f0ede8] bg-[#faf9f6] px-4 py-2.5 text-[12px] text-[#6b6660] sm:px-5">
              <span className="tabular-nums">
                {tt("备考周期", "Span")} <strong className="font-semibold text-[#1c1b1a]">{daysDiff}</strong> {tt("天", "days")}
              </span>
              <span className="text-[#d6d2cb]">·</span>
              <span className="tabular-nums">
                {tt("学习日", "Study days")}{" "}
                <strong className="font-semibold text-[#1c1b1a]">{windowEstimate.studyDays}</strong> {tt("天", "days")}
              </span>
              <span className="text-[#d6d2cb]">·</span>
              <span className="tabular-nums">
                {tt("周总学时", "Weekly")}{" "}
                <strong className="font-semibold text-[#1c1b1a]">{weeklyTotalHours(dailySchedules)}</strong>h
              </span>
              <span className="text-[#d6d2cb]">·</span>
              <span className="tabular-nums">
                {tt("全程预计", "Total")}{" "}
                <strong className="font-semibold text-[#1c1b1a]">{windowEstimate.totalHours}</strong>h
              </span>
            </div>
          )}
        </section>
      )}

      {/* STEP 2 — 考点来源：上传资料，或只填教材名让 AI 整理目录 */}
      {step === 2 && (
        <section className="ui-card overflow-hidden">
          <div className={sectionHeadCls}>
            <h2 className="ui-section-title flex items-center gap-2">
              <Upload className="h-4 w-4 text-[#8a8580]" />
              <span>{tt("考点来源", "Topic source")}</span>
            </h2>
            <span className="text-[12px] text-[#6b6660] tabular-nums">
              {tt("本次生成", "This run")} {aiSelectedIds.length} / {MAX_AI_MATERIALS}
            </span>
          </div>

          <fieldset disabled={isWorking} className="min-w-0 space-y-3 p-4 sm:p-5">
            {selectionNotice && (
              <p className="rounded-xl border border-[#e5e2dc] bg-[#faf9f6] px-3 py-2.5 text-[13px] leading-relaxed text-[#1c1b1a]">
                {selectionNotice}
              </p>
            )}
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
                accept={UPLOAD_ACCEPT}
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
            </label>

            {courseDocuments.length > 0 && (
              <ul className="divide-y divide-[#f0ede8] overflow-hidden rounded-xl border border-[#eae7e1] bg-white">
                {courseDocuments.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2.5 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={aiSelectedIds.includes(doc.id)}
                      disabled={!aiSelectedIds.includes(doc.id) && aiSelectionFull}
                      onChange={() => toggleAiSelected(doc.id)}
                      aria-label={tt(`本次生成使用 ${doc.name}`, `Use ${doc.name} in this run`)}
                      title={
                        !aiSelectedIds.includes(doc.id) && aiSelectionFull
                          ? tt(
                              `一次生成最多用 ${MAX_AI_MATERIALS} 份，先取消勾选其他资料`,
                              `One run uses at most ${MAX_AI_MATERIALS} files. Uncheck another file first.`
                            )
                          : tt("勾选后用于本次生成", "Checked files are used in this run")
                      }
                      className="h-4 w-4 shrink-0 cursor-pointer accent-[#1c1b1a] disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1efe9] text-[#6b6660]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[#1c1b1a]">{doc.name}</p>
                      <p className="mt-0.5 text-[11px] text-[#8a8580] tabular-nums">
                        {typeLabels[doc.type]} ·{" "}
                        {Math.max(1, Math.round((doc.sizeBytes || doc.content.length) / 1024))} KB ·{" "}
                        {visibleChars(doc.content).toLocaleString()} {tt("字", "chars")}
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

            {/* 第二条来路：一份资料都没有时，只填教材名也能拿到考点。放在资料之后，
                因为它不产生资料文件，只产生考点，所以不复用上面的上传口径。 */}
            <div className="h-px bg-[#f0ede8]" aria-hidden="true" />

            <div className="flex flex-col items-start justify-between gap-2 rounded-xl border border-[#eae7e1] bg-[#faf9f6] px-4 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h3 className="ui-subgroup-title">{tt("只填教材名，按目录整理考点", "No files? Name the textbook instead")}</h3>
                {textbookTopicCount > 0 && (
                  <p className="ui-row-meta mt-1 leading-relaxed tabular-nums">
                    {tt(
                      `已按《${textbookLabel || tt("教材", "textbook")}》目录整理 ${textbookTopicCount} 个考点`,
                      `${textbookTopicCount} topics from "${textbookLabel || "the textbook"}"`
                    )}
                  </p>
                )}
              </div>
              <button
                onClick={() => setTextbookDialogOpen(true)}
                disabled={isWorking}
                className="ui-btn ui-btn-ghost shrink-0 px-3 py-1.5 text-[12px] disabled:opacity-40"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>{textbookTopicCount > 0 ? tt("重新整理目录", "Re-outline") : tt("整理教材目录", "Outline a textbook")}</span>
              </button>
            </div>
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
                  {daysDiff !== null && daysDiff >= 0 && windowEstimate
                    ? `${daysDiff} ${tt("天", "days")} · ${windowEstimate.studyDays} ${tt("学习日", "study days")} · ${windowEstimate.totalHours}h`
                    : "—"}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] text-[#8a8580]">{tt("考点来源", "Source")}</div>
                <div className="mt-0.5 truncate font-medium text-[#1c1b1a] tabular-nums">
                  {courseDocuments.length > 0
                    ? `${courseDocuments.length} ${tt("份资料", "files")}`
                    : tt(`《${textbookLabel || tt("教材", "textbook")}》目录`, `outline of "${textbookLabel || "textbook"}"`)}
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
                        <span className="flex min-w-0 items-start gap-2 text-[13px] leading-relaxed text-[#1c1b1a]">
                          <span className="shrink-0 text-[#a39e97] tabular-nums">{index + 1}.</span>
                          <span className="min-w-0">{topic.title}</span>
                          {topic.source === "textbook" && (
                            <span className="ui-chip shrink-0">{tt("教材目录", "Textbook")}</span>
                          )}
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
    </>
  );

  const wizardFooter = (
    <>
      {/* 手机上是两行：「先建科目」占满一行当文字入口，后退和主按钮并排一行、主按钮吃掉剩下的宽度。
          三个按钮竖着摞起来能把 442px 的屏幕吃掉三分之一，内容区就没得滚了——
          所以换行交给 flex-wrap，桌面（sm）再收回一行。 */}
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:justify-end sm:gap-3">
        {/* 资料不是建科目的门槛：这一步可以先跳过，科目照建，之后在科目页接着传、接着生成。
            带已有科目回来时不出现——那门科目已经建好了，这里只做最后一步。 */}
        {step === 2 && !isRefill && (
          <button
            onClick={handleCreateWithoutMaterials}
            disabled={isParsingFiles}
            className="ui-btn ui-btn-ghost order-1 w-full justify-center gap-1.5 px-3 py-1.5 text-[12px] text-[#6b6660] disabled:opacity-40 sm:order-2 sm:w-auto sm:py-2"
          >
            <Check className="h-3.5 w-3.5" />
            <span>{tt("先建科目，资料稍后再传", "Create it now, add materials later")}</span>
          </button>
        )}

        <button
          onClick={() => (step === 1 ? requestClose() : goToStep((step - 1) as 1 | 2 | 3))}
          disabled={isWorking}
          className={`ui-btn ui-btn-ghost order-2 shrink-0 items-center justify-center gap-1.5 px-4 py-2.5 text-[13px] disabled:opacity-40 sm:order-1 sm:mr-auto ${
            // 悬浮版第一步：右上角已经有 ✕，手机上不再为「取消」多占一行高度。
            step === 1 && isModal ? "hidden sm:flex" : "flex"
          }`}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>
            {step === 1
              ? isModal
                ? tt("取消", "Cancel")
                : tt("返回现有计划", "Back to plans")
              : tt("上一步", "Back")}
          </span>
        </button>

          {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={step === 1 ? !detailsReady : !materialsReady}
            className="ui-btn ui-btn-primary order-3 min-w-0 flex-1 items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium disabled:opacity-40 sm:flex-none sm:px-6"
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
            className="ui-btn ui-btn-primary order-3 min-w-0 flex-1 items-center justify-center gap-2 px-5 py-3 text-[13px] font-medium disabled:opacity-40 sm:flex-none sm:px-6"
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
    </>
  );

  // 资料预览和教材目录是浮在向导之上的两层，必须待在滚动区外面，
  // 否则会被内容区一起裁掉、跟着一起滚。
  const wizardOverlays = (
    <>
      <ModalShell
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.name || tt("资料预览", "Material preview")}
        closeLabel={tt("关闭预览", "Close preview")}
        icon={<FileText className="h-4 w-4" />}
        size="lg"
        note={
          previewDoc &&
          `${visibleChars(previewDoc.content).toLocaleString()} ${tt("字", "chars")} · ${typeLabels[previewDoc.type]}`
        }
        footer={
          <button
            onClick={() => setPreviewDoc(null)}
            className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
          >
            {tt("关闭", "Close")}
          </button>
        }
      >
        <div className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-[#1c1b1a]">
          {previewDoc?.content || tt("文档内容为空", "Empty document content")}
        </div>
      </ModalShell>

      <TextbookOutlineDialog
        open={textbookDialogOpen}
        onClose={() => setTextbookDialogOpen(false)}
        examName={examName.trim()}
        subject={subject.trim()}
        existingTopicTitles={nonTextbookTitles(topics)}
        onApply={applyTextbookTopics}
      />
    </>
  );

  if (!isModal) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 font-sans text-[#1c1b1a] space-y-5">
        {pageHeader}
        {wizardStepRail}
        {wizardContent}
        <div className="border-t border-[#f0ede8] pt-4">{wizardFooter}</div>
        {wizardOverlays}
      </div>
    );
  }

  // 骨架整个交给 ModalShell：全站唯一的悬浮窗就是它，滚动口径也只在它那里定义一次——
  // 页头和按钮条钉住，只有中间的内容滚，表单再长也不会把「下一步」顶出屏幕。
  return (
    <>
      <ModalShell
        open
        onClose={requestClose}
        bodyRef={bodyRef}
        size="lg"
        title={modalTitle}
        closeLabel={tt("关闭", "Close")}
        closeDisabled={isWorking || isParsingFiles}
        eyebrow={modalEyebrow}
        subheader={wizardStepRail}
        footer={wizardFooter}
        footerMode="block"
      >
        {wizardContent}
      </ModalShell>
      {wizardOverlays}
    </>
  );
}