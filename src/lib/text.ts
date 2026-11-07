/* 「多少字」全站只有一种算法：空白不计入。
   同一份 PDF 在这里显示 1,187 字、在练习端显示 927 字，用户只会理解成其中一个是坏的。
   注意这只管说给人听的数字：真正决定能不能送进模型的上限仍按原始长度算，
   因为服务端截断的是长度，不是字数。 */
export function visibleChars(text: string): number {
  return String(text || "").replace(/\s/g, "").length;
}
