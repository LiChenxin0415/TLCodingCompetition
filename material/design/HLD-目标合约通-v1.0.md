# 目标合约通 · 概要设计说明书（HLD）

- **文档版本**：v1.1（对应 PRD v1.3.0）
- **需求来源**：`material/requirements/PRD-目标合约通-v1.0.md`（唯一事实来源）
- **状态**：待评审（本文件为后端 / 前端 / 测试三方可并行开发的依据）
- **更新日期**：2026-10-15
- **影响模块**：`front`（前端）、`back`（后端）

> 约定：本文档与 PRD 的规则 ID（FR-xx、R 编号）一一对应；PRD 中的 6 条硬规则在 §8 逐条落到代码校验点。

---

## 1. 设计目标与原则

1. **闭环最小集优先**：P0 五功能（FR-01/02/03/04/09）构成「制定 → 执行 → 验收」闭环，任何情况下不裁剪；P1/P2 按序增量。
2. **AI 是增强不是依赖**：AI 全程可降级为手工（PRD §11、§13「演示环境不依赖外部网络」），失败不阻塞主流程。
3. **约束写进代码**：权重=100%、交付物未上传封顶 95、评分偏离必填依据、发布前置校验——这些「硬规则」必须在服务端强制校验，前端仅做展示层提示。
4. **权限服务端兜底**：三角色（员工 employee / 组长 leader / 中心 center）行级权限由后端强制，前端只做菜单隐藏。
5. **留痕不可篡改**：进度、变更、评分、查看均写审计日志；已发布月份只读。

---

## 2. 总体架构

```
浏览器（React SPA，front/）
   │  HTTP/JSON（/api，Vite dev 代理）
   ▼
API 层（Express Router + 中间件）
   ├── Auth 中间件           JWT 校验(401) + 角色与数据行级权限(403)
   ├── 路由层                按 §7 接口清单挂载
   ├── 业务服务层（services）
   │    ├── ObjectiveService      大目标维护 / 加权进度汇聚(FR-04)
   │    ├── ContractService       合约状态机 / 权重100%校验 / 体检(FR-02)
   │    ├── ProgressService       进度解析确认 / 回退校验 / 留痕(FR-01)
   │    ├── DeliverableService    上传白名单 / 发布后锁定(FR-03)
   │    ├── ReportService         日报周报上传与解析(FR-07)
   │    ├── ScoringService        档位评分 / 依据校验 / 发布前置校验(FR-09)
   │    ├── DashboardService      指标聚合与下钻(FR-05) + 部门工作台聚合(FR-10)
   │    └── SkillService          能力标签规则+AI(FR-08)
   ├── AI 服务（ai/）
   │    ├── contractGen.ts        口语→工作包 JSON + 体检
   │    ├── progressParse.ts      自然语言→进度 JSON + 置信度
   │    ├── reportParse.ts        日报周报→摘要 + 建议
   │    └── llmClient.ts          OpenAI 兼容调用 / 超时 / fallback / 降级
   ├── 数据适配层（adapters/）      取数核验接口（Mock 先行，PRD §9.3）
   └── 数据访问层（repositories）    Objective/Contract/Item/Deliverable/ProgressLog/Report/ChangeLog/SkillTag/User
        └── 存储（SQLite，node:sqlite；文件存本地磁盘目录 data/uploads）
```

**关键解耦**：AI 模块、数据适配层与业务服务解耦——AI 关闭 / 取数平台未接入时，业务闭环照常走通（PRD §13 可用性）。

---

## 3. 技术选型

> 沿用本仓库上一轮验证过的技术栈（见 `back/README.md`、`front/README.md` 环境须知），并规避已知坑。

