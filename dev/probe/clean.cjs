/* npm run probe:clean —— 发布前必跑：把 dist/ 里的探针文件删干净并核对没有残留。
   探针一旦跟着上线，等于把「随便写 IndexedDB」的入口暴露在真实用户的浏览器里。 */
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "../../dist");
const KNOWN = ["probe-frame.html", "probe-prelude.js", "probe-app.html"];

for (const name of KNOWN) {
  const at = path.join(DIST, name);
  if (fs.existsSync(at)) fs.rmSync(at);
}

const left = fs.existsSync(DIST) ? fs.readdirSync(DIST).filter((n) => /probe/i.test(n)) : [];
if (left.length) {
  console.error("dist/ 里还有探针文件，别发布：" + left.join(", "));
  process.exit(1);
}
console.log("dist/ 干净：" + KNOWN.length + " 个探针文件已清除，无残留");
