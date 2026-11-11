import React, { useEffect, useMemo, useState } from "react";
import { ImagePlus, Pencil } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { countdownDays, examCountdown } from "../lib/date";
import type { ExamCountdown } from "../lib/date";
import { PAGE_ICON_CHOICES, autoPageIcon } from "../lib/pageIcon";
import { examNameLabel } from "../lib/text";
import {
  COVER_PRESETS,
  coverErrorMessage,
  coverImageSrc,
  findPreset,
  readCoverImage,
} from "../lib/pageCover";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// 改日期时那一句话的三种情形。天数只来自 lib/date 的倒计时，
// 「考试就在今天」按自然日判断，不看还剩几小时，免得今天早上新建的科目被写成已过。
function datePreviewText(countdown: ExamCountdown, isZh: boolean): string {
  if (countdown.calendarDays === 0) return isZh ? "按这个日期，考试就在今天。" : "The exam lands on today.";
  if (countdown.passed) {
    const past = Math.abs(countdown.calendarDays);
    return isZh ? `按这个日期，考试已经过了 ${past} 天。` : `This date is ${past} days in the past.`;
  }
  const days = countdownDays(countdown);
  return isZh ? `按这个日期，距考试还有 ${days} 天。` : `${days} days left with this date.`;
}

export interface ExamDraft {
  examName: string;
  subject: string;
  /** 页面图标（一个 emoji）；空串表示「跟着学科自动配」 */
  icon: string;
  /** 页头封面带："" 没有，"preset:<id>" 内置纹理，"data:image/..." 上传的图 */
  cover: string;
  examDate: string;
  examTime: string;
  target: string;
}

