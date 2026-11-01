import React, { useEffect, useState } from "react";
import { BookOpen, FileText, Loader2, Send, X } from "lucide-react";
import { StudyTask, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { readApiError } from "../lib/aiClient";

interface RagKnowledgeModalProps {
  task: StudyTask;
  plan: ExamStudyPlan;
  isOpen: boolean;
  onClose: () => void;
}

export function RagKnowledgeModal({ task, plan, isOpen, onClose }: RagKnowledgeModalProps) {
  const { language } = useI18n();
  const isZh = language === "zh";

  const [questionInput, setQuestionInput] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    Array<{ sender: "user" | "ai"; text: string; citations?: Array<{ documentName: string; sectionTitle: string; excerpt: string }> }>
  >([]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rag = task.ragSource;
  const userNeed = task.groundedUserNeed;
  const formulas = task.formulaOrRules;

  const handleAskRAG = async (queryText?: string) => {
    const q = (queryText || questionInput).trim();
    if (!q || isAsking) return;

    setQuestionInput("");
    setChatHistory((prev) => [...prev, { sender: "user", text: q }]);
    setIsAsking(true);

    try {
      const res = await fetch("/api/rag-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          topicTitle: task.topicTitle,
          taskTitle: task.title,
          materials: plan.materials || [],
        }),
      });

      if (!res.ok) {
        const apiError = await readApiError(res, language);
        throw new Error(apiError.message);
      }
      const data = await res.json();
      if (!data?.answer || typeof data.answer !== "string") {
        throw new Error(
          isZh ? "AI 服务未返回有效回答，请稍后重试。" : "The AI service returned no usable answer. Please try again."
        );
      }

      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.answer,
          citations: data.citations || [],
        },
      ]);
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        {
          sender: "ai",
          text: isZh
            ? `本次提问未能获得可靠回答：${err?.message || "请稍后重试。"}\n\n资料原文仍可在上方查看，你可以直接依据讲义片段复习。`
            : `This question could not be answered reliably: ${err?.message || "Please try again later."}\n\nYou can still review the material excerpt shown above.`,
          citations: [],
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const quickPrompts = [
    isZh ? `梳理「${task.topicTitle}」的核心要点` : `Summarize the key points of "${task.topicTitle}"`,
    isZh ? "这份资料里最容易混淆的概念是什么？" : "Which concepts in this material are easiest to confuse?",
    isZh ? "用三步复述本节重点" : "Summarize this section in three steps",
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ask-materials-title"
        className="bg-white border border-[#111111] w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden text-[#111111] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[#111111] bg-[#FAF9F6]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 shrink-0 border border-[#111111] bg-[#FCD33B] flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 id="ask-materials-title" className="text-sm font-bold tracking-tight">
                  {isZh ? "向资料提问" : "Ask your materials"}
                </h3>
                <span className="border border-[#111111] bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {isZh ? "引用自资料" : "CITED FROM MATERIALS"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#666666] truncate">{task.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 min-w-9 min-h-9 shrink-0 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
            aria-label={isZh ? "关闭向资料提问" : "Close ask materials"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-[13px] select-text">
          {userNeed && (
            <div className="p-3 bg-[#FAF9F6] border border-[#111111] space-y-1">
              <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                [ {isZh ? "本次学习目标" : "LEARNING GOAL"} ]
              </div>
              <p className="text-[13px] font-semibold leading-relaxed">{userNeed}</p>
            </div>
          )}

          <div className="p-3.5 bg-white border border-[#111111] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 font-semibold text-[13px]">
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{rag?.documentName || (isZh ? "关联资料" : "Linked material")}</span>
              </div>
              {rag?.pageOrChapter && (
                <span className="font-mono text-[10px] font-bold border border-[#111111] px-1.5 py-0.5 bg-[#FAF9F6]">
                  {rag.pageOrChapter}
                </span>
              )}
            </div>

            {rag?.sectionTitle && (
              <div className="text-[12px] text-[#666666]">
                <span>{isZh ? "所在章节：" : "SECTION: "}</span>
                <span className="text-[#111111] font-semibold">{rag.sectionTitle}</span>
              </div>
            )}

            {rag?.excerptSnippet && (
              <div className="p-2.5 bg-[#FAF9F6] border-l-2 border-[#111111] text-[12px] text-[#333333] leading-relaxed italic">
                “{rag.excerptSnippet}”
              </div>
            )}

            {formulas && formulas.length > 0 && (
              <div className="pt-1.5 border-t border-[#111111]/20 space-y-1.5">
                <span className="font-mono text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                  [ {isZh ? "关键公式与规则" : "KEY FORMULAS & RULES"} ]
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {formulas.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white text-[#111111] border border-[#111111] font-medium text-[12px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#666666]">
              [ {isZh ? "可以这样问" : "QUICK PROMPTS"} ]
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskRAG(suggestion)}
                  disabled={isAsking}
                  className="px-2.5 min-h-8 bg-white hover:bg-[#111111] hover:text-white text-[#111111] text-[12px] border border-[#111111] transition-colors text-left cursor-pointer disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#777777] leading-relaxed">
              {isZh
                ? "回答只基于本课程已上传的资料；找不到依据时会直接说明。"
                : "Answers use only this course's uploaded materials. If no reliable source exists, the assistant says so."}
            </p>
          </div>

          {chatHistory.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#111111]">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[92%] p-3 text-[13px] leading-relaxed border border-[#111111] ${
                      msg.sender === "user"
                        ? "bg-[#111111] text-white"
                        : "bg-[#FAF9F6] text-[#111111] space-y-2"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#111111]/30 space-y-1">
                        <span className="font-mono text-[10px] font-bold text-[#666666] uppercase block">
                          [ {isZh ? "资料出处" : "SOURCES"} ]
                        </span>
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 bg-white border border-[#111111] text-[11px] text-[#111111]"
                          >
                            <span className="font-semibold">{c.documentName}</span>
                            {c.sectionTitle && <span className="text-[#666666]"> · {c.sectionTitle}</span>}
                            <p className="italic text-[#555555] mt-0.5 leading-relaxed">“{c.excerpt}”</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex items-center space-x-2 text-[12px] text-[#111111] p-2 bg-[#FAF9F6] border border-[#111111] max-w-[260px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#111111]" />
                  <span>{isZh ? "正在查阅资料..." : "Searching materials..."}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#111111] bg-[#FAF9F6] flex items-center gap-2">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskRAG()}
            placeholder={
              isZh
                ? `针对「${task.topicTitle}」向资料提问...`
                : `Ask about "${task.topicTitle}"...`
            }
            aria-label={isZh ? "向资料提问" : "Ask your materials"}
            className="flex-1 bg-white border border-[#111111] px-3 min-h-10 text-[13px] text-[#111111] placeholder-[#999999] focus:outline-none"
          />
          <button
            onClick={() => handleAskRAG()}
            disabled={!questionInput.trim() || isAsking}
            className="inline-flex items-center gap-1.5 px-4 min-h-10 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-[13px] transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            {isZh ? "发送" : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}
