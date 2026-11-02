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

/* ---------------- 提示词构建 ---------------- */

export function buildSyllabusPrompt(
  safeMaterials: ClientMaterial[],
  examName: string,
  subject: string,
  isZh: boolean
): string {
  const safeExamName = clampText(examName, 200) || 'Upcoming Exam';
  const safeSubject = clampText(subject, 200) || 'General';
  const aggregatedContent = safeMaterials
    .map((m, idx) => `--- DOCUMENT ${idx + 1}: ${m.name} (${m.type}) ---\n${m.content}`)
    .join('\n\n');

  return `You are an expert academic curriculum analyzer, knowledge tree architect, and exam preparation strategist.
Analyze the following exam study materials for the exam "${safeExamName}" in subject "${safeSubject}".
Extract a deep, multi-tier hierarchical syllabus tree (考点树状图体系).

GROUNDING RULES:
- Use ONLY the supplied documents. Do not invent chapters, topics, formulas or exam rules that are not supported by the material.
- If the documents are thin, return fewer units instead of padding with generic textbook content.
- Prefer the exact chapter, section and terminology names found in the documents.

TREE HIERARCHY RULES:
1. ROOT NODES (Major Units / 核心大单元): Group content into cohesive units or chapters that actually appear in the material.
2. BRANCH NODES (Granular Subtopics / 细分考点): Under EACH major unit, extract 3-6 concrete, highly granular sub-topics / problem types from the material.
3. LEAF NODES (Key Points & Traps / 核心要点与避坑点): For each subtopic, extract 2-4 specific testable points, governing formulas/theorems, score-earning checkpoints, and common pitfalls that are actually taught in the documents.
4. Ensure comprehensive exam weight distribution (weights summing to roughly 100%) and realistic estimated study hours.
${isZh ? 'CRITICAL: Output ALL titles, descriptions, subtopic titles, key points, and formula notes in natural, academic Simplified Chinese (简体中文).' : ''}

Documents content:
${aggregatedContent.slice(0, 50000)}

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "summary": "2-sentence summary of the knowledge tree scope and highest-yield focus branches",
  "topics": [
    {
      "id": "topic-1",
      "title": "major unit/chapter title",
      "category": "broad domain or module name",
      "description": "overview of the concepts covered in this unit",
      "weightPercentage": 5-40,
      "difficulty": "easy" | "medium" | "hard",
      "userKnowledgeLevel": "beginner" | "intermediate" | "advanced",
      "subtopics": ["1.1 subtopic title", "1.2 subtopic title"],
      "subtopicTree": [
        {
          "id": "sub-1-1",
          "title": "specific subtopic title",
          "keyPoints": ["2-4 concrete concept points or formula notes"],
          "difficulty": "easy" | "medium" | "hard",
          "examFrequency": "high" | "medium" | "low",
          "formulaOrTrap": "brief tip, formula, or common mistake"
        }
      ],
      "estimatedHours": 4-15
    }
  ]
}`;
}

