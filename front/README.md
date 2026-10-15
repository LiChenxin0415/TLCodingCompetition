# front — 前端代码

本目录存放本项目的**前端工程代码**（《目标合约通》），由前端相关智能体负责维护。

> **当前状态：已完成 P0/P1/P2 全部九个功能（FR-01 ~ FR-09）的前端实现**，`tsc --noEmit` 与 `vite build` 均已通过。
> 依据：`material/design/HLD-目标合约通-v1.0.md`（概设）、`material/requirements/PRD-目标合约通-v1.0.md`（需求）。

---

## 零、快速启动

```bash
cd front
npm install              # 已实测通过（npm registry 直装，无需原生编译）
cp .env.example .env     # 可选：默认即 Mock 模式
npm run dev              # http://localhost:5173
npm run build            # tsc --noEmit + vite build
```

**默认走内置 Mock 适配器，后端未启动也能完整演示闭环**；后端就绪后把 `.env` 里的 `VITE_USE_MOCK` 改成 `false`，由 Vite 将 `/api` 代理到 `http://localhost:3000`。

**演示账号（免密登录，点选身份即可）**

| 账号 | 姓名 | 角色 | 演示重点 |
| --- | --- | --- | --- |
| dept01 | 王部长 | center | 部门全局视角 + 确认发布 |
| center01 | 李中心 | center | 组间校准 + 全中心看板 |
| leader01 | 赵组长 | leader | A 组核对/评分（含无交付物封顶 95） |
| leader02 | 钱组长 | leader | B 组（成员无合约空态） |
| member01 | 张伟 | employee | AI 进度更新、风险/逾期项 |
| member02 | 李娜 | employee | 含未上传交付物工作包（封顶 95 演示） |
| member03 | 王强 | employee | 本月无合约（创建 + AI 生成空态） |

---

## 一、技术栈与目录结构

对齐 HLD §3 / §13：

| 层 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React + TypeScript | 18.3 |
| 构建 | Vite | 5.x（端口 **5173**，`/api` → 后端 **3000**） |
| UI | Ant Design | 5.x |
| 路由 | React Router | 6.x |
| 请求 | Axios | 1.x |
| 状态 | Zustand | 4.x（仅存 token / user） |

```
front/
├─ index.html / package.json / vite.config.ts / tsconfig.json / .env.example / .gitignore
└─ src/
   ├─ main.tsx, App.tsx                  # 路由 + 登录/角色守卫
   ├─ types.ts                           # 数据模型与四类/八类/优先级/状态机枚举（HLD §5）
   ├─ pages/                             # 10 个页面（见下表）
   ├─ components/
   │   ├─ TopNav / ItemTable / AIConfirmBar / ScoreInput / RiskTag / EmptyState / ProgressBar
   │   └─ dashboard/                     # 驾驶舱专用（见 §五.4）
   │       ├─ MetricCards.tsx            # 指标卡（可下钻）
   │       ├─ ObjectivePanel.tsx         # 大目标加权进度 + 贡献占比
   │       ├─ RankPanel.tsx              # 组 / 个人排行
   │       ├─ DistributePanel.tsx        # 四类任务 + 评分档位分布
   │       ├─ RiskPanel.tsx              # 风险逾期 TOP5
   │       ├─ ReadinessCard.tsx          # 发布前置校验三项
   │       ├─ DrilldownDrawer.tsx        # 三级下钻明细
   │       └─ ItemDetailDrawer.tsx       # 工作包详情（留痕/交付物/变更）
   ├─ services/
   │   ├─ http.ts                        # Axios 实例，401/403/422/504 统一归一化
   │   ├─ api.ts                         # 唯一切换点：Mock ↔ 真实接口（路径对齐 HLD §7）
   │   ├─ mock.ts                        # Mock 适配器：规则、状态机、权限、延时、降级
   │   └─ seed.ts                        # 种子数据：7 账号 / 2 大目标 / 当月 8 工作包 / 两个月历史
   ├─ store/auth.ts                      # 登录态
   └─ utils/{rules,error,file}.ts        # 体检/权重/评分/加权进度、错误降级、导出
```

**页面 ↔ 路由 ↔ 角色 ↔ FR 映射（HLD §4.1）**

