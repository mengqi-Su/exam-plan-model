import React, { useState, useMemo } from "react";
import { SyllabusTopic, SyllabusSubtopicNode } from "../types";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  Search,
  Check,
  X,
  BookOpen,
  Clock,
  FolderTree,
  Zap,
} from "lucide-react";

interface HierarchicalTopicTreeViewProps {
  topics: SyllabusTopic[];
  language?: "zh" | "en";
  editable?: boolean;
  onUpdateTopic?: (index: number, updatedTopic: Partial<SyllabusTopic>) => void;
  onDeleteTopic?: (topicId: string) => void;
  onAddTopic?: (newTopic: SyllabusTopic) => void;
  onReExtract?: () => void;
  isExtracting?: boolean;
}

export function HierarchicalTopicTreeView({
  topics,
  language = "zh",
  editable = true,
  onUpdateTopic,
  onDeleteTopic,
  onAddTopic,
  onReExtract,
  isExtracting = false,
}: HierarchicalTopicTreeViewProps) {
  const isZh = language === "zh";

  // State for expanded unit cards
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    topics.forEach((t) => {
      initial[t.id] = true; // Default expand all
    });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [addingSubtopicUnitId, setAddingSubtopicUnitId] = useState<string | null>(null);
  const [newSubtopicTitle, setNewSubtopicTitle] = useState("");
  const [newSubtopicPoints, setNewSubtopicPoints] = useState("");
  const [newSubtopicFreq, setNewSubtopicFreq] = useState<"high" | "medium" | "low">("high");
  const [newSubtopicDiff, setNewSubtopicDiff] = useState<"easy" | "medium" | "hard">("medium");

  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicTitle, setEditTopicTitle] = useState("");
  const [editTopicWeight, setEditTopicWeight] = useState(20);
  const [editTopicHours, setEditTopicHours] = useState(4);

  // Total stats
  const totalSubtopicsCount = useMemo(() => {
    return topics.reduce((acc, t) => {
      const count = t.subtopicTree?.length || t.subtopics?.length || 0;
      return acc + count;
    }, 0);
  }, [topics]);

  const totalPointsCount = useMemo(() => {
    return topics.reduce((acc, t) => {
      if (t.subtopicTree && t.subtopicTree.length > 0) {
        return acc + t.subtopicTree.reduce((pAcc, sub) => pAcc + (sub.keyPoints?.length || 1), 0);
      }
      return acc + (t.subtopics?.length || 0);
    }, 0);
  }, [topics]);

  const toggleUnit = (id: string) => {
    setExpandedUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    topics.forEach((t) => {
      next[t.id] = expand;
    });
    setExpandedUnits(next);
  };

  const handleStartEditTopic = (t: SyllabusTopic) => {
    setEditingTopicId(t.id);
    setEditTopicTitle(t.title);
    setEditTopicWeight(t.weightPercentage || 20);
    setEditTopicHours(t.estimatedHours || 4);
  };

  const handleSaveEditTopic = (index: number) => {
    if (!onUpdateTopic || !editTopicTitle.trim()) return;
    onUpdateTopic(index, {
      title: editTopicTitle.trim(),
      weightPercentage: editTopicWeight,
      estimatedHours: editTopicHours,
    });
    setEditingTopicId(null);
  };

  const handleAddSubtopicToUnit = (topicIndex: number, currentTopic: SyllabusTopic) => {
    if (!onUpdateTopic || !newSubtopicTitle.trim()) return;

    const points = newSubtopicPoints
      .split(/[,，、;\n]/)
      .map((p) => p.trim())
      .filter(Boolean);

    const newSubNode: SyllabusSubtopicNode = {
      id: `sub-${Date.now()}`,
      title: newSubtopicTitle.trim(),
      keyPoints: points.length > 0 ? points : [newSubtopicTitle.trim()],
      difficulty: newSubtopicDiff,
      examFrequency: newSubtopicFreq,
    };

    const updatedTree = [...(currentTopic.subtopicTree || [])];
    updatedTree.push(newSubNode);

    const updatedSubtopics = updatedTree.map((s) => s.title);

    onUpdateTopic(topicIndex, {
      subtopicTree: updatedTree,
      subtopics: updatedSubtopics,
    });

    setAddingSubtopicUnitId(null);
    setNewSubtopicTitle("");
    setNewSubtopicPoints("");
  };

  const handleDeleteSubtopic = (topicIndex: number, currentTopic: SyllabusTopic, subIndex: number) => {
    if (!onUpdateTopic) return;

    let updatedTree: SyllabusSubtopicNode[] = [];
    if (currentTopic.subtopicTree && currentTopic.subtopicTree.length > 0) {
      updatedTree = currentTopic.subtopicTree.filter((_, idx) => idx !== subIndex);
    } else if (currentTopic.subtopics) {
      const remainingTitles = currentTopic.subtopics.filter((_, idx) => idx !== subIndex);
      onUpdateTopic(topicIndex, {
        subtopics: remainingTitles,
      });
      return;
    }

    onUpdateTopic(topicIndex, {
      subtopicTree: updatedTree,
      subtopics: updatedTree.map((s) => s.title),
    });
  };

  // Filter topics by search query
  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return topics;
    const q = searchQuery.toLowerCase();
    return topics.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.description?.toLowerCase().includes(q)) return true;
      if (t.subtopics?.some((s) => s.toLowerCase().includes(q))) return true;
      if (
        t.subtopicTree?.some(
          (sub) =>
            sub.title.toLowerCase().includes(q) ||
            sub.keyPoints?.some((kp) => kp.toLowerCase().includes(q)) ||
            sub.formulaOrTrap?.toLowerCase().includes(q)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [topics, searchQuery]);

  const inputCls =
    "rounded-lg bg-white border border-[#e5e2dc] text-[#1c1b1a] placeholder-[#a39e97] outline-none focus:border-[#cfc9c0]";

  return (
    <div className="space-y-4 text-[#1c1b1a]">
      {/* Top Header Controls */}
      <div className="ui-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 ui-subtle" />
          <span className="text-[13px] font-semibold text-[#1c1b1a]">
            {isZh ? "考点知识树架构" : "Knowledge tree"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#a39e97]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isZh ? "搜索考点 / 公式 /概念…" : "Search topics & points..."}
              className={`w-full pl-8 pr-2.5 py-1.5 text-[12.5px] ${inputCls}`}
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => toggleAll(true)}
              className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px]"
              title={isZh ? "展开全部大单元" : "Expand all"}
            >
              {isZh ? "全部展开" : "Expand"}
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px]"
              title={isZh ? "折叠全部大单元" : "Collapse all"}
            >
              {isZh ? "全部折叠" : "Collapse"}
            </button>
          </div>

          {onReExtract && (
            <button
              onClick={onReExtract}
              disabled={isExtracting}
              className="ui-btn ui-btn-primary px-3 py-1.5 text-[12px]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isExtracting
                  ? isZh
                    ? "AI 提炼中…"
                    : "Parsing…"
                  : isZh
                    ? "重新提炼考点树"
                    : "Re-extract tree"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      {filteredTopics.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#ddd8d0] bg-[#faf9f6] p-8 text-center space-y-2">
          <BookOpen className="w-6 h-6 mx-auto text-[#a39e97]" />
          <p className="text-[13px] font-medium text-[#1c1b1a]">
            {isZh ? "暂未匹配到考点或知识树为空" : "No matching topics"}
          </p>
          <p className="ui-muted text-[12.5px] leading-relaxed max-w-md mx-auto">
            {isZh
              ? "上传课程资料后，点击「重新提炼考点树」即可自动提取多层级知识树。"
              : "Upload syllabus materials to auto-extract the full hierarchical topic tree."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic, tIdx) => {
            const isExpanded = expandedUnits[topic.id] ?? true;
            const isEditing = editingTopicId === topic.id;

            const subNodes: SyllabusSubtopicNode[] =
              topic.subtopicTree && topic.subtopicTree.length > 0
                ? topic.subtopicTree
                : (topic.subtopics || []).map((sub, sIdx) => ({
                    id: `sub-${tIdx + 1}-${sIdx + 1}`,
                    title: sub,
                    keyPoints: [],
                    difficulty: topic.difficulty,
                    examFrequency: "high",
                  }));

            const diffBadge =
              topic.difficulty === "hard"
                ? isZh ? "攻坚难点" : "Hard"
                : topic.difficulty === "easy"
                ? isZh ? "基础概念" : "Easy"
                : isZh ? "核心中等" : "Medium";

            return (
              <div key={topic.id || `topic-unit-${tIdx}`} className="ui-card overflow-hidden">
                {/* Root Node: Major Unit Header */}
                <div
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                    isExpanded ? "border-[#f0ede8] bg-[#faf9f6]" : "border-transparent bg-white hover:bg-[#faf9f6]"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleUnit(topic.id)}
                      className="p-1 rounded-md text-[#6b6660] hover:bg-black/[0.05] hover:text-[#1c1b1a] transition-colors cursor-pointer mt-0.5 sm:mt-0 shrink-0"
                      title={isExpanded ? (isZh ? "折叠大单元" : "Collapse") : isZh ? "展开大单元" : "Expand"}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <span className="ui-chip tabular-nums shrink-0">{String(tIdx + 1).padStart(2, "0")}</span>

                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editTopicTitle}
                          onChange={(e) => setEditTopicTitle(e.target.value)}
                          className={`flex-1 min-w-32 px-2.5 py-1 text-[13px] font-medium ${inputCls}`}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] ui-muted">{isZh ? "占比" : "Weight"}</span>
                          <input
                            type="number"
                            value={editTopicWeight}
                            onChange={(e) => setEditTopicWeight(Number(e.target.value))}
                            className={`w-14 px-1.5 py-1 text-center text-[13px] tabular-nums ${inputCls}`}
                          />
                          <span className="text-[12px] ui-muted">%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[12px] ui-muted">{isZh ? "学时" : "Hrs"}</span>
                          <input
                            type="number"
                            value={editTopicHours}
                            onChange={(e) => setEditTopicHours(Number(e.target.value))}
                            className={`w-14 px-1.5 py-1 text-center text-[13px] tabular-nums ${inputCls}`}
                          />
                        </div>
                        <button
                          onClick={() => handleSaveEditTopic(tIdx)}
                          className="p-1.5 rounded-md bg-[#1c1b1a] text-white hover:bg-[#333333] transition-colors cursor-pointer"
                          title={isZh ? "保存" : "Save"}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTopicId(null)}
                          className="p-1.5 rounded-md border border-[#e5e2dc] bg-white text-[#6b6660] hover:bg-[#faf9f6] transition-colors cursor-pointer"
                          title={isZh ? "取消" : "Cancel"}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        <span
                          onClick={() => toggleUnit(topic.id)}
                          className="font-semibold text-[13.5px] text-[#1c1b1a] cursor-pointer hover:underline truncate"
                        >
                          {topic.title}
                        </span>
                        <span className="ui-chip shrink-0">{diffBadge}</span>
                        <span className="ui-chip tabular-nums shrink-0">
                          {isZh ? "占比" : "Weight"} {topic.weightPercentage || 20}%
                        </span>
                        <span className="text-[12px] ui-muted flex items-center gap-1 tabular-nums shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{topic.estimatedHours || 4} {isZh ? "学时" : "hrs"}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {!isEditing && editable && (
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setAddingSubtopicUnitId(addingSubtopicUnitId === topic.id ? null : topic.id);
                          setNewSubtopicTitle("");
                          setNewSubtopicPoints("");
                        }}
                        className="ui-btn ui-btn-ghost px-2.5 py-1.5 text-[12px]"
                        title={isZh ? "向该大单元添加细分考点" : "Add subtopic"}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isZh ? "细分考点" : "Subtopic"}</span>
                      </button>
                      <button
                        onClick={() => handleStartEditTopic(topic)}
                        className="p-1.5 rounded-md border border-[#e5e2dc] bg-white text-[#6b6660] hover:bg-[#faf9f6] hover:text-[#1c1b1a] transition-colors cursor-pointer"
                        title={isZh ? "编辑大单元" : "Edit unit"}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteTopic && (
                        <button
                          onClick={() => onDeleteTopic(topic.id)}
                          className="p-1.5 rounded-md border border-[#e5e2dc] bg-white text-[#6b6660] hover:bg-[#FDF0EE] hover:text-[#B42318] hover:border-[#f0d0cc] transition-colors cursor-pointer"
                          title={isZh ? "删除整个大单元" : "Delete unit"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtopic Tree Branches */}
                {isExpanded && (
                  <div className="p-4 space-y-3 bg-white">
                    {topic.description && (
                      <p className="text-[12.5px] ui-muted leading-relaxed border-l-2 border-[#eae7e1] pl-2.5 my-1">
                        {topic.description}
                      </p>
                    )}

                    {addingSubtopicUnitId === topic.id && (
                      <div className="rounded-lg border border-[#eae7e1] bg-[#faf9f6] p-3 space-y-2.5 animate-fadeIn">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12.5px] font-medium text-[#1c1b1a]">
                            {isZh ? `为「${topic.title}」添加细分考点` : "Add subtopic to this unit"}
                          </span>
                          <button
                            onClick={() => setAddingSubtopicUnitId(null)}
                            className="p-1 rounded-md text-[#a39e97] hover:text-[#1c1b1a] hover:bg-black/[0.04] transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newSubtopicTitle}
                            onChange={(e) => setNewSubtopicTitle(e.target.value)}
                            placeholder={isZh ? "细分考点名称（如：动态规划状态转移方程推导）" : "Subtopic title..."}
                            className={`sm:col-span-2 px-2.5 py-1.5 text-[12.5px] ${inputCls}`}
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={newSubtopicFreq}
                              onChange={(e) => setNewSubtopicFreq(e.target.value as any)}
                              className={`px-2 py-1.5 text-[12px] cursor-pointer flex-1 ${inputCls}`}
                            >
                              <option value="high">{isZh ? "高频考点" : "High freq"}</option>
                              <option value="medium">{isZh ? "常考重点" : "Medium"}</option>
                              <option value="low">{isZh ? "基础概念" : "Low freq"}</option>
                            </select>
                            <select
                              value={newSubtopicDiff}
                              onChange={(e) => setNewSubtopicDiff(e.target.value as any)}
                              className={`px-2 py-1.5 text-[12px] cursor-pointer flex-1 ${inputCls}`}
                            >
                              <option value="easy">{isZh ? "基础" : "Easy"}</option>
                              <option value="medium">{isZh ? "中等" : "Med"}</option>
                              <option value="hard">{isZh ? "难点" : "Hard"}</option>
                            </select>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={newSubtopicPoints}
                          onChange={(e) => setNewSubtopicPoints(e.target.value)}
                          placeholder={
                            isZh
                              ? "细分考查要点 / 关键公式，用逗号分隔（如：无后效性检验、边界初始化、空间压缩）"
                              : "Key points / formulas, comma separated..."
                          }
                          className={`w-full px-2.5 py-1.5 text-[12.5px] ${inputCls}`}
                        />

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setAddingSubtopicUnitId(null)}
                            className="ui-btn ui-btn-ghost px-3 py-1.5 text-[12px]"
                          >
                            {isZh ? "取消" : "Cancel"}
                          </button>
                          <button
                            onClick={() => handleAddSubtopicToUnit(tIdx, topic)}
                            disabled={!newSubtopicTitle.trim()}
                            className="ui-btn ui-btn-primary px-4 py-1.5 text-[12px]"
                          >
                            {isZh ? "保存细分考点" : "Save subtopic"}
                          </button>
                        </div>
                      </div>
                    )}

                    {subNodes.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#ddd8d0] bg-[#faf9f6] p-3 text-center ui-muted text-[12px]">
                        {isZh ? "该单元暂无细分考点，点击上方「细分考点」添加" : "No subtopics in this unit yet"}
                      </div>
                    ) : (
                      <div className="relative pl-4 sm:pl-5 space-y-2.5 border-l border-[#eae7e1] ml-2">
                        {subNodes.map((sub, sIdx) => {
                          const freqText =
                            sub.examFrequency === "high"
                              ? isZh ? "高频" : "High"
                              : sub.examFrequency === "low"
                              ? isZh ? "基础" : "Basic"
                              : isZh ? "核心" : "Core";

                          return (
                            <div
                              key={sub.id || `subnode-${sIdx}`}
                              className="relative flex flex-col p-3 rounded-lg border border-[#eae7e1] bg-white space-y-2 hover:bg-[#faf9f6] transition-colors"
                            >
                              <div className="absolute -left-4 sm:-left-5 top-4 w-4 sm:w-5 h-px bg-[#eae7e1]" />

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="ui-chip tabular-nums shrink-0">
                                    {tIdx + 1}.{sIdx + 1}
                                  </span>
                                  <span className="font-medium text-[13px] text-[#1c1b1a] truncate">
                                    {sub.title}
                                  </span>
                                  <span className="ui-chip shrink-0">{freqText}</span>
                                </div>

                                {editable && (
                                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                                    <button
                                      onClick={() => handleDeleteSubtopic(tIdx, topic, sIdx)}
                                      className="p-1.5 rounded-md text-[#a39e97] hover:bg-[#FDF0EE] hover:text-[#B42318] transition-colors cursor-pointer"
                                      title={isZh ? "删除此细分考点" : "Delete subtopic"}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {sub.formulaOrTrap && (
                                <div className="flex items-start gap-1.5 text-[11.5px] text-[#8A5A00] bg-[#FFF6DD] rounded-lg p-2 border border-[#f0e2c0]">
                                  <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                  <span className="font-medium">
                                    {isZh ? "避坑 / 核心公式：" : "Formula / trap: "}
                                  </span>
                                  <span className="flex-1">{sub.formulaOrTrap}</span>
                                </div>
                              )}

                              {sub.keyPoints && sub.keyPoints.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {sub.keyPoints.map((point, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="inline-flex items-center rounded-full bg-[#f1efe9] px-2.5 py-0.5 text-[11px] text-[#6b6660]"
                                    >
                                      {point}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}