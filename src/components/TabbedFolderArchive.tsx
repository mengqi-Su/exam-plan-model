import React, { useState, useMemo } from "react";
import {
  BookOpen,
  GraduationCap,
  FileQuestion,
  FileText,
  Trash2,
  Search,
  Plus,
  ArrowRight,
  ArrowLeft,
  FolderOpen,
  File,
} from "lucide-react";
import { StudyMaterial } from "../types";
import { useI18n } from "../lib/i18n";

export type FolderCategoryKey = "syllabus" | "lecture" | "exam" | "notes";

interface FolderCategoryConfig {
  key: FolderCategoryKey;
  code: string;
  nameZh: string;
  nameEn: string;
  subtitleZh: string;
  subtitleEn: string;
  descZh: string;
  descEn: string;
  icon: React.ElementType;
  tabBg: string;
  tabHoverBg: string;
  bodyBg: string;
  textColor: string;
  subtextColor: string;
  badgeBg: string;
  badgeText: string;
  defaultDocType: StudyMaterial["type"];
}

export const FOLDER_CONFIGS: FolderCategoryConfig[] = [
  {
    key: "syllabus",
    code: "01",
    nameZh: "考纲",
    nameEn: "syllabus",
    subtitleZh: "考试大纲与章节分值权重要求",
    subtitleEn: "OFFICIAL BLUEPRINT & WEIGHTINGS",
    descZh: "官方考试大纲、模块分值权重、核心考查范围与题型规范。",
    descEn: "Official course syllabus, topic weightings, and exam blueprint.",
    icon: BookOpen,
    tabBg: "bg-[#FCD33B]",
    tabHoverBg: "hover:bg-[#f5cc2f]",
    bodyBg: "bg-[#FCD33B]",
    textColor: "text-[#111111]",
    subtextColor: "text-[#333333]",
    badgeBg: "bg-[#111111]",
    badgeText: "text-white",
    defaultDocType: "syllabus",
  },
  {
    key: "lecture",
    code: "02",
    nameZh: "讲义",
    nameEn: "lectures",
    subtitleZh: "教授授课课件与教材重点提纲",
    subtitleEn: "COURSE SLIDES & TEXTBOOK OUTLINES",
    descZh: "课件 PPT、章节导读梳理、知识点脉络与教材精讲要点。",
    descEn: "Lecture slides, concept summaries, and textbook outlines.",
    icon: GraduationCap,
    tabBg: "bg-[#D8D8D8]",
    tabHoverBg: "hover:bg-[#CECECE]",
    bodyBg: "bg-[#D8D8D8]",
    textColor: "text-[#111111]",
    subtextColor: "text-[#444444]",
    badgeBg: "bg-[#111111]",
    badgeText: "text-white",
    defaultDocType: "lecture_slides",
  },
  {
    key: "exam",
    code: "03",
    nameZh: "真题",
    nameEn: "past exams",
    subtitleZh: "历年期末试卷与全真题库",
    subtitleEn: "PAST PAPERS & REAL EXAM MOCKS",
    descZh: "历年统考真题、期中期末试卷、标准题解与高频大题分析。",
    descEn: "Past examination papers, midterm/final exams, and worked solutions.",
    icon: FileQuestion,
    tabBg: "bg-[#8E8E8E]",
    tabHoverBg: "hover:bg-[#7F7F7F]",
    bodyBg: "bg-[#8E8E8E]",
    textColor: "text-[#111111]",
    subtextColor: "text-[#222222]",
    badgeBg: "bg-[#111111]",
    badgeText: "text-white",
    defaultDocType: "past_exam",
  },
  {
    key: "notes",
    code: "04",
    nameZh: "笔记",
    nameEn: "notes",
    subtitleZh: "核心公式速查与复习笔记",
    subtitleEn: "CHEATSHEETS & ACTIVE RECALL NOTES",
    descZh: "公式速查手记、易错陷阱归纳、主动回忆卡片与个人背诵笔记。",
    descEn: "Formula cheatsheets, trap notes, and key memory cards.",
    icon: FileText,
    tabBg: "bg-[#E6E0D6]",
    tabHoverBg: "hover:bg-[#DCD5C9]",
    bodyBg: "bg-[#E6E0D6]",
    textColor: "text-[#111111]",
    subtextColor: "text-[#444444]",
    badgeBg: "bg-[#111111]",
    badgeText: "text-white",
    defaultDocType: "notes",
  },
];