| 层 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 前端框架 | React + TypeScript | 18.3 | 与团队已有能力一致 |
| 构建 | Vite | 5.x | 端口 **5173**，`/api` 代理到后端 |
| UI | Ant Design | 5.x | 表格 / 表单 / 抽屉 / 看板开箱即用 |
| 路由 | React Router | 6.x | 登录守卫 + 角色守卫 |
| 请求 | Axios | 1.x | 统一拦截 401/403/422/504 |
| 状态 | Zustand | 4.x/5.x | 仅存 user/token 等轻量态 |
| 后端 | Node.js + Express + TS | Node ≥24 / Express 5 | 与前端同语言，缩短协作链路 |
| 存储 | SQLite（`node:sqlite` 内置） | Node 24 内置 | **零原生编译**（上一轮 `better-sqlite3` 的坑），文件型、演示即开即用 |
| 鉴权 | JWT（jsonwebtoken） | 9.x | 免密登录签发（演示）；有效期 24h |
| AI | OpenAI 兼容适配器（原生 fetch） | — | 统一 Prompt / 严格 JSON schema / 超时 / 备用端点 / `AI_ENABLED` 降级开关 |
| 文件 | 本地磁盘 + 白名单 | — | `data/uploads/`；外部链接存 URL |
| 配置 | `.env` + `--env-file-if-exists` | — | 端口、JWT 密钥、LLM Key/BaseURL、AI_ENABLED |

**端口约定**：后端 **3000**，前端 **5173**（`/api` → `http://localhost:3000`）。与上一轮同事分支里的 3001 无关，本系统统一 3000。

---

## 4. 模块划分

### 4.1 前端页面（对应 PRD 角色与流程）

| 页面 | 路由 | 可见角色 | 对应 FR |
| --- | --- | --- | --- |
| 登录 / 身份选择 | `/login` | 所有人 | — |
| 我的合约（制定+体检+提交） | `/contracts/mine` | employee | FR-02 |
| 工作包详情（进度/交付物/留痕） | `/items/{id}` | 本人/组长 | FR-01/03 |
| 组内合约核对与评分 | `/team/contracts` | leader | FR-09 |
| 部门看板（下钻） | `/dashboard` | center/leader | FR-05 |
| 部门工作台（总览/趋势/人效/风险/大目标/总结报告） | `/workbench` | center（leader 本组切片） | FR-10 |
| 大目标管理 | `/objectives` | center/leader | FR-04 |
| 合约历史（按月/跨月对比） | `/history` | 本人 | FR-06 |
| 日报周报 | `/reports` | employee | FR-07 |
| 能力画像 | `/skills` | 本人/组长/中心 | FR-08 |
| 中心校准与发布 | `/calibration` | center | FR-09 |

公共组件：`TopNav`（角色菜单 + 切换身份）、`ItemTable`、`RiskTag`（风险/逾期）、`EmptyState`、`AIConfirmBar`（AI 确认条）、`ScoreInput`（档位评分 + 依据校验）。

### 4.2 后端模块（对应 §2 服务层）

职责与边界已在 §2 标注；每个 service 只操作自己 repository，跨模块通过 service 调用，禁止跨 service 直连表。

---

## 5. 数据模型设计（落地 PRD §10，可直接建表）

主键统一 `TEXT`（业务可读，如 `ctr_202610_zhangwei`、`obj_001`）；时间用 `TEXT`（`YYYY-MM-DD` / `YYYY-MM-DD HH:mm:ss`）。

### 5.1 表结构

**users**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | | 登录账号，如 `zhangwei` |
| name | TEXT NOT NULL | | 姓名 |
| role | TEXT NOT NULL | `employee/leader/center` | 角色 |
| group_id | TEXT | FK→groups.id | 所属组 |
| join_month | TEXT | `YYYY-MM` | 入职月（历史范围下限） |

**groups**：`id PK, name, center_id`（中心/组两级，演示可简化为一张表，`center` 角色挂根组）。

**objectives**（大目标）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | | `obj_xxx` |
| name | TEXT NOT NULL | | |
| group_id | TEXT | FK | 所属中心/组 |
| owner_id | TEXT | FK→users | 负责人 |
| start_date / end_date | TEXT | | 起止日期 |
| status | TEXT | `进行中/已达成/已关闭` | |
| progress | REAL | 计算值 | 不落库或落库由服务重算，禁止人工写 |
| is_key | INTEGER(0/1) | 默认 0 | 是否部门年度重点（FR-10 S7） |

**contracts**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | | |
| user_id | TEXT NOT NULL | FK | **`UNIQUE(user_id, month)`** 一人一月一条 |
| month | TEXT NOT NULL | `YYYY-MM` | |
| status | TEXT | 见状态机 §6 | draft/submitted/confirmed/rejected/rated/published |
| submit_at / check_by / publish_at | TEXT | | 留痕 |
| score | REAL | 计算值 | 月度得分 `Σ(score×weight)÷100` |