| 页面 | 路由 | 角色 | FR |
| --- | --- | --- | --- |
| 登录 / 身份选择 | `/login` | 所有人 | — |
| 我的合约（AI 生成 + 体检 + 提交） | `/contracts/mine` | employee | FR-02 |
| 工作包详情（进度/交付物/双留痕） | `/items/:id` | 本人/组长 | FR-01/03 |
| 组内合约核对与评分 | `/team/contracts` | leader | FR-09 |
| 部门看板（指标卡下钻） | `/dashboard` | leader/center | FR-05 |
| 大目标管理（加权进度/贡献占比） | `/objectives` | leader/center | FR-04 |
| 合约历史（按月只读 + 跨月对比） | `/history` | 本人 | FR-06 |
| 日报周报 | `/reports` | employee | FR-07 |
| 能力画像 | `/skills` | 本人/组长/中心 | FR-08 |
| 中心校准与发布 | `/calibration` | center | FR-09 |

---

## 二、开工前必读（协作要求）

1. **先同步再动手（红线）**：`git pull --rebase origin main`。完整规范见根目录 `README.md`「协作铁律」。
2. **小步提交、定时推送**：完成一个页面/组件/接口对接就 commit + push；连续开发每 10~15 分钟 push 一次。
3. **提交顺序固定为**：`git add` → `git commit` → `git pull --rebase` → `git push`。
   ⚠️ **不要先 `git pull --rebase --autostash` 再 commit**：`--autostash` 会把已暂存的改动还原成未暂存，导致 commit 时「无内容可提交」，而 push 又显示 `up-to-date`——这是一个很容易误判为成功的**假成功**。
4. **只改本目录**：不修改 `back/`、`material/` 下的内容；需要接口或需求变更时，在 `material/` 提出，或在提交信息中注明影响的模块。
5. **接口以契约为准**：接口调用以冻结的接口契约为准，前端不硬编码后端结构；确需后端调整时在提交信息中注明 `back` 改动点。
6. **依赖文件冲突**：`package.json` / 锁文件是高频冲突点，改动后立即 push，并在提交信息中说明新增依赖。
7. **不要提交**：`node_modules/`、`dist/`、`build/`、`.env`、`.npm-cache/`、日志。

---

## 三、环境须知（本机实测结论，可直接复用）

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `clone` / `push` 报连接被重置 | 本机 `github.com:443` 不可达 | 走 SSH 443 通道 `ssh://git@ssh.github.com:443/...`，详见根 `README.md` 第四章 |
| `npm install` 报 EPERM | npm 默认缓存目录在工作区外被拒绝写入 | 在本目录放 `.npmrc`：`cache=.npm-cache`（并 gitignore 该目录） |
| `npm install` 在 rebuild 阶段报 `spawn EPERM` | npm 用管道执行依赖的生命周期脚本，受限沙箱下被拦 | 用 `npm install --ignore-scripts`（纯 JS 依赖不受影响；esbuild 的二进制由可选依赖提供，实测构建正常） |
| `vite` 启动/构建报 `spawn EPERM` | Vite 在 Windows 下调用 `child_process.exec('net use')` 探测网络盘，受限沙箱下被拦 | 在放宽权限的环境运行；**普通终端里直接 `npm run dev` 不受影响** |

> 以上均已在上一轮开发中实际踩到并验证过解决方式，不必重新试错。

---

## 四、提交信息示例

```
[agent:frontend-dev][front] 新增登录页表单校验
[agent:frontend-dev][front] 接入 /api/user/login 接口
```

模块名固定用 `front`，格式见根 `README.md`「提交信息规范」。

---

## 五、关键实现说明

### 1. 硬规则落点（HLD §8 六条规则，前端侧）

| 规则 | 实现位置 |
| --- | --- |
| 3–5 个工作包、权重合计 = 100% | `MyContract` 实时显示合计，≠100 禁用「提交核对」；`utils/rules.validateContract` 逐项校验 |
| 目标含数字 + 时限 + 可验证动词 | `utils/rules.checkItem`：`100 −(无数字25 + 无动词20 + 过短15 + 无时限20 + 无交付物20)`，<80 标红列 issue |
| 无交付物封顶 95 | `ScoreInput` + `TeamContracts`：>95 需二次确认并填理由 |
| 置信度 < 0.6 不给结论 | `AIConfirmBar`：低置信度仅展示候选列表由用户点选 |
| 月度得分公式 / 已发布只读 | `utils/rules.monthlyScore`；`published` 状态隐藏编辑/上传/评分入口，历史页只读 |
| 偏离 100 必填依据 / 发布前置校验 | `ScoreInput` 依据必填；`Calibration` 展示三项校验结果并在未通过时禁用发布 |

### 2. Mock 适配器