export function getDocCategoryKey(doc: StudyMaterial): FolderCategoryKey {
  const name = doc.name.toLowerCase();
  if (doc.type === "syllabus" || name.includes("大纲") || name.includes("考纲") || name.includes("syllabus")) {
    return "syllabus";
  }
  if (
    doc.type === "past_exam" ||
    doc.categoryGroup === "exam_question" ||
    name.includes("真题") ||
    name.includes("试卷") ||
    name.includes("期末") ||
    name.includes("测验") ||
    name.includes("exam") ||
    name.includes("quiz") ||
    name.includes("test")
  ) {
    return "exam";
  }
  if (
    doc.type === "lecture_slides" ||
    doc.type === "textbook_outline" ||
    name.includes("讲义") ||
    name.includes("课件") ||
    name.includes("slides") ||
    name.includes("ppt") ||
    name.includes("教材") ||
    name.includes("导读")
  ) {
    return "lecture";
  }
  return "notes";
}

// Get appropriate Windows-style file extension & color badge
function getDocExtensionBadge(doc: StudyMaterial): { ext: string; colorBg: string; colorText: string; label: string } {
  const name = doc.name.toLowerCase();
  if (name.endsWith(".pdf") || doc.content.includes("%PDF") || doc.name.includes("PDF")) {
    return { ext: "PDF", colorBg: "bg-red-500", colorText: "text-white", label: "PDF 文档" };
  }
  if (name.endsWith(".ppt") || name.endsWith(".pptx") || doc.type === "lecture_slides" || name.includes("ppt") || name.includes("讲义")) {
    return { ext: "PPT", colorBg: "bg-amber-600", colorText: "text-white", label: "幻灯片课件" };
  }
  if (name.endsWith(".doc") || name.endsWith(".docx") || doc.type === "syllabus" || name.includes("大纲")) {
    return { ext: "DOC", colorBg: "bg-blue-600", colorText: "text-white", label: "大纲文档" };
  }
  if (doc.type === "past_exam" || name.includes("真题") || name.includes("试卷")) {
    return { ext: "EXAM", colorBg: "bg-purple-600", colorText: "text-white", label: "真题考卷" };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return { ext: "MD", colorBg: "bg-slate-700", colorText: "text-white", label: "Markdown 笔记" };
  }
  return { ext: "TXT", colorBg: "bg-emerald-600", colorText: "text-white", label: "文本笔记" };
}

interface TabbedFolderArchiveProps {
  materials: StudyMaterial[];
  onPreviewDoc: (doc: StudyMaterial) => void;
  onQuizDoc: (doc: StudyMaterial) => void;
  onDeleteDoc: (docId: string) => void;
  onOpenUpload?: (folderType?: StudyMaterial["type"]) => void;
  onOpenPaste?: (folderType?: StudyMaterial["type"]) => void;
  onLoadSamples?: () => void;
  onDeleteCourse?: () => void;
}

