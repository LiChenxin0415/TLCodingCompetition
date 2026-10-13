# front — 前端代码

**AI 智能周报系统**的前端 SPA，按 `material/design/frontend-design-v1.md`、`material/ui/ui-design-v1.md`
与 `material/design/api-spec-v1.md`（冻结契约）实现。

- 状态：**5 个页面（P1—P5）全部实现**，typecheck 与生产构建通过，全接口经前端代理冒烟 42/42 通过
- 技术栈：React 18 + TypeScript + Vite 8 + Ant Design 5 + Axios + Zustand（+ React Router v6）
- 开发地址：`http://localhost:5173`（`/api` 由 Vite 代理到后端 `http://127.0.0.1:3000`，无跨域问题）

---

## 一、快速开始

> **先启动后端**（否则页面能打开但数据报错）：`cd back && npm install && npm start`

```bash
cd front
npm install          # 首次安装
npm run dev          # 启动开发服务器 → http://localhost:5173
```

其他命令：

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 开发服务器（含 HMR） |
| `npm run build` | 类型检查 + 生产构建（产物 `dist/`） |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | 仅类型检查 |

### 环境变量（`.env`，可省略使用默认值）

```
VITE_API_BASE=/api                        # 请求基地址（默认走 Vite 代理）
VITE_PROXY_TARGET=http://127.0.0.1:3000   # 后端地址（仅 dev 代理使用）
```

---

## 二、目录结构

```
front/
├── index.html
├── vite.config.ts              # 端口 5173 + /api 代理 + host:true（可局域网访问）
├── tsconfig.json
├── .env.example
└── src/
    ├── main.tsx                # 入口：ConfigProvider（主色 #2F54EB）+ AntdApp
    ├── App.tsx                 # 路由与守卫（RequireAuth / RequireLeader）
    ├── index.css
    ├── types.ts                # 与 api-spec 对齐的类型
    ├── router → 见 App.tsx      # 路由表内联在 App.tsx
    ├── store/                  # Zustand：auth（user/token/week）、editorGuard（未保存守卫）
    ├── services/               # http.ts（Axios + 错误码映射）、api.ts（接口封装）
    ├── components/             # TopNav / ReportEditor / AIGenerateButton / RiskTag / StatusTag / EmptyState
    ├── pages/                  # LoginPage / ReportEditPage / MyReportsPage / TeamReportsPage / TeamOverviewPage
    └── utils/                  # week（ISO 周）/ report（字段转换与校验）/ summary（复制与下载）
```

---

## 三、页面与路由

| 路由 | 页面 | 可见角色 | 说明 |
| --- | --- | --- | --- |
| `/login` | P1 登录页 | 所有人 | 4 个预置账号卡片（选中高亮）→ 免密登录 → 按角色进首页 |
| `/report/edit` | P2 周报编辑页 | 成员（核心页） | 输入区（2000 字计数）+ AI 生成 + 四字段编辑区 + 保存草稿/提交 |
| `/report/edit?id=xxx` | P2 复用 | 本人 / 负责人 | 详情回填；负责人进入即「代编辑」并显示「正在查看：张成员 · 2026-W42」 |
| `/my-reports` | P3 我的周报列表 | 成员 | 周次 / 状态 / 本周完成摘要（首条截断 20 字）/ 更新时间，点击行进详情 |
| `/team/reports` | P4 成员周报管理 | 负责人 | 按成员分组，组内周次倒序，默认含本周；本周无周报显示「本周未开始」灰字 |
| `/team/overview` | P5 团队总览 | 负责人 | 状态筛选 + 总览表（风险 ⚠ 可展开）+ AI 团队周报（四段 + 复制 + 导出） |

**路由守卫**：未登录访问受保护路由 → 跳 `/login`（LOGIN-03）；成员访问 `/team/*` → 提示「无权限访问」并回到成员首页（前端展示层控制，后端仍以 403 兜底）。

**顶部导航**：产品名 + 当前用户（姓名 + 角色标签）+「切换账号」（LOGIN-04）。成员可见[编辑周报][我的周报]，负责人可见[成员管理][团队总览]。

