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

/* 数字和名词分开排版的场合（数字加粗、单位留在灰字里），只需要让后面那个词跟着数走。
   跟 pl() 同一条规则，别在调用处各写一份 n === 1。 */
export function unitNoun(n: number, en: { one: string; many: string }): string {
  return n === 1 ? en.one : en.many;
}

/* 小句之间怎么连、文件名和原因之间用什么标点，都跟着语言走。
   英文界面里印出「；」「：」，是拼句子的时候没问当前是什么语言。 */
export function clauseJoin(parts: string[], isZh: boolean): string {
  return parts.filter(Boolean).join(isZh ? "；" : "; ");
}
export function labelColon(isZh: boolean): string {
  return isZh ? "：" : ": ";
}

/* 书名号只加一次。教材名输入框的示例本身就是「《导游业务》第 4 版」，用户照着打进来再套一层，
   标题就印成《《导游业务》第 4 版》，资料摘要的前缀解析也跟着错位。自己带号的原样留下，
   没带号的才补——弹窗标题、向导摘要、科目页提示共用这一份规矩，不在调用处各写一遍模板。 */
export function formatBookTitle(name: string): string {
  const value = String(name || "").trim();
  if (!value) return "";
  return value.includes("《") || value.includes("》") ? value : `《${value}》`;
}

/* formatBookTitle 的反向：从「<书名>目录 · AI 整理 N 个考点」里取回用户当初填的那个名字。
   书名自己可能带号，所以不能拿第一个》当结尾——一直认到「目录 · 」这个由上面保证的后缀，
   再剥掉正好包住整串的那一对号，两种写法都能原样还原。英文摘要同理解析引号里的那一段。
   兜底词（「教材」/「the textbook」）不是书名，认出来就返回空串，免得回填进输入框。 */
export function bookNameFromSummary(summary: string): string {
  const text = String(summary || "");
  const zh = /^(.*)目录 · /.exec(text);
  const en = /^Outline of "(.*)" · /.exec(text);
  const title = zh ? zh[1] : en ? en[1] : "";
  if (!title) return "";
  const wrapped = /^《(.*)》$/.exec(title);
  const name = wrapped ? wrapped[1] : title;
  return name === "教材" || name === "the textbook" ? "" : name;
}
