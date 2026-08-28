import React, { useState, useMemo, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  X,
  FileText,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Search,
  Printer,
  ListTree,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { StudyMaterial } from "../types";
import { useI18n } from "../lib/i18n";

interface DocumentReaderModalProps {
  doc: StudyMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onLaunchQuiz?: (doc: StudyMaterial) => void;
  onScheduleDoc?: (doc: StudyMaterial) => void;
}

type ReaderTheme = "paper" | "dark" | "sepia";
type FontSize = "sm" | "base" | "lg" | "xl";

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  doc,
  isOpen,
  onClose,
  onLaunchQuiz,
  onScheduleDoc,
}) => {
  const { language } = useI18n();

  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [fontSize, setFontSize] = useState<FontSize>("base");
  const [showToc, setShowToc] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);

  // Reset states when opening a new doc
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setShowSearch(false);
      setIsCopied(false);
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, doc?.id]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Track reading scroll progress
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    if (scrollHeight <= clientHeight) {
      setReadingProgress(100);
      return;
    }
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)));
    setReadingProgress(progress);
  };

  // Generate Table of Contents (Headings) from Markdown content
  const tocItems = useMemo(() => {
    if (!doc?.content) return [];
    const lines = doc.content.split("\n");
    const headings: { id: string; text: string; level: number }[] = [];
    
    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const rawText = match[2].trim().replace(/[*_`]/g, "");
        const id = `heading-${idx}-${rawText.slice(0, 20).toLowerCase().replace(/\s+/g, "-")}`;
        headings.push({ id, text: rawText, level });
      }
    });

    return headings;
  }, [doc?.content]);

  // Word count and reading time estimate
  const stats = useMemo(() => {
    if (!doc?.content) return { words: 0, readMinutes: 1 };
    const charCount = doc.content.length;
    // Approx 350-400 characters per minute for reading
    const readMinutes = Math.max(1, Math.ceil(charCount / 380));
    return {
      words: charCount,
      readMinutes,
    };
  }, [doc?.content]);

  if (!isOpen || !doc) return null;

  // Copy full document text
  const handleCopy = () => {
    if (!doc.content) return;
    navigator.clipboard.writeText(doc.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Print document
  const handlePrint = () => {
    window.print();
  };

  // Scroll to heading in markdown
  const scrollToHeading = (text: string) => {
    if (!contentRef.current) return;
    const headingElements = contentRef.current.querySelectorAll("h1, h2, h3, h4");
    for (let i = 0; i < headingElements.length; i++) {
      const el = headingElements[i] as HTMLElement;
      if (el.innerText.includes(text) || text.includes(el.innerText)) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };

  // Category badge helper
  const getCategoryBadge = (type: StudyMaterial["type"]) => {
    switch (type) {
      case "syllabus":
        return { label: language === "zh" ? "考纲 / SYLLABUS" : "SYLLABUS", bg: "bg-[#111111]", text: "text-white" };
      case "past_exam":
        return { label: language === "zh" ? "真题 / PAST EXAM" : "PAST EXAM", bg: "bg-red-700", text: "text-white" };
      case "lecture_slides":
        return { label: language === "zh" ? "讲义 / LECTURE" : "LECTURE", bg: "bg-blue-700", text: "text-white" };
      case "textbook_outline":
        return { label: language === "zh" ? "教材 / TEXTBOOK" : "TEXTBOOK", bg: "bg-amber-600", text: "text-white" };
      case "notes":
      default:
        return { label: language === "zh" ? "笔记 / NOTES" : "NOTES", bg: "bg-emerald-700", text: "text-white" };
    }
  };

  const badge = getCategoryBadge(doc.type);

  // Theme styling definitions
  const themeStyles = {
    paper: {
      modalBg: "bg-[#FCFBF9]",
      headerBg: "bg-[#FAF8F5]",
      contentBg: "bg-[#FCFBF9]",
      text: "text-[#1E1E1E]",
      secondaryText: "text-[#666666]",
      border: "border-[#111111]",
      subtleBorder: "border-[#E8E4DA]",
      codeBg: "bg-[#F2EFE9]",
      blockquoteBg: "bg-[#F5F2EB]",
      tocBg: "bg-[#F7F5F0]",
      tocActive: "bg-[#EAE5DA] text-[#111111] font-bold",
      tocHover: "hover:bg-[#EFECE4]",
    },
    sepia: {
      modalBg: "bg-[#F5EFEB]",
      headerBg: "bg-[#ECE4DC]",
      contentBg: "bg-[#F5EFEB]",
      text: "text-[#2B2319]",
      secondaryText: "text-[#7A6A58]",
      border: "border-[#4A3B2C]",
      subtleBorder: "border-[#DECFC0]",
      codeBg: "bg-[#EAE0D3]",
      blockquoteBg: "bg-[#EAE0D3]",
      tocBg: "bg-[#ECE4DC]",
      tocActive: "bg-[#DFCFC1] text-[#2B2319] font-bold",
      tocHover: "hover:bg-[#E4D7C9]",
    },
    dark: {
      modalBg: "bg-[#18181A]",
      headerBg: "bg-[#222225]",
      contentBg: "bg-[#18181A]",
      text: "text-[#E4E4E7]",
      secondaryText: "text-[#A1A1AA]",
      border: "border-[#3F3F46]",
      subtleBorder: "border-[#27272A]",
      codeBg: "bg-[#27272A]",
      blockquoteBg: "bg-[#222226]",
      tocBg: "bg-[#202024]",
      tocActive: "bg-[#2E2E34] text-white font-bold",
      tocHover: "hover:bg-[#27272D]",
    },
  }[theme];

  // Font size classes
  const fontClasses = {
    sm: "text-[13px] leading-relaxed",
    base: "text-[15px] leading-relaxed",
    lg: "text-[17px] leading-relaxed",
    xl: "text-[19px] leading-loose",
  }[fontSize];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex flex-col w-full transition-all duration-200 border-2 ${themeStyles.border} ${themeStyles.modalBg} ${
          isFullscreen ? "h-[98vh] max-w-[98vw]" : "h-[90vh] max-w-5xl"
        } shadow-2xl overflow-hidden`}
      >
        {/* ================================================================= */}
        {/* 1. TOP HEADER & READING TOOLBAR                                  */}
        {/* ================================================================= */}
        <div className={`shrink-0 px-4 sm:px-6 py-3.5 border-b ${themeStyles.border} ${themeStyles.headerBg} flex flex-wrap items-center justify-between gap-3 font-mono`}>
          {/* Document Title & Badge */}
          <div className="flex items-center space-x-2.5 truncate max-w-xl">
            <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide shrink-0 ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
            <div className="truncate">
              <h2 className={`text-sm sm:text-base font-bold font-sans truncate ${themeStyles.text}`} title={doc.name}>
                {doc.name}
              </h2>
            </div>
          </div>

          {/* Reading Controls Toolbar */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 text-xs">
            {/* Reading Stats */}
            <div className={`hidden md:flex items-center space-x-2 text-[11px] ${themeStyles.secondaryText} px-2 py-1 bg-black/5 rounded-xs font-sans`}>
              <span>{stats.words.toLocaleString()} {language === "zh" ? "字" : "chars"}</span>
              <span>•</span>
              <span>{language === "zh" ? `约 ${stats.readMinutes} 分钟` : `~${stats.readMinutes} min`}</span>
              <span>•</span>
              <span className="font-bold text-[#111111]">{readingProgress}%</span>
            </div>

            {/* In-Doc Search Button */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 border ${themeStyles.border} hover:bg-black/10 transition-colors cursor-pointer ${
                showSearch ? "bg-black/15 font-bold" : ""
              }`}
              title={language === "zh" ? "文内搜索" : "Search in Document"}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Outline / TOC Toggle */}
            {tocItems.length > 0 && (
              <button
                onClick={() => setShowToc(!showToc)}
                className={`flex items-center space-x-1 px-2 py-1 border ${themeStyles.border} hover:bg-black/10 transition-colors cursor-pointer text-xs ${
                  showToc ? "bg-black/15 font-bold" : ""
                }`}
                title={language === "zh" ? "章节大纲目录" : "Table of Contents"}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === "zh" ? "目录" : "TOC"}</span>
              </button>
            )}

            {/* Font Size Adjusters */}
            <div className={`flex items-center border ${themeStyles.border} overflow-hidden`}>
              <button
                onClick={() => {
                  if (fontSize === "xl") setFontSize("lg");
                  else if (fontSize === "lg") setFontSize("base");
                  else if (fontSize === "base") setFontSize("sm");
                }}
                disabled={fontSize === "sm"}
                className="px-1.5 py-1 hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                title="缩小字号 (A-)"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="px-1.5 py-0.5 text-[10px] font-bold select-none uppercase">
                {fontSize}
              </span>
              <button
                onClick={() => {
                  if (fontSize === "sm") setFontSize("base");
                  else if (fontSize === "base") setFontSize("lg");
                  else if (fontSize === "lg") setFontSize("xl");
                }}
                disabled={fontSize === "xl"}
                className="px-1.5 py-1 hover:bg-black/10 disabled:opacity-30 cursor-pointer"
                title="放大字号 (A+)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            {/* Reading Theme Palette Toggle */}
            <div className={`flex items-center border ${themeStyles.border} overflow-hidden`}>
              <button
                onClick={() => setTheme("paper")}
                className={`px-2 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  theme === "paper" ? "bg-[#111111] text-white" : "bg-[#FCFBF9] text-[#111111] hover:bg-[#EFECE4]"
                }`}
                title={language === "zh" ? "纸质白模式" : "Paper Theme"}
              >
                纸
              </button>
              <button
                onClick={() => setTheme("sepia")}
                className={`px-2 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  theme === "sepia" ? "bg-[#4A3B2C] text-white" : "bg-[#F5EFEB] text-[#4A3B2C] hover:bg-[#E4D7C9]"
                }`}
                title={language === "zh" ? "羊皮纸护眼模式" : "Sepia Theme"}
              >
                柔
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`px-2 py-1 text-[11px] font-bold cursor-pointer transition-colors ${
                  theme === "dark" ? "bg-white text-black" : "bg-[#18181A] text-white hover:bg-[#27272D]"
                }`}
                title={language === "zh" ? "暗夜专注模式" : "Dark Theme"}
              >
                夜
              </button>
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 border ${themeStyles.border} hover:bg-black/10 transition-colors cursor-pointer hidden sm:block`}
              title={isFullscreen ? "退出全屏" : "全屏沉浸阅读"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 border ${themeStyles.border} hover:bg-[#111111] hover:text-white transition-colors cursor-pointer ml-1`}
              title="关闭 (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reading Progress Line */}
        <div className="w-full h-0.5 bg-black/10 relative">
          <div
            className="h-full bg-[#111111] transition-all duration-150"
            style={{ width: `${readingProgress}%` }}
          />
        </div>

        {/* Optional Search Bar Row */}
        {showSearch && (
          <div className={`px-6 py-2 border-b ${themeStyles.subtleBorder} ${themeStyles.headerBg} flex items-center space-x-2 font-mono text-xs animate-fadeIn`}>
            <Search className="w-3.5 h-3.5 opacity-60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "zh" ? "在本文档内搜索关键词..." : "Search in this document..."}
              className={`w-full max-w-md px-2.5 py-1 bg-white/80 border ${themeStyles.border} outline-none text-xs text-[#111111]`}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
              >
                [清除]
              </button>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* 2. BODY CONTENT: SIDEBAR TOC + MAIN MARKDOWN DOCUMENT             */}
        {/* ================================================================= */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Table of Contents Outline Sidebar */}
          {showToc && tocItems.length > 0 && (
            <aside className={`w-56 sm:w-64 shrink-0 border-r ${themeStyles.border} ${themeStyles.tocBg} p-3.5 overflow-y-auto flex flex-col font-sans text-xs select-none transition-all`}>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/10 font-mono">
                <span className="font-bold text-[11px] uppercase tracking-wider flex items-center space-x-1.5 opacity-80">
                  <ListTree className="w-3.5 h-3.5" />
                  <span>{language === "zh" ? "章节提纲目录" : "CONTENTS"}</span>
                </span>
                <span className="text-[10px] opacity-60">{tocItems.length} 节</span>
              </div>

              <div className="space-y-1">
                {tocItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToHeading(item.text)}
                    className={`w-full text-left py-1.5 px-2 rounded-xs transition-colors cursor-pointer truncate ${themeStyles.tocHover} ${
                      item.level === 1
                        ? "font-bold text-xs"
                        : item.level === 2
                        ? "pl-4 text-[12px] opacity-90"
                        : "pl-6 text-[11px] opacity-75"
                    }`}
                    title={item.text}
                  >
                    <span className="font-mono text-[10px] opacity-50 mr-1.5">
                      {item.level === 1 ? "§" : "•"}
                    </span>
                    {item.text}
                  </button>
                ))}
              </div>
            </aside>
          )}

          {/* Main Document Reading Canvas */}
          <main
            ref={contentRef}
            onScroll={handleScroll}
            className={`flex-1 overflow-y-auto p-5 sm:p-8 md:p-12 ${themeStyles.contentBg} ${themeStyles.text}`}
          >
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Document Header Info Card */}
              <div className={`p-4 sm:p-5 border ${themeStyles.subtleBorder} bg-black/3 space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold font-sans tracking-tight">
                    {doc.name}
                  </h1>
                  {doc.difficulty && (
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 border uppercase ${
                        doc.difficulty === "hard"
                          ? "border-red-700 bg-red-50 text-red-700"
                          : doc.difficulty === "medium"
                          ? "border-amber-700 bg-amber-50 text-amber-700"
                          : "border-green-700 bg-green-50 text-green-700"
                      }`}
                    >
                      {doc.difficulty}
                    </span>
                  )}
                </div>

                {/* Sub-meta tags */}
                <div className={`flex flex-wrap items-center gap-3 text-xs font-mono ${themeStyles.secondaryText}`}>
                  {doc.topicTag && (
                    <span className="flex items-center space-x-1 font-bold">
                      <Layers className="w-3 h-3" />
                      <span>#{doc.topicTag}</span>
                    </span>
                  )}
                  {doc.uploadedAt && (
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </span>
                  )}
                  <span>{stats.words.toLocaleString()} 字符</span>
                </div>
              </div>

              {/* AI Key Insights & Traps Callout Banner */}
              {(doc.summaryNotes || (doc.keyTraps && doc.keyTraps.length > 0)) && (
                <div className={`border ${themeStyles.border} overflow-hidden shadow-xs`}>
                  <div
                    onClick={() => setShowInsights(!showInsights)}
                    className="flex items-center justify-between px-4 py-2.5 bg-[#FCD33B] text-[#111111] font-mono text-xs font-bold cursor-pointer select-none"
                  >
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{language === "zh" ? "[AI 考点速递 & 备考陷阱]" : "[AI KEY INSIGHTS & EXAM TRAPS]"}</span>
                    </div>
                    {showInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  {showInsights && (
                    <div className={`p-4 space-y-3 ${themeStyles.blockquoteBg} border-t ${themeStyles.subtleBorder} font-sans text-xs`}>
                      {doc.summaryNotes && (
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-[11px] opacity-80 uppercase block">
                            💡 {language === "zh" ? "核心考查重点提炼" : "Core Takeaways"}:
                          </span>
                          <p className="leading-relaxed opacity-95">
                            {doc.summaryNotes}
                          </p>
                        </div>
                      )}

                      {doc.keyTraps && doc.keyTraps.length > 0 && (
                        <div className="pt-2 border-t border-black/10 space-y-1">
                          <span className="font-mono font-bold text-[11px] text-amber-900 uppercase flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>{language === "zh" ? "高频易错与丢分陷阱" : "Exam Pitfalls & Traps"}:</span>
                          </span>
                          <ul className="list-disc list-inside space-y-0.5 text-amber-950 pl-1">
                            {doc.keyTraps.map((trap, tIdx) => (
                              <li key={tIdx}>{trap}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Formatted Markdown Content Reader */}
              <div className={`markdown-reading-body ${fontClasses} font-sans space-y-4 leading-relaxed`}>
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1
                        className={`text-xl sm:text-2xl font-bold font-sans pt-6 pb-2 border-b-2 ${themeStyles.border} mt-8 mb-4 tracking-tight`}
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2
                        className={`text-lg sm:text-xl font-bold font-sans pt-4 pb-1.5 border-b ${themeStyles.subtleBorder} mt-6 mb-3 tracking-tight flex items-center space-x-2`}
                        {...props}
                      />
                    ),
                    h3: ({ node, ...props }) => (
                      <h3
                        className="text-base sm:text-lg font-bold font-sans pt-3 mt-4 mb-2"
                        {...props}
                      />
                    ),
                    h4: ({ node, ...props }) => (
                      <h4
                        className="text-sm sm:text-base font-bold font-sans mt-3 mb-1"
                        {...props}
                      />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="my-3 leading-relaxed text-justify" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul className="my-3 list-disc pl-6 space-y-1.5" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol className="my-3 list-decimal pl-6 space-y-1.5 font-medium" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                      <li className="leading-relaxed" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className={`my-4 pl-4 py-2 border-l-4 ${themeStyles.border} ${themeStyles.blockquoteBg} italic text-sm`}
                        {...props}
                      />
                    ),
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4 border border-black/30">
                        <table className="w-full text-left text-xs border-collapse font-mono" {...props} />
                      </div>
                    ),
                    thead: ({ node, ...props }) => (
                      <thead className="bg-black/10 font-bold border-b border-black/30" {...props} />
                    ),
                    th: ({ node, ...props }) => (
                      <th className="p-2.5 border border-black/20 font-bold" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="p-2.5 border border-black/15" {...props} />
                    ),
                    code: ({ node, className, children, ...props }) => {
                      const isInline = !className && typeof children === "string" && !children.includes("\n");
                      if (isInline) {
                        return (
                          <code
                            className={`px-1.5 py-0.5 rounded-xs font-mono text-[12px] font-bold ${themeStyles.codeBg} border ${themeStyles.subtleBorder}`}
                            {...props}
                          >
                            {children}
                          </code>
                        );
                      }
                      return (
                        <div className="relative my-4 group">
                          <pre
                            className={`p-4 rounded-xs overflow-x-auto font-mono text-xs ${themeStyles.codeBg} border ${themeStyles.border} leading-relaxed`}
                          >
                            <code {...props}>{children}</code>
                          </pre>
                        </div>
                      );
                    },
                    hr: () => <hr className={`my-8 border-t ${themeStyles.subtleBorder}`} />,
                    a: ({ node, ...props }) => (
                      <a
                        className="font-bold underline text-blue-600 hover:text-blue-800"
                        target="_blank"
                        rel="noreferrer"
                        {...props}
                      />
                    ),
                  }}
                >
                  {doc.content || (language === "zh" ? "*（本文档暂无文本内容）*" : "*(No content available)*")}
                </Markdown>
              </div>

              {/* End of Document Mark */}
              <div className="pt-12 pb-6 text-center font-mono text-xs opacity-40 select-none">
                — {language === "zh" ? "本文档已阅读完毕" : "End of Document"} —
              </div>
            </div>
          </main>
        </div>

        {/* ================================================================= */}
        {/* 3. BOTTOM ACTIONS FOOTER                                          */}
        {/* ================================================================= */}
        <div className={`shrink-0 px-4 sm:px-6 py-3 border-t ${themeStyles.border} ${themeStyles.headerBg} flex flex-wrap items-center justify-between gap-3 font-mono text-xs`}>
          {/* Left quick file size & print */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1 px-3 py-1.5 border ${themeStyles.border} hover:bg-black/10 transition-colors cursor-pointer font-bold`}
              title="复制全部纯文本"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? (language === "zh" ? "已复制!" : "COPIED!") : (language === "zh" ? "复制全文" : "COPY")}</span>
            </button>

            <button
              onClick={handlePrint}
              className={`hidden sm:flex items-center space-x-1 px-3 py-1.5 border ${themeStyles.border} hover:bg-black/10 transition-colors cursor-pointer`}
              title="打印或导出 PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{language === "zh" ? "打印 / 导出" : "PRINT"}</span>
            </button>
          </div>

          {/* Right Main Functional CTAs */}
          <div className="flex items-center space-x-2">
            {/* Launch AI Quiz */}
            {onLaunchQuiz && (
              <button
                onClick={() => {
                  onClose();
                  onLaunchQuiz(doc);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#FCD33B] hover:bg-[#EBC229] text-[#111111] font-bold border border-[#111111] transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === "zh" ? "根据此文档出题自测" : "LAUNCH AI QUIZ"}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#111111] hover:bg-[#333333] text-white font-bold border border-[#111111] transition-colors cursor-pointer"
            >
              [{language === "zh" ? "完成阅读" : "CLOSE"}]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
