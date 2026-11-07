import { StudyMaterial } from "../types";
import { sha256Hex } from "./hash";

/* 资料并进列表只有这一条规则：先给正文算指纹，再按正文去重，最后才轮到份数上限。
   上传、粘贴、资料库弹窗三个入口都走这里，免得哪天只有其中一个记得去重。 */

/**
 * 内容哈希是这份正文的指纹：改了文件名、换了导出格式，正文一样就还是同一份资料。
 * 算不出来（非 HTTPS/localhost 环境没有 Web Crypto）就留空，去重退回逐字比对正文，
 * 绝不因为指纹缺失把用户的资料挡在门外。
 */
export async function withContentHash<T extends Pick<StudyMaterial, "content" | "contentHash">>(
  material: T
): Promise<T> {
  if (material.contentHash) return material;
  try {
    return { ...material, contentHash: await sha256Hex(material.content || "") };
  } catch {
    return material;
  }
}

export async function withContentHashes<T extends Pick<StudyMaterial, "content" | "contentHash">>(
  materials: T[]
): Promise<T[]> {
  return Promise.all(materials.map((material) => withContentHash(material)));
}

function isSameContent(a: StudyMaterial, b: StudyMaterial): boolean {
  if (a.contentHash && b.contentHash) return a.contentHash === b.contentHash;
  // 老资料没有指纹（去重上线前存的），就逐字比正文：这仍然比文件名+体积准，
  // 也不会因为升级过一次就把同内容换个名字的重复放进库。
  return a.content === b.content;
}

export interface MaterialMergeResult {
  /** 真正该并进列表的那几份，顺序就是用户上传的顺序 */
  accepted: StudyMaterial[];
  /** 内容与已有资料（或本批前一份）相同、这次没进的那几份 */
  duplicates: number;
  /** 因为份数上限没位置而留在外面的份数 */
  overflow: number;
}

export async function mergeMaterials(
  existing: StudyMaterial[],
  incoming: StudyMaterial[],
  limit: number
): Promise<MaterialMergeResult> {
  const stamped = await withContentHashes(incoming);
  const accepted: StudyMaterial[] = [];
  let duplicates = 0;
  for (const material of stamped) {
    if (existing.some((held) => isSameContent(held, material)) || accepted.some((held) => isSameContent(held, material))) {
      duplicates += 1;
      continue;
    }
    accepted.push(material);
  }
  const room = Math.max(0, limit - existing.length);
  return { accepted: accepted.slice(0, room), duplicates, overflow: Math.max(0, accepted.length - room) };
}

/** 去重说人话：跳过几份、为什么，够一句话就够，不再补一句「下次注意」。 */
export function duplicateMaterialsNotice(count: number, isZh: boolean): string {
  return isZh
    ? `已跳过 ${count} 份内容重复的资料。`
    : `Skipped ${count} material(s) with the same content.`;
}
