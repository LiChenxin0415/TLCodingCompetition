# back — 后端代码

**AI 智能周报系统**的后端服务，按 `material/design/api-spec-v1.md`（冻结契约）与
`material/design/backend-design-v1.md`（概要设计）实现。

- 状态：**10 个契约接口全部实现并通过冒烟验证**（42 项 × 2 种 AI 模式，见文末验证记录）
- 技术栈：Node.js 24 + Express 5 + TypeScript + SQLite（`node:sqlite`）+ JWT
- 接口基地址：`http://localhost:3000/api`（端口可由 `PORT` 调整）

---

## 一、快速开始

### 1. 环境要求

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **≥ 24** | 依赖内置 `node:sqlite` 与原生 TypeScript 类型擦除，**无需编译、无需构建** |
| npm | 任意 | 已配置 `back/.npmrc` 将缓存指向 `back/.npm-cache`（本机沙箱下必须，见第五节） |

### 2. 安装与启动

```bash
cd back
npm install            # 仅 3 个运行时依赖，秒级完成
cp .env.example .env   # 按需修改（不配 LLM_BASE_URL 会自动降级，仍可完整演示）

npm start              # 启动服务，默认 http://localhost:3000
npm run dev            # 热重载开发模式
```

启动日志会打印：接口基地址、**当前周次**、数据库文件、种子数据结果、AI 状态。

### 3. 其他命令

| 命令 | 用途 |
| --- | --- |
| `npm run seed` | 重新灌入演示种子数据（幂等，不会覆盖已修改数据） |
| `npm run smoke` | 接口冒烟测试（需服务已启动，自动跑 42 项规则断言） |
| `npm run mock:llm` | 启动本地 Mock LLM（3021 端口），**无 Key / 断网也能演示 AI 生成** |
| `npm run typecheck` | TypeScript 类型检查（TS 7，零错误） |

### 4. 没有 AI Key 时怎么演示（现场保命流程）

```bash
# 终端 1：Mock LLM
npm run mock:llm
# 终端 2：后端指向 Mock
LLM_BASE_URL=http://127.0.0.1:3021/v1 LLM_API_KEY=mock AI_ENABLED=true npm start
```

或直接 `AI_ENABLED=false`：个人生成返回空模板（前端进入"模板填写模式"，GEN-07），
团队汇总走**规则化聚合**（按成员聚合周报，不是死文案）。

---

## 二、目录结构

```
back/
├── src/
│   ├── index.ts                 # 启动、中间件、统一错误响应、优雅退出
│   ├── config.ts                # 环境配置（端口/JWT/LLM 端点与备用端点/降级开关）
│   ├── types.ts                 # 共享类型
│   ├── middleware/auth.ts       # requireAuth(401) / requireLeader(403)
│   ├── routes/                  # loginRoutes / templateRoutes / aiRoutes / reportRoutes
│   ├── services/                # userService / templateService / reportService / aiService
│   ├── repositories/            # userRepo / reportRepo / summaryRepo（原生 SQL）
│   ├── ai/                      # prompt.ts（Prompt 组装）/ llmClient.ts（调用+超时+fallback）
│   ├── db/                      # index.ts（建表+连接）/ seed.ts（演示种子数据）
│   ├── utils/                   # isoWeek / jwt / errors / validate
│   └── scripts/                 # seedCli.ts / smoke.ts / mockLlm.ts
├── .env.example                 # 全部环境变量及说明
├── .npmrc                       # 缓存指向 back/.npm-cache（沙箱必要）
├── tsconfig.json                # nodenext + erasableSyntaxOnly（保证 node 可直接运行 .ts）
└── package.json
```

数据文件默认生成在 `back/data/weekly-report.db`（已 gitignore，启动时自动建表+灌种子）。

---

## 三、接口清单

### 契约接口（`material/design/api-spec-v1.md`，已全部实现）

| 方法 | 路径 | 权限 | 关键规则 |
| --- | --- | --- | --- |
| POST | `/api/login` | 公开 | LOGIN-02 免密；未知 userId → 400；JWT 24h |
| GET | `/api/template` | 登录 | TPL-01 四字段结构，前端不硬编码 |
| GET | `/api/reports/mine` | 登录 | AUTH-02 仅本人（含预置历史 REP-04） |
| POST | `/api/reports` | 登录 | REP-03 同周次保存为更新；week 由服务端计算 |
| GET | `/api/reports/{id}` | 本人 / leader | 越权 → 403（AUTH-02） |
| PUT | `/api/reports/{id}` | 本人 / leader | REP-01/02 状态机；LEAD-03 代编辑；写入 lastEditorId |
| GET | `/api/reports/team?week=` | leader | 响应为**裸数组**，含「未开始」成员（report=null，OVR-01） |
| POST | `/api/reports/generate` | 登录 | GEN-01/02 入参校验；GEN-04 20s 超时；6.3 严格 JSON |
| POST | `/api/reports/team-summary` | leader | OVR-05 无周报 → 400；响应即四段结构 |
| GET | `/api/reports/team-summary/export?week=` | leader | OVR-08 `.txt` 文件流，附件名 `团队周报_YYYY-Www.txt` |

