import React, { useState, useMemo } from "react";
import { 
  Plus, 
  GraduationCap, 
  BookOpen, 
  Calendar, 
  Clock, 
  Sparkles, 
  Sliders, 
  Target, 
  BrainCircuit, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  FileText, 
  Trash2, 
  AlertCircle,
  HelpCircle,
  Zap,
  BookmarkPlus,
  Eye,
  X,
  FileQuestion,
  Layers,
  Check
} from "lucide-react";
import { 
  DaySchedulePreference, 
  ExamStudyPlan, 
  StudyMaterial, 
  SyllabusTopic, 
  UserStudyPreferences 
} from "../types";
import { DEFAULT_WEEK_SCHEDULE, SAMPLE_MATERIALS } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { parseDocumentFile } from "../lib/documentParser";
import { fallbackExtractSyllabusClient, fallbackGeneratePlanClient } from "../lib/fallbackPlanner";

interface AddExamSubjectWizardProps {
  onPlanCreated: (newPlan: ExamStudyPlan) => void;
  onCancel: () => void;
  existingPlans: ExamStudyPlan[];
}

const QUICK_SUBJECT_TEMPLATES = [
  {
    name: "高等数学 / 微积分 (Calculus)",
    subject: "数学与应用数学",
    topics: [
      { id: "top-m1", title: "极限与连续性 (Limits & Continuity)", category: "基础理论", weightPercentage: 20, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["无穷小比较", "夹逼准则", "重要极限公式"], estimatedHours: 8 },
      { id: "top-m2", title: "一元函数微分学与导数应用 (Derivatives)", category: "核心运算", weightPercentage: 30, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["中值定理证明", "洛必达法则", "泰勒公式展开", "极值与最值分析"], estimatedHours: 14 },
      { id: "top-m3", title: "一元函数积分学 (Integrals)", category: "计算与应用", weightPercentage: 30, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["换元积分法", "分部积分法", "定积分几何与物理应用"], estimatedHours: 15 },
      { id: "top-m4", title: "常微分方程与级数 (Differential Equations)", category: "综合高阶", weightPercentage: 20, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["一阶齐次/非齐次方程", "二阶常系数方程", "正项级数审敛法"], estimatedHours: 10 },
    ],
  },
  {
    name: "计算机网络与通信协议 (Computer Networks)",
    subject: "计算机科学",
    topics: [
      { id: "top-cn1", title: "物理层与数据链路层 (Physical & Data Link)", category: "底层传输", weightPercentage: 20, difficulty: "easy" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["CSMA/CD 机制", "CRC 校验", "滑动窗口协议"], estimatedHours: 6 },
      { id: "top-cn2", title: "网络层与路由算法 (Network & IP Routing)", category: "核心路由", weightPercentage: 35, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["IP 子网划分与 CIDR", "OSPF 与 BGP 协议", "NAT 与 ICMP 报文"], estimatedHours: 12 },
      { id: "top-cn3", title: "传输层 TCP / UDP 核心机制 (Transport Layer)", category: "核心协议", weightPercentage: 35, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["TCP 三次握手与四次挥手", "拥塞控制四种算法", "流量控制与滑动窗口"], estimatedHours: 14 },
      { id: "top-cn4", title: "应用层与网络安全 (Application & Security)", category: "应用与安全", weightPercentage: 10, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["HTTP/1.1 vs HTTP/2 vs HTTP/3", "DNS 解析机制", "HTTPS 与 TLS 握手"], estimatedHours: 8 },
    ],
  },
  {
    name: "大学英语四六级 / 考研英语 (College English)",
    subject: "外国语言文学",
    topics: [
      { id: "top-en1", title: "高频核心词汇与长难句剖析 (Vocabulary & Syntax)", category: "语言基础", weightPercentage: 25, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["高频动词搭配", "定语从句与同位语从句", "倒装与虚拟语气"], estimatedHours: 15 },
      { id: "top-en2", title: "学术阅读深度理解与题型精析 (Reading Comprehension)", category: "阅读专项", weightPercentage: 40, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["主旨大意题解题技巧", "态度态度与事实细节题", "词义推断与长难句翻译"], estimatedHours: 20 },
      { id: "top-en3", title: "短文写作逻辑与高分句式 (Essay Writing)", category: "输出表达", weightPercentage: 20, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["图表/图画作文结构", "引申论证三段论", "高级衔接词与修辞"], estimatedHours: 10 },
      { id: "top-en4", title: "听力理解与精听训练 (Listening Comprehension)", category: "听觉感知", weightPercentage: 15, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["讲座对话长对话听力", "连读与弱读辨音", "关键信息速记技巧"], estimatedHours: 12 },
    ],
  },
  {
    name: "线性代数与矩阵论 (Linear Algebra)",
    subject: "数学与应用数学",
    topics: [
      { id: "top-la1", title: "行列式与矩阵初等变换 (Determinants & Matrices)", category: "代数基础", weightPercentage: 25, difficulty: "easy" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["行列式展开定理", "逆矩阵计算", "矩阵的秩"], estimatedHours: 8 },
      { id: "top-la2", title: "线性方程组与向量空间 (Linear Systems & Vector Spaces)", category: "核心推导", weightPercentage: 35, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["齐次与非齐次方程组解结构", "向量组线性相关性判定", "基变换与坐标变换"], estimatedHours: 14 },
      { id: "top-la3", title: "特征值、特征向量与相似对角化 (Eigenvalues)", category: "高阶代数", weightPercentage: 25, difficulty: "hard" as const, userKnowledgeLevel: "beginner" as const, subtopics: ["特征多项式求解", "实对称矩阵正交相似对角化", "施密特正交化"], estimatedHours: 12 },
      { id: "top-la4", title: "二次型与正定性判定 (Quadratic Forms)", category: "综合应用", weightPercentage: 15, difficulty: "medium" as const, userKnowledgeLevel: "intermediate" as const, subtopics: ["正交变换化二次型为标准型", "惯性定理", "正定矩阵判别法则"], estimatedHours: 8 },
    ],
  },
];

