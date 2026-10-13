# 后端概要设计（Backend High-Level Design）

- **文档版本**：v1.0
- **对应需求**：`需求文档/AI智能周报系统需求文档V2.0 副本.docx`
- **影响模块**：`back`
- **更新日期**：2026-10

> 接口详细契约（路径 / 入参 / 出参 / 错误码）见同目录 `api-spec-v1.md`，本文档聚焦架构、模块、数据模型与 AI 服务设计。

---

## 一、设计目标与原则

依据需求第四章（功能）、第六章（数据字典与接口契约）、第七章（异常边界）、第十章（技术方案）实现后端服务，承担：

1. **四类接口**：用户（登录）、周报（增删改查）、模板（查询）、AI 生成（个人 / 团队汇总 / 导出）。
2. **权限校验（AUTH-01/02/03）**：服务端强制越权拦截，前端仅做展示层控制。
3. **数据持久化**：按 6.1 数据模型建表，预置 4 账号与演示历史周报（REP-04）。
4. **AI 服务封装**：统一 LLM 调用模块（Prompt 组装 / 解析 / 20s 超时 / 重试 / 降级），对前端只暴露「生成」语义；AI 不可用时业务接口不受影响。

---

## 二、技术选型建议

| 维度 | 选型 | 说明 |
| --- | --- | --- |
| 语言 / 框架 | Node.js + Express + TypeScript | 与前端同源、轻量，2 人后端可在 2~3h 内完成 |
| ORM / 数据访问 | 原生 SQL 或 Knex | 表结构简单，直接写 SQL 更直观 |
| 数据存储 | **SQLite**（`better-sqlite3`） | 零部署、文件型、演示重启不丢数据；若求极速可用内存 `Map`（重启丢数据，仅演示可行） |
| 鉴权 | JWT（jsonwebtoken） | 登录签发 token，有效期 24h（AUTH-03） |
| AI 调用 | OpenAI 兼容 SDK / fetch 直连 | 统一 LLM 适配器，便于换模型/换 Key（第十四章风险应对） |
| 配置 | `.env` + `dotenv` | 端口、JWT 密钥、LLM Key/BaseURL、降级开关 |

> 若团队偏好 Python，可等价替换为 FastAPI + SQLite，模块与接口划分不变。

---

## 三、系统架构

```
客户端 (React SPA)
   │  HTTP / JSON
   ▼
API 网关层 (Express Router + 中间件)
   ├── Auth 中间件         token 校验(401) / 角色与资源归属(403)
   ├── 路由层
   │    ├── /api/login          用户模块
   │    ├── /api/template       模板模块（常量）
   │    ├── /api/reports/*      周报模块（CRUD + 权限）
   │    └── /api/reports/...    AI 模块（generate / team-summary / export）
   ├── 业务服务层 (services)
   │    ├── UserService          登录、预置账号、token 签发
   │    ├── ReportService        周报 CRUD、状态机、按周/按人查询、并发覆盖
   │    ├── TemplateService      内置模板常量
   │    └── AIService            Prompt 组装、LLM 调用、超时/重试、降级、解析
   ├── 数据访问层 (repositories)  UserRepo / ReportRepo
   └── 存储 (SQLite)
```

**并行解耦**：AI 模块（AIService）与业务接口（ReportService）解耦，通过配置开关 `AI_ENABLED` 控制；关闭或超时即走降级（GEN-07），业务接口零影响（第十章 10.2）。

---

## 四、模块划分

### 4.1 用户模块（UserModule）
- `POST /api/login`：按 `userId` 查预置账号，签发 JWT（24h）。无密码（LOGIN-02）。
- 预置账号（需求 4.1）：`leader01/王负责人/leader`、`member01/李成员/member`、`member02/张成员/member`、`member03/刘成员/member`。
- 角色切换通过重新登录实现（AUTH-04）。

### 4.2 模板模块（TemplateModule）
- `GET /api/template`：返回内置固定四字段结构（本周完成 / 进行中 / 问题与风险 / 下周计划），前后端共用（TPL-01）。不建可编辑存储。

### 4.3 周报模块（ReportModule）
- `GET /api/reports/mine`：本人周报列表（含预置历史）。
- `POST /api/reports`：新建本人本周周报（同周次重复保存为更新，REP-03）。
- `GET/PUT /api/reports/{id}`：详情 / 更新；更新时校验资源归属（本人或 leader，AUTH-02）。
- `GET /api/reports/team?week=`：负责人视角，全员周报列表，含「未开始」成员标记（OVR-01 风险判定数据源）。
- 状态机（REP-01/02）：`draft` ↔ 提交后 `submitted`；已提交再编辑回退 `draft`。
- 并发（LEAD-04）：简化为最后写入优先，直接覆盖，不持行锁。
- 最后编辑人（AUTH-05 / LEAD-03）：保存时写入 `lastEditorId`。
- 周次计算：服务端按当前日期计算 ISO 周 `YYYY-Www`，用户不可改（1.5）。

### 4.4 AI 模块（AIModule）
- `POST /api/reports/generate`：输入 `{input≤2000}` → 组装 Prompt（4.3）→ 调 LLM → 解析严格 JSON（4 字段）→ 返回；超时 20s 返回 504（第七章），解析失败视同失败（GEN-06）。
- `POST /api/reports/team-summary`：输入 `{week}` → 聚合本周全员周报（草稿+已提交，OVR-05）→ 组装团队汇总 Prompt（OVR-06 四段结构）→ 返回 `{overall, achievements[], risks[], nextFocus[]}`。
- `GET /api/reports/team-summary/export?week=`：返回 `.txt` 文件流，文件名 `团队周报_YYYY-Www.txt`（OVR-08）。
- 降级（GEN-07）：`AI_ENABLED=false` 或连续失败时不调 LLM，团队汇总返回模板占位文本，保证可用。

