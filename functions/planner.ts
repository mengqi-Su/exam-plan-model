// 规划核心逻辑（纯 TypeScript，无 Deno / Node 专有 API）。
// 从原 Express 服务端移植：输入校验、资料分块检索、提示词构建、结果归一化。
// 之所以独立成纯函数模块，是为了能在没有 Deno 的本机用 tsx 做无凭据 fixture 校验。

export const MAX_MATERIALS = 24;
export const MAX_MATERIAL_CHARS = 120_000;
export const MAX_FILE_NAME_LENGTH = 200;
export const MAX_TASKS_PER_PLAN = 600;

export class PlannerError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'PlannerError';
    this.status = status;
    this.code = code;
  }
}

export function clampText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/* 说给人听的英文计数只管单复数，规矩和前端 text.pl() 一样：写 "1 file" / "3 files"，
   不写没人肯念的 "file(s)"。函数是独立的 Deno 模块，import 不到 src/ 那一边，
   所以这里留一份同规矩的实现，而不是第三种写法。 */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function isChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text || '');
}

export function resolveIsChinese(language: unknown, ...texts: Array<string | undefined>): boolean {
  if (language === 'zh') return true;
  if (language === 'en') return false;
  return texts.some((text) => isChinese(text || ''));
}

export function toLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = (dateString || '').split('-').map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(year, month - 1, day);
}

