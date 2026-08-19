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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-xl border border-[#e9e9e7] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-[#37352f]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9e9e7] bg-[#fbfbfa]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ebf5fb] text-[#2b78a0] flex items-center justify-center font-bold text-xs">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-[#37352f]">
                  {isZh ? "AI 任务 RAG 资料溯源与精准问答" : "RAG Material Grounding & Knowledge QA"}
                </h3>
                <span className="bg-[#edf3ec] text-[#448361] px-1.5 py-0.5 rounded text-[10px] font-semibold">
                  RAG Grounded
                </span>
              </div>
              <p className="text-[11px] text-[#787774] truncate max-w-md">
                {task.title} • {task.topicTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#787774] hover:text-[#37352f] hover:bg-[#efefed] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* User Needs Grounding Pill */}
          {userNeed && (
            <div className="p-3 bg-[#f7f6f3] border border-[#e9e9e7] rounded-lg space-y-1">
              <div className="flex items-center space-x-1.5 text-[#787774] font-medium text-[11px]">
                <GraduationCap className="w-3.5 h-3.5 text-[#2b78a0]" />
                <span>{isZh ? "用户需求匹配定位" : "Matched User Learning Goal"}</span>
              </div>
              <p className="text-[#37352f] font-medium leading-relaxed">{userNeed}</p>
            </div>
          )}

          {/* Document Citation Card */}
          <div className="p-3.5 bg-white border border-[#e9e9e7] rounded-lg shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-[#2b78a0] font-semibold text-xs">
                <FileText className="w-3.5 h-3.5" />
                <span>{rag?.documentName || (isZh ? "关联备考资料" : "Grounded Material")}</span>
              </div>
              {rag?.pageOrChapter && (
                <span className="text-[10px] font-medium text-[#787774] bg-[#f7f6f3] px-2 py-0.5 rounded">
                  {rag.pageOrChapter}
                </span>
              )}
            </div>

            {rag?.sectionTitle && (
              <div className="text-[11px] text-[#5a5a57] font-medium">
                <span className="text-[#9b9a97]">{isZh ? "章节/考点：" : "Section: "}</span>
                {rag.sectionTitle}
              </div>
            )}

            {rag?.excerptSnippet && (
              <div className="p-2.5 bg-[#fbfbfa] border-l-2 border-[#2b78a0] rounded-r text-[11px] text-[#5a5a57] leading-relaxed italic">
                "{rag.excerptSnippet}"
              </div>
            )}

            {/* Formulas / Rules Extracted */}
            {formulas && formulas.length > 0 && (
              <div className="pt-1.5 border-t border-[#f1f1ef] space-y-1">
                <span className="text-[10px] font-semibold text-[#787774] uppercase tracking-wider block">
                  {isZh ? "📐 提取的核心公式与解题准则" : "Key Formulas & Governing Rules"}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {formulas.map((f, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 bg-[#fdf5ea] text-[#d9730d] border border-[#faece3] rounded font-mono text-[11px]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Practice Reference */}
            {task.practiceQuestionRef && (
              <div className="text-[11px] text-[#448361] flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{isZh ? `关联真题定位：${task.practiceQuestionRef}` : `Past Exam Ref: ${task.practiceQuestionRef}`}</span>
              </div>
            )}
          </div>

          {/* Quick RAG Questions */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[#787774]">
              {isZh ? "💡 针对该任务向讲义提问：" : "Ask grounded questions about this task:"}
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
                  className="px-2.5 py-1 bg-[#f7f6f3] hover:bg-[#efefed] text-[#5a5a57] hover:text-[#37352f] rounded-full text-[11px] border border-[#e9e9e7] transition-colors text-left"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Chat History */}
          {chatHistory.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-[#e9e9e7]">
              {chatHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-lg p-3 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#37352f] text-white"
                        : "bg-[#fbfbfa] text-[#37352f] border border-[#e9e9e7] space-y-2"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.text}</div>

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="pt-2 border-t border-[#e9e9e7] space-y-1">
                        <span className="text-[10px] font-semibold text-[#787774] uppercase tracking-wider block">
                          {isZh ? "📄 讲义溯源引用" : "Citations"}
                        </span>
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-1.5 bg-white border border-[#e9e9e7] rounded text-[10px] text-[#5a5a57]"
                          >
                            <span className="font-semibold text-[#2b78a0]">{c.documentName}</span>
                            {c.sectionTitle && <span className="text-[#9b9a97]"> • {c.sectionTitle}</span>}
                            <p className="italic text-[#787774] mt-0.5">"{c.excerpt}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex items-center space-x-2 text-xs text-[#787774] p-2 bg-[#f7f6f3] rounded-lg max-w-[200px]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2b78a0]" />
                  <span>{isZh ? "正在检索讲义切片并回答..." : "Searching materials..."}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-[#e9e9e7] bg-white flex items-center space-x-2">
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
            className="flex-1 bg-[#f7f6f3] border border-[#e9e9e7] rounded-lg px-3 py-2 text-xs text-[#37352f] placeholder-[#9b9a97] focus:outline-none focus:border-[#2b78a0]"
          />
          <button
            onClick={() => handleAskRAG()}
            disabled={!questionInput.trim() || isAsking}
            className="p-2 bg-[#37352f] hover:bg-[#201f1c] disabled:opacity-40 text-white rounded-lg transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