**contract_items**

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| id | TEXT PK | | |
| contract_id | TEXT NOT NULL | FK | 索引 |
| objective_id | TEXT | FK，可空 | `基础履职类` 可空，其余三类必填 |
| type | TEXT NOT NULL | 四类枚举 | 基础履职/重点交付/治理改善/探索突破 |
| priority | TEXT NOT NULL | 高/中/低 | |
| title | TEXT NOT NULL | | |
| target_desc | TEXT NOT NULL | ≤200 字 | 体检：含数字+可验证动词 |
| deliverable_type | TEXT NOT NULL | 八类枚举 | 见 PRD FR-03 |
| deliverable_desc | TEXT NOT NULL | | 约定交付物说明 |
| weight | INTEGER | 1–100 | 合约内合计=100（应用层校验） |
| due_date | TEXT | | 必须在合约月份内 |
| progress | INTEGER | 0–100 | 回退需原因 |
| source | TEXT | `manual/AI` | AI 采纳率统计 |
| value_tag | TEXT | 可空 | 六类价值标签（降本增效/风险防控/质量提升/创新探索/合规保障/支撑保障），未标注计「未分类」（FR-10 S1） |
| checked | INTEGER(0/1) | | 组长核对标记 |

索引：`idx_items_contract(contract_id)`、`idx_items_objective(objective_id)`。

**deliverables**：`id PK, item_id FK, kind(file/link), file_type, url, uploader, upload_at, version`；发布后禁止增删改。

**progress_logs**：`id PK, item_id FK, operator, raw_text, ai_result(JSON), delta, created_at`；原始文本 + 解析结果双留痕（FR-01 R6）。

**reports**：`id PK, user_id FK, kind(daily/weekly), period, content_ref, ai_summary(JSON), linked_item_ids(JSON), version`。

**change_logs**：`id PK, item_id FK, field, old_value, new_value, reason, note, operator, created_at`；`reason` 枚举见 PRD §10。

**skill_tags**：`id PK, user_id FK, tag_name, score, evidence_item_ids(JSON), updated_at, hidden`。

**audit_logs**：`id PK, operator, action, target, detail(JSON), created_at`；覆盖查看/下载/发布/退回等审计点。

### 5.2 校验规则落地（服务端强制，返回 422）

| 规则 | 校验点 | 提示（示例） |
| --- | --- | --- |
| 权重合计=100% | 提交核对 / 月中调整 两个入口 | `权重合计必须为 100%，当前 {n}%` |
| 进度 0–100 | 进度写入 | 截断并提示；回退 >20% 需填原因 |
| 评分 80–120 | 评分写入 | 越界拒绝 |
| 评分偏离 100 必填依据 | 评分写入 | `偏离 100 分须说明依据` |
| 无交付物封顶 95 | 评分写入 | `交付物未上传，最高 95 分`；96+ 需二次确认+理由 |
| 交付物未约定不可提交 | 合约提交 | `工作包缺少交付物约定` |
| due_date 在合约月内 | 合约提交 / 发布校验 | `截止日不在合约月份内` |

---

## 6. 状态机与主流程

### 6.1 合约状态机（PRD §10）

```
draft ──submit──▶ submitted ──组长 confirm──▶ confirmed（执行中）
  ▲                  │  reject（退回+意见）
  └──────────────────┘
confirmed ──月末评分完成──▶ rated ──中心校准──▶ published（只读）
```

- `published` 后：编辑、上传、评分入口全部隐藏（FR-06 R2）。
- `rejected` 退回意见必填并留痕。

### 6.2 主流程落点（PRD §12）

| 阶段 | 关键动作 | 系统落点 |
| --- | --- | --- |
| 制定 | AI 生成 3–5 工作包 + 体检 | `POST /api/ai/contracts/generate` → 前端回填 → 编辑 |
| 制定 | 权重校验 100% → 提交 → 组长核对 | `POST /api/contracts/{id}/submit`、`/confirm`、`/reject` |
| 执行 | 说一句 → AI 解析 → 人工确认 → 入库 | `POST /api/ai/progress/parse` + `POST /api/progress/confirm` |
| 执行 | 月中调整（必填原因）→ 大目标重算 | `PUT /api/items/{id}` + ChangeLog |
| 验收 | 上传交付物 → 评分（封顶/依据）→ 校准 → 发布 | §7 scoring 接口族 |

