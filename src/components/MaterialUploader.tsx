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
  HelpCircle,
  Layers
} from "lucide-react";
import { StudyMaterial, SyllabusTopic } from "../types";
import { SAMPLE_MATERIALS } from "../lib/storage";
import { useI18n } from "../lib/i18n";
import { fallbackExtractSyllabusClient } from "../lib/fallbackPlanner";

interface MaterialUploaderProps {
  materials: StudyMaterial[];
  onMaterialsChange: (materials: StudyMaterial[]) => void;
  topics: SyllabusTopic[];
  onTopicsChange: (topics: SyllabusTopic[]) => void;
  materialsSummary: string;
  onMaterialsSummaryChange: (summary: string) => void;
  examName: string;
  onExamNameChange: (name: string) => void;
  subject: string;
  onSubjectChange: (subj: string) => void;
  onProceedToPlanConfig: () => void;
}

export function MaterialUploader({
  materials,
  onMaterialsChange,
  topics,
  onTopicsChange,
  materialsSummary,
  onMaterialsSummaryChange,
  examName,
  onExamNameChange,
  subject,
  onSubjectChange,
  onProceedToPlanConfig,
}: MaterialUploaderProps) {
  const { t, language } = useI18n();
  const [pasteText, setPasteText] = useState("");
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<StudyMaterial["type"]>("syllabus");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleAddPastedMaterial = () => {
    if (!pasteText.trim()) return;
    const newMat: StudyMaterial = {
      id: `mat-${Date.now()}`,
      name: materialTitle.trim() || `${language === "zh" ? "学习笔记" : "Study Notes"} (${new Date().toLocaleDateString()})`,
      type: materialType,
      content: pasteText.trim(),
      uploadedAt: new Date().toISOString(),
      sizeBytes: new Blob([pasteText]).size,
    };
    onMaterialsChange([...materials, newMat]);
    setPasteText("");
    setMaterialTitle("");
  };

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const textContent = e.target?.result as string;
        const newMat: StudyMaterial = {
          id: `mat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          type: file.name.toLowerCase().includes("syllabus") || file.name.includes("大纲") ? "syllabus" : "notes",
          content: textContent || `[Extracted text from ${file.name}]`,
          sizeBytes: file.size,
          uploadedAt: new Date().toISOString(),
        };
        onMaterialsChange([...materials, newMat]);
      };
      reader.readAsText(file);
    });
  };

  const handleLoadSample = (sample: (typeof SAMPLE_MATERIALS)[0]) => {
    onExamNameChange(sample.name.replace("大纲", "").replace("Syllabus", "").trim() || sample.name);
    onSubjectChange(sample.subject);
    const newMat: StudyMaterial = {
      id: `sample-mat-${Date.now()}`,
      name: sample.name,
      type: "syllabus",
      content: sample.text,
      sizeBytes: new Blob([sample.text]).size,
      uploadedAt: new Date().toISOString(),
    };
    onMaterialsChange([newMat]);
  };

  const handleExtractSyllabus = async () => {
    if (materials.length === 0 && !pasteText.trim()) {
      setExtractError(language === "zh" ? "请至少上传或粘贴一份备考资料或大纲。" : "Please upload or paste at least one study material document.");
      return;
    }

    let activeMats = [...materials];
    if (pasteText.trim()) {
      const inlineMat: StudyMaterial = {
        id: `mat-${Date.now()}`,
        name: materialTitle.trim() || (language === "zh" ? "粘贴的大纲内容" : "Pasted Syllabus"),
        type: materialType,
        content: pasteText.trim(),
        uploadedAt: new Date().toISOString(),
        sizeBytes: new Blob([pasteText]).size,
      };
      activeMats.push(inlineMat);
      onMaterialsChange(activeMats);
      setPasteText("");
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
            materials: activeMats,
            examName: examName || (language === "zh" ? "即将到来的考试" : "Upcoming Exam"),
            subject: subject || (language === "zh" ? "综合学科" : "General"),
            language,
          }),
        });

        if (res.ok) {
          data = await res.json();
        }
      } catch (fetchErr) {
        console.warn("Network error during syllabus extraction in MaterialUploader:", fetchErr);
      }

      if (!data || !data.topics || data.topics.length === 0) {
        data = fallbackExtractSyllabusClient(
          activeMats,
          examName || (language === "zh" ? "即将到来的考试" : "Upcoming Exam"),
          subject || (language === "zh" ? "综合学科" : "General"),
          language
        );
      }

      if (data.summary) {
        onMaterialsSummaryChange(data.summary);
      }
      if (data.topics && Array.isArray(data.topics)) {
        onTopicsChange(data.topics);
      }
    } catch (err: any) {
      console.error("Extraction error handled:", err);
      const fallback = fallbackExtractSyllabusClient(
        activeMats,
        examName || (language === "zh" ? "即将到来的考试" : "Upcoming Exam"),
        subject || (language === "zh" ? "综合学科" : "General"),
        language
      );
      if (fallback.summary) onMaterialsSummaryChange(fallback.summary);
      if (fallback.topics) onTopicsChange(fallback.topics);
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
      title: language === "zh" ? "新建大纲知识点" : "New Syllabus Topic",
      category: language === "zh" ? "核心模块" : "Core Module",
      difficulty: "medium",
      userKnowledgeLevel: "intermediate",
      estimatedHours: 4,
      weightPercentage: 15,
      subtopics: language === "zh" ? ["核心概念 A", "习题强化 B"] : ["Key Concept A", "Practice Problem Set B"],
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
            [STEP 01]
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold uppercase tracking-tight text-[#111111]">
                {t("uploadHeaderTitle")}
              </h2>
              <span className="border border-[#111111] bg-white px-2 py-0.5 text-[10px] font-bold">
                [{t("step1Badge")}]
              </span>
            </div>
            <p className="text-xs text-[#666666] mt-1 max-w-xl leading-relaxed">
              {t("uploadHeaderDesc")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto">
          <span className="text-[11px] text-[#666666] mr-1 font-bold">[{t("quickPresets")}]:</span>
          {SAMPLE_MATERIALS.map((sample, i) => (
            <button
              key={i}
              id={`sample-preset-btn-${i}`}
              onClick={() => handleLoadSample(sample)}
              className="px-2.5 py-1 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
            >
              [{sample.subject}]
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-[#111111] p-5 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
          [// {t("examTargetInfo")}]
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
              {t("examTitleLabel")}
            </label>
            <input
              id="exam-title-input"
              type="text"
              value={examName}
              onChange={(e) => onExamNameChange(e.target.value)}
              placeholder={t("examTitlePlaceholder")}
              className="w-full bg-[#fafafa] border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-[#111111] mb-1">
              {t("subjectLabel")}
            </label>
            <input
              id="exam-subject-input"
              type="text"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              placeholder={t("subjectPlaceholder")}
              className="w-full bg-[#fafafa] border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white font-mono"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        <div className="lg:col-span-7 space-y-4">

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
            onClick={() => document.getElementById("file-upload-input")?.click()}
            className={`border border-dashed border-[#111111] p-6 text-center transition-all cursor-pointer ${
              isDragging
                ? "bg-[#111111] text-white"
                : "bg-[#fafafa] hover:bg-white text-[#111111]"
            }`}
          >
            <input
              id="file-upload-input"
              type="file"
              multiple
              accept=".txt,.md,.doc,.docx,.pdf,.rtf"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            <div className="w-10 h-10 mx-auto bg-white border border-[#111111] flex items-center justify-center text-[#111111] mb-2.5">
              <Upload className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-[#111111] text-xs uppercase">
              {t("dropZoneTitle")}
            </h4>
            <p className="text-[11px] text-[#666666] mt-1">
              {t("dropZoneSubtitle")}
            </p>
          </div>

          <div className="bg-white border border-[#111111] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase text-[#111111]">
                {t("pasteSyllabusTitle")}
              </label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value as any)}
                className="text-xs bg-[#fafafa] text-[#111111] border border-[#111111] px-2 py-0.5 focus:outline-none font-bold"
              >
                <option value="syllabus">{t("typeSyllabus")}</option>
                <option value="notes">{t("typeNotes")}</option>
                <option value="past_exam">{t("typePastExam")}</option>
                <option value="textbook_outline">{t("typeTextbook")}</option>
              </select>
            </div>

            <input
              type="text"
              value={materialTitle}
              onChange={(e) => setMaterialTitle(e.target.value)}
              placeholder={t("documentTitlePlaceholder")}
              className="w-full bg-[#fafafa] border border-[#111111] px-2.5 py-1.5 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white font-mono"
            />

            <textarea
              id="paste-syllabus-textarea"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t("pasteTextareaPlaceholder")}
              className="w-full bg-[#fafafa] border border-[#111111] p-2.5 text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:bg-white font-mono resize-y"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddPastedMaterial}
                disabled={!pasteText.trim()}
                className="flex items-center space-x-1 px-3 py-1 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white text-xs font-bold transition-colors cursor-pointer border border-[#111111]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>[{t("addToUploads")}]</span>
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col">
          <div className="bg-white border border-[#111111] p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 border-b border-[#111111]">
                <h3 className="font-bold text-[#111111] text-xs flex items-center space-x-1.5 uppercase">
                  <FileText className="w-3.5 h-3.5 text-[#111111]" />
                  <span>{t("attachedDocuments")} [{materials.length}]</span>
                </h3>
                {materials.length > 0 && (
                  <button
                    onClick={() => onMaterialsChange([])}
                    className="text-[10px] text-[#666666] hover:text-[#111111] hover:underline transition-colors font-bold cursor-pointer"
                  >
                    [{t("clearAll")}]
                  </button>
                )}
              </div>

              <div className="overflow-y-auto max-h-[220px] py-2.5 space-y-2">
                {materials.length === 0 ? (
                  <div className="text-center py-8 text-[#666666]">
                    <BookOpen className="w-6 h-6 mx-auto stroke-1 mb-1.5 opacity-40 text-[#111111]" />
                    <p className="text-xs font-bold uppercase">{t("noMaterialsYet")}</p>
                    <p className="text-[11px] text-[#666666] mt-0.5">
                      {t("noMaterialsHint")}
                    </p>
                  </div>
                ) : (
                  materials.map((mat, i) => (
                    <div
                      key={mat.id}
                      className="p-2.5 bg-[#fafafa] border border-[#111111] flex items-start justify-between space-x-2 text-xs"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-[#111111] truncate">{mat.name}</span>
                          <span className="border border-[#111111] bg-white px-1.5 py-0.2 text-[9px] uppercase font-bold">
                            [{mat.type}]
                          </span>
                        </div>
                        <p className="text-[11px] text-[#666666] mt-0.5 line-clamp-1 font-mono">
                          {mat.content.slice(0, 100)}...
                        </p>
                      </div>

                      <button
                        onClick={() => onMaterialsChange(materials.filter((_, idx) => idx !== i))}
                        className="text-[#111111] hover:bg-[#111111] hover:text-white p-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#111111]">
              {extractError && (
                <div className="p-2.5 mb-2.5 bg-[#fafafa] border border-[#111111] text-[#111111] text-xs flex items-start space-x-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>[ERROR: {extractError}]</span>
                </div>
              )}

              <button
                id="extract-topics-btn"
                type="button"
                onClick={handleExtractSyllabus}
                disabled={isExtracting || (materials.length === 0 && !pasteText.trim())}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer border border-[#111111]"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>[{t("analyzingSyllabus")}]</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>[{t("extractSyllabusBtn")}]</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {topics.length > 0 && (
        <div className="bg-white border border-[#111111] space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#111111]">
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-bold text-[#111111]">
                <Check className="w-3.5 h-3.5" />
                <span>[{topics.length} {language === "zh" ? "个考点已成功提取" : "TOPICS EXTRACTED"}]</span>
              </div>
              <h3 className="text-xs font-bold uppercase text-[#111111] mt-1">
                {t("structuredDomains")}
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddManualTopic}
                className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-[#111111] hover:text-white text-[#111111] border border-[#111111] text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>[{t("addTopic")}]</span>
              </button>

              <button
                id="proceed-to-schedule-btn"
                onClick={onProceedToPlanConfig}
                className="flex items-center space-x-1.5 px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white text-xs font-bold uppercase transition-colors cursor-pointer border border-[#111111]"
              >
                <span>[{t("continueToSchedule")}]</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="border border-[#111111] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#fafafa] border-b border-[#111111] text-[#111111] font-bold uppercase">
                  <th className="py-2 px-3">{t("tableTopicTitle")}</th>
                  <th className="py-2 px-3 w-28">{t("tableWeight")}</th>
                  <th className="py-2 px-3 w-28">{t("tableDifficulty")}</th>
                  <th className="py-2 px-3 w-24">{t("tableEstHours")}</th>
                  <th className="py-2 px-3 w-16 text-center">{t("tableAction")}</th>
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
                        className="font-bold text-xs text-[#111111] bg-transparent border-b border-transparent hover:border-[#111111] focus:border-[#111111] focus:outline-none w-full font-mono"
                      />
                      {topic.subtopics && topic.subtopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {topic.subtopics.map((sub, sIdx) => (
                            <span
                              key={sIdx}
                              className="border border-[#111111] bg-[#fafafa] px-1.5 py-0.2 text-[9px] font-bold text-[#111111]"
                            >
                              [{sub}]
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
