import React, { useState, useEffect } from "react";
import { FileText, Check } from "lucide-react";
import { StudyMaterial } from "../types";
import { useI18n } from "../lib/i18n";
import { visibleChars } from "../lib/text";
import { ModalShell } from "./ModalShell";

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
  const isZh = language === "zh";
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
        ? isZh ? "课程大纲考纲" : "Course Syllabus"
        : docType === "past_exam"
        ? isZh ? "历年真题与解析" : "Past Exam & Solutions"
        : docType === "lecture_slides"
        ? isZh ? "讲义课件要点" : "Lecture Slides Outline"
        : docType === "textbook_outline"
        ? isZh ? "教材重点提纲" : "Textbook Outline"
        : isZh ? "自定义课堂笔记" : "Custom Notes");

    onSave({
      title: finalTitle,
      content: content.trim(),
      type: docType,
    });
    onClose();
  };

  const labelCls = "ui-field-label";
  const fieldCls = "ui-field";

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title={isZh ? "录入笔记 / 文本资料" : "Add note / text"}
      closeLabel={isZh ? "关闭" : "Close"}
      icon={<FileText className="h-4 w-4" />}
      tone="warn"
      footer={
        <>
          <button onClick={onClose} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isZh ? "保存至知识库" : "Save to knowledge base"}</span>
          </button>
        </>
      }
    >
      {/* Inputs */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{isZh ? "资料标题" : "Title"}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isZh ? "如：第 1-3 周重点笔记 / 核心考点" : "Document title..."}
              className={fieldCls}
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>{isZh ? "资料分类" : "Category"}</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as any)}
              className={`${fieldCls} cursor-pointer`}
            >
              <option value="notes">{isZh ? "课堂笔记" : "Notes"}</option>
              <option value="syllabus">{isZh ? "考纲大纲" : "Syllabus"}</option>
              <option value="lecture_slides">{isZh ? "讲义课件" : "Slides"}</option>
              <option value="past_exam">{isZh ? "历年真题" : "Past exam"}</option>
              <option value="textbook_outline">{isZh ? "教材提纲" : "Outline"}</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelCls}>{isZh ? "内容文本" : "Content"}</label>
            <span className="text-[11px] text-[#6b6660] tabular-nums">
              {visibleChars(content)} {isZh ? "字" : "chars"}
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={
              isZh
                ? "在此直接粘贴课堂笔记、大纲考点、教材摘录、历年真题或解题公式，AI 将自动分析并融入智能复习排程..."
                : "Paste your syllabus, notes, key formulas, or past exam questions here..."
            }
            className={`${fieldCls} resize-none leading-relaxed`}
          />
        </div>
      </div>
    </ModalShell>
  );
};
