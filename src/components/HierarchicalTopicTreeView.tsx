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
  AlertTriangle,
  BookOpen,
  Clock,
  Layers,
  FolderTree,
  FileCode,
  Tag,
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

  return (
    <div className="space-y-4 font-mono text-xs text-[#111111]">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-[#111111]">
        <div className="flex items-center space-x-1.5 font-bold uppercase">
          <FolderTree className="w-4 h-4 text-[#111111]" />
          <span>[{language === "zh" ? "考点知识树架构" : "KNOWLEDGE TREE HIERARCHY"}]</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#888888]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "zh" ? "搜索考点 / 公式 / 概念..." : "Search topics & points..."}
              className="w-full pl-8 pr-2.5 py-1 bg-white border border-[#111111] text-xs outline-none font-mono"
            />
          </div>

          {/* Expand / Collapse All */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => toggleAll(true)}
              className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-[11px] font-bold cursor-pointer"
              title={language === "zh" ? "展开全部大单元" : "Expand All"}
            >
              [{language === "zh" ? "全部展开" : "EXPAND"}]
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="px-2 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-[11px] font-bold cursor-pointer"
              title={language === "zh" ? "折叠全部大单元" : "Collapse All"}
            >
              [{language === "zh" ? "全部折叠" : "COLLAPSE"}]
            </button>
          </div>

          {onReExtract && (
            <button
              onClick={onReExtract}
              disabled={isExtracting}
              className="flex items-center space-x-1 px-3 py-1 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white font-bold cursor-pointer border border-[#111111]"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                [{isExtracting ? (language === "zh" ? "AI 提炼中..." : "PARSING...") : (language === "zh" ? "重新提炼考点树" : "RE-EXTRACT TREE")}]
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Tree Content */}
      {filteredTopics.length === 0 ? (
        <div className="p-8 text-center bg-white border border-dashed border-[#111111] space-y-2">
          <BookOpen className="w-6 h-6 mx-auto text-[#888888]" />
          <p className="font-bold uppercase text-xs text-[#111111]">
            [{language === "zh" ? "暂未匹配到考点或知识树为空" : "NO MATCHING TOPICS IN TREE"}]
          </p>
          <p className="text-[#666666] text-[11px]">
            {language === "zh"
              ? "上传课程资料后，点击「AI 联合提炼考点」即可自动提取多层级知识树。"
              : "Upload syllabus materials to auto-extract the full hierarchical topic tree."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTopics.map((topic, tIdx) => {
            const isExpanded = expandedUnits[topic.id] ?? true;
            const isEditing = editingTopicId === topic.id;

            // Generate subnodes if not explicitly present
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
                ? language === "zh" ? "攻坚难点" : "HARD"
                : topic.difficulty === "easy"
                ? language === "zh" ? "基础概念" : "EASY"
                : language === "zh" ? "核心中等" : "MEDIUM";

            return (
              <div
                key={topic.id || `topic-unit-${tIdx}`}
                className="bg-white border border-[#111111] shadow-xs transition-all"
              >
                {/* 1. Root Node: Major Unit Header */}
                <div
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b ${
                    isExpanded ? "border-[#111111] bg-[#fafafa]" : "border-transparent bg-white hover:bg-[#fcfcfc]"
                  }`}
                >
                  <div className="flex items-start sm:items-center space-x-2.5 flex-1 min-w-0">
                    <button
                      onClick={() => toggleUnit(topic.id)}
                      className="p-1 hover:bg-[#ededed] border border-[#111111] bg-white cursor-pointer mt-0.5 sm:mt-0"
                      title={isExpanded ? (language === "zh" ? "折叠大单元" : "Collapse") : (language === "zh" ? "展开大单元" : "Expand")}
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    <span className="px-2 py-0.5 bg-[#111111] text-white text-[10px] font-bold uppercase shrink-0">
                      UNIT 0{tIdx + 1}
                    </span>

                    {isEditing ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editTopicTitle}
                          onChange={(e) => setEditTopicTitle(e.target.value)}
                          className="flex-1 px-2 py-0.5 bg-white border border-[#111111] font-bold text-xs outline-none"
                        />
                        <div className="flex items-center space-x-1">
                          <span className="text-[11px] text-[#666666]">{language === "zh" ? "占比" : "Weight"}:</span>
                          <input
                            type="number"
                            value={editTopicWeight}
                            onChange={(e) => setEditTopicWeight(Number(e.target.value))}
                            className="w-12 px-1 py-0.5 bg-white border border-[#111111] text-center font-bold text-xs"
                          />
                          <span>%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="text-[11px] text-[#666666]">{language === "zh" ? "学时" : "Hrs"}:</span>
                          <input
                            type="number"
                            value={editTopicHours}
                            onChange={(e) => setEditTopicHours(Number(e.target.value))}
                            className="w-12 px-1 py-0.5 bg-white border border-[#111111] text-center font-bold text-xs"
                          />
                        </div>
                        <button
                          onClick={() => handleSaveEditTopic(tIdx)}
                          className="p-1 bg-[#111111] text-white border border-[#111111] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingTopicId(null)}
                          className="p-1 bg-white border border-[#111111] hover:bg-[#ededed] cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                        <span
                          onClick={() => toggleUnit(topic.id)}
                          className="font-bold text-xs text-[#111111] cursor-pointer hover:underline truncate"
                        >
                          {topic.title}
                        </span>

                        <span className="px-1.5 py-0.2 bg-white border border-[#111111] text-[10px] uppercase font-bold text-[#111111]">
                          [{diffBadge}]
                        </span>

                        <span className="px-1.5 py-0.2 bg-[#111111] text-white text-[10px] font-bold">
                          {language === "zh" ? "占比" : "WEIGHT"}: {topic.weightPercentage || 20}%
                        </span>

                        <span className="text-[11px] text-[#666666] flex items-center space-x-1 font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{topic.estimatedHours || 4} {language === "zh" ? "学时" : "HRS"}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Action buttons */}
                  {!isEditing && editable && (
                    <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => {
                          setAddingSubtopicUnitId(addingSubtopicUnitId === topic.id ? null : topic.id);
                          setNewSubtopicTitle("");
                          setNewSubtopicPoints("");
                        }}
                        className="flex items-center space-x-1 px-2 py-1 bg-white border border-[#111111] hover:bg-[#111111] hover:text-white text-[11px] font-bold transition-colors cursor-pointer"
                        title={language === "zh" ? "向该大单元添加细分考点" : "Add fine-grained subtopic"}
                      >
                        <Plus className="w-3 h-3" />
                        <span>[{language === "zh" ? "+ 细分考点" : "+ SUBTOPIC"}]</span>
                      </button>

                      <button
                        onClick={() => handleStartEditTopic(topic)}
                        className="p-1 border border-[#111111] bg-white hover:bg-[#ededed] cursor-pointer"
                        title={language === "zh" ? "编辑大单元" : "Edit unit"}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {onDeleteTopic && (
                        <button
                          onClick={() => onDeleteTopic(topic.id)}
                          className="p-1 border border-[#111111] bg-white hover:bg-[#111111] hover:text-white cursor-pointer transition-colors"
                          title={language === "zh" ? "删除整个大单元" : "Delete unit"}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. Subtopic Tree Branches (Collapsible) */}
                {isExpanded && (
                  <div className="p-4 space-y-3 bg-[#fdfdfd]">
                    {topic.description && (
                      <p className="text-[11px] text-[#666666] leading-relaxed italic border-l-2 border-[#111111] pl-2.5 my-1">
                        {topic.description}
                      </p>
                    )}

                    {/* Inline Add Subtopic Panel */}
                    {addingSubtopicUnitId === topic.id && (
                      <div className="p-3 bg-white border border-[#111111] space-y-2.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px] uppercase">
                            [{language === "zh" ? `为「${topic.title}」添加细分考点` : `ADD SUBTOPIC TO UNIT 0${tIdx + 1}`}]
                          </span>
                          <button
                            onClick={() => setAddingSubtopicUnitId(null)}
                            className="text-[#666666] hover:text-[#111111] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newSubtopicTitle}
                            onChange={(e) => setNewSubtopicTitle(e.target.value)}
                            placeholder={language === "zh" ? "细分考点名称（如：动态规划状态转移方程推导）" : "Subtopic title..."}
                            className="sm:col-span-2 px-2.5 py-1 bg-white border border-[#111111] text-xs outline-none"
                          />
                          <div className="flex items-center space-x-2">
                            <select
                              value={newSubtopicFreq}
                              onChange={(e) => setNewSubtopicFreq(e.target.value as any)}
                              className="px-2 py-1 bg-white border border-[#111111] text-[11px] font-bold outline-none cursor-pointer flex-1"
                            >
                              <option value="high">{language === "zh" ? "[高频考点]" : "[High Freq]"}</option>
                              <option value="medium">{language === "zh" ? "[常考重点]" : "[Medium]"}</option>
                              <option value="low">{language === "zh" ? "[基础概念]" : "[Low Freq]"}</option>
                            </select>
                            <select
                              value={newSubtopicDiff}
                              onChange={(e) => setNewSubtopicDiff(e.target.value as any)}
                              className="px-2 py-1 bg-white border border-[#111111] text-[11px] font-bold outline-none cursor-pointer flex-1"
                            >
                              <option value="easy">{language === "zh" ? "[基础]" : "[Easy]"}</option>
                              <option value="medium">{language === "zh" ? "[中等]" : "[Med]"}</option>
                              <option value="hard">{language === "zh" ? "[难点]" : "[Hard]"}</option>
                            </select>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={newSubtopicPoints}
                          onChange={(e) => setNewSubtopicPoints(e.target.value)}
                          placeholder={
                            language === "zh"
                              ? "细分考查要点/关键公式，用逗号分隔（如：无后效性检验、边界初始化、空间压缩）"
                              : "Key points / formulas, comma separated..."
                          }
                          className="w-full px-2.5 py-1 bg-white border border-[#111111] text-xs outline-none"
                        />

                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            onClick={() => setAddingSubtopicUnitId(null)}
                            className="px-3 py-1 bg-white border border-[#111111] hover:bg-[#ededed] text-xs font-bold cursor-pointer"
                          >
                            [{language === "zh" ? "取消" : "CANCEL"}]
                          </button>
                          <button
                            onClick={() => handleAddSubtopicToUnit(tIdx, topic)}
                            disabled={!newSubtopicTitle.trim()}
                            className="px-4 py-1 bg-[#111111] hover:bg-[#333333] disabled:opacity-50 text-white text-xs font-bold border border-[#111111] cursor-pointer"
                          >
                            [{language === "zh" ? "保存细分考点" : "SAVE SUBTOPIC"}]
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Subtopics List as Visual Tree */}
                    {subNodes.length === 0 ? (
                      <div className="p-3 text-center border border-dashed border-[#111111]/30 bg-white text-[#666666] text-[11px]">
                        [{language === "zh" ? "该单元暂无细分考点，点击上方「+ 细分考点」添加" : "No subtopics in this unit yet"}]
                      </div>
                    ) : (
                      <div className="relative pl-3 sm:pl-5 space-y-2.5 border-l-2 border-[#111111]/40 ml-2">
                        {subNodes.map((sub, sIdx) => {
                          const isLast = sIdx === subNodes.length - 1;
                          const freqText =
                            sub.examFrequency === "high"
                              ? (language === "zh" ? "★ 高频考点" : "HIGH")
                              : sub.examFrequency === "low"
                              ? (language === "zh" ? "基础要点" : "BASIC")
                              : (language === "zh" ? "核心考查" : "CORE");

                          return (
                            <div
                              key={sub.id || `subnode-${sIdx}`}
                              className="relative flex flex-col p-3 bg-white border border-[#111111] space-y-2 hover:bg-[#fafafa] transition-colors"
                            >
                              {/* Visual Tree Branch Line */}
                              <div className="absolute -left-3 sm:-left-5 top-4 w-3 sm:w-5 h-0.5 bg-[#111111]/40" />

                              {/* Subtopic Header */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                  <span className="px-1.5 py-0.5 bg-[#111111] text-white text-[10px] font-bold font-mono shrink-0">
                                    {tIdx + 1}.{sIdx + 1}
                                  </span>
                                  <span className="font-bold text-xs text-[#111111] truncate">
                                    {sub.title}
                                  </span>
                                  <span className="px-1.5 py-0.2 bg-white border border-[#111111] text-[9px] font-bold text-[#111111] uppercase shrink-0">
                                    [{freqText}]
                                  </span>
                                </div>

                                {editable && (
                                  <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
                                    <button
                                      onClick={() => handleDeleteSubtopic(tIdx, topic, sIdx)}
                                      className="p-1 text-[#111111] hover:bg-[#111111] hover:text-white transition-colors cursor-pointer border border-[#111111] bg-white"
                                      title={language === "zh" ? "删除此细分考点" : "Delete subtopic"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Formula or Trap Note */}
                              {sub.formulaOrTrap && (
                                <div className="flex items-start space-x-1.5 text-[10px] text-[#333333] bg-[#f5f5f5] p-1.5 border border-[#111111]">
                                  <Zap className="w-3 h-3 text-[#111111] shrink-0 mt-0.5" />
                                  <span className="font-bold">
                                    {language === "zh" ? "考点避坑 / 核心公式：" : "Key Formula / Trap: "}
                                  </span>
                                  <span className="flex-1">{sub.formulaOrTrap}</span>
                                </div>
                              )}

                              {/* Granular Leaf Points */}
                              {sub.keyPoints && sub.keyPoints.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {sub.keyPoints.map((point, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="flex items-center space-x-1 px-2 py-0.5 bg-[#ffffff] border border-[#111111] text-[10px] text-[#111111] font-bold shadow-2xs"
                                    >
                                      <span className="opacity-60">↳</span>
                                      <span>{point}</span>
                                    </div>
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
