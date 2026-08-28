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
import { TabbedFolderArchive } from "./TabbedFolderArchive";
import { UploadModal } from "./UploadModal";
import { NoteModal } from "./NoteModal";
import { DocumentReaderModal } from "./DocumentReaderModal";
import { fallbackExtractSyllabusClient, fallbackGeneratePlanClient } from "../lib/fallbackPlanner";
import { HierarchicalTopicTreeView } from "./HierarchicalTopicTreeView";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [activeFolderDocType, setActiveFolderDocType] = useState<StudyMaterial["type"]>("notes");
  const [pasteDocTitle, setPasteDocTitle] = useState("");
  const [pasteDocType, setPasteDocType] = useState<StudyMaterial["type"]>("notes");
  const [pasteDocContent, setPasteDocContent] = useState("");

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicWeight, setNewTopicWeight] = useState(15);
  const [newTopicDifficulty, setNewTopicDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newTopicHours, setNewTopicHours] = useState(4);
  const [newTopicSubtopics, setNewTopicSubtopics] = useState("");

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

  const [showPlanSettings, setShowPlanSettings] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [planGenerateError, setPlanGenerateError] = useState<string | null>(null);
  const [planSuccessNotice, setPlanSuccessNotice] = useState(false);

  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);
  const [activeQuizMaterial, setActiveQuizMaterial] = useState<StudyMaterial | null>(null);

  const materials: StudyMaterial[] = useMemo(() => {
    if (plan?.materials && plan.materials.length > 0) {
      return plan.materials;
    }
    return [];
  }, [plan?.materials]);

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchType = filterType === "all" || m.type === filterType;
      const matchQuery = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.content.toLowerCase().includes(searchQuery.toLowerCase());
      return matchType && matchQuery;
    });
  }, [materials, filterType, searchQuery]);

  const totalEstHours = useMemo(() => {
    return topics.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  }, [topics]);

  const daysUntilExam = useMemo(() => {
    if (!examDate) return 0;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const [y, m, d] = examDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [examDate]);

  const updatePlanMaterials = (newMaterials: StudyMaterial[]) => {
    if (plan && onUpdatePlan) {
      onUpdatePlan({
        ...plan,
        materials: newMaterials,
        updatedAt: new Date().toISOString(),
      });
    }
  };

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

  const handleDeleteDoc = (docId: string) => {
    const updated = materials.filter((m) => m.id !== docId);
    updatePlanMaterials(updated);
  };

  const handleLoadSampleKnowledgeBase = () => {
    updatePlanMaterials(INITIAL_SAMPLE_DOCUMENTS);
    const combined = INITIAL_SAMPLE_DOCUMENTS.map((d) => `### ${d.name}\n${d.content}`).join("\n\n");
    onSyllabusContentChange(combined);
    onExamNameChange(language === "zh" ? "高级数据结构与算法期末考试" : "CS 301: Advanced Algorithms Final");
    onSubjectChange(language === "zh" ? "计算机科学与工程" : "Computer Science");
  };

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

  const handleDeleteTopic = (topicId: string) => {
    const updated = topics.filter((t) => t.id !== topicId);
    onTopicsChange(updated);
    if (plan && onUpdatePlan) {
      onUpdatePlan({ ...plan, topics: updated });
    }
  };

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

      <section className="space-y-4">
        {/* 1. Main Knowledge Base Archive View */}
        <div className="pt-1">
          <TabbedFolderArchive
            materials={materials}
            onPreviewDoc={(doc) => setPreviewDoc(doc)}
            onQuizDoc={(doc) => setActiveQuizMaterial(doc)}
            onDeleteDoc={(docId) => handleDeleteDoc(docId)}
            onOpenUpload={(folderType) => {
              if (folderType) setActiveFolderDocType(folderType);
              setShowUploadBox(true);
            }}
            onOpenPaste={(folderType) => {
              if (folderType) setActiveFolderDocType(folderType);
              setShowPasteBox(true);
            }}
            onLoadSamples={handleLoadSampleKnowledgeBase}
            onDeleteCourse={(onRequestDeleteCourse || onDeleteCourse) ? () => {
              if (onRequestDeleteCourse) {
                onRequestDeleteCourse(plan);
              } else if (onDeleteCourse) {
                onDeleteCourse();
              }
            } : undefined}
          />
        </div>

        {/* 2. Upload Modal Dialog */}
        <UploadModal
          isOpen={showUploadBox}
          onClose={() => setShowUploadBox(false)}
          currentSyllabusContent={syllabusContent}
          initialType={activeFolderDocType}
          onUploadSuccess={(newAttachedMaterials, combinedContent) => {
            const newDocDisplayName =
              newAttachedMaterials.length === 1
                ? newAttachedMaterials[0].name
                : `${newAttachedMaterials.length} 个资料集合 (${newAttachedMaterials[0].name} 等)`;
            onSyllabusDocNameChange(newDocDisplayName);
            onSyllabusContentChange(combinedContent);
            updatePlanMaterials([...newAttachedMaterials, ...materials]);
          }}
        />

        {/* 3. Note / Text Modal Dialog */}
        <NoteModal
          isOpen={showPasteBox}
          onClose={() => setShowPasteBox(false)}
          initialType={activeFolderDocType}
          onSave={(noteData) => {
            const newDoc: StudyMaterial = {
              id: `mat-paste-${Date.now()}`,
              name: noteData.title,
              type: noteData.type,
              categoryGroup:
                noteData.type === "past_exam"
                  ? "exam_question"
                  : noteData.type === "syllabus"
                  ? "course_syllabus"
                  : "study_material",
              content: noteData.content,
              uploadedAt: new Date().toISOString(),
              sizeBytes: new Blob([noteData.content]).size,
              summaryNotes: noteData.content.slice(0, 150) + "...",
              difficulty: "medium",
            };
            updatePlanMaterials([newDoc, ...materials]);
            onSyllabusContentChange(`${syllabusContent}\n\n=== 知识库: ${noteData.title} ===\n${noteData.content}`);
          }}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-4 h-4 text-[#111111]" />
            <h2 className="text-sm font-bold uppercase text-[#111111]">
              [2. {language === "zh" ? "AI 提炼的考点树状体系" : "TOPIC TREE HIERARCHY"}]
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAddingTopic(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "+ 添加大单元" : "+ ADD UNIT"}]</span>
            </button>
          </div>
        </div>

        {isAddingTopic && (
          <div className="bg-white border border-[#111111] p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase text-[#111111]">
                [{language === "zh" ? "添加自定义大单元与考点树" : "ADD CUSTOM UNIT & TOPICS"}]
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
                placeholder={language === "zh" ? "大单元名称（如：第 6 单元：红黑树平衡推导）" : "Unit title..."}
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
              placeholder={language === "zh" ? "细分考点列表，逗号分隔（如：插入旋转、删除调整、时间复杂度）" : "Subtopics (comma separated)..."}
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
                [{language === "zh" ? "确认添加大单元" : "ADD UNIT"}]
              </button>
            </div>
          </div>
        )}

        <HierarchicalTopicTreeView
          topics={topics}
          language={language}
          editable={true}
          onUpdateTopic={(index, updated) => {
            const updatedTopics = [...topics];
            updatedTopics[index] = { ...updatedTopics[index], ...updated };
            onTopicsChange(updatedTopics);
          }}
          onDeleteTopic={(topicId) => handleDeleteTopic(topicId)}
          onReExtract={handleExtractTopics}
          isExtracting={isExtracting}
        />
      </section>

      <DocumentReaderModal
        doc={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        onLaunchQuiz={(doc) => setActiveQuizMaterial(doc)}
      />

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
