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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn select-none">
      <div 
        className="bg-white rounded-xl border border-[#e9e9e7] shadow-2xl max-w-md w-full overflow-hidden animate-scaleUp text-[#37352f]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 flex items-start justify-between border-b border-[#f0f0ee]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#fbf3f2] border border-[#f5d5d3] flex items-center justify-center text-[#d44c47] shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#37352f]">
                {language === "zh" ? "删除科目确认" : "Delete Course"}
              </h3>
              <p className="text-xs text-[#787774] mt-0.5">
                {language === "zh" ? "此操作将永久移除该科目及其所有关联数据" : "This will permanently remove this course and all associated data."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#efefed] text-[#787774] hover:text-[#37352f] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Plan Summary */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 bg-[#fbfbfa] border border-[#e9e9e7] rounded-lg space-y-2">
            <div className="font-semibold text-sm text-[#37352f] truncate flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#2b78a0] shrink-0" />
              <span className="truncate">{plan.examName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#787774]">
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{plan.examDate ? `${language === "zh" ? "考试日期：" : "Exam: "}${plan.examDate}` : (language === "zh" ? "日期待定" : "Date TBD")}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <CheckSquare className="w-3 h-3" />
                <span>{plan.tasks?.length || 0} {language === "zh" ? "个备考任务" : "tasks"}</span>
              </span>
              <span>•</span>
              <span>{plan.materials?.length || 0} {language === "zh" ? "份资料" : "materials"}</span>
            </div>
          </div>

          <div className="p-3 bg-[#fbf3f2]/60 border border-[#f5d5d3] rounded-lg flex items-start space-x-2 text-[#d44c47]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              {language === "zh"
                ? "删除后，该科目对应的考纲大纲、复习任务排程、错题记录及上传的讲义真题将不可恢复。请确认是否继续。"
                : "Once deleted, all scheduled tasks, knowledge documents, and progress for this course will be completely removed."}
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 bg-[#f7f6f3] border-t border-[#e9e9e7] flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#37352f] hover:bg-[#e9e9e7] rounded-lg transition-colors border border-[#d3d3d0] bg-white cursor-pointer"
          >
            {language === "zh" ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(plan.id);
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#d44c47] hover:bg-[#b83a36] rounded-lg shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{language === "zh" ? "确认删除科目" : "Delete Course"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
