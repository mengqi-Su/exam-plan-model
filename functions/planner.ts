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
    throw new PlannerError(`一次最多上传 ${maxDocs} 份资料，请分批处理。`, 413, 'TOO_MANY_MATERIALS');
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

export function sanitizePreferences(raw: any): any {
  const startDate = clampText(raw?.startDate, 20);
  const examDate = clampText(raw?.examDate, 20);
  if (!startDate || Number.isNaN(parseLocalDate(startDate).getTime())) {
    throw new PlannerError('开始日期格式无效，应为 YYYY-MM-DD。', 400, 'INVALID_START_DATE');
  }
  if (!examDate || Number.isNaN(parseLocalDate(examDate).getTime())) {
    throw new PlannerError('考试日期格式无效，应为 YYYY-MM-DD。', 400, 'INVALID_EXAM_DATE');
  }
  if (daysBetweenDateStrings(startDate, examDate) < 0) {
    throw new PlannerError('考试日期不能早于开始日期。', 400, 'INVALID_DATE_RANGE');
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
    dailySchedules: Array.isArray(raw?.dailySchedules) ? raw.dailySchedules.slice(0, 7) : [],
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
    throw new PlannerError('缺少当前计划数据。', 400, 'MISSING_PLAN');
  }
  if (!Array.isArray(currentPlan.tasks)) {
    throw new PlannerError('当前计划缺少任务列表。', 400, 'MISSING_TASKS');
  }
  if (currentPlan.tasks.length > MAX_TASKS_PER_PLAN) {
    throw new PlannerError('计划任务数量过多，无法重排。', 413, 'TOO_MANY_TASKS');
  }
  return {
    ...currentPlan,
    examName: clampText(currentPlan.examName, 200),
    subject: clampText(currentPlan.subject, 200),
    examDate: clampText(currentPlan.examDate, 20),
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

/* ---------------- 排程日历（纯本地计算，不调用模型） ---------------- */

export interface StudyDay {
  date: string;
  weekday: string;
  availableHours: number;
}

export function buildStudyCalendar(preferences: any): StudyDay[] {
  const planningStart = preferences.startDate || toLocalDateString();
  const planningExam = preferences.examDate || addDaysToDateString(planningStart, 21);
  const planningDays = Math.min(Math.max(1, daysBetweenDateStrings(planningStart, planningExam)), 60);
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

function expectedTasksForDay(day: StudyDay, sessionMinutes: number): number {
  const perSession = Math.floor((day.availableHours * 60) / Math.max(10, sessionMinutes));
  return Math.min(3, Math.max(1, perSession || 1));
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
    .map((day) => `${day.date} (${day.weekday}) — ${day.availableHours}h available (~${expectedTasksForDay(day, sessionMinutes)} tasks)`)
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
    : '';

  const covered = (options.coveredTopicTitles || []).slice(0, 40).join(' | ').slice(0, 2_000);
  const coveredText = covered
    ? `\nALREADY SCHEDULED IN EARLIER DAYS (advance to new subtopics instead of repeating):\n${covered}\n`
    : '';

  const phasesBlock = options.includePhases
    ? `First, group the whole timeline (${planningStart} to ${planningExam}) into 3-4 study phases derived from this specific material (not a generic template). Each phase needs concrete startDate/endDate and a focus tied to actual topics.
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
1. Output 1-3 tasks per listed day and never exceed that day's available hours; do not invent dates outside the calendar.
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
export function sanitizePlanChunkResult(parsed: any, preferences: any, allowedDates: string[]): { phases: any[]; tasks: any[] } {
  const allowed = new Set(allowedDates);
  const tasks = normalizePlanTasks(parsed?.tasks || [], preferences).filter((task: any) => allowed.has(task.date));
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
  "rebalanceSummary": "1-2 sentences in the student's language explaining how the load was redistributed",
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

export function sanitizePlanResult(parsed: any, preferences: any, studyDates: string[]): any {
  const enrichedTasks = normalizePlanTasks(parsed?.tasks || [], preferences);
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

export function fallbackRebalancePlan(currentPlan: any, currentDate: string, reason: string) {
  const isZh = resolveIsChinese(currentPlan?.language, currentPlan?.examName, currentPlan?.subject);
  const today = currentDate || toLocalDateString();
  const examDate =
    currentPlan?.examDate && !Number.isNaN(parseLocalDate(currentPlan.examDate).getTime())
      ? currentPlan.examDate
      : addDaysToDateString(today, 14);

  const completedTasks = currentPlan.tasks.filter((t: any) => t.status === 'completed');
  const pendingTasks = currentPlan.tasks.filter((t: any) => t.status !== 'completed');
  const remainingDays = Math.max(1, daysBetweenDateStrings(today, examDate));

  const updatedPending = pendingTasks.map((task: any, idx: number) => {
    const dayOffset = idx % remainingDays;
    const targetDate = addDaysToDateString(today, dayOffset);
    return {
      ...task,
      date: targetDate,
      status: 'pending',
      priority: task.priority === 'low' ? 'medium' : task.priority,
    };
  });

  return {
    rebalanceSummary: isZh
      ? `已成功自适应重排！将剩余 ${pendingTasks.length} 个学习任务科学均衡分配至距离 ${examDate} 考试前的 ${remainingDays} 天内。已保留 ${completedTasks.length} 个已完成的学习里程碑。`
      : `Successfully rebalanced ${pendingTasks.length} remaining tasks across ${remainingDays} days leading up to ${examDate}. Preserved ${completedTasks.length} completed study milestones.`,
    tasks: [...completedTasks, ...updatedPending],
  };
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