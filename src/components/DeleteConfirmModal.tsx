import React from "react";
import { Trash2 } from "lucide-react";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { ModalShell } from "./ModalShell";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  plan: ExamStudyPlan | null;
  onClose: () => void;
  onConfirm: (planId: string) => void;
}

export function DeleteConfirmModal({ isOpen, plan, onClose, onConfirm }: DeleteConfirmModalProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  if (!isOpen || !plan) return null;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      title={isZh ? "删除科目" : "Delete subject"}
      closeLabel={isZh ? "关闭" : "Close"}
      icon={<Trash2 className="h-4 w-4" />}
      tone="warn"
      size="sm"
      note={isZh ? "删除后无法恢复，请先导出备份" : "Deletion is permanent; export a backup first"}
      footer={
        <>
          <button type="button" onClick={onClose} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
            {isZh ? "取消" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(plan.id);
              onClose();
            }}
            className="ui-btn ui-btn-danger px-4 py-1.5 text-[12px]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isZh ? "确认删除" : "Delete permanently"}</span>
          </button>
        </>
      }
    >
      <div className="ui-card px-4 py-3.5">
        <p className="ui-row-title truncate">{plan.examName}</p>
        <p className="mt-1.5 ui-row-meta tabular-nums">
          {plan.examDate || (isZh ? "考期未定" : "Date TBD")} ·{" "}
          {plan.tasks?.length || 0} {isZh ? "项任务" : "tasks"} ·{" "}
          {plan.materials?.length || 0} {isZh ? "份资料" : "files"}
        </p>
      </div>

      <p className="ui-note leading-relaxed">
        {isZh
          ? "删除后，该科目的考纲笔记、复习任务排程与上传资料会一起从本机移除，进度无法找回。"
          : "Removing this subject also removes its scheduled tasks, uploaded materials and progress from this device."}
      </p>
    </ModalShell>
  );
}
