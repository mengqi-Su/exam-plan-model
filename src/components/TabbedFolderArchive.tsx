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
    nameEn: "Syllabus",
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
    nameEn: "Lectures",
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
    nameEn: "Past exams",
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
    nameEn: "Notes",
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

// Restrained, modern folder accents (tab + icon tint) on white cards.
const FOLDER_ACCENTS: Record<FolderCategoryKey, { accent: string; tint: string }> = {
  syllabus: { accent: "#D9A521", tint: "#FBF3DC" },
  lecture: { accent: "#6E8CA8", tint: "#EEF2F6" },
  exam: { accent: "#A9756A", tint: "#F5EEEB" },
  notes: { accent: "#6F9A78", tint: "#EDF3EE" },
};

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

// File extension badge with soft semantic tints
function getDocExtensionBadge(doc: StudyMaterial): { ext: string; colorBg: string; colorText: string; label: string } {
  const name = doc.name.toLowerCase();
  if (name.endsWith(".pdf") || doc.content.includes("%PDF") || doc.name.includes("PDF")) {
    return { ext: "PDF", colorBg: "bg-[#FDF0EE]", colorText: "text-[#B42318]", label: "PDF 文档" };
  }
  if (name.endsWith(".ppt") || name.endsWith(".pptx") || doc.type === "lecture_slides" || name.includes("ppt") || name.includes("讲义")) {
    return { ext: "PPT", colorBg: "bg-[#FFF6DD]", colorText: "text-[#8A5A00]", label: "幻灯片课件" };
  }
  if (name.endsWith(".doc") || name.endsWith(".docx") || doc.type === "syllabus" || name.includes("大纲")) {
    return { ext: "DOC", colorBg: "bg-[#EEF3FE]", colorText: "text-[#1D4ED8]", label: "大纲文档" };
  }
  if (doc.type === "past_exam" || name.includes("真题") || name.includes("试卷")) {
    return { ext: "EXAM", colorBg: "bg-[#F3EEF8]", colorText: "text-[#6B4E8E]", label: "真题考卷" };
  }
  if (name.endsWith(".md") || name.endsWith(".markdown")) {
    return { ext: "MD", colorBg: "bg-[#F1EFE9]", colorText: "text-[#6B6660]", label: "Markdown 笔记" };
  }
  return { ext: "TXT", colorBg: "bg-[#EEF4EF]", colorText: "text-[#3F6B4F]", label: "文本笔记" };
}

interface TabbedFolderArchiveProps {
  materials: StudyMaterial[];
  onPreviewDoc: (doc: StudyMaterial) => void;
  onDeleteDoc: (docId: string) => void;
  onOpenUpload?: (folderType?: StudyMaterial["type"]) => void;
  onOpenPaste?: (folderType?: StudyMaterial["type"]) => void;
  onDeleteCourse?: () => void;
  /** 传了这三个就变成「可勾选的资料库」：勾中的那份才会进下一次 AI 生成。 */
  selectedIds?: string[];
  onToggleSelected?: (docId: string) => void;
  selectionLimit?: number;
}

