// 本机联调云函数（需要安装 Deno）：npm run dev:function
// 前端 Vite 会把 /functions/v1/app 代理到这里的 127.0.0.1:8000。
// 本机没有 DeepSeek API Key（Deno.env 里的 DEEPSEEK_API_KEY），因此 AI 生成会返回 ai_not_configured；
// 健康检查、输入校验、日历分段、本地重排兜底等无凭据路径仍可联调。
import { handler } from '../functions/handler.ts';

Deno.serve({ hostname: '127.0.0.1', port: 8000 }, handler);