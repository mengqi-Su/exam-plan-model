import React, { useState } from "react";
import { Upload, RefreshCw, AlertCircle } from "lucide-react";
import { StudyMaterial } from "../types";
import { parseDocumentFile } from "../lib/documentParser";
import { useI18n } from "../lib/i18n";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newMaterials: StudyMaterial[], combinedContent: string) => void;
  currentSyllabusContent?: string;
  initialType?: StudyMaterial["type"];
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadSuccess,
  currentSyllabusContent = "",
  initialType,
}) => {
  const { language } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsParsing(true);
    setErrorMessage(null);

    const newAttachedMaterials: StudyMaterial[] = [];
    let combinedContent = currentSyllabusContent ? currentSyllabusContent + "\n\n" : "";

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        setParsingStatus(`${file.name}...`);
        const parsed = await parseDocumentFile(file, language);
        const text = parsed?.text || "";

        let inferredType: StudyMaterial["type"] = initialType || "notes";
        const lowerName = file.name.toLowerCase();
        if (lowerName.includes("syllabus") || lowerName.includes("大纲") || lowerName.includes("考纲")) {
          inferredType = "syllabus";
        } else if (lowerName.includes("slide") || lowerName.includes("ppt") || lowerName.includes("讲义") || lowerName.includes("课件")) {
          inferredType = "lecture_slides";
        } else if (lowerName.includes("exam") || lowerName.includes("test") || lowerName.includes("真题") || lowerName.includes("试卷") || lowerName.includes("期末")) {
          inferredType = "past_exam";
        }

        const materialItem: StudyMaterial = {
          id: `mat-${Date.now()}-${i}`,
          name: file.name,
          type: inferredType,
          categoryGroup: inferredType === "past_exam" ? "exam_question" : inferredType === "syllabus" ? "course_syllabus" : "study_material",
          content: text,
          uploadedAt: new Date().toISOString(),
          sizeBytes: file.size,
          summaryNotes: text.slice(0, 160) + "...",
          difficulty: "medium",
        };

        newAttachedMaterials.push(materialItem);
        combinedContent += `=== ${file.name} ===\n${text}\n\n`;
      } catch (err: any) {
        setErrorMessage(`${file.name}: ${err?.message || (language === "zh" ? "解析失败" : "Error")}`);
      }
    }

    setIsParsing(false);
    setParsingStatus("");

    if (newAttachedMaterials.length > 0) {
      onUploadSuccess(newAttachedMaterials, combinedContent.trim());
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#111111]/50 flex items-center justify-center p-4 font-mono"
    >
      <div
        className="bg-white border border-[#111111] w-full max-w-sm p-4 space-y-3 shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Title + Close ✕ */}
        <div className="flex items-center justify-between border-b border-[#111111] pb-2">
          <span className="text-xs font-bold uppercase text-[#111111]">
            +{language === "zh" ? "上传文件" : "Upload"}
          </span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-[#111111] hover:text-[#777777] cursor-pointer p-0.5"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Minimalist dashed dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => {
            if (!isParsing) {
              document.getElementById("modal-file-upload-input")?.click();
            }
          }}
          className={`border border-dashed border-[#111111] py-8 px-4 text-center cursor-pointer transition-colors ${
            isDragging ? "bg-[#ededed]" : "bg-white hover:bg-[#fafafa]"
          }`}
        >
          <input
            id="modal-file-upload-input"
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.ppt,.pptx"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2">
            {isParsing ? (
              <RefreshCw className="w-4 h-4 animate-spin text-[#111111]" />
            ) : (
              <Upload className="w-4 h-4 text-[#111111]" />
            )}

            <p className="text-xs font-bold text-[#111111]">
              {isParsing
                ? parsingStatus
                : (language === "zh" ? "点击选择 或 拖入文件" : "Click or drop files")}
            </p>
            <p className="text-[10px] text-[#666666]">
              PDF / DOCX / PPT / TXT / MD
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center space-x-1 p-2 border border-red-600 text-red-600 text-[11px] font-bold">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
