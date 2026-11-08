// CSP 的底线，一次性检查：npm run test:csp
//   1) 策略本身不许悄悄变松：script-src 里没有 'unsafe-inline'/'unsafe-eval'，
//      object/frame/base/form 四条闸门都得在。
//   2) 注入函数确实把 meta 放在 charset 之后——策略解析之前出现的外链不受它管。
//   3) 反面样本：anchor 找不到时必须抛错。构建宁可失败，也不要安静地发布一份没有 CSP 的产物；
//      这条不测的话，改一行 index.html 就能让整套策略形同不存在。
// 测的是我们自己拼出来的那一段策略，不是线上文档里的整串：托管网关会注入它自己的加载脚本，
// 并补一条带哈希的 script-src-elem。那条不属于这里任何一条断言，也别为了让两处字符串相等
// 就把手上这份策略放松——线上多出来的是哈希白名单，不是 'unsafe-inline'。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTENT_SECURITY_POLICY, injectCsp } from '../csp.config.ts';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const directives = new Map(
  CONTENT_SECURITY_POLICY.split('; ').map((part) => {
    const [name, ...rest] = part.split(' ');
    return [name, rest.join(' ')] as const;
  })
);

const KNOWN = new Set([
  'default-src', 'script-src', 'style-src', 'font-src', 'img-src', 'connect-src',
  'worker-src', 'object-src', 'base-uri', 'form-action', 'frame-src'
]);

await check('每一条指令名都是真的（拼错的指令会被浏览器整条忽略）', () => {
  for (const name of directives.keys()) assert.ok(KNOWN.has(name), `未知指令 ${name}`);
});

await check('脚本只允许同源：没有 unsafe-inline，也没有 unsafe-eval', () => {
  assert.equal(directives.get('script-src'), "'self'");
  assert.ok(!CONTENT_SECURITY_POLICY.includes('unsafe-eval'));
  /* style-src 的 unsafe-inline 是给 style={{…}} 属性留的，写清楚原因，别被当成疏忽 */
  assert.ok(directives.get('style-src')!.includes("'unsafe-inline'"));
});

await check('四道闸门都在：object / frame / base / form', () => {
  assert.equal(directives.get('object-src'), "'none'");
  assert.equal(directives.get('frame-src'), "'none'");
  assert.equal(directives.get('base-uri'), "'self'");
  assert.equal(directives.get('form-action'), "'self'");
});

await check('只跟自己的云函数说话，策略里没有任何第三方主机', () => {
  assert.equal(directives.get('connect-src'), "'self' blob:");
  /* 字体改系统栈之后（清单 UI-02），googleapis / gstatic 两条白名单就该跟着撤掉：
     留着等于给一个已经不存在的请求继续开门。 */
  assert.equal(directives.get('font-src'), "'self'");
  assert.ok(!CONTENT_SECURITY_POLICY.includes('https://'), '策略里不该再出现任何外部主机');
});

await check('文档与策略同步：index.html 不再外链字体样式表', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  /* 这两条必须一起改。只删策略里的 host 而留下 <link>，线上就是一份被 CSP 拦掉的
     渲染阻塞请求；只删 <link> 而留下 host，则是白留一条外部门。 */
  assert.ok(!html.includes('fonts.googleapis.com'), 'index.html 仍在向 googleapis 取字体样式表');
  assert.ok(!html.includes('fonts.gstatic.com'), 'index.html 仍在预连接 gstatic');
});

await check('注入位置在 charset 之后，且重复构建不会插两遍', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const out = injectCsp(html);
  const charset = out.indexOf('<meta charset');
  const csp = out.indexOf('Content-Security-Policy');
  assert.ok(charset >= 0 && csp > charset, 'CSP 必须排在 charset 后面');
  assert.ok(out.includes('<meta name="referrer" content="same-origin">'));
  assert.equal(injectCsp(out), out, '幂等：第二遍不能再插一条');
});

await check('守卫有效：锚点丢了就抛错，不会发布没有 CSP 的产物', () => {
  assert.throws(() => injectCsp('<!doctype html><html><head><title>x</title></head></html>'), /CSP 注入失败/);
});

console.log(`\n${passed} csp checks passed`);
