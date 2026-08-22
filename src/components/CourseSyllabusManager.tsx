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

  const handleLoadSampleCourse = (sample: (typeof SAMPLE_MATERIALS)[0]) => {
    onExamNameChange(sample.name.replace("大纲", "").replace("Syllabus", "").trim() || sample.name);
    onSubjectChange(sample.subject);
    onSyllabusDocNameChange(sample.name);
    onSyllabusContentChange(sample.text);
  };

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
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 space-y-6 font-mono text-[#111111]">

      <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#111111] bg-[#fafafa]">
        <div className="flex items-start space-x-3">
          <span className="px-2 py-1 bg-[#111111] text-white text-xs font-bold shrink-0">
            [CURRICULUM]
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold uppercase tracking-tight text-[#111111]">
                {language === "zh" ? "新建 / 导入课程与考纲架构" : "Course Profile & Syllabus Architecture"}
              </h2>
            </div>
            <p className="text-xs text-[#666666] mt-1 max-w-xl leading-relaxed">
              {language === "zh"
                ? "输入课程基本信息并上传教学大纲或单元提纲。AI 将智能解析章节考点、分值权重及复习梯度。"
                : "Enter course details and upload your syllabus outline. AI will extract domains, exam weightings, and recommended study hours."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
          <span className="text-[10px] uppercase font-bold text-[#666666] mr-1">
            {language === "zh" ? "[范例课程]:" : "[SAMPLES]:"}
          </span>
          {SAMPLE_MATERIALS.map((sample, i) => (
            <button
              key={i}
              id={`sample-course-btn-${i}`}
              onClick={() => handleLoadSampleCourse(sample)}
              className="px-2.5 py-1 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              [{sample.subject}]
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#111111] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-1.5">
            <span>[COURSE PROFILE]</span>
          </h3>
          {onGoToMaterialsAndQuestions && (
            <button
              onClick={onGoToMaterialsAndQuestions}
              className="text-xs text-[#111111] hover:underline font-bold transition-colors cursor-pointer"
            >
              <span>{language === "zh" ? "[前往该课程题库与资料库 →]" : "[VIEW QUESTION BANK & MATERIALS →]"}</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#111111] uppercase mb-1">
              {language === "zh" ? "课程 / 考试名称" : "Course / Exam Name"}
            </label>
            <input
              id="course-name-input"
              type="text"
              value={examName}
              onChange={(e) => onExamNameChange(e.target.value)}
              placeholder={language === "zh" ? "例如：CS 301 高级算法与数据结构期末考" : "e.g. CS 301 Advanced Algorithms Final"}
              className="w-full bg-[#fafafa] border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#111111] uppercase mb-1">
              {language === "zh" ? "学科 / 专业方向" : "Subject / Major Discipline"}
            </label>
            <input
              id="course-subject-input"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder={language === "zh" ? "例如：计算机科学、医学生物、法学理论" : "e.g. Computer Science, Medicine, Law"}
              className="w-full bg-[#fafafa] border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#111111] p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#111111]">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111] flex items-center space-x-1.5">
              <span>[COURSE SYLLABUS OUTLINE]</span>
            </h3>
            <p className="text-[11px] text-[#666666] mt-0.5">
              {language === "zh"
                ? "上传讲师发布的 Syllabus 文件（.pdf、.txt、.md）或直接粘贴章节考点清单。"
                : "Upload instructor syllabus files or directly paste the chapters & learning objectives outline."}
            </p>
          </div>
          {syllabusDocName && (
            <span className="border border-[#111111] bg-[#fafafa] px-2 py-0.5 text-[10px] font-bold truncate max-w-xs">
              [{syllabusDocName}]
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

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
              className={`h-full min-h-[160px] border border-dashed border-[#111111] p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                isDragging
                  ? "bg-[#111111] text-white"
                  : "bg-[#fafafa] hover:bg-white text-[#111111]"
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
              <div className="w-8 h-8 border border-[#111111] bg-white flex items-center justify-center text-[#111111] mb-2">
                {isParsingDoc ? (
                  <div className="w-4 h-4 border-2 border-[#111111] border-t-transparent animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
              </div>
              <h4 className="font-bold text-[#111111] text-xs">
                {isParsingDoc
                  ? (parsingStatus || (language === "zh" ? "正在解析文档..." : "Parsing document..."))
                  : (language === "zh" ? "[上传课程考纲文件（多选）]" : "[UPLOAD SYLLABUS FILES]")}
              </h4>
              <p className="text-[10px] text-[#666666] mt-0.5">
                {language === "zh" ? "支持 PDF, Word (.docx), TXT, Markdown" : "Supports PDF, Word, TXT, Markdown"}
              </p>
            </div>
          </div>

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
              className="w-full flex-1 bg-[#fafafa] border border-[#111111] p-3 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white font-mono resize-y"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#111111] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-[#666666]">
            {syllabusContent ? (
              <span>
                [{language === "zh" ? "已就绪" : "READY"}: {syllabusContent.length}{" "}
                {language === "zh" ? "字符" : "CHARS"}]
              </span>
            ) : (
              <span>[{language === "zh" ? "等待输入考纲内容" : "WAITING FOR INPUT"}]</span>
            )}
          </div>

          {extractError && (
            <div className="p-2 border border-[#111111] bg-[#fafafa] text-[#111111] text-xs font-bold flex items-center space-x-1.5">
              <span>[ERROR: {extractError}]</span>
            </div>
          )}

          <button
            id="extract-course-syllabus-btn"
            type="button"
            onClick={handleExtractSyllabus}
            disabled={isExtracting || !syllabusContent.trim()}
            className="flex items-center justify-center space-x-2 py-2 px-5 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer border border-[#111111]"
          >
            {isExtracting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin" />
                <span>{language === "zh" ? "正在智能解析考纲架构..." : "ANALYZING ARCHITECTURE..."}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === "zh" ? "[AI 智能结构化考纲知识点]" : "[AI EXTRACT STRUCTURED TOPICS]"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="bg-white border border-[#111111] space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#111111]">
                <span>
                  [{topics.length} {language === "zh" ? "个课程重点知识领域已结构化" : "DOMAINS STRUCTURED"}]
                </span>
              </div>
              <h3 className="text-xs font-bold uppercase text-[#111111] mt-0.5">
                {language === "zh" ? "课程知识点大纲与学时规划表" : "Curriculum Domains & Study Allocation"}
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddManualTopic}
                className="flex items-center space-x-1 px-3 py-1.5 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>[{t("addTopic")}]</span>
              </button>

              <button
                id="proceed-to-schedule-btn"
                onClick={onProceedToPlanConfig}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-bold border border-[#111111] transition-colors cursor-pointer"
              >
                <span>{language === "zh" ? "[配置复习作息并生成计划 →]" : "[PROCEED TO SCHEDULE SETUP →]"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="border border-[#111111] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#111111] text-[#111111] font-bold uppercase">
                  <th className="py-2.5 px-3">{t("tableTopicTitle")}</th>
                  <th className="py-2.5 px-3 w-28">{t("tableWeight")}</th>
                  <th className="py-2.5 px-3 w-28">{t("tableDifficulty")}</th>
                  <th className="py-2.5 px-3 w-24">{t("tableEstHours")}</th>
                  <th className="py-2.5 px-3 w-16 text-center">{t("tableAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#111111]">
                {topics.map((topic, idx) => (
                  <tr key={topic.id || idx} className="hover:bg-[#fafafa] transition-colors">
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={topic.title}
                        onChange={(e) => handleUpdateTopic(idx, { title: e.target.value })}
                        className="font-bold text-xs text-[#111111] bg-transparent border-b border-transparent hover:border-[#111111] focus:border-[#111111] focus:outline-none w-full"
                      />
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {topic.subtopics.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="border border-[#111111] px-1 py-0.2 text-[9px] font-bold text-[#111111] bg-white"
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
                          className="w-12 bg-white border border-[#111111] px-1.5 py-0.5 text-xs text-[#111111] font-bold"
                        />
                        <span className="text-[#111111] font-bold">%</span>
                      </div>
                    </td>

                    <td className="py-2 px-3">
                      <select
                        value={topic.difficulty}
                        onChange={(e) => handleUpdateTopic(idx, { difficulty: e.target.value as any })}
                        className="w-full bg-white border border-[#111111] px-1.5 py-0.5 text-xs text-[#111111] font-bold"
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
                          className="w-12 bg-white border border-[#111111] px-1.5 py-0.5 text-xs text-[#111111] font-bold"
                        />
                        <span className="text-[#111111] font-bold">{language === "zh" ? "小时" : "h"}</span>
                      </div>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteTopic(idx)}
                        className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
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
