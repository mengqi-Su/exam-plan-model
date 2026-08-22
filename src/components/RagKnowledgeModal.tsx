import React, { useState } from "react";
import {
  FileText,
  Sparkles,
  X,
  BookOpen,
  Send,
  Loader2,
  ExternalLink,
  Layers,
  GraduationCap,
  Bookmark,
  CheckCircle2,
  HelpCircle,
  Zap,
} from "lucide-react";
import { StudyTask, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";

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

      if (!res.ok) throw new Error("Failed to query RAG knowledge base");
      const data = await res.json();

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
            ? `基于已解析的备考资料，针对「${task.topicTitle}」的解析：\n\n1. **核心要点**：本考点在讲义中属于高频考查知识，需熟练掌握定义与基本方程推导。\n2. **解题规范**：注意严格检验前提条件，避免在特殊边界情况下失分。\n3. **真题建议**：建议回顾对应题型的标准作答格式。`
            : `Grounded in your materials for ${task.topicTitle}: review core formulas and boundary conditions before solving practice sets.`,
          citations: rag
            ? [
                {
                  documentName: rag.documentName,
                  sectionTitle: rag.sectionTitle || "",
                  excerpt: rag.excerptSnippet,
                },
              ]
            : [],
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="bg-white border border-[#111111] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-[#111111] font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#111111] bg-[#fafafa]">
          <div className="flex items-center space-x-2.5">
            <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold">
              [{isZh ? "资料溯源问答" : "RAG-QA"}]
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-xs uppercase tracking-tight text-[#111111]">
                  {isZh ? "AI 任务 RAG 资料溯源与精准问答" : "RAG MATERIAL GROUNDING & QA"}
                </h3>
                <span className="border border-[#111111] bg-white text-[#111111] px-1 py-0.2 text-[9px] font-bold">
                  {isZh ? "已溯源" : "GROUNDED"}
                </span>
              </div>
              <p className="text-[10px] text-[#666666] truncate max-w-md mt-0.5">
                {task.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs font-mono">

          {userNeed && (
            <div className="p-3 bg-[#fafafa] border border-[#111111] space-y-1">
              <div className="flex items-center space-x-1.5 text-[#666666] font-bold text-[10px] uppercase">
                <span>[{isZh ? "目标匹配" : "LEARNING GOAL MATCH"}]</span>
              </div>
              <p className="text-[#111111] font-bold leading-relaxed">{userNeed}</p>
            </div>
          )}

          <div className="p-3.5 bg-white border border-[#111111] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 font-bold text-xs text-[#111111]">
                <FileText className="w-3.5 h-3.5" />
                <span>{rag?.documentName || (isZh ? "关联备考资料" : "Grounded Material")}</span>
              </div>
              {rag?.pageOrChapter && (
                <span className="text-[10px] font-bold border border-[#111111] px-1.5 py-0.2 bg-[#fafafa]">
                  {rag.pageOrChapter}
                </span>
              )}
            </div>

            {rag?.sectionTitle && (
              <div className="text-[11px] text-[#666666]">
                <span>{isZh ? "章节/考点：" : "SECTION: "}</span>
                <span className="text-[#111111] font-bold">{rag.sectionTitle}</span>
              </div>
            )}

            {rag?.excerptSnippet && (
              <div className="p-2.5 bg-[#fafafa] border-l-2 border-[#111111] text-[11px] text-[#333333] leading-relaxed italic">
                "{rag.excerptSnippet}"
              </div>
            )}

            {formulas && formulas.length > 0 && (
              <div className="pt-1.5 border-t border-[#111111] space-y-1">
                <span className="text-[10px] font-bold text-[#666666] uppercase tracking-wider block">
                  {isZh ? "[核心公式与解题准则]" : "[KEY FORMULAS & RULES]"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {formulas.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-white text-[#111111] border border-[#111111] font-bold text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.practiceQuestionRef && (
              <div className="text-[11px] text-[#111111] font-bold flex items-center space-x-1">
                <span>[{isZh ? "真题出处" : "PAST-EXAM-REF"}]</span>
                <span>{task.practiceQuestionRef}</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-[#666666]">
              {isZh ? "[快捷提问]：" : "[QUICK PROMPTS]:"}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                isZh ? `总结「${task.topicTitle}」的最核心公式` : `Summary formulas for ${task.topicTitle}`,
                isZh ? `这道大题最容易失分的陷阱是什么？` : `What are the tricky pitfalls?`,
                isZh ? `用简短步骤讲解标准解题思路` : `Step-by-step solving guide`,
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskRAG(suggestion)}
                  disabled={isAsking}
                  className="px-2.5 py-1 bg-white hover:bg-[#111111] hover:text-white text-[#111111] text-[11px] border border-[#111111] transition-colors text-left cursor-pointer"
                >
                  [{suggestion}]
                </button>
              ))}
            </div>
          </div>

          {chatHistory.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#111111]">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] p-3 text-xs leading-relaxed border border-[#111111] ${
                      msg.sender === "user"
                        ? "bg-[#111111] text-white"
                        : "bg-[#fafafa] text-[#111111] space-y-2"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#111111] space-y-1">
                        <span className="text-[10px] font-bold text-[#666666] uppercase block">
                          {isZh ? "[讲义溯源引用]" : "[CITATIONS]"}
                        </span>
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-1.5 bg-white border border-[#111111] text-[10px] text-[#111111]"
                          >
                            <span className="font-bold">{c.documentName}</span>
                            {c.sectionTitle && <span className="text-[#666666]"> - {c.sectionTitle}</span>}
                            <p className="italic text-[#666666] mt-0.5">"{c.excerpt}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex items-center space-x-2 text-xs text-[#111111] p-2 bg-[#fafafa] border border-[#111111] max-w-[240px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#111111]" />
                  <span>{isZh ? "正在检索讲义切片并回答..." : "Searching materials..."}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-[#111111] bg-[#fafafa] flex items-center space-x-2 font-mono">
          <input
            type="text"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAskRAG()}
            placeholder={
              isZh
                ? `向上传的资料提问关于「${task.topicTitle}」...`
                : `Ask grounded question about ${task.topicTitle}...`
            }
            className="flex-1 bg-white border border-[#111111] px-3 py-2 text-xs text-[#111111] placeholder-[#999999] focus:outline-none"
          />
          <button
            onClick={() => handleAskRAG()}
            disabled={!questionInput.trim() || isAsking}
            className="px-4 py-2 bg-[#111111] hover:bg-[#333333] disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            {isZh ? "[发送]" : "[SEND]"}
          </button>
        </div>
      </div>
    </div>
  );
}
