import React, { useState, useMemo } from "react";
import {
  Eye,
  FileQuestion,
  Trash2,
  Check,
  Search,
  Sparkles,
  Layers,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Plus,
} from "lucide-react";
import { StudyMaterial } from "../types";
import { useI18n } from "../lib/i18n";

interface TabbedFolderArchiveProps {
  materials: StudyMaterial[];
  onPreviewDoc: (doc: StudyMaterial) => void;
  onQuizDoc: (doc: StudyMaterial) => void;
  onDeleteDoc: (docId: string) => void;
  onOpenUpload?: () => void;
  onOpenPaste?: () => void;
  onLoadSamples?: () => void;
  onDeleteCourse?: () => void;
}

// Compact Color Palettes aligned with physical folder cards
export const FOLDER_PALETTES = [
  {
    name: "canary-yellow",
    bg: "bg-[#FCD33B]",
    tabBg: "bg-[#FCD33B]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#333333]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white/80 text-[#111111] hover:bg-white border border-[#111111]",
    accentColor: "#FCD33B",
  },
  {
    name: "concrete-gray",
    bg: "bg-[#D8D8D8]",
    tabBg: "bg-[#D8D8D8]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#444444]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    accentColor: "#D8D8D8",
  },
  {
    name: "stone-gray",
    bg: "bg-[#B5B5B5]",
    tabBg: "bg-[#B5B5B5]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#222222]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white/90 text-[#111111] hover:bg-white border border-[#111111]",
    accentColor: "#B5B5B5",
  },
  {
    name: "dark-slate",
    bg: "bg-[#282828]",
    tabBg: "bg-[#282828]",
    border: "border-[#111111]",
    textPrimary: "text-[#F5F5F5]",
    textSecondary: "text-[#BDBDBD]",
    badgeBg: "bg-white text-[#111111]",
    btnBg: "bg-white text-[#111111] hover:bg-[#E5E5E5]",
    btnSecondary: "bg-[#1A1A1A] text-white hover:bg-[#333333] border border-white/30",
    accentColor: "#282828",
  },
  {
    name: "sun-gold",
    bg: "bg-[#F3CB32]",
    tabBg: "bg-[#F3CB32]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#2A2A2A]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white/80 text-[#111111] hover:bg-white border border-[#111111]",
    accentColor: "#F3CB32",
  },
  {
    name: "chalk-white",
    bg: "bg-[#EAEAEA]",
    tabBg: "bg-[#EAEAEA]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#444444]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    accentColor: "#EAEAEA",
  },
];

// Helper to determine display subtitle styling
function getEditorialSlug(doc: StudyMaterial): { slug: string; sub: string } {
  const name = doc.name.toLowerCase();
  if (doc.type === "syllabus" || name.includes("syllabus") || name.includes("考纲") || name.includes("大纲")) {
    return { slug: "syllabus", sub: "EXAM BLUEPRINT" };
  }
  if (doc.type === "past_exam" || name.includes("exam") || name.includes("真题") || name.includes("期末") || name.includes("试卷")) {
    return { slug: "past exam", sub: "EXAM QUESTION BANK" };
  }
  if (doc.type === "lecture_slides" || name.includes("slides") || name.includes("讲义") || name.includes("课件") || name.includes("ppt")) {
    return { slug: "lecture slides", sub: "COURSE LECTURE" };
  }
  if (name.includes("algorithm") || name.includes("算法")) {
    return { slug: "algorithms", sub: "CORE TOPIC" };
  }
  if (name.includes("formula") || name.includes("公式") || name.includes("cheat")) {
    return { slug: "cheatsheet", sub: "HIGH-YIELD FORMULAS" };
  }
  if (name.includes("data") || name.includes("数据")) {
    return { slug: "data structures", sub: "FOUNDATION" };
  }
  return { slug: "editorial notes", sub: "STUDY MATERIAL" };
}

