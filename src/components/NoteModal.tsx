import React, { useState, useEffect } from "react";
import { FileText, X, Check, Sparkles } from "lucide-react";
import { StudyMaterial } from "../types";
import { useI18n } from "../lib/i18n";

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: { title: string; content: string; type: StudyMaterial["type"] }) => void;
  initialType?: StudyMaterial["type"];
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialType = "notes",
}) => {
  const { language } = useI18n();
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<StudyMaterial["type"]>(initialType);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (isOpen) {
      setDocType(initialType);
      setTitle("");
      setContent("");
    }
  }, [isOpen, initialType]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!content.trim()) return;
    const finalTitle =
      title.trim() ||
      (docType === "syllabus"
        ? language === "zh" ? "课程大纲考纲" : "Course Syllabus"
        : docType === "past_exam"
        ? language === "zh" ? "历年真题与解析" : "Past Exam & Solutions"
        : docType === "lecture_slides"
        ? language === "zh" ? "讲义课件要点" : "Lecture Slides Outline"
        : docType === "textbook_outline"
        ? language === "zh" ? "教材重点提纲" : "Textbook Outline"
        : language === "zh" ? "自定义课堂笔记" : "Custom Notes");

    onSave({
      title: finalTitle,
      content: content.trim(),
      type: docType,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#111111]/50 flex items-center justify-center p-4 font-mono animate-fadeIn"
    >
      <div
        className="bg-white border border-[#111111] w-full max-w-lg p-5 space-y-4 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Title + Close ✕ */}
        <div className="flex items-center justify-between border-b border-[#111111] pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 bg-[#FCD33B] border border-[#111111]" />
            <span className="text-xs font-bold uppercase text-[#111111]">
              +{language === "zh" ? "录入笔记 / 文本资料" : "Add Note / Text"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#111111] hover:text-[#777777] cursor-pointer p-0.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">
                [{language === "zh" ? "资料标题" : "TITLE"}]
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={language === "zh" ? "如：第 1-3 周重点笔记 / 核心考点" : "Document title..."}
                className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] placeholder:text-[#888888] outline-none font-mono focus:bg-[#fafafa]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-[#666666] uppercase mb-1">
                [{language === "zh" ? "资料分类" : "CATEGORY"}]
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-white border border-[#111111] text-xs text-[#111111] outline-none font-mono cursor-pointer font-bold"
              >
                <option value="notes">{language === "zh" ? "[课堂笔记 (Notes)]" : "[Notes]"}</option>
                <option value="syllabus">{language === "zh" ? "[考纲大纲 (Syllabus)]" : "[Syllabus]"}</option>
                <option value="lecture_slides">{language === "zh" ? "[讲义课件 (Slides)]" : "[Slides]"}</option>
                <option value="past_exam">{language === "zh" ? "[历年真题 (Past Exam)]" : "[Past Exam]"}</option>
                <option value="textbook_outline">{language === "zh" ? "[教材提纲 (Outline)]" : "[Outline]"}</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] font-bold text-[#666666] uppercase">
                [{language === "zh" ? "内容文本" : "CONTENT TEXT"}]
              </label>
              <span className="text-[10px] text-[#888888] font-mono">
                {content.length} {language === "zh" ? "字" : "chars"}
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder={
                language === "zh"
                  ? "在此直接粘贴课堂笔记、大纲考点、教材摘录、历年真题或解题公式，AI 将自动分析并融入智能复习排程..."
                  : "Paste your syllabus, notes, key formulas, or past exam questions here..."
              }
              className="w-full px-3 py-2.5 bg-white border border-[#111111] text-xs text-[#111111] placeholder:text-[#888888] outline-none font-mono resize-none focus:bg-[#fafafa] leading-relaxed"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-[#111111]/20">
          <span className="text-[10px] text-[#666666]">
            {language === "zh" ? "* 支持保存后随时生成自测题与考点摘要" : "* Instant AI quiz & summary enabled"}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[#666666] hover:text-[#111111] cursor-pointer font-bold"
            >
              [{language === "zh" ? "取消" : "CANCEL"}]
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold border border-[#111111] cursor-pointer transition-colors"
            >
              [{language === "zh" ? "保存至知识库" : "SAVE TO KNOWLEDGE BASE"}]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
