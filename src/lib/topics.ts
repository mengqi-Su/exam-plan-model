import { SyllabusTopic } from "../types";

/**
 * 考点合并在这一处：资料提炼、教材目录回忆、手动添加三条来路都要并进同一份列表，
 * 只按标题去重（忽略大小写与空白），谁先来谁保留。不在各组件里各写一遍 filter/map。
 */

/** 标题归一化只这一把钥匙：合并去重和「这本教材这几章你已经有了」都用它，两处口径必须一致。 */
export function normalizeTopicTitle(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/\s+/g, "");
}

function titleKey(topic: SyllabusTopic): string {
  return normalizeTopicTitle(topic.title);
}

export function mergeTopics(base: SyllabusTopic[], incoming: SyllabusTopic[]): SyllabusTopic[] {
  const out: SyllabusTopic[] = [];
  const seen = new Set<string>();
  const seenIds = new Set<string>();
  [...base, ...incoming].forEach((topic, index) => {
    if (!topic || typeof topic.title !== "string" || !topic.title.trim()) return;
    const key = titleKey(topic);
    if (seen.has(key)) return;
    seen.add(key);
    // id 是排程与深链的钥匙，重名章节撞 id 时补后缀，不能让两条考点共用一把钥匙。
    let id = String(topic.id || `topic-${index + 1}`);
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${String(topic.id || `topic-${index + 1}`)}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);
    out.push({ ...topic, id });
  });
  return out;
}

/** 重新整理教材目录时，旧的教材考点整批换掉，其他来源原样保留。 */
export function replaceTextbookTopics(
  current: SyllabusTopic[],
  textbookTopics: SyllabusTopic[]
): SyllabusTopic[] {
  return mergeTopics(
    current.filter((topic) => topic.source !== "textbook"),
    textbookTopics
  );
}

/** 教材目录弹窗要比对的「已有考点」：教材回忆的那一批不算，否则每次重理都自称重复。 */
export function nonTextbookTitles(topics: SyllabusTopic[]): string[] {
  return topics.filter((topic) => topic.source !== "textbook").map((topic) => topic.title);
}