export function toExamDraft(plan: ExamStudyPlan): ExamDraft {
  return {
    examName: plan.examName || "",
    subject: plan.subject || "",
    icon: plan.icon || "",
    cover: plan.cover || "",
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
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  // 传过的图留在这一轮草稿里当一格备选：换成纹理再换回来，不用重新挑文件。
  const [uploadedCover, setUploadedCover] = useState<string | null>(null);

  // 每次打开都从当前计划重新起稿，上次没保存的改动不留存
  useEffect(() => {
    if (!open) return;
    setDraft(toExamDraft(plan));
    setError(null);
    setCoverError(null);
    setCoverBusy(false);
    setUploadedCover(coverImageSrc(plan.cover));
  }, [open, plan]);

  const patch = (key: keyof ExamDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    if (error) setError(null);
  };

  // 上传的图先在本地压一遍再存 data URL：封面是装饰，不值得把用户的本地库撑爆。
  const handleCoverFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCoverBusy(true);
    setCoverError(null);
    try {
      const next = await readCoverImage(file);
      setUploadedCover(next);
      patch("cover", next);
    } catch (e) {
      setCoverError(coverErrorMessage((e as { code?: string }).code, isZh));
    } finally {
      setCoverBusy(false);
    }
  };

  // 改日期时的天数预告和保存后科目页、今日页说的是同一个数：都走 lib/date 一处算法
  const countdown = useMemo(() => {
    if (!DATE_RE.test(draft.examDate.trim())) return null;
    return examCountdown(draft.examDate.trim(), draft.examTime.trim() || "09:00");
  }, [draft.examDate, draft.examTime]);

  const handleSubmit = () => {
    const examDate = draft.examDate.trim();
    const examTime = draft.examTime.trim() || "09:00";
    if (!draft.examName.trim()) {
      setError(isZh ? `请先填${examNameLabel(true)}。` : `Enter the ${examNameLabel(false).toLowerCase()} first.`);
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
    onSave({ ...draft, examName: draft.examName.trim(), subject: draft.subject.trim(), icon: draft.icon.trim(), cover: draft.cover, examDate, examTime, target: draft.target.trim() });
  };

  const labelCls = "ui-field-label";

  // 图标留空时的实际取值：跟着草稿里的学科与名称实时变，保存前就能看到页头会显示什么。
  const autoIcon = autoPageIcon(draft.subject, draft.examName);

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={isZh ? "编辑科目" : "Edit subject"}
      closeLabel={isZh ? "关闭编辑窗口" : "Close edit dialog"}
      icon={<Pencil className="h-4 w-4" />}
      size="lg"
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
        <div className="min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "页面图标" : "Page icon"}</span>
          {/* 和 Notion 一样：图标是一串无框小格子，选中才垫底色，取消选中就交回自动配。 */}
          <div className="flex flex-wrap gap-1">
            {PAGE_ICON_CHOICES.map((emoji) => {
              const selected = draft.icon === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => patch("icon", selected ? "" : emoji)}
                  className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border text-[20px] leading-none transition-colors ${
                    selected
                      ? "border-[#cfc9c0] bg-[#f1efe9]"
                      : "border-transparent hover:bg-[#f1efe9]"
                  }`}
                  title={isZh ? `用 ${emoji} 作页面图标` : `Use ${emoji} as the page icon`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
          <span className="mt-1.5 block ui-row-meta">
            {draft.icon
              ? isZh
                ? `已选 ${draft.icon}`
                : `${draft.icon} selected`
              : isZh
                ? `当前是 ${autoIcon}`
                : `Currently ${autoIcon}`}
          </span>
        </div>

        <div className="min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "封面" : "Cover"}</span>
          {/* 和 Notion 一样：先给一串现成的纸质纹理，再留一个传自己图的口子。
              「无」也占一格——选回它就是撤掉封面，不需要另找删除按钮。 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              aria-pressed={draft.cover === ""}
              onClick={() => patch("cover", "")}
              title={isZh ? "不用封面" : "No cover"}
              className={`flex h-10 w-16 cursor-pointer items-center justify-center rounded-lg border text-[11px] transition-colors ${
                draft.cover === ""
                  ? "border-[#1c1b1a]/60 bg-[#f1efe9] text-[#1c1b1a]"
                  : "border-[#e5e1d9] bg-[#fbfaf7] text-[#6b6660] hover:border-[#cfc9c0]"
              }`}
            >
              {isZh ? "无" : "None"}
            </button>

            {COVER_PRESETS.map((preset) => {
              const selected = findPreset(draft.cover)?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => patch("cover", selected ? "" : `preset:${preset.id}`)}
                  title={isZh ? preset.zh : preset.en}
                  style={{ background: preset.background }}
                  className={`h-10 w-16 cursor-pointer rounded-lg border transition-[box-shadow,border-color] ${
                    selected
                      ? "border-[#1c1b1a]/60 shadow-[0_0_0_2px_rgba(28,27,26,0.10)]"
                      : "border-[#e5e1d9] hover:border-[#cfc9c0]"
                  }`}
                />
              );
            })}

            {uploadedCover && (
              <button
                type="button"
                aria-pressed={draft.cover === uploadedCover}
                onClick={() => patch("cover", draft.cover === uploadedCover ? "" : uploadedCover)}
                title={isZh ? "用上传的图" : "Use the uploaded image"}
                className={`h-10 w-16 cursor-pointer overflow-hidden rounded-lg border transition-[box-shadow,border-color] ${
                  draft.cover === uploadedCover
                    ? "border-[#1c1b1a]/60 shadow-[0_0_0_2px_rgba(28,27,26,0.10)]"
                    : "border-[#e5e1d9] hover:border-[#cfc9c0]"
                }`}
              >
                <img src={uploadedCover} alt="" className="h-full w-full object-cover" />
              </button>
            )}

            <label
              className={`ui-btn ui-btn-ghost flex h-10 cursor-pointer items-center gap-1.5 px-3 text-[12px] ${
                coverBusy ? "opacity-60" : ""
              }`}
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {coverBusy ? (isZh ? "处理中…" : "Working…") : isZh ? "上传图片" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleCoverFile}
                disabled={coverBusy}
              />
            </label>
          </div>
          {coverError && (
            <span className="mt-1.5 block ui-row-meta">
              <span className="text-[#B42318]">{coverError}</span>
            </span>
          )}
        </div>

        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{examNameLabel(isZh)}</span>
          <input
            value={draft.examName}
            onChange={(event) => patch("examName", event.target.value)}
            className="ui-field"
            autoFocus
          />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "学科" : "Subject"}</span>
          <input
            value={draft.subject}
            onChange={(event) => patch("subject", event.target.value)}
            className="ui-field"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelCls}>{isZh ? "考试日期" : "Exam date"}</span>
          <input
            type="date"
            value={draft.examDate}
            onChange={(event) => patch("examDate", event.target.value)}
            className="ui-field tabular-nums"
          />
        </label>
        <label className="block min-w-0">
          <span className={labelCls}>{isZh ? "考试时间" : "Exam time"}</span>
          <input
            type="time"
            value={draft.examTime}
            onChange={(event) => patch("examTime", event.target.value)}
            className="ui-field tabular-nums"
          />
        </label>
        <label className="block min-w-0 sm:col-span-2">
          <span className={labelCls}>{isZh ? "目标分数或等级（可选）" : "Target score or grade (optional)"}</span>
          <input
            value={draft.target}
            onChange={(event) => patch("target", event.target.value)}
            placeholder={isZh ? "例如：90 分 / 优秀" : "e.g. 90 / A"}
            className="ui-field"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="ui-row-meta">
          {error ? (
            <span className="text-[#B42318]">{error}</span>
          ) : countdown ? (
            datePreviewText(countdown, isZh)
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
