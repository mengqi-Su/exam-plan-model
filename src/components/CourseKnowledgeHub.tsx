import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { SyllabusTopic, StudyMaterial, ExamStudyPlan, TextbookOutline } from "../types";
import { useI18n } from "../lib/i18n";
import {
  MAX_AI_MATERIALS,
  MAX_LIBRARY_MATERIALS,
  aiSelectionNotice,
  defaultAiSelection,
  prepareMaterialsForAI,
  runGeneration,
} from "../lib/aiClient";
import { mergeTopics, nonTextbookTitles, replaceTextbookTopics } from "../lib/topics";
import { duplicateMaterialsNotice, mergeMaterials } from "../lib/materials";
import { TabbedFolderArchive } from "./TabbedFolderArchive";
import { UploadModal } from "./UploadModal";
import { NoteModal } from "./NoteModal";
import { DocumentReaderModal } from "./DocumentReaderModal";
import { HierarchicalTopicTreeView } from "./HierarchicalTopicTreeView";
import { TextbookOutlineDialog } from "./TextbookOutlineDialog";
import { NoticeBand } from "./NoticeBand";

interface CourseKnowledgeHubProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onDeleteCourse?: () => void;
  onRequestDeleteCourse?: (plan?: ExamStudyPlan | null) => void;
  /**
   * 页头「去上传资料」按了几次。只当它是一个递增的请求号：
   * 值变了就把上传弹窗打开，是什么科目、资料库还剩几个位置都不归这里管。
   */
  uploadRequest?: number;
  /** 回程联动定位：展开并滚动到指定单元/子考点 */
  focusUnitId?: string | null;
  focusSubtopicTitle?: string;
  focusNonce?: number;
}

