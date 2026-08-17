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

  // AI Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);

  // Modals state
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);
  const [activeQuizMaterial, setActiveQuizMaterial] = useState<StudyMaterial | null>(null);
  const [isAddingTopic, setIsAddingTopic] = useState(false);

  // New topic form
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicWeight, setNewTopicWeight] = useState(15);
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newTopicHours, setNewTopicHours] = useState(4);
  const [newTopicSubtopics, setNewTopicSubtopics] = useState("");

  // Direct Plan Generation settings (Inline / Expandable)
  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerateError, setPlanGenerateError] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

  // Schedule preferences state
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const defaultExamDate = useMemo(() => {
    if (plan?.examDate) return plan.examDate;
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  }, [plan]);

  const [startDate, setStartDate] = useState(plan?.startDate || todayStr);
  const [examDate, setExamDate] = useState(plan?.examDate || defaultExamDate);
  const [examTime, setExamTime] = useState(plan?.examTime || "09:00");
  const [targetScore, setTargetScore] = useState(plan?.preferences?.targetScoreOrGrade || "A (90%+ / 优秀)");
  const [studyPace, setStudyPace] = useState<UserStudyPreferences["studyPace"]>(plan?.preferences?.studyPace || "deep_mastery");
  const [sessionLength, setSessionLength] = useState<number>(plan?.preferences?.sessionLengthMinutes || 45);
  const [includePracticeExams, setIncludePracticeExams] = useState(plan?.preferences?.includePracticeExams ?? true);
  const [includeBufferDays, setIncludeBufferDays] = useState(plan?.preferences?.includeBufferDays ?? true);
  const [bufferDaysCount, setBufferDaysCount] = useState(plan?.preferences?.bufferDaysCount || 2);
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(plan?.preferences?.dailySchedules || DEFAULT_WEEK_SCHEDULE);
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>(
    plan?.preferences?.weakTopicsFocus || topics.filter(t => t.difficulty === "hard").map(t => t.title)
  );

  // Materials list
  const materials: StudyMaterial[] = plan?.materials || INITIAL_SAMPLE_DOCUMENTS;

  // Filtered documents
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.summaryNotes && item.summaryNotes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || item.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [materials, searchQuery, filterType]);

  // Statistics
  const totalWeight = useMemo(() => topics.reduce((acc, t) => acc + (t.weightPercentage || 0), 0), [topics]);
  const totalEstHours = useMemo(() => topics.reduce((acc, t) => acc + (t.estimatedHours || 0), 0), [topics]);
  const daysUntilExam = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(examDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [startDate, examDate]);

  // Sync updated materials back to active plan
  const updatePlanMaterials = (newMaterials: StudyMaterial[]) => {
    if (plan && onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        materials: newMaterials,
      });
    }
  };

  // Upload handler for knowledge base files
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsingDoc(true);
    setExtractError(null);

    const fileArray = Array.from(files);
    let combinedContent = syllabusContent ? syllabusContent + "\n\n" : "";
    const processedNames: string[] = [];
    const newAttachedMaterials: StudyMaterial[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setParsingStatus(
        language === "zh"
          ? `正在解析文档 (${i + 1}/${fileArray.length})：${file.name}...`
          : `Parsing (${i + 1}/${fileArray.length}): ${file.name}...`
      );

      try {
        const parsed = await parseDocumentFile(file, language, (status) => setParsingStatus(status));
        processedNames.push(file.name);
        combinedContent += `\n\n=== 课程知识库文档: ${file.name} ===\n${parsed.text}\n`;

        const isExamFile = file.name.includes("真题") || file.name.includes("试卷") || file.name.includes("Exam") || file.name.includes("Test");
        const docCategory: StudyMaterial["categoryGroup"] = isExamFile
          ? "exam_question"
          : file.name.includes("大纲") || file.name.includes("Syllabus")
          ? "course_syllabus"
          : "study_material";

        const docType: StudyMaterial["type"] = isExamFile
          ? "past_exam"
          : file.name.includes("PPT") || file.name.includes("课件") || file.name.includes("讲义")
          ? "lecture_slides"
          : file.name.includes("提纲") || file.name.includes("大纲")
          ? "textbook_outline"
          : "notes";

        newAttachedMaterials.push({
          id: `mat-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
          name: file.name,
          type: docType,
          categoryGroup: docCategory,
          content: parsed.text,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          summaryNotes: parsed.text.slice(0, 140) + "...",
          difficulty: "medium",
          topicTag: topics[0]?.title || undefined,
        });

        if (!examName && (file.name.includes("大纲") || file.name.includes("syllabus") || i === 0)) {
          onExamNameChange(file.name.replace(/\.[^/.]+$/, "").replace(/大纲|syllabus|期末|考试/i, "").trim() || file.name);
        }
      } catch (err: any) {
        console.error("Document parsing error", err);
      }
    }

    if (processedNames.length > 0) {
      const newDocDisplayName = processedNames.length === 1 
        ? processedNames[0] 
        : `${processedNames.length} 份知识库资料 (${processedNames.slice(0, 2).join(", ")}${processedNames.length > 2 ? " 等" : ""})`;
      
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
      // Even in catch, extract basic fallback so user is never blocked
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
      // If no topics yet, trigger extraction first
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
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#e8f5e9] text-[#2e7d32]">考试大纲</span>;
      case "lecture_slides":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#e3f2fd] text-[#1565c0]">讲义课件</span>;
      case "past_exam":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fce4ec] text-[#c2185b]">历年真题</span>;
      case "textbook_outline":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#fff3e0] text-[#e65100]">教材提纲</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f3e5f5] text-[#7b1fa2]">笔记资料</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header Card */}
      <div className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2">
              <GraduationCap className="w-6 h-6 text-[#2383e2]" />
              <h1 className="text-xl font-semibold text-[#37352f] tracking-tight">
                {examName || (language === "zh" ? "课程知识库与智能规划" : "Course Knowledge Base & Plan")}
              </h1>
              {subject && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#efefed] text-[#5a5a57]">
                  {subject}
                </span>
              )}
            </div>
            <p className="text-xs text-[#787774] leading-relaxed">
              {language === "zh"
                ? "管理当前课程的讲义、大纲、笔记与真题，AI 将基于此知识库自动提炼考点权重并生成自适应复习计划。"
                : "Manage your course syllabus, lecture slides, notes, and past exams. The AI builds a topic blueprint and generates an adaptive study plan."}
            </p>
          </div>

          {/* Direct CTA: Generate / Sync Plan */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleGenerateStudyPlan}
              disabled={isGeneratingPlan || isExtracting}
              className="flex items-center space-x-2 px-4 py-2 bg-[#2383e2] hover:bg-[#1b6dc1] disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
            >
              {isGeneratingPlan ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === "zh" ? "AI 规划生成中..." : "Generating Plan..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>{language === "zh" ? "基于知识库生成/刷新复习规划" : "Generate Plan from Knowledge Base"}</span>
                </>
              )}
            </button>
            {onNavigateToTab && plan?.tasks && plan.tasks.length > 0 && (
              <button
                onClick={() => onNavigateToTab("todo")}
                className="flex items-center space-x-1.5 px-3 py-2 border border-[#d3d3d0] hover:bg-[#f7f6f3] text-[#37352f] rounded-lg text-xs font-medium transition-colors"
              >
                <span>{language === "zh" ? "查看待办清单" : "View To-Dos"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 3-Step Knowledge Pipeline Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-[#f0f0ee]">
          <div className="flex items-center space-x-3 p-2.5 rounded-lg bg-[#fbfbfa] border border-[#efefed]">
            <div className="w-7 h-7 rounded-md bg-[#e3f2fd] text-[#1565c0] flex items-center justify-center font-semibold text-xs shrink-0">
              1
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#37352f] flex items-center space-x-1">
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

          <div className="flex items-center space-x-3 p-2.5 rounded-lg bg-[#fbfbfa] border border-[#efefed]">
            <div className="w-7 h-7 rounded-md bg-[#f3e5f5] text-[#7b1fa2] flex items-center justify-center font-semibold text-xs shrink-0">
              2
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#37352f] flex items-center space-x-1">
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

          <div className="flex items-center space-x-3 p-2.5 rounded-lg bg-[#fbfbfa] border border-[#efefed]">
            <div className="w-7 h-7 rounded-md bg-[#e8f5e9] text-[#2e7d32] flex items-center justify-center font-semibold text-xs shrink-0">
              3
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#37352f] flex items-center space-x-1">
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

      {/* Success / Error Alerts */}
      {planSuccessNotice && (
        <div className="flex items-center space-x-2 p-3.5 bg-[#e8f5e9] border border-[#c8e6c9] text-[#2e7d32] rounded-lg text-xs font-medium animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{language === "zh" ? "已成功依据知识库资料生成/更新复习规划！任务已分配至每日待办与日历日程。" : "Successfully generated adaptive study plan from knowledge base!"}</span>
        </div>
      )}

      {extractionSuccess && (
        <div className="flex items-center space-x-2 p-3.5 bg-[#e3f2fd] border border-[#bbdefb] text-[#1565c0] rounded-lg text-xs font-medium animate-fadeIn">
          <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
          <span>{language === "zh" ? "AI 考点架构已根据知识库资料更新完毕！" : "Topic blueprint successfully extracted from knowledge base!"}</span>
        </div>
      )}

      {extractError && (
        <div className="flex items-center space-x-2 p-3 bg-[#fde8e8] border border-[#f8b4b4] text-[#9b1c1c] rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{extractError}</span>
        </div>
      )}

      {planGenerateError && (
        <div className="flex items-center space-x-2 p-3 bg-[#fde8e8] border border-[#f8b4b4] text-[#9b1c1c] rounded-lg text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{planGenerateError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: 课程知识库资料 (Knowledge Base Documents) */}
      {/* ========================================================================= */}
      <section className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0ee]">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <FolderOpen className="w-4 h-4 text-[#2383e2]" />
              <h2 className="text-base font-semibold text-[#37352f]">
                {language === "zh" ? "1. 课程知识库资料" : "1. Course Knowledge Base"}
              </h2>
              <span className="text-xs text-[#787774]">
                ({materials.length} {language === "zh" ? "份文档" : "documents"})
              </span>
            </div>
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? "支持直接拖拽上传 PDF、Word、PPT 课件、期末真题及笔记，AI 会深度解析全部内容。"
                : "Upload PDF, DOCX, PPT slides, past exams, or paste text notes. The AI analyzes the full text."}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPasteBox(!showPasteBox)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "粘贴文本笔记" : "Paste Notes"}</span>
            </button>
            <button
              onClick={handleLoadSampleKnowledgeBase}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded-lg text-xs font-medium transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{language === "zh" ? "加载示例资料库" : "Load Sample Docs"}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Paste Textarea Box */}
        {showPasteBox && (
          <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "快速录入文本或笔记资料" : "Add Text / Notes to Knowledge Base"}
              </h4>
              <button
                onClick={() => setShowPasteBox(false)}
                className="text-[#787774] hover:text-[#37352f]"
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
                className="px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
              />
              <select
                value={pasteDocType}
                onChange={(e) => setPasteDocType(e.target.value as any)}
                className="px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
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
              className="w-full px-3 py-2 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f] focus:outline-none focus:border-[#2383e2]"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPasteBox(false)}
                className="px-3 py-1.5 text-xs text-[#787774] hover:bg-[#efefed] rounded-md"
              >
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAddPastedDoc}
                disabled={!pasteDocContent.trim()}
                className="px-4 py-1.5 bg-[#2383e2] hover:bg-[#1b6dc1] disabled:opacity-50 text-white text-xs font-medium rounded-md shadow-xs"
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
              ? "border-[#2383e2] bg-[#f0f7ff]"
              : "border-[#d3d3d0] bg-[#fafaf9] hover:bg-[#f5f5f4]"
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
            <div className="w-10 h-10 rounded-full bg-[#efefed] flex items-center justify-center text-[#5a5a57]">
              <Upload className="w-5 h-5 text-[#2383e2]" />
            </div>
            <div>
              <p className="text-xs font-medium text-[#37352f]">
                {language === "zh" ? "点击或拖拽上传课程文件" : "Click or drag & drop files here"}
              </p>
              <p className="text-[11px] text-[#787774] mt-0.5">
                {language === "zh"
                  ? "支持 PDF、Word (.docx)、PPT、Markdown、TXT 格式"
                  : "Supports PDF, Word, PPT slides, Markdown, and TXT files"}
              </p>
            </div>
            {isParsingDoc && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-white border border-[#2383e2]/30 text-[#2383e2] rounded-full text-xs animate-pulse mt-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{parsingStatus || (language === "zh" ? "正在解析文档文本..." : "Parsing file...")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents List */}
        {materials.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-[#37352f]">
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
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    filterType === "all" ? "bg-[#efefed] text-[#37352f]" : "text-[#787774] hover:bg-[#f7f6f3]"
                  }`}
                >
                  {language === "zh" ? "全部" : "All"}
                </button>
                <button
                  onClick={() => setFilterType("syllabus")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    filterType === "syllabus" ? "bg-[#efefed] text-[#37352f]" : "text-[#787774] hover:bg-[#f7f6f3]"
                  }`}
                >
                  {language === "zh" ? "考纲" : "Syllabus"}
                </button>
                <button
                  onClick={() => setFilterType("lecture_slides")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    filterType === "lecture_slides" ? "bg-[#efefed] text-[#37352f]" : "text-[#787774] hover:bg-[#f7f6f3]"
                  }`}
                >
                  {language === "zh" ? "讲义" : "Slides"}
                </button>
                <button
                  onClick={() => setFilterType("past_exam")}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    filterType === "past_exam" ? "bg-[#efefed] text-[#37352f]" : "text-[#787774] hover:bg-[#f7f6f3]"
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
                  className="flex items-start justify-between p-3 bg-[#fbfbfa] border border-[#e9e9e7] hover:border-[#d3d3d0] rounded-lg transition-all"
                >
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-md bg-white border border-[#e9e9e7] flex items-center justify-center text-[#5a5a57] shrink-0 mt-0.5">
                      <FileText className="w-4 h-4 text-[#2383e2]" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-medium text-[#37352f] truncate">
                          {doc.name}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {getDocTypeBadge(doc.type)}
                        <span className="text-[#9b9a97]">
                          {(doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)} KB` : "文本资料")}
                        </span>
                        <span className="text-[#2e7d32] font-medium flex items-center space-x-0.5">
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
                      className="p-1 text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] rounded"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setActiveQuizMaterial(doc)}
                      title={language === "zh" ? "针对该资料出题自测" : "Quiz"}
                      className="p-1 text-[#787774] hover:text-[#2383e2] hover:bg-[#efefed] rounded"
                    >
                      <FileQuestion className="w-3.5 h-3.5 text-[#2383e2]" />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      title={language === "zh" ? "从知识库移除" : "Delete"}
                      className="p-1 text-[#787774] hover:text-[#eb5757] hover:bg-[#efefed] rounded"
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
      {/* SECTION 2: AI 提炼的核心考点架构 (Extracted Topics Blueprint) */}
      {/* ========================================================================= */}
      <section className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0ee]">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-[#9065b0]" />
              <h2 className="text-base font-semibold text-[#37352f]">
                {language === "zh" ? "2. AI 提炼的核心考点架构" : "2. Extracted Topic Blueprint"}
              </h2>
              <span className="text-xs text-[#787774]">
                ({topics.length} {language === "zh" ? "个核心领域" : "topics"})
              </span>
            </div>
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? "AI 会自动综合分析知识库中的所有大纲、讲义和真题，提炼出考点分值占比与难度梯度。"
                : "The AI synthesizes all documents in the knowledge base, calculating topic exam weights and difficulty tiers."}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f3e5f5] hover:bg-[#e1bee7] text-[#7b1fa2] rounded-lg text-xs font-medium transition-colors"
            >
              {isExtracting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === "zh" ? "正在提炼考点..." : "Extracting..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === "zh" ? "从知识库重新提炼" : "Re-extract Topics"}</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAddingTopic(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "添加考点" : "Add Topic"}</span>
            </button>
          </div>
        </div>

        {/* Add Topic Inline Form */}
        {isAddingTopic && (
          <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#37352f]">
                {language === "zh" ? "添加自定义考点" : "Add Custom Topic"}
              </h4>
              <button onClick={() => setIsAddingTopic(false)} className="text-[#787774] hover:text-[#37352f]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={language === "zh" ? "考点名称（如：红黑树平衡推导）" : "Topic title..."}
                className="sm:col-span-2 px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
              />
              <div className="flex items-center space-x-1">
                <span className="text-[11px] text-[#787774] whitespace-nowrap">{language === "zh" ? "权重" : "Weight"}:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(Number(e.target.value))}
                  className="w-16 px-2 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
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
                  className="w-16 px-2 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
                />
                <span className="text-xs text-[#787774]">{language === "zh" ? "小时" : "hrs"}</span>
              </div>
            </div>
            <input
              type="text"
              value={newTopicSubtopics}
              onChange={(e) => setNewTopicSubtopics(e.target.value)}
              placeholder={language === "zh" ? "子知识点列表，逗号分隔（如：插入旋转、删除调整、时间复杂度）" : "Subtopics (comma separated)..."}
              className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
            />
            <div className="flex justify-end space-x-2">
              <button onClick={() => setIsAddingTopic(false)} className="px-3 py-1 text-xs text-[#787774]">
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAddCustomTopic}
                disabled={!newTopicTitle.trim()}
                className="px-4 py-1 bg-[#2383e2] text-white text-xs font-medium rounded-md shadow-xs"
              >
                {language === "zh" ? "确认添加" : "Add"}
              </button>
            </div>
          </div>
        )}

        {/* Topics Cards */}
        {topics.length > 0 ? (
          <div className="space-y-2.5">
            {topics.map((topic, idx) => {
              const diffBadge = topic.difficulty === "hard"
                ? "bg-[#fde8e8] text-[#9b1c1c]"
                : topic.difficulty === "easy"
                ? "bg-[#e8f5e9] text-[#2e7d32]"
                : "bg-[#fff3e0] text-[#e65100]";
              const diffText = topic.difficulty === "hard"
                ? (language === "zh" ? "攻坚考点" : "Hard")
                : topic.difficulty === "easy"
                ? (language === "zh" ? "基础概念" : "Easy")
                : (language === "zh" ? "中等难度" : "Medium");

              return (
                <div
                  key={topic.id || `topic-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] hover:border-[#d3d3d0] rounded-lg gap-3 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#37352f]">
                        {idx + 1}. {topic.title}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${diffBadge}`}>
                        {diffText}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#e3f2fd] text-[#1565c0]">
                        {language === "zh" ? "分值占比" : "Weight"}: {topic.weightPercentage || 20}%
                      </span>
                      <span className="text-[11px] text-[#787774] flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{topic.estimatedHours || 4} {language === "zh" ? "学时" : "hrs"}</span>
                      </span>
                    </div>

                    {/* Subtopics */}
                    {topic.subtopics && topic.subtopics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {topic.subtopics.map((sub, sIdx) => (
                          <span
                            key={sIdx}
                            className="px-2 py-0.5 rounded bg-white border border-[#e9e9e7] text-[11px] text-[#5a5a57]"
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
                      className="p-1 text-[#787774] hover:text-[#eb5757] hover:bg-[#efefed] rounded"
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
          <div className="p-8 text-center bg-[#fafaf9] border border-dashed border-[#d3d3d0] rounded-xl space-y-3">
            <GraduationCap className="w-8 h-8 mx-auto text-[#787774]" />
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? "暂未提炼考点。点击上方「从知识库重新提炼」按钮，AI 将立即解析并生成考点结构。"
                : "No topics extracted yet. Click 'Re-extract Topics' above to parse from knowledge base."}
            </p>
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="px-4 py-2 bg-[#2383e2] text-white rounded-lg text-xs font-medium shadow-xs"
            >
              {language === "zh" ? "AI 智能提炼考点架构" : "Extract Topics with AI"}
            </button>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION 3: 基于知识库生成的复习规划 (Generated Plan & Action Roadmap) */}
      {/* ========================================================================= */}
      <section className="bg-white border border-[#e9e9e7] rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0f0ee]">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#2e7d32]" />
              <h2 className="text-base font-semibold text-[#37352f]">
                {language === "zh" ? "3. 基于知识库生成的个性化复习规划" : "3. AI Study Plan Generated from Knowledge Base"}
              </h2>
            </div>
            <p className="text-xs text-[#787774]">
              {language === "zh"
                ? "依据知识库中提取的考点分值与难度，自动生成的阶段式复习路线与每日任务。"
                : "Multi-phase study schedule and daily tasks generated based on knowledge base weights."}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowPlanSettings(!showPlanSettings)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded-lg text-xs font-medium transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-[#5a5a57]" />
              <span>{language === "zh" ? "调整时间与作息参数" : "Schedule Settings"}</span>
              {showPlanSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleGenerateStudyPlan}
              disabled={isGeneratingPlan}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#2383e2] hover:bg-[#1b6dc1] disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs transition-colors"
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
          <div className="bg-[#fbfbfa] border border-[#e9e9e7] rounded-xl p-4 space-y-4 animate-fadeIn">
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
                  className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
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
                  className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#787774] mb-1">
                  {language === "zh" ? "目标成绩" : "Target Score"}
                </label>
                <select
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
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
                  className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
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
                  className="w-full px-3 py-1.5 bg-white border border-[#d3d3d0] rounded-md text-xs text-[#37352f]"
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
                className="px-4 py-1.5 bg-[#2383e2] text-white rounded-md text-xs font-medium shadow-xs"
              >
                {language === "zh" ? "应用偏好并重新规划" : "Apply & Regenerate"}
              </button>
            </div>
          </div>
        )}

        {/* Plan Highlights & Phase Roadmap */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "备考窗口" : "Study Window"}</span>
            <span className="text-sm font-semibold text-[#37352f] mt-0.5 block">
              {daysUntilExam} {language === "zh" ? "天" : "days"}
            </span>
          </div>

          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "总规划学时" : "Planned Hours"}</span>
            <span className="text-sm font-semibold text-[#37352f] mt-0.5 block">
              {plan?.totalPlannedHours || totalEstHours || 35} {language === "zh" ? "小时" : "hrs"}
            </span>
          </div>

          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "总生成任务" : "Total Tasks"}</span>
            <span className="text-sm font-semibold text-[#37352f] mt-0.5 block">
              {plan?.tasks?.length || 0} {language === "zh" ? "项" : "tasks"}
            </span>
          </div>

          <div className="p-3 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg">
            <span className="text-[11px] text-[#787774] block">{language === "zh" ? "目标等级" : "Target Score"}</span>
            <span className="text-sm font-semibold text-[#2383e2] mt-0.5 block truncate">
              {targetScore}
            </span>
          </div>
        </div>

        {/* Phase Roadmap Visualizer */}
        {plan?.phases && plan.phases.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[#37352f]">
              {language === "zh" ? "备考阶段推进路线" : "Preparation Roadmap"}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plan.phases.map((phase, pIdx) => (
                <div
                  key={phase.id || `phase-${pIdx}`}
                  className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#37352f]">
                      Phase {pIdx + 1}: {phase.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-[#efefed] text-[#5a5a57] rounded">
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
                {language === "zh" ? "已生成的近期备考任务预览" : "Upcoming Tasks Preview"}
              </h4>
              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab("todo")}
                  className="text-xs font-medium text-[#2383e2] hover:underline flex items-center space-x-1"
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
                  className="flex items-center justify-between p-2.5 bg-[#fafaf9] border border-[#e9e9e7] rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${task.status === "completed" ? "bg-[#2e7d32]" : "bg-[#2383e2]"}`} />
                    <span className="text-[#37352f] font-medium truncate">{task.title}</span>
                    <span className="text-[11px] text-[#787774] shrink-0 flex items-center space-x-1">
                      <span>{task.date} · {task.durationMinutes} {language === "zh" ? "分钟" : "mins"}</span>
                    </span>
                  </div>
                  {task.topicTitle && (
                    <span className="text-[10px] px-2 py-0.5 bg-[#efefed] text-[#5a5a57] rounded shrink-0 ml-2">
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
                <FileText className="w-4 h-4 text-[#2383e2]" />
                <h3 className="text-sm font-semibold text-[#37352f] truncate">{previewDoc.name}</h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] rounded"
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
                className="px-4 py-1.5 bg-[#2383e2] text-white rounded-md text-xs font-medium"
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
