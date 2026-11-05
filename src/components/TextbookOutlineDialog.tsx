import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, BookOpen, Check, Loader2, Sparkles, X } from "lucide-react";
import { SyllabusTopic, TextbookChapter, TextbookOutline } from "../types";
import { useI18n } from "../lib/i18n";
import { GenerationError, runGeneration } from "../lib/aiClient";
import { ModalShell } from "./ModalShell";
import { normalizeTopicTitle } from "../lib/topics";

/**
 * 只填一个教材名，先把这本教材的通行目录回忆出来给人过目：
 * 勾选 / 改名 / 调学时都在这一屏做完，确认后才逐章展开成考点。
 * 目录记错是常态而不是意外，所以「先看目录、再生成考点」这两步不能合成一步。
 * 向导与科目页共用这一个弹窗，不在两处各写一套。
 */

interface DraftChapter extends TextbookChapter {
  checked: boolean;
}

const CONFIDENCE_TONE: Record<string, string> = {
  high: "bg-[#EAF3EC] text-[#2F6B41]",
  medium: "bg-[#FBF3DC] text-[#8A5A00]",
  low: "bg-[#FBEAE8] text-[#B42318]",
};

interface TextbookOutlineDialogProps {
  open: boolean;
  onClose: () => void;
  examName?: string;
  subject?: string;
  /** 展开好的考点由调用方决定是替换资料提炼的结果，还是并科目里现有的考点 */
  onApply: (topics: SyllabusTopic[], outline: TextbookOutline) => void;
  /** 已经存在的考点标题，用来标出「这本教材的这几章你已经有大单元了」 */
  existingTopicTitles?: string[];
}