export const TabbedFolderArchive: React.FC<TabbedFolderArchiveProps> = ({
  materials,
  onPreviewDoc,
  onQuizDoc,
  onDeleteDoc,
  onOpenUpload,
  onOpenPaste,
  onLoadSamples,
  onDeleteCourse,
}) => {
  const { language } = useI18n();

  const [activeFolderId, setActiveFolderId] = useState<string | null>(
    materials[0]?.id || null
  );
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"stacked" | "grid">("stacked");

  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.summaryNotes && m.summaryNotes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        m.content.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || m.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [materials, searchQuery, filterType]);

  // Tab offset pattern for staggered folder tabs
  const getTabOffsetClass = (index: number) => {
    const mod = index % 3;
    if (mod === 0) return "left-0 w-36 sm:w-44";
    if (mod === 1) return "left-[22%] sm:left-[30%] w-36 sm:w-44";
    return "left-[44%] sm:left-[60%] w-36 sm:w-44";
  };

  return (
    <div className="w-full space-y-3 font-mono" id="knowledge-base-tabbed-archive">
      {/* 1. Header: Proportional & Compact Notion/Swiss Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#111111]">
        <div className="flex items-center space-x-3">
          <div className="flex items-baseline space-x-2">
            <h2
              className="text-xl sm:text-2xl font-serif text-[#111111] tracking-tight leading-none"
              style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
            >
              {language === "zh" ? "资料归档" : "Works"}
            </h2>
            <span
              className="text-lg sm:text-xl font-serif text-[#888888] tracking-tight leading-none"
              style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
            >
              {language === "zh" ? "知识库" : "Archive"}
            </span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 border border-[#111111] bg-white text-[#111111] font-bold">
            {materials.length} {language === "zh" ? "份文件" : "FILES"}
          </span>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex items-center space-x-1.5 text-xs">
          {/* View Mode Toggle */}
          <div className="flex items-center border border-[#111111] bg-white p-0.5 shadow-xs">
            <button
              onClick={() => setViewMode("stacked")}
              className={`flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                viewMode === "stacked"
                  ? "bg-[#111111] text-white"
                  : "text-[#111111] hover:bg-[#ededed]"
              }`}
              title={language === "zh" ? "层叠抽屉视图" : "Stacked View"}
            >
              <Layers className="w-3 h-3" />
              <span>{language === "zh" ? "层叠" : "STACK"}</span>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center space-x-1 px-2 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#111111] text-white"
                  : "text-[#111111] hover:bg-[#ededed]"
              }`}
              title={language === "zh" ? "平铺网格视图" : "Grid View"}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>{language === "zh" ? "平铺" : "GRID"}</span>
            </button>
          </div>

          {onLoadSamples && (
            <button
              onClick={onLoadSamples}
              className="flex items-center space-x-1 px-2 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
              title={language === "zh" ? "加载预设精选示例资料" : "Load sample documents"}
            >
              <span>[{language === "zh" ? "示例" : "SAMPLES"}]</span>
            </button>
          )}

          {onOpenPaste && (
            <button
              onClick={onOpenPaste}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>[{language === "zh" ? "笔记" : "PASTE"}]</span>
            </button>
          )}

          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="flex items-center space-x-1 px-2.5 py-1 bg-[#111111] hover:bg-[#2b2b2b] text-white border border-[#111111] text-[11px] font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3 h-3" />
              <span>[{language === "zh" ? "上传" : "UPLOAD"}]</span>
            </button>
          )}

          {onDeleteCourse && (
            <button
              onClick={onDeleteCourse}
              className="p-1 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer shadow-xs"
              title={language === "zh" ? "删除当前课程科目" : "Delete course"}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
        {/* Category Tabs */}
        <div className="flex items-center flex-wrap gap-1">
          <button
            onClick={() => setFilterType("all")}
            className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] transition-all cursor-pointer ${
              filterType === "all"
                ? "bg-[#111111] text-white shadow-xs"
                : "bg-white text-[#111111] hover:bg-[#f0f0f0]"
            }`}
          >
            {language === "zh" ? "全部" : "ALL"} ({materials.length})
          </button>
          <button
            onClick={() => setFilterType("syllabus")}
            className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] transition-all cursor-pointer ${
              filterType === "syllabus"
                ? "bg-[#111111] text-white shadow-xs"
                : "bg-white text-[#111111] hover:bg-[#f0f0f0]"
            }`}
          >
            {language === "zh" ? "考纲" : "SYLLABUS"}
          </button>
          <button
            onClick={() => setFilterType("lecture_slides")}
            className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] transition-all cursor-pointer ${
              filterType === "lecture_slides"
                ? "bg-[#111111] text-white shadow-xs"
                : "bg-white text-[#111111] hover:bg-[#f0f0f0]"
            }`}
          >
            {language === "zh" ? "讲义" : "SLIDES"}
          </button>
          <button
            onClick={() => setFilterType("past_exam")}
            className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] transition-all cursor-pointer ${
              filterType === "past_exam"
                ? "bg-[#111111] text-white shadow-xs"
                : "bg-white text-[#111111] hover:bg-[#f0f0f0]"
            }`}
          >
            {language === "zh" ? "真题" : "EXAMS"}
          </button>
          <button
            onClick={() => setFilterType("notes")}
            className={`px-2 py-0.5 text-[11px] font-bold border border-[#111111] transition-all cursor-pointer ${
              filterType === "notes"
                ? "bg-[#111111] text-white shadow-xs"
                : "bg-white text-[#111111] hover:bg-[#f0f0f0]"
            }`}
          >
            {language === "zh" ? "笔记" : "NOTES"}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-56">
          <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777777]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === "zh" ? "快速搜索..." : "Search..."}
            className="w-full pl-7 pr-2.5 py-0.5 bg-white border border-[#111111] text-xs text-[#111111] placeholder:text-[#888888] outline-none"
          />
        </div>
      </div>

      {/* 3. Empty State */}
      {filteredMaterials.length === 0 && (
        <div className="p-6 text-center border border-dashed border-[#111111] bg-white space-y-2">
          <BookOpen className="w-6 h-6 mx-auto text-[#888888]" />
          <p className="text-xs font-bold text-[#111111] uppercase">
            [{language === "zh" ? "暂无匹配的归档资料" : "NO ARCHIVED DOCUMENTS"}]
          </p>
        </div>
      )}

      {/* 4. Physical Tabbed Folders - COMPACT STACKED VIEW */}
      {viewMode === "stacked" && filteredMaterials.length > 0 && (
        <div className="relative w-full space-y-3 pt-3">
          {filteredMaterials.map((doc, index) => {
            const palette = FOLDER_PALETTES[index % FOLDER_PALETTES.length];
            const { sub } = getEditorialSlug(doc);
            const isOpen = activeFolderId === doc.id;
            const indexStr = String(index + 1).padStart(2, "0");
            const tabOffset = getTabOffsetClass(index);

            return (
              <div
                key={doc.id}
                id={`folder-item-${doc.id}`}
                className="relative w-full transition-all duration-200 group"
              >
                {/* Physical Folder Cutout Tab */}
                <div
                  onClick={() => setActiveFolderId(isOpen ? null : doc.id)}
                  className={`absolute -top-5 ${tabOffset} h-6 ${palette.tabBg} border-t border-x border-[#111111] rounded-t z-10 px-2.5 flex items-center justify-between cursor-pointer select-none transition-transform duration-150 group-hover:-translate-y-0.5 shadow-xs`}
                  style={{
                    clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0% 100%)",
                  }}
                >
                  <div className="flex items-center space-x-1.5 pr-2">
                    <span className="text-[10px] font-bold text-[#111111]/70">
                      {indexStr}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#111111] truncate max-w-[100px]">
                      {doc.type.replace("_", " ")}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold px-1 py-0.2 bg-[#111111]/10 text-[#111111] rounded-xs mr-3">
                    {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)}K` : "TXT"}
                  </span>
                </div>

                {/* Physical Folder Body */}
                <div
                  className={`relative w-full ${palette.bg} border border-[#111111] rounded-b ${
                    isOpen ? "rounded-tr shadow-[0_4px_16px_rgba(0,0,0,0.12)]" : "shadow-[0_2px_6px_rgba(0,0,0,0.06)]"
                  } p-3 sm:p-3.5 transition-all duration-200`}
                >
                  {/* Top bar inside folder with number and category */}
                  <div
                    className="cursor-pointer"
                    onClick={() => setActiveFolderId(isOpen ? null : doc.id)}
                  >
                    <div className="flex items-center space-x-2 mb-0.5">
                      <span className="text-[10px] font-bold text-[#111111]/60">
                        {indexStr}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#111111]/70 truncate">
                        {sub}
                      </span>
                    </div>

                    {/* Main Title */}
                    <h3
                      className={`text-base sm:text-lg font-serif ${palette.textPrimary} tracking-tight leading-snug truncate select-none`}
                      style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                    >
                      {doc.name}
                    </h3>
                  </div>

                  {/* Expanded Content Drawer inside folder */}
                  {isOpen && (
                    <div className="mt-3 pt-2.5 border-t border-[#111111]/20 space-y-2.5 animate-fadeIn">
                      {/* Summary Notes */}
                      {doc.summaryNotes ? (
                        <div className="bg-white/85 border border-[#111111]/20 p-2.5 rounded-xs space-y-1 backdrop-blur-xs">
                          <div className="flex items-center space-x-1 text-[10px] font-bold text-[#111111]">
                            <Sparkles className="w-3 h-3" />
                            <span>[{language === "zh" ? "AI 考点摘要" : "AI SUMMARY"}]</span>
                          </div>
                          <p className="text-xs text-[#222222] leading-relaxed font-sans font-medium line-clamp-3">
                            {doc.summaryNotes}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-white/70 border border-[#111111]/20 p-2 rounded-xs text-xs text-[#444444] font-sans line-clamp-2">
                          {doc.content.slice(0, 180)}...
                        </div>
                      )}

                      {/* Footer Info & Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-1.5 py-0.2 bg-[#111111] text-white font-bold">
                            {doc.type.toUpperCase()}
                          </span>
                          <span className="text-[#111111] font-bold flex items-center space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>{language === "zh" ? "已入库" : "READY"}</span>
                          </span>
                          <span className="text-[#444444] font-bold">
                            {doc.content.length} {language === "zh" ? "字" : "CHARS"}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => onPreviewDoc(doc)}
                            className="px-2 py-0.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            [{language === "zh" ? "全文" : "READ"}]
                          </button>
                          <button
                            onClick={() => onQuizDoc(doc)}
                            className="px-2 py-0.5 bg-[#111111] hover:bg-[#333333] text-white text-[11px] font-bold border border-[#111111] transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-[#FCD33B]" />
                            <span>[{language === "zh" ? "自测" : "QUIZ"}]</span>
                          </button>
                          <button
                            onClick={() => onDeleteDoc(doc.id)}
                            className="p-1 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] transition-colors cursor-pointer"
                            title={language === "zh" ? "删除" : "Delete"}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Physical Tabbed Folders - COMPACT GRID VIEW */}
      {viewMode === "grid" && filteredMaterials.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2.5">
          {filteredMaterials.map((doc, index) => {
            const palette = FOLDER_PALETTES[index % FOLDER_PALETTES.length];
            const { sub } = getEditorialSlug(doc);
            const indexStr = String(index + 1).padStart(2, "0");

            return (
              <div
                key={doc.id}
                id={`folder-grid-item-${doc.id}`}
                className="relative w-full group transition-transform duration-150"
              >
                {/* Tab */}
                <div
                  className={`absolute -top-5 left-0 w-28 h-6 ${palette.tabBg} border-t border-x border-[#111111] rounded-t z-10 px-2 flex items-center justify-between shadow-xs select-none`}
                  style={{
                    clipPath: "polygon(0 0, calc(100% - 12px) 0, 100% 100%, 0% 100%)",
                  }}
                >
                  <span className="text-[10px] font-bold text-[#111111]/70">
                    {indexStr}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#111111] mr-2 truncate">
                    {doc.type.replace("_", " ")}
                  </span>
                </div>

                {/* Folder Card */}
                <div
                  className={`relative w-full ${palette.bg} border border-[#111111] rounded-b shadow-xs p-3 flex flex-col justify-between h-full min-h-[140px]`}
                >
                  <div>
                    <div className="flex items-baseline space-x-1.5 mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-[#111111]/70 truncate">
                        {sub}
                      </span>
                    </div>

                    <h3
                      className={`text-base font-serif ${palette.textPrimary} tracking-tight leading-snug line-clamp-2`}
                      style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                    >
                      {doc.name}
                    </h3>

                    {doc.summaryNotes && (
                      <p className="mt-1 text-[11px] text-[#222222] font-sans line-clamp-2 leading-relaxed">
                        {doc.summaryNotes}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#111111]/20 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] font-bold text-[#111111]/70">
                      {doc.sizeBytes ? `${Math.round(doc.sizeBytes / 1024)}KB` : "TXT"}
                    </span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => onPreviewDoc(doc)}
                        className="px-1.5 py-0.5 bg-white border border-[#111111] hover:bg-[#ededed] text-[#111111] text-[10px] font-bold cursor-pointer"
                      >
                        [{language === "zh" ? "看" : "VIEW"}]
                      </button>
                      <button
                        onClick={() => onQuizDoc(doc)}
                        className="px-1.5 py-0.5 bg-[#111111] hover:bg-[#333333] text-white border border-[#111111] text-[10px] font-bold cursor-pointer"
                      >
                        [{language === "zh" ? "练" : "QUIZ"}]
                      </button>
                      <button
                        onClick={() => onDeleteDoc(doc.id)}
                        className="p-0.5 border border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] cursor-pointer"
                        title={language === "zh" ? "删除" : "Delete"}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
