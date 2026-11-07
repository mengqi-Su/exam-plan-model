/* 构建期内容安全策略（清单 SEC-02）
 *
 * 为什么写在文档里而不是响应头：Qoder Sites 的网关不提供给应用自定义响应头的能力
 * （能改的只有站点名、访问策略这些），所以 HSTS / X-Content-Type-Options / X-Frame-Options
 * 这些只能等平台侧；meta 能承载的部分——脚本来源、object、base、form、connect——
 * 由这份策略管住。
 *
 * 为什么只在 build 注入：vite dev 会往 HTML 里塞自己的内联 bootstrap，并把 HMR 走成 ws:。
 * 为了让开发服务器不报错而放开 'unsafe-inline' + ws: 的 connect，等于给生产策略开同一个口子。
 * 本机验证走 npm run build + vite preview，看到的就是要发布的那一份。
 *
 * 为什么这里可以 script-src 'self' 而不带 'unsafe-inline'：界面全部由 React 渲染，
 * 站内没有任何内联事件属性；这正是 StarQuiz 那边暂时做不到的收紧程度。
 *
 * 线上看到的策略会比这份多一条，不是构建出错：托管网关会往返回的 HTML 里注入它自己的
 * 资源加载脚本，并跟着补一条 script-src-elem 'self' 'sha256-<那条脚本的哈希>'，好让它
 * 注入的那一段能跑。哈希只对那一段有效，既没放开 'unsafe-inline'，也没放开任何第三方源，
 * 「别的脚本进不来」这条结论不受影响——但别拿线上文档跟这里的字符串直接对比，
 * 要对的是「我们自己写进去的那一段」。
 */

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 没有内联脚本、没有 eval：vite 产物是外链 module，pdf.js 与解析库全在同源 chunk 里
  "script-src 'self'",
  // 'unsafe-inline' 是给组件的 style={{…}} 属性留的；字体样式表来自 googleapis
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // data: 给封面与 favicon，blob: 给本地资料预览与导出的下载链接
  "img-src 'self' data: blob:",
  // 浏览器只跟自己的云函数说话：AI Key 与用户资料都不经第三方
  "connect-src 'self' blob:",
  // pdf.js 的 worker 与它的 cmaps 都打包在同源产物里
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // 站内不嵌任何 frame；跳出去用的是链接，不受这条管
  "frame-src 'none'"
].join('; ');

const ANCHOR = '<meta charset="UTF-8" />';

/**
 * 把 CSP 与 referrer 策略插到 charset 之后：位置有讲究——策略解析之前出现的外链
 * 不受它管。charset 是源文件第一行 meta，插在它后面最稳。
 */
export function injectCsp(html: string): string {
  if (!html.includes(ANCHOR)) {
    // 宁可构建失败，也不要安静地发布一个没有 CSP 的版本
    throw new Error(`CSP 注入失败：index.html 里找不到「${ANCHOR}」这一行`);
  }
  if (html.includes('Content-Security-Policy')) return html;
  const injected =
    `${ANCHOR}\n    ` +
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}">\n    ` +
    `<meta name="referrer" content="same-origin">`;
  return html.replace(ANCHOR, injected);
}
