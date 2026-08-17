import React, { useState } from "react";
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
  FolderOpen
} from "lucide-react";
import { SyllabusTopic, StudyMaterial } from "../types";
import { SAMPLE_MATERIALS } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { parseDocumentFile } from "../lib/documentParser";

interface CourseSyllabusManagerProps {
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
  onProceedToPlanConfig: () => void;
  onGoToMaterialsAndQuestions?: () => void;
}

export function CourseSyllabusManager({
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
  onProceedToPlanConfig,
  onGoToMaterialsAndQuestions,
}: CourseSyllabusManagerProps) {
  const { t, language } = useI18n();
  const [isExtracting, setIsExtracting] = useState(false);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [parsingStatus, setParsingStatus] = useState<string>("");
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Load curated sample course curriculum
  const handleLoadSampleCourse = (sample: (typeof SAMPLE_MATERIALS)[0]) => {
    onExamNameChange(sample.name.replace("大纲", "").replace("Syllabus", "").trim() || sample.name);
    onSubjectChange(sample.subject);
    onSyllabusDocNameChange(sample.name);
    onSyllabusContentChange(sample.text);
  };

  // Handle syllabus files upload (multiple files supported: PDF, Word DOCX, TXT, MD, Images)
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsingDoc(true);
    setExtractError(null);

    const fileArray = Array.from(files);
    let combinedContent = syllabusContent ? syllabusContent + "\n\n" : "";
    const processedNames: string[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setParsingStatus(
        language === "zh"
          ? `正在解析 (${i + 1}/${fileArray.length})：${file.name}...`
          : `Parsing (${i + 1}/${fileArray.length}): ${file.name}...`
      );

      try {
        const parsed = await parseDocumentFile(file, language, (status) => setParsingStatus(status));
        processedNames.push(file.name);
        combinedContent += `\n\n=== 课程资料: ${file.name} ===\n${parsed.text}\n`;

        if (!examName && (file.name.includes("大纲") || file.name.includes("syllabus") || i === 0)) {
          onExamNameChange(file.name.replace(/\.[^/.]+$/, "").replace(/大纲|syllabus|期末|考试/i, "").trim() || file.name);
        }
      } catch (err: any) {
        console.error(err);
      }
    }

    if (processedNames.length > 0) {
      const newDocDisplayName = processedNames.length === 1 
        ? processedNames[0] 
        : `${processedNames.length} 份课程资料 (${processedNames.slice(0, 2).join(", ")}${processedNames.length > 2 ? " 等" : ""})`;
      
      onSyllabusDocNameChange(newDocDisplayName);
      onSyllabusContentChange(combinedContent.trim());
    }

    setIsParsingDoc(false);
    setParsingStatus("");
  };

  // Trigger Gemini AI extraction of syllabus topics
  const handleExtractSyllabus = async () => {
    if (!syllabusContent.trim()) {
      setExtractError(language === "zh" ? "请先上传或粘贴课程大纲内容。" : "Please upload or paste your course syllabus content first.");
      return;
    }

    setIsExtracting(true);
    setExtractError(null);

    const syntheticMaterial: StudyMaterial = {
      id: `syllabus-mat-${Date.now()}`,
      name: syllabusDocName || `${examName || "课程"} 考纲大纲`,
      type: "syllabus",
      categoryGroup: "course_syllabus",
      content: syllabusContent.trim(),
      uploadedAt: new Date().toISOString(),
      sizeBytes: new Blob([syllabusContent]).size,
    };

    try {
      const res = await fetch("/api/extract-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materials: [syntheticMaterial],
          examName: examName || (language === "zh" ? "即将到来的考试" : "Upcoming Exam"),
          subject: subject || (language === "zh" ? "综合学科" : "General"),
          language,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || (language === "zh" ? "解析大纲失败" : "Failed to extract syllabus"));
      }

      const data = await res.json();
      if (data.summary) {
        onMaterialsSummaryChange(data.summary);
      }
      if (data.topics && Array.isArray(data.topics)) {
        onTopicsChange(data.topics);
      }
    } catch (err: any) {
      console.error(err);
      setExtractError(err.message || (language === "zh" ? "解析大纲失败，请重试。" : "Failed to extract syllabus. Check your connection or API key."));
    } finally {
      setIsExtracting(false);
    }
  };

  // Topic editing helpers
  const handleUpdateTopic = (index: number, updated: Partial<SyllabusTopic>) => {
    const next = [...topics];
    next[index] = { ...next[index], ...updated };
    onTopicsChange(next);
  };

  const handleAddManualTopic = () => {
    const newTopic: SyllabusTopic = {
      id: `topic-${Date.now()}`,
      title: language === "zh" ? "新建大纲知识点模块" : "New Syllabus Topic",
      category: language === "zh" ? "核心考点" : "Core Module",
      difficulty: "medium",
      userKnowledgeLevel: "intermediate",
      estimatedHours: 4,
      weightPercentage: 15,
      subtopics: language === "zh" ? ["基础概念与定理", "综合典型题演练"] : ["Key Concept A", "Practice Problem Set B"],
    };
    onTopicsChange([...topics, newTopic]);
  };

  const handleDeleteTopic = (index: number) => {
    onTopicsChange(topics.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      {/* Notion Callout Header: Course & Syllabus Setup */}
      <div className="notion-callout p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#e9e9e7] bg-[#fbfbfa]">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-lg bg-[#37352f] text-white flex items-center justify-center shrink-0 shadow-2xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[#37352f]">
                {language === "zh" ? "新建 / 导入课程与考纲架构" : "Course Profile & Syllabus Architecture"}
              </h2>
              <span className="notion-tag-blue px-2 py-0.5 rounded text-[10px] font-semibold">
                {language === "zh" ? "课程架构" : "Curriculum Step"}
              </span>
            </div>
            <p className="text-xs text-[#787774] mt-0.5 max-w-xl leading-relaxed">
              {language === "zh"
                ? "输入课程基本信息并上传教学大纲或单元提纲。AI 将智能解析章节考点、分值权重及复习梯度。"
                : "Enter course details and upload your syllabus outline. AI will extract domains, exam weightings, and recommended study hours."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
          <span className="text-[11px] text-[#787774] mr-1">
            {language === "zh" ? "载入范例课程:" : "Sample Courses:"}
          </span>
          {SAMPLE_MATERIALS.map((sample, i) => (
            <button
              key={i}
              id={`sample-course-btn-${i}`}
              onClick={() => handleLoadSampleCourse(sample)}
              className="px-2.5 py-1 bg-white hover:bg-[#efefed] text-[#37352f] border border-[#e9e9e7] rounded-md text-xs font-medium transition-colors shadow-2xs"
            >
              {sample.subject}
            </button>
          ))}
        </div>
      </div>

      {/* Course Profile Form */}
      <div className="bg-white border border-[#e9e9e7] rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-[#2b78a0]" />
            <span>{language === "zh" ? "课程基本档案" : "Course Profile"}</span>
          </h3>
          {onGoToMaterialsAndQuestions && (
            <button
              onClick={onGoToMaterialsAndQuestions}
              className="text-xs text-[#2b78a0] hover:text-[#1d526e] flex items-center space-x-1 font-medium transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "前往该课程题库与资料库 →" : "View Question Bank & Materials →"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#37352f] mb-1">
              {language === "zh" ? "课程 / 考试名称" : "Course / Exam Name"}
            </label>
            <input
              id="course-name-input"
              type="text"
              value={examName}
              onChange={(e) => onExamNameChange(e.target.value)}
              placeholder={language === "zh" ? "例如：CS 301 高级算法与数据结构期末考" : "e.g. CS 301 Advanced Algorithms Final"}
              className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-3 py-2 text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#37352f] mb-1">
              {language === "zh" ? "学科 / 专业方向" : "Subject / Major Discipline"}
            </label>
            <input
              id="course-subject-input"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder={language === "zh" ? "例如：计算机科学、医学生物、法学理论" : "e.g. Computer Science, Medicine, Law"}
              className="w-full bg-[#fbfbfa] border border-[#e9e9e7] rounded-md px-3 py-2 text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0] focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Course Syllabus Ingestion (Upload file or direct paste) */}
      <div className="bg-white border border-[#e9e9e7] rounded-lg p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#e9e9e7]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#787774] flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-[#2b78a0]" />
              <span>{language === "zh" ? "课程教学大纲与章节提纲" : "Course Syllabus Outline"}</span>
            </h3>
            <p className="text-[11px] text-[#787774] mt-0.5">
              {language === "zh"
                ? "上传讲师发布的 Syllabus 文件（.pdf、.txt、.md）或直接粘贴章节考点清单。"
                : "Upload instructor syllabus files or directly paste the chapters & learning objectives outline."}
            </p>
          </div>
          {syllabusDocName && (
            <span className="notion-tag-gray px-2 py-0.5 rounded text-[11px] font-medium truncate max-w-xs flex items-center space-x-1">
              <FileText className="w-3 h-3 text-[#787774]" />
              <span>{syllabusDocName}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Drag and Drop box */}
          <div className="lg:col-span-4">
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
              onClick={() => document.getElementById("syllabus-file-input")?.click()}
              className={`h-full min-h-[160px] border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white ${
                isDragging
                  ? "border-[#2b78a0] bg-[#e7f3f8]/30"
                  : "border-[#e9e9e7] hover:border-[#dfdfde] hover:bg-[#fbfbfa]"
              }`}
            >
              <input
                id="syllabus-file-input"
                type="file"
                multiple
                accept=".txt,.md,.doc,.docx,.pdf,.rtf,image/*"
                onChange={(e) => handleFileUpload(e.target.files)}
                className="hidden"
              />
              <div className="w-9 h-9 rounded-lg bg-[#f7f6f3] border border-[#e9e9e7] flex items-center justify-center text-[#787774] mb-2">
                {isParsingDoc ? (
                  <div className="w-4 h-4 border-2 border-[#2b78a0] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </div>
              <h4 className="font-semibold text-[#37352f] text-xs">
                {isParsingDoc
                  ? (parsingStatus || (language === "zh" ? "正在解析文档..." : "Parsing document..."))
                  : (language === "zh" ? "上传或追加课程考纲文件（支持多选）" : "Upload or add course files (multi-select)")}
              </h4>
              <p className="text-[10px] text-[#787774] mt-0.5">
                {language === "zh" ? "支持 PDF, Word (.docx), TXT, Markdown，可添加多份文件" : "Supports PDF, Word, TXT, Markdown (multiple files)"}
              </p>
            </div>
          </div>

          {/* Right: Direct Syllabus Textarea */}
          <div className="lg:col-span-8 flex flex-col space-y-2">
            <textarea
              id="syllabus-text-input"
              rows={6}
              value={syllabusContent}
              onChange={(e) => onSyllabusContentChange(e.target.value)}
              placeholder={
                language === "zh"
                  ? "在此粘贴课程考纲内容、章节目录、知识点分值要求或教学周历..."
                  : "Paste syllabus text, course unit outlines, chapter breakdown, or weekly lecture topics here..."
              }
              className="w-full flex-1 bg-[#fbfbfa] border border-[#e9e9e7] rounded-md p-3 text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0] font-mono resize-y"
            />
          </div>
        </div>

        {/* AI Parse Button */}
        <div className="pt-3 border-t border-[#e9e9e7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-[#787774]">
            {syllabusContent ? (
              <span>
                {language === "zh" ? "已就绪" : "Ready"}: {syllabusContent.length}{" "}
                {language === "zh" ? "字符" : "characters"}
              </span>
            ) : (
              <span>{language === "zh" ? "等待输入考纲内容" : "Waiting for syllabus input"}</span>
            )}
          </div>

          {extractError && (
            <div className="p-2 bg-[#fdebec] border border-[#f9d3d5] text-[#d44c47] text-xs rounded-md flex items-center space-x-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{extractError}</span>
            </div>
          )}

          <button
            id="extract-course-syllabus-btn"
            type="button"
            onClick={handleExtractSyllabus}
            disabled={isExtracting || !syllabusContent.trim()}
            className="flex items-center justify-center space-x-2 py-2 px-5 bg-[#37352f] hover:bg-[#201f1c] disabled:opacity-50 text-white font-semibold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
          >
            {isExtracting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{language === "zh" ? "AI 正在智能解析考纲架构..." : "Analyzing Syllabus Architecture..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-[#cb912f]" />
                <span>{language === "zh" ? "AI 智能结构化考纲知识点" : "AI Extract Structured Topics"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Structured Syllabus Topics Database Section */}
      {topics.length > 0 && (
        <div className="bg-white border border-[#e9e9e7] rounded-lg overflow-hidden shadow-xs space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e9e9e7]">
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-[#448361]">
                <Check className="w-3.5 h-3.5" />
                <span>
                  {topics.length} {language === "zh" ? "个课程重点知识领域已结构化" : "Core Syllabus Domains Structured"}
                </span>
              </div>
              <h3 className="text-sm font-bold text-[#37352f] mt-0.5">
                {language === "zh" ? "课程知识点大纲与学时规划表" : "Curriculum Domains & Study Allocation"}
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddManualTopic}
                className="flex items-center space-x-1 px-2.5 py-1 bg-[#f7f6f3] hover:bg-[#efefed] text-[#37352f] border border-[#e9e9e7] rounded-md text-xs font-medium transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("addTopic")}</span>
              </button>

              <button
                id="proceed-to-schedule-btn"
                onClick={onProceedToPlanConfig}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#448361] hover:bg-[#376b4f] text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
              >
                <span>{language === "zh" ? "配置复习作息并生成计划 →" : "Proceed to Schedule Setup →"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Topics Table */}
          <div className="border border-[#e9e9e7] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f7f6f3] border-b border-[#e9e9e7] text-[#787774] font-medium">
                  <th className="py-2 px-3">{t("tableTopicTitle")}</th>
                  <th className="py-2 px-3 w-28">{t("tableWeight")}</th>
                  <th className="py-2 px-3 w-28">{t("tableDifficulty")}</th>
                  <th className="py-2 px-3 w-24">{t("tableEstHours")}</th>
                  <th className="py-2 px-3 w-16 text-center">{t("tableAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e9e9e7]">
                {topics.map((topic, idx) => (
                  <tr key={topic.id || idx} className="hover:bg-[#f7f6f3]/60 transition-colors">
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={topic.title}
                        onChange={(e) => handleUpdateTopic(idx, { title: e.target.value })}
                        className="font-medium text-xs text-[#37352f] bg-transparent border-b border-transparent hover:border-[#dfdfde] focus:border-[#2b78a0] focus:outline-none w-full"
                      />
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {topic.subtopics.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="notion-tag-gray px-1.5 py-0.2 rounded text-[10px]"
                            >
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={topic.weightPercentage || 20}
                          onChange={(e) => handleUpdateTopic(idx, { weightPercentage: Number(e.target.value) })}
                          className="w-12 bg-white border border-[#e9e9e7] rounded px-1.5 py-0.5 text-xs text-[#37352f]"
                        />
                        <span className="text-[#787774]">%</span>
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <select
                        value={topic.difficulty}
                        onChange={(e) => handleUpdateTopic(idx, { difficulty: e.target.value as any })}
                        className="w-full bg-white border border-[#e9e9e7] rounded px-1.5 py-0.5 text-xs text-[#37352f]"
                      >
                        <option value="easy">{language === "zh" ? "简单" : "Easy"}</option>
                        <option value="medium">{language === "zh" ? "中等" : "Medium"}</option>
                        <option value="hard">{language === "zh" ? "高难" : "Hard"}</option>
                      </select>
                    </td>

                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={topic.estimatedHours || 4}
                          onChange={(e) => handleUpdateTopic(idx, { estimatedHours: Number(e.target.value) })}
                          className="w-12 bg-white border border-[#e9e9e7] rounded px-1.5 py-0.5 text-xs text-[#37352f]"
                        />
                        <span className="text-[#787774]">{language === "zh" ? "小时" : "h"}</span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteTopic(idx)}
                        className="text-[#9b9a97] hover:text-[#d44c47] p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
