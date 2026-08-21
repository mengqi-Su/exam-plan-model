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
import { RulerTimePicker } from "./RulerTimePicker";

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

  const daysDiff = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(examDate);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  }, [startDate, examDate]);

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

  // Helpers for Monday - Sunday customization
  const orderedDayOfWeeks = [1, 2, 3, 4, 5, 6, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

  const dayMeta: Record<number, { zh: string; en: string; isWeekend: boolean }> = {
    1: { zh: "周一", en: "Mon", isWeekend: false },
    2: { zh: "周二", en: "Tue", isWeekend: false },
    3: { zh: "周三", en: "Wed", isWeekend: false },
    4: { zh: "周四", en: "Thu", isWeekend: false },
    5: { zh: "周五", en: "Fri", isWeekend: false },
    6: { zh: "周六", en: "Sat", isWeekend: true },
    0: { zh: "周日", en: "Sun", isWeekend: true },
  };

  const weeklyTotalHours = useMemo(() => {
    return dailySchedules.reduce((acc, curr) => (curr.enabled ? acc + curr.availableHours : acc), 0);
  }, [dailySchedules]);

  const totalPlannedStudyHours = useMemo(() => {
    const start = new Date(startDate);
    let total = 0;
    for (let i = 0; i < daysDiff; i++) {
      const cur = new Date(start.getTime() + i * 86400000);
      const dayOfWeek = cur.getDay();
      const sched = dailySchedules.find((s) => s.dayOfWeek === dayOfWeek);
      if (sched && sched.enabled) {
        total += sched.availableHours;
      }
    }
    return Math.round(total * 10) / 10;
  }, [startDate, daysDiff, dailySchedules]);

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 font-mono text-[#111111] space-y-6">
      {/* Top Banner Navigation & Breadcrumbs */}
      <div className="flex items-center justify-between pb-4 border-b border-[#111111]">
        <button
          onClick={onCancel}
          className="flex items-center space-x-1.5 text-xs text-[#111111] hover:underline font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>[{language === "zh" ? "返回现有备考计划" : "BACK TO CURRENT PLAN"}]</span>
        </button>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-[#666666] font-bold">[{language === "zh" ? "已有科目" : "EXISTING SUBJECTS"}]:</span>
          <span className="font-bold text-[#111111] border border-[#111111] bg-white px-2 py-0.5">
            {existingPlans.length} {language === "zh" ? "门" : "COURSES"}
          </span>
        </div>
      </div>

      {/* Main Header */}
      <div className="border-b border-[#111111] pb-4">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#111111] flex items-center space-x-2 uppercase">
          <Plus className="w-5 h-5 text-[#111111]" />
          <span>{language === "zh" ? "添加新考试科目" : "Add Exam Subject"}</span>
        </h1>
        <p className="text-xs text-[#666666] mt-1">
          {language === "zh"
            ? "为新学科输入考期与目标、上传考纲或选择预设模板，AI 将为您生成专属自适应复习日历与每日待办。"
            : "Set up a new subject, import syllabus topics, and let AI generate an adaptive day-by-day study roadmap."}
        </p>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2 text-xs font-bold border-b border-[#111111] pb-3">
        <button
          onClick={() => setStep(1)}
          className={`flex items-center space-x-2 py-2 px-3 border transition-colors cursor-pointer ${
            step === 1 ? "bg-[#111111] text-white border-[#111111]" : "text-[#666666] border-[#111111] bg-white hover:bg-[#111111] hover:text-white"
          }`}
        >
          <span className="text-[11px]">[01]</span>
          <span className="truncate">{language === "zh" ? "科目与考试信息" : "SUBJECT"}</span>
        </button>

        <button
          onClick={() => {
            if (!examName.trim()) {
              setGenerateError(language === "zh" ? "请先输入考试科目名称" : "Please enter exam name first");
              return;
            }
            setStep(2);
          }}
          className={`flex items-center space-x-2 py-2 px-3 border transition-colors cursor-pointer ${
            step === 2 ? "bg-[#111111] text-white border-[#111111]" : "text-[#666666] border-[#111111] bg-white hover:bg-[#111111] hover:text-white"
          }`}
        >
          <span className="text-[11px]">[02]</span>
          <span className="truncate">{language === "zh" ? "考纲与多文件资料" : "SYLLABUS & DOCS"}</span>
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
          className={`flex items-center space-x-2 py-2 px-3 border transition-colors cursor-pointer ${
            step === 3 ? "bg-[#111111] text-white border-[#111111]" : "text-[#666666] border-[#111111] bg-white hover:bg-[#111111] hover:text-white"
          }`}
        >
          <span className="text-[11px]">[03]</span>
          <span className="truncate">{language === "zh" ? "时长与规划需求" : "TIME & REQUIREMENTS"}</span>
        </button>
      </div>

      {/* Error alert banner */}
      {generateError && (
        <div className="p-3 bg-[#fafafa] border border-[#111111] text-[#111111] text-xs flex items-center justify-between font-bold">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#111111]" />
            <span>[ERROR: {generateError}]</span>
          </div>
          <button onClick={() => setGenerateError(null)} className="text-xs hover:underline cursor-pointer">
            [{language === "zh" ? "关闭" : "DISMISS"}]
          </button>
        </div>
      )}

      {/* ================= STEP 1: SUBJECT & EXAM INFO ================= */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Quick Subject Presets */}
          <div className="bg-[#fafafa] p-4 border border-[#111111]">
            <div className="flex items-center justify-between mb-3 border-b border-[#111111] pb-2">
              <span className="text-xs font-bold text-[#111111] uppercase flex items-center space-x-1.5">
                <BookmarkPlus className="w-4 h-4 text-[#111111]" />
                <span>{language === "zh" ? "[快速载入经典科目模板]" : "[QUICK SUBJECT PRESETS]"}</span>
              </span>
              <span className="text-[11px] text-[#666666]">
                {language === "zh" ? "一键预填科目、学科领域与核心考纲" : "Preload course details & topics"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_SUBJECT_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyTemplate(tmpl)}
                  className="p-3 bg-white hover:bg-[#111111] hover:text-white border border-[#111111] text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 border border-[#111111] bg-[#fafafa] text-[#111111] group-hover:bg-[#111111] group-hover:text-white group-hover:border-white font-bold">
                      [{tmpl.topics.length} {language === "zh" ? "个考点" : "topics"}]
                    </span>
                  </div>
                  <span className="text-[11px] text-[#666666] group-hover:text-[#e5e5e5] block mt-1">
                    {tmpl.subject}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-white p-5 border border-[#111111] space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-2 border-b border-[#111111] pb-2.5">
              <GraduationCap className="w-4 h-4 text-[#111111]" />
              <span>[// {language === "zh" ? "考试基本信息" : "COURSE & EXAM DETAILS"}]</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "考试科目 / 课程全称 *" : "Exam / Course Name *"}
                </label>
                <input
                  type="text"
                  value={examName}
                  onChange={(e) => setExamName(e.target.value)}
                  placeholder={language === "zh" ? "例如：微积分期末考试 / 考研数学" : "e.g. Calculus II Final Exam"}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "学科 / 专业领域" : "Subject Domain"}
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={language === "zh" ? "例如：数学、计算机、外语、金融" : "e.g. Mathematics, Computer Science"}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "计划开始日期" : "Start Date"}
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "目标考试日期与时间" : "Exam Date & Time"}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="date"
                    value={examDate}
                    onChange={(e) => setExamDate(e.target.value)}
                    className="w-2/3 px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                  />
                  <input
                    type="time"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    className="w-1/3 px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "目标期望成绩 / 评级" : "Target Score / Grade"}
                </label>
                <input
                  type="text"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  placeholder="例如：90+ / A+ / 稳过 85 分"
                  className="w-full px-3 py-2 text-xs bg-[#fafafa] border border-[#111111] focus:bg-white outline-none font-mono"
                />
              </div>

              <div className="flex items-center">
                <div className="p-3 bg-[#fafafa] border border-[#111111] text-xs text-[#111111] w-full font-bold">
                  <span>{language === "zh" ? "备考周期计算：" : "Study Duration: "}</span>
                  <span>{daysDiff} {language === "zh" ? "天" : "days"} (约 {Math.ceil(daysDiff / 7)} {language === "zh" ? "周" : "weeks"})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action to Step 2 */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                if (!examName.trim()) {
                  setGenerateError(language === "zh" ? "请输入考试科目名称" : "Please enter the exam name");
                  return;
                }
                setStep(2);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#111111] text-white hover:bg-[#333333] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
            >
              <span>[{language === "zh" ? "下一步：上传课程资料与考纲" : "NEXT: COURSE DOCUMENTS & SYLLABUS"}]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: COURSE DOCUMENTS & TOPICS ================= */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Multi-Document Upload & Management Card for this Course */}
          <div className="bg-white p-5 border border-[#111111] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#111111] pb-3 gap-2">
              <div>
                <h3 className="text-xs font-bold uppercase text-[#111111] flex items-center space-x-2">
                  <BookOpen className="w-4 h-4 text-[#111111]" />
                  <span>{language === "zh" ? `[${examName || "当前课程"}] 备考资料与考纲` : `COURSE MATERIALS: ${examName || "COURSE"}`}</span>
                </h3>
                <p className="text-xs text-[#666666] mt-0.5">
                  {language === "zh"
                    ? "可一次性批量上传或持续添加属于本门课程的大纲、讲义课件、模拟试卷等多个文件，AI 将联合深度解析。"
                    : "Upload multiple files (syllabus, lecture slides, mock exams) for this single course."}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowPasteForm(!showPasteForm)}
                  className="flex items-center space-x-1 px-3 py-1 bg-white hover:bg-[#111111] hover:text-white border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[{language === "zh" ? "粘贴文本资料" : "PASTE TEXT"}]</span>
                </button>
              </div>
            </div>

            {/* Optional Manual Paste Form */}
            {showPasteForm && (
              <div className="p-4 bg-[#fafafa] border border-[#111111] space-y-3">
                <div className="flex items-center justify-between border-b border-[#111111] pb-2">
                  <span className="text-xs font-bold uppercase text-[#111111]">
                    [// {language === "zh" ? "添加自定义文本 / 笔记到本课程" : "ADD TEXT NOTES TO THIS COURSE"}]
                  </span>
                  <button onClick={() => setShowPasteForm(false)} className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={pasteDocTitle}
                    onChange={(e) => setPasteDocTitle(e.target.value)}
                    placeholder={language === "zh" ? "资料名称，例如：第3章核心公式速记" : "Document title..."}
                    className="px-3 py-1.5 text-xs bg-white border border-[#111111] outline-none font-mono"
                  />
                  <select
                    value={pasteDocType}
                    onChange={(e) => setPasteDocType(e.target.value as any)}
                    className="px-3 py-1.5 text-xs bg-white border border-[#111111] outline-none font-mono font-bold"
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
                  className="w-full px-3 py-2 text-xs bg-white border border-[#111111] outline-none font-mono"
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setShowPasteForm(false)}
                    className="px-3 py-1 text-xs border border-[#111111] bg-white hover:bg-[#111111] hover:text-white font-bold cursor-pointer transition-colors"
                  >
                    [{language === "zh" ? "取消" : "CANCEL"}]
                  </button>
                  <button
                    onClick={handleAddPastedDocument}
                    disabled={!pasteDocContent.trim()}
                    className="px-3 py-1 text-xs bg-[#111111] text-white border border-[#111111] font-bold disabled:opacity-40 hover:bg-[#333333] cursor-pointer transition-colors"
                  >
                    [{language === "zh" ? "加入本课程资料库" : "ADD TO COURSE"}]
                  </button>
                </div>
              </div>
            )}

            {/* Drag & Drop Multi-file Uploader */}
            <label className="border border-dashed border-[#111111] hover:bg-[#111111] hover:text-white bg-[#fafafa] p-6 flex flex-col items-center justify-center cursor-pointer transition-colors text-center group">
              <input
                type="file"
                multiple
                accept=".txt,.md,.doc,.docx,.pdf,.rtf,image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-10 h-10 bg-white border border-[#111111] text-[#111111] flex items-center justify-center mb-2">
                {isParsingFiles ? (
                  <div className="w-4 h-4 border-2 border-[#111111] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
              </div>
              <span className="text-xs font-bold uppercase">
                {isParsingFiles
                  ? (parsingStatus || (language === "zh" ? "正在批量解析文件..." : "Parsing files..."))
                  : (language === "zh" ? "点击或拖拽上传多个课程文件（支持多选）" : "Click or drag multiple course files")}
              </span>
              <span className="text-[11px] text-[#666666] group-hover:text-[#e5e5e5] mt-1">
                {language === "zh"
                  ? "支持 PDF、Word (.docx)、TXT、Markdown，单门课程可同时包含大纲、讲义、真题等多个文件"
                  : "Supports PDF, Word (.docx), TXT, Markdown. All files belong to this course."}
              </span>
            </label>

            {/* List of uploaded course documents */}
            {courseDocuments.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#111111] border-b border-[#111111] pb-1.5">
                  <span className="flex items-center space-x-1.5">
                    <Layers className="w-4 h-4 text-[#111111]" />
                    <span>{language === "zh" ? `[本课程已包含 ${courseDocuments.length} 份文件资料]` : `[ATTACHED FILES: ${courseDocuments.length}]`}</span>
                  </span>
                  <span className="text-[11px] text-[#666666] font-normal">
                    {language === "zh" ? "可修改文档类型以指导 AI 专项分析" : "Change document role for tailored AI analysis"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {courseDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-[#fafafa] border border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <div className="w-6 h-6 bg-white border border-[#111111] flex items-center justify-center text-xs shrink-0 text-[#111111]">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-[#111111] truncate">{doc.name}</span>
                            {doc.sizeBytes && (
                              <span className="text-[10px] text-[#666666] shrink-0">
                                ({Math.round(doc.sizeBytes / 1024)} KB)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[#666666] block truncate font-mono">
                            {doc.content.slice(0, 80)}... ({doc.content.length} {language === "zh" ? "字" : "chars"})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <select
                          value={doc.type}
                          onChange={(e) => handleUpdateDocument(doc.id, { type: e.target.value as any })}
                          className="text-[11px] px-2 py-1 bg-white border border-[#111111] text-[#111111] outline-none font-bold font-mono"
                        >
                          <option value="syllabus">{language === "zh" ? "课程教学大纲" : "Syllabus"}</option>
                          <option value="lecture_slides">{language === "zh" ? "讲义课件/PPT" : "Lecture Slides"}</option>
                          <option value="notes">{language === "zh" ? "课程笔记" : "Study Notes"}</option>
                          <option value="past_exam">{language === "zh" ? "历年真题/试卷" : "Past Exam"}</option>
                          <option value="textbook_outline">{language === "zh" ? "公式提纲速查" : "Cheat Sheet"}</option>
                        </select>

                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer border border-[#111111] bg-white"
                          title={language === "zh" ? "预览文档内容" : "Preview Document Content"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer border border-[#111111] bg-white"
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
                className="flex items-center space-x-2 px-4 py-2.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>[{language === "zh" ? "AI 正在联合解析全部文件并提炼考纲架构..." : "EXTRACTING TOPICS FROM ALL DOCUMENTS..."}]</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      [{language === "zh"
                        ? `AI 联合提炼考点与权重 (${courseDocuments.length} 份文件)`
                        : `EXTRACT TOPICS WITH AI (${courseDocuments.length} FILES)`}]
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Topics Table */}
          <div className="bg-white p-5 border border-[#111111] space-y-4">
            <div className="flex items-center justify-between border-b border-[#111111] pb-2.5">
              <div>
                <h3 className="text-xs font-bold uppercase text-[#111111]">
                  [// {language === "zh" ? "结构化考点与分值架构" : "STRUCTURED TOPIC BREAKDOWN"}]
                </h3>
                <span className="text-xs text-[#666666]">
                  {language === "zh" ? `已生成 ${topics.length} 个核心知识模块` : `${topics.length} topics defined`}
                </span>
              </div>

              <button
                onClick={handleAddCustomTopic}
                className="flex items-center space-x-1 px-3 py-1 bg-white hover:bg-[#111111] hover:text-white text-xs font-bold text-[#111111] border border-[#111111] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>[{language === "zh" ? "添加考点" : "ADD TOPIC"}]</span>
              </button>
            </div>

            {topics.length === 0 ? (
              <div className="text-center py-8 text-[#666666] text-xs font-bold uppercase">
                <BookOpen className="w-8 h-8 mx-auto text-[#111111] opacity-40 mb-2" />
                <p>[{language === "zh" ? "暂无考点，请上传课程文件后点击「AI 联合提炼考点」或手动添加。" : "NO TOPICS YET. UPLOAD COURSE FILES AND EXTRACT TOPICS."}]</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topics.map((t, idx) => (
                  <div key={t.id} className="p-3.5 border border-[#111111] bg-[#fafafa] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0 mr-3">
                        <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold shrink-0">
                          [{idx + 1}]
                        </span>
                        <input
                          type="text"
                          value={t.title}
                          onChange={(e) => handleUpdateTopic(t.id, { title: e.target.value })}
                          className="font-bold text-xs text-[#111111] bg-transparent border-b border-transparent hover:border-[#111111] focus:border-[#111111] outline-none flex-1 font-mono"
                        />
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <select
                          value={t.difficulty}
                          onChange={(e) => handleUpdateTopic(t.id, { difficulty: e.target.value as any })}
                          className="text-[11px] font-bold px-2 py-0.5 border border-[#111111] bg-white text-[#111111] outline-none font-mono"
                        >
                          <option value="easy">{language === "zh" ? "基础 (Easy)" : "Easy"}</option>
                          <option value="medium">{language === "zh" ? "中等 (Medium)" : "Medium"}</option>
                          <option value="hard">{language === "zh" ? "难点 (Hard)" : "Hard"}</option>
                        </select>

                        <div className="flex items-center space-x-1 text-xs text-[#111111] font-bold">
                          <input
                            type="number"
                            value={t.estimatedHours}
                            onChange={(e) => handleUpdateTopic(t.id, { estimatedHours: Number(e.target.value) || 1 })}
                            className="w-12 px-1 py-0.5 text-center text-xs bg-white border border-[#111111] font-bold"
                          />
                          <span>{language === "zh" ? "学时" : "hrs"}</span>
                        </div>

                        <button
                          onClick={() => handleDeleteTopic(t.id)}
                          className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer border border-[#111111] bg-white"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-[#666666]">
                      <input
                        type="text"
                        value={t.description || ""}
                        onChange={(e) => handleUpdateTopic(t.id, { description: e.target.value })}
                        placeholder={language === "zh" ? "考点概述与学习目标..." : "Topic summary..."}
                        className="w-full bg-transparent border-b border-transparent hover:border-[#111111] focus:border-[#111111] outline-none text-xs text-[#111111] font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setStep(1)}
              className="flex items-center space-x-1.5 px-4 py-2 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-xs font-bold text-[#111111] cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>[{language === "zh" ? "上一步" : "BACK"}]</span>
            </button>

            <button
              onClick={() => {
                if (topics.length === 0) {
                  setGenerateError(language === "zh" ? "请至少配置一个考点" : "Please configure at least one topic");
                  return;
                }
                setStep(3);
              }}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#111111] text-white hover:bg-[#333333] font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
            >
              <span>[{language === "zh" ? "下一步：复习节奏与作息" : "NEXT: PACING & SCHEDULE"}]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 3: TWO CORE MODULES (DAILY STUDY TIME & PERSONAL STUDY REQUIREMENTS) ================= */}
      {step === 3 && (
        <div className="space-y-4 font-sans">
          <div className="bg-white p-5 border border-[#111111] space-y-5">
            {/* Header & Overview Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#111111] pb-3 font-mono">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#111111]" />
                <span>[// {language === "zh" ? "学习时长与自身规划需求" : "TIME & STUDY REQUIREMENTS"}]</span>
              </h3>

              <div className="flex items-center space-x-3 text-xs text-[#666666] font-sans">
                <span>
                  {language === "zh" ? "备考周期" : "Span"}: <strong className="text-[#111111] font-mono">{daysDiff}</strong> {language === "zh" ? "天" : "days"}
                </span>
                <span>·</span>
                <span>
                  {language === "zh" ? "考点" : "Topics"}: <strong className="text-[#111111] font-mono">{topics.length}</strong>
                </span>
                <span>·</span>
                <span>
                  {language === "zh" ? "资料" : "Docs"}: <strong className="text-[#111111] font-mono">{courseDocuments.length}</strong>
                </span>
              </div>
            </div>

            {/* ================= MODULE 1: 周一到周日学习时间 (参考设计款时间标尺拨盘) ================= */}
            <RulerTimePicker
              language={language}
              dailySchedules={dailySchedules}
              onUpdateDayHours={handleUpdateDayHours}
              onToggleDayEnabled={handleToggleDayEnabled}
              onApplyPreset={handleApplyWeeklyPreset}
              daysDiff={daysDiff}
            />

            {/* ================= MODULE 2: 自身规划上有什么需求 ================= */}
            <div className="pt-4 border-t border-[#dedad1] space-y-3">
              <label className="text-xs font-bold text-[#111111] uppercase tracking-wide flex items-center space-x-1.5">
                <Target className="w-4 h-4 text-[#111111]" />
                <span>{language === "zh" ? "2. 自身规划上有什么需求" : "2. Personal Planning & Study Requirements"}</span>
              </label>

              {/* Personal requirement textarea */}
              <div className="space-y-1">
                <textarea
                  rows={3}
                  value={customPromptRequirement}
                  onChange={(e) => setCustomPromptRequirement(e.target.value)}
                  placeholder={
                    language === "zh"
                      ? "在此输入您的自身复习规划需求（如：基础较弱，计算大题请拆细；重点复习前三章；优先安排真题易错考点；周末多安排综合演练等）..."
                      : "Enter your personal study requirements or directives (e.g., focus heavily on dynamic programming; break down proofs into smaller steps; reserve weekends for past exam papers)..."
                  }
                  className="w-full p-3 text-xs border border-[#dedad1] focus:border-[#111111] bg-[#fafafa] focus:bg-white outline-none text-[#111111] leading-relaxed resize-none placeholder-[#888888]"
                />
              </div>
            </div>
          </div>

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setStep(2)}
              className="flex items-center space-x-1.5 px-4 py-2 border border-[#dedad1] hover:border-[#111111] bg-white text-xs font-semibold text-[#111111] cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "上一步" : "Back"}</span>
            </button>

            <button
              onClick={handleGenerateFinalPlan}
              disabled={isGenerating}
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
            >
              {isGenerating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{language === "zh" ? "正在生成备考日历..." : "GENERATING STUDY PLAN..."}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === "zh" ? "一键生成科目备考计划" : "GENERATE STUDY PLAN"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Document Text Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full max-h-[85vh] flex flex-col border border-[#111111] font-mono">
            <div className="p-4 border-b border-[#111111] flex items-center justify-between bg-[#fafafa]">
              <div className="flex items-center space-x-2 min-w-0">
                <FileText className="w-4 h-4 text-[#111111]" />
                <span className="font-bold text-xs uppercase text-[#111111] truncate">{previewDoc.name}</span>
                <span className="text-[10px] px-2 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
                  [{previewDoc.type}]
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-[#111111] bg-white whitespace-pre-wrap leading-relaxed">
              {previewDoc.content || (language === "zh" ? "文档内容为空" : "Empty document content")}
            </div>

            <div className="p-3 border-t border-[#111111] flex items-center justify-between text-xs text-[#666666] bg-[#fafafa]">
              <span className="font-bold">[{previewDoc.content.length} {language === "zh" ? "字符" : "CHARS"}]</span>
              <button
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-1.5 bg-[#111111] text-white text-xs font-bold uppercase hover:bg-[#333333] border border-[#111111] cursor-pointer"
              >
                [{language === "zh" ? "关闭预览" : "CLOSE"}]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

