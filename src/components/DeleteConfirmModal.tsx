import React, { useEffect } from "react";
import { AlertTriangle, Trash2, X, Layers, Calendar, CheckSquare } from "lucide-react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  plan: ExamStudyPlan | null;
  onClose: () => void;
  onConfirm: (planId: string) => void;
}

export function DeleteConfirmModal({
  isOpen,
  plan,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) {
  const { language } = useI18n();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !plan) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="bg-white border border-[#111111] max-w-md w-full overflow-hidden text-[#111111] font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="p-4 flex items-center justify-between border-b border-[#111111] bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [{language === "zh" ? "删除确认" : "DELETE"}]
            </span>
            <h3 className="font-bold text-xs uppercase tracking-wider text-[#111111]">
              {language === "zh" ? "删除科目确认" : "CONFIRM COURSE DELETION"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#111111] hover:text-white transition-colors cursor-pointer text-[#111111]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs font-mono">
          <div className="p-3 bg-[#fafafa] border border-[#111111] space-y-2">
            <div className="font-bold text-sm text-[#111111] truncate flex items-center space-x-2">
              <span className="text-[#666666]">#</span>
              <span className="truncate">{plan.examName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#666666]">
              <span>{plan.examDate ? `${language === "zh" ? "考期: " : "DATE: "}${plan.examDate}` : "DATE: TBD"}</span>
              <span>|</span>
              <span>{plan.tasks?.length || 0} {language === "zh" ? "项任务" : "TASKS"}</span>
              <span>|</span>
              <span>{plan.materials?.length || 0} {language === "zh" ? "份资料" : "DOCS"}</span>
            </div>
          </div>

          <div className="p-3 border border-[#111111] bg-white text-[#111111] text-[11px] leading-relaxed">
            <span className="font-bold text-[#d44c47]">[!] </span>
            {language === "zh"
              ? "删除后，该科目对应的考纲大纲、复习任务排程、错题记录及上传的讲义真题将不可恢复。请确认是否继续。"
              : "Once deleted, all scheduled tasks, knowledge documents, and progress for this course will be permanently removed."}
          </div>
        </div>

        <div className="p-3 bg-[#fafafa] border-t border-[#111111] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono font-bold text-[#111111] hover:bg-[#ededed] border border-[#111111] bg-white transition-colors cursor-pointer"
          >
            [{language === "zh" ? "取消" : "CANCEL"}]
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(plan.id);
              onClose();
            }}
            className="px-3 py-1.5 text-xs font-mono font-bold text-white bg-[#111111] hover:bg-[#333333] border border-[#111111] transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>[{language === "zh" ? "确认删除" : "DELETE PERMANENTLY"}]</span>
          </button>
        </div>
      </div>
    </div>
  );
}
