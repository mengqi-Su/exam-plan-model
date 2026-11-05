import { ExamStudyPlan } from "../types";

/**
 * 页面封面 = Notion 页头那条背景带。
 *
 * 规则只有一条：封面是装饰，不承载信息也不承载动作——科目身份仍然归 planIcon，
 * 侧栏 / 总览卡 / 日历标签都不跟着换封面，否则一个事实就有两套说法。
 * 它只出现在「打开这份科目文档」的那一页页头，图标压在它的下沿上。
 *
 * 两种来源：内置纹理（纯 CSS，零资源、零存储、离线可用）和用户上传的图片
 * （压到长边 1600 再存 data URL，进 IndexedDB 的 plan 记录里）。
 * 存法上两者一眼分得开：内置是 "preset:<id>"，图片是 "data:image/..."。
 *
 * 纹理一律走浅色的纸质调子：页头下面是深色标题，压深了就成了营销 hero。
 */

export interface CoverPreset {
  id: string;
  zh: string;
  en: string;
  /** 直接可写进 style.background 的 CSS 图层，先纹理后底色。 */
  background: string;
}

/** 细斜纹 + 交叉纹叠出来的纸感，透明度压到 0.02 上下，远看是质感近看是干净。 */
const grain = (angle: number, alpha: number) =>
  `repeating-linear-gradient(${angle}deg, rgba(28,27,26,${alpha}) 0 1px, rgba(255,255,255,0) 1px 7px)`;

const sheen = (from: string, to: string) =>
  `radial-gradient(120% 95% at 12% 0%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 58%), linear-gradient(180deg, ${from} 0%, ${to} 100%)`;

export const COVER_PRESETS: CoverPreset[] = [
  { id: "paper", zh: "纸纹", en: "Paper", background: `${grain(135, 0.022)}, ${grain(45, 0.014)}, ${sheen("#f1eee6", "#e5e1d6")}` },
  { id: "mist", zh: "雾蓝", en: "Mist", background: `${grain(135, 0.018)}, ${sheen("#e9f0f8", "#dbe6f1")}` },
  { id: "moss", zh: "苔绿", en: "Moss", background: `${grain(135, 0.018)}, ${sheen("#e9f0e7", "#dae4d8")}` },
  { id: "wheat", zh: "麦黄", en: "Wheat", background: `${grain(135, 0.02)}, ${sheen("#faf0cf", "#f2e2b0")}` },
  { id: "clay", zh: "陶土", en: "Clay", background: `${grain(135, 0.018)}, ${sheen("#f6e8e0", "#eed9cf")}` },
  { id: "slate", zh: "石墨", en: "Slate", background: `${grain(135, 0.02)}, ${grain(45, 0.012)}, ${sheen("#ececeb", "#dcdcd9")}` },
];

const PRESET_PREFIX = "preset:";

export function presetCoverId(value?: string): string | null {
  if (!value || !value.startsWith(PRESET_PREFIX)) return null;
  return value.slice(PRESET_PREFIX.length) || null;
}

export function findPreset(value?: string): CoverPreset | null {
  const id = presetCoverId(value);
  if (!id) return null;
  return COVER_PRESETS.find((preset) => preset.id === id) || null;
}

export function toPresetValue(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

export function coverImageSrc(value?: string): string | null {
  return value && value.startsWith("data:image/") ? value : null;
}

/** 有没有封面决定页头怎么排：有就把图标压在下沿上，没有就沿用原来的三段。 */
export function hasCover(plan: Pick<ExamStudyPlan, "cover">): boolean {
  return Boolean(findPreset(plan.cover) || coverImageSrc(plan.cover));
}

/** 长边压到 1600 足够铺满最宽的页头带；再大只是把本地库撑爆。 */
const MAX_COVER_EDGE = 1600;
const MAX_COVER_INPUT_BYTES = 12 * 1024 * 1024;

export type CoverReadError = "type" | "size" | "decode" | "canvas";

/**
 * 读成封面用的 data URL：先限尺寸，再等比缩到长边 1600，最后按 webp（不支持就 jpeg）
 * 重新编码。透明底先铺一层应用纸色，免得转 jpeg 时变成黑块。
 */
export async function readCoverImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw coverError("type");
  if (file.size > MAX_COVER_INPUT_BYTES) throw coverError("size");

  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(coverError("decode"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(coverError("decode"));
    el.src = raw;
  });

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) throw coverError("decode");

  const scale = Math.min(1, MAX_COVER_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw coverError("canvas");
  ctx.fillStyle = "#f8f7f4";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let encoded = "";
  try {
    encoded = canvas.toDataURL("image/webp", 0.82);
  } catch {
    encoded = "";
  }
  if (!encoded.startsWith("data:image/webp")) {
    try {
      encoded = canvas.toDataURL("image/jpeg", 0.82);
    } catch {
      throw coverError("canvas");
    }
  }
  if (!encoded.startsWith("data:image/")) throw coverError("canvas");
  return encoded;
}

function coverError(code: CoverReadError): Error & { code: CoverReadError } {
  const error = new Error(`cover:${code}`) as Error & { code: CoverReadError };
  error.code = code;
  return error;
}

export function coverErrorMessage(code: unknown, isZh: boolean): string {
  if (code === "size") {
    return isZh ? "图片超过 12MB，先压一下再传。" : "That image is over 12MB. Shrink it first.";
  }
  if (code === "type") {
    return isZh ? "只能选图片文件。" : "Only image files work as a cover.";
  }
  return isZh ? "这张图片读不出来，换一张或选内置纹理。" : "That image could not be read. Try another file or a built-in texture.";
}