---

## 7. 接口设计（契约，前端据此并行开发）

通用：Base `/api`；除登录外需 `Authorization: Bearer <token>`；统一错误体 `{code, message}`。

| 模块 | 方法+路径 | 权限 | 说明 |
| --- | --- | --- | --- |
| 认证 | `POST /login` | 公开 | `{userId}` → `{token,user}`（免密演示） |
| 认证 | `GET /me` | 登录 | 当前用户 + 角色 + 所属组 |
| 大目标 | `GET /objectives` | center=全部 / leader=本组 / employee=本人相关 | |
| 大目标 | `POST /objectives`、`PUT /objectives/{id}` | center/leader | |
| 大目标 | `GET /objectives/{id}` | 可见者 | 含关联合约包清单 + 加权进度 + 贡献占比（FR-04 R4） |
| 合约 | `GET /contracts/mine?month=` | employee | 本人当月/历史 |
| 合约 | `POST /contracts`、`PUT /contracts/{id}` | employee | 草稿编辑 |
| 合约 | `POST /contracts/{id}/submit` | employee | 提交前校验权重100% + 交付物约定 |
| 合约 | `POST /contracts/{id}/confirm`、`/reject` | leader | 退回需意见 |
| 合约 | `GET /contracts/team?month=` | leader | 本组成员合约列表 |
| 合约 | `GET /contracts/export?month=` | leader/center | 台账导出（Excel 字段见 PRD FR-06 R4） |
| 工作包 | `PUT /api/items/{id}` | 本人(执行期)/leader(调整) | 变更写 ChangeLog |
| AI 生成 | `POST /ai/contracts/generate` | employee | `{desc,objective_id}` → items+checks（FR-02，8s 超时） |
| AI 体检 | `POST /ai/contracts/check` | employee | 对已编辑工作包逐条体检打分 |
| 进度 | `POST /ai/progress/parse` | employee | `{text,item_id?}` → `{item_id,new_progress,delta,evidence,confidence}`（5s 超时） |
| 进度 | `POST /progress/confirm` | employee | 采纳后写库 + ProgressLog |
| 进度 | `POST /progress` | employee | 手工更新（回退>20% 需原因） |
| 交付物 | `POST /items/{id}/deliverables` | employee | 文件≤50MB / 白名单；或外链 |
| 交付物 | `GET /items/{id}/deliverables`、`DELETE /deliverables/{id}` | 本人/组长 | 发布后 403 |
| 日报周报 | `POST /reports`、`POST /reports/{id}/parse`、`POST /reports/{id}/adopt` | employee | FR-07 |
| 看板 | `GET /dashboard/metrics` | center/leader | 指标卡数值 |
| 看板 | `GET /dashboard/drilldown?metric=&level=&group=` | center/leader | 明细列表（条数必须与卡一致，FR-05 R5） |
| 部门工作台 | `GET /dashboard/overview` | center | 驾驶舱 6 项指标（FR-10 S2） |
| 部门工作台 | `GET /dashboard/value-distribution?by=count|weight` | center | 价值分布（按数量/权重，FR-10 S1） |
| 部门工作台 | `GET /dashboard/trend?period=` | center | 部门趋势（环比/同比，FR-10 S4） |
| 部门工作台 | `GET /dashboard/workload` | center | 人效与负荷（人均完成率/超负荷/富余，FR-10 S5） |
| 部门工作台 | `GET /dashboard/risks` | center | 部门风险汇聚（等级降序+逾期置顶+月度趋势，FR-10 S6） |
| 部门工作台 | `GET /objectives/overview` | center | 大目标总览（含年度重点标记，FR-10 S7） |
| 部门工作台 | `POST /dashboard/summary-report` | center | 生成总结报告四段（FR-10 S3） |
| 评分 | `PUT /items/{id}/score` | leader | 校验档位/依据/封顶（FR-09 R1/R2/R4） |
| 评分 | `POST /contracts/{id}/submit-rating` | leader | 合约评分提交 |
| 校准 | `GET /calibration?month=` | center | 含组内偏差提示（FR-09 R6） |
| 校准 | `POST /calibration/return` | center | 退回补充依据（意见必填） |
| 发布 | `POST /monthly/publish` | center | **发布前置校验三项**（FR-09 R5） |
| 能力 | `GET /skills/{userId}`、`POST /skills/{tagId}/hide` | 本人/组长/中心 | FR-08；不计分声明 |
| 审计 | `GET /audit/export` | center | 操作日志导出 |