### 追加接口（契约之外，**仅新增、不破坏既有契约**）

| 方法 | 路径 | 权限 | 用途 |
| --- | --- | --- | --- |
| GET | `/api/health` | 公开 | 健康检查 + 返回**服务端权威当前周次** `week` 与 AI 状态（前端页头「本周周报 · 2026-W42」可取此处） |
| GET | `/api/login/accounts` | 公开 | 返回 4 个预置账号 `{accounts:[{id,name,role}]}`，供登录页账号卡片使用（LOGIN-01），避免前端硬编码 |

> 前端同学注意：`GET /api/reports/team` 返回**数组**（不是 `{items:[]}`）；
> `POST /api/reports/team-summary` 返回**四段对象本身**（不是 `{summary:{...}}`）；
> 周报对象额外带有 `userId` 字段（便于前端在团队视图做归属判断），其余字段与契约一致。
> 导出接口要求**先生成团队周报**（服务端保存快照，OVR-09），否则返回 400 提示。

---

## 四、数据模型与种子数据

### 表结构（`src/db/index.ts`）

- `users(id PK, name, role)` —— 4 个预置账号
- `weekly_reports(id PK, user_id FK, week, week_done, ongoing, issues, next_plan, status, last_editor_id, updated_at)`
  - `UNIQUE(user_id, week)` 保证 REP-03「每人每周一份」
  - 索引 `idx_reports_user_week`、`idx_reports_week`
  - 四字段以 JSON 文本存储（SQLite 无数组类型），读写层在 repository 内序列化
- `team_summaries(week PK, payload, generated_at)` —— **设计补充**（backend-design §5 未定义）
  - 用于 OVR-09「生成时快照」与 OVR-08「导出」；否则导出要么重调 AI（慢 20s）要么违背快照语义

### 种子数据（`src/db/seed.ts`，来源：`material/design/demo-data-seed-v1.md`）

- 4 个账号：`leader01/王负责人/leader`、`member01/李成员`、`member02/张成员`、`member03/刘成员`
- 历史周报 4 条：member01 两条（`{CW-1}` 已提交 / `{CW-2}` 草稿）、member02 一条（有风险）、member03 一条（草稿）
- 幂等：`INSERT OR IGNORE` + 唯一约束，重复启动不会覆盖现场演示中修改的数据

字段约束（服务端强制，违反返回 400）：`weekDone` 2—5 条、`ongoing` 1—3 条、
`issues` 0—3 条（缺省 `["暂无"]`）、`nextPlan` 2—3 条，每条 ≤50 字。

---

## 五、AI 模块设计（GEN / OVR）

| 能力 | 实现 |
| --- | --- |
| Prompt | `src/ai/prompt.ts`：个人周报**逐字照抄需求 4.3**；团队汇总按 6.3 输出契约 + OVR-06 四段结构组装 |
| 协议 | OpenAI 兼容 `/chat/completions`，仅用内置 `fetch`，不绑 SDK，便于现场换模型/网关 |
| 超时 | 默认 20s（`LLM_TIMEOUT_MS`，GEN-04），整体预算控制：主端点失败且时间有富余才走备用端点 |
| 备用端点 | `LLM_BACKUP_BASE_URL/API_KEY/MODEL` 顺序 fallback（需求第十四章风险应对） |
| 解析 | 剥离 markdown 围栏 → 取首个 JSON 对象；**缺字段/非法 JSON 一律视同生成失败**，不向前端暴露原始报错（6.3） |
| 归一化 | AI 结果自动截断到 50 字、条数收敛到上限，保证生成结果可直接保存（避免演示中断） |
| 降级 | `AI_ENABLED=false` 或未配置端点：个人生成返回空模板；团队汇总走**规则化聚合**（GEN-07） |
| 错误码 | 超时 → `504 {"code":504,"message":"AI 生成超时，请重试"}`；网络/解析失败 → `504 生成失败，请重试` |

---

## 六、与设计文档的落地差异（**其他智能体必读**）

