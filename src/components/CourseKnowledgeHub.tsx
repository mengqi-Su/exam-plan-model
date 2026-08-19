import React, { useState, useMemo } from "react";
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Trash2, 
  Plus, 
  BookOpen, 
  Check, 
  AlertCircle, 
  ArrowRight,
  GraduationCap,
  Layers,
  Calendar,
  Compass,
  FolderOpen,
  Search,
  Filter,
  Eye,
  X,
  FileQuestion,
  Tag,
  Clock,
  Zap,
  BookmarkPlus,
  CheckCircle2,
  HelpCircle,
  BarChart2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sliders,
  Target,
  BrainCircuit,
  CalendarDays,
  RefreshCw
} from "lucide-react";
import { SyllabusTopic, StudyMaterial, ExamStudyPlan, UserStudyPreferences, DaySchedulePreference } from "../types";
import { SAMPLE_MATERIALS, INITIAL_SAMPLE_DOCUMENTS, DEFAULT_WEEK_SCHEDULE } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { parseDocumentFile } from "../lib/documentParser";
import { QuizModal } from "./QuizModal";
import { fallbackExtractSyllabusClient, fallbackGeneratePlanClient } from "../lib/fallbackPlanner";

interface CourseKnowledgeHubProps {
  plan?: ExamStudyPlan | null;
  examName: string;
  onExamNameChange: (name: string) => void;
  subject: string;
  onSubjectChange: (subj: string) => void;
  syllabusContent: string;
  onSyllabusContentChange: (content: string) => void;
  syllabusDocName: string;
  onSyllabusDocNameChange: (name: string) => void;
  topics: SyllabusTopic[];
  onTopicsChange: (topics: SyllabusTopic[]) => void;
  materialsSummary: string;
  onMaterialsSummaryChange: (summary: string) => void;
  onUpdatePlan?: (updatedPlan: ExamStudyPlan) => void;
  onDeleteCourse?: () => void;
  onRequestDeleteCourse?: (plan?: ExamStudyPlan | null) => void;
  onProceedToPlanConfig: () => void;
  onNavigateToTab?: (tab: "todo" | "calendar" | "realtime" | "course") => void;
}

