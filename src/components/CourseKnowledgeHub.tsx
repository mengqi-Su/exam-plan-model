import React, { useState } from "react";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { SyllabusTopic, StudyMaterial, ExamStudyPlan } from "../types";
import { useI18n } from "../lib/i18n";
import { prepareMaterialsForAI, runGeneration } from "../lib/aiClient";
import { TabbedFolderArchive } from "./TabbedFolderArchive";
import { UploadModal } from "./UploadModal";
import { NoteModal } from "./NoteModal";
import { DocumentReaderModal } from "./DocumentReaderModal";
import { HierarchicalTopicTreeView } from "./HierarchicalTopicTreeView";

interface CourseKnowledgeHubProps {
  plan: ExamStudyPlan;
  onUpdatePlan: (updatedPlan: ExamStudyPlan) => void;
  onDeleteCourse?: () => void;
  onRequestDeleteCourse?: (plan?: ExamStudyPlan | null) => void;
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
  focusUnitId = null,
  focusSubtopicTitle = "",
  focusNonce = 0,
}: CourseKnowledgeHubProps) {
  const { language } = useI18n();

  const [extractError, setExtractError] = useState<string | null>(null);

  const [showPasteBox, setShowPasteBox] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  const [activeFolderDocType, setActiveFolderDocType] = useState<StudyMaterial["type"]>("notes");

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionSuccess, setExtractionSuccess] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicWeight, setNewTopicWeight] = useState(15);
  const [newTopicHours, setNewTopicHours] = useState(4);
  const [newTopicSubtopics, setNewTopicSubtopics] = useState("");

  const [previewDoc, setPreviewDoc] = useState<StudyMaterial | null>(null);

  const materials: StudyMaterial[] = plan.materials || [];
  const topics: SyllabusTopic[] = plan.topics || [];

  const updatePlanMaterials = (newMaterials: StudyMaterial[]) => {
    onUpdatePlan({
      ...plan,
      materials: newMaterials,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteDoc = (docId: string) => {
    const updated = materials.filter((m) => m.id !== docId);
    updatePlanMaterials(updated);
  };

  const handleExtractTopics = async () => {
    if (materials.length === 0) {
      setExtractError(
        language === "zh"
          ? "请先在上方知识库中上传课程资料或粘贴笔记，AI 将为您提炼考点架构。"
          : "Upload course materials or paste notes above first so AI can extract the topic blueprint."
      );
      return;
    }

    setIsExtracting(true);
    setExtractError(null);
    setExtractionSuccess(false);

    try {
      const { result } = await runGeneration<{ summary?: string; topics?: SyllabusTopic[] }>(
        "syllabus",
        {
          materials: prepareMaterialsForAI(materials),
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
        topics: result.topics,
        materialsSummary: result.summary || plan.materialsSummary,
        updatedAt: new Date().toISOString(),
      });
      setExtractionSuccess(true);
      window.setTimeout(() => setExtractionSuccess(false), 4000);
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
      {extractionSuccess && (
        <div className="flex items-center gap-2 rounded-xl border border-[#d8e4dc] bg-[#EEF4EF] px-3.5 py-3 text-[12.5px] font-medium text-[#3F6B4F] animate-fadeIn">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{isZh ? "AI 考点架构已根据知识库资料更新完毕。" : "Topic blueprint extracted successfully."}</span>
        </div>
      )}

      {extractError && (
        <div className="flex items-start gap-2 rounded-xl border border-[#f0d0cc] bg-[#FDF0EE] px-3.5 py-3 text-[12.5px] text-[#B42318]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{extractError}</span>
        </div>
      )}

      <section className="space-y-4">
        {/* 1. Main Knowledge Base Archive View */}
        <div className="pt-1">
          <TabbedFolderArchive
            materials={materials}
            onPreviewDoc={(doc) => setPreviewDoc(doc)}
            onDeleteDoc={(docId) => handleDeleteDoc(docId)}
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
            updatePlanMaterials([...newAttachedMaterials, ...materials]);
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
            updatePlanMaterials([newDoc, ...materials]);
          }}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#f0ede8]">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 ui-subtle" />
            <h3 className="text-[14px] font-semibold text-[#1c1b1a]">
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
              <h4 className="text-[13px] font-semibold text-[#1c1b1a]">
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
                <span className="text-[12px] ui-muted">{isZh ? "权重" : "Weight"}</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newTopicWeight}
                  onChange={(e) => setNewTopicWeight(Number(e.target.value))}
                  className="w-16 rounded-lg px-2 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] tabular-nums outline-none focus:border-[#cfc9c0]"
                />
                <span className="text-[12px] ui-muted">%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] ui-muted">{isZh ? "学时" : "Hours"}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newTopicHours}
                  onChange={(e) => setNewTopicHours(Number(e.target.value))}
                  className="w-16 rounded-lg px-2 py-1.5 bg-white border border-[#e5e2dc] text-[13px] text-[#1c1b1a] tabular-nums outline-none focus:border-[#cfc9c0]"
                />
                <span className="text-[12px] ui-muted">{isZh ? "小时" : "hrs"}</span>
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
            <p className="text-[12.5px] ui-muted leading-relaxed max-w-md mx-auto">
              {isZh
                ? "还没有考点。上传资料后点击「重新提炼考点」，或手动添加一个大单元。"
                : "No topics yet. Upload materials and click Re-extract, or add a unit manually."}
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
            focusUnitId={focusUnitId}
            focusSubtopicTitle={focusSubtopicTitle}
            focusNonce={focusNonce}
            onUpdateTopic={(index, updated) => {
              const updatedTopics = [...topics];
              updatedTopics[index] = { ...updatedTopics[index], ...updated };
              onUpdatePlan({ ...plan, topics: updatedTopics, updatedAt: new Date().toISOString() });
            }}
            onDeleteTopic={(topicId) => handleDeleteTopic(topicId)}
            onReExtract={handleExtractTopics}
            isExtracting={isExtracting}
          />
        )}
      </section>

      <DocumentReaderModal
        doc={previewDoc}
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
