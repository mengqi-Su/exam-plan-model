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
        return <span className="inline-flex items-center px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[10px] font-bold uppercase">[考试大纲]</span>;
      case "lecture_slides":
        return <span className="inline-flex items-center px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[10px] font-bold uppercase">[讲义课件]</span>;
      case "past_exam":
        return <span className="inline-flex items-center px-2 py-0.5 border border-[#111111] bg-[#111111] text-white text-[10px] font-bold uppercase">[历年真题]</span>;
      case "textbook_outline":
        return <span className="inline-flex items-center px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[10px] font-bold uppercase">[教材提纲]</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[10px] font-bold uppercase">[笔记资料]</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-10 animate-fadeIn text-[#111111] font-mono">
      {/* ========================================================================= */}
      {/* HEADER: Clean & Streamlined Knowledge Hub Action Bar                      */}
      {/* ========================================================================= */}
      <div className="space-y-4 font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#111111]">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold tracking-tight text-[#111111]">
                {language === "zh" ? "考纲架构与资料知识库" : "Syllabus Blueprint & Materials"}
              </h2>
              <span className="px-2 py-0.5 border border-[#111111] bg-white text-[#111111] text-[11px] font-mono font-bold">
                {materials.length} {language === "zh" ? "份资料" : "DOCS"} · {topics.length} {language === "zh" ? "个考点" : "TOPICS"}
              </span>
            </div>
            <p className="text-xs text-[#666666] leading-relaxed">
              {language === "zh"
                ? "管理课程讲义、笔记、真题与大纲，AI 自动提炼考点权重并驱动自适应复习计划。"
                : "Manage course materials and syllabus. AI extracts topic blueprints to generate adaptive plans."}
            </p>
          </div>

          {/* Action CTAs */}
          {(onRequestDeleteCourse || onDeleteCourse) && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 font-mono">
              <button
                onClick={() => {
                  if (onRequestDeleteCourse) {
                    onRequestDeleteCourse(plan);
                  } else if (onDeleteCourse) {
                    onDeleteCourse();
                  }
                }}
                className="flex items-center space-x-1 p-1.5 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-bold transition-colors cursor-pointer"
                title={language === "zh" ? "删除此科目" : "Delete Course"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 3-Step Flow Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="flex items-center space-x-3 p-3 bg-white border border-[#111111]">
            <div className="w-7 h-7 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#111111] flex items-center space-x-1.5 uppercase">
                <span>[{language === "zh" ? "课程知识库" : "KNOWLEDGE BASE"}]</span>
                <span className="text-[10px] px-1.5 py-0.2 border border-[#111111] bg-[#fafafa] text-[#111111]">
                  {materials.length} 份
                </span>
              </div>
              <p className="text-[11px] text-[#666666] truncate font-bold">
                {materials.length > 0 ? (language === "zh" ? "已解析就绪" : "READY FOR AI") : (language === "zh" ? "待上传资料" : "UPLOAD DOCS")}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-white border border-[#111111]">
            <div className="w-7 h-7 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#111111] flex items-center space-x-1.5 uppercase">
                <span>[{language === "zh" ? "AI 考点图谱" : "TOPIC BLUEPRINT"}]</span>
                <span className="text-[10px] px-1.5 py-0.2 border border-[#111111] bg-[#fafafa] text-[#111111]">
                  {topics.length} 个
                </span>
              </div>
              <p className="text-[11px] text-[#666666] truncate font-bold">
                {topics.length > 0 ? `${totalEstHours} ${language === "zh" ? "总预估学时" : "HRS TOTAL"}` : (language === "zh" ? "一键提炼考点" : "EXTRACT TOPICS")}
              </p>
            </div>
          </div>

          <div
            onClick={() => onNavigateToTab && onNavigateToTab("realtime")}
            className="flex items-center space-x-3 p-3 bg-white border border-[#111111] hover:bg-[#ededed] transition-colors cursor-pointer"
          >
            <div className="w-7 h-7 bg-[#111111] text-white flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-[#111111] flex items-center justify-between uppercase">
                <span>[{language === "zh" ? "进度追踪与排程" : "02 TRACKER"}]</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#111111]" />
              </div>
              <p className="text-[11px] text-[#666666] truncate font-bold">
                {daysUntilExam > 0 ? (language === "zh" ? `查看排程 · 倒计 ${daysUntilExam} 天` : `${daysUntilExam} DAYS LEFT · VIEW`) : (language === "zh" ? "前往 02 进度追踪查看" : "GO TO TRACKER")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {planSuccessNotice && (
        <div className="flex items-center space-x-2 p-3.5 bg-white border border-[#111111] text-[#111111] text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#111111]" />
          <span>[{language === "zh" ? "已成功依据知识库资料生成/更新复习规划！任务已分配至每日待办与日历日程。" : "SUCCESSFULLY GENERATED STUDY PLAN FROM KNOWLEDGE BASE!"}]</span>
        </div>
      )}

      {extractionSuccess && (
        <div className="flex items-center space-x-2 p-3.5 bg-white border border-[#111111] text-[#111111] text-xs font-bold animate-fadeIn">
          <Sparkles className="w-4 h-4 shrink-0 text-[#111111]" />
          <span>[{language === "zh" ? "AI 考点架构已根据知识库资料更新完毕！" : "TOPIC BLUEPRINT EXTRACTED SUCCESSFULLY!"}]</span>
        </div>
      )}

      {extractError && (
        <div className="flex items-center space-x-2 p-3 bg-white border border-[#111111] text-[#111111] text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>[ERROR] {extractError}</span>
        </div>
      )}

      {planGenerateError && (
        <div className="flex items-center space-x-2 p-3 bg-white border border-[#111111] text-[#111111] text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>[ERROR] {planGenerateError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: 课程知识库资料 (Knowledge Base Documents)                       */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <FolderOpen className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-bold uppercase text-[#111111]">
              [1. {language === "zh" ? "课程知识库资料" : "COURSE KNOWLEDGE BASE"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {materials.length} {language === "zh" ? "份" : "DOCS"}
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "粘贴文本笔记" : "PASTE NOTES"}]</span>
            </button>

            <button
              onClick={handleLoadSampleKnowledgeBase}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "加载示例资料" : "SAMPLE DOCS"}]</span>
            </button>
          </div>
        </div>

        {/* Collapsible Paste Textarea Box */}
        {showPasteBox && (
          <div className="bg-white border border-[#111111] p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "快速录入文本或笔记资料" : "ADD TEXT / NOTES"}]
              </h4>
              <button
                onClick={() => setShowPasteBox(false)}
                className="text-[#111111] hover:underline cursor-pointer"
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
                className="px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono"
              />
              <select
                value={pasteDocType}
                onChange={(e) => setPasteDocType(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono cursor-pointer font-bold"
              >
                <option value="notes">{language === "zh" ? "[课堂笔记 (Notes)]" : "[Notes]"}</option>
                <option value="syllabus">{language === "zh" ? "[考纲大纲 (Syllabus)]" : "[Syllabus]"}</option>
                <option value="lecture_slides">{language === "zh" ? "[讲义课件 (Slides)]" : "[Slides]"}</option>
                <option value="past_exam">{language === "zh" ? "[模拟真题 (Past Exam)]" : "[Past Exam]"}</option>
              </select>
            </div>
            <textarea
              value={pasteDocContent}
              onChange={(e) => setPasteDocContent(e.target.value)}
              rows={4}
              placeholder={language === "zh" ? "在此粘贴大纲内容、讲义提纲、考点公式或题目文本..." : "Paste syllabus, lecture notes or exam questions here..."}
              className="w-full px-3 py-2 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111] cursor-pointer font-bold"
              >
                [{language === "zh" ? "取消" : "CANCEL"}]
              </button>
              <button
                onClick={handleAddPastedDoc}
                disabled={!pasteDocContent.trim()}
                className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-bold border border-[#111111] cursor-pointer"
              >
                [{language === "zh" ? "保存至知识库" : "SAVE TO KNOWLEDGE BASE"}]
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
          className={`relative border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? "border-[#111111] bg-[#ededed]"
              : "border-[#111111] bg-[#fafafa] hover:bg-[#ededed]"
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
            <div className="w-10 h-10 bg-white border border-[#111111] flex items-center justify-center text-[#111111]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#111111] uppercase">
                [{language === "zh" ? "点击或拖拽上传课程文件" : "CLICK OR DRAG & DROP FILES HERE"}]
              </p>
              <p className="text-[11px] text-[#666666] mt-0.5 font-bold">
                {language === "zh"
                  ? "支持 PDF、Word (.docx)、PPT、Markdown、TXT 格式"
                  : "Supports PDF, Word, PPT slides, Markdown, and TXT files"}
              </p>
            </div>
            {isParsingDoc && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-white border border-[#111111] text-[#111111] text-xs font-bold animate-pulse mt-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>[{parsingStatus || (language === "zh" ? "正在解析文档文本..." : "Parsing file...")}]</span>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents Grid */}
        {materials.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-[#111111] uppercase">
                  [{language === "zh" ? "知识库文件清单" : "KNOWLEDGE BASE FILES"}]
                </span>
                <span className="text-[11px] px-1.5 py-0.2 border border-[#111111] bg-white text-[#111111] font-bold">
                  {filteredMaterials.length}
                </span>
              </div>

              {/* Type Filter */}
              <div className="flex items-center space-x-1 text-xs font-mono">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2 py-1 border border-[#111111] text-[11px] font-bold transition-colors cursor-pointer ${
                    filterType === "all" ? "bg-[#111111] text-white" : "bg-white text-[#111111] hover:bg-[#ededed]"
                  }`}
                >
                  [{language === "zh" ? "全部" : "ALL"}]
                </button>
                <button
                  onClick={() => setFilterType("syllabus")}
                  className={`px-2 py-1 border border-[#111111] text-[11px] font-bold transition-colors cursor-pointer ${
                    filterType === "syllabus" ? "bg-[#111111] text-white" : "bg-white text-[#111111] hover:bg-[#ededed]"
                  }`}
                >
                  [{language === "zh" ? "考纲" : "SYLLABUS"}]
                </button>
                <button
                  onClick={() => setFilterType("lecture_slides")}
                  className={`px-2 py-1 border border-[#111111] text-[11px] font-bold transition-colors cursor-pointer ${
                    filterType === "lecture_slides" ? "bg-[#111111] text-white" : "bg-white text-[#111111] hover:bg-[#ededed]"
                  }`}
                >
                  [{language === "zh" ? "讲义" : "SLIDES"}]
                </button>
                <button
                  onClick={() => setFilterType("past_exam")}
                  className={`px-2 py-1 border border-[#111111] text-[11px] font-bold transition-colors cursor-pointer ${
                    filterType === "past_exam" ? "bg-[#111111] text-white" : "bg-white text-[#111111] hover:bg-[#ededed]"
                  }`}
                >
                  [{language === "zh" ? "真题" : "EXAMS"}]
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMaterials.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-start justify-between p-3.5 bg-white border border-[#111111] transition-all font-mono"
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 bg-white border border-[#111111] flex items-center justify-center text-[#111111] shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-bold text-[#111111] truncate">
                          {doc.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {getDocTypeBadge(doc.type)}
                        <span className="text-[#666666] font-bold">
                          {(doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : "TEXT")}
                        </span>
                        <span className="text-[#111111] font-bold flex items-center space-x-0.5">
                          <Check className="w-3 h-3" />
                          <span>[{language === "zh" ? "已解析" : "READY"}]</span>
                        </span>
                      </div>
                      {doc.summaryNotes && (
                        <p className="text-[11px] text-[#666666] line-clamp-1">
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
                      className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveQuizMaterial(doc)}
                      title={language === "zh" ? "针对该资料出题自测" : "Quiz"}
                      className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                    >
                      <FileQuestion className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      title={language === "zh" ? "从知识库移除" : "Delete"}
                      className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
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
      {/* SECTION 2: AI 提炼的核心考点架构 (Extracted Topics)                         */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-bold uppercase text-[#111111]">
              [2. {language === "zh" ? "AI 提炼的核心考点架构" : "TOPIC BLUEPRINT"}]
            </h2>
            <span className="text-xs px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
              {topics.length} {language === "zh" ? "个考点" : "TOPICS"}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>[{language === "zh" ? "提炼中..." : "EXTRACTING..."}]</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>[{language === "zh" ? "重新提炼考点" : "RE-EXTRACT"}]</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAddingTopic(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "+ 添加考点" : "+ ADD TOPIC"}]</span>
            </button>
          </div>
        </div>

        {/* Add Topic Inline Form */}
        {isAddingTopic && (
          <div className="bg-white border border-[#111111] p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "添加自定义考点" : "ADD CUSTOM TOPIC"}]
              </h4>
              <button onClick={() => setIsAddingTopic(false)} className="text-[#111111] hover:underline cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={language === "zh" ? "考点名称（如：红黑树平衡推导）" : "Topic title..."}
                className="sm:col-span-2 px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono"
              />
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-[#666666] font-bold">{language === "zh" ? "权重" : "Weight"}:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono font-bold"
                />
                <span className="text-xs text-[#666666] font-bold">%</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-[#666666] font-bold">{language === "zh" ? "学时" : "Hours"}:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newTopicHours}
                  onChange={(e) => setNewTopicHours(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono font-bold"
                />
                <span className="text-xs text-[#666666] font-bold">{language === "zh" ? "小时" : "HRS"}</span>
              </div>
            </div>
            <input
              type="text"
              value={newTopicSubtopics}
              onChange={(e) => setNewTopicSubtopics(e.target.value)}
              placeholder={language === "zh" ? "子知识点列表，逗号分隔（如：插入旋转、删除调整、时间复杂度）" : "Subtopics (comma separated)..."}
              className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsAddingTopic(false)} className="px-3 py-1 text-xs text-[#666666] hover:text-[#111111] cursor-pointer font-bold">
                [{language === "zh" ? "取消" : "CANCEL"}]
              </button>
              <button
                onClick={handleAddCustomTopic}
                disabled={!newTopicTitle.trim()}
                className="px-4 py-1 bg-[#111111] text-white text-xs font-bold border border-[#111111] cursor-pointer"
              >
                [{language === "zh" ? "确认添加" : "ADD TOPIC"}]
              </button>
            </div>
          </div>
        )}

        {/* Topics List */}
        {topics.length > 0 ? (
          <div className="space-y-2.5 font-mono">
            {topics.map((topic, idx) => {
              const diffText = topic.difficulty === "hard"
                ? (language === "zh" ? "攻坚考点" : "HARD")
                : topic.difficulty === "easy"
                ? (language === "zh" ? "基础概念" : "EASY")
                : (language === "zh" ? "中等难度" : "MEDIUM");

              return (
                <div
                  key={topic.id || `topic-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-[#111111] gap-3 transition-all"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      <span className="text-xs text-[#111111]">
                        {idx + 1}. {topic.title}
                      </span>
                      <span className="border border-[#111111] bg-white text-[#111111] px-2 py-0.5 text-[10px] uppercase">
                        [{diffText}]
                      </span>
                      <span className="border border-[#111111] bg-[#111111] text-white px-2 py-0.5 text-[10px] uppercase">
                        {language === "zh" ? "占比" : "WEIGHT"}: {topic.weightPercentage || 20}%
                      </span>
                      <span className="text-[11px] text-[#666666] flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{topic.estimatedHours || 4} {language === "zh" ? "学时" : "HRS"}</span>
                      </span>
                    </div>

                    {/* Subtopics */}
                    {topic.subtopics && topic.subtopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {topic.subtopics.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 bg-white border border-[#111111] text-[11px] text-[#111111] font-bold"
                          >
                            [{sub}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleDeleteTopic(topic.id)}
                      className="p-1.5 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
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
          <div className="p-8 text-center bg-[#fafafa] border border-dashed border-[#111111]/40 space-y-3 font-mono">
            <GraduationCap className="w-8 h-8 mx-auto text-[#111111]" />
            <p className="text-xs text-[#666666]">
              {language === "zh"
                ? "暂未提炼考点。点击上方「重新提炼考点」按钮，AI 将立即解析并生成考点结构。"
                : "No topics extracted yet. Click 'Re-extract' above to parse from knowledge base."}
            </p>
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="px-4 py-2 bg-[#111111] text-white border border-[#111111] text-xs font-bold cursor-pointer"
            >
              [{language === "zh" ? "AI 智能提炼考点架构" : "EXTRACT TOPICS WITH AI"}]
            </button>
          </div>
        )}
      </section>



      {/* Document Full Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 font-mono">
          <div className="bg-white max-w-2xl w-full max-h-[85vh] flex flex-col border-2 border-[#111111]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#111111]">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#111111]" />
                <h3 className="text-sm font-bold text-[#111111] truncate uppercase">[{previewDoc.name}]</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 font-mono text-xs text-[#111111] leading-relaxed whitespace-pre-wrap bg-[#fafafa]">
              {previewDoc.content || (language === "zh" ? "无文本内容" : "No content")}
            </div>
            <div className="px-5 py-3 border-t border-[#111111] bg-white flex justify-between items-center text-xs">
              <span className="text-[#666666] font-bold">{previewDoc.sizeBytes ? `${Math.round(previewDoc.sizeBytes / 1024)} KB` : ""}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-bold border border-[#111111] cursor-pointer"
              >
                [{language === "zh" ? "关闭" : "CLOSE"}]
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