| 设计/ADR 原定 | 实际落地 | 原因 |
| --- | --- | --- |
| `better-sqlite3` | **`node:sqlite`（Node 24 内置）** | 同样是 SQLite 文件存储与同一套 SQL，但**零原生编译**，比赛现场无构建失败风险 |
| `dotenv` | `node --env-file-if-exists=.env` | Node 原生能力，少一个依赖；`.env` 用法不变 |
| ts-node / 先编译再运行 | **Node 原生类型擦除**，直接 `node src/index.ts` | 免构建、启动快；代价是只能用可擦除语法（禁 enum/参数属性），已在 `tsconfig.json` 用 `erasableSyntaxOnly` 约束 |
| 无团队周报存储 | 新增 `team_summaries` 表 | 支撑 OVR-09 快照与 OVR-08 导出 |
| 契约 10 个接口 | +2 个追加接口（health / accounts） | 登录页账号卡片（LOGIN-01）与服务端权威周次，纯新增 |
| `weekDone` 允许 2—5 条 | 服务端严格校验，越界 400 | 与契约 6.1 字段字典一致（超长/越界按 400 处理） |

> 以上差异不影响任何接口契约（路径/入参/出参/权限/错误码全部按 `api-spec-v1.md`），
> 已同步登记到 `material/meeting/adr-tech-stack-v1.md` 的变更记录。

---

## 七、环境注意事项（本机 / 沙箱）

1. **npm 缓存**：本机 npm 默认缓存目录在工作区外会被拒绝写入，已在 `back/.npmrc` 中把
   `cache` 指向 `back/.npm-cache`，因此直接 `npm install` 即可，无需额外参数。
2. **Node 版本**：必须 ≥24；启动时会打印 `ExperimentalWarning: SQLite ...`，
   这是 `node:sqlite` 的实验性提示，**功能正常，可忽略**。
3. **周次时区**：周次按服务端本地日期换算后以 UTC 计算 ISO 周，保证跨时区/夏令时不错周。
4. **数据库重置**：删除 `back/data/` 后重启即自动重建并灌入种子数据。

---

## 八、验证记录（2026-10）

| 验证项 | 方式 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck`（TS 7.0.2） | 0 错误 |
| 冒烟测试 · 降级模式 | `npm run smoke`（端口 3000，未配置 LLM） | **42/42 通过** |
| 冒烟测试 · AI 启用 | `npm run smoke`（端口 3010，指向 Mock LLM） | **42/42 通过**，`weekDone=2 条` 结构化解析成功 |
| AI 超时（GEN-04） | Mock 故意挂起，`LLM_TIMEOUT_MS=2500` | 2.54s 返回 `504 {"code":504,"message":"AI 生成超时，请重试"}` |
| AI 解析容错 | Mock 返回带 ```json 围栏的内容 | 围栏正确剥离并解析成功 |
| 团队汇总 | 两种模式 | 降级：规则化聚合；AI：四段结构、成果含成员姓名 |
| 导出（OVR-08） | 实际请求 | `text/plain; charset=utf-8`，附件名 `团队周报_2026-W42.txt`（RFC 5987 中文名），正文四段齐全（含 BOM 防记事本乱码） |
| 权限（AUTH-01/02/03） | 越权读取/修改、无 token、伪造 token | 403 / 403 / 401 / 401 全部符合契约 |

---

## 九、后端开发规范（协作要求）

1. **开工前先同步**：`git pull --rebase origin main`（红线，见仓库根目录 `README.md`）。
2. **小步提交、定时推送**：完成一个接口/一个模块就 commit + push，连续开发每 10~15 分钟 push 一次。
3. **接口先行**：新增或变更接口时，同步更新 `material/design/api-spec-v1.md`（或本文件），并在提交信息中注明影响的 `front` 改动点。
4. **数据库变更**：表结构改动集中在 `src/db/index.ts` 的 `SCHEMA`（`CREATE TABLE IF NOT EXISTS`，可重复执行）；已有数据的迁移需另写脚本，禁止直接改动历史 SQL 语义。
5. **依赖文件冲突**：`package.json` / `package-lock.json` 是高频冲突点，改动后立即 push。
6. **不要提交**：`node_modules/`、`data/`（SQLite 文件）、`.env`、`.npm-cache/`、日志（已在 `back/.gitignore` 忽略）。

## 十、提交信息示例

```
[agent:backend-dev][back] 实现 /api/reports CRUD 与权限校验
[agent:backend-dev][back] 新增 AI 生成接口与降级模式
```

## 十一、待办（未实现，按需推进）

- [ ] P2：个人周报导出（文本/Markdown）、自定义模板、周报提醒、历史团队周报查询（需求 4.7）
- [ ] 单元测试（当前为接口级冒烟，未引入测试框架）
- [ ] 生产化：进程守护、限流、结构化日志（比赛演示不需要）