---

## 四、关键交互规则落地

| 规则 | 前端实现位置 | 行为 |
| --- | --- | --- |
| GEN-01 | ReportEditPage | 输入为空时「AI 生成」置灰 |
| GEN-02 | ReportEditPage | `maxLength=2000` + 计数，超出截断 |
| GEN-03 | ReportEditPage | 输入区常驻口语化占位提示（需求原文） |
| GEN-04 | AIGenerateButton | 加载态文案「AI 正在整理你的周报…」，期间禁用编辑区与重复点击 |
| GEN-05 | ReportEditPage | 编辑区已有内容时点击生成 → 二次确认「重新生成将覆盖当前内容」 |
| GEN-06 | ReportEditPage | 失败提示「生成失败，请重试」（504 统一文案），支持一键重试 |
| GEN-07 | AIGenerateButton / ReportEditPage | 连续失败 2 次显示「切换为模板填写模式」；后端降级（返回空模板）时自动进入该模式 |
| GEN-08 | ReportEditor | 四字段各一个多行文本框，逐字段独立编辑（每行一条） |
| REP-01/02/03 | ReportEditPage | 保存草稿 / 提交周报；保存后以后端返回状态为准（已提交编辑回退草稿）；同周次保存为更新 |
| TPL-01 | ReportEditPage | 模板结构从 `GET /api/template` 拉取，前端不硬编码（拉取失败时用兜底结构保证不白屏） |
| LEAD-03 | ReportEditPage | 负责人代编辑顶部提示；保存后「最后编辑人」变化由后端写入、P4 列表展示 |
| LEAD-05 | ReportEditPage | 负责人界面不展示 AI 生成入口 |
| OVR-01 | RiskTag | risks 非空且非「暂无」→ ⚠ 风险标签（点击查看条目）；「未开始」同样标 ⚠ |
| OVR-02 | TeamOverviewPage | 有风险置顶 + 姓名排序；`Segmented` 筛选 全部/已提交/未提交 |
| OVR-03 | TeamOverviewPage | 全员未提交 → 空态文案，不渲染空表 |
| OVR-04 | TeamOverviewPage | 提供「刷新」按钮，不自动轮询 |
| OVR-05 | TeamOverviewPage | 无任何周报时生成按钮置灰 + 提示「暂无可汇总的周报」 |
| OVR-06 | TeamOverviewPage | 四段结构展示（整体进展 / 关键成果 / 风险集中点 / 下周重点） |
| OVR-07 | TeamOverviewPage | 重新生成前二次确认；失败可重试 |
| OVR-08 | TeamOverviewPage | 「复制全文」四段纯文本；「导出 .txt」按后端 `Content-Disposition` 文件名下载 |
| OVR-09 | TeamOverviewPage | 结果页提示「生成时快照，成员修改不自动更新」 |
| 第七章 | store/editorGuard + TopNav | 有未保存编辑时切换导航/切换账号 → 弹「未保存的修改将丢失」；关闭浏览器同样提示 |
| AUTH-03 | services/http.ts | 响应 401 → 清 token 并跳登录页 |
| AUTH-02 | services/http.ts | 403 → 统一提示「无权限访问」 |

---

## 五、与后端联调的几个要点（**后端同学必读**）

1. **请求基地址**：默认 `VITE_API_BASE=/api`，由 Vite dev server 代理到后端，因此浏览器只访问 5173，不涉及跨域（后端也已开放 CORS 兜底）。
2. **`GET /api/health`（追加接口）**：前端启动时调用一次，取**服务端权威当前周次**用于页头展示与周次参数；取不到时用本地 ISO 周兜底。
3. **`GET /api/login/accounts`（追加接口）**：登录页 4 张账号卡片的数据源；接口不可用时回退到内置的 4 个预置账号，保证登录页永远可用。
4. **`GET /api/reports/team`**：契约返回**裸数组**；P4 为满足 LEAD-01「组内按周次倒序」，并行拉取**最近 5 周**后按成员合并展示（前端合并，不额外要求后端改接口）。
5. **`POST /api/reports/team-summary`**：响应即四段对象本身（非 `{summary:{...}}` 包装）。
6. **导出**：`GET /api/reports/team-summary/export?week=` 要求**先生成团队周报**（后端保存快照，OVR-09），否则返回 400 提示「请先生成团队周报后再导出」。

