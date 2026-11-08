import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { LoadingPane } from "./LoadingPane";
import {
  X,
  Sparkles,
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
import { visibleChars } from "../lib/text";

interface DocumentReaderModalProps {
  doc: StudyMaterial | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduleDoc?: (doc: StudyMaterial) => void;
}

type ReaderTheme = "paper" | "dark" | "sepia";

/* 阅读字号的四个档位，全部取自主标尺（清单 UI-04）。
   写成字面量而不是拼字符串：Tailwind 扫的是源码里的类名，拼出来的 text-[Npx] 不会被编译进样式表。 */
const FONT_STEPS = [
  { px: 13, cls: "text-[13px]" },
  { px: 15, cls: "text-[15px]" },
  { px: 20, cls: "text-[20px]" },
  { px: 24, cls: "text-[24px]" },
] as const;

/* 正文渲染器按需取：整套 markdown 依赖只有打开资料时才用得上（清单 PERF-01）。 */
const MarkdownBody = lazy(() => import("./MarkdownBody").then((m) => ({ default: m.MarkdownBody })));

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({
  doc,
  isOpen,
  onClose,
  onScheduleDoc,
}) => {
  const { language } = useI18n();
  const isZh = language === "zh";

  const [theme, setTheme] = useState<ReaderTheme>("paper");
  const [fontSize, setFontSize] = useState<(typeof FONT_STEPS)[number]["px"]>(15);
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
    const charCount = visibleChars(doc.content);
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

  // Category badge helper (soft semantic tints)
  const getCategoryBadge = (type: StudyMaterial["type"]) => {
    switch (type) {
      case "syllabus":
        return { label: isZh ? "考纲" : "Syllabus", cls: "bg-[#f1efe9] text-[#6b6660]" };
      case "past_exam":
        return { label: isZh ? "真题" : "Past exam", cls: "bg-[#FDF0EE] text-[#B42318]" };
      case "lecture_slides":
        return { label: isZh ? "讲义" : "Lecture", cls: "bg-[#EEF3FE] text-[#1D4ED8]" };
      case "textbook_outline":
        return { label: isZh ? "教材" : "Textbook", cls: "bg-[#FFF6DD] text-[#8A5A00]" };
      case "notes":
      default:
        return { label: isZh ? "笔记" : "Notes", cls: "bg-[#EEF4EF] text-[#3F6B4F]" };
    }
  };

  const badge = getCategoryBadge(doc.type);

  const difficultyBadge =
    doc.difficulty === "hard"
      ? { label: isZh ? "困难" : "Hard", cls: "bg-[#FDF0EE] text-[#B42318]" }
      : doc.difficulty === "medium"
      ? { label: isZh ? "中等" : "Medium", cls: "bg-[#FFF6DD] text-[#8A5A00]" }
      : { label: isZh ? "基础" : "Easy", cls: "bg-[#EEF4EF] text-[#3F6B4F]" };

  // Theme styling definitions (softened hairline borders)
  const themeStyles = {
    paper: {
      modalBg: "bg-[#FCFBF9]",
      headerBg: "bg-[#FAF8F5]",
      contentBg: "bg-[#FCFBF9]",
      text: "text-[#1c1b1a]",
      secondaryText: "text-[#6b6660]",
      border: "border-[#e5e2dc]",
      subtleBorder: "border-[#f0ede8]",
      codeBg: "bg-[#F2EFE9]",
      blockquoteBg: "bg-[#F5F2EB]",
      tocBg: "bg-[#F7F5F0]",
      tocHover: "hover:bg-[#EFECE4]",
      accent: "#1c1b1a",
    },
    sepia: {
      modalBg: "bg-[#F5EFEB]",
      headerBg: "bg-[#ECE4DC]",
      contentBg: "bg-[#F5EFEB]",
      text: "text-[#2B2319]",
      secondaryText: "text-[#6b5842]",
      border: "border-[#DECFC0]",
      subtleBorder: "border-[#E7DCD0]",
      codeBg: "bg-[#EAE0D3]",
      blockquoteBg: "bg-[#EAE0D3]",
      tocBg: "bg-[#ECE4DC]",
      tocHover: "hover:bg-[#E4D7C9]",
      accent: "#6b5842",
    },
    dark: {
      modalBg: "bg-[#18181A]",
      headerBg: "bg-[#222225]",
      contentBg: "bg-[#18181A]",
      text: "text-[#E4E4E7]",
      secondaryText: "text-[#A1A1AA]",
      border: "border-[#33333A]",
      subtleBorder: "border-[#27272A]",
      codeBg: "bg-[#27272A]",
      blockquoteBg: "bg-[#222226]",
      tocBg: "bg-[#202024]",
      tocHover: "hover:bg-[#27272D]",
      accent: "#E4E4E7",
    },
  }[theme];

  const isDark = theme === "dark";
  const toolHover = isDark ? "hover:bg-white/10" : "hover:bg-black/[0.06]";
  const toolActive = isDark ? "bg-white/15" : "bg-black/[0.08]";
  const toolBtn = `p-1.5 rounded-lg border ${themeStyles.border} ${toolHover} transition-colors cursor-pointer`;
  const subtleFill = isDark ? "bg-white/[0.04]" : "bg-black/[0.03]";

  const fontIndex = Math.max(
    0,
    FONT_STEPS.findIndex((s) => s.px === fontSize),
  );
  const fontClasses = `${FONT_STEPS[fontIndex].cls} leading-relaxed`;
  const stepFont = (delta: number) => {
    const next = Math.min(FONT_STEPS.length - 1, Math.max(0, fontIndex + delta));
    setFontSize(FONT_STEPS[next].px);
  };

  const themeBtn = (key: ReaderTheme, label: string, activeCls: string, idleCls: string, title: string) => (
    <button
      onClick={() => setTheme(key)}
      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg cursor-pointer transition-colors ${
        theme === key ? activeCls : idleCls
      }`}
      title={title}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1c1b1a]/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex w-full flex-col overflow-hidden rounded-2xl border shadow-[0_24px_70px_rgba(0,0,0,0.35)] transition-all duration-200 ${themeStyles.border} ${themeStyles.modalBg} ${
          isFullscreen ? "h-[98vh] max-w-[98vw]" : "h-[90vh] max-w-5xl"
        }`}
      >
        {/* 1. TOP HEADER & READING TOOLBAR */}
        <div className={`shrink-0 px-4 sm:px-6 py-3 border-b ${themeStyles.border} ${themeStyles.headerBg} flex flex-wrap items-center justify-between gap-3`}>
          {/* Document Title & Badge */}
          <div className="flex items-center gap-2.5 truncate max-w-xl">
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${badge.cls}`}>
              {badge.label}
            </span>
            <h2 className={`text-[13px] sm:text-[15px] font-semibold truncate ${themeStyles.text}`} title={doc.name}>
              {doc.name}
            </h2>
          </div>

          {/* Reading Controls Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 text-[12px]">
            {/* Reading Stats */}
            {/* 三段读数靠 gap 分开即可，不需要 · 当分隔符（清单 UI-04）。 */}
            <div className={`hidden md:flex items-center gap-2.5 text-[11px] ${themeStyles.secondaryText} px-2.5 py-1 rounded-lg ${subtleFill} tabular-nums`}>
              <span>{stats.words.toLocaleString()} {isZh ? "字" : "chars"}</span>
              <span>{isZh ? `约 ${stats.readMinutes} 分钟` : `~${stats.readMinutes} min`}</span>
              <span className={`font-medium ${themeStyles.text}`}>{readingProgress}%</span>
            </div>

            {/* In-Doc Search */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`${toolBtn} ${showSearch ? toolActive : ""}`}
              title={isZh ? "文内搜索" : "Search in document"}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Outline / TOC Toggle */}
            {tocItems.length > 0 && (
              <button
                onClick={() => setShowToc(!showToc)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border ${themeStyles.border} ${toolHover} transition-colors cursor-pointer text-[12px] ${showToc ? toolActive : ""}`}
                title={isZh ? "章节大纲目录" : "Table of contents"}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isZh ? "目录" : "TOC"}</span>
              </button>
            )}

            {/* Font Size Adjusters */}
            <div className={`flex items-center rounded-lg border ${themeStyles.border} overflow-hidden`}>
              <button
                onClick={() => stepFont(-1)}
                disabled={fontIndex === 0}
                className={`px-1.5 py-1.5 ${toolHover} disabled:opacity-30 cursor-pointer`}
                title={isZh ? "缩小字号" : "Decrease font size"}
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className={`px-1.5 text-[11px] font-medium select-none tabular-nums ${themeStyles.secondaryText}`}>
                {FONT_STEPS[fontIndex].px}
              </span>
              <button
                onClick={() => stepFont(1)}
                disabled={fontIndex === FONT_STEPS.length - 1}
                className={`px-1.5 py-1.5 ${toolHover} disabled:opacity-30 cursor-pointer`}
                title={isZh ? "放大字号" : "Increase font size"}
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>

            {/* Reading Theme Toggle */}
            <div className={`flex items-center gap-0.5 rounded-lg border ${themeStyles.border} p-0.5`}>
              {themeBtn("paper", "纸", "bg-[#1c1b1a] text-white", `${themeStyles.text} ${toolHover}`, isZh ? "纸质白模式" : "Paper theme")}
              {themeBtn("sepia", "柔", "bg-[#4A3B2C] text-white", `${themeStyles.text} ${toolHover}`, isZh ? "羊皮纸护眼模式" : "Sepia theme")}
              {themeBtn("dark", "夜", "bg-white text-[#18181A]", `${themeStyles.text} ${toolHover}`, isZh ? "暗夜专注模式" : "Dark theme")}
            </div>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`${toolBtn} hidden sm:block`}
              title={isFullscreen ? (isZh ? "退出全屏" : "Exit fullscreen") : (isZh ? "全屏沉浸阅读" : "Fullscreen")}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className={`${toolBtn} ml-0.5`}
              title={isZh ? "关闭 (Esc)" : "Close (Esc)"}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reading Progress Line */}
        <div className={`w-full h-0.5 relative ${isDark ? "bg-white/10" : "bg-black/[0.06]"}`}>
          <div
            className="h-full transition-all duration-150"
            style={{ width: `${readingProgress}%`, backgroundColor: themeStyles.accent }}
          />
        </div>

        {/* Optional Search Bar Row */}
        {showSearch && (
          <div className={`px-4 sm:px-6 py-2 border-b ${themeStyles.subtleBorder} ${themeStyles.headerBg} flex items-center gap-2 text-[12px] animate-fadeIn`}>
            <Search className={`w-3.5 h-3.5 ${themeStyles.secondaryText}`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? "在本文档内搜索关键词..." : "Search in this document..."}
              className={`w-full max-w-md px-2.5 py-1 rounded-lg border ${themeStyles.border} text-[12px] ${
                isDark ? "bg-[#18181A] text-[#E4E4E7] placeholder-[#A1A1AA]" : "bg-white text-[#1c1b1a] placeholder-[#716c65]"
              }`}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className={`text-[11px] font-medium hover:underline cursor-pointer shrink-0 ${isDark ? "text-[#f0a9a0]" : "text-[#B42318]"}`}
              >
                {isZh ? "清除" : "Clear"}
              </button>
            )}
          </div>
        )}

        {/* 2. BODY: SIDEBAR TOC + MAIN MARKDOWN DOCUMENT */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Table of Contents */}
          {showToc && tocItems.length > 0 && (
            <aside className={`w-56 sm:w-64 shrink-0 border-r ${themeStyles.border} ${themeStyles.tocBg} p-3.5 overflow-y-auto flex flex-col text-[12px] select-none transition-all`}>
              <div className={`flex items-center justify-between pb-2 mb-2 border-b ${themeStyles.subtleBorder}`}>
                <span className={`font-medium text-[11px] flex items-center gap-1.5 ${themeStyles.secondaryText}`}>
                  <ListTree className="w-3.5 h-3.5" />
                  <span>{isZh ? "章节提纲" : "Contents"}</span>
                </span>
                <span className={`text-[11px] tabular-nums ${themeStyles.secondaryText}`}>{tocItems.length} {isZh ? "节" : ""}</span>
              </div>

              <div className="space-y-0.5">
                {tocItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToHeading(item.text)}
                    /* 层级靠缩进 + 字重 + 颜色分，不用 opacity：
                       二级标题原来写 opacity-90、三级 opacity-70，压在主文字色上三级只剩 2.92:1，读不出。
                       现在三级走现成的次级色档，纸白 / 羊皮纸 / 暗夜三套主题都过 4.5:1。 */
                    className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors cursor-pointer truncate ${themeStyles.tocHover} ${
                      item.level === 1
                        ? `${themeStyles.text} font-medium text-[12px]`
                        : item.level === 2
                        ? `${themeStyles.secondaryText} pl-5 text-[12px]`
                        : `${themeStyles.secondaryText} pl-8 text-[11px]`
                    }`}
                    title={item.text}
                  >
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
              <div className={`p-4 sm:p-5 rounded-xl border ${themeStyles.subtleBorder} ${subtleFill} space-y-3`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h1 className="text-[20px] sm:text-[24px] font-semibold tracking-tight">
                    {doc.name}
                  </h1>
                  {doc.difficulty && (
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${difficultyBadge.cls}`}>
                      {difficultyBadge.label}
                    </span>
                  )}
                </div>

                <div className={`flex flex-wrap items-center gap-2 text-[12px] ${themeStyles.secondaryText}`}>
                  {doc.topicTag && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${isDark ? "bg-white/10" : "bg-black/[0.05]"}`}>
                      <Layers className="w-3 h-3" />
                      <span>{doc.topicTag}</span>
                    </span>
                  )}
                  {doc.uploadedAt && (
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    </span>
                  )}
                  <span className="tabular-nums">{stats.words.toLocaleString()} {isZh ? "字" : "chars"}</span>
                </div>
              </div>

              {/* AI Key Insights & Traps Callout */}
              {(doc.summaryNotes || (doc.keyTraps && doc.keyTraps.length > 0)) && (
                <div className={`rounded-xl border overflow-hidden ${isDark ? "border-[#3a3524]" : "border-[#f0e2c0]"}`}>
                  <div
                    onClick={() => setShowInsights(!showInsights)}
                    className={`flex items-center justify-between px-4 py-2.5 text-[12px] font-medium cursor-pointer select-none ${
                      isDark ? "bg-[#2a2618] text-[#d8b878]" : "bg-[#FFF6DD] text-[#8A5A00]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{isZh ? "AI 考点速递 & 备考陷阱" : "AI key insights & exam traps"}</span>
                    </div>
                    {showInsights ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  {showInsights && (
                    <div className={`p-4 space-y-3 ${themeStyles.blockquoteBg} border-t ${themeStyles.subtleBorder} text-[12px]`}>
                      {doc.summaryNotes && (
                        <div className="space-y-1">
                          <span className={`font-medium text-[11px] block ${themeStyles.secondaryText}`}>
                            {isZh ? "核心考查重点提炼" : "Core takeaways"}
                          </span>
                          <p className="leading-relaxed">
                            {doc.summaryNotes}
                          </p>
                        </div>
                      )}

                      {doc.keyTraps && doc.keyTraps.length > 0 && (
                        <div className={`pt-2 border-t ${themeStyles.subtleBorder} space-y-1`}>
                          <span className={`font-medium text-[11px] flex items-center gap-1 ${isDark ? "text-[#d8b878]" : "text-[#8A5A00]"}`}>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{isZh ? "高频易错与丢分陷阱" : "Exam pitfalls & traps"}</span>
                          </span>
                          <ul className={`list-disc list-inside space-y-0.5 pl-1 ${isDark ? "text-[#cbb98a]" : "text-[#6b5320]"}`}>
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
              <div className={`markdown-reading-body ${fontClasses} space-y-4 leading-relaxed`}>
                <Suspense fallback={<LoadingPane />}>
                  <MarkdownBody
                    theme={themeStyles}
                    isDark={isDark}
                    content={doc.content || (isZh ? "*（本文档暂无文本内容）*" : "*(No content available)*")}
                  />
                </Suspense>
              </div>
            </div>
          </main>
        </div>

        {/* 3. BOTTOM ACTIONS FOOTER */}
        <div className={`shrink-0 px-4 sm:px-6 py-3 border-t ${themeStyles.border} ${themeStyles.headerBg} flex flex-wrap items-center justify-between gap-3 text-[12px]`}>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${themeStyles.border} ${toolHover} transition-colors cursor-pointer font-medium ${themeStyles.text}`}
              title={isZh ? "复制全部纯文本" : "Copy all text"}
            >
              {isCopied ? <Check className={`w-3.5 h-3.5 ${isDark ? "text-[#7fbf95]" : "text-[#3F6B4F]"}`} /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? (isZh ? "已复制" : "Copied") : (isZh ? "复制全文" : "Copy")}</span>
            </button>

            <button
              onClick={handlePrint}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${themeStyles.border} ${toolHover} transition-colors cursor-pointer ${themeStyles.text}`}
              title={isZh ? "打印或导出 PDF" : "Print or export PDF"}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isZh ? "打印 / 导出" : "Print"}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-4 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                isDark
                  ? "bg-white text-[#18181A] hover:bg-[#E4E4E7]"
                  : theme === "sepia"
                  ? "bg-[#4A3B2C] text-white hover:bg-[#5c4a37]"
                  : "bg-[#1c1b1a] text-white hover:opacity-85"
              }`}
            >
              {isZh ? "完成阅读" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};