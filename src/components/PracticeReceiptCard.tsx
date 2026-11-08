import React from "react";
import { CheckCircle2, MapPin, X } from "lucide-react";
import type { PracticeEvent } from "../types";
import { useI18n } from "../lib/i18n";

/**
 * 练习回执卡片（联动 M2）
 *
 * 只展示本机已落盘的 practice_events：一条 = StarQuiz 里的一次练习，
 * 计数只包含归因到该考点的题目。M2 阶段绝不改动任何 StudyTask，
 * 「采纳为复习任务」要到 M3 由用户明确确认后才出现。
 */

interface PracticeReceiptCardProps {
  events: PracticeEvent[];
  /** 该考点在本机计划里是否还能定位（决定「定位到考点」是否可用） */
  onLocate: (event: PracticeEvent) => void;
  onDismiss: (attemptId: string) => void;
  maxVisible?: number;
}

function localTimeLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PracticeReceiptCard({ events, onLocate, onDismiss, maxVisible = 4 }: PracticeReceiptCardProps) {
  const { t } = useI18n();
  const rows = events.filter((event) => event.status === "pending" || event.status === "unmatched");
  if (rows.length === 0) return null;

  const visible = rows.slice(0, maxVisible);

  return (
    <section className="ui-card overflow-hidden animate-fadeIn" aria-label={t("receiptEyebrow")}>
      <div className="flex items-center justify-between gap-3 border-b border-[#f0ede8] bg-[#faf9f6] px-4 sm:px-5 py-3">
        <span className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#6b6660]" />
          <span className="ui-section-title truncate">{t("receiptEyebrow")}</span>
        </span>
        <span className="ui-chip tabular-nums shrink-0">{t("receiptCountTag", { count: rows.length })}</span>
      </div>

      <ul className="divide-y divide-[#f0ede8]">
        {visible.map((event) => {
          const unmatched = event.status === "unmatched";
          const pct = event.graded > 0 ? Math.round((event.correct / event.graded) * 100) : 0;
          return (
            <li
              key={event.attemptId}
              data-receipt-attempt={event.attemptId}
              data-receipt-status={event.status}
              className="px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-start gap-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[13px] leading-relaxed text-[#1c1b1a]">
                  {unmatched
                    ? t("receiptUnmatchedBody", { graded: event.graded, correct: event.correct })
                    : t("receiptBody", { topic: event.path.topic, graded: event.graded, correct: event.correct, pct })}
                </p>
                <p className="ui-row-meta tabular-nums flex items-center gap-2 flex-wrap">
                  {unmatched ? (
                    <>
                      {/* 来源路径三段各占一块，由外层 gap 断句，不再用 · 串成一行 */}
                      <span>{event.path.subject}</span>
                      <span>{event.path.unit}</span>
                      <span>{event.path.topic}</span>
                      <span>{localTimeLabel(event.completedAt)}</span>
                    </>
                  ) : (
                    <span>{t("receiptMeta", { time: localTimeLabel(event.completedAt) })}</span>
                  )}
                  <span className={`ui-chip ${unmatched ? "!text-[#8A5A00] !bg-[#FFF6DD]" : ""}`}>
                    {unmatched ? t("receiptUnmatchedTag") : t("receiptPendingTag")}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {!unmatched && (
                  <button
                    onClick={() => onLocate(event)}
                    className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px]"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{t("receiptLocateAction")}</span>
                  </button>
                )}
                <button
                  onClick={() => onDismiss(event.attemptId)}
                  className="p-1.5 rounded-lg border border-transparent text-[#6b6660] hover:bg-[#f1efe9] hover:text-[#1c1b1a] transition-colors cursor-pointer"
                  aria-label={t("receiptDismissAction")}
                  title={t("receiptDismissAction")}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
