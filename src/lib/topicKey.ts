/**
 * 考点稳定钥匙 topicKey
 *
 * 联动协议 v1 的核心：Exam Plan 与 StarQuiz 用**完全相同**的算法，
 * 从「层级 + 学科 + 单元 + 子考点」这条内容路径算出同一个十六进制钥匙，
 * 因此两个应用不需要共享存储、不需要登录，也能认出"这是同一个考点"。
 *
 * ⚠️ 本文件的算法、版本前缀与规范化步骤必须与 StarQuiz `web/topicKey.js` 逐字一致。
 * 任何改动都要同步另一端，并跑 `npm run test:topickey`（含两端互校）。
 */

import { sha256Hex as sha256HexFromCrypto } from "./hash";

export const TOPIC_KEY_ALGORITHM = "exam-plan-topic-v1";
export const TOPIC_KEY_PREFIX = "t1_";
/** 取 SHA-256 前 128 bit，即 32 个十六进制字符。 */
export const TOPIC_KEY_HEX_LENGTH = 32;

export type PlanTopicLevel = "unit" | "subtopic";

/** 内容路径：注意 planId 不参与钥匙，只由 linkId 区分计划上下文。 */
export interface TopicPathInput {
  level: PlanTopicLevel | string;
  subject?: string;
  unit?: string;
  topic?: string;
}

export class TopicKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TopicKeyError";
  }
}

/**
 * 分段规范化：NFKC → 折叠连续空白 → 去首尾 → 英文小写。
 * 保留完整长度与标点语义，绝不截断（学科显示名会被截到 20 字，那是展示层的事）。
 */
export function normalizeTopicSegment(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return raw
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** 层级必须参与钥匙，避免"单元名"与同名"子考点名"被当成同一目标。 */
export function requireTopicLevel(level: unknown): PlanTopicLevel {
  const normalized = normalizeTopicSegment(level);
  if (normalized !== "unit" && normalized !== "subtopic") {
    throw new TopicKeyError(`未知的联动层级：${String(level ?? "")}`);
  }
  return normalized;
}

/**
 * 规范化的 JSON 数组路径。用 JSON 而不是分隔符拼接，避免标题里含 ":"、"/" 造成路径歧义。
 * 单元级目标的子考点段固定为空字符串；回程还要比对这条路径，用来发现异常碰撞或算法版本不一致。
 */
export function topicCanonicalPath(input: TopicPathInput): string {
  const level = requireTopicLevel(input?.level);
  return JSON.stringify([
    TOPIC_KEY_ALGORITHM,
    level,
    normalizeTopicSegment(input.subject),
    normalizeTopicSegment(input.unit),
    level === "subtopic" ? normalizeTopicSegment(input.topic) : "",
  ]);
}

/** 钥匙用的哈希就是全站那一个 SHA-256；这里只留名字，免得两端互校时找不着北。 */
export async function sha256Hex(text: string): Promise<string> {
  return sha256HexFromCrypto(text);
}

export async function computeTopicKey(input: TopicPathInput): Promise<string> {
  const hex = await sha256Hex(topicCanonicalPath(input));
  return `${TOPIC_KEY_PREFIX}${hex.slice(0, TOPIC_KEY_HEX_LENGTH)}`;
}

/** linkId = planId + ":" + topicKey —— 同一考点可以同时存在于多个备考计划中。 */
export function composeLinkId(planId: unknown, topicKey: string): string {
  const plan = normalizeTopicSegment(planId);
  const key = String(topicKey || "").trim();
  if (!plan || !key) throw new TopicKeyError("构造 linkId 需要同时具备 planId 与 topicKey。");
  return `${plan}:${key}`;
}
