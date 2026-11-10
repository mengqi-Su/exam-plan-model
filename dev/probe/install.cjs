/* npm run probe:install —— 把 dev/probe 的两个探针文件装进 dist/，并生成 probe-app.html。
   build 会清空 dist，所以每次构建后要重跑这一步；发布前用 npm run probe:clean 收干净。
   为什么不能内联脚本：dist/index.html 自带 CSP（script-src 'self'），内联 <script> 直接被拦，
   前置脚本只能落成同源的 /probe-prelude.js 再插到 module script 前面。 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const DIST = path.join(ROOT, "dist");
const assets = ["probe-frame.html", "probe-prelude.js"];

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html 不存在：先 npm run build");
  process.exit(1);
}

for (const name of assets) {
  fs.copyFileSync(path.join(__dirname, name), path.join(DIST, name));
}

const marker = '<script type="module"';
const html = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
/* 顺序别反：给 title 打标记会往前插字符，先插标记再算 module 的位置，
   切片坐标就会整体偏掉那几个字节，注入的 script 标签落进字符串里当文本用。 */
const titleTagged = html.replace("<title>", "<title>[PROBE] ");
const at = titleTagged.indexOf(marker);
if (at < 0) {
  console.error('没找到 <script type="module">：构建产物的入口变了，更新 dev/probe/install.cjs');
  process.exit(1);
}
const out = titleTagged.slice(0, at) + '<script src="/probe-prelude.js"></script>\n    ' + titleTagged.slice(at);
fs.writeFileSync(path.join(DIST, "probe-app.html"), out);
console.log(`探针就位：${assets.join(", ")}, probe-app.html (${out.length} B)`);
console.log("打开 http://127.0.0.1:4406/probe-frame.html");
