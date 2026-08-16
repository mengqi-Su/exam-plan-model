import React, { useState } from "react";
import { 
  FileText, 
  Upload, 
  Plus, 
  Trash2, 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  HelpCircle, 
  FileQuestion, 
  Search, 
  Filter, 
  Layers, 
  Tag, 
  Calendar, 
  Clock, 
  Eye, 
  X, 
  ExternalLink,
  Zap,
  BookmarkPlus,
  ArrowRight,
  GraduationCap
} from "lucide-react";
import { StudyMaterial, ExamStudyPlan, StudyTask } from "../types";
import { INITIAL_SAMPLE_DOCUMENTS } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { QuizModal } from "./QuizModal";
import { parseDocumentFile } from "../lib/documentParser";

interface MaterialsAndQuestionsHubProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onGoToCourseSyllabus?: () => void;
}

export function MaterialsAndQuestionsHub({
  plan,
  onUpdatePlan,
  onGoToCourseSyllabus,
}: MaterialsAndQuestionsHubProps) {
  const { t, language } = useI18n();

  // Active section tab: "questions" (真题试卷库) vs "notes" (讲义与资料)
  const [hubTab, setHubTab] = useState<"questions" | "notes">("questions");

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  // Upload/Input modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocType, setNewDocType] = useState<StudyMaterial["type"]>("past_exam");
  const [newDocContent, setNewDocContent] = useState("");
  const [newDocYear, setNewDocYear] = useState("");
  const [newDocDifficulty, setNewDocDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [newDocTopicTag, setNewDocTopicTag] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>("");

  // Viewing full document / paper modal
  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  // Active Quiz Modal state for a specific test paper / material
  const [activeQuizMaterial, setActiveQuizMaterial] = useState<StudyMaterial | null>(null);

  // Ensure materials array exists
  const materials: StudyMaterial[] = plan.materials || INITIAL_SAMPLE_DOCUMENTS;

  // Filtered lists
  const questionPapers = materials.filter(
    (m) => m.categoryGroup === "exam_question" || m.type === "past_exam" || m.name.includes("真题") || m.name.includes("试卷") || m.name.includes("Exam") || m.name.includes("Quiz")
  );

  const studyNotes = materials.filter(
    (m) => m.categoryGroup === "study_material" || m.type === "notes" || m.type === "lecture_slides" || m.type === "textbook_outline" || (!questionPapers.includes(m) && m.type !== "syllabus")
  );

  const currentList = hubTab === "questions" ? questionPapers : studyNotes;

  const filteredItems = currentList.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.topicTag && item.topicTag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.summaryNotes && item.summaryNotes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiff = filterDifficulty === "all" || item.difficulty === filterDifficulty;
    const matchesType = filterType === "all" || item.type === filterType;
    return matchesSearch && matchesDiff && matchesType;
  });

  // Handle saving new material
  const handleSaveNewMaterial = () => {
    if (!newDocContent.trim()) return;

    const categoryGroup = hubTab === "questions" || newDocType === "past_exam" ? "exam_question" : "study_material";
    const newMat: StudyMaterial = {
      id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: newDocTitle.trim() || (hubTab === "questions" ? (language === "zh" ? "新建真题试卷" : "New Exam Paper") : (language === "zh" ? "新建学习讲义" : "New Study Notes")),
      type: newDocType,
      categoryGroup,
      content: newDocContent.trim(),
      yearOrTerm: newDocYear.trim() || undefined,
      difficulty: newDocDifficulty,
      topicTag: newDocTopicTag.trim() || (plan.topics && plan.topics[0]?.title) || undefined,
      uploadedAt: new Date().toISOString(),
      sizeBytes: new Blob([newDocContent]).size,
      summaryNotes: newDocContent.slice(0, 120) + "...",
    };

    const updatedMaterials = [newMat, ...materials];
    onUpdatePlan({
      ...plan,
      materials: updatedMaterials,
    });

    // Reset modal
    setNewDocTitle("");
    setNewDocContent("");
    setNewDocYear("");
    setNewDocTopicTag("");
    setIsAddModalOpen(false);
  };

  // Handle file uploads directly with robust parsing
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploadingDocs(true);
    const fileArray = Array.from(files);
    const newMaterials: StudyMaterial[] = [];

    for (const file of fileArray) {
      setUploadProgressText(
        language === "zh"
          ? `正在智能解析 ${file.name} (PDF / Word / 讲义)...`
          : `Parsing ${file.name}...`
      );

      try {
        const parsed = await parseDocumentFile(file, language, (status) => setUploadProgressText(status));
        const isExam =
          file.name.toLowerCase().includes("exam") ||
          file.name.includes("真题") ||
          file.name.includes("试卷") ||
          file.name.includes("test") ||
          file.name.includes("quiz") ||
          hubTab === "questions";

        const newMat: StudyMaterial = {
          id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: isExam ? "past_exam" : "notes",
          categoryGroup: isExam ? "exam_question" : "study_material",
          content: parsed.text,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
          difficulty: "medium",
          summaryNotes: parsed.text.slice(0, 140) + "...",
        };

        newMaterials.push(newMat);
      } catch (err) {
        console.error(`Failed to parse file ${file.name}:`, err);
      }
    }

    if (newMaterials.length > 0) {
      onUpdatePlan({
        ...plan,
        materials: [...newMaterials, ...materials],
      });
    }

    setIsUploadingDocs(false);
    setUploadProgressText("");
  };

  // Handle parsing a file inside the Add Modal
  const handleModalFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setIsUploadingDocs(true);
    setUploadProgressText(language === "zh" ? `正在解析 ${file.name}...` : `Parsing ${file.name}...`);
    try {
      const parsed = await parseDocumentFile(file, language, (status) => setUploadProgressText(status));
      if (!newDocTitle) {
        setNewDocTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      setNewDocContent(parsed.text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploadingDocs(false);
      setUploadProgressText("");
    }
  };

  // Handle deleting a material
  const handleDeleteMaterial = (id: string) => {
    const updated = materials.filter((m) => m.id !== id);
    onUpdatePlan({
      ...plan,
      materials: updated,
    });
  };

  // Load sample documents if empty
  const handleLoadSampleDocuments = () => {
    onUpdatePlan({
      ...plan,
      materials: INITIAL_SAMPLE_DOCUMENTS,
    });
  };

  // Add document as a task directly to the daily schedule
  const handleAddToDailySchedule = (doc: StudyMaterial) => {
    const today = new Date().toISOString().split("T")[0];
    const isQuestion = doc.categoryGroup === "exam_question" || doc.type === "past_exam";
    const newTask: StudyTask = {
      id: `task-${Date.now()}`,
      title: isQuestion
        ? (language === "zh" ? `限时刷题演练：${doc.name}` : `Timed Practice: ${doc.name}`)
        : (language === "zh" ? `考点精读与笔记复习：${doc.name}` : `Active Reading: ${doc.name}`),
      description: isQuestion
        ? (language === "zh" ? `完成该试卷的题目作答，核对解析并记录错题。` : `Complete questions from this paper, verify answers, and log traps.`)
        : (language === "zh" ? `精读该讲义并整理核心公式与定理笔记。` : `Review key concepts and write cheat sheet summary.`),
      category: isQuestion ? "mock_exam" : "reading",
      topicTitle: doc.topicTag || (plan.topics && plan.topics[0]?.title) || "综合复习",
      date: today,
      durationMinutes: isQuestion ? 60 : 45,
      priority: "high",
      status: "pending",
      keyObjectives: isQuestion
        ? [
            language === "zh" ? "在规定时间内独立作答全部题目" : "Complete within timed limits",
            language === "zh" ? "对照解析标记错题并归纳易错点" : "Review answers and log trap patterns",
          ]
        : [
            language === "zh" ? "梳理核心定义与定理推导过程" : "Summarize core theorems",
            language === "zh" ? "合上讲义自主复述关键考点" : "Active recall self-check",
          ],
      activeRecallPrompt: isQuestion
        ? (language === "zh" ? "在本次作答中，哪道题目的陷阱最隐蔽？" : "Which trap pattern in this paper was most tricky?")
        : (language === "zh" ? "请写出本文档中最重要的 3 个核心公式或结论。" : "Write down the 3 most critical formulas from memory."),
    };

    onUpdatePlan({
      ...plan,
      tasks: [newTask, ...plan.tasks],
    });

    alert(language === "zh" ? `已成功将「${doc.name}」添加至今日学习待办清单！` : `Successfully added to today's task list!`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Top Banner Callout */}
      <div className="notion-callout p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#e9e9e7] bg-[#fbfbfa]">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[#2b78a0] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[#37352f]">
                {language === "zh" ? "题库真题与课程学习资料库" : "Question Bank & Learning Materials Hub"}
              </h2>
              <span className="notion-tag-purple px-2 py-0.5 rounded text-[10px] font-semibold">
                {plan.examName}
              </span>
            </div>
            <p className="text-xs text-[#787774] mt-0.5 max-w-2xl leading-relaxed">
              {language === "zh"
                ? "集中管理课程的历年真题试卷、模拟题库、名师讲义及公式笔记。支持一键 AI 智能自测出题、考点陷阱提炼及自动安排进每日备考计划。"
                : "Manage past exams, practice papers, lecture notes, and formula sheets. Directly trigger AI practice quizzes, trap analysis, and add study tasks to your schedule."}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start md:self-auto">
          {onGoToCourseSyllabus && (
            <button
              onClick={onGoToCourseSyllabus}
              className="px-3 py-1.5 bg-white hover:bg-[#efefed] text-[#37352f] border border-[#e9e9e7] rounded-md text-xs font-semibold transition-colors flex items-center space-x-1 shadow-2xs"
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#787774]" />
              <span>{language === "zh" ? "查看课程考纲架构" : "Course Syllabus"}</span>
            </button>
          )}

          <button
            onClick={() => {
              setNewDocType(hubTab === "questions" ? "past_exam" : "notes");
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#37352f] hover:bg-[#201f1c] text-white rounded-md text-xs font-semibold transition-colors flex items-center space-x-1 shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{hubTab === "questions" ? (language === "zh" ? "上传真题试卷" : "Add Exam Paper") : (language === "zh" ? "上传课件笔记" : "Add Study Notes")}</span>
          </button>
        </div>
      </div>

      {/* Main Hub Tabs (真题试卷库 vs 课程讲义与资料) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e9e9e7] pb-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setHubTab("questions");
              setFilterType("all");
            }}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-t-md transition-colors border-b-2 ${
              hubTab === "questions"
                ? "border-[#2b78a0] text-[#2b78a0] bg-[#f7f6f3]"
                : "border-transparent text-[#787774] hover:text-[#37352f] hover:bg-[#fbfbfa]"
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            <span>
              {language === "zh" ? "历年真题与试卷题库" : "Exam Papers & Question Bank"} ({questionPapers.length})
            </span>
          </button>

          <button
            onClick={() => {
              setHubTab("notes");
              setFilterType("all");
            }}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-t-md transition-colors border-b-2 ${
              hubTab === "notes"
                ? "border-[#2b78a0] text-[#2b78a0] bg-[#f7f6f3]"
                : "border-transparent text-[#787774] hover:text-[#37352f] hover:bg-[#fbfbfa]"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>
              {language === "zh" ? "课程讲义与学习资料" : "Lecture Slides & Study Notes"} ({studyNotes.length})
            </span>
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9b9a97]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "zh" ? "按标题、考点或内容搜索..." : "Search papers or topics..."}
              className="pl-8 pr-2.5 py-1 text-xs bg-[#fbfbfa] border border-[#e9e9e7] rounded-md text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0] w-44 sm:w-56"
            />
          </div>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="text-xs bg-[#fbfbfa] text-[#37352f] border border-[#e9e9e7] rounded-md px-2 py-1 focus:outline-none"
          >
            <option value="all">{language === "zh" ? "全部难度" : "All Difficulties"}</option>
            <option value="easy">{language === "zh" ? "简单" : "Easy"}</option>
            <option value="medium">{language === "zh" ? "中等" : "Medium"}</option>
            <option value="hard">{language === "zh" ? "高难 🔥" : "Hard 🔥"}</option>
          </select>
        </div>
      </div>

      {/* Quick Upload Drop Area */}
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
        onClick={() => document.getElementById("quick-hub-file-upload")?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-all cursor-pointer bg-white ${
          isDragging
            ? "border-[#2b78a0] bg-[#e7f3f8]/30"
            : "border-[#e9e9e7] hover:border-[#dfdfde] hover:bg-[#fbfbfa]"
        }`}
      >
        <input
          id="quick-hub-file-upload"
          type="file"
          multiple
          accept=".txt,.md,.doc,.docx,.pdf,.rtf,image/*"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />
        <div className="flex items-center justify-center space-x-2 text-[#787774]">
          {isUploadingDocs ? (
            <div className="w-4 h-4 border-2 border-[#2b78a0] border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-4 h-4 text-[#2b78a0]" />
          )}
          <span className="text-xs font-semibold text-[#37352f]">
            {isUploadingDocs
              ? (uploadProgressText || (language === "zh" ? "正在智能解析文档..." : "Parsing document..."))
              : (hubTab === "questions"
                ? (language === "zh" ? "点击或拖拽上传真题试卷 / 习题集（PDF, Word, TXT）" : "Click or drag to upload exam papers / tests (PDF, Word, TXT)")
                : (language === "zh" ? "点击或拖拽上传讲义 / 课件 / 公式手册（PDF, Word, TXT）" : "Click or drag to upload lecture slides / notes / cheatsheets"))}
          </span>
        </div>
      </div>

      {/* Items Grid & Cards */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-[#e9e9e7] rounded-lg p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 mx-auto text-[#9b9a97] opacity-60" />
          <div>
            <h3 className="text-xs font-bold text-[#37352f]">
              {language === "zh" ? "暂无匹配的资料或试卷" : "No documents match the current filter"}
            </h3>
            <p className="text-[11px] text-[#787774] mt-0.5">
              {language === "zh" ? "您可以直接上传文件，或一键导入范例真题与名师讲义。" : "You can upload documents or load our curated sample sets."}
            </p>
          </div>
          <button
            onClick={handleLoadSampleDocuments}
            className="px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] border border-[#e9e9e7] rounded-md text-xs font-semibold transition-colors"
          >
            {language === "zh" ? "导入精选真题与讲义示例" : "Load Curated Sample Library"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isQuestion = item.categoryGroup === "exam_question" || item.type === "past_exam";
            return (
              <div
                key={item.id}
                className="bg-white border border-[#e9e9e7] hover:border-[#dfdfde] rounded-lg p-4 shadow-2xs flex flex-col justify-between space-y-3 transition-shadow"
              >
                <div className="space-y-2">
                  {/* Top Tags & Difficulty */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isQuestion ? "notion-tag-purple" : "notion-tag-blue"
                      }`}>
                        {isQuestion ? (language === "zh" ? "真题试卷" : "Exam Paper") : (language === "zh" ? "学习讲义" : "Study Note")}
                      </span>
                      {item.yearOrTerm && (
                        <span className="notion-tag-gray px-1.5 py-0.5 rounded text-[10px] text-[#787774]">
                          {item.yearOrTerm}
                        </span>
                      )}
                      {item.topicTag && (
                        <span className="notion-tag-orange px-1.5 py-0.5 rounded text-[10px] truncate max-w-[130px]">
                          {item.topicTag}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        item.difficulty === "hard"
                          ? "text-[#d44c47] bg-[#fdebec]"
                          : item.difficulty === "medium"
                          ? "text-[#cb912f] bg-[#fbf3db]"
                          : "text-[#448361] bg-[#edf3ec]"
                      }`}>
                        {item.difficulty === "hard" ? "高难 🔥" : item.difficulty === "medium" ? "中等" : "基础"}
                      </span>
                      <button
                        onClick={() => handleDeleteMaterial(item.id)}
                        className="text-[#9b9a97] hover:text-[#d44c47] p-1 transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Preview snippet */}
                  <div>
                    <h4 className="text-xs font-bold text-[#37352f] line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-[#787774] mt-1 line-clamp-2 leading-relaxed">
                      {item.summaryNotes || item.content.slice(0, 140)}
                    </p>
                  </div>

                  {/* Key Traps / Highlights if available */}
                  {item.keyTraps && item.keyTraps.length > 0 && (
                    <div className="p-2 bg-[#fbf3db]/50 border border-[#f5e0b7] rounded-md space-y-1">
                      <span className="text-[10px] font-bold text-[#cb912f] block">
                        {language === "zh" ? "⚠️ 历年高频易错考点 / 陷阱提醒：" : "⚠️ Key Exam Traps:"}
                      </span>
                      <ul className="text-[10px] text-[#787774] list-disc list-inside space-y-0.5">
                        {item.keyTraps.slice(0, 2).map((trap, tIdx) => (
                          <li key={tIdx} className="line-clamp-1">{trap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Bottom Actions Toolbar */}
                <div className="pt-2.5 border-t border-[#e9e9e7] flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => setPreviewDoc(item)}
                    className="text-[#787774] hover:text-[#37352f] flex items-center space-x-1 transition-colors text-[11px] font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === "zh" ? "查看原文" : "Read Content"}</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleAddToDailySchedule(item)}
                      className="px-2.5 py-1 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] border border-[#e9e9e7] rounded text-[11px] font-medium transition-colors flex items-center space-x-1"
                      title="Add to daily study plan"
                    >
                      <BookmarkPlus className="w-3 h-3 text-[#787774]" />
                      <span>{language === "zh" ? "安排刷题" : "Add Task"}</span>
                    </button>

                    <button
                      onClick={() => setActiveQuizMaterial(item)}
                      className="px-2.5 py-1 bg-[#37352f] hover:bg-[#201f1c] text-white rounded text-[11px] font-semibold transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#cb912f]" />
                      <span>{language === "zh" ? "AI 智能自测" : "AI Quiz"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Document / Paper Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
              <div className="flex items-center space-x-2">
                <span className="text-xl">
                  {hubTab === "questions" ? "📝" : "📚"}
                </span>
                <h3 className="font-bold text-sm text-[#37352f]">
                  {hubTab === "questions"
                    ? (language === "zh" ? "录入历年真题 / 模拟测试卷" : "Add Past Exam / Mock Paper")
                    : (language === "zh" ? "录入课程讲义 / 重点提纲" : "Add Lecture Notes / Outline")}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#9b9a97] hover:text-[#37352f] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "文档 / 试卷标题" : "Title"}
                </label>
                <input
                  type="text"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder={
                    hubTab === "questions"
                      ? (language === "zh" ? "例如：2025年 高级算法期末真题 (A卷)" : "e.g. 2025 Final Exam Paper A")
                      : (language === "zh" ? "例如：第 3 章 动态规划状态转移推导讲义" : "e.g. Chapter 3 Dynamic Programming Notes")
                  }
                  className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded px-3 py-2 text-xs focus:outline-none focus:border-[#2b78a0]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[#37352f] mb-1">
                    {language === "zh" ? "资料类型" : "Type"}
                  </label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                    className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="past_exam">{language === "zh" ? "历年真题 (Past Exam)" : "Past Exam"}</option>
                    <option value="notes">{language === "zh" ? "课堂笔记 (Notes)" : "Lecture Notes"}</option>
                    <option value="lecture_slides">{language === "zh" ? "课件提纲 (Slides)" : "Slides Outline"}</option>
                    <option value="textbook_outline">{language === "zh" ? "教材提纲 (Textbook)" : "Textbook Outline"}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#37352f] mb-1">
                    {language === "zh" ? "考期 / 来源年份" : "Term / Source Year"}
                  </label>
                  <input
                    type="text"
                    value={newDocYear}
                    onChange={(e) => setNewDocYear(e.target.value)}
                    placeholder={language === "zh" ? "例如：2025 秋季期末" : "e.g. 2025 Fall Final"}
                    className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#37352f] mb-1">
                    {language === "zh" ? "难度评估" : "Difficulty"}
                  </label>
                  <select
                    value={newDocDifficulty}
                    onChange={(e) => setNewDocDifficulty(e.target.value as any)}
                    className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value="easy">{language === "zh" ? "简单" : "Easy"}</option>
                    <option value="medium">{language === "zh" ? "中等" : "Medium"}</option>
                    <option value="hard">{language === "zh" ? "高难 🔥" : "Hard 🔥"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#37352f] mb-1">
                  {language === "zh" ? "归属考点标签" : "Topic Tag"}
                </label>
                <select
                  value={newDocTopicTag}
                  onChange={(e) => setNewDocTopicTag(e.target.value)}
                  className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">{language === "zh" ? "选择或不指定" : "Select Topic (Optional)"}</option>
                  {plan.topics?.map((topic) => (
                    <option key={topic.id} value={topic.title}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-[#37352f]">
                    {language === "zh" ? "试卷题目或讲义文本内容" : "Content Text"}
                  </label>
                  <label className="text-[11px] text-[#2b78a0] hover:underline cursor-pointer flex items-center space-x-1">
                    <Upload className="w-3 h-3" />
                    <span>{language === "zh" ? "从文件导入 (PDF/Word/TXT)" : "Import from file"}</span>
                    <input
                      type="file"
                      accept=".txt,.md,.doc,.docx,.pdf,.rtf,image/*"
                      onChange={(e) => handleModalFileSelect(e.target.files)}
                      className="hidden"
                    />
                  </label>
                </div>
                <textarea
                  rows={8}
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder={
                    hubTab === "questions"
                      ? (language === "zh" ? "在此粘贴真题题目、选择题、问答证明大题及参考答案解析..." : "Paste exam questions, choices, step-by-step problem sets and solutions...")
                      : (language === "zh" ? "在此粘贴核心概念定理、公式推导、章节笔记..." : "Paste lecture theorems, formulas, and notes here...")
                  }
                  className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded p-3 text-xs focus:outline-none focus:border-[#2b78a0] font-mono resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#e9e9e7]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded text-xs font-semibold transition-colors"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSaveNewMaterial}
                disabled={!newDocContent.trim()}
                className="px-4 py-1.5 bg-[#37352f] hover:bg-[#201f1c] disabled:opacity-50 text-white rounded text-xs font-semibold transition-colors shadow-2xs"
              >
                {language === "zh" ? "保存并添加到资料库" : "Save to Library"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Content Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white border border-[#e9e9e7] rounded-xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#e9e9e7]">
              <div className="flex items-center space-x-2 truncate">
                <FileText className="w-4 h-4 text-[#2b78a0]" />
                <h3 className="font-bold text-sm text-[#37352f] truncate">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-[#9b9a97] hover:text-[#37352f] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#fbfbfa] border border-[#e9e9e7] rounded-md p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-[#37352f]">
              {previewDoc.content}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#e9e9e7] text-xs">
              <span className="text-[#787774]">
                {previewDoc.sizeBytes ? `${Math.round(previewDoc.sizeBytes / 1024)} KB` : ""} •{" "}
                {new Date(previewDoc.uploadedAt).toLocaleDateString()}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const target = previewDoc;
                    setPreviewDoc(null);
                    handleAddToDailySchedule(target);
                  }}
                  className="px-3 py-1.5 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] rounded font-semibold transition-colors"
                >
                  {language === "zh" ? "安排进备考待办" : "Add as Task"}
                </button>
                <button
                  onClick={() => {
                    const target = previewDoc;
                    setPreviewDoc(null);
                    setActiveQuizMaterial(target);
                  }}
                  className="px-3.5 py-1.5 bg-[#37352f] hover:bg-[#201f1c] text-white rounded font-semibold transition-colors shadow-2xs"
                >
                  {language === "zh" ? "根据本文档出题自测" : "Launch AI Quiz"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quiz Modal for Active Document */}
      {activeQuizMaterial && (
        <QuizModal
          task={{
            id: `task-quiz-${activeQuizMaterial.id}`,
            title: activeQuizMaterial.name,
            description: activeQuizMaterial.summaryNotes || activeQuizMaterial.content.slice(0, 100),
            category: "active_recall",
            topicTitle: activeQuizMaterial.topicTag || activeQuizMaterial.name,
            date: new Date().toISOString().split("T")[0],
            durationMinutes: 30,
            priority: "high",
            status: "pending",
            keyObjectives: activeQuizMaterial.keyTraps || [activeQuizMaterial.name],
          }}
          isOpen={!!activeQuizMaterial}
          onClose={() => setActiveQuizMaterial(null)}
          onMasteryUpdated={(rating) => {
            alert(language === "zh" ? `已记录掌握度评分：${rating} 星！` : `Mastery logged: ${rating} stars!`);
          }}
        />
      )}
    </div>
  );
}
