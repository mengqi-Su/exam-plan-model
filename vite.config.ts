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