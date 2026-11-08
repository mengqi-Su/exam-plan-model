import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {injectCsp} from './csp.config.ts';

/**
 * 只在构建产物里注入 CSP（理由见 csp.config.ts 顶部）。
 * dev 不注入：vite 自己的内联 bootstrap 与 ws: 心跳会逼着策略放开 'unsafe-inline'，
 * 那等于给生产开同一个口子。
 */
const cspMeta: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return injectCsp(html);
    },
  },
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), cspMeta],
    build: {
      rollupOptions: {
        output: {
          /* 只钉两组，其余交给 Rollup 按动态 import 边界自己分（清单 PERF-01）。
             react 单独成块：它不随业务代码变，发一次新版不该让用户重下 220 kB 框架。
             pdf 单独成块：pdfjs 本来就是按需 import 的，给它一个稳定名字，
             免得每次发版都换哈希、缓存全废。
             刻意不写「所有 node_modules 归一个 vendor」——那会把只有阅读器用到的
             markdown 生态（约 180 kB）拽回入口，首屏反而更重。 */
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            if (/[\\/]node_modules[\\/]pdfjs-dist[\\/]/.test(id)) return 'pdf';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 本地开发时把同源云函数路由代理到本机 Deno 函数（dev/function-local.ts）。
      // 生产环境由 Qoder Sites 网关把 /functions/v1/app 路由到部署的 Edge Function。
      proxy: {
        '/functions/v1/app': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  };
});