export function CourseKnowledgeHub({
  plan,
  onUpdatePlan,
  onDeleteCourse,
  onRequestDeleteCourse,
  uploadRequest = 0,
  focusUnitId = null,
  focusSubtopicTitle = "",
  focusNonce = 0,
}: CourseKnowledgeHubProps) {
  const { language } = useI18n();

  const [extractError, setExtractError] = useState<string | null>(null);
  // 这批资料收得怎么样（跳过几份重复、只收下前几份）——是结果，不是故障，所以不放红底。
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [activeFolderDocType, setActiveFolderDocType] = useState<StudyMaterial["type"]>("notes");

  // 页头那句「去上传资料」已经把动作说死了，这里就是那一步：
  // 展开资料区之后还要人自己找「上传文件」，等于一句话办半件事。
  useEffect(() => {
    if (uploadRequest > 0) setShowUploadBox(true);
  }, [uploadRequest]);

  const [isExtracting, setIsExtracting] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicWeight, setNewTopicWeight] = useState(15);
  const [newTopicHours, setNewTopicHours] = useState(4);
  const [newTopicSubtopics, setNewTopicSubtopics] = useState("");

  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);
  const [textbookDialogOpen, setTextbookDialogOpen] = useState(false);

  const materials: StudyMaterial[] = plan.materials || [];
  const topics: SyllabusTopic[] = plan.topics || [];

  // 资料库容量和单次生成用量分开：库里能存 100 份，重新提炼只吃勾选的 20 份。
  const [aiSelectedIds, setAiSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    setAiSelectedIds((prev) => defaultAiSelection(plan.materials, prev));
  }, [plan.materials]);

  const toggleAiSelected = (docId: string) => {
    setAiSelectedIds((prev) => {
      if (prev.includes(docId)) return prev.filter((id) => id !== docId);
      if (prev.length >= MAX_AI_MATERIALS) return prev;
      return [...prev, docId];
    });
  };

  const selectionNotice = aiSelectionNotice(materials.length, aiSelectedIds.length, language);

  const updatePlanMaterials = (newMaterials: StudyMaterial[]) => {
    onUpdatePlan({
      ...plan,
      materials: newMaterials,
      updatedAt: new Date().toISOString(),
    });
  };

  // 资料库上限和单次生成上限是两件事：库满了要说清收下了几份，不静默丢文件。
  // 去重排在上限之前：同一份正文换个文件名传第二遍，不该挤掉真正的新资料。
  const addToLibrary = async (incoming: StudyMaterial[]) => {
    if (incoming.length === 0) return;
    const slots = MAX_LIBRARY_MATERIALS - materials.length;
    if (slots <= 0) {
      setLibraryNotice(
        language === "zh"
          ? `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，请先删除部分文件。`
          : `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Remove some files first.`
      );
      return;
    }
    const merged = await mergeMaterials(materials, incoming, MAX_LIBRARY_MATERIALS);
    if (merged.accepted.length > 0) updatePlanMaterials([...merged.accepted, ...materials]);
    const notices: string[] = [];
    if (merged.overflow > 0) {
      notices.push(
        language === "zh"
          ? `资料库最多存 ${MAX_LIBRARY_MATERIALS} 份资料，本次仅收下前 ${merged.accepted.length} 份。`
          : `The library holds up to ${MAX_LIBRARY_MATERIALS} materials. Only the first ${merged.accepted.length} files were kept.`
      );
    }
    if (merged.duplicates > 0) {
      notices.push(duplicateMaterialsNotice(merged.duplicates, language === "zh"));
    }
    setLibraryNotice(notices.length > 0 ? notices.join(language === "zh" ? "；" : "; ") : null);
  };

  const handleDeleteDoc = (docId: string) => {
    const updated = materials.filter((m) => m.id !== docId);
    updatePlanMaterials(updated);
  };

  const handleExtractTopics = async () => {
    if (materials.length === 0) {
      setExtractError(
        language === "zh"
          ? "请先在上方知识库中上传课程资料或粘贴笔记，AI 将为您提炼考点架构；一份资料都没有时，可以改用「按教材目录整理」。"
          : "Upload course materials or paste notes above first so AI can extract the topic blueprint — or use “From a textbook” when you have no files."
      );
      return;
    }

    if (materials.length > 0 && aiSelectedIds.length === 0) {
      setExtractError(
        language === "zh"
          ? "请先在资料库里勾选要用于本次提炼的资料。"
          : "Check the materials you want this run to use in the library first."
      );
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setSuccessNote(null);

    try {
      const { result } = await runGeneration<{ summary?: string; topics?: SyllabusTopic[] }>(
        "syllabus",
        {
          materials: prepareMaterialsForAI(materials, aiSelectedIds),
          examName: plan.examName || (language === "zh" ? "即将到来的期末考试" : "Upcoming Exam"),
          subject: plan.subject || (language === "zh" ? "综合学科" : "General"),
        },
        { language }
      );

      if (!Array.isArray(result?.topics) || result.topics.length === 0) {
        setExtractError(
          language === "zh"
            ? "AI 未能从这些资料中识别出可用考点，请补充更完整的资料后重试。"
            : "AI could not identify usable topics from these materials. Add fuller materials and try again."
        );
        return;
      }

      onUpdatePlan({
        ...plan,
        // 「重新提炼」重建的是资料提炼那一份；教材目录回忆的和你手动加的考点不属于它，不能跟着一起没。
        topics: mergeTopics(
          topics.filter((topic) => topic.source === "textbook" || topic.source === "manual"),
          result.topics
        ),
        materialsSummary: result.summary || plan.materialsSummary,
        updatedAt: new Date().toISOString(),
      });
      setSuccessNote(
        language === "zh"
          ? "AI 考点架构已根据知识库资料更新完毕。"
          : "Topic blueprint extracted successfully."
      );
      window.setTimeout(() => setSuccessNote(null), 4000);
    } catch (error: any) {
      console.error("Topic extraction failed:", error);
      setExtractError(
        error?.message ||
          (language === "zh"
            ? "无法连接 AI 服务，请检查网络后重试。"
            : "Could not reach the AI service. Check your connection and try again.")
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddCustomTopic = () => {
    if (!newTopicTitle.trim()) return;
    const subtopicsList = newTopicSubtopics
      .split(/[,，\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const newTopic: SyllabusTopic = {
      id: `topic-custom-${Date.now()}`,
      title: newTopicTitle.trim(),
      category: plan.subject || (language === "zh" ? "专业核心" : "Core"),
      weightPercentage: Number(newTopicWeight) || 15,
      difficulty: "medium",
      userKnowledgeLevel: "intermediate",
      subtopics: subtopicsList.length > 0 ? subtopicsList : [newTopicTitle.trim()],
      estimatedHours: Number(newTopicHours) || 4,
      source: "manual",
    };

    onUpdatePlan({
      ...plan,
      topics: [...topics, newTopic],
      updatedAt: new Date().toISOString(),
    });
    setNewTopicTitle("");
    setNewTopicSubtopics("");
    setIsAddingTopic(false);
  };

  // 教材目录回忆出来的考点整批换掉旧的教材考点；资料提炼的、你手动加的都按原样留着。
  const applyTextbookTopics = (nextTopics: SyllabusTopic[], outline: TextbookOutline) => {
    const zh = language === "zh";
    const bookTitle = outline.textbook || (zh ? "教材" : "the textbook");
    onUpdatePlan({
      ...plan,
      topics: replaceTextbookTopics(topics, nextTopics),
      materialsSummary: zh
        ? `《${bookTitle}》目录 · AI 整理 ${nextTopics.length} 个考点`
        : `Outline of "${bookTitle}" · ${nextTopics.length} topics recalled by AI`,
      updatedAt: new Date().toISOString(),
    });
    setTextbookDialogOpen(false);
    setExtractError(null);
    setSuccessNote(
      zh
        ? `已按《${bookTitle}》目录整理 ${nextTopics.length} 个考点，标着「教材目录」，随时可以删。`
        : `${nextTopics.length} topics added from "${bookTitle}", marked “Textbook” and removable any time.`
    );
    window.setTimeout(() => setSuccessNote(null), 6000);
  };

  const handleDeleteTopic = (topicId: string) => {
    onUpdatePlan({
      ...plan,
      topics: topics.filter((topic) => topic.id !== topicId),
      updatedAt: new Date().toISOString(),
    });
  };

  const isZh = language === "zh";

  return (
    <div className="space-y-8 animate-fadeIn text-[#1c1b1a]">
      {successNote && (
        <div className="flex items-center gap-2 rounded-xl border border-[#d8e4dc] bg-[#EEF4EF] px-3.5 py-3 text-[12px] font-medium text-[#3F6B4F] animate-fadeIn">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{successNote}</span>
        </div>
      )}

      {libraryNotice && (
        <NoticeBand tone="notice" message={libraryNotice} onDismiss={() => setLibraryNotice(null)} />
      )}

      {extractError && (
        <div className="flex items-start gap-2 rounded-xl border border-[#f0d0cc] bg-[#FDF0EE] px-3.5 py-3 text-[12px] leading-relaxed text-[#B42318]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{extractError}</span>
        </div>
      )}

      <section className="space-y-4">
        {/* 1. Main Knowledge Base Archive View */}
        <div className="space-y-3 pt-1">
          {selectionNotice && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-[#e5e2dc] bg-[#faf9f6] px-3.5 py-3">
              <p className="text-[13px] leading-relaxed text-[#1c1b1a]">{selectionNotice}</p>
              <span className="shrink-0 text-[12px] text-[#6b6660] tabular-nums">
                {isZh ? "本次生成" : "This run"} {aiSelectedIds.length} / {MAX_AI_MATERIALS}
              </span>
            </div>
          )}
          <TabbedFolderArchive
            materials={materials}
            onPreviewDoc={(doc) => setPreviewDoc(doc)}
            onDeleteDoc={(docId) => handleDeleteDoc(docId)}
            selectedIds={aiSelectedIds}
            onToggleSelected={toggleAiSelected}
            selectionLimit={MAX_AI_MATERIALS}
            onOpenUpload={(folderType) => {
              if (folderType) setActiveFolderDocType(folderType);
              setShowUploadBox(true);
            }}
            onOpenPaste={(folderType) => {
              if (folderType) setActiveFolderDocType(folderType);
              setShowPasteBox(true);
            }}
            onDeleteCourse={(onRequestDeleteCourse || onDeleteCourse) ? () => {
              if (onRequestDeleteCourse) {
                onRequestDeleteCourse(plan);
              } else if (onDeleteCourse) {
                onDeleteCourse();
              }
            } : undefined}
          />
        </div>

        {/* 2. Upload Modal Dialog */}
        <UploadModal
          isOpen={showUploadBox}
          onClose={() => setShowUploadBox(false)}
          currentSyllabusContent=""
          initialType={activeFolderDocType}
          onUploadSuccess={(newAttachedMaterials) => {
            addToLibrary(newAttachedMaterials);
          }}
        />

        {/* 3. Note / Text Modal Dialog */}
        <NoteModal
          isOpen={showPasteBox}
          onClose={() => setShowPasteBox(false)}
          initialType={activeFolderDocType}
          onSave={(noteData) => {
            const newDoc: StudyMaterial = {
              id: `mat-paste-${Date.now()}`,
              name: noteData.title,
              type: noteData.type,
              categoryGroup:
                noteData.type === "past_exam"
                  ? "exam_question"
                  : noteData.type === "syllabus"
                  ? "course_syllabus"
                  : "study_material",
              content: noteData.content,
              uploadedAt: new Date().toISOString(),
              sizeBytes: new Blob([noteData.content]).size,
              summaryNotes: noteData.content.slice(0, 150) + "...",
              difficulty: "medium",
            };
            addToLibrary([newDoc]);
          }}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0ede8]">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 ui-subtle" />
            <h3 className="ui-group-title">
              {isZh ? "AI 提炼的考点树状体系" : "Topic tree hierarchy"}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExtractTopics}
              disabled={isExtracting}
              className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isExtracting
                  ? isZh
                    ? "正在提炼…"
                    : "Extracting…"
                  : isZh
                    ? "重新提炼考点"
                    : "Re-extract"}
              </span>
            </button>
            <button
              onClick={() => setTextbookDialogOpen(true)}
              disabled={isExtracting}
              className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{isZh ? "按教材目录整理" : "From a textbook"}</span>
            </button>
            <button
              onClick={() => setIsAddingTopic(true)}
              className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px]"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isZh ? "添加大单元" : "Add unit"}</span>
            </button>
          </div>
        </div>

        {isAddingTopic && (
          <div className="ui-card p-4 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="ui-subgroup-title">
                {isZh ? "添加自定义大单元与考点树" : "Add custom unit & topics"}
              </h4>
              <button
                onClick={() => setIsAddingTopic(false)}
                className="p-1 rounded-md text-[#a39e97] hover:text-[#1c1b1a] hover:bg-black/[0.04] transition-colors cursor-pointer"
                aria-label={isZh ? "关闭添加单元" : "Close add unit"}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value)}
                placeholder={isZh ? "大单元名称（如：第 6 单元：红黑树平衡推导）" : "Unit title..."}
                className="sm:col-span-2 rounded-lg px-3 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] placeholder-[#a39e97] outline-none focus:border-[#cfc9c0]"
              />
              <div className="flex items-center gap-1.5">
                <span className="ui-row-meta">{isZh ? "权重" : "Weight"}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(Number(e.target.value))}
                  className="w-16 rounded-lg px-2 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] tabular-nums outline-none focus:border-[#cfc9c0]"
                />
                <span className="ui-row-meta">%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="ui-row-meta">{isZh ? "学时" : "Hours"}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newTopicHours}
                  onChange={(e) => setNewTopicHours(Number(e.target.value))}
                  className="w-16 rounded-lg px-2 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] tabular-nums outline-none focus:border-[#cfc9c0]"
                />
                <span className="ui-row-meta">{isZh ? "小时" : "hrs"}</span>
              </div>
            </div>
            <input
              type="text"
              value={newTopicSubtopics}
              onChange={(e) => setNewTopicSubtopics(e.target.value)}
              placeholder={isZh ? "细分考点列表，逗号分隔（如：插入旋转、删除调整、时间复杂度）" : "Subtopics (comma separated)..."}
              className="w-full rounded-lg px-3 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] placeholder-[#a39e97] outline-none focus:border-[#cfc9c0]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsAddingTopic(false)}
                className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
              >
                {isZh ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAddCustomTopic}
                disabled={!newTopicTitle.trim()}
                className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
              >
                {isZh ? "确认添加" : "Add unit"}
              </button>
            </div>
          </div>
        )}

        {topics.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#ddd8d0] bg-[#faf9f6] px-5 py-8 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 mx-auto text-[#a39e97]" />
            <p className="ui-note max-w-md mx-auto">
              {isZh ? "还没有考点" : "No topics yet"}
            </p>
          </div>
        ) : (
          <HierarchicalTopicTreeView
            topics={topics}
            language={language}
            editable={true}
            subject={plan.subject || plan.preferences?.subject}
            examName={plan.examName}
            planId={plan.id}
            materials={plan.materials}
            focusUnitId={focusUnitId}
            focusSubtopicTitle={focusSubtopicTitle}
            focusNonce={focusNonce}
            onUpdateTopic={(index, updated) => {
              const updatedTopics = [...topics];
              updatedTopics[index] = { ...updatedTopics[index], ...updated };
              onUpdatePlan({ ...plan, topics: updatedTopics, updatedAt: new Date().toISOString() });
            }}
            onDeleteTopic={(topicId) => handleDeleteTopic(topicId)}
          />
        )}
      </section>

      <DocumentReaderModal
        doc={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />

      <TextbookOutlineDialog
        open={textbookDialogOpen}
        onClose={() => setTextbookDialogOpen(false)}
        examName={plan.examName}
        subject={plan.subject || plan.preferences?.subject}
        existingTopicTitles={nonTextbookTitles(topics)}
        onApply={applyTextbookTopics}
      />
    </div>
  );
}
