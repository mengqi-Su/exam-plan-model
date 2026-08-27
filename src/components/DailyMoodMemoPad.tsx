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

  return (
    <div className="border border-[#111111] bg-[#fffdf0] text-[#111111] font-mono text-xs shadow-[2px_2px_0px_#111111]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#111111] bg-[#fffbe6] flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-bold">
          <PenLine className="w-3.5 h-3.5 text-[#111111]" />
          <span className="uppercase text-[11px]">
            [{language === "zh" ? "随心记便签" : "DAILY MEMO"}]
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {savedTimeStr && (
            <span className="text-[10px] text-[#666666] flex items-center space-x-0.5">
              {isSaved ? (
                <>
                  <Check className="w-3 h-3 text-[#111111]" />
                  <span>{language === "zh" ? "已保存" : "Saved"}</span>
                </>
              ) : (
                <span>{savedTimeStr}</span>
              )}
            </span>
          )}

          {content && (
            <button
              onClick={handleClear}
              className="text-[#888888] hover:text-[#111111] transition-colors p-0.5 cursor-pointer"
              title={language === "zh" ? "清空便签" : "Clear"}
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
            language === "zh"
              ? "写下今天的心情、闪念收获、或是给自己打打气..."
              : "Write down your thoughts, reflections, or note to self..."
          }
          rows={4}
          className="w-full p-2.5 bg-white border border-[#111111] text-xs text-[#111111] placeholder-[#999999] focus:outline-none focus:ring-1 focus:ring-[#111111] font-sans resize-y leading-relaxed"
        />
        <div className="flex items-center justify-between text-[10px] text-[#888888] pt-1">
          <span>
            {content.length} {language === "zh" ? "字" : "chars"}
          </span>
          <span>{language === "zh" ? "自动保存" : "Auto-saved"}</span>
        </div>
      </div>
    </div>
  );
}
