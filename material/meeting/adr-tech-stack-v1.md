# ADR-001：技术栈与架构选型

- **状态**：已采纳（Accepted）
- **日期**：2026-10
- **决策人**：架构 / 全体智能体（依据需求文档第十章建议）
- **关联文档**：`material/design/frontend-design-v1.md`、`material/design/backend-design-v1.md`

---

## 1. Context（背景）

比赛为现场抽题、限时 2~3 小时交付（需求→开发→演示全流程），团队 5 人：1 产品 / 2 后端 / 1 前端 / 1 测试。系统为**单团队模型**的 Web 应用，核心难点是 AI 周报生成与权限隔离，且现场网络/AI 不稳定需降级。

在此背景下，技术选型必须满足：
- 前后端可**并行**（接口契约先冻结）；
- 能在 2~3h 内搭出可演示主流程；
- AI 不可用时业务不中断（降级）；
- 演示数据可预置、重启不丢。

---

## 2. Decision（决策）

| 层 | 选型 | 版本/说明 |
| --- | --- | --- |
| 前端框架 | React + TypeScript | 18.x |
| 构建工具 | Vite | 零配置启动，热更新快 |
| 路由 | React Router | v6，含登录守卫 |
| UI 组件库 | Ant Design（antd） | 5.x，表单/表格/卡片/消息开箱即用 |
| 请求层 | Axios | 统一拦截 401/403/504 |
| 前端状态 | Zustand | 仅存 user/token/week 轻量态 |
| 后端框架 | Node.js + Express + TypeScript | 与前端同源，降低协作成本 |
| 数据存储 | SQLite（`better-sqlite3`） | 文件型、零部署、演示重启不丢；极速场景可用内存 Map 替代 |
| 鉴权 | JWT（`jsonwebtoken`） | 登录签发，有效期 24h |
| AI 调用 | OpenAI 兼容适配器（fetch/SDK） | 统一 Prompt 组装 / 20s 超时 / 重试 / 降级开关 |
| 配置 | `.env` + `dotenv` | 端口、JWT 密钥、LLM Key/BaseURL、`AI_ENABLED` |

**架构形态**：React SPA（前端）→ Express 路由 + Auth 中间件 → 业务 Service 层 → Repository（SQL）→ SQLite；AI 模块（AIService）与业务解耦，通过 `AI_ENABLED` 开关降级。

---

## 3. Consequences（后果）

- **正面**：单语言栈（TS 全栈）降低并行沟通成本；antd 让 5 个页面快速成型；SQLite 免部署；JWT 无状态便于演示切换账号；AI 解耦保证降级不波及主流程。
- **负面 / 风险**：SQLite 并发写入弱（比赛为演示、单写为主，可接受，LEAD-04 已约定最后写入优先）；Node 单进程不满足高并发生产，但比赛无需。
- **约束**：接口契约（`material/design/api-spec-v1.md`）冻结后，前后端各自并行，前端 Mock 先行。

---

## 4. Alternatives（被否的备选）

| 备选 | 为何未选 |
| --- | --- |
| 前端 Vue3 + Element Plus | 与 React 方案等价，但本队更熟 React/TS，故选 React |
| 后端 Python FastAPI + SQLite | 能力等同，但需双语言栈，增加协作摩擦 |
| 后端 MySQL / Postgres | 需独立服务部署，违反"零部署、演示即开即用"原则 |
| 内存存储（纯 Map） | 重启丢数据，演示中断风险高；仅作为 SQLite 的极速备选 |

---

## 5. 变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10 | 初版决策记录 |
| v1.1 | 2026-10 | 后端落地阶段的实际实现差异登记（见第 6 节），接口契约未变 |

---

## 6. 落地实现差异（v1.1 补充，后端实现阶段）

后端已按 `material/design/api-spec-v1.md` 完成全部 10 个契约接口，实现中在**不改变任何接口契约**
的前提下做了以下等效替换，原因均为「比赛现场零构建风险、启动更快」：

| 原决策 | 实际实现 | 理由与影响 |
| --- | --- | --- |
| 数据存储 `better-sqlite3` | **`node:sqlite`（Node 24 内置）** | 数据库仍是 SQLite 文件、SQL 与表结构完全一致；免去原生编译（`better-sqlite3` 需匹配 Node ABI 的预编译包或 VS 构建工具），现场无安装失败风险 |
| 配置 `dotenv` | `node --env-file-if-exists=.env` | Node 原生装载 `.env`，`.env` 文件格式与用法不变，少一个依赖 |
| TS 运行方式（ts-node / 先编译） | **Node 原生类型擦除**，直接 `node src/index.ts` | 无需构建步骤；约束是只能写可擦除语法（禁用 enum / 参数属性 / 非 declare 命名空间），已在 `back/tsconfig.json` 用 `erasableSyntaxOnly` 约束并由 `npm run typecheck` 保证 |
| 设计未定义团队周报持久化 | 新增 `team_summaries(week, payload, generated_at)` 表 | OVR-09 要求「团队周报为生成时快照，不随成员修改自动更新」，OVR-08 要求导出；若不落库，导出需重新调用 AI（20s）且违背快照语义 |
| 契约 10 个接口 | 追加 `GET /api/health`、`GET /api/login/accounts` | 分别提供服务端权威当前周次（前端页头展示）与 4 个预置账号卡片数据（LOGIN-01）；**纯新增，不修改既有接口** |
| Express（未指定版本） | Express 5.3 | npm 当前稳定版；异步处理器抛错可自动进入统一错误中间件，错误码契约行为一致 |

> 结论：**接口层面零偏差**（路径 / 入参 / 出参 / 权限 / 错误码 400-401-403-504-500 均按契约实现），
> 前后端联调不受影响。详细启动方式、接口清单与验证记录见 `back/README.md`。