export function CourseKnowledgeHub({
  plan,
  examName,
  onExamNameChange,
  subject,
  onSubjectChange,
  syllabusContent,
  onSyllabusContentChange,
  syllabusDocName,
  onSyllabusDocNameChange,
  topics,
  onTopicsChange,
  materialsSummary,
  onMaterialsSummaryChange,
  onUpdatePlan,
  onDeleteCourse,
  onRequestDeleteCourse,
  onProceedToPlanConfig,
  onNavigateToTab,
}: CourseKnowledgeHubProps) {
  const { t, language } = useI18n();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  // Knowledge Base upload / parsing state
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Quick Paste state
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteDocTitle, setPasteDocTitle] = useState("");
  const [pasteDocType, setPasteDocType] = useState<StudyMaterial["type"]>("notes");
  const [pasteDocContent, setPasteDocContent] = useState("");

  // Topic Blueprint state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicWeight, setNewTopicWeight] = useState(15);
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newTopicHours, setNewTopicHours] = useState(4);
  const [newTopicSubtopics, setNewTopicSubtopics] = useState("");

  // Direct Plan Generation Preferences
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultExamDate = useMemo(() => {
    if (plan?.examDate) return plan.examDate;
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  }, [plan?.examDate]);

  const [startDate, setStartDate] = useState(plan?.startDate || todayStr);
  const [examDate, setExamDate] = useState(plan?.examDate || defaultExamDate);
  const [examTime, setExamTime] = useState(plan?.examTime || "09:00");
  const [targetScore, setTargetScore] = useState(plan?.preferences?.targetScoreOrGrade || "A (90%+ / 优秀)");
  const [studyPace, setStudyPace] = useState<UserStudyPreferences["studyPace"]>(plan?.preferences?.studyPace || "deep_mastery");
  const [sessionLength, setSessionLength] = useState<number>(plan?.preferences?.sessionLengthMinutes || 45);
  const [includePracticeExams, setIncludePracticeExams] = useState(plan?.preferences?.includePracticeExams ?? true);
  const [includeBufferDays, setIncludeBufferDays] = useState(plan?.preferences?.includeBufferDays ?? true);
  const [bufferDaysCount, setBufferDaysCount] = useState(plan?.preferences?.bufferDaysCount ?? 2);
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(
    plan?.preferences?.dailySchedules || DEFAULT_WEEK_SCHEDULE
  );
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>(
    plan?.preferences?.weakTopicsFocus || topics.filter(t => t.difficulty === "hard").map(t => t.title)
  );

  // Settings visibility & generation state
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerateError, setPlanGenerateError] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);
  const [activeQuizMaterial, setActiveQuizMaterial] = useState<StudyMaterial | null>(null);

  // Materials collection (fallback to sample if empty and no plan)
  const materials: StudyMaterial[] = useMemo(() => {
    if (plan?.materials && plan.materials.length > 0) {
      return plan.materials;
    }
    return [];
  }, [plan?.materials]);

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchType = filterType === "all" || m.type === filterType;
      const matchQuery = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchQuery;
    });
  }, [materials, filterType, searchQuery]);

  // Total topics estimated hours
  const totalEstHours = useMemo(() => {
    return topics.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [topics]);

  // Days until exam calculation
  const daysUntilExam = useMemo(() => {
    if (!examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [examDate]);

  // Helper to persist materials update into active plan
  const updatePlanMaterials = (newMaterials: StudyMaterial[]) => {
    if (plan && onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        materials: newMaterials,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  // Upload file parsing handler
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsingDoc(true);
    setParsingStatus(language === "zh" ? "正在读取并解析文档文本..." : "Reading and extracting document text...");

    const newAttachedMaterials: StudyMaterial[] = [];
    let combinedContent = syllabusContent ? syllabusContent + "\n\n" : "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setParsingStatus(`${language === "zh" ? "解析中" : "Parsing"}: ${file.name} (${i + 1}/${files.length})`);
        const parsed = await parseDocumentFile(file, language);
        const text = parsed?.text || "";
        
        let inferredType: StudyMaterial["type"] = "notes";
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes("syllabus") || lowerName.includes("大纲") || lowerName.includes("考纲")) {
          inferredType = "syllabus";
        } else if (lowerName.includes("slide") || lowerName.includes("ppt") || lowerName.includes("讲义") || lowerName.includes("课件")) {
          inferredType = "lecture_slides";
        } else if (lowerName.includes("exam") || lowerName.includes("test") || lowerName.includes("真题") || lowerName.includes("试卷") || lowerName.includes("期末")) {
          inferredType = "past_exam";
        } else if (lowerName.includes("outline") || lowerName.includes("chapter") || lowerName.includes("教材")) {
          inferredType = "textbook_outline";
        }

        const materialItem: StudyMaterial = {
          id: `mat-${Date.now()}-${i}`,
          name: file.name,
          type: inferredType,
          categoryGroup: inferredType === "past_exam" ? "exam_question" : inferredType === "syllabus" ? "course_syllabus" : "study_material",
          content: text,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          summaryNotes: text.slice(0, 150) + "...",
          difficulty: "medium",
        };

        newAttachedMaterials.push(materialItem);
        combinedContent += `=== ${file.name} ===\n${text}\n\n`;
      } catch (err: any) {
        console.error("Failed to parse file:", file.name, err);
      }
    }

    if (newAttachedMaterials.length > 0) {
      const newDocDisplayName = files.length === 1 ? files[0].name : `${files.length} 个资料集合 (${files[0].name} 等)`;
      onSyllabusDocNameChange(newDocDisplayName);
      onSyllabusContentChange(combinedContent.trim());
      updatePlanMaterials([...newAttachedMaterials, ...materials]);
    }

    setIsParsingDoc(false);
    setParsingStatus("");
  };

  // Add Pasted Text into Knowledge Base
  const handleAddPastedDoc = () => {
    if (!pasteDocContent.trim()) return;
    const title = pasteDocTitle.trim() || (language === "zh" ? "自定义笔记/提纲" : "Custom Notes");
    const newDoc: StudyMaterial = {
      id: `mat-paste-${Date.now()}`,
      name: title,
      type: pasteDocType,
      categoryGroup: pasteDocType === "past_exam" ? "exam_question" : pasteDocType === "syllabus" ? "course_syllabus" : "study_material",
      content: pasteDocContent.trim(),
      uploadedAt: new Date().toISOString(),
      sizeBytes: new Blob([pasteDocContent]).size,
      summaryNotes: pasteDocContent.trim().slice(0, 140) + "...",
      difficulty: "medium",
    };

    updatePlanMaterials([newDoc, ...materials]);
    onSyllabusContentChange(`${syllabusContent}\n\n=== 知识库: ${title} ===\n${pasteDocContent}`);
    setPasteDocTitle("");
    setPasteDocContent("");
    setShowPasteBox(false);
  };

  // Delete Document
  const handleDeleteDoc = (docId: string) => {
    const updated = materials.filter((m) => m.id !== docId);
    updatePlanMaterials(updated);
  };

  // Load Sample Knowledge Base
  const handleLoadSampleKnowledgeBase = () => {
    updatePlanMaterials(INITIAL_SAMPLE_DOCUMENTS);
    const combined = INITIAL_SAMPLE_DOCUMENTS.map((d) => `### ${d.name}\n${d.content}`).join("\n\n");
    onSyllabusContentChange(combined);
    onExamNameChange(language === "zh" ? "高级数据结构与算法期末考试" : "CS 301: Advanced Algorithms Final");
    onSubjectChange(language === "zh" ? "计算机科学与工程" : "Computer Science");
  };

  // Extract Topics from Knowledge Base using Gemini
  const handleExtractTopics = async () => {
    let sourceContent = syllabusContent.trim();
    if (!sourceContent && materials.length > 0) {
      sourceContent = materials.map((m) => `### ${m.name}\n${m.content}`).join("\n\n");
    }

    if (!sourceContent && materials.length === 0) {
      setExtractError(
        language === "zh"
          ? "请先在上方知识库中上传课程资料或粘贴笔记，AI 将为您提炼考点架构。"
          : "Please upload knowledge base materials first for AI topic extraction."
      );
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractionSuccess(false);

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/extract-syllabus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materials: materials.length > 0 ? materials : [{ name: "课程资料", content: sourceContent, type: "notes" }],
            examName: examName || (language === "zh" ? "即将到来的期末考试" : "Upcoming Exam"),
            subject: subject || (language === "zh" ? "综合学科" : "General"),
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network fetch error, using local fallback syllabus parser:", fetchErr);
      }

      if (!data || !data.topics || data.topics.length === 0) {
        data = fallbackExtractSyllabusClient(
          materials.length > 0 ? materials : [{ name: "课程资料", content: sourceContent, type: "notes" }],
          examName || (language === "zh" ? "期末考试" : "Final Exam"),
          subject || (language === "zh" ? "综合学科" : "General"),
          language
        );
      }

      if (data.summary) {
        onMaterialsSummaryChange(data.summary);
      }
      if (data.topics && data.topics.length > 0) {
        onTopicsChange(data.topics);
        if (plan && onUpdatePlan) {
          onUpdatePlan({
            ...plan,
            topics: data.topics,
            materialsSummary: data.summary || plan.materialsSummary,
          });
        }
      }
      setExtractionSuccess(true);
      setTimeout(() => setExtractionSuccess(false), 4000);
    } catch (err: any) {
      console.error("Extraction error handled:", err);
      const fallback = fallbackExtractSyllabusClient([], examName || "期末考试", subject || "综合学科", language);
      onTopicsChange(fallback.topics);
      onMaterialsSummaryChange(fallback.summary);
      setExtractionSuccess(true);
      setTimeout(() => setExtractionSuccess(false), 4000);
    } finally {
      setIsExtracting(false);
    }
  };

  // Add Custom Topic
  const handleAddCustomTopic = () => {
    if (!newTopicTitle.trim()) return;
    const subtopicsList = newTopicSubtopics
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newTopic: SyllabusTopic = {
      id: `topic-custom-${Date.now()}`,
      title: newTopicTitle.trim(),
      category: subject || (language === "zh" ? "专业核心" : "Core"),
      weightPercentage: Number(newTopicWeight) || 15,
      difficulty: newTopicDifficulty,
      userKnowledgeLevel: "intermediate",
      subtopics: subtopicsList.length > 0 ? subtopicsList : [newTopicTitle.trim()],
      estimatedHours: Number(newTopicHours) || 4,
    };

    const updatedTopics = [...topics, newTopic];
    onTopicsChange(updatedTopics);
    if (plan && onUpdatePlan) {
      onUpdatePlan({ ...plan, topics: updatedTopics });
    }

    setNewTopicTitle("");
    setNewTopicSubtopics("");
    setIsAddingTopic(false);
  };

  // Delete Topic
  const handleDeleteTopic = (topicId: string) => {
    const updated = topics.filter((t) => t.id !== topicId);
    onTopicsChange(updated);
    if (plan && onUpdatePlan) {
      onUpdatePlan({ ...plan, topics: updated });
    }
  };

  // Generate / Regenerate Study Plan directly from Knowledge Base
  const handleGenerateStudyPlan = async () => {
    if (topics.length === 0) {
      await handleExtractTopics();
    }

    setIsGeneratingPlan(true);
    setPlanGenerateError(null);
    setPlanSuccessNotice(false);

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
      additionalNotes: "",
    };

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics: topics.length > 0 ? topics : [
              {
                id: "top-1",
                title: "核心理论与基础概念",
                category: "核心大纲",
                weightPercentage: 30,
                difficulty: "medium",
                subtopics: ["基础定义与定理推导", "标准名词解释"],
                estimatedHours: 8,
              },
              {
                id: "top-2",
                title: "典型考题与高频题型精解",
                category: "实战演练",
                weightPercentage: 40,
                difficulty: "hard",
                subtopics: ["经典大题演练", "易错点与解题模板"],
                estimatedHours: 14,
              },
              {
                id: "top-3",
                title: "全真模拟与真题冲刺",
                category: "模拟冲刺",
                weightPercentage: 30,
                difficulty: "hard",
                subtopics: ["历年真题实战", "查漏补缺与考前押密"],
                estimatedHours: 10,
              },
            ],
            preferences,
            materialsSummary,
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network fetch error for generate-plan, generating local plan:", fetchErr);
      }

      if (!data || !data.tasks || data.tasks.length === 0) {
        data = fallbackGeneratePlanClient(topics, preferences);
      }

      const newPlan: ExamStudyPlan = {
        id: plan?.id || `plan-${Date.now()}`,
        createdAt: plan?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        examName: preferences.examName,
        subject: preferences.subject,
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: data.totalPlannedHours || totalEstHours || 35,
        phases: data.phases || [],
        topics: topics.length > 0 ? topics : data.topics || [],
        tasks: data.tasks || [],
        preferences,
        materialsSummary,
        materials: materials.length > 0 ? materials : undefined,
      };

      if (onUpdatePlan) {
        onUpdatePlan(newPlan);
      }

      setPlanSuccessNotice(true);
      setTimeout(() => setPlanSuccessNotice(false), 5000);
    } catch (err: any) {
      console.error("Plan generation error, using safe fallback", err);
      const safeData = fallbackGeneratePlanClient(topics, preferences);
      const safePlan: ExamStudyPlan = {
        id: plan?.id || `plan-${Date.now()}`,
        createdAt: plan?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        examName: preferences.examName,
        subject: preferences.subject,
        startDate: preferences.startDate,
        examDate: preferences.examDate,
        examTime: preferences.examTime,
        totalPlannedHours: safeData.totalPlannedHours || 30,
        phases: safeData.phases,
        topics: topics.length > 0 ? topics : [],
        tasks: safeData.tasks,
        preferences,
        materialsSummary,
        materials: materials.length > 0 ? materials : undefined,
      };
      if (onUpdatePlan) {
        onUpdatePlan(safePlan);
      }
      setPlanSuccessNotice(true);
      setTimeout(() => setPlanSuccessNotice(false), 5000);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Helper for document format icons & colors
  const getDocTypeBadge = (type: StudyMaterial["type"]) => {
    switch (type) {
      case "syllabus":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#edf3ec] text-[#448361] border border-[#d5e5d3]">考试大纲</span>;
      case "lecture_slides":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f0f4f8] text-[#2b78a0] border border-[#dce7f2]">讲义课件</span>;
      case "past_exam":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fbf3f2] text-[#d44c47] border border-[#f5d5d3]">历年真题</span>;
      case "textbook_outline":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fbf3db] text-[#cb912f] border border-[#f6e3b5]">教材提纲</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f7f6f3] text-[#787774] border border-[#e9e9e7]">笔记资料</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10 animate-fadeIn text-[#37352f]">
      {/* ========================================================================= */}
      {/* HEADER: Flat Notion Page Header                                           */}
      {/* ========================================================================= */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-[#787774] mb-1">
              <GraduationCap className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span className="font-medium">{t("workspace")}</span>
              <span>/</span>
              <span className="text-[#37352f] font-semibold">{examName || (language === "zh" ? "课程详情" : "Course Hub")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352f]">
                {examName || (language === "zh" ? "课程知识库与智能规划" : "Course Knowledge Base & Plan")}
              </h1>
              {subject && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#f0f4f8] text-[#2b78a0] border border-[#dce7f2]">
                  {subject}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#787774] leading-relaxed">
              {language === "zh"
                ? "管理当前课程的讲义、大纲、笔记与真题，AI 将基于此知识库自动提炼考点权重并生成自适应复习计划。"
                : "Manage your course syllabus, lecture slides, notes, and past exams. The AI builds a topic blueprint and generates an adaptive study plan."}
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleGenerateStudyPlan}
              disabled={isGeneratingPlan || isExtracting}
              className="flex items-center space-x-2 px-3.5 py-2 bg-[#37352f] hover:bg-[#201f1d] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              {isGeneratingPlan ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === "zh" ? "AI 规划生成中..." : "Generating Plan..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{language === "zh" ? "生成/刷新复习规划" : "Generate Plan"}</span>
                </>
              )}
            </button>
            {onNavigateToTab && plan?.tasks && plan.tasks.length > 0 && (
              <button
                onClick={() => onNavigateToTab("todo")}
                className="flex items-center space-x-1.5 px-3 py-2 border border-[#d3d2cf] hover:bg-[#f7f6f3] bg-white text-[#37352f] rounded-lg text-xs font-medium transition-colors cursor-pointer"
              >
                <span>{language === "zh" ? "查看待办清单" : "View To-Dos"}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#787774]" />
              </button>
            )}
            {(onRequestDeleteCourse || onDeleteCourse) && (
              <button
                onClick={() => {
                  if (onRequestDeleteCourse) {
                    onRequestDeleteCourse(plan);
                  } else if (onDeleteCourse) {
                    onDeleteCourse();
                  }
                }}
                className="flex items-center space-x-1 px-2.5 py-2 border border-[#f5d5d3] bg-[#fbf3f2] hover:bg-[#f8e5e3] text-[#d44c47] rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title={language === "zh" ? "删除此科目" : "Delete Course"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Flat 3-Step Flow Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-[#e9e9e7] shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-[#f0f4f8] text-[#2b78a0] flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                <span>{language === "zh" ? "课程知识库资料" : "Knowledge Base"}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#efefed] rounded text-[#5a5a57]">
                  {materials.length} 份
                </span>
              </div>
              <p className="text-[11px] text-[#787774] truncate">
                {materials.length > 0 ? (language === "zh" ? "已解析就绪" : "Ready for AI") : (language === "zh" ? "待上传资料" : "Upload documents")}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-[#e9e9e7] shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-[#fbf3db] text-[#cb912f] flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                <span>{language === "zh" ? "AI 考点图谱" : "Topic Blueprint"}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#efefed] rounded text-[#5a5a57]">
                  {topics.length} 个考点
                </span>
              </div>
              <p className="text-[11px] text-[#787774] truncate">
                {topics.length > 0 ? `${totalEstHours} ${language === "zh" ? "总预估学时" : "hrs total"}` : (language === "zh" ? "一键提炼考点" : "Extract topics")}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 rounded-xl bg-white border border-[#e9e9e7] shadow-2xs">
            <div className="w-7 h-7 rounded-md bg-[#edf3ec] text-[#448361] flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                <span>{language === "zh" ? "智能复习排程" : "Generated Plan"}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-[#efefed] rounded text-[#5a5a57]">
                  {plan?.tasks?.length || 0} 项任务
                </span>
              </div>
              <p className="text-[11px] text-[#787774] truncate">
                {daysUntilExam > 0 ? (language === "zh" ? `倒计时 ${daysUntilExam} 天` : `${daysUntilExam} days left`) : (language === "zh" ? "自适应排程已就绪" : "Ready")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {planSuccessNotice && (
        <div className="flex items-center space-x-2 p-3.5 bg-[#edf3ec] border border-[#d5e5d3] text-[#448361] rounded-xl text-xs font-semibold animate-fadeIn shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{language === "zh" ? "已成功依据知识库资料生成/更新复习规划！任务已分配至每日待办与日历日程。" : "Successfully generated adaptive study plan from knowledge base!"}</span>
        </div>
      )}

      {extractionSuccess && (
        <div className="flex items-center space-x-2 p-3.5 bg-[#f0f4f8] border border-[#dce7f2] text-[#2b78a0] rounded-xl text-xs font-semibold animate-fadeIn shadow-2xs">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{language === "zh" ? "AI 考点架构已根据知识库资料更新完毕！" : "Topic blueprint successfully extracted from knowledge base!"}</span>
        </div>
      )}

      {extractError && (
        <div className="flex items-center space-x-2 p-3 bg-[#fbf3f2] border border-[#f5d5d3] text-[#d44c47] rounded-xl text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{extractError}</span>
        </div>
      )}

      {planGenerateError && (
        <div className="flex items-center space-x-2 p-3 bg-[#fbf3f2] border border-[#f5d5d3] text-[#d44c47] rounded-xl text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{planGenerateError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: 课程知识库资料 (Knowledge Base Documents) - FLAT DIRECT VIEW    */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-[#2b78a0]" />
            <h2 className="text-base font-bold text-[#37352f]">
              {language === "zh" ? "1. 课程知识库资料" : "1. Course Knowledge Base"}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#efefed] text-[#787774] font-medium">
              {materials.length} {language === "zh" ? "份" : "docs"}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-[#d3d2cf] hover:bg-[#f7f6f3] text-[#37352f] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#787774]" />
              <span>{language === "zh" ? "粘贴文本笔记" : "Paste Notes"}</span>
            </button>

            <button
              onClick={handleLoadSampleKnowledgeBase}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-[#d3d2cf] hover:bg-[#f7f6f3] text-[#37352f] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-[#cb912f]" />
              <span>{language === "zh" ? "加载示例资料" : "Sample Docs"}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Paste Textarea Box */}
        {showPasteBox && (
          <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 space-y-3 animate-fadeIn shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "快速录入文本或笔记资料" : "Add Text / Notes to Knowledge Base"}
              </h4>
              <button
                onClick={() => setShowPasteBox(false)}
                className="text-[#787774] hover:text-[#37352f] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={pasteDocTitle}
                onChange={(e) => setPasteDocTitle(e.target.value)}
                placeholder={language === "zh" ? "资料名称（如：第 1-3 周核心知识点笔记）" : "Document title..."}
                className="px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white focus:border-[#37352f]"
              />
              <select
                value={pasteDocType}
                onChange={(e) => setPasteDocType(e.target.value as any)}
                className="px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white cursor-pointer"
              >
                <option value="notes">{language === "zh" ? "课堂笔记 (Notes)" : "Notes"}</option>
                <option value="syllabus">{language === "zh" ? "考纲大纲 (Syllabus)" : "Syllabus"}</option>
                <option value="lecture_slides">{language === "zh" ? "讲义课件 (Slides)" : "Slides"}</option>
                <option value="past_exam">{language === "zh" ? "模拟真题 (Past Exam)" : "Past Exam"}</option>
              </select>
            </div>
            <textarea
              value={pasteDocContent}
              onChange={(e) => setPasteDocContent(e.target.value)}
              rows={4}
              placeholder={language === "zh" ? "在此粘贴大纲内容、讲义提纲、考点公式或题目文本..." : "Paste syllabus, lecture notes or exam questions here..."}
              className="w-full px-3 py-2 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white focus:border-[#37352f]"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 text-xs text-[#787774] hover:bg-[#efefed] rounded-md cursor-pointer"
              >
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAddPastedDoc}
                disabled={!pasteDocContent.trim()}
                className="px-4 py-1.5 bg-[#37352f] hover:bg-[#201f1d] disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer"
              >
                {language === "zh" ? "保存至知识库" : "Add to Knowledge Base"}
              </button>
            </div>
          </div>
        )}

        {/* Minimalist Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFileUpload(e.dataTransfer.files);
          }}
          className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            isDragging
              ? "border-[#2b78a0] bg-[#f0f4f8]"
              : "border-[#d3d2cf] bg-[#fafaf9] hover:bg-[#f7f6f3]"
          }`}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.ppt,.pptx"
            onChange={(e) => handleFileUpload(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-white border border-[#e9e9e7] flex items-center justify-center text-[#5a5a57] shadow-2xs">
              <Upload className="w-5 h-5 text-[#2b78a0]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "点击或拖拽上传课程文件" : "Click or drag & drop files here"}
              </p>
              <p className="text-[11px] text-[#787774] mt-0.5">
                {language === "zh"
                  ? "支持 PDF、Word (.docx)、PPT、Markdown、TXT 格式"
                  : "Supports PDF, Word, PPT slides, Markdown, and TXT files"}
              </p>
            </div>
            {isParsingDoc && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-white border border-[#2b78a0]/30 text-[#2b78a0] rounded-full text-xs animate-pulse mt-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{parsingStatus || (language === "zh" ? "正在解析文档文本..." : "Parsing file...")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents Grid sitting directly on page canvas */}
        {materials.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-[#37352f]">
                  {language === "zh" ? "知识库文件清单" : "Knowledge Base Files"}
                </span>
                <span className="text-[11px] px-1.5 py-0.2 bg-[#efefed] text-[#5a5a57] rounded-full">
                  {filteredMaterials.length}
                </span>
              </div>

              {/* Type Filter */}
              <div className="flex items-center space-x-1 text-xs">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    filterType === "all" ? "bg-[#37352f] text-white" : "text-[#787774] hover:bg-[#efefed]"
                  }`}
                >
                  {language === "zh" ? "全部" : "All"}
                </button>
                <button
                  onClick={() => setFilterType("syllabus")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    filterType === "syllabus" ? "bg-[#37352f] text-white" : "text-[#787774] hover:bg-[#efefed]"
                  }`}
                >
                  {language === "zh" ? "考纲" : "Syllabus"}
                </button>
                <button
                  onClick={() => setFilterType("lecture_slides")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    filterType === "lecture_slides" ? "bg-[#37352f] text-white" : "text-[#787774] hover:bg-[#efefed]"
                  }`}
                >
                  {language === "zh" ? "讲义" : "Slides"}
                </button>
                <button
                  onClick={() => setFilterType("past_exam")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    filterType === "past_exam" ? "bg-[#37352f] text-white" : "text-[#787774] hover:bg-[#efefed]"
                  }`}
                >
                  {language === "zh" ? "真题" : "Exams"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMaterials.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between p-3.5 bg-white border border-[#e9e9e7] hover:border-[#b4b4b0] rounded-xl transition-all shadow-2xs"
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#f7f6f3] border border-[#e9e9e7] flex items-center justify-center text-[#5a5a57] shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#2b78a0]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-semibold text-[#37352f] truncate">
                          {doc.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {getDocTypeBadge(doc.type)}
                        <span className="text-[#9b9a97]">
                          {(doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : "文本资料")}
                        </span>
                        <span className="text-[#448361] font-medium flex items-center space-x-0.5">
                          <Check className="w-3 h-3" />
                          <span>{language === "zh" ? "已解析" : "Ready"}</span>
                        </span>
                      </div>
                      {doc.summaryNotes && (
                        <p className="text-[11px] text-[#787774] line-clamp-1">
                          {doc.summaryNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      title={language === "zh" ? "预览解析文本" : "Preview"}
                      className="p-1 text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] rounded cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveQuizMaterial(doc)}
                      title={language === "zh" ? "针对该资料出题自测" : "Quiz"}
                      className="p-1 text-[#787774] hover:text-[#cb912f] hover:bg-[#fbf3db] rounded cursor-pointer"
                    >
                      <FileQuestion className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      title={language === "zh" ? "从知识库移除" : "Delete"}
                      className="p-1 text-[#787774] hover:text-[#d44c47] hover:bg-[#fbf3f2] rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 2: AI 提炼的核心考点架构 (Extracted Topics) - FLAT DIRECT VIEW    */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-[#2b78a0]" />
            <h2 className="text-base font-bold text-[#37352f]">
              {language === "zh" ? "2. AI 提炼的核心考点架构" : "2. Extracted Topic Blueprint"}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#efefed] text-[#787774] font-medium">
              {topics.length} {language === "zh" ? "个考点" : "topics"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#d3d2cf] hover:bg-[#f7f6f3] text-[#37352f] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === "zh" ? "提炼中..." : "Extracting..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{language === "zh" ? "重新提炼考点" : "Re-extract"}</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAddingTopic(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#37352f] hover:bg-[#201f1d] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "添加考点" : "Add Topic"}</span>
            </button>
          </div>
        </div>

        {/* Add Topic Inline Form */}
        {isAddingTopic && (
          <div className="bg-white border border-[#e9e9e7] rounded-xl p-4 space-y-3 animate-fadeIn shadow-2xs">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "添加自定义考点" : "Add Custom Topic"}
              </h4>
              <button onClick={() => setIsAddingTopic(false)} className="text-[#787774] hover:text-[#37352f] cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={language === "zh" ? "考点名称（如：红黑树平衡推导）" : "Topic title..."}
                className="sm:col-span-2 px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white"
              />
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-[#787774] whitespace-nowrap">{language === "zh" ? "权重" : "Weight"}:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white"
                />
                <span className="text-xs text-[#787774]">%</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-[#787774] whitespace-nowrap">{language === "zh" ? "学时" : "Hours"}:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newTopicHours}
                  onChange={(e) => setNewTopicHours(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white"
                />
                <span className="text-xs text-[#787774]">{language === "zh" ? "小时" : "hrs"}</span>
              </div>
            </div>
            <input
              type="text"
              value={newTopicSubtopics}
              onChange={(e) => setNewTopicSubtopics(e.target.value)}
              placeholder={language === "zh" ? "子知识点列表，逗号分隔（如：插入旋转、删除调整、时间复杂度）" : "Subtopics (comma separated)..."}
              className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] focus:outline-none focus:bg-white"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsAddingTopic(false)} className="px-3 py-1 text-xs text-[#787774] cursor-pointer">
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAddCustomTopic}
                disabled={!newTopicTitle.trim()}
                className="px-4 py-1 bg-[#37352f] text-white text-xs font-semibold rounded-md shadow-xs cursor-pointer"
              >
                {language === "zh" ? "确认添加" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Topics List sitting directly on page canvas */}
        {topics.length > 0 ? (
          <div className="space-y-2.5">
            {topics.map((topic, idx) => {
              const diffBadge = topic.difficulty === "hard"
                ? "bg-[#fbf3f2] text-[#d44c47] border border-[#f5d5d3]"
                : topic.difficulty === "easy"
                ? "bg-[#edf3ec] text-[#448361] border border-[#d5e5d3]"
                : "bg-[#fbf3db] text-[#cb912f] border border-[#f6e3b5]";
              const diffText = topic.difficulty === "hard"
                ? (language === "zh" ? "攻坚考点" : "Hard")
                : topic.difficulty === "easy"
                ? (language === "zh" ? "基础概念" : "Easy")
                : (language === "zh" ? "中等难度" : "Medium");

              return (
                <div
                  key={topic.id || `topic-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-[#e9e9e7] hover:border-[#b4b4b0] rounded-xl gap-3 transition-all shadow-2xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-[#37352f]">
                        {idx + 1}. {topic.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${diffBadge}`}>
                        {diffText}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#f0f4f8] text-[#2b78a0] border border-[#dce7f2]">
                        {language === "zh" ? "分值占比" : "Weight"}: {topic.weightPercentage || 20}%
                      </span>
                      <span className="text-[11px] text-[#787774] flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-[#9b9a97]" />
                        <span>{topic.estimatedHours || 4} {language === "zh" ? "学时" : "hrs"}</span>
                      </span>
                    </div>

                    {/* Subtopics */}
                    {topic.subtopics && topic.subtopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {topic.subtopics.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded bg-[#f7f6f3] border border-[#e9e9e7] text-[11px] text-[#5a5a57]"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="p-1.5 text-[#9b9a97] hover:text-[#d44c47] hover:bg-[#fbf3f2] rounded-lg transition-colors cursor-pointer"
                      title={language === "zh" ? "删除考点" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 text-center bg-[#fafaf9] border border-dashed border-[#d3d2cf] rounded-xl space-y-3">
            <GraduationCap className="w-8 h-8 mx-auto text-[#787774]" />
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? "暂未提炼考点。点击上方「重新提炼考点」按钮，AI 将立即解析并生成考点结构。"
                : "No topics extracted yet. Click 'Re-extract' above to parse from knowledge base."}
            </p>
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="px-4 py-2 bg-[#37352f] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              {language === "zh" ? "AI 智能提炼考点架构" : "Extract Topics with AI"}
            </button>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: 基于知识库生成的复习规划 (Generated Plan) - FLAT DIRECT VIEW    */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-[#448361]" />
            <h2 className="text-base font-bold text-[#37352f]">
              {language === "zh" ? "3. 个性化复习排程规划" : "3. AI Study Plan"}
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPlanSettings(!showPlanSettings)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#d3d2cf] hover:bg-[#f7f6f3] text-[#37352f] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-[#787774]" />
              <span>{language === "zh" ? "调整作息参数" : "Preferences"}</span>
              {showPlanSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleGenerateStudyPlan}
              disabled={isGeneratingPlan}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#37352f] hover:bg-[#201f1d] disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              {isGeneratingPlan ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === "zh" ? "正在排程..." : "Planning..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{language === "zh" ? "重新生成复习计划" : "Regenerate Plan"}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Settings Panel */}
        {showPlanSettings && (
          <div className="bg-white border border-[#e9e9e7] rounded-xl p-5 space-y-4 animate-fadeIn shadow-2xs">
            <h4 className="text-xs font-semibold text-[#37352f]">
              {language === "zh" ? "备考时间节点与复习偏好设置" : "Timeline & Pace Preferences"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "计划开始日期" : "Start Date"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "目标考试日期" : "Exam Date"}
                </label>
                <input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "目标成绩" : "Target Score"}
                </label>
                <select
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] cursor-pointer"
                >
                  <option value="A+ (95%+ / 卓越)">A+ (95%+ / 卓越)</option>
                  <option value="A (90%+ / 优秀)">A (90%+ / 优秀)</option>
                  <option value="B (80%+ / 良好)">B (80%+ / 良好)</option>
                  <option value="Pass (60%+ / 稳妥过关)">Pass (60%+ / 稳妥过关)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "复习节奏模式" : "Study Pace Mode"}
                </label>
                <select
                  value={studyPace}
                  onChange={(e) => setStudyPace(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] cursor-pointer"
                >
                  <option value="deep_mastery">{language === "zh" ? "深度精通模式 (概念推导 + 主动回忆)" : "Deep Mastery"}</option>
                  <option value="spaced_repetition">{language === "zh" ? "艾宾浩斯间隔复习 (高频循环回顾)" : "Spaced Repetition"}</option>
                  <option value="cramming_intensive">{language === "zh" ? "考前冲刺强化 (高频考点速攻)" : "Cramming Intensive"}</option>
                  <option value="steady_pace">{language === "zh" ? "匀速平稳推进" : "Steady Pace"}</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "单次专注时长" : "Session Duration"}
                </label>
                <select
                  value={sessionLength}
                  onChange={(e) => setSessionLength(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-[#fafaf9] border border-[#d3d2cf] rounded-md text-xs text-[#37352f] cursor-pointer"
                >
                  <option value={30}>30 {language === "zh" ? "分钟 (微习惯)" : "mins"}</option>
                  <option value={45}>45 {language === "zh" ? "分钟 (标准番茄钟)" : "mins"}</option>
                  <option value={60}>60 {language === "zh" ? "分钟 (深度专著)" : "mins"}</option>
                  <option value={90}>90 {language === "zh" ? "分钟 (仿真大题演练)" : "mins"}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleGenerateStudyPlan}
                disabled={isGeneratingPlan}
                className="px-4 py-1.5 bg-[#37352f] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                {language === "zh" ? "应用偏好并重新规划" : "Apply & Regenerate"}
              </button>
            </div>
          </div>
        )}

        {/* Plan Highlights 4-Stats Grid sitting directly on page canvas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-white border border-[#e9e9e7] rounded-xl shadow-2xs">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "备考窗口" : "Study Window"}</span>
            <span className="text-xl font-bold text-[#37352f] mt-0.5 block">
              {daysUntilExam} <span className="text-xs font-normal text-[#787774]">{language === "zh" ? "天" : "days"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#e9e9e7] rounded-xl shadow-2xs">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "总规划学时" : "Planned Hours"}</span>
            <span className="text-xl font-bold text-[#37352f] mt-0.5 block">
              {plan?.totalPlannedHours || totalEstHours || 35} <span className="text-xs font-normal text-[#787774]">{language === "zh" ? "小时" : "hrs"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#e9e9e7] rounded-xl shadow-2xs">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "总生成任务" : "Total Tasks"}</span>
            <span className="text-xl font-bold text-[#37352f] mt-0.5 block">
              {plan?.tasks?.length || 0} <span className="text-xs font-normal text-[#787774]">{language === "zh" ? "项" : "tasks"}</span>
            </span>
          </div>

          <div className="p-4 bg-white border border-[#e9e9e7] rounded-xl shadow-2xs">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "目标等级" : "Target Score"}</span>
            <span className="text-xl font-bold text-[#2b78a0] mt-0.5 block truncate">
              {targetScore.split(" ")[0]}
            </span>
          </div>
        </div>

        {/* Phase Roadmap Visualizer */}
        {plan?.phases && plan.phases.length > 0 && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-[#37352f]">
              {language === "zh" ? "备考阶段推进路线" : "Preparation Roadmap"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plan.phases.map((phase, pIdx) => (
                <div
                  key={phase.id || `phase-${pIdx}`}
                  className="p-4 bg-white border border-[#e9e9e7] rounded-xl space-y-1.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#37352f]">
                      Phase {pIdx + 1}: {phase.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#efefed] text-[#5a5a57] rounded font-medium">
                      {phase.startDate?.slice(5)} ~ {phase.endDate?.slice(5)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#787774] leading-relaxed">
                    {phase.description || phase.focus}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Tasks Preview linked to knowledge base */}
        {plan?.tasks && plan.tasks.length > 0 && (
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "近期备考任务预览" : "Upcoming Tasks Preview"}
              </h4>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("todo")}
                  className="text-xs font-semibold text-[#2b78a0] hover:text-[#1e5876] flex items-center space-x-1 cursor-pointer"
                >
                  <span>{language === "zh" ? "前往每日待办查看全部" : "View all in Daily To-Do"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2">
              {plan.tasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-white border border-[#e9e9e7] rounded-xl text-xs shadow-2xs"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.status === "completed" ? "bg-[#448361]" : "bg-[#2b78a0]"}`} />
                    <span className="text-[#37352f] font-semibold truncate">{task.title}</span>
                    <span className="text-[11px] text-[#787774] shrink-0 flex items-center space-x-1">
                      <span>{task.date} · {task.durationMinutes} {language === "zh" ? "分钟" : "mins"}</span>
                    </span>
                  </div>
                  {task.topicTitle && (
                    <span className="text-[10px] px-2 py-0.5 bg-[#f7f6f3] border border-[#e9e9e7] text-[#5a5a57] rounded shrink-0 ml-2">
                      {task.topicTitle}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Document Full Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[#e9e9e7]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0ee]">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#2b78a0]" />
                <h3 className="text-sm font-bold text-[#37352f] truncate">{previewDoc.name}</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-[#37352f] leading-relaxed whitespace-pre-wrap bg-[#fcfcfc]">
              {previewDoc.content || (language === "zh" ? "无文本内容" : "No content")}
            </div>
            <div className="px-5 py-3 border-t border-[#f0f0ee] bg-[#fafaf9] flex justify-between items-center text-xs">
              <span className="text-[#787774]">{previewDoc.sizeBytes ? `${Math.round(previewDoc.sizeBytes / 1024)} KB` : ""}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 bg-[#37352f] text-white rounded-md text-xs font-semibold cursor-pointer"
              >
                {language === "zh" ? "关闭" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Quiz Modal */}
      {activeQuizMaterial && (
        <QuizModal
          task={{
            id: `task-quiz-${activeQuizMaterial.id}`,
            title: `${activeQuizMaterial.name} 随堂自测`,
            description: activeQuizMaterial.summaryNotes || "知识库资料自测",
            category: "active_recall",
            topicTitle: activeQuizMaterial.topicTag || activeQuizMaterial.name,
            date: todayStr,
            durationMinutes: 15,
            priority: "medium",
            status: "pending",
            keyObjectives: [activeQuizMaterial.name],
            notes: activeQuizMaterial.content.slice(0, 1000),
          }}
          isOpen={Boolean(activeQuizMaterial)}
          onClose={() => setActiveQuizMaterial(null)}
        />
      )}
    </div>
  );
}
