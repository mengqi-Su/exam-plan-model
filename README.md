# Exam Plan AI

本地优先（local-first）的备考规划器：上传考纲、讲义、真题或笔记，让模型整理出考点，再按考试日期自动排出每天该复习什么。

所有科目、资料、计划、完成记录都存在**你自己的浏览器**里。服务端只做一件事：调用模型。没有账号、没有后端数据库，关掉页面数据也还在，清掉站点数据才会丢。

- **运行环境**：Node.js 20+；本地联调云函数另需 Deno
- **数据**：全部在浏览器 IndexedDB，无账号、无后端数据库
- **依赖密钥**：是（DeepSeek），未配置时降级为本地规则
- **界面语言**：中文 / English，在「设置」里切换

## 目录

- [功能](#功能)
- [界面语言](#界面语言)
- [快速开始](#快速开始)
- [配置](#配置)
- [常用脚本](#常用脚本)
- [项目结构](#项目结构)
- [设计约定](#设计约定)
- [已知限制](#已知限制)

## 功能

- **科目总览**：每门科目一张卡，显示考试日期、D-N 倒计时、整科进度和今日完成数；没传资料的科目会直接告诉你下一步该做什么。
- **从资料生成计划**：三步向导——填考试信息 → 选资料（上传文件或让 AI 按教材名整理目录）→ 生成计划。「先建科目，资料稍后再传」可以先只存下考试信息。
- **每日执行**：「今日」一屏列出当天任务，可勾选完成、记录专注时长与掌握度。
- **科目页**：Notion 式文档页，含封面带、阶段路线图、考点掌握度、资料与考点知识库。
- **日历视图**：全部科目合并到一张月历上，看出哪天撞车。
- **自适应重排**：落后或超前后，按剩余时间和每天可学时长重新分配任务。

## 界面语言

中文与 English 两套界面，走同一组文案键：

- 入口：「设置 → 界面语言」。
- 选择存在 `localStorage`（键 `exam_planner_language_preference`），刷新后保持。
- 首次打开默认中文；没有读取浏览器语言偏好做自动判断。
- 日期、星期、倒计时文案（`还剩 N 天` / `N days left`）跟着界面语言一起变，口径统一在 `src/lib/i18n.tsx` 与 `src/lib/date.ts`。
- 英文文案的两条底线由 `dev/copy-guard.test.ts` 守着：计数不写 `file(s)` 这类斜杠形式，英文句子里不漏中文标点。
- 组件里的典型写法是 `tt("中文", "English")`，两套文案写在同一处，改的时候不会只改一半。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite 6 |
| 样式 | Tailwind CSS v4（设计标尺集中在 `src/index.css`） |
| 存储 | IndexedDB（本地，无账号） |
| 文档解析 | `pdfjs-dist` + Word / PPTX 文本抽取 + `jszip` |
| 云函数 | Deno（`functions/`），只负责调模型 |
| 模型 | DeepSeek Chat Completions API |
| 部署 | Qoder Sites |

## 快速开始

```bash
# Node.js 20+
npm install
npm run dev            # 前端 http://localhost:5173
npm run dev:function   # 另开一个终端：本地联调云函数，127.0.0.1:8000
```

没有模型密钥也能跑：计划重排会退回本地规则，考点/计划生成会明确提示 AI 未启用。

## 配置

| 变量 | 必填 | 作用 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` / `API_KEY` | AI 功能必填 | 模型密钥，前者优先 |
| `DEEPSEEK_MODEL` | 可选 | 覆盖默认模型 |

密钥只在云函数运行时读取，**不要写进浏览器代码、构建产物或日志**。完整说明见 [`.env.example`](.env.example)，线上配置在 Qoder Sites 的应用 Secret 里。

## 常用脚本

```bash
npm run lint           # tsc --noEmit
npm run build          # 产出 dist/
npm run preview        # 预览构建结果
npx tsx dev/planner.test.ts   # 单个回归测试，见下
```

<!-- 维护者注：dev/ 下的 .test.ts 目前未登记到 package.json 的 scripts 里，
     下表的命令是逐文件直接跑；新增测试时同步补到这里。 -->

### 回归测试

`dev/` 下每个 `.test.ts` 都对应一处容易改坏的口径：

```bash
npx tsx dev/planner.test.ts        # 规划核心
npx tsx dev/countdown.test.ts      # 倒计时口径
npx tsx dev/readiness.test.ts      # 「还差什么」判定
npx tsx dev/design-scale.test.ts   # 字阶/对比度守卫
npx tsx dev/focus.test.ts          # 焦点可见性守卫
npx tsx dev/csp.test.ts            # CSP 未被放宽
npx tsx dev/zip-bomb.test.ts       # 压缩包炸弹防护
npx tsx dev/topicKey.test.ts       # 考点键与 StarQuiz 对齐
```

## 项目结构

```
src/
  App.tsx                 应用外壳、标签路由、数据加载
  index.css               设计标尺（字阶 / 圆角 / 颜色 / 焦点环）
  components/             功能组件（科目、今日、日历、弹窗、上传）
  lib/                    纯逻辑：日期、倒计时、资料选择、就绪判定、考点键
functions/
  index.ts                Deno 入口
  handler.ts              路由与请求校验
  llm.ts                  DeepSeek 调用与模型回退
  planner.ts              计划生成与重排
  requestGuard.ts         限流与输入防护
dev/                      回归测试与本地函数联调
```

## 设计约定

- 字阶只有六级：页标题 24 / 数字 20 / 段标题 15 / 正文 13 / 元信息 12 / 胶囊 11，由 `dev/design-scale.test.ts` 守着。
- 圆角只用 8 / 12 / 999；阴影只分卡片、抬起、弹窗三档。
- 焦点指示只有一个出处（`:focus-visible`），组件里禁止写 `outline-none`，由 `dev/focus.test.ts` 守着。
- 分隔符不用「·」串元信息，标签不用全大写加字距。

## 已知限制

- AI 相关功能依赖云函数里的模型密钥；本机不跑云函数时这些入口会提示不可用。
- 数据只在本浏览器，换设备或清理站点数据不会自动同步。
- 线上站点的 CSP 会被托管网关改写，不要照着线上那份响应头调本仓库策略。

## 相关项目

配套练习平台 [StarQuiz](https://github.com/mengqi-Su/starquiz)：把这里的考试、资料与真题变成选择题练习和模拟考试。
