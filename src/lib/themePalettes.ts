// Global 4-Color Theme System (Canary Yellow, Concrete Gray, Stone Gray, Dark Slate)

export interface ThemePalette {
  id: string;
  name: string;
  nameZh: string;
  bg: string;
  tabBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  badgeBg: string;
  btnBg: string;
  btnSecondary: string;
  accentColor: string;
  subtleBg: string;
  highlightBorder: string;
}

export const GLOBAL_PALETTES: ThemePalette[] = [
  {
    id: "canary-yellow",
    name: "Canary Yellow",
    nameZh: "明黄档案",
    bg: "bg-[#FCD33B]",
    tabBg: "bg-[#FCD33B]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#333333]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white text-[#111111] hover:bg-[#f2f2f2] border border-[#111111]",
    accentColor: "#FCD33B",
    subtleBg: "bg-[#FCD33B]/20",
    highlightBorder: "border-[#FCD33B]",
  },
  {
    id: "concrete-gray",
    name: "Concrete Gray",
    nameZh: "水泥浅灰",
    bg: "bg-[#D8D8D8]",
    tabBg: "bg-[#D8D8D8]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#444444]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    accentColor: "#D8D8D8",
    subtleBg: "bg-[#D8D8D8]/30",
    highlightBorder: "border-[#D8D8D8]",
  },
  {
    id: "stone-gray",
    name: "Stone Gray",
    nameZh: "岩石中灰",
    bg: "bg-[#B5B5B5]",
    tabBg: "bg-[#B5B5B5]",
    border: "border-[#111111]",
    textPrimary: "text-[#111111]",
    textSecondary: "text-[#222222]",
    badgeBg: "bg-[#111111] text-white",
    btnBg: "bg-[#111111] text-white hover:bg-[#262626]",
    btnSecondary: "bg-white text-[#111111] hover:bg-[#f0f0f0] border border-[#111111]",
    accentColor: "#B5B5B5",
    subtleBg: "bg-[#B5B5B5]/25",
    highlightBorder: "border-[#B5B5B5]",
  },
  {
    id: "dark-slate",
    name: "Dark Slate",
    nameZh: "黑曜曜岩",
    bg: "bg-[#282828]",
    tabBg: "bg-[#282828]",
    border: "border-[#111111]",
    textPrimary: "text-[#F5F5F5]",
    textSecondary: "text-[#BDBDBD]",
    badgeBg: "bg-white text-[#111111]",
    btnBg: "bg-white text-[#111111] hover:bg-[#E5E5E5]",
    btnSecondary: "bg-[#1A1A1A] text-white hover:bg-[#333333] border border-white/30",
    accentColor: "#282828",
    subtleBg: "bg-[#282828]/15",
    highlightBorder: "border-[#282828]",
  },
];

/**
 * Deterministically get one of the 4 palettes by course/subject index or string hash
 */
export function getPaletteByIndex(index: number): ThemePalette {
  const safeIdx = Math.abs(index) % GLOBAL_PALETTES.length;
  return GLOBAL_PALETTES[safeIdx];
}

export function getPaletteByString(key: string): ThemePalette {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  return getPaletteByIndex(hash);
}