export const TabbedFolderArchive: React.FC<TabbedFolderArchiveProps> = ({
  materials,
  onPreviewDoc,
  onQuizDoc,
  onDeleteDoc,
  onOpenUpload,
  onOpenPaste,
}) => {
  const { language } = useI18n();

  // Selected folder key: null means showing the 4 staggered visual physical folders; non-null means inside that folder.
  const [selectedFolderKey, setSelectedFolderKey] = useState<FolderCategoryKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Group materials into the 4 folders
  const categorizedMaterials = useMemo(() => {
    const map: Record<FolderCategoryKey, StudyMaterial[]> = {
      syllabus: [],
      lecture: [],
      exam: [],
      notes: [],
    };
    materials.forEach((m) => {
      const key = getDocCategoryKey(m);
      map[key].push(m);
    });
    return map;
  }, [materials]);

  const activeFolderConfig = selectedFolderKey
    ? FOLDER_CONFIGS.find((f) => f.key === selectedFolderKey) || FOLDER_CONFIGS[0]
    : null;

  const activeFolderDocs = useMemo(() => {
    if (!selectedFolderKey) return [];
    const list = categorizedMaterials[selectedFolderKey] || [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.summaryNotes && m.summaryNotes.toLowerCase().includes(q)) ||
        (m.topicTag && m.topicTag.toLowerCase().includes(q)) ||
        m.content.toLowerCase().includes(q)
    );
  }, [selectedFolderKey, categorizedMaterials, searchQuery]);

  return (
    <div className="w-full space-y-6 select-none" id="knowledge-base-tabbed-archive">
      {/* ========================================================================= */}
      {/* VIEW 1: STAGGERED OVERLAPPING PHYSICAL FOLDERS (MATCHING USER REFERENCE)  */}
      {/* ========================================================================= */}
      {!selectedFolderKey && (
        <div className="space-y-6 animate-fadeIn">
          {/* Editorial Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#111111]">
            <div>
              <div className="flex items-baseline space-x-3">
                <h2
                  className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#111111] tracking-tight leading-none"
                  style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                >
                  {language === "zh" ? "知识库" : "Knowledge"}
                </h2>
                <span
                  className="text-3xl sm:text-4xl lg:text-5xl font-serif text-[#999999] tracking-tight leading-none"
                  style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                >
                  {language === "zh" ? "分类档案" : "Archive"}
                </span>
              </div>
              <p className="text-xs font-mono text-[#666666] mt-1.5">
                {language === "zh"
                  ? "共 4 个归档文件夹 • 点击任意文件夹进入查看文件与生成 AI 测验"
                  : "4 PHYSICAL FOLDERS • CLICK ANY FOLDER TO EXPLORE FILES & QUIZZES"}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2 text-xs font-mono">
              {onOpenPaste && (
                <button
                  onClick={() => onOpenPaste("notes")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#111111] hover:bg-[#EDEDED] text-[#111111] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[{language === "zh" ? "录入笔记" : "ADD NOTE"}]</span>
                </button>
              )}
              {onOpenUpload && (
                <button
                  onClick={() => onOpenUpload("syllabus")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#2A2A2A] text-white border border-[#111111] font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>[{language === "zh" ? "上传文件" : "UPLOAD"}]</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 Overlapping Stacked Physical Folders (Exact Match to User Reference Image) */}
          <div className="relative pt-6 pb-4 w-full">
            {/* ROW 1: Folders 01 & 02 */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-x-2 sm:gap-x-4">
              {/* Folder 01: 考纲 (Syllabus) - Vibrant Yellow */}
              {(() => {
                const folder = FOLDER_CONFIGS[0];
                const docsInFolder = categorizedMaterials[folder.key] || [];
                return (
                  <div
                    key={folder.key}
                    onClick={() => {
                      setSelectedFolderKey(folder.key);
                      setSearchQuery("");
                    }}
                    className="relative group cursor-pointer transition-all duration-300 hover:z-30 hover:-translate-y-2"
                  >
                    {/* Top Tab Cutout */}
                    <div className="flex items-end">
                      <div
                        className={`inline-flex items-center px-4 pt-2 pb-1 ${folder.tabBg} font-mono font-medium text-xs text-[#111111]`}
                        style={{
                          clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 100%, 0% 100%)",
                          paddingRight: "2.8rem",
                        }}
                      >
                        <span className="text-xs font-mono font-medium opacity-80">{folder.code}</span>
                      </div>
                    </div>

                    {/* Folder Body */}
                    <div
                      className={`w-full ${folder.bodyBg} p-5 sm:p-7 shadow-[0_6px_20px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition-all duration-300 min-h-[190px] sm:min-h-[220px] flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3
                            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#111111] font-normal tracking-tight leading-none select-none"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameZh}
                          </h3>
                          <span
                            className="block text-base sm:text-lg font-serif italic text-[#111111]/70 tracking-normal mt-1"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameEn}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#111111] text-white">
                          {docsInFolder.length} {language === "zh" ? "份" : "FILES"}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#111111]">
                        <div className="truncate max-w-[70%] text-[11px] opacity-80">
                          {docsInFolder.length > 0
                            ? `📄 ${docsInFolder[0].name}`
                            : language === "zh"
                            ? "点击进入查看"
                            : "Click to explore"}
                        </div>
                        <div className="flex items-center space-x-1 font-bold text-[11px] group-hover:translate-x-1 transition-transform">
                          <span>{language === "zh" ? "进入" : "OPEN"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Folder 02: 讲义 (Lectures) - Light Grey */}
              {(() => {
                const folder = FOLDER_CONFIGS[1];
                const docsInFolder = categorizedMaterials[folder.key] || [];
                return (
                  <div
                    key={folder.key}
                    onClick={() => {
                      setSelectedFolderKey(folder.key);
                      setSearchQuery("");
                    }}
                    className="relative group cursor-pointer transition-all duration-300 hover:z-30 hover:-translate-y-2 mt-4 sm:mt-0"
                  >
                    {/* Top Tab Cutout */}
                    <div className="flex items-end">
                      <div
                        className={`inline-flex items-center px-4 pt-2 pb-1 ${folder.tabBg} font-mono font-medium text-xs text-[#111111]`}
                        style={{
                          clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 100%, 0% 100%)",
                          paddingRight: "2.8rem",
                        }}
                      >
                        <span className="text-xs font-mono font-medium opacity-80">{folder.code}</span>
                      </div>
                    </div>

                    {/* Folder Body */}
                    <div
                      className={`w-full ${folder.bodyBg} p-5 sm:p-7 shadow-[0_6px_20px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_28px_rgba(0,0,0,0.18)] transition-all duration-300 min-h-[190px] sm:min-h-[220px] flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3
                            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#111111] font-normal tracking-tight leading-none select-none"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameZh}
                          </h3>
                          <span
                            className="block text-base sm:text-lg font-serif italic text-[#111111]/70 tracking-normal mt-1"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameEn}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#111111] text-white">
                          {docsInFolder.length} {language === "zh" ? "份" : "FILES"}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#111111]">
                        <div className="truncate max-w-[70%] text-[11px] opacity-80">
                          {docsInFolder.length > 0
                            ? `📄 ${docsInFolder[0].name}`
                            : language === "zh"
                            ? "点击进入查看"
                            : "Click to explore"}
                        </div>
                        <div className="flex items-center space-x-1 font-bold text-[11px] group-hover:translate-x-1 transition-transform">
                          <span>{language === "zh" ? "进入" : "OPEN"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ROW 2: Folders 03 & 04 (Overlapping stacked on top of Row 1 with negative top margin) */}
            <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 gap-x-2 sm:gap-x-4 -mt-8 sm:-mt-16">
              {/* Folder 03: 真题 (Past Exams) - Medium Grey */}
              {(() => {
                const folder = FOLDER_CONFIGS[2];
                const docsInFolder = categorizedMaterials[folder.key] || [];
                return (
                  <div
                    key={folder.key}
                    onClick={() => {
                      setSelectedFolderKey(folder.key);
                      setSearchQuery("");
                    }}
                    className="relative group cursor-pointer transition-all duration-300 hover:z-40 hover:-translate-y-2 mt-4 sm:mt-0"
                  >
                    {/* Top Tab Cutout */}
                    <div className="flex items-end">
                      <div
                        className={`inline-flex items-center px-4 pt-2 pb-1 ${folder.tabBg} font-mono font-medium text-xs text-[#111111]`}
                        style={{
                          clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 100%, 0% 100%)",
                          paddingRight: "2.8rem",
                        }}
                      >
                        <span className="text-xs font-mono font-medium opacity-80">{folder.code}</span>
                      </div>
                    </div>

                    {/* Folder Body with shadow over row 1 */}
                    <div
                      className={`w-full ${folder.bodyBg} p-5 sm:p-7 shadow-[0_-4px_24px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition-all duration-300 min-h-[190px] sm:min-h-[220px] flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3
                            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#111111] font-normal tracking-tight leading-none select-none"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameZh}
                          </h3>
                          <span
                            className="block text-base sm:text-lg font-serif italic text-[#111111]/70 tracking-normal mt-1"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameEn}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#111111] text-white">
                          {docsInFolder.length} {language === "zh" ? "份" : "FILES"}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#111111]">
                        <div className="truncate max-w-[70%] text-[11px] opacity-80">
                          {docsInFolder.length > 0
                            ? `📄 ${docsInFolder[0].name}`
                            : language === "zh"
                            ? "点击进入查看"
                            : "Click to explore"}
                        </div>
                        <div className="flex items-center space-x-1 font-bold text-[11px] group-hover:translate-x-1 transition-transform">
                          <span>{language === "zh" ? "进入" : "OPEN"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Folder 04: 笔记 (Notes) - Craft Beige */}
              {(() => {
                const folder = FOLDER_CONFIGS[3];
                const docsInFolder = categorizedMaterials[folder.key] || [];
                return (
                  <div
                    key={folder.key}
                    onClick={() => {
                      setSelectedFolderKey(folder.key);
                      setSearchQuery("");
                    }}
                    className="relative group cursor-pointer transition-all duration-300 hover:z-40 hover:-translate-y-2 mt-4 sm:mt-0"
                  >
                    {/* Top Tab Cutout */}
                    <div className="flex items-end">
                      <div
                        className={`inline-flex items-center px-4 pt-2 pb-1 ${folder.tabBg} font-mono font-medium text-xs text-[#111111]`}
                        style={{
                          clipPath: "polygon(0 0, calc(100% - 24px) 0, 100% 100%, 0% 100%)",
                          paddingRight: "2.8rem",
                        }}
                      >
                        <span className="text-xs font-mono font-medium opacity-80">{folder.code}</span>
                      </div>
                    </div>

                    {/* Folder Body with shadow over row 1 */}
                    <div
                      className={`w-full ${folder.bodyBg} p-5 sm:p-7 shadow-[0_-4px_24px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] group-hover:shadow-[0_12px_32px_rgba(0,0,0,0.22)] transition-all duration-300 min-h-[190px] sm:min-h-[220px] flex flex-col justify-between`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3
                            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-[#111111] font-normal tracking-tight leading-none select-none"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameZh}
                          </h3>
                          <span
                            className="block text-base sm:text-lg font-serif italic text-[#111111]/70 tracking-normal mt-1"
                            style={{ fontFamily: "'Instrument Serif', 'Playfair Display', serif" }}
                          >
                            {folder.nameEn}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-[#111111] text-white">
                          {docsInFolder.length} {language === "zh" ? "份" : "FILES"}
                        </span>
                      </div>

                      <div className="pt-3 border-t border-[#111111]/15 flex items-center justify-between text-xs font-mono text-[#111111]">
                        <div className="truncate max-w-[70%] text-[11px] opacity-80">
                          {docsInFolder.length > 0
                            ? `📄 ${docsInFolder[0].name}`
                            : language === "zh"
                            ? "点击进入查看"
                            : "Click to explore"}
                        </div>
                        <div className="flex items-center space-x-1 font-bold text-[11px] group-hover:translate-x-1 transition-transform">
                          <span>{language === "zh" ? "进入" : "OPEN"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: INSIDE THE FOLDER — CLEAN WINDOWS FILE ICONS & NAMES LAYOUT       */}
      {/* ========================================================================= */}
      {selectedFolderKey && activeFolderConfig && (
        <div className="space-y-4 animate-fadeIn">
          {/* Top Physical Tabs (Matching User Image with the 4 Colors) */}
          <div className="flex items-end justify-between gap-1 overflow-x-auto pt-2 scrollbar-none border-b border-[#111111]">
            <div className="flex items-end space-x-1.5">
              {/* Back button */}
              <button
                onClick={() => {
                  setSelectedFolderKey(null);
                  setSearchQuery("");
                }}
                className="flex items-center space-x-1 px-3 py-2 bg-white border-t border-x border-[#111111] hover:bg-[#111111] hover:text-white text-[#111111] text-xs font-mono font-bold transition-all cursor-pointer mb-[1px]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{language === "zh" ? "返回全部" : "BACK"}</span>
              </button>

              {/* 4 Colored Physical Cutout Tabs */}
              {FOLDER_CONFIGS.map((f) => {
                const isActive = f.key === selectedFolderKey;
                const count = categorizedMaterials[f.key]?.length || 0;

                return (
                  <button
                    key={f.key}
                    onClick={() => {
                      setSelectedFolderKey(f.key);
                      setSearchQuery("");
                    }}
                    className={`relative flex items-center space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 font-mono text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? `${f.tabBg} text-[#111111] z-10 -mb-[1px] pt-3 sm:pt-3.5 shadow-xs`
                        : `${f.tabBg} text-[#111111]/75 hover:text-[#111111] opacity-75 hover:opacity-100 hover:-translate-y-0.5`
                    }`}
                    style={{
                      clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0% 100%)",
                      paddingRight: "1.75rem",
                    }}
                  >
                    <span className="text-[10px] opacity-70">{f.code}</span>
                    <span className="font-serif text-sm font-normal">
                      {f.nameZh}
                    </span>
                    <span className="text-[10px] px-1 py-0.2 bg-[#111111] text-white">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* In-folder Add Buttons */}
            <div className="flex items-center space-x-2 pb-2 pr-1 font-mono text-xs">
              {onOpenPaste && (
                <button
                  onClick={() => onOpenPaste(activeFolderConfig.defaultDocType)}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-[#111111] hover:bg-[#EDEDED] text-[#111111] text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title={language === "zh" ? `录入笔记到【${activeFolderConfig.nameZh}】` : "Add note"}
                >
                  <Plus className="w-3 h-3" />
                  <span>[{language === "zh" ? "录入笔记" : "NOTE"}]</span>
                </button>
              )}
              {onOpenUpload && (
                <button
                  onClick={() => onOpenUpload(activeFolderConfig.defaultDocType)}
                  className="flex items-center space-x-1 px-2.5 py-1 bg-[#111111] hover:bg-[#2A2A2A] text-white border border-[#111111] text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title={language === "zh" ? `上传文件到【${activeFolderConfig.nameZh}】` : "Upload file"}
                >
                  <Plus className="w-3 h-3" />
                  <span>[{language === "zh" ? "上传文件" : "UPLOAD"}]</span>
                </button>
              )}
            </div>
          </div>

          {/* Folder Content Container: Clean Windows Grid with only Icon & Filename */}
          <div className="bg-[#FAF9F6] border border-[#111111] p-5 sm:p-7 min-h-[320px]">
            {/* Folder Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#E5E0D8] font-mono">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 bg-[#111111] text-white text-xs font-bold">
                  {activeFolderConfig.code}
                </span>
                <h3 className="text-base font-bold text-[#111111]">
                  {activeFolderConfig.nameZh}
                </h3>
                <span className="text-xs text-[#888888]">
                  ({activeFolderDocs.length} {language === "zh" ? "个文件" : "files"})
                </span>
              </div>

              {/* Quick Search */}
              {activeFolderDocs.length > 3 && (
                <div className="relative w-44 font-mono">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === "zh" ? "搜索文件..." : "Search..."}
                    className="w-full pl-8 pr-2.5 py-1 bg-white text-xs text-[#111111] placeholder:text-[#888888] outline-none border border-[#D5D0C5] focus:border-[#111111]"
                  />
                </div>
              )}
            </div>

            {/* Empty State */}
            {activeFolderDocs.length === 0 && (
              <div className="py-16 text-center space-y-2 font-mono">
                <FolderOpen className="w-12 h-12 mx-auto text-[#BBBBBB]" />
                <p className="text-xs font-bold text-[#666666]">
                  [{language === "zh" ? `此文件夹为空` : `FOLDER IS EMPTY`}]
                </p>
                <p className="text-xs text-[#999999] font-sans">
                  {language === "zh" ? "点击右上角「上传文件」添加资料" : "Use buttons above to add documents"}
                </p>
              </div>
            )}

            {/* Clean Windows File Icons Grid */}
            {activeFolderDocs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {activeFolderDocs.map((doc) => {
                  const badge = getDocExtensionBadge(doc);

                  return (
                    <div
                      key={doc.id}
                      id={`doc-file-${doc.id}`}
                      onClick={() => onPreviewDoc(doc)}
                      className="group relative flex flex-col items-center p-3 rounded-xs border border-transparent hover:border-[#111111]/30 hover:bg-white hover:shadow-xs transition-all duration-150 cursor-pointer text-center"
                      title={`${doc.name} (点击打开)`}
                    >
                      {/* Top Right Quick Delete Button (visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 text-[#888888] hover:text-red-700 hover:bg-red-50 rounded-xs transition-all cursor-pointer z-10"
                        title="删除此文件"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Windows File Icon */}
                      <div className="relative flex items-center justify-center w-14 h-16 bg-white border border-[#D5D0C5] shadow-xs group-hover:border-[#111111] group-hover:scale-105 transition-all duration-150 mb-2">
                        {/* Folded corner */}
                        <div
                          className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#FAF9F6] border-l border-b border-[#D5D0C5]"
                          style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
                        />
                        <File className="w-7 h-7 text-[#555555] group-hover:text-[#111111]" />
                        {/* Format Extension Badge */}
                        <span
                          className={`absolute -bottom-1.5 -right-1.5 text-[9px] font-bold font-mono px-1 py-0.2 uppercase ${badge.colorBg} ${badge.colorText} shadow-xs`}
                        >
                          {badge.ext}
                        </span>
                      </div>

                      {/* File Name */}
                      <span
                        className="text-xs font-sans text-[#111111] leading-snug line-clamp-2 break-words max-w-full group-hover:text-black font-medium"
                      >
                        {doc.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
