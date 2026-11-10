/* npm run probe:serve —— 一次性静态服务器，绝对根 = dist，端口 4406。
   根必须是绝对路径：相对根会跟着 shell 的 cwd 漂，探针里 /assets/… 就 404 了。
   只在本机验证时开着，验证完 Ctrl+C 或让调用方结束进程，别留孤儿。 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../../dist");
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let file = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);
    if (!file.startsWith(path.resolve(ROOT))) {
      res.writeHead(403);
      return res.end("nope");
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 " + urlPath);
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  })
  .listen(4406, "127.0.0.1", () => console.log("probe server on http://127.0.0.1:4406/probe-frame.html"));
