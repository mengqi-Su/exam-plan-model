import React, { useEffect, useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { daysBetween, toLocalDateString } from "../lib/date";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export interface ExamDraft {
  examName: string;
  subject: string;
  examDate: string;
  examTime: string;
  target: string;
}

export function toExamDraft(plan: ExamStudyPlan): ExamDraft {
  return {
    examName: plan.examName || "",
    subject: plan.subject || "",
    examDate: plan.examDate || "",
    examTime: plan.examTime || "09:00",
    target: plan.preferences?.targetScoreOrGrade || "",
  };
}

interface EditSubjectModalProps {
  open: boolean;
  plan: ExamStudyPlan;
  onClose: () => void;
  /** 校验通过后交给页面写回计划；页面负责关闭弹窗 */
  onSave: (draft: ExamDraft) => void;
}

export function EditSubjectModal({ open, plan, onClose, onSave }: EditSubjectModalProps) {
  const { language, t } = useI18n();
  const isZh = language === "zh";

  const [draft, setDraft] = useState<ExamDraft>(() => toExamDraft(plan));
  const [error, setError] = useState<string | null>(null);

  // 每次打开都从当前计划重新起稿，上次没保存的改动不留存
  useEffect(() => {
    if (!open) return;
    setDraft(toExamDraft(plan));
    setError(null);
  }, [open, plan]);

  const patch = (key: keyof ExamDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  const remainingDays = useMemo(() => {
    if (!DATE_RE.test(draft.examDate.trim())) return null;
    return daysBetween(toLocalDateString(), draft.examDate.trim());
  }, [draft.examDate]);

  const handleSubmit = () => {
    const examDate = draft.examDate.trim();
    const examTime = draft.examTime.trim() || "09:00";
    if (!draft.examName.trim()) {
      setError(isZh ? "请填写科目名称。" : "Exam title is required.");
      return;
    }
    if (!DATE_RE.test(examDate)) {
      setError(isZh ? "考试日期格式应为 2026-12-20。" : "Exam date must look like 2026-12-20.");
      return;
    }
    if (!TIME_RE.test(examTime)) {
      setError(isZh ? "考试时间格式应为 09:00。" : "Exam time must look like 09:00.");
      return;
    }
    if (plan.startDate && examDate < plan.startDate) {
      setError(
        isZh
          ? `考试日期不能早于计划开始日期（${plan.startDate}）。`
          : `Exam date cannot be earlier than the plan start date (${plan.startDate}).`
      );
      return;
    }
    onSave({ ...draft, examName: draft.examName.trim(), subject: draft.subject.trim(), examDate, examTime, target: draft.target.trim() });
  };

  const labelCls = "ui-row-meta block";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isZh ? "编辑备考科目" : "Edit exam subject"}
      closeLabel={isZh ? "关闭编辑窗口" : "Close edit dialog"}
      icon={<Pencil className="h-4 w-4" />}
      size="lg"
      note={isZh ? "只改考试信息，已生成的任务不会被重写。" : "Only exam info changes; scheduled tasks stay as they are."}
      footer={
        <>
          <button onClick={onClose} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
            {t("cancel")}
          </button>
          <button onClick={handleSubmit} className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]">
            {isZh ? "保存" : "Save"}
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "科目名称" : "Exam title"}</span>
          <input
            value={draft.examName}
            onChange={(event) => patch("examName", event.target.value)}
            className="ui-field mt-1.5"
            autoFocus
          />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "学科" : "Subject"}</span>
          <input
            value={draft.subject}
            onChange={(event) => patch("subject", event.target.value)}
            className="ui-field mt-1.5"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelCls}>{isZh ? "考试日期" : "Exam date"}</span>
          <input
            type="date"
            value={draft.examDate}
            onChange={(event) => patch("examDate", event.target.value)}
            className="ui-field mt-1.5 tabular-nums"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelCls}>{isZh ? "考试时间" : "Exam time"}</span>
          <input
            type="time"
            value={draft.examTime}
            onChange={(event) => patch("examTime", event.target.value)}
            className="ui-field mt-1.5 tabular-nums"
          />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "目标分数或等级（可选）" : "Target score or grade (optional)"}</span>
          <input
            value={draft.target}
            onChange={(event) => patch("target", event.target.value)}
            placeholder={isZh ? "例如：90 分 / 优秀" : "e.g. 90 / A"}
            className="ui-field mt-1.5"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="ui-row-meta">
          {error ? (
            <span className="text-[#B42318]">{error}</span>
          ) : remainingDays !== null ? (
            isZh
              ? remainingDays > 0
                ? `按这个日期，距考试还有 ${remainingDays} 天。`
                : remainingDays === 0
                  ? "按这个日期，考试就在今天。"
                  : `按这个日期，考试已经过了 ${-remainingDays} 天。`
              : remainingDays > 0
                ? `${remainingDays} days left with this date.`
                : remainingDays === 0
                  ? "The exam lands on today."
                  : `This date is ${-remainingDays} days in the past.`
          ) : null}
        </span>
        {plan.startDate && (
          <span className="ui-row-meta tabular-nums">
            {isZh ? `计划起始 ${plan.startDate}` : `Plan starts ${plan.startDate}`}
          </span>
        )}
      </div>
    </ModalShell>
  );
}
