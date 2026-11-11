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

/* 把别人写好的句子接在自己的句子后面时，先剥掉句尾标点——
   错误信息自己带「。」，直接拼就印成「…不可用。；已按本地规则重排。」，接缝全露出来。
   剥完之后由调用处统一加回一个句点，两种语言的句尾就只剩一种写法。 */
export function trimEndPeriod(text: string): string {
  return String(text || "").replace(/[。.！!？?]+$/, "").trim();
}

/* 「一句现成的话 + 自己补的一句」怎么接：先各自剥掉句尾标点，再按语言接，最后统一收一个句点。
   直接字符串相加会印出「…填写 AI 服务密钥。；资料仍保存在本机。」这种接缝。
   补的那半句不带句尾标点，英文首字母小写（它接在分号后面，不是新句子）。 */
export function appendClause(head: string, tail: string, isZh: boolean): string {
  const parts = [trimEndPeriod(head), trimEndPeriod(tail)].filter(Boolean);
  if (!parts.length) return "";
  return clauseJoin(parts, isZh) + (isZh ? "。" : ".");
}

/* 同一个入口一个名字。「新建科目」在总览页要渲染好几回（百叶窗收起时的竖排、展开时的标题、
   移动端的卡、aria-label），过去分别写成「新建备考科目」「新建考试科目」「Create subject」，
   提示文案里一引用它就指到了界面上并不存在的按钮上。入口字样从这里取。 */
export function newSubjectEntry(isZh: boolean): string {
  return isZh ? "新建科目" : "New subject";
}

/* 「一门科目都没有」这个空状态在总览、今日、空页各渲染一次，过去写着「暂无备考科目」
   「还没有备考科目」「No exam subjects yet」三种。事实只有一个，说法也只留一个。 */
export function noSubjectsTitle(isZh: boolean): string {
  return isZh ? "还没有科目" : "No subjects yet";
}

/* 名称那一栏在向导和编辑弹窗是同一个字段，标签和报错必须指同一个名字，
   否则用户按报错去找那一栏，会找不到叫那个名字的输入框。 */
export function examNameLabel(isZh: boolean): string {
  return isZh ? "考试 / 课程名称" : "Exam or course name";
}

/* 「只填教材名，让 AI 回忆目录」这个入口在向导和科目页各有一个按钮，过去一个叫「整理目录」
   一个叫「按教材目录整理」，提示文案引用时就指错了按钮。入口字样从这里取，
   弹窗里的确认按钮是下一步动作（「整理目录」），和入口不是同一件事，不共用这一份。 */
export function textbookEntry(isZh: boolean): string {
  return isZh ? "按教材目录整理" : "From a textbook";
}

/* 教材那一栏在向导第二步和目录弹窗里是同一个字段，过去标签一处写「教材名」、一处写「教材名称」，
   示例一处是《导游业务》、一处是数据结构——报错说「还没有教材名」时，用户在弹窗里找不到那一栏。
   标签和示例都从这里取，示例只留一份，也不再拿编程教材当默认门面（任何学科都用这一栏）。 */
export function textbookNameLabel(isZh: boolean): string {
  return isZh ? "教材名" : "Textbook name";
}
export function textbookExample(isZh: boolean): string {
  return isZh ? "如：《导游业务》第 4 版" : "e.g. Campbell Biology, 12th ed.";
}

/* 弹窗里那颗按钮是「现在去整理」，第一次和重跑是同一个动作，所以只留一个名字，
   不按次数换成「重新整理目录」/「Re-outline」——次数由旁边的计数筹码说，不由按钮说。 */
export function textbookAction(isZh: boolean): string {
  return isZh ? "整理目录" : "Build outline";
}

/* 目录整理的进度条字样：弹窗自己起一句、aiClient 的 onStatus 又推一句，
   两句会互相盖掉，读起来像换了个任务。进度只有一份，两边都从这里取。 */
export function textbookProgress(isZh: boolean): string {
  return isZh ? "正在整理教材目录…" : "Building the textbook outline…";
}

/* 「.docx 读不出来」在解析器的两个分支和 aiClient 的码表里各出现过一次，对用户是同一个处境，
   说法只留一份：先说事实，再给一个动作。 */
export function docxUnreadable(isZh: boolean): string {
  return isZh
    ? "这份 .docx 读不出来，请确认文件完整未损坏后重试。"
    : "This .docx can't be read. Check that the file is complete, then try again.";
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