- 完整模拟 HLD §7 的接口行为与错误码（400/401/403/404/409/422/504），**规则口径与后端一致**，不是静态假数据。
- `VITE_AI_ENABLED=false` 时 AI 接口返回 **504**，用于演练「AI 降级为手工」全流程（PRD §12）。
- 演示闭环可直接走到：AI 生成合约 → 体检 → 提交 → 组长核对 → 说一句更新进度 → 上传交付物 → 评分封顶 → 中心校准 → 发布 → 历史只读回看。

### 3. 三态与降级

- 空态：无合约 / 无大目标 / 无在办工作包 / 无历史月份 / 无能力标签，均有 `EmptyState` 文案与引导按钮（PRD §12）。
- 错误态：401 跳登录；403 提示「仅本人/本组可见」；422 走表单级拦截提示；504/500 判定为可降级（`utils/error.isDegradable`）→ 切换手工兜底。
- 加载态：统一 antd skeleton/spin 与按钮 loading。

### 4. 驾驶舱（`/dashboard`，FR-05 / FR-04 R4 / FR-09 R5）

把原来的四张裸指标卡升级为「一次请求、全景可见」的管理者驾驶舱，由 `services/api.getOverview` 一次性取回首屏所需数据，避免 N 次串行请求（呼应 PRD §13 看板首屏 ≤2s）。

| 区块 | 内容 | 依据 |
| --- | --- | --- |
| 控制栏 | 月份（限制入职月至今）／组筛选／中心·组·个人三级／刷新／导出台账 | FR-06 R1、FR-05 R1 |
| 指标卡 ×6 | 工作包总数、风险逾期、已完成、已发布绩效、**平均履约得分**、**整体推进度** | FR-05 |
| 大目标概览 | 加权进度 + 关联包数 + 已完成/风险数 + **逐包贡献占比**（可展开） | FR-04 R3/R4 |
| 发布前置校验 | 三项红绿指示 + 完成率环图 + 直达校准页 | FR-09 R5 |
| 风险逾期 TOP5 | 点击进入下钻；标记「缺物」（关联封顶 95） | FR-05、FR-03 R4 |
| 分布面板 | 四类任务分布 + **评分档位分布**（80–120 七档） | FR-02 R1、FR-09 档位表 |
| 排行面板 | 按组 / 按人切换；点击成员即收敛为该成员视角 | FR-05 R1 |

**两条容易踩的一致性约束已落到代码里：**

1. **卡上的数字 = 下钻明细条数**（FR-05 R5，PRD §15 验收项）。`已发布绩效` 早期版本按「人」计数（2）而下钻按「工作包」返回（8），两者不一致；现在指标卡与下钻共同调用 `publishedRows()`，口径唯一。同理风险卡取全量 `riskAll.length` 而非 TOP5 的截断值。
2. **看板就绪度 = 确认发布的校验**（FR-09 R5）。`publishIssuesFor()` 是唯一实现，被 `/monthly/check`、`/monthly/publish` 与驾驶舱就绪卡共用，避免两处口径打架。

**权限**：员工不可进入（路由守卫），组长仅见本组、中心可见全中心；下钻与详情抽屉的越权访问由后端 403 兜底。

> 演示提示：当月合约尚在执行中、未完成评分，所以「平均履约得分 / 档位分布」为空且发布校验显示 1 项未通过——这是**正确**的守卫表现。把月份切到上月即可看到完整的得分、档位分布与「三项全通过、可发布」。

---

## 六、变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10 | 初始化：目录约定、协作要求、环境须知、待补充清单 |
| v2.0 | 2026-10-15 | 按 HLD v1.0 完成前端全量实现：10 个页面 + 6 个公共组件 + Mock 适配器 + 种子数据；`tsc --noEmit` 与 `vite build` 均通过 |
| v2.1 | 2026-10-15 | 重做 `/dashboard` 为「目标合约驾驶舱」：新增 `getOverview` 聚合接口与 8 个驾驶舱组件；实现中心/组/个人三级下钻；修正 FR-05 R5（卡数≠下钻条数）与 FR-09 R5（就绪度与发布校验口径不一致）两处缺陷 |

---

## 七、联调待办（后端接口就绪后）

- [ ] 将 `.env` 的 `VITE_USE_MOCK` 置 `false`，逐页回归 HLD §7 各接口
- [ ] 确认真实后端的 422 返回体是否为 `{code, message}`；若字段不同，只需改 `services/http.ts` 拦截器
- [ ] 文件直传：当前 Mock 仅记录文件元信息，真实上传需改为 `multipart/form-data`（`PUT/POST /items/{id}/deliverables`）
- [ ] 台账导出字段与后端 CSV/Excel 列顺序对齐（PRD FR-06 R4）
