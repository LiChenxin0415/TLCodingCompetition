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