**统一错误码**

| code | 场景 |
| --- | --- |
| 400 | 参数缺失 / 格式错误 / 文件类型/大小不符 |
| 401 | 未登录 / token 失效 |
| 403 | 越权（本人/本组/全中心） |
| 404 | 资源不存在 |
| 409 | 状态冲突（如发布后修改、重复提交） |
| 422 | **业务规则拦截**（权重≠100%、评分缺依据、无交付物封顶、发布前置校验不通过、回退缺原因） |
| 504 | AI 解析/生成超时（>5s / >8s）或服务不可用 → 前端降级手工 |
| 500 | 服务端异常 |

> 422 是本系统新增的业务校验码：与 400（格式错）区分，前端据此做「表单级拦截提示」而非「请求失败」。

---

## 8. 关键规则落地设计（PRD 硬规则 → 代码）

| # | PRD 硬规则 | 后端实现 | 前端实现 |
| --- | --- | --- | --- |
| 1 | 权重 3–5 个、合计=100% | ContractService 提交/调整双入口校验；AI 生成后自动归一化 | 表单实时显示合计，≠100 禁用提交按钮 |
| 2 | 目标含数字+时限+可验证动词 | 体检扣分（见下），<80 标红；可强制提交但 `checked=false` 留痕 | 体检结果逐条展示 issue |
| 3 | 无交付物封顶 95 | ScoringService 评分写入校验，96+ 需二次确认+理由 | ScoreInput 自动限制并提示 |
| 4 | 置信度<0.6 不给结论 | ProgressService 仅返回候选列表，不写库 | AIConfirmBar 展示候选点选 |
| 5 | 月度得分公式 / 已发布只读 | ScoringService 计算；published 状态全接口只读 | 历史页只读 |
| 6 | 偏离100填依据 / 发布前置校验 | ScoringService + 发布接口三项校验 | 评分框依据必填、发布按钮前置检查 |

**体检扣分算法（FR-02 R4，纯规则，无 AI）**：`score = 100 −（无数字25 + 无可验证动词20 + 描述过短15 + 无时限20 + 无交付物20）`；`<80` 标红并列出 issue。数字识别与"可验证动词"（完成/上线/治理/降低/发布…）用规则词典匹配，词典可配置。

**大目标加权进度（FR-04 R3）**：`progress = Σ(item.progress × item.weight) ÷ Σ(item.weight)`，保留 1 位小数；无关联时为 0 + 空态。权重调整后实时重算（服务端计算，不缓存）。

**能力标签打分（FR-08 R1，规则+AI）**：工作包文本命中 1 分 / 交付物类型命中 1 分 / 进度留痕命中 0.5 分；累计 ≥2 生成标签并附证据；AI 不可用时纯关键词规则匹配。

**部门工作台聚合规则（FR-10，纯规则，无 AI）**：

- 价值分布：按 `value_tag` 分组计数（`by=count`，默认）或按 `weight` 加权（`by=weight`）；未标注计「未分类」；占比 = 分类数 ÷ 总数。
- 人均负荷 = 在办工作包总数 ÷ 在职员工数；人均完成率 = 已完成工作包数 ÷ 在职员工数。
- 负荷预警：成员在办数 > 组均值 + 2 标「超负荷」，< 组均值 − 2 标「富余」（阈值可配，仅提示不拦截，FR-10 R7）。
- 部门趋势：按 `month` 聚合工作包总数 / 完成率 / 风险数 / 人均负荷，环比（上月）、同比（去年同期）直接查询历史月份（FR-10 R6）。
- 风险汇聚：风险等级沿用 FR-05 口径，清单按等级降序、逾期项置顶（FR-10 R8）。
- 总结报告：四段固定结构由聚合数据模板填充，生成时点快照不可篡改，无 AI 依赖。

---