---

## 五、数据模型设计（扩展需求 6.1）

### 5.1 表：`users`
| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | 预置 `leader01` 等 | 主键 |
| name | TEXT | ≤20 | 展示姓名 |
| role | TEXT | `member`/`leader` | 角色 |

**索引**：主键 `id`。预置 4 条种子数据（4.1）。

### 5.2 表：`weekly_reports`
| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | 服务端生成（uuid） | 主键 |
| user_id | TEXT FK→users.id | | 所属成员 |
| week | TEXT | `YYYY-Www` | 周次，服务端算 |
| week_done | TEXT(JSON) | 必填，2~5 条 | 本周完成，存 JSON 数组 |
| ongoing | TEXT(JSON) | 必填，1~3 条 | 进行中 |
| issues | TEXT(JSON) | 选填；空或 `["暂无"]` | 问题与风险 |
| next_plan | TEXT(JSON) | 必填，2~3 条 | 下周计划 |
| status | TEXT | `draft`/`submitted` | 状态 |
| last_editor_id | TEXT | | 最后编辑人 |
| updated_at | TEXT/DATETIME | | 最后保存时间 |

**约束 / 索引**：
- 唯一约束 `UNIQUE(user_id, week)`（REP-03，每人每周一份）。
- 索引：`idx_reports_user_week (user_id, week)`、`idx_reports_week (week)`（团队总览按周查询）。
- JSON 字段用 TEXT 存储，读写层在 service 内序列化/反序列化，契合 SQLite 无原生数组类型。

### 5.3 模板（无表）
内置常量对象，结构等同 `weekly_reports` 的四字段，提供 `GET /api/template`。

### 5.4 种子数据（REP-04）
- 4 个用户。
- 每名 member 预置 1~2 条「上一周次」历史周报（status 随机 draft/submitted），供列表与详情演示；本周周报由现场演示实时创建。

---

## 六、权限与安全设计（AUTH 系列）

| 规则 | 实现位置 | 行为 |
| --- | --- | --- |
| AUTH-01 | Auth 中间件 | 服务端校验；越权返回 403 |
| AUTH-02 | ReportService | 成员请求他人资源 ID → 403；接口仅返回本人数据 |
| AUTH-03 | Auth 中间件 | token 缺失/失效 → 401，前端跳登录 |
| AUTH-04 | login | 重新登录使原会话失效（JWT 无状态，靠新签发 + 前端清旧 token） |
| AUTH-05 | ReportService | 保存写入 `last_editor_id` |

**中间件逻辑**：解析 `Authorization: Bearer <token>` → 校验签名/过期（否则 401）→ 注入 `req.user`；资源型接口比对 `req.user.id` 与资源 `user_id`（本人）或 `req.user.role==='leader'`（代编辑）。

---

## 七、AI 服务设计（GEN / OVR 系列）

- **Prompt 组装**：严格按需求 4.3 / 6.3 模板；个人生成输出 `{weekDone[],ongoing[],issues[],nextPlan[]}`；团队汇总输出 `{overall,achievements[],risks[],nextFocus[]}`。
- **超时**：单次 LLM 调用 20s 超时（AbortController / 超时配置），超时抛错 → 接口返回 504。
- **解析**：模型须只输出 JSON；解析失败（非合法 JSON 或缺字段）→ 视同生成失败（GEN-06），禁止向前端暴露原始报错（6.3）。
- **重试**：接口层失败可重试（前端触发）；连续 2 次失败前端展示降级入口（GEN-07）。
- **降级开关**：`AI_ENABLED` 环境变量；关闭时 `generate` 返回空四字段模板、`team-summary` 返回占位四段文本，保证演示不中断。
- **稳定性**：支持备用模型 / 备用 Key（第十四章），配置多 endpoints 时按顺序 fallback。

---

## 八、统一错误码（与前端约定）

| 错误码 | 场景 | HTTP |
| --- | --- | --- |
| 400 | 参数缺失 / 超长 / 格式错误（如 GEN-01 空输入、超 2000） | 400 |
| 401 | 未登录 / token 失效 | 401 |
| 403 | 越权访问他人资源（AUTH-02） | 403 |
| 504 | AI 生成超时（>20s） | 504 |
| 500 | 服务端异常 | 500 |

响应体统一：`{ code, message }`，如 `{ code: 403, message: "无权限访问" }`。

---

## 九、目录结构建议（落地到 `back/`）

```
back/
├── src/
│   ├── index.ts                 # 启动、挂载路由
│   ├── middleware/auth.ts       # token + 权限校验
│   ├── routes/                  # login / template / reports / ai
│   ├── services/                # user / report / template / ai
│   ├── repositories/            # userRepo / reportRepo（SQL）
│   ├── ai/                      # prompt.ts / llmClient.ts / degrade.ts
│   ├── db/                      # sqlite 初始化 + 种子脚本 seed.ts
│   └── utils/                   # isoWeek、jwt、error 统一响应
├── .env.example                 # PORT / JWT_SECRET / AI_ENABLED / LLM_*
└── package.json
```

---

## 十、变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10 | 初版：架构、模块划分、数据模型（SQLite）、权限、AI 服务、错误码 |
