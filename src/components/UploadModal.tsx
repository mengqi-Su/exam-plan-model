import React, { useRef, useState } from "react";
import { Upload, RefreshCw, AlertCircle } from "lucide-react";
import { StudyMaterial } from "../types";
import { parseDocumentFile, UPLOAD_ACCEPT } from "../lib/documentParser";
import {
  UPLOAD_CHAR_BUDGET,
  type UploadTask,
  pickFailedFiles,
  runUploadQueue,
  uploadOutcomeNotice,
} from "../lib/uploadQueue";
import { useI18n } from "../lib/i18n";
import { clauseJoin, labelColon, pl } from "../lib/text";
import { ModalShell } from "./ModalShell";
import { UploadLimitChips, UploadQueuePanel } from "./UploadQueuePanel";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (newMaterials: StudyMaterial[], combinedContent: string) => void;
  currentSyllabusContent?: string;
  initialType?: StudyMaterial["type"];
}

/* 一份文件是笔记、讲义还是真题，看文件名就够了；这份判断只在这里出现一次。 */
function inferMaterialType(name: string, initialType?: StudyMaterial["type"]): StudyMaterial["type"] {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("syllabus") || lowerName.includes("大纲") || lowerName.includes("考纲")) return "syllabus";
  if (lowerName.includes("slide") || lowerName.includes("ppt") || lowerName.includes("讲义") || lowerName.includes("课件"))
    return "lecture_slides";
  if (lowerName.includes("exam") || lowerName.includes("test") || lowerName.includes("真题") || lowerName.includes("试卷") || lowerName.includes("期末"))
    return "past_exam";
  return initialType || "notes";
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
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingStatus, setParsingStatus] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const batchRef = useRef<{ files: File[]; keepKeys?: Map<string, string> } | null>(null);
  const cancelRef = useRef(false);

  if (!isOpen) return null;

  /* 一批文件交给队列跑：并发 2、每份状态看得见、能停下、失败的那几份能单独重来。
     这里只管把读出来的正文拼成资料并交给调用方。 */
  const runBatch = async (files: File[], keepKeys?: Map<string, string>) => {
    if (files.length === 0) return;
    cancelRef.current = false;
    batchRef.current = { files, keepKeys };
    setIsParsing(true);
    setErrorMessage(null);

    const outcome = await runUploadQueue<{ text: string; name: string; sizeBytes: number }>(files, {
      run: async (file, task) => {
        const parsed = await parseDocumentFile(file, language, (status) => setParsingStatus(status));
        // 字节数在开工那一刻就知道：重试时文件名可能重复，回头再查一遍并不可靠
        return { text: parsed?.text || "", name: task.name, sizeBytes: file.size };
      },
      textOf: (value) => value.text,
      onTasks: setTasks,
      isCancelled: () => cancelRef.current,
      charBudget: UPLOAD_CHAR_BUDGET,
      keepKeys,
    });

    setIsParsing(false);
    setParsingStatus("");

    let combinedContent = currentSyllabusContent ? currentSyllabusContent + "\n\n" : "";
    const newAttachedMaterials: StudyMaterial[] = outcome.done.map((item, index): StudyMaterial => {
      const text = item.value.text;
      const type = inferMaterialType(item.name, initialType);
      combinedContent += `=== ${item.name} ===\n${text}\n\n`;
      return {
        id: `mat-${Date.now()}-${index}`,
        name: item.name,
        type,
        categoryGroup:
          type === "past_exam" ? "exam_question" : type === "syllabus" ? "course_syllabus" : "study_material",
        content: text,
        uploadedAt: new Date().toISOString(),
        sizeBytes: item.value.sizeBytes,
        summaryNotes: text.slice(0, 160) + "...",
        difficulty: "medium" as const,
      };
    });

    const notices: string[] = [];
    const queueNotice = uploadOutcomeNotice(outcome, isZh);
    if (queueNotice) notices.push(queueNotice);

    if (outcome.failed.length > 0) {
      const labels = outcome.failed.map((task) => `${task.name}${labelColon(isZh)}${task.error || tt("解析失败", "parse failed")}`);
      const extra =
        labels.length > 3 ? tt(`（另有 ${labels.length - 3} 个失败）`, `(+${pl(labels.length - 3, "more file", "more files")})`) : "";
      // 交出去的是读出来的那几份；剩下的不静默丢，进度列表里能看到、能重来
      if (newAttachedMaterials.length > 0) onUploadSuccess(newAttachedMaterials, combinedContent.trim());
      setErrorMessage(clauseJoin([labels.slice(0, 3).join(isZh ? "；" : "; ") + extra, ...notices], isZh));
      return;
    }

    if (newAttachedMaterials.length > 0) {
      onUploadSuccess(newAttachedMaterials, combinedContent.trim());
      setErrorMessage(null);
      onClose();
      return;
    }

    setErrorMessage(notices.length > 0 ? clauseJoin(notices, isZh) : tt("没有读到资料。", "Nothing was read."));
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || isParsing) return;
    void runBatch(Array.from(files));
  };

  const retryFailed = async () => {
    const batch = batchRef.current;
    if (!batch || isParsing) return;
    const { files, keepKeys } = pickFailedFiles(batch.files, tasks);
    if (files.length === 0) return;
    await runBatch(files, keepKeys);
  };

  const dismissQueue = () => {
    if (isParsing) return;
    setTasks([]);
    batchRef.current = null;
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
          if (!isParsing) setIsDragging(true);
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
          accept={UPLOAD_ACCEPT}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
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

          <p className="ui-row-title">
            {isParsing ? parsingStatus : isZh ? "点击选择 或 拖入文件" : "Click or drop files"}
          </p>

          <UploadLimitChips />
        </div>
      </div>

      <UploadQueuePanel
        tasks={tasks}
        isRunning={isParsing}
        onCancel={() => {
          cancelRef.current = true;
        }}
        onRetry={() => void retryFailed()}
        onDismiss={dismissQueue}
      />

      {errorMessage && (
        <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-[#FDF0EE] border border-[#f5d6d0] text-[#B42318]">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span className="text-[12px] leading-relaxed">{errorMessage}</span>
        </div>
      )}
    </ModalShell>
  );
};