export function buildPlanPrompt(
  preferences: any,
  safeTopics: any[],
  safeMaterials: ClientMaterial[],
  isZh: boolean
): { prompt: string; studyDates: string[] } {
  const allChunks = chunkAllMaterials(safeMaterials);
  const ragContextBlocks: string[] = [];
  const focusQuery = `${preferences.userNeedFocusArea || ''} ${preferences.customPromptRequirement || ''} ${preferences.weakTopicsFocus?.join(' ') || ''}`.trim();

  if (focusQuery && allChunks.length > 0) {
    const topFocusChunks = retrieveTopChunksForQuery(focusQuery, allChunks, { topK: 5 });
    topFocusChunks.forEach((c, idx) => {
      ragContextBlocks.push(`[RAG-CHUNK-FOCUS-${idx + 1}] Source: "${c.materialName}" (${c.materialType}) Section: "${c.sectionTitle}"\nContent Excerpt:\n${c.content.slice(0, 600)}`);
    });
  }

  safeTopics.slice(0, 8).forEach((t: any, idx: number) => {
    if (allChunks.length > 0) {
      const topChunks = retrieveTopChunksForQuery(t.title + ' ' + (t.subtopics?.join(' ') || ''), allChunks, { topK: 3 });
      topChunks.forEach((c, cIdx) => {
        ragContextBlocks.push(`[RAG-CHUNK-TOPIC-${idx + 1}-${cIdx + 1}] Target: "${t.title}" | Source: "${c.materialName}" (${c.materialType}) | Heading: "${c.sectionTitle}"\nExcerpt:\n${c.content.slice(0, 500)}`);
      });
    }
  });

  const ragContextText = ragContextBlocks.length > 0
    ? `\n=== RETRIEVED RAG KNOWLEDGE BASE CHUNKS FROM UPLOADED MATERIALS ===\n${ragContextBlocks.slice(0, 15).join('\n\n')}\n`
    : '';

  const planningStart = preferences.startDate || toLocalDateString();
  const planningExam = preferences.examDate || addDaysToDateString(planningStart, 21);
  const planningDays = Math.min(Math.max(1, daysBetweenDateStrings(planningStart, planningExam)), 60);
  const studyDayLines: string[] = [];
  for (let offset = 0; offset < planningDays; offset += 1) {
    const dateStr = addDaysToDateString(planningStart, offset);
    const weekday = parseLocalDate(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
    const schedule = preferences.dailySchedules?.find(
      (entry: any) => Number(entry?.dayOfWeek) === parseLocalDate(dateStr).getDay()
    );
    if (schedule && !schedule.enabled) continue;
    const availableHours = Number(schedule?.availableHours) > 0 ? Number(schedule.availableHours) : 2;
    studyDayLines.push(`${dateStr} (${weekday}) — ${availableHours}h available`);
  }
  const studyCalendarText = studyDayLines.length > 0
    ? studyDayLines.join('\n')
    : `${planningStart} — limited time before the exam`;

  const prompt = `You are a master learning scientist and RAG study schedule architect.
Create a realistic, scientifically optimized day-by-day exam study plan strictly grounded in the student's uploaded materials and personal needs.
${isZh ? 'CRITICAL: All generated phase names, phase descriptions, task titles, descriptions, key objectives, active recall prompts, and ragSource citations MUST be written in natural, idiomatic Simplified Chinese (简体中文).' : ''}

STUDENT PROFILE & PERSONALIZED STUDY NEEDS:
- Exam Name: ${preferences.examName || 'Final Exam'}
- Subject: ${preferences.subject || 'Academic'}
- Start Date: ${planningStart}
- Exam Date: ${planningExam} (Exam Time: ${preferences.examTime || '09:00'})
- Target Score / Goal: ${preferences.targetScoreOrGrade || 'Top Grade'}
- User Focus Priority: ${preferences.userNeedFocusArea || 'comprehensive'}
- Custom Student Directives: ${preferences.customPromptRequirement || preferences.additionalNotes || 'None'}
- Preferred Session Duration: ${preferences.sessionLengthMinutes} minutes per block
- Priority Weak Topics: ${preferences.weakTopicsFocus?.join(', ') || 'None specified'}

PLANNING CALENDAR (${planningDays} days; these are the ONLY allowed task dates):
${studyCalendarText}

SYLLABUS TOPICS:
${JSON.stringify(safeTopics, null, 2).slice(0, 40_000)}
${ragContextText}

RAG GROUNDING REQUIREMENTS:
1. Every date listed in PLANNING CALENDAR must receive at least one task. Do not skip listed days and do not invent dates outside the list. Split each day into 1-3 blocks whose total durationMinutes does not exceed that day's available hours.
2. Group the timeline into 3-4 study phases derived from this specific material (not a generic template). Each phase needs concrete startDate/endDate and a focus tied to actual topics.
3. For EVERY study task, ground it directly in the uploaded documents and retrieved chunks:
   - title: concise, highly actionable, tied to a real chapter/section or problem from the material
   - description: clear step-by-step guidance on what to read, solve, or produce
   - category: ["theory", "reading", "practice_problems", "active_recall", "flashcards", "mock_exam", "review_weak_spots", "summary_cheat_sheet"]
   - topicTitle: the associated syllabus topic title
   - date: "YYYY-MM-DD" (must be one of the PLANNING CALENDAR dates)
   - startTime / endTime / durationMinutes
   - priority: "high" | "medium" | "low"
   - status: "pending"
   - keyObjectives: array of 2-3 specific mastery checkpoints from the material
   - activeRecallPrompt: self-testing question based on the document concepts
   - groundedUserNeed: explain which student requirement this task satisfies
   - formulaOrRules: 1-2 key formulas or rules that appear in the material (empty array if none)
   - ragSource: cite the real source document and section used
     - documentName: exact name of the uploaded material
     - documentType: "syllabus" | "notes" | "past_exam" | "lecture_slides"
     - sectionTitle: real section or heading
     - pageOrChapter: real chapter/page reference when available, otherwise a short section reference
     - excerptSnippet: quote or close paraphrase of real content from that source (50-150 chars)
     - keyConcepts: array of 2-4 keywords
     - relevanceReason: why this source chunk supports this task
4. Never fabricate document names, chapter numbers, quotes, formulas or exam rules. If a piece of information is not in the materials, omit it rather than inventing it.

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "phases": [ { "id": "phase-1", "name": "...", "description": "...", "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "focus": "..." } ],
  "tasks": [ { "id": "task-1", "title": "...", "description": "...", "category": "reading", "topicTitle": "...", "date": "YYYY-MM-DD", "startTime": "09:00", "endTime": "09:45", "durationMinutes": 45, "priority": "high", "status": "pending", "keyObjectives": ["..."], "activeRecallPrompt": "...", "groundedUserNeed": "...", "formulaOrRules": ["..."], "ragSource": { "documentName": "...", "documentType": "notes", "sectionTitle": "...", "pageOrChapter": "...", "excerptSnippet": "...", "keyConcepts": ["..."], "relevanceReason": "..." } } ],
  "totalPlannedHours": 0
}`;

  return { prompt, studyDates: studyDayLines.map((line) => line.slice(0, 10)) };
}

export function buildRebalancePrompt(currentPlan: any, todayStr: string, reason: string, isZh: boolean): string {
  return `You are an adaptive study coach.
The student needs to dynamically reschedule their remaining exam study plan as of ${todayStr}.
Reason / Trigger: ${reason || 'Student missed past tasks or needs schedule rebalancing'}
${isZh ? 'CRITICAL: The summary and updated task titles/descriptions must be written in natural Simplified Chinese (简体中文).' : ''}

Exam Date: ${currentPlan.examDate}
Exam Name: ${currentPlan.examName}

Daily Available Schedule Preferences:
${JSON.stringify(currentPlan.preferences?.dailySchedules || [])}

Current Tasks Status:
${JSON.stringify(currentPlan.tasks).slice(0, 80_000)}

INSTRUCTIONS:
1. Preserve all tasks that are already 'completed'. Keep their dates unchanged.
2. For all 'pending' or 'skipped' tasks scheduled before ${todayStr}, or remaining uncompleted tasks:
   - Reschedule them intelligently across remaining days from ${todayStr} up to ${currentPlan.examDate}.
   - Balance daily study load without exceeding daily available study hours.
   - If time is tight, merge low-priority tasks into high-yield review sessions and mark their priority appropriately.
3. Return the complete updated tasks array with updated dates, startTimes, endTimes, and prioritized sequence.

Output ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape:
{
  "rebalanceSummary": "...",
  "tasks": [ { "id": "task-1", "title": "...", "description": "...", "category": "reading", "topicTitle": "...", "date": "YYYY-MM-DD", "startTime": "09:00", "endTime": "09:45", "durationMinutes": 45, "priority": "high", "status": "pending", "keyObjectives": ["..."], "activeRecallPrompt": "...", "notes": "...", "confidenceRating": 3 } ]
}`;
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