export function TextbookOutlineDialog({
  open,
  onClose,
  examName,
  subject,
  onApply,
  existingTopicTitles = [],
}: TextbookOutlineDialogProps) {
  const { language } = useI18n();
  const tt = (zh: string, en: string) => (language === "zh" ? zh : en);

  const [textbook, setTextbook] = useState("");
  const [outline, setOutline] = useState<TextbookOutline | null>(null);
  const [drafts, setDrafts] = useState<DraftChapter[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const workingRef = useRef(false);

  useEffect(() => {
    if (!open) {
      workingRef.current = false;
      setIsWorking(false);
      setStatus("");
      setError("");
      // 关窗即作废这份草稿：勾过的章节已经变成考点了，下次点开该是一段新目录，
      // 而不是停在上一页（按钮写的是「重新整理目录」）。书名留着，不用重打。
      setOutline(null);
      setDrafts([]);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const checkedDrafts = useMemo(() => drafts.filter((draft) => draft.checked), [drafts]);
  const checkedHours = useMemo(
    () => Math.round(checkedDrafts.reduce((sum, draft) => sum + (draft.estimatedHours || 0), 0)),
    [checkedDrafts]
  );

  // 「已有」按当前考点实时算，不能冻结在回忆目录那一刻：中途手动加了大单元，标记要跟着变。
  const existingKeys = useMemo(
    () => new Set(existingTopicTitles.map((title) => normalizeTopicTitle(title)).filter(Boolean)),
    [existingTopicTitles]
  );
  const isAlreadyThere = (title: string) => existingKeys.has(normalizeTopicTitle(title));

  const clearDrafts = (chapters: TextbookChapter[]): DraftChapter[] =>
    chapters.map((chapter) => ({ ...chapter, checked: !isAlreadyThere(chapter.title) }));

  const patchDraft = (id: string, patch: Partial<DraftChapter>) => {
    setDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)));
  };

  const requestToc = async () => {
    const name = textbook.trim();
    if (!name || workingRef.current) return;
    workingRef.current = true;
    setIsWorking(true);
    setError("");
    setStatus(tt("正在整理目录…", "Rebuilding the outline…"));
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { result } = await runGeneration<TextbookOutline>(
        "textbook-toc",
        { textbook: name, examName, subject },
        { language, signal: controller.signal, onStatus: setStatus }
      );
      setOutline(result);
      setDrafts(clearDrafts(result.chapters));
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err instanceof GenerationError ? err.message : String(err?.message || err));
      }
    } finally {
      workingRef.current = false;
      setIsWorking(false);
      setStatus("");
      abortRef.current = null;
    }
  };

  const requestTopics = async () => {
    if (!outline || !checkedDrafts.length || workingRef.current) return;
    workingRef.current = true;
    setIsWorking(true);
    setError("");
    setStatus(tt("正在展开勾选的章节…", "Expanding the selected chapters…"));
    const controller = new AbortController();
    abortRef.current = controller;
    const chapters: TextbookChapter[] = checkedDrafts.map((draft) => ({
      id: draft.id,
      index: draft.index,
      title: draft.title.trim() || `第 ${draft.index} 章`,
      sections: draft.sections,
      weightPercentage: draft.weightPercentage,
      difficulty: draft.difficulty,
      estimatedHours: draft.estimatedHours,
    }));
    try {
      const { result } = await runGeneration<{ summary: string; topics: SyllabusTopic[] }>(
        "textbook-topics",
        { textbook: outline.textbook || textbook.trim(), chapters },
        { language, signal: controller.signal, onStatus: setStatus }
      );
      onApply(result.topics, { ...outline, chapters });
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setError(err instanceof GenerationError ? err.message : String(err?.message || err));
      }
    } finally {
      workingRef.current = false;
      setIsWorking(false);
      setStatus("");
      abortRef.current = null;
    }
  };

  const stopWorking = () => abortRef.current?.abort();

  const close = () => {
    if (workingRef.current) return;
    onClose();
  };

  /* ---------------- 第一屏：只填教材名 ---------------- */

  if (!outline) {
    return (
      <ModalShell
        open={open}
        onClose={close}
        title={tt("按教材目录整理考点", "Build topics from a textbook")}
        closeLabel={tt("关闭教材目录弹窗", "Close textbook outline dialog")}
        icon={<BookOpen className="h-4 w-4" />}
        size="md"
        note={
          <span className="ui-row-meta">
            {tt("目录只是回忆出来的草稿，勾完才会变成考点。", "The outline is a recalled draft; nothing becomes a topic until you tick it.")}
          </span>
        }
        footer={
          <>
            <button onClick={close} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
              {tt("取消", "Cancel")}
            </button>
            <button
              onClick={() => void requestToc()}
              disabled={!textbook.trim() || isWorking}
              className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
            >
              {isWorking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{isWorking ? status || tt("整理中…", "Working…") : tt("整理目录", "Rebuild outline")}</span>
            </button>
          </>
        }
      >
        <div>
          <label className="ui-field-label" htmlFor="textbook-name">
            {tt("教材名称", "Textbook")}
          </label>
          <input
            id="textbook-name"
            type="text"
            value={textbook}
            maxLength={200}
            onChange={(event) => setTextbook(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void requestToc();
            }}
            placeholder={tt("如：数据结构（C 语言版）第 2 版", "e.g. Introduction to Algorithms, 3rd ed.")}
            className="ui-field"
            disabled={isWorking}
          />
          <p className="ui-note mt-2">
            {tt(
              "写准书名和版次，目录会更贴近你手上那一本；不写版次也能出目录，只是章节名可能和你那本不完全一致。拿到目录后先对着勾选，不确定的章不勾就行。",
              "The exact title and edition give a closer match to your copy; the edition is optional, chapter names may then differ slightly. Tick only the chapters you recognise."
            )}
          </p>
        </div>

        {(examName || subject) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {examName && <span className="ui-chip">{examName}</span>}
            {subject && <span className="ui-chip">{subject}</span>}
            <span className="ui-row-meta">{tt("权重会按这场考试的侧重来分。", "Weights follow this exam.")}</span>
          </div>
        )}

        {isWorking && (
          <div className="flex items-center gap-2 rounded-lg bg-[#faf9f6] px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8a8580]" />
            <span className="ui-row-meta flex-1">{status}</span>
            <button onClick={stopWorking} className="ui-btn-text">
              {tt("取消", "Cancel")}
            </button>
          </div>
        )}

        {error && !isWorking && (
          <div className="flex items-start gap-2 rounded-lg bg-[#FBEAE8] px-3 py-2 text-[12px] leading-relaxed text-[#B42318]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
          </div>
        )}
      </ModalShell>
    );
  }

  /* ---------------- 第二屏：章节预览，勾选后展开 ---------------- */

  const confidenceLabel = {
    high: tt("把握较大", "High confidence"),
    medium: tt("部分章节需核对", "Medium confidence"),
    low: tt("目录仅供参考", "Low confidence"),
  }[outline.confidence] || outline.confidence;

  return (
    <ModalShell
      open={open}
      onClose={close}
      title={tt(`《${outline.textbook || textbook.trim()}》目录`, `Outline of "${outline.textbook || textbook.trim()}"`)}
      closeLabel={tt("关闭教材目录弹窗", "Close textbook outline dialog")}
      icon={<BookOpen className="h-4 w-4" />}
      size="lg"
      bodyClassName="space-y-3"
      note={
        isWorking ? (
          <span className="ui-row-meta flex min-w-0 flex-1 items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            <span className="min-w-0 truncate">{status}</span>
          </span>
        ) : (
          <span className="ui-row-meta">
            {tt(
              `已选 ${checkedDrafts.length}/${drafts.length} 章 · 约 ${checkedHours} 学时`,
              `${checkedDrafts.length}/${drafts.length} chapters · ~${checkedHours} h`
            )}
          </span>
        )
      }
      footer={
        <>
          {isWorking ? (
            <button onClick={stopWorking} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
              {tt("停止", "Stop")}
            </button>
          ) : (
            <button
              onClick={() => {
                setOutline(null);
                setDrafts([]);
              }}
              className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
            >
              {tt("换一本", "Use another book")}
            </button>
          )}
          <button
            onClick={() => void requestTopics()}
            disabled={!checkedDrafts.length || isWorking}
            className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
          >
            {!isWorking && <Check className="h-3.5 w-3.5" />}
            <span>
              {isWorking
                ? tt("展开中…", "Expanding…")
                : tt(`展开 ${checkedDrafts.length} 章考点`, `Expand ${checkedDrafts.length} chapters`)}
            </span>
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${CONFIDENCE_TONE[outline.confidence] || CONFIDENCE_TONE.medium}`}>
          {confidenceLabel}
        </span>
        <span className="ui-chip">{tt("AI 按教材名回忆", "Recalled from the book name")}</span>
      </div>

      {outline.summary && <p className="ui-note">{outline.summary}</p>}

      {outline.note && (
        <div className="flex items-start gap-2 rounded-lg bg-[#FBF3DC] px-3 py-2 text-[12px] leading-relaxed text-[#8A5A00]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{outline.note}</span>
        </div>
      )}

      <ul className="divide-y divide-[#f0ede8] overflow-hidden rounded-xl border border-[#eae7e1] bg-white">
        {drafts.map((draft) => (
          <li key={draft.id} className="px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => patchDraft(draft.id, { checked: !draft.checked })}
                role="checkbox"
                aria-checked={draft.checked}
                aria-label={tt(`勾选第 ${draft.index} 章`, `Tick chapter ${draft.index}`)}
                className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer ${
                  draft.checked ? "border-[#1c1b1a] bg-[#1c1b1a] text-white" : "border-[#cfc9c0] bg-white text-transparent hover:border-[#8a8580]"
                }`}
              >
                <Check className="h-3 w-3" />
              </button>
              <span className="ui-row-meta w-5 shrink-0 tabular-nums">{draft.index}</span>
              <input
                type="text"
                value={draft.title}
                maxLength={300}
                onChange={(event) => patchDraft(draft.id, { title: event.target.value })}
                aria-label={tt("章节名称", "Chapter title")}
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-[#1c1b1a] outline-none transition-colors hover:border-[#e5e2dc] focus:border-[#cfc9c0] focus:bg-white"
              />
              {isAlreadyThere(draft.title) && (
                <span className="ui-chip shrink-0">{tt("已有", "Exists")}</span>
              )}
              <label className="flex shrink-0 items-center gap-1">
                <span className="ui-row-meta">{tt("权重", "Wt")}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.weightPercentage}
                  onChange={(event) => patchDraft(draft.id, { weightPercentage: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
                  aria-label={tt("建议权重", "Suggested weight")}
                  className="w-14 rounded-lg border border-[#e5e2dc] bg-white px-1.5 py-1 text-[12px] tabular-nums text-[#1c1b1a] outline-none focus:border-[#cfc9c0]"
                />
              </label>
              <label className="flex shrink-0 items-center gap-1">
                <span className="ui-row-meta">{tt("学时", "Hrs")}</span>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={draft.estimatedHours}
                  onChange={(event) => patchDraft(draft.id, { estimatedHours: Math.max(0, Math.min(120, Number(event.target.value) || 0)) })}
                  aria-label={tt("建议学时", "Suggested hours")}
                  className="w-14 rounded-lg border border-[#e5e2dc] bg-white px-1.5 py-1 text-[12px] tabular-nums text-[#1c1b1a] outline-none focus:border-[#cfc9c0]"
                />
              </label>
            </div>
            {draft.sections.length > 0 && (
              <p className="ui-row-meta mt-1 pl-[52px] leading-relaxed">{draft.sections.join(" · ")}</p>
            )}
          </li>
        ))}
      </ul>

      <p className="ui-row-meta">
        {tt(
          "回忆的目录不会替换你从资料里提炼的考点；确认后会并进来，标着「教材目录」，随时可以删。",
          "Recalled topics never overwrite ones extracted from your materials; they merge in marked “Textbook” and can be deleted any time."
        )}
      </p>

      {error && !isWorking && (
        <div className="flex items-start gap-2 rounded-lg bg-[#FBEAE8] px-3 py-2 text-[12px] leading-relaxed text-[#B42318]">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">{error}</span>
          <button onClick={() => setError("")} aria-label={tt("关闭提示", "Dismiss")} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </ModalShell>
  );
}