---

## 六、本地验证记录（2026-10）

| 验证项 | 方式 | 结果 |
| --- | --- | --- |
| 类型检查 | `npm run typecheck` | 0 错误 |
| 生产构建 | `vite build` | ✓ 1493 模块转换成功，产物 `dist/` |
| 页面服务 | `GET http://127.0.0.1:5173/` | 200，返回 SPA 外壳 |
| 模块转换 | `GET /src/main.tsx` | Vite 正常转换并预打包依赖（antd/react 已 optimize） |
| 代理链路 | `GET http://127.0.0.1:5173/api/health` | 200 `{"status":"ok","week":"2026-W42","aiEnabled":true}` |
| 全接口回归 | 复用 `back: npm run smoke`，`SMOKE_BASE_URL=http://127.0.0.1:5173/api` | **42/42 通过**（含权限、AI 生成、团队汇总、导出） |

> 说明：以上为**接口与构建层**验证。页面视觉与交互建议在浏览器中人工过一遍（演示就绪检查项见 `frontend-design-v1.md` 第九节）。

---

## 七、环境注意事项（本机 / 沙箱）

1. **npm 缓存**：本机 npm 默认缓存目录在工作区外会被拒绝写入，已在 `front/.npmrc` 把 `cache` 指向 `front/.npm-cache`，直接 `npm install` 即可。
2. **Vite 在受限沙箱下会启动失败**：Vite 8 在 Windows 上会调用 `child_process.exec('net use')` 探测网络盘，若进程被限制创建管道会报 `spawn EPERM`（构建与 dev server 均失败）。
   在受限沙箱内运行需放宽权限；**在普通终端里直接 `npm run dev` 不受影响**。
3. **AI 生成的真实性**：默认后端未配置 LLM 时为降级模式（生成返回空模板，前端自动切「模板填写模式」）。
   本地演示可用后端自带的 Mock LLM：`cd back && npm run mock:llm`，并把后端 `LLM_BASE_URL` 指到 `http://127.0.0.1:3021/v1`；
   要接真实模型，在 `back/.env` 配置 `LLM_BASE_URL / LLM_API_KEY / LLM_MODEL` 后重启后端。
4. **端到端可访问性**：`vite.config.ts` 设置了 `host: true`，同一局域网的同事可用 Network 地址访问（例如 `http://192.168.x.x:5173`）。

---

## 八、前端开发规范（协作要求）

1. **开工前先同步**：`git pull --rebase origin main`（红线，见仓库根目录 `README.md`）。
2. **小步提交、定时推送**：完成一个页面/组件/接口对接就 commit + push，连续开发每 10~15 分钟 push 一次。
3. **接口以契约为准**：新增或变更接口调用前，先看 `material/design/api-spec-v1.md`；确需后端调整时在提交信息中注明影响的 `back` 改动点。
4. **依赖文件冲突**：`package.json` / `package-lock.json` 是高频冲突点，改动后立即 push，并在提交信息中说明新增依赖。
5. **不要提交**：`node_modules/`、`dist/`、`.env`、`.npm-cache/`、日志（已在 `front/.gitignore` 忽略）。

## 九、提交信息示例

```
[agent:frontend-dev][front] 实现 P2 周报编辑页与 AI 生成降级
[agent:frontend-dev][front] 接入团队总览 AI 汇总与导出
```

## 十、待办（未实现）

- [ ] 个人周报导出（P2）：属需求 4.7 的 P2 功能，后端亦未实现
- [ ] 自动化测试：当前无组件测试（vitest + testing-library 可后续补充）
- [ ] 打包体积优化：antd 全量引入导致 chunk >500KB，可按需引入或手动分包（演示场景无影响）
