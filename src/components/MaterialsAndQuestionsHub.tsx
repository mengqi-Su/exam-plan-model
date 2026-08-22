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
  GraduationCap,
  AlertTriangle,
  Flame
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

  const [hubTab, setHubTab] = useState<"questions" | "notes">("questions");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

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

  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  const [activeQuizMaterial, setActiveQuizMaterial] = useState<StudyMaterial | null>(null);

  const materials: StudyMaterial[] = plan.materials || INITIAL_SAMPLE_DOCUMENTS;

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

    setNewDocTitle("");
    setNewDocContent("");
    setNewDocYear("");
    setNewDocTopicTag("");
    setIsAddModalOpen(false);
  };

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

  const handleDeleteMaterial = (id: string) => {
    const updated = materials.filter((m) => m.id !== id);
    onUpdatePlan({
      ...plan,
      materials: updated,
    });
  };

  const handleLoadSampleDocuments = () => {
    onUpdatePlan({
      ...plan,
      materials: INITIAL_SAMPLE_DOCUMENTS,
    });
  };

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
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6 font-mono text-[#111111]">

      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#111111] bg-[#fafafa]">
        <div className="flex items-start space-x-3">
          <span className="px-2 py-1 bg-[#111111] text-white text-xs font-bold shrink-0">
            [REPOSITORY]
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold uppercase tracking-tight text-[#111111]">
                {language === "zh" ? "题库真题与课程学习资料库" : "Question Bank & Learning Materials Hub"}
              </h2>
              <span className="border border-[#111111] bg-white px-2 py-0.5 text-[10px] font-bold">
                [{plan.examName}]
              </span>
            </div>
            <p className="text-xs text-[#666666] mt-1 max-w-2xl leading-relaxed">
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
              className="px-3 py-1.5 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "[查看课程考纲架构]" : "[COURSE SYLLABUS]"}</span>
            </button>
          )}

          <button
            onClick={() => {
              setNewDocType(hubTab === "questions" ? "past_exam" : "notes");
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-bold transition-colors flex items-center space-x-1 border border-[#111111] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{hubTab === "questions" ? (language === "zh" ? "[上传真题试卷]" : "[ADD EXAM PAPER]") : (language === "zh" ? "[上传课件笔记]" : "[ADD STUDY NOTES]")}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#111111] pb-1">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setHubTab("questions");
              setFilterType("all");
            }}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              hubTab === "questions"
                ? "border-[#111111] text-white bg-[#111111]"
                : "border-transparent text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]"
            }`}
          >
            <FileQuestion className="w-4 h-4" />
            <span>
              {language === "zh" ? "历年真题与试卷题库" : "EXAM PAPERS & BANK"} [{questionPapers.length}]
            </span>
          </button>

          <button
            onClick={() => {
              setHubTab("notes");
              setFilterType("all");
            }}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold transition-colors border-b-2 cursor-pointer ${
              hubTab === "notes"
                ? "border-[#111111] text-white bg-[#111111]"
                : "border-transparent text-[#666666] hover:text-[#111111] hover:bg-[#fafafa]"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>
              {language === "zh" ? "课程讲义与学习资料" : "LECTURE SLIDES & NOTES"} [{studyNotes.length}]
            </span>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#999999]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "zh" ? "按标题、考点搜索..." : "SEARCH..."}
              className="pl-8 pr-2.5 py-1 text-xs bg-[#fafafa] border border-[#111111] text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white w-44 sm:w-56 font-mono"
            />
          </div>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="text-xs bg-[#fafafa] text-[#111111] border border-[#111111] px-2 py-1 focus:outline-none font-bold"
          >
            <option value="all">{language === "zh" ? "全部难度" : "ALL DIFFICULTIES"}</option>
            <option value="easy">{language === "zh" ? "简单" : "EASY"}</option>
            <option value="medium">{language === "zh" ? "中等" : "MEDIUM"}</option>
            <option value="hard">{language === "zh" ? "高难" : "HARD"}</option>
          </select>
        </div>
      </div>

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
        className={`border border-dashed border-[#111111] p-4 text-center transition-all cursor-pointer ${
          isDragging
            ? "bg-[#111111] text-white"
            : "bg-[#fafafa] hover:bg-white text-[#111111]"
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
        <div className="flex items-center justify-center space-x-2">
          {isUploadingDocs ? (
            <div className="w-4 h-4 border-2 border-[#111111] border-t-transparent animate-spin" />
          ) : (
            <Upload className="w-4 h-4 text-[#111111]" />
          )}
          <span className="text-xs font-bold">
            {isUploadingDocs
              ? (uploadProgressText || (language === "zh" ? "正在智能解析文档..." : "Parsing document..."))
              : (hubTab === "questions"
                ? (language === "zh" ? "[点击或拖拽上传真题试卷 / 习题集 (PDF, Word, TXT)]" : "[UPLOAD EXAM PAPERS / TESTS (PDF, WORD, TXT)]")
                : (language === "zh" ? "[点击或拖拽上传讲义 / 课件 / 公式手册 (PDF, Word, TXT)]" : "[UPLOAD LECTURE SLIDES / NOTES / CHEATSHEETS]"))}
          </span>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="bg-white border border-[#111111] p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 mx-auto text-[#111111] opacity-40" />
          <div>
            <h3 className="text-xs font-bold text-[#111111] uppercase">
              {language === "zh" ? "暂无匹配的资料或试卷" : "NO MATCHING DOCUMENTS"}
            </h3>
            <p className="text-[11px] text-[#666666] mt-1">
              {language === "zh" ? "您可以直接上传文件，或一键导入范例真题与名师讲义。" : "You can upload documents or load curated sample sets."}
            </p>
          </div>
          <button
            onClick={handleLoadSampleDocuments}
            className="px-3 py-1.5 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
          >
            {language === "zh" ? "[导入精选真题与讲义示例]" : "[LOAD CURATED SAMPLE LIBRARY]"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isQuestion = item.categoryGroup === "exam_question" || item.type === "past_exam";
            return (
              <div
                key={item.id}
                className="bg-white border border-[#111111] p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="border border-[#111111] bg-[#111111] text-white px-2 py-0.5 text-[9px] font-bold">
                        {isQuestion ? (language === "zh" ? "真题试卷" : "EXAM") : (language === "zh" ? "学习讲义" : "NOTES")}
                      </span>
                      {item.yearOrTerm && (
                        <span className="border border-[#111111] bg-[#fafafa] px-1.5 py-0.5 text-[9px] font-bold text-[#111111]">
                          {item.yearOrTerm}
                        </span>
                      )}
                      {item.topicTag && (
                        <span className="border border-[#111111] bg-white px-1.5 py-0.5 text-[9px] font-bold text-[#111111] truncate max-w-[130px]">
                          {item.topicTag}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <span className="border border-[#111111] bg-[#fafafa] px-1.5 py-0.5 text-[9px] font-bold">
                        [{item.difficulty === "hard" ? (language === "zh" ? "高难" : "HARD") : item.difficulty === "medium" ? (language === "zh" ? "中等" : "MED") : (language === "zh" ? "基础" : "EASY")}]
                      </span>
                      <button
                        onClick={() => handleDeleteMaterial(item.id)}
                        className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
                        title="Delete document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#111111] line-clamp-1 uppercase">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-[#666666] mt-1 line-clamp-2 leading-relaxed font-mono">
                      {item.summaryNotes || item.content.slice(0, 140)}
                    </p>
                  </div>

                  {item.keyTraps && item.keyTraps.length > 0 && (
                    <div className="p-2 bg-[#fafafa] border border-[#111111] space-y-1">
                      <span className="text-[10px] font-bold text-[#111111] flex items-center space-x-1 uppercase">
                        <AlertTriangle className="w-3 h-3 text-[#111111] shrink-0" />
                        <span>{language === "zh" ? "[历年高频易错考点 / 陷阱提醒]:" : "[KEY EXAM TRAPS]:"}</span>
                      </span>
                      <ul className="text-[10px] text-[#666666] list-disc list-inside space-y-0.5">
                        {item.keyTraps.slice(0, 2).map((trap, tIdx) => (
                          <li key={tIdx} className="line-clamp-1">{trap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-[#111111] flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => setPreviewDoc(item)}
                    className="text-[#111111] hover:underline flex items-center space-x-1 transition-colors text-[11px] font-bold cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{language === "zh" ? "[查看原文]" : "[READ CONTENT]"}</span>
                  </button>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleAddToDailySchedule(item)}
                      className="px-2.5 py-1 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-[10px] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                      title="Add to daily study plan"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>{language === "zh" ? "[安排刷题]" : "[ADD TASK]"}</span>
                    </button>

                    <button
                      onClick={() => setActiveQuizMaterial(item)}
                      className="px-2.5 py-1 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-[10px] font-bold transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>{language === "zh" ? "[AI 智能自测]" : "[AI QUIZ]"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#111111]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#111111] w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto font-mono text-[#111111]">
            <div className="flex items-center justify-between pb-3 border-b border-[#111111]">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-[#111111] text-white text-xs font-bold">
                  {hubTab === "questions" ? "[EXAM]" : "[NOTES]"}
                </span>
                <h3 className="font-bold text-xs uppercase tracking-tight text-[#111111]">
                  {hubTab === "questions"
                    ? (language === "zh" ? "录入历年真题 / 模拟测试卷" : "ADD PAST EXAM / MOCK PAPER")
                    : (language === "zh" ? "录入课程讲义 / 重点提纲" : "ADD LECTURE NOTES / OUTLINE")}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "文档 / 试卷标题" : "TITLE"}
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
                  className="w-full bg-[#fafafa] border border-[#111111] px-3 py-2 text-xs focus:outline-none focus:bg-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold uppercase text-[#111111] mb-1">
                    {language === "zh" ? "资料类型" : "TYPE"}
                  </label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value as any)}
                    className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs focus:outline-none font-bold"
                  >
                    <option value="past_exam">{language === "zh" ? "历年真题 (Past Exam)" : "Past Exam"}</option>
                    <option value="notes">{language === "zh" ? "课堂笔记 (Notes)" : "Lecture Notes"}</option>
                    <option value="lecture_slides">{language === "zh" ? "课件提纲 (Slides)" : "Slides Outline"}</option>
                    <option value="textbook_outline">{language === "zh" ? "教材提纲 (Textbook)" : "Textbook Outline"}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold uppercase text-[#111111] mb-1">
                    {language === "zh" ? "考期 / 来源年份" : "TERM / YEAR"}
                  </label>
                  <input
                    type="text"
                    value={newDocYear}
                    onChange={(e) => setNewDocYear(e.target.value)}
                    placeholder={language === "zh" ? "例如：2025 秋季期末" : "e.g. 2025 Fall Final"}
                    className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold uppercase text-[#111111] mb-1">
                    {language === "zh" ? "难度评估" : "DIFFICULTY"}
                  </label>
                  <select
                    value={newDocDifficulty}
                    onChange={(e) => setNewDocDifficulty(e.target.value as any)}
                    className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs focus:outline-none font-bold"
                  >
                    <option value="easy">{language === "zh" ? "简单" : "Easy"}</option>
                    <option value="medium">{language === "zh" ? "中等" : "Medium"}</option>
                    <option value="hard">{language === "zh" ? "高难" : "Hard"}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase text-[#111111] mb-1">
                  {language === "zh" ? "归属考点标签" : "TOPIC TAG"}
                </label>
                <select
                  value={newDocTopicTag}
                  onChange={(e) => setNewDocTopicTag(e.target.value)}
                  className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs focus:outline-none font-bold"
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
                  <label className="font-bold uppercase text-[#111111]">
                    {language === "zh" ? "试卷题目或讲义文本内容" : "CONTENT TEXT"}
                  </label>
                  <label className="text-[10px] text-[#111111] hover:underline cursor-pointer flex items-center space-x-1 font-bold">
                    <Upload className="w-3 h-3" />
                    <span>{language === "zh" ? "[从文件导入 (PDF/Word/TXT)]" : "[IMPORT FILE]"}</span>
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
                  className="w-full bg-[#fafafa] border border-[#111111] p-3 text-xs focus:outline-none focus:bg-white font-mono resize-y"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#111111]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-1.5 bg-white hover:bg-[#fafafa] text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
              >
                [{t("cancel")}]
              </button>
              <button
                type="button"
                onClick={handleSaveNewMaterial}
                disabled={!newDocContent.trim()}
                className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white text-xs font-bold transition-colors border border-[#111111] cursor-pointer"
              >
                {language === "zh" ? "[保存并添加到资料库]" : "[SAVE TO LIBRARY]"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-[#111111]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#111111] w-full max-w-2xl p-6 space-y-4 max-h-[90vh] flex flex-col font-mono text-[#111111]">
            <div className="flex items-center justify-between pb-3 border-b border-[#111111]">
              <div className="flex items-center space-x-2 truncate">
                <span className="px-1.5 py-0.5 bg-[#111111] text-white text-xs font-bold">
                  [DOC]
                </span>
                <h3 className="font-bold text-xs uppercase text-[#111111] truncate">
                  {previewDoc.name}
                </h3>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#fafafa] border border-[#111111] p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-[#111111]">
              {previewDoc.content}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#111111] text-xs">
              <span className="text-[#666666] font-bold">
                {previewDoc.sizeBytes ? `${Math.round(previewDoc.sizeBytes / 1024)} KB` : ""}
                {new Date(previewDoc.uploadedAt).toLocaleDateString()}
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const target = previewDoc;
                    setPreviewDoc(null);
                    handleAddToDailySchedule(target);
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] font-bold transition-colors cursor-pointer text-xs"
                >
                  {language === "zh" ? "[安排进备考待办]" : "[ADD AS TASK]"}
                </button>
                <button
                  onClick={() => {
                    const target = previewDoc;
                    setPreviewDoc(null);
                    setActiveQuizMaterial(target);
                  }}
                  className="px-3.5 py-1.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] font-bold transition-colors cursor-pointer text-xs"
                >
                  {language === "zh" ? "[根据本文档出题自测]" : "[LAUNCH AI QUIZ]"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
