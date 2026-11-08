/* 科目身份色：日历上的小圆点、掌握度轮盘的扇形与进度条，都从这里取色。
 *
 * 这里原来是一整套 GLOBAL_PALETTES（14 个字段 × 4 套），但全站只读 accentColor 一个字段，
 * 其余 13 个（含 text-[#111111] / text-[#333333] / text-[#F5F5F5] 这些字面量）零引用；
 * getPaletteByString 也没有调用方。死声明留着只会让人以为还有第二套配色可用（清单 UI-03）。
 *
 * 四个色相沿用资料文件夹的那一组（赭黄 / 蓝灰 / 陶土 / 苔绿），但都压深到能同时当图形和文字用：
 * 在纸白 #f8f7f4 上 4.72–5.75:1，在最浅的进度条轨道 #f1efe9 上 4.40–5.35:1，都过 3:1 的图形下限；
 * 配白字 5.06–6.16:1，过 4.5:1 的文字下限，所以扇形里的数值可以直接印白字。
 * 资料夹标签是这套颜色印在自己的浅色底上（#FBF3DC…#EDF3EE），也有 4.57–5.37:1——
 * 原来那组 #D9A521 / #6E8CA8 / #A9756A / #6F9A78 在同一块底上只有 2.03–3.37:1，是一行读不出来的小字。
 * 原来的 #FCD33B / #D8D8D8 / #B5B5B5 在轨道上只有 1.24–1.78:1——进度条其实看不见；
 * 而第四套 #282828 上印 #1c1b1a 只有 1.17:1，那一格扇形的数值是隐形的。 */
const COURSE_ACCENTS = ["#8A6A12", "#46658A", "#8A5348", "#4A7353"] as const;

/** 按科目序号取一个稳定的身份色；负数、小数与非数字都收回到环内，不会取出 undefined。 */
export function getCourseAccent(index: number): string {
  const n = Number.isFinite(index) ? Math.abs(Math.trunc(index)) : 0;
  return COURSE_ACCENTS[n % COURSE_ACCENTS.length];
}