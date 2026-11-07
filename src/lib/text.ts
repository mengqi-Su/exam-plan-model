/* 「多少字」全站只有一种算法：空白不计入。
   同一份 PDF 在这里显示 1,187 字、在练习端显示 927 字，用户只会理解成其中一个是坏的。
   注意这只管说给人听的数字：真正决定能不能送进模型的上限仍按原始长度算，
   因为服务端截断的是长度，不是字数。 */
export function visibleChars(text: string): number {
  return String(text || "").replace(/\s/g, "").length;
}

/* 英文计数的单复数只在这一处管。`1 file(s)` 是没人肯在模板里判断单复数留下的写法，
   两头不靠：说人话的英文要么 "1 file" 要么 "3 files"。中文不看这个词，所以只有英文分支调用。 */
export function pl(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/* 小句之间怎么连、文件名和原因之间用什么标点，都跟着语言走。
   英文界面里印出「；」「：」，是拼句子的时候没问当前是什么语言。 */
export function clauseJoin(parts: string[], isZh: boolean): string {
  return parts.filter(Boolean).join(isZh ? "；" : "; ");
}
export function labelColon(isZh: boolean): string {
  return isZh ? "：" : ": ";
}
