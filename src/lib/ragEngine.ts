import { StudyMaterial, SyllabusTopic, UserStudyPreferences } from "../types";

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
  estimatedDifficulty: "easy" | "medium" | "hard";
  tokenEstimate: number;
}

export interface RagRetrievalResult {
  chunk: DocumentChunk;
  relevanceScore: number;
  matchedKeywords: string[];
  matchReason: string;
}

/**
 * Intelligent client & server chunking for uploaded materials
 */
export function chunkDocumentText(
  materialId: string,
  materialName: string,
  materialType: string,
  text: string
): DocumentChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const cleanText = text.replace(/\r\n/g, "\n").trim();
  
  // Split by structural markers (chapters, headers, question numbers, or double line breaks)
  const paragraphBlocks = cleanText.split(/\n{2,}/);
  const chunks: DocumentChunk[] = [];

  let currentSectionTitle = materialName.replace(/\.[^/.]+$/, "");
  let accumulatedText = "";
  let chunkIdx = 1;

  const commitChunk = (body: string, heading: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 20) return;

    const lower = trimmed.toLowerCase();
    const isExamQuestion =
      materialType === "past_exam" ||
      /(?:第[一二三四五六七八九\d]+题|\b(q\d+|question\d+|problem\d+|ex\d+|\d+[\.、]))/i.test(trimmed) ||
      /(?:选择题|填空题|计算题|简答题|综合题|证明题|问答题)/.test(trimmed);

    const isFormulaOrTheorem =
      /(?:公式|定理|推论|引理|def|theorem|lemma|formula|equation|f\(x\)|∑|∫|lim|log|sin|cos|matrix|\b(o\(n\)|tcp|udp|ip)\b)/i.test(
        trimmed
      );

    // Extract key terminology tokens (Chinese 2-4 char words or English words)
    const keywords: string[] = [];
    const engWords = (trimmed.match(/[A-Za-z]{3,}/g) || []).slice(0, 10);
    keywords.push(...Array.from(new Set(engWords)));

    const zhTerms = (
      trimmed.match(
        /[\u4e00-\u9fa5]{2,6}(?:定理|公式|算法|机制|协议|模型|结构|函数|方程|分析|计算|证明|原理|概念|设计)/g
      ) || []
    ).slice(0, 10);
    keywords.push(...Array.from(new Set(zhTerms)));

    let diff: "easy" | "medium" | "hard" = "medium";
    if (/(?:证明|高阶|综合|推导|难点|复杂|NP|级数|最值|优化)/.test(trimmed) || isExamQuestion) {
      diff = "hard";
    } else if (/(?:简介|概述|基本概念|定义|常识|首日)/.test(trimmed)) {
      diff = "easy";
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

    // Detect if this line is a heading
    const firstLine = trimmedBlock.split("\n")[0].trim();
    const isHeading =
      firstLine.length < 60 &&
      /(?:^#+|^第[一二三四五六七八九\d]+[章节讲单元部分]|^[0-9]+[\.、]|^[A-Z\s]{4,}|^Unit\s*\d+|^Chapter\s*\d+|^Section\s*\d+|^Topic)/i.test(
        firstLine
      );

    if (isHeading) {
      if (accumulatedText.length > 50) {
        commitChunk(accumulatedText, currentSectionTitle);
        accumulatedText = "";
      }
      currentSectionTitle = firstLine.replace(/^[#*\-•\d\.\s]+/, "").trim() || currentSectionTitle;
    }

    accumulatedText += (accumulatedText ? "\n\n" : "") + trimmedBlock;

    // Split if chunk is too large (> 800 chars)
    if (accumulatedText.length >= 800) {
      commitChunk(accumulatedText, currentSectionTitle);
      accumulatedText = "";
    }
  }

  if (accumulatedText.trim().length > 0) {
    commitChunk(accumulatedText, currentSectionTitle);
  }

  // If no structured chunks could be extracted, make at least one chunk
  if (chunks.length === 0 && cleanText.length > 0) {
    commitChunk(cleanText.slice(0, 1000), materialName);
  }

  return chunks;
}

/**
 * Retrieve top relevant chunks for a specific topic, task, or user requirement
 */
export function retrieveRelevantChunks(
  query: string,
  chunks: DocumentChunk[],
  options: {
    topK?: number;
    preferQuestions?: boolean;
    preferFormulas?: boolean;
    filterDifficulty?: "easy" | "medium" | "hard";
  } = {}
): RagRetrievalResult[] {
  if (!chunks || chunks.length === 0) return [];

  const topK = options.topK || 4;
  const lowerQuery = (query || "").toLowerCase();
  const queryTokens = lowerQuery
    .split(/[\s,，、。；;：:!！?？\-_/\\()\[\]]+/)
    .filter((t) => t.length >= 2);

  const scored: RagRetrievalResult[] = [];

  for (const chunk of chunks) {
    let score = 0;
    const matchedKeywords: string[] = [];
    const lowerContent = chunk.content.toLowerCase();
    const lowerHeading = chunk.sectionTitle.toLowerCase();

    // 1. Heading exact/partial match
    for (const tok of queryTokens) {
      if (lowerHeading.includes(tok)) {
        score += 25;
        matchedKeywords.push(tok);
      }
      if (lowerContent.includes(tok)) {
        score += 8;
        if (!matchedKeywords.includes(tok)) {
          matchedKeywords.push(tok);
        }
      }
    }

    // 2. Chunks keyword intersection
    for (const kw of chunk.keywords) {
      const lowerKw = kw.toLowerCase();
      if (lowerQuery.includes(lowerKw)) {
        score += 15;
        if (!matchedKeywords.includes(kw)) {
          matchedKeywords.push(kw);
        }
      }
    }

    // 3. Modifiers based on options
    if (options.preferQuestions && chunk.isExamQuestion) {
      score += 20;
    }
    if (options.preferFormulas && chunk.isFormulaOrTheorem) {
      score += 18;
    }
    if (options.filterDifficulty && chunk.estimatedDifficulty === options.filterDifficulty) {
      score += 10;
    }

    // Baseline minimum presence
    if (score > 0 || chunks.length <= topK) {
      let matchReason = "基于考点关键词精准匹配";
      if (chunk.isExamQuestion) matchReason = "命中了往年真题/习题考查题型";
      else if (chunk.isFormulaOrTheorem) matchReason = "命中了核心公式/定理推导段落";
      else if (matchedKeywords.length > 0)
        matchReason = `命中了「${matchedKeywords.slice(0, 3).join("、")}」相关讲义`;

      scored.push({
        chunk,
        relevanceScore: score,
        matchedKeywords,
        matchReason,
      });
    }
  }

  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return scored.slice(0, topK);
}