## 9. AI 服务设计（对齐 PRD §11）

### 9.1 LLM 端点（已确认，实测可用）

| 项 | 值 |
| --- | --- |
| 提供方 | DeepSeek 官方（外网） |
| Base URL | `https://api.deepseek.com`（直连可达，实测 0.1s；`/v1` 路径亦可用） |
| 模型 | `deepseek-v4-flash`（服务端规范名 `deepseek-flash`） |
| 密钥 | 本地 `back/.env` 的 `LLM_API_KEY`，**严禁入库**（已被 `.gitignore` 忽略） |
| 实测结果 | HTTP 200，响应含 `reasoning_content`（推理型模型） |

**推理型模型注意（实测结论，实现时直接采用）**：

- 响应体同时含 `reasoning_content`（推理过程）与 `content`（最终答案）——**只读 `choices[0].message.content`**。
- 推理先消耗 token，`max_tokens` 要给足（合约生成建议 ≥4096），否则 `content` 可能为空（`finish_reason=length`）。
- 时延：flash 为快速档但推理型仍偏慢；PRD 的 5s/8s 超时若实测偏紧，放宽到 15–20s，超时仍走降级兜底。

### 9.2 设计要点

- **统一适配**：`ai/llmClient.ts` 负责 OpenAI 兼容调用、`AbortController` 超时（进度解析 5s / 合约生成 8s，可按 9.1 调宽）、备用端点 fallback、`AI_ENABLED=false` 或未配置时降级。
- **严格 JSON + schema 校验**：四个能力（合约生成 / 进度解析 / 报表解析 / 能力标签）输出均有 schema，校验失败一律视同失败（不向前端暴露原始报错）。
- **降级矩阵**：合约生成→模板预填+手工新增；进度解析→手工进度框；报表解析→仅存文件；能力标签→关键词规则；数据核验→"暂无法自动核验"。
- **人工确认**：解析结果默认人工确认后入库；`confidence ≥ 0.85` 且用户开启"自动采纳"才可跳过（PRD §11 通用约束）。
- **Mock LLM**：复用上一轮 `npm run mock:llm` 思路，提供一个本地 Mock 使断网时仍可演示 AI 链路。

---

## 10. 数据适配层（PRD §5.2 / §14 风险 5）

- 定义统一接口 `adapters/verification.ts`：`fetchEvidence(objective/item)` → `{actual, suggest_score, basis}`。
- **本期只实现 Mock 适配器**（返回预置核验数据），生产 DevOps / SQL 治理平台对接留接口位；契约见本文档 §7「数据核验」能力。

---

## 11. 权限与安全

- **行级权限**：employee 仅本人；leader 仅本组；center 全中心。每个 service 入口先断言 `assertScope(user, target)`，越权 403。
- **文件**：白名单 `pdf/doc/docx/xls/xlsx/ppt/pptx/png/jpg/zip/md/txt`；≤50MB（交付物）/≤20MB（日报周报）；下载走鉴权链接；含客户信息文件提示。
- **审计**：查看/下载/评分/发布/退回/变更 全部写 audit_logs，可导出。
- **已发布只读**：`published` 状态在数据访问层拦截写操作。

---

## 12. 非功能设计（PRD §13）

| 项 | 要求 | 落地 |
| --- | --- | --- |
| 性能 | 看板首屏 ≤2s、下钻 ≤1.5s | 指标用聚合 SQL + 必要索引；下钻分页 |
| AI 时延 | 解析 ≤5s、生成 ≤8s | 超时即降级，前端加载态 |
| 安全 | 鉴权 + 行级权限 + 白名单 + 下载鉴权 + 脱敏 | §11 |
| 合规 | 留痕不可篡改 + 已发布只读 + 审计导出 | audit_logs + 状态机 |
| 兼容 | Chrome/Edge 最近两版 + 国产内核 | 标准 Web + antd |
| 可用性 | 不依赖外部网络（AI/取数可降级） | AI 降级矩阵 + Mock 适配器 + Mock LLM |

---

## 13. 目录结构建议（落地到 back/、front/）