export const TabbedFolderArchive: React.FC<TabbedFolderArchiveProps> = ({
  materials,
  onPreviewDoc,
  onDeleteDoc,
  onOpenUpload,
  onOpenPaste,
  selectedIds,
  onToggleSelected,
  selectionLimit,
}) => {
  const { language } = useI18n();
  const isZh = language === "zh";

  // null = folder overview; non-null = inside that folder.
  const [selectedFolderKey, setSelectedFolderKey] = useState<FolderCategoryKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const openFolder = (key: FolderCategoryKey) => {
    setSelectedFolderKey(key);
    setSearchQuery("");
  };

  // 语言切换后文件夹名要跟着换，中英文不再同时摆两份。
  const activeFolderLabel = activeFolderConfig
    ? isZh
      ? activeFolderConfig.nameZh
      : activeFolderConfig.nameEn
    : "";

  const renderFolder = (folder: FolderCategoryConfig, row2: boolean) => {
    const docsInFolder = categorizedMaterials[folder.key] || [];
    const a = FOLDER_ACCENTS[folder.key];
    const Icon = folder.icon;
    return (
      <div
        key={folder.key}
        onClick={() => openFolder(folder.key)}
        className={`relative group cursor-pointer transition-all duration-300 hover:-translate-y-1.5 ${
          row2 ? "mt-4 sm:mt-0 hover:z-40" : "hover:z-30"
        }`}
      >
        {/* Folder tab notch */}
        <div className="flex items-end pl-1">
          <div
            className="h-4 w-24 rounded-t-md"
            style={{
              backgroundColor: a.accent,
              opacity: 0.9,
              clipPath: "polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0% 100%)",
            }}
          />
        </div>

        {/* Folder body */}
        <div
          className="w-full rounded-b-xl rounded-tr-xl border border-[#eae7e1] bg-white p-4 sm:p-5 min-h-[148px] sm:min-h-[160px] flex flex-col justify-between transition-shadow duration-300 group-hover:shadow-[0_14px_30px_rgba(28,27,26,0.13)]"
          style={{
            boxShadow: row2
              ? "0 -2px 16px rgba(28,27,26,0.06), 0 6px 18px rgba(28,27,26,0.06)"
              : "0 4px 14px rgba(28,27,26,0.05)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: a.tint, color: a.accent }}
              >
                <Icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                {/* 文件夹名属于「组」这一层：可点开的容器，和树里的大单元同级 */}
                <h3 className="ui-group-title leading-tight truncate">
                  {isZh ? folder.nameZh : folder.nameEn}
                </h3>
              </div>
            </div>
            <span className="ui-chip tabular-nums shrink-0">
              {docsInFolder.length}
              {isZh ? " 份" : ""}
            </span>
          </div>

          <div className="pt-3 mt-3 border-t border-[#f0ede8] flex items-center justify-between gap-2 text-[12px]">
            {/* 空文件夹这里就留白：右边的「进入 →」已经是明确的动作，
                不需要再用一句灰字教用户怎么点这张卡。 */}
            {docsInFolder.length > 0 && (
              <div className="truncate ui-muted flex items-center gap-1.5 min-w-0">
                <File className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{docsInFolder[0].name}</span>
              </div>
            )}
            <div className="flex items-center gap-1 font-medium text-[#1c1b1a] shrink-0 ml-auto group-hover:translate-x-0.5 transition-transform">
              <span>{isZh ? "进入" : "Open"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 select-none" id="knowledge-base-tabbed-archive">
      {/* VIEW 1: staggered physical folders */}
      {!selectedFolderKey && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              {/* 段标题（h2 / 15px）已经给了「课程资料与考点体系」，这里只是段内的子面板。 */}
              <h3 className="ui-group-title">
                {isZh ? "知识库" : "Knowledge base"}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              {onOpenPaste && (
                <button onClick={() => onOpenPaste("notes")} className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isZh ? "录入笔记" : "Add note"}</span>
                </button>
              )}
              {onOpenUpload && (
                <button onClick={() => onOpenUpload("syllabus")} className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px]">
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isZh ? "上传文件" : "Upload"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="relative pt-4 pb-4 w-full">
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {renderFolder(FOLDER_CONFIGS[0], false)}
              {renderFolder(FOLDER_CONFIGS[1], false)}
            </div>
            <div className="relative z-20 grid grid-cols-1 sm:grid-cols-2 gap-x-4 -mt-6 sm:-mt-12">
              {renderFolder(FOLDER_CONFIGS[2], true)}
              {renderFolder(FOLDER_CONFIGS[3], true)}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: inside a folder */}
      {selectedFolderKey && activeFolderConfig && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-3 border-b border-[#eae7e1]">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedFolderKey(null);
                  setSearchQuery("");
                }}
                className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px] shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isZh ? "返回" : "Back"}</span>
              </button>

              {FOLDER_CONFIGS.map((f) => {
                const isActive = f.key === selectedFolderKey;
                const count = categorizedMaterials[f.key]?.length || 0;
                const a = FOLDER_ACCENTS[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => openFolder(f.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
                      isActive ? "bg-[#f1efe9] text-[#1c1b1a]" : "text-[#6b6660] hover:bg-black/[0.03] hover:text-[#1c1b1a]"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.accent }} />
                    <span>{isZh ? f.nameZh : f.nameEn}</span>
                    <span className="text-[11px] ui-subtle tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 shrink-0 pr-1">
              {onOpenPaste && (
                <button
                  onClick={() => onOpenPaste(activeFolderConfig.defaultDocType)}
                  className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px]"
                  title={isZh ? `录入笔记到【${activeFolderLabel}】` : `Add note to ${activeFolderLabel}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isZh ? "录入笔记" : "Note"}</span>
                </button>
              )}
              {onOpenUpload && (
                <button
                  onClick={() => onOpenUpload(activeFolderConfig.defaultDocType)}
                  className="ui-btn ui-btn-primary px-2.5 py-1.5 text-[12px]"
                  title={isZh ? `上传文件到【${activeFolderLabel}】` : `Upload to ${activeFolderLabel}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isZh ? "上传文件" : "Upload"}</span>
                </button>
              )}
            </div>
          </div>

          <div className="ui-card p-5 sm:p-7 min-h-[320px]">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#f0ede8]">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: FOLDER_ACCENTS[activeFolderConfig.key].accent }}
                />
                <h3 className="ui-group-title">{activeFolderLabel}</h3>
                <span className="ui-row-meta tabular-nums">
                  {activeFolderDocs.length} {isZh ? "个文件" : "files"}
                </span>
              </div>

              {activeFolderDocs.length > 3 && (
                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a39e97]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isZh ? "搜索文件…" : "Search..."}
                    className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white text-[13px] text-[#1c1b1a] placeholder-[#a39e97] border border-[#e5e2dc] focus:border-[#cfc9c0]"
                  />
                </div>
              )}
            </div>

            {activeFolderDocs.length === 0 && (
              <div className="py-16 text-center space-y-2">
                <FolderOpen className="w-12 h-12 mx-auto text-[#cfc9c0]" />
                <p className="ui-row-title">
                  {isZh ? "此文件夹为空" : "This folder is empty"}
                </p>
              </div>
            )}

            {activeFolderDocs.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {activeFolderDocs.map((doc) => {
                  const badge = getDocExtensionBadge(doc);
                  const selectable = !!onToggleSelected && !!selectedIds;
                  const checked = selectable && selectedIds!.includes(doc.id);
                  const selectionFull =
                    selectable && selectedIds!.length >= (selectionLimit ?? Number.POSITIVE_INFINITY);
                  return (
                    <div
                      key={doc.id}
                      id={`doc-file-${doc.id}`}
                      onClick={() => onPreviewDoc(doc)}
                      className="group relative flex flex-col items-center p-3 rounded-xl border border-transparent hover:border-[#eae7e1] hover:bg-[#faf9f6] transition-all duration-150 cursor-pointer text-center"
                      title={`${doc.name} (${isZh ? "点击打开" : "click to open"})`}
                    >
                      {selectable && (
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && selectionFull}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => onToggleSelected!(doc.id)}
                          aria-label={
                            isZh ? `本次生成使用 ${doc.name}` : `Use ${doc.name} in this run`
                          }
                          title={
                            !checked && selectionFull
                              ? isZh
                                ? `一次生成最多用 ${selectionLimit} 份，先取消勾选其他资料`
                                : `One run uses at most ${selectionLimit} files. Uncheck another file first.`
                              : isZh
                                ? "勾选后用于本次生成"
                                : "Checked files are used in this run"
                          }
                          className="absolute top-1 left-1 z-10 h-4 w-4 cursor-pointer accent-[#1c1b1a] disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDoc(doc.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 p-1 rounded-md text-[#a39e97] hover:text-[#B42318] hover:bg-[#FDF0EE] transition-all cursor-pointer z-10"
                        title={isZh ? "删除此文件" : "Delete file"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative flex items-center justify-center w-14 h-16 rounded-lg bg-white border border-[#eae7e1] shadow-[0_1px_2px_rgba(28,27,26,0.05)] group-hover:border-[#ddd8d0] group-hover:scale-105 transition-all duration-150 mb-2">
                        <div
                          className="absolute top-0 right-0 w-3.5 h-3.5 bg-[#f5f3ee] border-l border-b border-[#eae7e1] rounded-tr-lg"
                          style={{ clipPath: "polygon(0 0, 100% 100%, 0 100%)" }}
                        />
                        <File className="w-7 h-7 text-[#a39e97] group-hover:text-[#6b6660]" />
                        <span
                          className={`absolute -bottom-1.5 -right-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border border-white shadow-[0_1px_2px_rgba(28,27,26,0.1)] ${badge.colorBg} ${badge.colorText}`}
                        >
                          {badge.ext}
                        </span>
                      </div>

                      <span className="text-[12px] text-[#1c1b1a] leading-snug line-clamp-2 break-words max-w-full font-medium">
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