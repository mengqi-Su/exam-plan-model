import React, { useState } from "react";
import { Upload, RefreshCw, AlertCircle } from "lucide-react";
import { StudyMaterial } from "../types";
import { parseDocumentFile } from "../lib/documentParser";
import { useI18n } from "../lib/i18n";
import { ModalShell } from "./ModalShell";

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
  const isZh = language === "zh";
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
    let hadError = false;

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
        hadError = true;
        setErrorMessage(`${file.name}: ${err?.message || (isZh ? "解析失败" : "Error")}`);
      }
    }

    setIsParsing(false);
    setParsingStatus("");

    if (newAttachedMaterials.length > 0) {
      onUploadSuccess(newAttachedMaterials, combinedContent.trim());
      if (!hadError) onClose();
    }
  };

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title={isZh ? "上传文件" : "Upload files"}
      closeLabel={isZh ? "关闭" : "Close"}
      icon={<Upload className="h-4 w-4" />}
      size="sm"
    >

        {/* Dropzone */}
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
          className={`rounded-xl border border-dashed py-9 px-4 text-center cursor-pointer transition-colors ${
            isDragging
              ? "border-[#1c1b1a] bg-[#f1efe9]"
              : "border-[#ddd8d0] bg-[#faf9f6] hover:bg-[#f1efe9] hover:border-[#cfc9c0]"
          }`}
        >
          <input
            id="modal-file-upload-input"
            type="file"
            multiple
            accept=".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.json,.rtf"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2.5">
            <span className="w-11 h-11 rounded-full bg-white border border-[#eae7e1] flex items-center justify-center">
              {isParsing ? (
                <RefreshCw className="w-4 h-4 animate-spin text-[#6b6660]" />
              ) : (
                <Upload className="w-4 h-4 text-[#6b6660]" />
              )}
            </span>

            <p className="text-[13px] font-medium text-[#1c1b1a]">
              {isParsing ? parsingStatus : isZh ? "点击选择 或 拖入文件" : "Click or drop files"}
            </p>
            <p className="text-[11px] text-[#8a8580]">
              {isZh ? "PDF / DOCX / PPTX / TXT / MD · 单文件 ≤ 10 MB" : "PDF / DOCX / PPTX / TXT / MD · max 10 MB each"}
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-1.5 p-2.5 rounded-lg bg-[#FDF0EE] border border-[#f5d6d0] text-[#B42318] text-[11px]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
    </ModalShell>
  );
};