import React, { useState, useEffect, useRef } from "react";
import { PenLine, Check, Trash2 } from "lucide-react";
import { getDailyMemo, saveDailyMemo, deleteDailyMemo } from "../lib/storage";

interface DailyMoodMemoPadProps {
  dateStr: string;
  language?: "zh" | "en";
  onMemoUpdated?: () => void;
}

export function DailyMoodMemoPad({
  dateStr,
  language = "zh",
  onMemoUpdated,
}: DailyMoodMemoPadProps) {
  const [content, setContent] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [savedTimeStr, setSavedTimeStr] = useState<string | null>(null);

  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load existing memo on date change
  useEffect(() => {
    const existing = getDailyMemo(dateStr);
    if (existing) {
      setContent(existing.content || "");
      if (existing.updatedAt) {
        const d = new Date(existing.updatedAt);
        const hours = String(d.getHours()).padStart(2, "0");
        const mins = String(d.getMinutes()).padStart(2, "0");
        setSavedTimeStr(`${hours}:${mins}`);
      }
    } else {
      setContent("");
      setSavedTimeStr(null);
    }
    setIsSaved(false);
  }, [dateStr]);

  const triggerSave = (newContent: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      saveDailyMemo(dateStr, {
        content: newContent,
      });

      const d = new Date();
      const hours = String(d.getHours()).padStart(2, "0");
      const mins = String(d.getMinutes()).padStart(2, "0");
      setSavedTimeStr(`${hours}:${mins}`);
      setIsSaved(true);
      if (onMemoUpdated) onMemoUpdated();

      setTimeout(() => {
        setIsSaved(false);
      }, 2000);
    }, 350);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setContent(text);
    triggerSave(text);
  };

  const handleClear = () => {
    if (content) {
      setContent("");
      setSavedTimeStr(null);
      deleteDailyMemo(dateStr);
      if (onMemoUpdated) onMemoUpdated();
    }
  };

  const isZh = language === "zh";

  return (
    <div className="rounded-xl border border-[#ece5d2] bg-[#fffdf5] text-[#1c1b1a] text-xs shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#f0ead8] bg-[#fffbe9] flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-[#6b6660]">
          <PenLine className="w-3.5 h-3.5 text-[#a39e97]" />
          <span className="text-[11px]">
            {isZh ? "随心记便签" : "Daily memo"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {savedTimeStr && (
            <span className="text-[10px] text-[#8a8580] flex items-center gap-0.5 tabular-nums">
              {isSaved ? (
                <>
                  <Check className="w-3 h-3 text-[#3F6B4F]" />
                  <span>{isZh ? "已保存" : "Saved"}</span>
                </>
              ) : (
                <span>{savedTimeStr}</span>
              )}
            </span>
          )}

          {content && (
            <button
              onClick={handleClear}
              className="text-[#a39e97] hover:text-[#B42318] transition-colors p-0.5 cursor-pointer"
              title={isZh ? "清空便签" : "Clear"}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Pure Text Area */}
      <div className="p-2.5">
        <textarea
          value={content}
          onChange={handleContentChange}
          placeholder={
            isZh
              ? "写下今天的心情、闪念收获、或是给自己打打气..."
              : "Write down your thoughts, reflections, or note to self..."
          }
          rows={4}
          className="w-full p-2.5 rounded-lg bg-white border border-[#ece5d2] text-xs text-[#1c1b1a] placeholder-[#b5ae9e] focus:outline-none focus:border-[#d9cfae] resize-y leading-relaxed transition-colors"
        />
        <div className="flex items-center justify-between text-[10px] text-[#a39e97] pt-1 tabular-nums">
          <span>
            {content.length} {isZh ? "字" : "chars"}
          </span>
          <span>{isZh ? "自动保存" : "Auto-saved"}</span>
        </div>
      </div>
    </div>
  );
}