export function addDaysToDateString(dateString: string, days: number): string {
  const date = parseLocalDate(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

export function daysBetweenDateStrings(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export interface ClientMaterial {
  id: string;
  name: string;
  type: string;
  content: string;
}

export function sanitizeMaterials(
  raw: unknown,
  maxDocs = MAX_MATERIALS,
  maxChars = MAX_MATERIAL_CHARS
): ClientMaterial[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > maxDocs) {
    throw new PlannerError(`一次生成最多用 ${maxDocs} 份资料，请取消勾选一部分。`, 413, 'TOO_MANY_MATERIALS');
  }
  return raw
    .map((material: any, index: number) => ({
      id: clampText(material?.id, 120) || `material-${index + 1}`,
      name: clampText(material?.name, MAX_FILE_NAME_LENGTH) || `Document ${index + 1}`,
      type: clampText(material?.type, 40) || 'notes',
      content: clampText(material?.content, maxChars),
    }))
    .filter((material) => material.content.length > 0);
}

export function sanitizeTopics(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).map((topic: any, index: number) => ({
    id: clampText(topic?.id, 120) || `topic-${index + 1}`,
    title: clampText(topic?.title, 300) || `Topic ${index + 1}`,
    category: clampText(topic?.category, 120),
    description: clampText(topic?.description, 2_000),
    // 来源只有三种：资料提炼（默认，不写）、教材目录回忆、用户手加。
    // 留着它，界面上才分得清哪几条是 AI 凭教材名回忆的，可以放心删。
    source: ['material', 'textbook', 'manual'].includes(topic?.source) ? topic.source : undefined,
    weightPercentage: Number(topic?.weightPercentage) || 0,
    difficulty: clampText(topic?.difficulty, 20) || 'medium',
    userKnowledgeLevel: clampText(topic?.userKnowledgeLevel, 20) || 'intermediate',
    subtopics: Array.isArray(topic?.subtopics)
      ? topic.subtopics.slice(0, 30).map((item: unknown) => clampText(item, 300)).filter(Boolean)
      : [],
    subtopicTree: Array.isArray(topic?.subtopicTree)
      ? topic.subtopicTree.slice(0, 30).map((node: any, nodeIndex: number) => ({
          id: clampText(node?.id, 120) || `sub-${index + 1}-${nodeIndex + 1}`,
          title: clampText(node?.title, 300),
          keyPoints: Array.isArray(node?.keyPoints)
            ? node.keyPoints.slice(0, 10).map((item: unknown) => clampText(item, 500)).filter(Boolean)
            : [],
          difficulty: clampText(node?.difficulty, 20) || 'medium',
          examFrequency: clampText(node?.examFrequency, 20) || 'medium',
          formulaOrTrap: clampText(node?.formulaOrTrap, 1_000),
        }))
      : undefined,
    estimatedHours: Number(topic?.estimatedHours) || 0,
  }));
}

/**
 * 用户说「这天学几小时」是排程的硬输入，先归一化再往下走。
 * 不做这一步的话，一个 availableHours 传成字符串或超界数字，整天的预算就废了——
 * 表现就是「时间能改但计划不认」。范围与前端 src/lib/dailyHours.ts 保持一致。
 */
const MAX_DAILY_HOURS = 12;

export function normalizeDailySchedules(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  const byDay = new Map<number, any>();
  for (const entry of raw.slice(0, 7)) {
    const dayOfWeek = Number(entry?.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
    const hours = Number(entry?.availableHours);
    const availableHours = Number.isFinite(hours) && hours > 0
      ? Math.min(MAX_DAILY_HOURS, Math.round(hours * 2) / 2)
      : 0;
    const slot = String(entry?.preferredTimeSlot || '');
    byDay.set(dayOfWeek, {
      dayOfWeek,
      dayName: clampText(entry?.dayName, 20),
      availableHours,
      // 时段种类和 dayStartClock 用同一份表，别在这儿再列一遍
      preferredTimeSlot: TIME_SLOT_CLOCKS[slot] ? slot : 'flexible',
      // 老数据里没有 enabled 字段的按「照常学」处理，别把用户的学习日凭空变成休息
      enabled: entry?.enabled !== false,
    });
  }
  return [...byDay.values()];
}

export function sanitizePreferences(raw: any): any {
  const startDate = clampText(raw?.startDate, 20);
  const examDate = clampText(raw?.examDate, 20);
  if (!startDate || Number.isNaN(parseLocalDate(startDate).getTime())) {
    throw new PlannerError('开始日期无效，请重新选择。', 400, 'INVALID_START_DATE');
  }
  if (!examDate || Number.isNaN(parseLocalDate(examDate).getTime())) {
    throw new PlannerError('考试日期无效，请重新选择。', 400, 'INVALID_EXAM_DATE');
  }
  if (daysBetweenDateStrings(startDate, examDate) < 0) {
    throw new PlannerError('考试日期不能早于开始复习日期。', 400, 'INVALID_DATE_RANGE');
  }
  return {
    examName: clampText(raw?.examName, 200),
    subject: clampText(raw?.subject, 200),
    startDate,
    examDate,
    examTime: clampText(raw?.examTime, 10) || '09:00',
    targetScoreOrGrade: clampText(raw?.targetScoreOrGrade, 200),
    userNeedFocusArea: clampText(raw?.userNeedFocusArea, 120),
    customPromptRequirement: clampText(raw?.customPromptRequirement, 2_000),
    additionalNotes: clampText(raw?.additionalNotes, 2_000),
    weakTopicsFocus: Array.isArray(raw?.weakTopicsFocus)
      ? raw.weakTopicsFocus.slice(0, 30).map((item: unknown) => clampText(item, 300)).filter(Boolean)
      : [],
    dailySchedules: normalizeDailySchedules(raw?.dailySchedules),
    studyPace: clampText(raw?.studyPace, 40) || 'balanced',
    sessionLengthMinutes: Math.min(240, Math.max(10, Number(raw?.sessionLengthMinutes) || 45)),
    includePracticeExams: Boolean(raw?.includePracticeExams),
    includeBufferDays: Boolean(raw?.includeBufferDays),
    bufferDaysCount: Math.min(14, Math.max(0, Number(raw?.bufferDaysCount) || 0)),
    language: raw?.language === 'en' ? 'en' : raw?.language === 'zh' ? 'zh' : undefined,
  };
}

export function sanitizePlanForRebalance(currentPlan: any): any {
  if (!currentPlan || typeof currentPlan !== 'object') {
    throw new PlannerError('没有收到要重排的计划，请刷新后重试。', 400, 'MISSING_PLAN');
  }
  if (!Array.isArray(currentPlan.tasks)) {
    throw new PlannerError('这个科目的任务列表读不出来，请刷新后重试。', 400, 'MISSING_TASKS');
  }
  if (currentPlan.tasks.length > MAX_TASKS_PER_PLAN) {
    throw new PlannerError('这个科目的任务超过重排上限，请缩短复习区间后重新生成计划。', 413, 'TOO_MANY_TASKS');
  }
  return {
    ...currentPlan,
    examName: clampText(currentPlan.examName, 200),
    subject: clampText(currentPlan.subject, 200),
    examDate: clampText(currentPlan.examDate, 20),
    // 重排读的是存下来的偏好；每日小时同样过一遍归一化，新建和重排才是同一套时间口径
    preferences: currentPlan.preferences && typeof currentPlan.preferences === 'object'
      ? { ...currentPlan.preferences, dailySchedules: normalizeDailySchedules(currentPlan.preferences.dailySchedules) }
      : currentPlan.preferences,
    tasks: currentPlan.tasks.map((task: any) => ({
      ...task,
      id: clampText(task?.id, 120),
      title: clampText(task?.title, 300),
      description: clampText(task?.description, 2_000),
      category: clampText(task?.category, 40),
      topicTitle: clampText(task?.topicTitle, 300),
      date: clampText(task?.date, 20),
      startTime: clampText(task?.startTime, 10),
      endTime: clampText(task?.endTime, 10),
      priority: clampText(task?.priority, 20),
      status: clampText(task?.status, 20),
      keyObjectives: Array.isArray(task?.keyObjectives)
        ? task.keyObjectives.slice(0, 10).map((item: unknown) => clampText(item, 300))
        : [],
      activeRecallPrompt: clampText(task?.activeRecallPrompt, 1_000),
      notes: clampText(task?.notes, 2_000),
    })),
  };
}

/* ---------------- 资料分块与检索（RAG 接地，纯本地计算） ---------------- */

export interface DocumentChunk {
  id: string;
  materialId: string;
  materialName: string;
  materialType: string;
  sectionTitle: string;
  content: string;
  keywords: string[];
  isExamQuestion: boolean;
  isFormulaOrTheorem: boolean;
  estimatedDifficulty: 'easy' | 'medium' | 'hard';
  tokenEstimate: number;
}

export function chunkDocumentText(
  materialId: string,
  materialName: string,
  materialType: string,
  text: string
): DocumentChunk[] {
  if (!text || text.trim().length === 0) return [];
  const cleanText = text.replace(/\r\n/g, '\n').trim();
  const paragraphBlocks = cleanText.split(/\n{2,}/);
  const chunks: DocumentChunk[] = [];

  let currentSectionTitle = materialName.replace(/\.[^/.]+$/, '');
  let accumulatedText = '';
  let chunkIdx = 1;

  const commitChunk = (body: string, heading: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 20) return;

    const isExamQuestion =
      materialType === 'past_exam' ||
      /(?:第[一二三四五六七八九\d]+题|\b(q\d+|question\d+|problem\d+|ex\d+|\d+[\.、]))/i.test(trimmed) ||
      /(?:选择题|填空题|计算题|简答题|综合题|证明题|问答题)/.test(trimmed);

    const isFormulaOrTheorem =
      /(?:公式|定理|推论|引理|def|theorem|lemma|formula|equation|f\(x\)|∑|∫|lim|log|sin|cos|matrix|\b(o\(n\)|tcp|udp|ip)\b)/i.test(trimmed);

    const keywords: string[] = [];
    const engWords = (trimmed.match(/[A-Za-z]{3,}/g) || []).slice(0, 8);
    keywords.push(...Array.from(new Set(engWords)));

    const zhTerms = (
      trimmed.match(/[\u4e00-\u9fa5]{2,6}(?:定理|公式|算法|机制|协议|模型|结构|函数|方程|分析|计算|证明|原理|概念|设计)/g) || []
    ).slice(0, 8);
    keywords.push(...Array.from(new Set(zhTerms)));

    let diff: 'easy' | 'medium' | 'hard' = 'medium';
    if (/(?:证明|高阶|综合|推导|难点|复杂|NP|级数|最值|优化)/.test(trimmed) || isExamQuestion) {
      diff = 'hard';
    } else if (/(?:简介|概述|基本概念|定义|常识|首日)/.test(trimmed)) {
      diff = 'easy';
    }

    chunks.push({
      id: `chunk-${materialId}-${chunkIdx++}`,
      materialId,
      materialName,
      materialType,
      sectionTitle: heading,
      content: trimmed,
      keywords: Array.from(new Set(keywords)).slice(0, 8),
      isExamQuestion,
      isFormulaOrTheorem,
      estimatedDifficulty: diff,
      tokenEstimate: Math.ceil(trimmed.length / 3),
    });
  };

  for (const block of paragraphBlocks) {
    const trimmedBlock = block.trim();
    if (!trimmedBlock) continue;

    const firstLine = trimmedBlock.split('\n')[0].trim();
    const isHeading =
      firstLine.length < 60 &&
      /(?:^#+|^第[一二三四五六七八九\d]+[章节讲单元部分]|^[0-9]+[\.、]|^[A-Z\s]{4,}|^Unit\s*\d+|^Chapter\s*\d+|^Section\s*\d+|^Topic)/i.test(firstLine);

    if (isHeading) {
      if (accumulatedText.length > 50) {
        commitChunk(accumulatedText, currentSectionTitle);
        accumulatedText = '';
      }
      currentSectionTitle = firstLine.replace(/^[#*\-•\d\.\s]+/, '').trim() || currentSectionTitle;
    }

    accumulatedText += (accumulatedText ? '\n\n' : '') + trimmedBlock;

    if (accumulatedText.length >= 800) {
      commitChunk(accumulatedText, currentSectionTitle);
      accumulatedText = '';
    }
  }

  if (accumulatedText.trim().length > 0) {
    commitChunk(accumulatedText, currentSectionTitle);
  }
  if (chunks.length === 0 && cleanText.length > 0) {
    commitChunk(cleanText.slice(0, 1000), materialName);
  }
  return chunks;
}

export function chunkAllMaterials(materials: any[]): DocumentChunk[] {
  if (!Array.isArray(materials) || materials.length === 0) return [];
  const allChunks: DocumentChunk[] = [];
  materials.forEach((m, idx) => {
    const text = m.content || m.summaryNotes || '';
    const chunks = chunkDocumentText(m.id || `mat-${idx}`, m.name || `doc-${idx}`, m.type || 'notes', text);
    allChunks.push(...chunks);
  });
  return allChunks;
}

export function retrieveTopChunksForQuery(
  query: string,
  chunks: DocumentChunk[],
  options: { topK?: number; preferQuestions?: boolean; preferFormulas?: boolean } = {}
): DocumentChunk[] {
  if (!chunks || chunks.length === 0) return [];
  const topK = options.topK || 4;
  const lowerQuery = (query || '').toLowerCase();
  const queryTokens = lowerQuery.split(/[\s,，、。；;：:!！?？\-_/\\()\[\]]+/).filter((t) => t.length >= 2);

  const scored: { chunk: DocumentChunk; score: number }[] = [];
  for (const chunk of chunks) {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerHeading = chunk.sectionTitle.toLowerCase();
    for (const tok of queryTokens) {
      if (lowerHeading.includes(tok)) score += 25;
      if (lowerContent.includes(tok)) score += 8;
    }
    for (const kw of chunk.keywords) {
      if (lowerQuery.includes(kw.toLowerCase())) score += 15;
    }
    if (options.preferQuestions && chunk.isExamQuestion) score += 20;
    if (options.preferFormulas && chunk.isFormulaOrTheorem) score += 18;
    if (score > 0 || chunks.length <= topK) scored.push({ chunk, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).map((s) => s.chunk);
}

/* ---------------- 提示词构建（分段：每次调用都要在网关 45 秒超时内返回） ---------------- */

const GROUNDING_RULES = `GROUNDING RULES:
- Use ONLY the supplied documents. Do not invent chapters, topics, formulas or exam rules that are not supported by the material.
- If the documents are thin, return fewer items instead of padding with generic textbook content.
- Prefer the exact chapter, section and terminology names found in the documents.`;

/* 模型写的 summary / note 会原样印到界面上，所以它得和界面其他提示同一副面孔：
   先报事实（带具体数字），再说下一步；不寒暄、不带感叹号、不称呼用户。
   全站只有这一条，几个提示词共用——否则改口径时要一处一处追。 */
const PROSE_REGISTER_RULE = `- Prose the student reads on screen ("summary", "note", "rebalanceSummary"): plain factual register, state the concrete numbers, no greeting, no exclamation marks, never address the student directly.`;

/** 第一步：只识别核心大单元与权重，输出很小，便于快速返回。 */
export function buildUnitsPrompt(
  safeMaterials: ClientMaterial[],
  examName: string,
  subject: string,
  isZh: boolean
): string {
  const safeExamName = clampText(examName, 200) || 'Upcoming Exam';
  const safeSubject = clampText(subject, 200) || 'General';
  // 每份资料均分预算：多文件时后面的资料不会被整体截断挤掉
  const perDoc = Math.max(1_500, Math.floor(45_000 / Math.max(1, safeMaterials.length)));
  const aggregatedContent = safeMaterials
    .map((m, idx) => `--- DOCUMENT ${idx + 1}: ${m.name} (${m.type}) ---\n${m.content.slice(0, perDoc)}`)
    .join('\n\n');

  return `You are an expert academic curriculum analyzer and exam preparation strategist.
Analyze the study materials below for the exam "${safeExamName}" (${safeSubject}) and list ONLY the major units (核心大单元) that actually appear in the material.

${GROUNDING_RULES}
- Do NOT expand subtopics or key points in this step; another pass will drill into each unit.
- Keep 4-10 units. Merge trivial sections; never pad the list.
${isZh ? '- Write every title, category and description in natural academic Simplified Chinese (简体中文).' : ''}
${PROSE_REGISTER_RULE}

Documents content:
${aggregatedContent.slice(0, 48_000)}

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "summary": "2-sentence summary of the knowledge scope and the highest-yield units",
  "units": [
    {
      "id": "unit-1",
      "title": "major unit/chapter title",
      "category": "broad domain or module name",
      "description": "one sentence on what this unit covers",
      "weightPercentage": 5-40,
      "difficulty": "easy" | "medium" | "hard",
      "estimatedHours": 3-20
    }
  ]
}
Weights should sum to roughly 100.`;
}

/** 从全量分块中挑出与某个单元最相关的原文片段（纯本地检索，不调模型）。 */
export function selectUnitExcerpts(unit: Pick<SyllabusUnit, 'title' | 'category' | 'description'>, chunks: DocumentChunk[]): string {
  if (!chunks.length) return '';
  return retrieveTopChunksForQuery(`${unit.title} ${unit.category} ${unit.description}`, chunks, {
    topK: 8,
    preferFormulas: true,
    preferQuestions: true
  })
    .map((c, idx) => `[${idx + 1}] Source: "${c.materialName}" (${c.materialType}) | Heading: "${c.sectionTitle}"\n${c.content.slice(0, 900)}`)
    .join('\n\n')
    .slice(0, 14_000);
}

/** 第二步：针对单个大单元展开细分考点与要点，输入只带该单元相关的资料片段。 */
export function buildUnitTreePrompt(
  unit: SyllabusUnit,
  totalUnits: number,
  isZh: boolean
): string {
  const excerpt = clampText(unit.excerpts, 14_000) || '(no supporting excerpts were found for this unit)';

  return `You are a knowledge tree architect drilling into ONE unit of an exam syllabus.
Unit to expand: "${unit.title}" (${unit.category}) — ${unit.description || 'no description'}
This is unit ${unit.unitIndex + 1} of ${totalUnits}; other units are handled separately, so stay inside this unit's scope.

${GROUNDING_RULES}
- Extract 3-6 granular subtopics (细分考点) for THIS unit only, each with 2-4 testable key points, formulas, score checkpoints and common pitfalls found in the excerpts.
- Keep the unit title, category, weight and estimated hours exactly as given.
${isZh ? '- Write titles, key points and formula/trap notes in natural academic Simplified Chinese (简体中文).' : ''}

Supporting excerpts:
${excerpt}

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "title": ${JSON.stringify(unit.title)},
  "category": ${JSON.stringify(unit.category)},
  "description": "overview of this unit",
  "weightPercentage": ${unit.weightPercentage},
  "difficulty": "${unit.difficulty}",
  "userKnowledgeLevel": "beginner" | "intermediate" | "advanced",
  "estimatedHours": ${unit.estimatedHours},
  "subtopics": ["1.1 subtopic title", "1.2 subtopic title"],
  "subtopicTree": [
    {
      "id": "sub-${unit.id}-1",
      "title": "specific subtopic title",
      "keyPoints": ["2-4 concrete points or formula notes"],
      "difficulty": "easy" | "medium" | "hard",
      "examFrequency": "high" | "medium" | "low",
      "formulaOrTrap": "brief tip, formula, or common mistake"
    }
  ]
}`;
}

export interface SyllabusUnit {
  id: string;
  title: string;
  category: string;
  description: string;
  weightPercentage: number;
  difficulty: string;
  estimatedHours: number;
  unitIndex: number;
  /** 由 /ai/units 预先检索出的原文片段，随单元回传，展开时不必再上传整份资料 */
  excerpts?: string;
  /** textbook = 这一章来自教材目录回忆，没有原文片段可接地，展开要用另一套提示词 */
  source?: 'material' | 'textbook';
  /** 教材目录里给出的小节名：展开考点时当作回忆锚点，比空手回忆靠谱 */
  sections?: string[];
}

export function sanitizeUnitsResult(parsed: any): { summary: string; units: SyllabusUnit[] } {
  const rawUnits = Array.isArray(parsed?.units) ? parsed.units : [];
  const units: SyllabusUnit[] = [];
  rawUnits.forEach((unit: any, index: number) => {
    if (!unit || typeof unit !== 'object') return;
    const title = clampText(unit.title, 300);
    if (!title) return;
    const weight = Number(unit.weightPercentage);
    const hours = Number(unit.estimatedHours);
    units.push({
      id: clampText(unit.id, 120) || `unit-${index + 1}`,
      title,
      category: clampText(unit.category, 120),
      description: clampText(unit.description, 1_000),
      weightPercentage: Number.isFinite(weight) && weight > 0 ? Math.min(100, Math.round(weight)) : 0,
      difficulty: ['easy', 'medium', 'hard'].includes(String(unit.difficulty)) ? String(unit.difficulty) : 'medium',
      estimatedHours: Number.isFinite(hours) && hours > 0 ? Math.min(120, Math.round(hours)) : 0,
      unitIndex: index,
    });
  });
  return {
    summary: clampText(parsed?.summary, 2_000),
    units: units.slice(0, 14),
  };
}

/** 把展开结果并回大单元，产出与 sanitizeTopics 同形状的考点节点。 */
export function normalizeUnitTopic(unit: SyllabusUnit, parsed: any): any {
  const merged = {
    ...parsed,
    id: unit.id,
    title: unit.title,
    category: unit.category || clampText(parsed?.category, 120),
    description: clampText(parsed?.description, 2_000) || unit.description,
    source: unit.source,
    weightPercentage: unit.weightPercentage,
    difficulty: unit.difficulty,
    estimatedHours: unit.estimatedHours,
  };
  // 先用 syllabus 归一化补齐 subtopics <-> subtopicTree，再套用统一的字段上限
  const { topics } = sanitizeSyllabusResult({ topics: [merged] });
  const [topic] = sanitizeTopics(topics);
  if (!topic) return null;
  const hasDetail = topic.subtopics.length > 0 || (topic.subtopicTree || []).length > 0;
  return hasDetail ? topic : null;
}

/* ---------------- 教材目录：没有资料时，按教材名回忆通行目录 ----------------
 * 资料提取靠原文接地（GROUNDING_RULES），这里靠模型记忆，两套规矩不能混用：
 * 允许回忆通行章节，但不许编页码、题号与「新版改动」，拿不准就不写。
 * 产出只是章节目录，用户在预览里勾选后才逐章展开成考点——记错的章节在勾选这一步就被拦掉。 */

const TEXTBOOK_RULES = `TEXTBOOK RECALL RULES:
- Reconstruct the table of contents this book is actually known for. If the name is an exam subject rather than one book, use its standard syllabus outline instead.
- Keep the real chapter order and the names the book uses; fold labs and appendices into the chapter they belong to.
- Never invent page numbers, exercise numbers, quotes or "changes in the new edition". If you are not sure a chapter exists, drop it.
- estimatedHours means one honest study pass for this chapter, not book length.`;

export interface TextbookChapter {
  id: string;
  index: number;
  title: string;
  sections: string[];
  weightPercentage: number;
  difficulty: string;
  estimatedHours: number;
}

export function buildTextbookTocPrompt(
  textbook: string,
  examName: string,
  subject: string,
  isZh: boolean
): string {
  const safeTextbook = clampText(textbook, 200) || 'The course textbook';
  const safeExamName = clampText(examName, 200);
  const safeSubject = clampText(subject, 200);
  const context = [safeExamName && `Exam it prepares for: ${safeExamName}`, safeSubject && `Subject: ${safeSubject}`]
    .filter(Boolean)
    .join(' | ');

  return `You are an experienced course designer. Reconstruct the teaching outline of the textbook below so a student can plan a full study cycle around it.

Textbook / syllabus: "${safeTextbook}"${context ? `\n${context}` : ''}

${TEXTBOOK_RULES}
- List 6-14 chapters and cover the whole book; do not stop at the front half.
- Give each chapter 2-6 section names exactly as the book titles them, so the list can be checked against the real table of contents.
- weightPercentage is what this chapter is worth on the exam, or what share of one full pass it takes; keep the list summing to roughly 100.
- "confidence" says how sure you are about this outline as a whole; "note" is one short honest sentence about what you are least sure about (use "" when nothing).
${isZh ? '- Write every title, section name, summary and note in natural academic Simplified Chinese (简体中文).' : ''}
${PROSE_REGISTER_RULE}

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "textbook": "the name as recognized",
  "summary": "2 sentences: what the book covers and where the load concentrates",
  "confidence": "high" | "medium" | "low",
  "note": "one short honest caveat, or \"\"",
  "chapters": [
    {
      "id": "ch-1",
      "title": "chapter title as the book prints it",
      "sections": ["1.1 section name", "1.2 section name"],
      "weightPercentage": 5-30,
      "difficulty": "easy" | "medium" | "hard",
      "estimatedHours": 2-24
    }
  ]
}`;
}

/** 目录归一化：章节限量、去重、学时权重兜底，宁少不假。 */
export function sanitizeTocResult(parsed: any): {
  textbook: string;
  summary: string;
  confidence: string;
  note: string;
  chapters: TextbookChapter[];
} {
  const rawChapters = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
  const seenTitles = new Set<string>();
  const chapters: TextbookChapter[] = [];
  rawChapters.forEach((chapter: any) => {
    if (!chapter || typeof chapter !== 'object') return;
    const title = clampText(chapter.title, 300);
    if (!title) return;
    const key = title.toLowerCase().replace(/\s+/g, '');
    if (seenTitles.has(key)) return;
    seenTitles.add(key);
    const weight = Number(chapter.weightPercentage);
    const hours = Number(chapter.estimatedHours);
    chapters.push({
      id: clampText(chapter.id, 120) || `ch-${chapters.length + 1}`,
      index: chapters.length + 1,
      title,
      sections: Array.isArray(chapter.sections)
        ? chapter.sections.slice(0, 8).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
      weightPercentage: Number.isFinite(weight) && weight > 0 ? Math.min(100, Math.round(weight)) : 0,
      difficulty: ['easy', 'medium', 'hard'].includes(String(chapter.difficulty)) ? String(chapter.difficulty) : 'medium',
      estimatedHours: Number.isFinite(hours) && hours > 0 ? Math.min(120, Math.round(hours)) : 0,
    });
  });
  const limited = chapters.slice(0, 16);
  return {
    textbook: clampText(parsed?.textbook, 200),
    summary: clampText(parsed?.summary, 2_000),
    confidence: ['high', 'medium', 'low'].includes(String(parsed?.confidence)) ? String(parsed.confidence) : 'medium',
    note: clampText(parsed?.note, 500),
    chapters: limited,
  };
}

/** 教材章节展开成考点：与 /ai/unit-tree 同一套输出形状，排程那边不用区分来源。 */
export function buildTextbookTreePrompt(
  unit: SyllabusUnit,
  textbook: string,
  totalUnits: number,
  isZh: boolean
): string {
  const sections = (unit.sections || []).slice(0, 8).map((title, idx) => `${idx + 1}. ${title}`).join('\n');

  return `You are a knowledge tree architect expanding ONE chapter of a textbook into topics a student can actually check off.
Textbook: "${clampText(textbook, 200) || 'the book named above'}"
Chapter to expand: "${unit.title}" — chapter ${unit.unitIndex + 1} of ${totalUnits}. Other chapters are handled separately, so stay inside this one.
${sections ? `Sections the book lists for this chapter:\n${sections}` : 'No section list was provided for this chapter.'}

${TEXTBOOK_RULES}
- Extract 3-6 granular subtopics for THIS chapter only, each with 2-4 key points: the definitions, formulas and typical problem types the student must be able to reproduce from memory.
- Stay inside the sections listed above when they are given. Do not pull in material from other chapters.
- If you do not really know this chapter, return 1-2 honest subtopics instead of padding with generic advice.
- Keep the chapter title, category, weight and estimated hours exactly as given.
${isZh ? '- Write titles, key points and formula/trap notes in natural academic Simplified Chinese (简体中文).' : ''}

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "title": ${JSON.stringify(unit.title)},
  "category": ${JSON.stringify(unit.category)},
  "description": "one sentence on what this chapter asks the student to master",
  "weightPercentage": ${unit.weightPercentage},
  "difficulty": "${unit.difficulty}",
  "userKnowledgeLevel": "beginner" | "intermediate" | "advanced",
  "estimatedHours": ${unit.estimatedHours},
  "subtopics": ["section-level topic title", "..."],
  "subtopicTree": [
    {
      "id": "sub-${unit.id}-1",
      "title": "specific subtopic title",
      "keyPoints": ["2-4 concrete points, formulas or typical question types"],
      "difficulty": "easy" | "medium" | "hard",
      "examFrequency": "high" | "medium" | "low",
      "formulaOrTrap": "brief tip, formula, or common mistake"
    }
  ]
}`;
}

/* ---------------- 排程日历（纯本地计算，不调用模型） ---------------- */

export interface StudyDay {
  date: string;
  weekday: string;
  availableHours: number;
}

/**
 * 一次规划最多往前排多少天。以前写死 60：考期在三个月后的用户会看到「预计 480 小时」
 * 却只拿到前 60 天的任务，等于计划不认自己填的时间。180 天（一学期）在客户端 15 分钟
 * 总预算里跑得完（每段 ≤4 天、并发 4），所以按日历本身的能力放开。
 * 前端同一份数字在 src/lib/dailyHours.ts，向导的「全程预计」要用它，别两边各写一个。
 */
export const PLANNING_WINDOW_DAYS = 180;

export function buildStudyCalendar(preferences: any): StudyDay[] {
  const planningStart = preferences.startDate || toLocalDateString();
  const planningExam = preferences.examDate || addDaysToDateString(planningStart, 21);
  const planningDays = Math.min(Math.max(1, daysBetweenDateStrings(planningStart, planningExam)), PLANNING_WINDOW_DAYS);
  const days: StudyDay[] = [];
  for (let offset = 0; offset < planningDays; offset += 1) {
    const dateStr = addDaysToDateString(planningStart, offset);
    const date = parseLocalDate(dateStr);
    const schedule = preferences.dailySchedules?.find(
      (entry: any) => Number(entry?.dayOfWeek) === date.getDay()
    );
    if (schedule && !schedule.enabled) continue;
    const availableHours = Number(schedule?.availableHours) > 0 ? Number(schedule.availableHours) : 2;
    days.push({
      date: dateStr,
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      availableHours,
    });
  }
  return days;
}

export function studyDatesFromCalendar(days: StudyDay[]): string[] {
  return days.map((day) => day.date);
}

/**
 * 一天该排几条任务。
 * 原来一律封顶 3 条，于是填了 10 小时的周六和 1 小时的周三拿到同样密度的计划，
 * 用户改时间「没反应」就是从这来的。现在按当天可用小时数给，仍留个上限，
 * 免得模型为了凑数把一天拆成十几个碎片。
 */
function expectedTasksForDay(day: StudyDay, sessionMinutes: number): number {
  const perSession = Math.floor((day.availableHours * 60) / Math.max(10, sessionMinutes));
  return Math.min(5, Math.max(1, perSession || 1));
}

/** 一天里可用的分钟数（用户填的 availableHours，休息日为 0）。 */
export function dailyBudgetMinutes(preferences: any, date: string): number {
  const schedule = preferences?.dailySchedules?.find(
    (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(date).getDay()
  );
  if (schedule && !schedule.enabled) return 0;
  const hours = Number(schedule?.availableHours) > 0 ? Number(schedule.availableHours) : 2;
  return Math.round(hours * 60);
}

function addMinutesToClock(clock: string, minutes: number): string {
  const [h, m] = clock.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, (h || 0) * 60 + (m || 0) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const TIME_SLOT_CLOCKS: Record<string, string> = {
  morning: '08:00',
  afternoon: '14:00',
  evening: '19:00',
  flexible: '09:00',
};

/**
 * 这天从几点开学。高级设置里每天带着一个时段（早/午/晚），本地兜底排程必须按它开钟，
 * 否则工作日 19:00 的晚间计划会被排成早上 9 点——用户照样说「计划不认我填的时间」。
 */
export function dayStartClock(preferences: any, date: string): string {
  const schedule = preferences?.dailySchedules?.find(
    (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(date).getDay()
  );
  return TIME_SLOT_CLOCKS[String(schedule?.preferredTimeSlot || 'flexible')] || '09:00';
}

/**
 * 硬约束：同一天的任务总时长不得超过该天可用小时数。
 * 提示词只能「劝」模型守预算，用户既然说周六有 5 小时、周三只有 1 小时，计划就不能装看不见。
 * 所以这里做三件事：
 *   1) 超预算的日子按优先级（高→低，同优先级按开始时间）保留，尾部整条撤掉或截短到剩余分钟；
 *   2) 落在休息日（availableHours=0 / enabled=false）的任务一律取消——这是用户自己勾掉的；
 *   3) 生成路径下（padEmptyDays）被清空的日子里补一条开场任务，日历上不会出现无人认领的学习日。
 * 截短过的任务带上 dayBudgetTrimmed，补出来的任务带上 localScheduled，上层能看出哪些是规则收的口。
 * keepCompleted 给重排路径用：已完成的任务是历史，不参与也不受今天的预算约束。
 */
export function enforceDailyHourBudget(
  tasks: any[],
  preferences: any,
  allowedDates: string[],
  options: { isZh?: boolean; padEmptyDays?: boolean; keepCompleted?: boolean } = {}
): { tasks: any[]; droppedCount: number; paddedDates: string[] } {
  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const padEmptyDays = options.padEmptyDays !== false;
  const sessionMinutes = Math.max(10, Number(preferences?.sessionLengthMinutes) || 45);
  const frozen: any[] = options.keepCompleted
    ? (tasks || []).filter((task) => task?.status === 'completed')
    : [];
  const byDate = new Map<string, any[]>();
  allowedDates.forEach((date) => byDate.set(date, []));
  (tasks || []).forEach((task) => {
    if (frozen.includes(task)) return;
    if (!byDate.has(task.date)) return;
    byDate.get(task.date)!.push(task);
  });

  const kept: any[] = [...frozen];
  const paddedDates: string[] = [];
  let droppedCount = 0;

  allowedDates.forEach((date) => {
    const budget = dailyBudgetMinutes(preferences, date);
    if (budget <= 0) {
      droppedCount += byDate.get(date)!.length;
      return;
    }
    const ordered = byDate.get(date)!.slice().sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 1;
      const pb = PRIORITY_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
    });

    let used = 0;
    let taken = 0;
    let index = 0;
    for (; index < ordered.length; index += 1) {
      const task = ordered[index];
      const remaining = budget - used;
      if (remaining < 10) break;
      const wanted = Number(task.durationMinutes) || sessionMinutes;
      if (wanted > remaining) {
        // 剩余不足一条完整任务：最后这一条截短收尾，别把这天欠着
        const fitted = Math.max(10, Math.min(remaining, 240));
        const trimmed = { ...task, durationMinutes: fitted, dayBudgetTrimmed: true };
        if (/^\d{2}:\d{2}$/.test(String(task.startTime || ''))) {
          trimmed.endTime = addMinutesToClock(task.startTime, fitted);
        }
        kept.push(trimmed);
        used += fitted;
        taken += 1;
        index += 1;
        break;
      }
      kept.push(task);
      used += wanted;
      taken += 1;
    }
    // 预算用完之后没轮到排的任务：如实记账，别假装都塞下了
    droppedCount += ordered.length - index;

    if (taken === 0 && padEmptyDays) {
      // 模型漏排或整段被资料过滤掉：保底一条开场任务，宁可短也不能空
      const isZh = options.isZh !== false;
      const examName = clampText(preferences?.examName, 200);
      const durationMinutes = Math.min(Math.max(10, budget), sessionMinutes, 240);
      const startTime = dayStartClock(preferences, date);
      kept.push({
        id: `task-${date}-local-budget`,
        date,
        title: isZh
          ? (examName ? `${examName}：梳理当天待办与薄弱点` : '梳理当天待办与薄弱点')
          : (examName ? `${examName}: plan the day and hit the weakest topics` : 'Plan the day and hit the weakest topics'),
        description: isZh
          ? '按当天可用时间，先列出要推进的考点，再从最薄弱的地方开始。'
          : 'Use the hours you marked available today: list the topics to advance, then start with the weakest one.',
        category: 'review_weak_spots',
        topicTitle: '',
        startTime,
        endTime: addMinutesToClock(startTime, durationMinutes),
        durationMinutes,
        priority: 'medium',
        status: 'pending',
        keyObjectives: [],
        localScheduled: true,
      });
      paddedDates.push(date);
    }
  });

  kept.sort((a, b) => {
    const dateDiff = String(a.date).localeCompare(String(b.date));
    if (dateDiff !== 0) return dateDiff;
    return String(a.startTime || '99:99').localeCompare(String(b.startTime || '99:99'));
  });
  return { tasks: kept, droppedCount, paddedDates };
}

/**
 * 把日历切成小段：每段任务量控制在个位数，保证单次同步调用能在超时前返回。
 * @returns 每段的日期列表与预计任务数
 */
export function chunkStudyDays(
  days: StudyDay[],
  options: { maxTasksPerChunk?: number; maxDaysPerChunk?: number; sessionLengthMinutes?: number } = {}
): Array<{ dates: string[]; expectedTasks: number }> {
  const maxTasks = Math.max(2, Number(options.maxTasksPerChunk) || 7);
  const maxDays = Math.max(1, Number(options.maxDaysPerChunk) || 4);
  const sessionMinutes = Math.max(10, Number(options.sessionLengthMinutes) || 45);
  if (days.length === 0) return [];
  const chunks: Array<{ dates: string[]; expectedTasks: number }> = [];
  let current: string[] = [];
  let tasks = 0;
  for (const day of days) {
    const dayTasks = expectedTasksForDay(day, sessionMinutes);
    if (current.length > 0 && (tasks + dayTasks > maxTasks || current.length >= maxDays)) {
      chunks.push({ dates: current, expectedTasks: tasks });
      current = [];
      tasks = 0;
    }
    current.push(day.date);
    tasks += dayTasks;
  }
  if (current.length > 0) chunks.push({ dates: current, expectedTasks: tasks });
  return chunks;
}

export function buildPlanChunkPrompt(
  preferences: any,
  safeTopics: any[],
  safeMaterials: ClientMaterial[],
  chunkDays: StudyDay[],
  options: { includePhases: boolean; coveredTopicTitles?: string[]; isZh: boolean }
): string {
  const isZh = options.isZh;
  const sessionMinutes = Math.max(10, Number(preferences.sessionLengthMinutes) || 45);
  const calendarText = chunkDays
    .map((day) => {
      const budget = Math.round(day.availableHours * 60);
      const cap = expectedTasksForDay(day, sessionMinutes);
      return `${day.date} (${day.weekday}) — budget ${budget} min (${day.availableHours}h); fill ${Math.max(0, budget - 30)}..${budget} min in up to ${cap} task${cap === 1 ? '' : 's'}`;
    })
    .join('\n');
  const planningStart = preferences.startDate || chunkDays[0]?.date || toLocalDateString();
  const planningExam = preferences.examDate || chunkDays[chunkDays.length - 1]?.date || planningStart;

  // 考点清单压缩到标题级别，细节由资料片段提供，控制输入体量
  const topicDigest = safeTopics.map((t: any) => ({
    title: t.title,
    category: t.category,
    weight: t.weightPercentage,
    difficulty: t.difficulty,
    hours: t.estimatedHours,
    subtopics: (t.subtopics || []).slice(0, 8),
  }));
  const compactTopics = JSON.stringify(topicDigest, null, 1).slice(0, 14_000);

  const focusQuery = `${preferences.userNeedFocusArea || ''} ${preferences.customPromptRequirement || ''} ${preferences.weakTopicsFocus?.join(' ') || ''}`.trim();
  const chunkNames = chunkDays.map((d) => d.date).join(' ');
  const allChunks = chunkAllMaterials(safeMaterials);
  const ragBlocks: string[] = [];
  if (allChunks.length > 0) {
    retrieveTopChunksForQuery(`${focusQuery} ${chunkNames}`, allChunks, { topK: 6, preferQuestions: true, preferFormulas: true })
      .forEach((c, idx) => {
        ragBlocks.push(`[${idx + 1}] Source: "${c.materialName}" (${c.materialType}) | Heading: "${c.sectionTitle}"\n${c.content.slice(0, 700)}`);
      });
  }
  const ragText = ragBlocks.length > 0
    ? `\n=== MATERIAL EXCERPTS ===\n${ragBlocks.join('\n\n')}\n`
    : `\nNO MATERIAL EXCERPTS WERE PROVIDED FOR THIS CALL: keep "ragSource" an empty object, leave "formulaOrRules" empty, and never name a document, chapter or quote that is not shown above.\n`;

  const covered = (options.coveredTopicTitles || []).slice(0, 40).join(' | ').slice(0, 2_000);
  const coveredText = covered
    ? `\nALREADY SCHEDULED IN EARLIER DAYS (advance to new subtopics instead of repeating):\n${covered}\n`
    : '';

  const phasesBlock = options.includePhases
    ? `First, group the WHOLE exam window ${planningStart} → ${planningExam} (not just the calendar days below) into 3-4 study phases derived from this specific material (not a generic template).
   Phases must be contiguous and non-overlapping: phase 1 starts at ${planningStart}, the last phase ends at ${planningExam}, and each phase's startDate is the day after the previous phase's endDate. Spread them across the full window instead of stacking them on the first days.
   Each phase needs concrete startDate/endDate and a focus tied to actual topics.
`
    : `Do NOT output phases; they were already produced by an earlier call. Use "phases": [].
`;

  return `You are a master learning scientist and study schedule architect.
Schedule ONLY the days listed in PLANNING CALENDAR below. Other days are handled by separate calls.
${isZh ? 'CRITICAL: All phase names, task titles, descriptions, key objectives and active recall prompts MUST be written in natural, idiomatic Simplified Chinese (简体中文).' : ''}

${GROUNDING_RULES}

STUDENT PROFILE:
- Exam: ${preferences.examName || 'Final Exam'} (${preferences.subject || 'Academic'})
- Exam Date: ${planningExam} at ${preferences.examTime || '09:00'}
- Target: ${preferences.targetScoreOrGrade || 'Top Grade'}
- Focus Priority: ${preferences.userNeedFocusArea || 'comprehensive'}
- Student Directives: ${preferences.customPromptRequirement || preferences.additionalNotes || 'None'}
- Weak Topics: ${preferences.weakTopicsFocus?.join(', ') || 'None specified'}
- Preferred Block Length: ${sessionMinutes} minutes

PLANNING CALENDAR (these are the ONLY allowed task dates; every listed day needs at least one task):
${calendarText}

SYLLABUS TOPICS:
${compactTopics}
${ragText}${coveredText}
RULES:
1. Every day in PLANNING CALENDAR carries a minute budget that comes straight from what the student says they have available that weekday. Respect it as a hard limit: never exceed a day's budget, and do not leave more than 30 minutes of it unused — split the day into as many ~${sessionMinutes} minute tasks as the budget allows (2-5). A 5h Saturday and a 1h Wednesday must not get the same load. Never schedule a date outside the calendar.
2. ${phasesBlock}3. For every study task ground the content in the material excerpts:
   - title: concise and actionable, tied to a real chapter/section or problem type
   - description: what to read, solve or produce
   - category: one of ["theory", "reading", "practice_problems", "active_recall", "flashcards", "mock_exam", "review_weak_spots", "summary_cheat_sheet"]
   - topicTitle: the associated syllabus topic title
   - date: "YYYY-MM-DD" from the calendar, plus startTime / endTime / durationMinutes
   - priority: "high" | "medium" | "low"; status: "pending"
   - keyObjectives: 2-3 specific mastery checkpoints
   - activeRecallPrompt: a self-testing question based on the material
   - groundedUserNeed: which student requirement this task satisfies
   - formulaOrRules: 1-2 formulas or rules that actually appear in the material (empty array if none)
   - ragSource: documentName / documentType / sectionTitle / pageOrChapter / excerptSnippet (50-150 chars) / keyConcepts / relevanceReason
4. Never fabricate document names, chapter numbers, quotes or formulas. Omit unsupported details instead of inventing them.

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "phases": [ { "id": "phase-1", "name": "...", "description": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "focus": "..." } ],
  "tasks": [ { "id": "task-1", "title": "...", "description": "...", "category": "reading", "topicTitle": "...", "date": "YYYY-MM-DD", "startTime": "09:00", "endTime": "09:45", "durationMinutes": 45, "priority": "high", "status": "pending", "keyObjectives": ["..."], "activeRecallPrompt": "...", "groundedUserNeed": "...", "formulaOrRules": ["..."], "ragSource": { "documentName": "...", "documentType": "notes", "sectionTitle": "...", "pageOrChapter": "...", "excerptSnippet": "...", "keyConcepts": ["..."], "relevanceReason": "..." } } ]
}`;
}

/** 段结果归一化：只保留落在本段日期内的任务，避免越界重复。 */
export function sanitizePlanChunkResult(
  parsed: any,
  preferences: any,
  allowedDates: string[],
  options: { hasMaterials?: boolean; isZh?: boolean } = {}
): { phases: any[]; tasks: any[] } {
  const allowed = new Set(allowedDates);
  const rawTasks = normalizePlanTasks(parsed?.tasks || [], preferences).filter((task: any) => allowed.has(task.date));
  if (options.hasMaterials === false) {
    // 本次没有资料片段可引：模型自己编出来的出处不能展示给学生，宁缺毋滥
    rawTasks.forEach((task: any) => {
      task.ragSource = null;
      task.formulaOrRules = [];
    });
  }
  // 用户填的每日时间是硬约束，不是建议：超了要收口，空了要保底
  const { tasks } = enforceDailyHourBudget(rawTasks, preferences, allowedDates, { isZh: options.isZh });
  const phases = Array.isArray(parsed?.phases)
    ? parsed.phases.slice(0, 6).map((phase: any, index: number) => ({
        id: clampText(phase?.id, 120) || `phase-${index + 1}`,
        name: clampText(phase?.name, 200),
        description: clampText(phase?.description, 1_000),
        startDate: clampText(phase?.startDate, 20),
        endDate: clampText(phase?.endDate, 20),
        focus: clampText(phase?.focus, 300),
      })).filter((phase: any) => phase.name)
    : [];
  return { phases, tasks };
}

export function buildRebalancePrompt(currentPlan: any, todayStr: string, reason: string, isZh: boolean): string {
  const pending = (currentPlan.tasks || []).filter((t: any) => t.status !== 'completed');
  return `You are an adaptive study coach.
The student needs to reschedule the remaining tasks of an exam plan as of ${todayStr}.
Reason / Trigger: ${reason || 'Student missed past tasks or needs schedule rebalancing'}
${isZh ? 'CRITICAL: The summary and every task title must be written in natural Simplified Chinese (简体中文).' : ''}
${PROSE_REGISTER_RULE}

Exam Date: ${currentPlan.examDate}
Exam Name: ${currentPlan.examName}
Completed tasks stay exactly where they are and MUST NOT be returned.

Daily Available Hours:
${JSON.stringify(currentPlan.preferences?.dailySchedules || [])}

Tasks To Reschedule (${pending.length} tasks; only their dates/times need to change):
${JSON.stringify(pending.map((t: any) => ({
    id: t.id,
    title: t.title,
    topicTitle: t.topicTitle,
    durationMinutes: t.durationMinutes,
    priority: t.priority,
    status: t.status,
    date: t.date,
  }))).slice(0, 24_000)}

INSTRUCTIONS:
1. Spread these tasks across the days from ${todayStr} up to ${currentPlan.examDate}, respecting the daily available hours.
2. If time is tight, keep high-priority and high-yield review tasks, lower the rest, and drop the least useful ones (do not return them).
3. Keep each task's id unchanged and give it a new date, startTime, endTime, durationMinutes, priority and status ("pending" or "skipped").
4. Do not invent new tasks and do not rewrite long descriptions; return the compact fields below only.

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "rebalanceSummary": "1-2 sentences in the language the plan uses, stating how many tasks moved onto which days",
  "tasks": [ { "id": "task-1", "date": "YYYY-MM-DD", "startTime": "09:00", "endTime": "09:45", "durationMinutes": 45, "priority": "high", "status": "pending" } ]
}`;
}

/** 把精简后的重排结果并回完整任务表：已完成任务保持原样。 */
export function mergeRebalanceTasks(currentTasks: any[], updates: any[]): Array<any> {
  const byId = new Map<string, any>();
  updates.forEach((task: any) => {
    const id = clampText(task?.id, 120);
    const date = clampText(task?.date, 20);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    byId.set(id, task);
  });
  const merged = currentTasks.map((task: any) => {
    if (task?.status === 'completed') return task;
    const update = byId.get(String(task?.id));
    if (!update) return task;
    return {
      ...task,
      date: clampText(update.date, 20) || task.date,
      startTime: /^\d{2}:\d{2}$/.test(String(update.startTime || '')) ? update.startTime : task.startTime,
      endTime: /^\d{2}:\d{2}$/.test(String(update.endTime || '')) ? update.endTime : task.endTime,
      durationMinutes: Number.isFinite(Number(update.durationMinutes)) && Number(update.durationMinutes) >= 10
        ? Math.min(240, Math.round(Number(update.durationMinutes)))
        : task.durationMinutes,
      priority: ['high', 'medium', 'low'].includes(String(update.priority)) ? update.priority : task.priority,
      status: ['pending', 'in_progress', 'completed', 'skipped'].includes(String(update.status)) ? update.status : 'pending',
    };
  });
  return merged;
}

/* ---------------- 结果解析与归一化 ---------------- */

export function extractJson(text: string): unknown {
  let s = String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  try {
    return JSON.parse(s);
  } catch {
    return JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
  }
}

export function sanitizeSyllabusResult(parsed: any): { summary: string; topics: any[] } {
  const topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
  topics.forEach((t: any, idx: number) => {
    if (!t || typeof t !== 'object') return;
    if (!t.id) t.id = `topic-${idx + 1}`;
    if (!t.subtopicTree && t.subtopics && Array.isArray(t.subtopics)) {
      t.subtopicTree = t.subtopics.map((sub: string, sIdx: number) => ({
        id: `sub-${idx + 1}-${sIdx + 1}`,
        title: sub,
        keyPoints: [],
        difficulty: t.difficulty || 'medium',
        examFrequency: 'medium',
      }));
    } else if (t.subtopicTree && (!t.subtopics || t.subtopics.length === 0)) {
      t.subtopics = t.subtopicTree.map((s: any) => s.title);
    }
  });
  return {
    summary: clampText(parsed?.summary, 2_000),
    topics: topics.filter((t: any) => t && typeof t.title === 'string' && t.title.trim()),
  };
}

export function normalizePlanTasks(existingTasks: any[], preferences: any): any[] {
  const startStr = preferences.startDate || toLocalDateString();
  const examStr = preferences.examDate || addDaysToDateString(startStr, 21);
  const totalDays = Math.max(1, daysBetweenDateStrings(startStr, examStr));
  const validCategories = new Set([
    'theory', 'reading', 'practice_problems', 'active_recall',
    'flashcards', 'mock_exam', 'review_weak_spots', 'summary_cheat_sheet',
  ]);
  const validPriorities = new Set(['high', 'medium', 'low']);
  const validStatuses = new Set(['pending', 'in_progress', 'completed', 'skipped']);
  const seenIds = new Set<string>();
  const normalized: any[] = [];

  (existingTasks || []).forEach((task: any, index: number) => {
    if (!task || typeof task !== 'object') return;
    const date = clampText(task.date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseLocalDate(date).getTime())) return;
    const dayOffset = daysBetweenDateStrings(startStr, date);
    if (dayOffset < 0 || dayOffset >= totalDays) return;

    const schedule = preferences.dailySchedules?.find(
      (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(date).getDay()
    );
    if (schedule && !schedule.enabled) return;

    const title = clampText(task.title, 300);
    if (!title) return;

    const rawDuration = Number(task.durationMinutes);
    const durationMinutes = Number.isFinite(rawDuration) && rawDuration >= 10
      ? Math.min(240, Math.round(rawDuration))
      : Math.min(240, Math.max(10, Number(preferences.sessionLengthMinutes) || 45));

    const rawId = clampText(task.id, 120) || `task-${date}-${index + 1}`;
    let id = rawId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${rawId}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);

    normalized.push({
      ...task,
      id,
      title,
      description: clampText(task.description, 2_000),
      category: validCategories.has(task.category) ? task.category : 'reading',
      topicTitle: clampText(task.topicTitle, 300),
      date,
      startTime: /^\d{2}:\d{2}$/.test(String(task.startTime || '')) ? task.startTime : undefined,
      endTime: /^\d{2}:\d{2}$/.test(String(task.endTime || '')) ? task.endTime : undefined,
      durationMinutes,
      priority: validPriorities.has(task.priority) ? task.priority : 'medium',
      status: validStatuses.has(task.status) ? task.status : 'pending',
      keyObjectives: Array.isArray(task.keyObjectives)
        ? task.keyObjectives.slice(0, 6).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
      activeRecallPrompt: clampText(task.activeRecallPrompt, 1_000) || undefined,
      groundedUserNeed: clampText(task.groundedUserNeed, 1_000) || undefined,
      formulaOrRules: Array.isArray(task.formulaOrRules)
        ? task.formulaOrRules.slice(0, 6).map((item: unknown) => clampText(item, 300)).filter(Boolean)
        : [],
    });
  });

  return normalized.sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;
    return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
  });
}

export function sanitizePlanResult(
  parsed: any,
  preferences: any,
  studyDates: string[],
  options: { isZh?: boolean } = {}
): any {
  const allowed = new Set(studyDates);
  const rawTasks = normalizePlanTasks(parsed?.tasks || [], preferences).filter((task: any) => allowed.has(task.date));
  // 和分段生成同一条规矩：每天不超过用户填的时长，空白的学习日保底一条
  const { tasks: enrichedTasks } = enforceDailyHourBudget(rawTasks, preferences, studyDates, options);
  const coveredDates = new Set(enrichedTasks.map((task) => task.date));
  const totalCalculatedHours = Math.round(
    enrichedTasks.reduce((sum: number, task: any) => sum + (task.durationMinutes || 0), 0) / 60
  );
  return {
    phases: Array.isArray(parsed?.phases) ? parsed.phases : [],
    tasks: enrichedTasks,
    totalPlannedHours: totalCalculatedHours || Number(parsed?.totalPlannedHours) || 0,
    meta: { source: 'ai', coveredDays: coveredDates.size, planningDays: new Set(studyDates).size },
  };
}

/**
 * 本地重排：未完成任务只往「真正能学习的日子」上放。
 * 老写法是 idx % remainingDays 从今天起一天不落地摊，休息日和用户填的每日时长都不算，
 * 于是重排完用户照样觉得「我改的时间计划不认」——问题从来不在控件上，在这段逻辑里。
 * 现在走 buildStudyCalendar 同一套日历：先每天一条铺满整个窗口，再回头按剩余预算补第二条，
 * 塞不下的显式标 skipped 并在摘要里讲清楚，宁可少排也不把休息日填满。
 */
export function fallbackRebalancePlan(currentPlan: any, currentDate: string, reason: string) {
  const isZh = resolveIsChinese(currentPlan?.language, currentPlan?.examName, currentPlan?.subject);
  const today = currentDate || toLocalDateString();
  const examDate =
    currentPlan?.examDate && !Number.isNaN(parseLocalDate(currentPlan.examDate).getTime())
      ? currentPlan.examDate
      : addDaysToDateString(today, 14);

  const completedTasks = currentPlan.tasks.filter((t: any) => t.status === 'completed');
  const pendingTasks = currentPlan.tasks.filter((t: any) => t.status !== 'completed');
  const sessionMinutes = Math.max(10, Number(currentPlan?.preferences?.sessionLengthMinutes) || 45);
  const preferences = { ...(currentPlan?.preferences || {}), startDate: today, examDate };
  const slots = buildStudyCalendar(preferences).map((day) => ({
    date: day.date,
    remaining: Math.round(day.availableHours * 60),
    clock: dayStartClock(preferences, day.date),
    usedMinutes: 0,
    assigned: [] as any[],
  }));

  const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const queue = pendingTasks.slice().sort((a: any, b: any) => {
    const pa = PRIORITY_ORDER[a?.priority] ?? 1;
    const pb = PRIORITY_ORDER[b?.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return String(a?.date || '').localeCompare(String(b?.date || ''));
  });

  let cursor = 0;
  while (cursor < queue.length) {
    let placedThisRound = false;
    for (const slot of slots) {
      if (cursor >= queue.length) break;
      const need = Number(queue[cursor]?.durationMinutes) || sessionMinutes;
      if (slot.remaining >= need) {
        slot.assigned.push(queue[cursor]);
        slot.remaining -= need;
        cursor += 1;
        placedThisRound = true;
      }
    }
    if (!placedThisRound) break; // 剩下的任务在任何一天都放不下，别再硬塞
  }
  const unschedulable = queue.slice(cursor);

  const rescheduled = slots.flatMap((slot) => slot.assigned.map((task: any) => {
    const duration = Number(task.durationMinutes) || sessionMinutes;
    const startTime = addMinutesToClock(slot.clock, slot.usedMinutes);
    slot.usedMinutes += duration;
    return {
      ...task,
      date: slot.date,
      startTime,
      endTime: addMinutesToClock(startTime, duration),
      status: 'pending',
      priority: task.priority === 'low' ? 'medium' : task.priority,
    };
  }));
  const skippedTasks = unschedulable.map((task: any) => ({ ...task, status: 'skipped' }));

  const scheduledDays = slots.filter((slot) => slot.assigned.length).length;
  /* 重排结果说明：先说这次重排了多少、排到哪几天，再说保持不变的和被跳过的。
     不称呼「你」/「your」、不用感叹号，英文计数交给 count()——
     这几条是全站提示文案的规矩，dev/copy-guard.test.ts 盯着前端那一半。 */
  const overflowNote = unschedulable.length
    ? (isZh
      ? `剩余可用时间不够，${unschedulable.length} 个任务标为跳过。`
      : `${count(unschedulable.length, 'task does', 'tasks do')} not fit the time left and are marked skipped.`)
    : '';

  return {
    rebalanceSummary: [
      isZh
        ? `已把 ${rescheduled.length} 个任务重排到 ${examDate} 之前的 ${scheduledDays} 个学习日，休息日不排。`
        : `Rescheduled ${count(rescheduled.length, 'task', 'tasks')} across ${count(scheduledDays, 'study day', 'study days')} before ${examDate}, keeping rest days empty.`,
      isZh
        ? `${completedTasks.length} 个已完成里程碑保持不变。`
        : `${count(completedTasks.length, 'completed milestone', 'completed milestones')} kept unchanged.`,
      overflowNote,
    ].filter(Boolean).join(isZh ? '' : ' '),
    tasks: [...completedTasks, ...rescheduled, ...skippedTasks],
  };
}

/**
 * 重排结果落地前的最后一道闸：休息日不排任务、每个学习日不超预算，已完成的里程碑原样保留。
 * 落在窗口外（比如昨天没做完的待办）的任务不硬删——它们该不该消失由上层决定，这里只管时间。
 */
export function enforceRebalanceBudget(
  mergedTasks: any[],
  currentPlan: any,
  fromDay: string,
  options: { isZh?: boolean } = {}
): any[] {
  const preferences = { ...(currentPlan?.preferences || {}), startDate: fromDay, examDate: currentPlan?.examDate };
  const dates = buildStudyCalendar(preferences).map((day) => day.date);
  const allowed = new Set(dates);
  const inside = (mergedTasks || []).filter((task) => allowed.has(task?.date));
  const outside = (mergedTasks || []).filter((task) => !allowed.has(task?.date));
  const { tasks } = enforceDailyHourBudget(inside, preferences, dates, {
    ...options,
    padEmptyDays: false,
    keepCompleted: true,
  });
  return [...outside, ...tasks].sort((a, b) => {
    const dateDiff = String(a?.date).localeCompare(String(b?.date));
    if (dateDiff !== 0) return dateDiff;
    return String(a?.startTime || '99:99').localeCompare(String(b?.startTime || '99:99'));
  });
}

export function sanitizeRebalanceResult(parsed: any): { rebalanceSummary: string; tasks: any[] } {
  const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
  return {
    rebalanceSummary: clampText(parsed?.rebalanceSummary, 2_000),
    tasks: tasks.map((t: any, idx: number) => {
      const dateStr = clampText(t?.date, 20) || toLocalDateString();
      const salt = Math.random().toString(36).slice(2, 6);
      return { ...t, id: clampText(t?.id, 120) || `task-${dateStr}-${salt}-${idx}` };
    }),
  };
}