```
back/
├── src/
│   ├── index.ts / config.ts / types.ts
│   ├── middleware/auth.ts           # JWT + 角色 + 行级权限
│   ├── routes/                      # 按 §7 模块分组
│   ├── services/                    # §2 的 8 个 service
│   ├── repositories/                # 9 张表的 repository
│   ├── ai/                          # llmClient + 四个能力 + schema 校验
│   ├── adapters/verification.ts     # 取数核验（Mock 先行）
│   ├── db/                          # schema.sql + seed.ts
│   └── utils/                       # iso 校验/错误/文件/评分算法/体检算法
├── .env.example  /  .npmrc  /  package.json
└── data/                            # SQLite + uploads（gitignore）

front/
├── src/
│   ├── main.tsx / App.tsx（路由+守卫）
│   ├── pages/                       # §4.1 十个页面
│   ├── components/                  # TopNav / ItemTable / AIConfirmBar / RiskTag / EmptyState / ScoreInput
│   ├── services/                    # api.ts + http.ts（拦截 401/403/422/504）
│   ├── store/                       # auth / template
│   └── utils/                       # 权重/体检/评分档位/日期 工具
├── vite.config.ts（/api → 3000） /  .env.example /  .npmrc /  package.json
```

---

## 14. 里程碑与分工建议（比赛节奏）

| 阶段 | 交付 | 依据 |
| --- | --- | --- |
| 0–15min | 冻结本契约 + 建表脚本 + 种子数据 | §5/§7 |
| 15–45min | 后端 P0 闭环（合约/工作包/进度/交付物/评分发布）+ 前端骨架 | FR-01/02/03/04/09 |
| 45–75min | AI 四个能力 + 降级 + Mock；前后端联调 | §9 |
| 75–100min | P1（看板/历史/日报周报） | FR-05/06/07 |
| 100–120min | 联调、越权/边界验证、演示数据、交付 P2（能力画像） | §15 |

> 范围确认：**P0 / P1 / P2 全部交付**（FR-01 ~ FR-09 均在范围内，不做裁剪）。

---

## 15. 待确认问题（对齐 PRD §14）

### 已确认

**种子数据（7 账号 + 2 大目标，覆盖 P0/P1/P2 演示）**

| 账号 | 姓名 | 角色 | 说明 |
| --- | --- | --- | --- |
| dept01 | 王部长 | center | **部门负责人**：部门级全局视角 + 确认发布月度结果 |
| center01 | 李中心 | center | 中心管理者：组间评分校准 + 全中心看板下钻 |
| leader01 | 赵组长 | leader | A 组 |
| leader02 | 钱组长 | leader | B 组 |
| member01 | 张伟 | employee | A 组：有在办工作包 + 风险项（演示 AI 进度/看板） |
| member02 | 李娜 | employee | A 组：含无交付物工作包（演示封顶 95） |
| member03 | 王强 | employee | B 组：无合约（演示空态） |

- 大目标 2 个：`核心系统分布式改造一期`（进行中）、`稳定性专项`（进行中）。
- 合约与工作包预置「有风险 / 逾期 / 无交付物 / 超额」等边界态，用于看板下钻、评分封顶、大目标加权进度演示；能力画像（P2）由 member01 的文本/交付物/留痕触发。
- **角色说明**：`部门负责人` 与 `中心管理者` 在 PRD 三角色模型中同属 `center` 角色（数据可见范围均为全部门），用两个账号区分「部门级 top 视角」与「中心校准视角」。若制度要求「部门 vs 中心」两级数据隔离，需将 role 枚举扩为 4 并新增 `department_id` 字段——本期先按 3 角色实现，不影响演示。

### 保留开放

1. **评分上限 95 是否硬拦截**：PRD 当前为「需二次确认 + 填理由」。本设计按此实现；若要硬拦截，改 ScoringService 一处即可。
2. **能力词典来源**：默认用 PRD §FR-08 初始 8 类；是否导入《员工能力评价清单》待人力/中心确认。

---

## 16. 变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10-15 | 初版：总体架构、技术选型、数据模型、接口契约、关键规则落地、AI/权限/非功能设计 |
| v1.1 | 2026-10-15 | 对齐 PRD v1.3.0：新增 FR-10 部门工作台（价值标签/驾驶舱/趋势/人效/风险汇聚/大目标总览/总结报告）；objectives 加 is_key、contract_items 加 value_tag；DashboardService 扩展 + 新增部门工作台接口族 |