export function AddExamSubjectWizard({
  onPlanCreated,
  onCancel,
  existingPlans,
}: AddExamSubjectWizardProps) {
  const { t, language } = useI18n();

  // Wizard Step: 1 = Basic Info & Course, 2 = Syllabus & Multi-Documents, 3 = Pacing & Schedule Settings
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Basic Subject Info
  const [examName, setExamName] = useState("");
  const [subject, setSubject] = useState("");
  const [targetScore, setTargetScore] = useState("A (90%+ / 优秀)");

  // Default exam date is 21 days from today
  const defaultExamDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 21);
    return d.toISOString().split("T")[0];
  }, []);

  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [examDate, setExamDate] = useState(defaultExamDate);
  const [examTime, setExamTime] = useState("09:00");

  // Step 2: Multi-Document Repository for this single Course
  const [courseDocuments, setCourseDocuments] = useState<StudyMaterial[]>([]);
  const [pasteDocTitle, setPasteDocTitle] = useState("");
  const [pasteDocType, setPasteDocType] = useState<StudyMaterial["type"]>("notes");
  const [pasteDocContent, setPasteDocContent] = useState("");
  const [showPasteForm, setShowPasteForm] = useState(false);

  // Topics & AI Extraction
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");
  const [extractError, setExtractError] = useState<string | null>(null);

  // Document preview modal
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  // Step 3: Preferences & RAG Needs
  const [studyPace, setStudyPace] = useState<UserStudyPreferences["studyPace"]>("deep_mastery");
  const [sessionLength, setSessionLength] = useState<number>(45);
  const [includePracticeExams, setIncludePracticeExams] = useState(true);
  const [includeBufferDays, setIncludeBufferDays] = useState(true);
  const [bufferDaysCount, setBufferDaysCount] = useState(2);
  const [dailySchedules, setDailySchedules] = useState<DaySchedulePreference[]>(DEFAULT_WEEK_SCHEDULE);
  const [selectedWeakTopics, setSelectedWeakTopics] = useState<string[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [userNeedFocusArea, setUserNeedFocusArea] = useState("heavy_calculation");
  const [customPromptRequirement, setCustomPromptRequirement] = useState("");

  // Final Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Apply Quick Template
  const handleApplyTemplate = (tmpl: typeof QUICK_SUBJECT_TEMPLATES[0]) => {
    setExamName(tmpl.name);
    setSubject(tmpl.subject);
    setTopics(tmpl.topics);
    setSelectedWeakTopics(tmpl.topics.filter(t => t.difficulty === "hard").map(t => t.title));
  };

  // Helper to determine document type and category group from filename
  const inferDocumentType = (fileName: string): { type: StudyMaterial["type"]; categoryGroup: StudyMaterial["categoryGroup"] } => {
    const lower = fileName.toLowerCase();
    if (lower.includes("大纲") || lower.includes("syllabus") || lower.includes("curriculum") || lower.includes("考纲")) {
      return { type: "syllabus", categoryGroup: "course_syllabus" };
    }
    if (lower.includes("真题") || lower.includes("试卷") || lower.includes("exam") || lower.includes("quiz") || lower.includes("test") || lower.includes("paper")) {
      return { type: "past_exam", categoryGroup: "exam_question" };
    }
    if (lower.includes("讲义") || lower.includes("课件") || lower.includes("slide") || lower.includes("ppt") || lower.includes("lecture")) {
      return { type: "lecture_slides", categoryGroup: "study_material" };
    }
    if (lower.includes("公式") || lower.includes("提纲") || lower.includes("cheat") || lower.includes("summary") || lower.includes("速查")) {
      return { type: "textbook_outline", categoryGroup: "study_material" };
    }
    return { type: "notes", categoryGroup: "study_material" };
  };

  // Handle uploading multiple files for THIS course
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsingFiles(true);
    setExtractError(null);

    const fileArray = Array.from(files);
    const newDocs: StudyMaterial[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setParsingStatus(
        language === "zh"
          ? `正在解析 (${i + 1}/${fileArray.length})：${file.name}...`
          : `Parsing (${i + 1}/${fileArray.length}): ${file.name}...`
      );

      try {
        const parsed = await parseDocumentFile(file, language, (status) => setParsingStatus(status));
        const { type, categoryGroup } = inferDocumentType(file.name);

        const newDoc: StudyMaterial = {
          id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type,
          categoryGroup,
          content: parsed.text,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          difficulty: type === "past_exam" ? "hard" : "medium",
          summaryNotes: parsed.text.slice(0, 160) + (parsed.text.length > 160 ? "..." : ""),
        };

        newDocs.push(newDoc);

        // If examName is empty and this is the first file/syllabus, suggest course name
        if (!examName && (type === "syllabus" || i === 0)) {
          const suggested = file.name.replace(/\.[^/.]+$/, "").replace(/大纲|syllabus|期末|考试|试卷|讲义/i, "").trim();
          if (suggested) {
            setExamName(suggested);
          }
        }
      } catch (err: any) {
        console.error("Failed to parse file:", file.name, err);
      }
    }

    if (newDocs.length > 0) {
      setCourseDocuments((prev) => [...prev, ...newDocs]);
    }

    setIsParsingFiles(false);
    setParsingStatus("");
  };

  // Handle manually adding pasted text as a document for this course
  const handleAddPastedDocument = () => {
    if (!pasteDocContent.trim()) return;

    const { categoryGroup } = inferDocumentType(pasteDocTitle || "notes.txt");
    const newDoc: StudyMaterial = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: pasteDocTitle.trim() || `${language === "zh" ? "学习笔记与考点提纲" : "Course Notes"} (${new Date().toLocaleDateString()})`,
      type: pasteDocType,
      categoryGroup: pasteDocType === "syllabus" ? "course_syllabus" : pasteDocType === "past_exam" ? "exam_question" : "study_material",
      content: pasteDocContent.trim(),
      uploadedAt: new Date().toISOString(),
      sizeBytes: new Blob([pasteDocContent]).size,
      difficulty: "medium",
      summaryNotes: pasteDocContent.slice(0, 160) + "...",
    };

    setCourseDocuments((prev) => [...prev, newDoc]);
    setPasteDocTitle("");
    setPasteDocContent("");
    setShowPasteForm(false);
  };

  // Update a document's classification or role in this course
  const handleUpdateDocument = (id: string, patch: Partial<StudyMaterial>) => {
    setCourseDocuments((prev) =>
      prev.map((doc) => {
        if (doc.id === id) {
          const updated = { ...doc, ...patch };
          if (patch.type) {
            updated.categoryGroup =
              patch.type === "syllabus"
                ? "course_syllabus"
                : patch.type === "past_exam"
                ? "exam_question"
                : "study_material";
          }
          return updated;
        }
        return doc;
      })
    );
  };

  // Delete a document from this course
  const handleDeleteDocument = (id: string) => {
    setCourseDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // AI Multi-Document Syllabus & Topic Extraction
  const handleExtractSyllabus = async () => {
    if (courseDocuments.length === 0) {
      setExtractError(language === "zh" ? "请先上传至少一份课程考纲、讲义或试卷文件。" : "Please upload at least one course document first.");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/extract-syllabus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            materials: courseDocuments,
            examName: examName || "新考试科目",
            subject: subject || "综合学科",
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network error during syllabus extraction:", fetchErr);
      }

      if (!data || !data.topics || data.topics.length === 0) {
        data = fallbackExtractSyllabusClient(courseDocuments, examName || "新考试科目", subject || "综合学科", language);
      }

      if (data.topics && Array.isArray(data.topics) && data.topics.length > 0) {
        setTopics(data.topics);
        setSelectedWeakTopics(data.topics.filter((t: any) => t.difficulty === "hard").map((t: any) => t.title));
      }
    } catch (err: any) {
      console.error("Extraction error handled:", err);
      const fallback = fallbackExtractSyllabusClient(courseDocuments, examName || "新考试科目", subject || "综合学科", language);
      setTopics(fallback.topics);
      setSelectedWeakTopics(fallback.topics.filter((t: any) => t.difficulty === "hard").map((t: any) => t.title));
    } finally {
      setIsExtracting(false);
    }
  };

  // Update specific topic
  const handleUpdateTopic = (id: string, patch: Partial<SyllabusTopic>) => {
    setTopics((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  // Add custom topic
  const handleAddCustomTopic = () => {
    const newTopic: SyllabusTopic = {
      id: `topic-custom-${Date.now()}`,
      title: language === "zh" ? "新增核心考点" : "New Core Topic",
      category: subject || (language === "zh" ? "主干模块" : "Core Module"),
      description: language === "zh" ? "核心公式推导、定义掌握与典型例题演练。" : "Key formulas, definitions, and problem drills.",
      weightPercentage: 25,
      difficulty: "medium",
      userKnowledgeLevel: "intermediate",
      subtopics: [language === "zh" ? "重点知识梳理" : "Key Concept Review", language === "zh" ? "典型题型精析" : "Sample Problems"],
      estimatedHours: 6,
    };
    setTopics([...topics, newTopic]);
  };

  // Delete topic
  const handleDeleteTopic = (id: string) => {
    setTopics((prev) => prev.filter((t) => t.id !== id));
  };

  // Generate Plan Handler: attaches all course documents to newPlan.materials
  const handleGenerateFinalPlan = async () => {
    if (!examName.trim()) {
      setGenerateError(language === "zh" ? "请输入考试科目名称。" : "Please enter the exam name.");
      setStep(1);
      return;
    }
    if (topics.length === 0) {
      setGenerateError(language === "zh" ? "请至少添加或提取一个考点模块。" : "Please add at least one topic.");
      setStep(2);
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    const preferences: UserStudyPreferences = {
      examName,
      subject: subject || (language === "zh" ? "通用学科" : "General"),
      examDate,
      examTime,
      startDate,
      targetScoreOrGrade: targetScore,
      dailySchedules,
      studyPace,
      sessionLengthMinutes: sessionLength,
      includePracticeExams,
      includeBufferDays,
      bufferDaysCount,
      weakTopicsFocus: selectedWeakTopics,
      userNeedFocusArea,
      customPromptRequirement,
      additionalNotes,
    };

    const materialsSummaryText = courseDocuments.length > 0
      ? courseDocuments.map(d => `${d.name} (${d.type})`).join("、")
      : examName;

    try {
      let data: any = null;
      try {
        const res = await fetch("/api/generate-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topics,
            preferences,
            materials: courseDocuments,
            materialsSummary: materialsSummaryText,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network error during plan generation:", fetchErr);
      }

      if (!data || !data.tasks || data.tasks.length === 0) {
        data = fallbackGeneratePlanClient(topics, preferences);
      }

      const newPlanId = `plan-${Date.now()}`;
      const generatedTasks = data.tasks || [];
      const totalHours = Math.round(
        generatedTasks.reduce((acc: number, t: any) => acc + (t.durationMinutes || 0), 0) / 60
      ) || 20;

      const newPlan: ExamStudyPlan = {
        id: newPlanId,
        examName,
        subject: subject || (language === "zh" ? "通用学科" : "General"),
        examDate,
        examTime,
        startDate,
        totalPlannedHours: totalHours,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preferences,
        topics,
        materials: courseDocuments,
        phases: data.phases || [],
        tasks: generatedTasks,
        materialsSummary: data.summary || materialsSummaryText,
      };

      onPlanCreated(newPlan);
    } catch (err: any) {
      console.error("Plan creation fallback handling:", err);
      const safeData = fallbackGeneratePlanClient(topics, preferences);
      const newPlan: ExamStudyPlan = {
        id: `plan-${Date.now()}`,
        examName,
        subject: subject || "通用学科",
        examDate,
        examTime,
        startDate,
        totalPlannedHours: safeData.totalPlannedHours || 25,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        preferences,
        topics,
        materials: courseDocuments,
        phases: safeData.phases,
        tasks: safeData.tasks,
        materialsSummary: materialsSummaryText,
      };
      onPlanCreated(newPlan);
    } finally {
      setIsGenerating(false);
    }
  };

  const daysDiff = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(examDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [startDate, examDate]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 selection:bg-[#cce2ff]">
      {/* Top Banner Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e9e9e7] mb-6">
        <button
          onClick={onCancel}
          className="flex items-center space-x-1.5 text-xs text-[#787774] hover:text-[#37352f] px-2.5 py-1 rounded hover:bg-[#efefed] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === "zh" ? "返回现有备考计划" : "Back to current plan"}</span>
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#787774]">{language === "zh" ? "已有科目" : "Existing subjects"}:</span>
          <span className="font-semibold text-[#37352f] bg-[#efefed] px-2 py-0.5 rounded">
            {existingPlans.length} {language === "zh" ? "门" : "courses"}
          </span>
        </div>
      </div>

      {/* Main Header */}
      <div className="mb-6">
        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-[#f0f7f5] text-[#2b78a0] text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{language === "zh" ? "全新考试科目与智能备考规划" : "New Exam Subject & AI Study Optimization"}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#37352f] flex items-center space-x-2">
          <Plus className="w-6 h-6 text-[#37352f]" />
          <span>{language === "zh" ? "添加新考试科目" : "Add Exam Subject"}</span>
        </h1>
        <p className="text-sm text-[#787774] mt-1">
          {language === "zh"
            ? "为新学科输入考期与目标、上传考纲或选择预设模板，AI 将为您生成专属自适应复习日历与每日待办。"
            : "Set up a new subject, import syllabus topics, and let AI generate an adaptive day-by-day study roadmap."}
        </p>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 mb-8 text-xs font-medium border-b border-[#e9e9e7] pb-3">
        <button
          onClick={() => setStep(1)}
          className={`flex items-center space-x-2 py-1.5 px-3 rounded-md transition-colors ${
            step === 1 ? "bg-[#37352f] text-white shadow-xs" : "text-[#787774] hover:bg-[#efefed]"
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">1</span>
          <span className="truncate">{language === "zh" ? "科目与考试信息" : "1. Subject & Target"}</span>
        </button>

        <button
          onClick={() => {
            if (!examName.trim()) {
              setGenerateError(language === "zh" ? "请先输入考试科目名称" : "Please enter exam name first");
              return;
            }
            setStep(2);
          }}
          className={`flex items-center space-x-2 py-1.5 px-3 rounded-md transition-colors ${
            step === 2 ? "bg-[#37352f] text-white shadow-xs" : "text-[#787774] hover:bg-[#efefed]"
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">2</span>
          <span className="truncate">{language === "zh" ? "考纲与多文件资料" : "2. Syllabus & Documents"}</span>
        </button>

        <button
          onClick={() => {
            if (!examName.trim()) {
              setStep(1);
              return;
            }
            if (topics.length === 0) {
              setStep(2);
              return;
            }
            setStep(3);
          }}
          className={`flex items-center space-x-2 py-1.5 px-3 rounded-md transition-colors ${
            step === 3 ? "bg-[#37352f] text-white shadow-xs" : "text-[#787774] hover:bg-[#efefed]"
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold">3</span>
          <span className="truncate">{language === "zh" ? "作息偏好与计划生成" : "3. Pacing & Generate"}</span>
        </button>
      </div>

      {/* Error alert banner */}
      {generateError && (
        <div className="mb-6 p-3 rounded-lg bg-[#fbf3f2] border border-[#f5d5d3] text-[#d44c47] text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{generateError}</span>
          </div>
          <button onClick={() => setGenerateError(null)} className="text-xs hover:underline">
            {language === "zh" ? "关闭" : "Dismiss"}
          </button>
        </div>
      )}

      {/* ================= STEP 1: SUBJECT & EXAM INFO ================= */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Quick Subject Presets */}
          <div className="bg-[#f7f6f3] p-4 rounded-xl border border-[#e9e9e7]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                <BookmarkPlus className="w-4 h-4 text-[#2b78a0]" />
                <span>{language === "zh" ? "快速载入经典科目模板" : "Quick Subject Presets"}</span>
              </span>
              <span className="text-[11px] text-[#787774]">
                {language === "zh" ? "一键预填科目、学科领域与核心考纲" : "Preload course details & topics"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_SUBJECT_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-3 bg-white hover:bg-[#f0f7f5] border border-[#e9e9e7] hover:border-[#2b78a0] rounded-lg text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#37352f] group-hover:text-[#2b78a0]">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#efefed] text-[#787774]">
                      {tmpl.topics.length} {language === "zh" ? "个考点" : "topics"}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#787774] block mt-1">
                    {tmpl.subject}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-white p-5 rounded-xl border border-[#e9e9e7] space-y-4">
            <h3 className="text-sm font-bold text-[#37352f] flex items-center space-x-2 border-b border-[#e9e9e7] pb-2.5">
              <GraduationCap className="w-4 h-4 text-[#2b78a0]" />
              <span>{language === "zh" ? "考试基本信息" : "Course & Exam Details"}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "考试科目 / 课程全称 *" : "Exam / Course Name *"}
                </label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder={language === "zh" ? "例如：微积分期末考试 / 考研数学" : "e.g. Calculus II Final Exam"}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] focus:ring-1 focus:ring-[#2b78a0] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "学科 / 专业领域" : "Subject Domain"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={language === "zh" ? "例如：数学、计算机、外语、金融" : "e.g. Mathematics, Computer Science"}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] focus:ring-1 focus:ring-[#2b78a0] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "计划开始日期" : "Start Date"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "目标考试日期与时间" : "Exam Date & Time"}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-2/3 px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] outline-none"
                  />
                  <input
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-1/3 px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "目标期望成绩 / 评级" : "Target Score / Grade"}
                </label>
                <input
                  type="text"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  placeholder="例如：90+ / A+ / 稳过 85 分"
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] focus:border-[#2b78a0] outline-none"
                />
              </div>

              <div className="flex items-center">
                <div className="p-3 bg-[#f0f7f5] rounded-lg border border-[#d3e5df] text-xs text-[#2b78a0] w-full">
                  <span className="font-semibold">{language === "zh" ? "备考周期计算：" : "Study Duration: "}</span>
                  <span>{daysDiff} {language === "zh" ? "天" : "days"} (约 {Math.ceil(daysDiff / 7)} {language === "zh" ? "周" : "weeks"})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action to Step 2 */}
          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                if (!examName.trim()) {
                  setGenerateError(language === "zh" ? "请输入考试科目名称" : "Please enter the exam name");
                  return;
                }
                setStep(2);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#37352f] text-white hover:bg-[#201f1d] font-semibold text-xs transition-colors"
            >
              <span>{language === "zh" ? "下一步：上传课程资料与考纲" : "Next: Course Documents & Syllabus"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: COURSE DOCUMENTS & TOPICS ================= */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Multi-Document Upload & Management Card for this Course */}
          <div className="bg-white p-5 rounded-xl border border-[#e9e9e7] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e9e9e7] pb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#37352f] flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-[#2b78a0]" />
                  <span>{language === "zh" ? `「${examName || "当前课程"}」的备考资料与考纲` : `Course Materials for "${examName || "Course"}"`}</span>
                </h3>
                <p className="text-xs text-[#787774] mt-0.5">
                  {language === "zh"
                    ? "可一次性批量上传或持续添加属于本门课程的大纲、讲义课件、模拟试卷等多个文件，AI 将联合深度解析。"
                    : "Upload multiple files (syllabus, lecture slides, mock exams) for this single course."}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPasteForm(!showPasteForm)}
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-md border border-[#e9e9e7] hover:bg-[#efefed] text-xs text-[#37352f] transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === "zh" ? "粘贴文本资料" : "Paste Text"}</span>
                </button>
              </div>
            </div>

            {/* Optional Manual Paste Form */}
            {showPasteForm && (
              <div className="p-4 bg-[#fafaf9] rounded-lg border border-[#e9e9e7] space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#37352f]">
                    {language === "zh" ? "添加自定义文本 / 笔记到本课程" : "Add Text Notes to this Course"}
                  </span>
                  <button onClick={() => setShowPasteForm(false)} className="text-[#787774] hover:text-[#37352f]">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={pasteDocTitle}
                    onChange={(e) => setPasteDocTitle(e.target.value)}
                    placeholder={language === "zh" ? "资料名称，例如：第3章核心公式速记" : "Document title..."}
                    className="px-3 py-1.5 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none"
                  />
                  <select
                    value={pasteDocType}
                    onChange={(e) => setPasteDocType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none"
                  >
                    <option value="syllabus">{language === "zh" ? "课程教学大纲 (Syllabus)" : "Syllabus"}</option>
                    <option value="lecture_slides">{language === "zh" ? "课件讲义 (Lecture Slides)" : "Lecture Slides"}</option>
                    <option value="notes">{language === "zh" ? "课程笔记 (Study Notes)" : "Notes"}</option>
                    <option value="past_exam">{language === "zh" ? "模拟试卷 / 真题 (Exam Paper)" : "Exam Paper"}</option>
                    <option value="textbook_outline">{language === "zh" ? "考点提纲 / 速查 (Cheat Sheet)" : "Outline"}</option>
                  </select>
                </div>
                <textarea
                  rows={4}
                  value={pasteDocContent}
                  onChange={(e) => setPasteDocContent(e.target.value)}
                  placeholder={language === "zh" ? "直接粘贴大纲章节、知识要点或典型题目..." : "Paste outline, topics or problems..."}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#d3d2cf] rounded-md outline-none font-mono"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowPasteForm(false)}
                    className="px-3 py-1 text-xs text-[#787774] hover:bg-[#efefed] rounded"
                  >
                    {language === "zh" ? "取消" : "Cancel"}
                  </button>
                  <button
                    onClick={handleAddPastedDocument}
                    disabled={!pasteDocContent.trim()}
                    className="px-3 py-1 text-xs bg-[#2b78a0] text-white rounded font-medium disabled:opacity-50"
                  >
                    {language === "zh" ? "加入本课程资料库" : "Add to Course"}
                  </button>
                </div>
              </div>
            )}

            {/* Drag & Drop Multi-file Uploader */}
            <label className="border-2 border-dashed border-[#e9e9e7] hover:border-[#2b78a0] bg-[#fafaf9] hover:bg-[#f0f7f5] rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center group">
              <input
                type="file"
                multiple
                accept=".txt,.md,.doc,.docx,.pdf,.rtf,image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-11 h-11 rounded-full bg-white shadow-xs border border-[#e9e9e7] flex items-center justify-center text-[#2b78a0] mb-2 group-hover:scale-110 transition-transform">
                {isParsingFiles ? (
                  <div className="w-5 h-5 border-2 border-[#2b78a0] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs font-semibold text-[#37352f]">
                {isParsingFiles
                  ? (parsingStatus || (language === "zh" ? "正在批量解析文件..." : "Parsing files..."))
                  : (language === "zh" ? "点击或拖拽上传多个课程文件（支持多选）" : "Click or drag multiple course files")}
              </span>
              <span className="text-[11px] text-[#787774] mt-1">
                {language === "zh"
                  ? "支持 PDF、Word (.docx)、TXT、Markdown，单门课程可同时包含大纲、讲义、真题等多个文件"
                  : "Supports PDF, Word (.docx), TXT, Markdown. All files belong to this course."}
              </span>
            </label>

            {/* List of uploaded course documents */}
            {courseDocuments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#37352f]">
                  <span className="flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-[#2b78a0]" />
                    <span>{language === "zh" ? `本课程已包含 ${courseDocuments.length} 份文件资料：` : `Attached files for this course (${courseDocuments.length}):`}</span>
                  </span>
                  <span className="text-[11px] text-[#787774] font-normal">
                    {language === "zh" ? "可修改文档类型以指导 AI 专项分析" : "Change document role for tailored AI analysis"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {courseDocuments.map((doc, idx) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-[#fafaf9] hover:bg-[#f7f6f3] border border-[#e9e9e7] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded bg-white border border-[#e9e9e7] flex items-center justify-center text-xs shrink-0 text-[#787774]">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-xs text-[#37352f] truncate">{doc.name}</span>
                            {doc.sizeBytes && (
                              <span className="text-[10px] text-[#787774] shrink-0">
                                ({Math.round(doc.sizeBytes / 1024)} KB)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#787774] block truncate">
                            {doc.content.slice(0, 80)}... ({doc.content.length} {language === "zh" ? "字" : "chars"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <select
                          value={doc.type}
                          onChange={(e) => handleUpdateDocument(doc.id, { type: e.target.value as any })}
                          className="text-[11px] px-2 py-1 bg-white border border-[#d3d2cf] rounded text-[#37352f] outline-none font-medium"
                        >
                          <option value="syllabus">{language === "zh" ? "课程教学大纲" : "Syllabus"}</option>
                          <option value="lecture_slides">{language === "zh" ? "讲义课件/PPT" : "Lecture Slides"}</option>
                          <option value="notes">{language === "zh" ? "课程笔记" : "Study Notes"}</option>
                          <option value="past_exam">{language === "zh" ? "历年真题/试卷" : "Past Exam"}</option>
                          <option value="textbook_outline">{language === "zh" ? "公式提纲速查" : "Cheat Sheet"}</option>
                        </select>

                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1.5 text-[#787774] hover:text-[#2b78a0] hover:bg-white rounded transition-colors"
                          title={language === "zh" ? "预览文档内容" : "Preview Document Content"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 text-[#787774] hover:text-[#d44c47] hover:bg-white rounded transition-colors"
                          title={language === "zh" ? "从本课程移除" : "Remove from course"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Extraction Button */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleExtractSyllabus}
                disabled={isExtracting || courseDocuments.length === 0}
                className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-[#2b78a0] hover:bg-[#236384] disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-2xs"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{language === "zh" ? "AI 正在联合解析全部文件并提炼考纲架构..." : "Extracting topics from all documents..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {language === "zh"
                        ? `AI 联合提炼考点与权重 (${courseDocuments.length} 份文件)`
                        : `Extract Topics with AI (${courseDocuments.length} files)`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Topics Table */}
          <div className="bg-white p-5 rounded-xl border border-[#e9e9e7] space-y-4">
            <div className="flex items-center justify-between border-b border-[#e9e9e7] pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#37352f]">
                  {language === "zh" ? "结构化考点与分值架构" : "Structured Topic Breakdown"}
                </h3>
                <span className="text-xs text-[#787774]">
                  {language === "zh" ? `已生成 ${topics.length} 个核心知识模块` : `${topics.length} topics defined`}
                </span>
              </div>

              <button
                onClick={handleAddCustomTopic}
                className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#efefed] hover:bg-[#e3e2e0] text-xs font-medium text-[#37352f] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{language === "zh" ? "添加考点" : "Add Topic"}</span>
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="text-center py-8 text-[#787774] text-xs">
                <BookOpen className="w-8 h-8 mx-auto text-[#d3d2cf] mb-2" />
                <p>{language === "zh" ? "暂无考点，请上传课程文件后点击「AI 联合提炼考点」或手动添加。" : "No topics yet. Upload course files and extract topics."}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((t, idx) => (
                  <div key={t.id} className="p-3.5 rounded-lg border border-[#e9e9e7] hover:border-[#d3d2cf] bg-[#fafaf9] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0 mr-3">
                        <span className="w-5 h-5 rounded-full bg-[#efefed] text-[#37352f] text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={t.title}
                          onChange={(e) => handleUpdateTopic(t.id, { title: e.target.value })}
                          className="font-semibold text-xs text-[#37352f] bg-transparent border-b border-transparent hover:border-[#d3d2cf] focus:border-[#2b78a0] outline-none flex-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <select
                          value={t.difficulty}
                          onChange={(e) => handleUpdateTopic(t.id, { difficulty: e.target.value as any })}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border outline-none ${
                            t.difficulty === "hard"
                              ? "bg-[#fbf3f2] text-[#d44c47] border-[#f5d5d3]"
                              : t.difficulty === "medium"
                              ? "bg-[#faece3] text-[#cb912f] border-[#f7ddc9]"
                              : "bg-[#edf3ec] text-[#448361] border-[#d5e5d3]"
                          }`}
                        >
                          <option value="easy">{language === "zh" ? "基础 (Easy)" : "Easy"}</option>
                          <option value="medium">{language === "zh" ? "中等 (Medium)" : "Medium"}</option>
                          <option value="hard">{language === "zh" ? "难点 (Hard)" : "Hard"}</option>
                        </select>

                        <div className="flex items-center space-x-1 text-xs text-[#787774]">
                          <input
                            type="number"
                            value={t.estimatedHours}
                            onChange={(e) => handleUpdateTopic(t.id, { estimatedHours: Number(e.target.value) || 1 })}
                            className="w-12 px-1 py-0.5 text-center text-xs bg-white border border-[#d3d2cf] rounded"
                          />
                          <span>{language === "zh" ? "学时" : "hrs"}</span>
                        </div>

                        <button
                          onClick={() => handleDeleteTopic(t.id)}
                          className="p-1 text-[#787774] hover:text-[#d44c47] hover:bg-[#efefed] rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#787774]">
                      <input
                        type="text"
                        value={t.description || ""}
                        onChange={(e) => handleUpdateTopic(t.id, { description: e.target.value })}
                        placeholder={language === "zh" ? "考点概述与学习目标..." : "Topic summary..."}
                        className="w-full bg-transparent border-b border-transparent hover:border-[#e9e9e7] focus:border-[#2b78a0] outline-none text-xs text-[#5a5a57]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-[#e9e9e7] hover:bg-[#efefed] text-xs font-semibold text-[#37352f]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "上一步" : "Back"}</span>
            </button>

            <button
              onClick={() => {
                if (topics.length === 0) {
                  setGenerateError(language === "zh" ? "请至少配置一个考点" : "Please configure at least one topic");
                  return;
                }
                setStep(3);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#37352f] text-white hover:bg-[#201f1d] font-semibold text-xs transition-colors"
            >
              <span>{language === "zh" ? "下一步：复习节奏与作息" : "Next: Pacing & Schedule"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: PACING & SCHEDULE PREFERENCES ================= */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#e9e9e7] space-y-4">
            <h3 className="text-sm font-bold text-[#37352f] flex items-center space-x-2 border-b border-[#e9e9e7] pb-2.5">
              <Sliders className="w-4 h-4 text-[#2b78a0]" />
              <span>{language === "zh" ? "复习节奏与智能算法设置" : "Study Pacing & Optimization Strategy"}</span>
            </h3>

            {/* Attached Documents Summary */}
            <div className="p-3 bg-[#f7f6f3] rounded-lg border border-[#e9e9e7] flex items-center justify-between text-xs">
              <span className="text-[#787774]">
                {language === "zh" ? "已关联课程资料：" : "Linked Course Documents: "}
                <span className="font-semibold text-[#37352f]">{courseDocuments.length} {language === "zh" ? "份文件" : "files"}</span>
              </span>
              <span className="text-[#787774]">
                {language === "zh" ? "核心考点数：" : "Total Topics: "}
                <span className="font-semibold text-[#37352f]">{topics.length} {language === "zh" ? "个" : "units"}</span>
              </span>
            </div>

            {/* Study Pacing Mode */}
            <div>
              <label className="block text-xs font-semibold text-[#37352f] mb-2">
                {language === "zh" ? "学习节奏模式 (Pacing Archetype)" : "Study Pacing Archetype"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  {
                    id: "deep_mastery",
                    nameZh: "深度精通 (Deep Mastery)",
                    descZh: "概念推导 + 典型题 + 艾宾浩斯主动回忆",
                  },
                  {
                    id: "balanced",
                    nameZh: "匀速稳健 (Balanced Steady)",
                    descZh: "标准课时推进，兼顾理论与模拟习题",
                  },
                  {
                    id: "intensive_crash",
                    nameZh: "高强度冲刺 (Intensive Crash)",
                    descZh: "聚焦高频必考真题与核心公式突击",
                  },
                  {
                    id: "spaced_repetition",
                    nameZh: "间隔重复记忆 (Spaced Drills)",
                    descZh: "多轮次螺旋式检索，强化长效记忆",
                  },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setStudyPace(p.id as any)}
                    className={`p-3 rounded-lg text-left border transition-all ${
                      studyPace === p.id
                        ? "bg-[#f0f7f5] border-[#2b78a0] text-[#37352f] shadow-xs"
                        : "bg-white border-[#e9e9e7] hover:bg-[#fafaf9] text-[#787774]"
                    }`}
                  >
                    <span className="block font-semibold text-xs text-[#37352f] mb-1">
                      {p.nameZh}
                    </span>
                    <span className="text-[10px] block leading-snug">
                      {p.descZh}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Session Length & Strategic Milestones */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "单次专注块时长" : "Session Duration"}
                </label>
                <select
                  value={sessionLength}
                  onChange={(e) => setSessionLength(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] bg-white outline-none"
                >
                  <option value={25}>25 {language === "zh" ? "分钟 (标准番茄钟)" : "min (Pomodoro)"}</option>
                  <option value={45}>45 {language === "zh" ? "分钟 (高校标准课时)" : "min (Standard)"}</option>
                  <option value={60}>60 {language === "zh" ? "分钟 (深度攻坚)" : "min (Deep Work)"}</option>
                  <option value={90}>90 {language === "zh" ? "分钟 (全真模考大块)" : "min (Mock Block)"}</option>
                </select>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 text-xs font-semibold text-[#37352f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePracticeExams}
                    onChange={(e) => setIncludePracticeExams(e.target.checked)}
                    className="rounded text-[#2b78a0] focus:ring-0 w-4 h-4"
                  />
                  <span>{language === "zh" ? "智能穿插全真阶段模考" : "Schedule Mock Exams"}</span>
                </label>
              </div>

              <div className="flex items-center">
                <label className="flex items-center space-x-2 text-xs font-semibold text-[#37352f] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeBufferDays}
                    onChange={(e) => setIncludeBufferDays(e.target.checked)}
                    className="rounded text-[#2b78a0] focus:ring-0 w-4 h-4"
                  />
                  <span>{language === "zh" ? "预留考前缓冲与查漏日" : "Include Buffer Days"}</span>
                </label>
              </div>
            </div>

            {/* RAG Personalized User Need & Task Allocation Focus */}
            <div className="pt-2 border-t border-[#e9e9e7] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#37352f] flex items-center space-x-1.5">
                  <BrainCircuit className="w-3.5 h-3.5 text-[#2b78a0]" />
                  <span>{language === "zh" ? "AI RAG 资料检索与个性化任务分配偏好" : "AI RAG Task Allocation Priority"}</span>
                </label>
                <span className="text-[11px] text-[#448361] bg-[#edf3ec] px-2 py-0.5 rounded font-medium flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>{language === "zh" ? `RAG 引擎就绪 (${courseDocuments.length} 份资料)` : "RAG Ready"}</span>
                </span>
              </div>

              {/* Focus Priority Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  {
                    id: "heavy_calculation",
                    titleZh: "📐 计算与大题攻坚",
                    descZh: "深度检索公式推导与综合大题，分配强化推导学时",
                  },
                  {
                    id: "concepts_and_theory",
                    titleZh: "📖 核心概念与原理定义",
                    descZh: "系统梳理定义、定理适用边界与名词解释",
                  },
                  {
                    id: "past_exam_drills",
                    titleZh: "📝 历年真题与经典题型",
                    descZh: "优先匹配真题卷高频出题点，建立题型模型",
                  },
                  {
                    id: "rush_sprint",
                    titleZh: "⚡ 考前急救与高频考点",
                    descZh: "压缩低频内容，全量聚焦历年高分重难点",
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setUserNeedFocusArea(item.id)}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      userNeedFocusArea === item.id
                        ? "bg-[#ebf5fb] border-[#2b78a0] text-[#37352f] shadow-2xs font-semibold"
                        : "bg-white border-[#e9e9e7] hover:bg-[#fafaf9] text-[#787774]"
                    }`}
                  >
                    <span className="text-xs block text-[#37352f] mb-0.5">{item.titleZh}</span>
                    <span className="text-[10px] text-[#787774] block leading-snug font-normal">{item.descZh}</span>
                  </button>
                ))}
              </div>

              {/* Custom Student Directive Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[#5a5a57] block">
                  {language === "zh" ? "💬 自定义学生需求 / 特殊任务分配指示：" : "Custom Study Instructions:"}
                </label>
                <input
                  type="text"
                  value={customPromptRequirement}
                  onChange={(e) => setCustomPromptRequirement(e.target.value)}
                  placeholder={
                    language === "zh"
                      ? "例如：我数学基础稍弱，请把计算大题拆解为更小的时间块；重点复习前四章..."
                      : "e.g., Focus extra time on dynamic programming; break calculations into smaller chunks..."
                  }
                  className="w-full px-3 py-2 text-xs rounded-md border border-[#d3d2cf] bg-white outline-none focus:border-[#2b78a0]"
                />
              </div>
            </div>

            {/* Weak topics selection */}
            {topics.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-[#37352f] mb-1.5">
                  {language === "zh" ? "指定重点攻坚或薄弱知识模块（AI 将分配额外巩固学时）：" : "Select Weak Topics for Extra Focus:"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t) => {
                    const isSelected = selectedWeakTopics.includes(t.title);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWeakTopics(selectedWeakTopics.filter(item => item !== t.title));
                          } else {
                            setSelectedWeakTopics([...selectedWeakTopics, t.title]);
                          }
                        }}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-all inline-flex items-center space-x-1 ${
                          isSelected
                            ? "bg-[#fbf3f2] text-[#d44c47] border-[#f5d5d3] font-semibold"
                            : "bg-white text-[#787774] border-[#e9e9e7] hover:bg-[#efefed]"
                        }`}
                      >
                        {isSelected && <Zap className="w-3 h-3 text-[#d44c47] shrink-0" />}
                        <span>{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg border border-[#e9e9e7] hover:bg-[#efefed] text-xs font-semibold text-[#37352f]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "上一步" : "Back"}</span>
            </button>

            <button
              onClick={handleGenerateFinalPlan}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-6 py-3 rounded-lg bg-[#37352f] hover:bg-[#201f1d] disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{language === "zh" ? "AI 正在生成全新科目完整备考日历..." : "Generating Full Subject Plan..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{language === "zh" ? "一键生成全新科目备考计划" : "Generate Subject Study Plan"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Document Text Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-[#e9e9e7]">
            <div className="p-4 border-b border-[#e9e9e7] flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <FileText className="w-4 h-4 text-[#2b78a0]" />
                <span className="font-bold text-sm text-[#37352f] truncate">{previewDoc.name}</span>
                <span className="text-[11px] px-2 py-0.5 bg-[#efefed] text-[#787774] rounded font-medium">
                  {previewDoc.type}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-md text-[#787774] hover:text-[#37352f] hover:bg-[#efefed]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-[#37352f] bg-[#fafaf9] whitespace-pre-wrap leading-relaxed">
              {previewDoc.content || (language === "zh" ? "文档内容为空" : "Empty document content")}
            </div>

            <div className="p-3 border-t border-[#e9e9e7] flex items-center justify-between text-xs text-[#787774]">
              <span>{previewDoc.content.length} {language === "zh" ? "字符" : "characters"}</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 rounded bg-[#37352f] text-white text-xs font-semibold"
              >
                {language === "zh" ? "关闭预览" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

