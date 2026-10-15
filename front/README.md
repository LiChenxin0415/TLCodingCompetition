# front — 前端代码

本目录存放本项目的**前端工程代码**，由前端相关智能体负责维护。
实现依据：`material/design/frontend-design-v1.md`、`material/design/api-spec-v1.md`（冻结契约）、`material/ui/ui-design-v1.md`。
> **注**：上文提到的 `material/` 设计资料与需求文档已随仓库重置移除；如需查阅原始契约，可从历史提交 `a8a06e6` 取回（例如 `git show a8a06e6:material/design/api-spec-v1.md`）。本目录代码与文档保持原样。

## 技术栈

| 维度 | 选型 | 版本 |
| --- | --- | --- |
| 框架 | React + TypeScript | 18.3 |
| 构建 | Vite | 5.4 |
| 路由 | React Router | 6.27（含登录守卫 / 角色守卫） |
| UI | Ant Design | 5.21（主色 `#2F54EB`，在 `main.tsx` 的 `ConfigProvider` 覆写） |
| 请求 | Axios | 1.7（统一拦截 400/401/403/504/500） |
| 状态 | Zustand | 4.5（仅存 token/user、模板字段、未保存标记） |
| 图标 | @ant-design/icons | 5.5 |

## 安装与启动

```bash
cd front
npm install
cp .env.example .env      # 可选：默认即 Mock 模式
npm run dev               # http://localhost:5173
npm run build             # tsc --noEmit + vite build
npm run preview           # 预览生产包
```

### 环境变量（`.env.example`）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE` | `/api` | 接口基地址；`npm run dev` 已配置代理到 `http://localhost:3001` |
| `VITE_USE_MOCK` | `true` | `true`=走内置 Mock 适配器（后端未就绪也可完整演示）；`false`=真实联调 |

> 联调时把 `VITE_USE_MOCK` 改为 `false` 即可，业务代码无需改动：`src/services/api.ts` 中
> Mock 与真实接口方法签名完全一致。

## 目录结构

```
front/
├── index.html
├── vite.config.ts            # @ → src 别名；/api 代理到后端 3001
└── src/
    ├── main.tsx              # 入口：antd ConfigProvider + 中文 locale + 主题
    ├── App.tsx               # 路由表 + Guard（未登录跳登录、角色不匹配回各自首页）
    ├── types.ts              # 与接口契约一致的数据模型 + ApiError
    ├── store/
    │   ├── auth.ts           # token/user（localStorage）
    │   ├── template.ts       # 四字段模板（接口拉取，失败用兜底，TPL-01）
    │   └── dirty.ts          # 编辑区未保存标记
    ├── services/
    │   ├── http.ts           # axios 实例 + 错误码统一转换
    │   ├── api.ts            # 9 个接口方法（Mock/真实同签名）
    │   └── mock.ts           # Mock 适配器（种子数据见 demo-data-seed-v1.md）
    ├── components/
    │   ├── TopNav.tsx        # 顶部导航：用户/角色/切换账号（含未保存确认）
    │   ├── ReportEditor.tsx  # 四字段编辑区（P2/P3/P4 复用）
    │   ├── AIGenerateButton.tsx  # AI 生成：加载态/覆盖确认/失败重试/降级
    │   ├── RiskTag.tsx       # ⚠ 风险标签（点击展开条目）
    │   └── EmptyState.tsx    # 统一空态（禁止白屏）
    ├── pages/                # Login / ReportEdit / MyReports / TeamReports / TeamOverview
    ├── utils/                # isoWeek（ISO 周次）、file（复制/导出/摘要）、error（错误码映射）
    └── styles/global.css     # 设计令牌与基础样式
```

## 页面与路由

| 路由 | 页面 | 可见角色 |
| --- | --- | --- |
| `/login` | P1 登录页（4 个预置账号卡片，免密登录） | 所有人 |
| `/report/edit` | P2 周报编辑页（支持 `?week=&userId=` 供历史周次与负责人代编辑复用） | member（leader 仅代编辑，无 AI 入口） |
| `/my-reports` | P3 我的周报列表页 | member |
| `/team/reports` | P4 成员周报管理页 | leader |
| `/team/overview` | P5 团队总览页（筛选 + AI 汇总 + 复制/导出） | leader |

## 已实现的边界场景

- AI 输入为空置灰（GEN-01）、超长截断（GEN-02）、加载态文案「AI 正在整理你的周报…」（GEN-04）
- 生成前覆盖确认（GEN-05）、失败重试（GEN-06）、连续 2 次失败切换「模板填写模式」（GEN-07）
- 保存草稿 / 提交，已提交再编辑回退草稿（REP-01/02），同周次保存为更新（REP-03）
- 未保存离开二次确认（切换账号 + 关闭页面，第七章）
- 401 → 跳登录；403 → 「无权限访问」；504 → 重试提示；500 → 服务异常（错误码映射见 `utils/error.ts`）
- 空态 / 加载态 / 错误态齐全，列表不渲染空表格（OVR-03）

## 前端开发规范（协作要求）

1. **开工前先同步**：`git pull --rebase origin main`（红线，见仓库根目录 `README.md`）。
2. **小步提交、定时推送**：完成一个页面/组件/接口对接就 commit + push，连续开发每 10~15 分钟 push 一次。
3. **只改本目录**：不要修改 `back/`、`material/` 下的内容；需要接口或需求变更时，在 `material/` 提出或在提交信息中注明。
4. **依赖文件冲突**：`package.json` / 锁文件是高频冲突点，改动后立即 push，并在提交信息中说明新增依赖。
5. **不要提交**：`node_modules/`、`dist/`、本地 `.env`、密钥（已在 `front/.gitignore` 中忽略）。

## 提交信息示例

```
[agent:frontend-dev][front] 新增登录页表单校验
[agent:frontend-dev][front] 接入 /api/user/login 接口
```

## 待补充（依赖后端联调）

- [ ] `VITE_USE_MOCK=false` 后按真实接口回归 9 个接口（后端 `back/` 就绪后）
- [ ] 真实 AI 生成效果与超时降级联调（GEN-06/07）
- [ ] 历史周次查询接口（当前 P3/P4 通过列表接口在前端筛选，若后端提供按周查询可替换）

## 环境须知（本机实测结论，可直接复用）

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `clone` / `push` 报连接被重置 | 本机 `github.com:443` 不可达 | 走 SSH 443 通道 `ssh://git@ssh.github.com:443/...`，详见根 `README.md` 第四章 |
| `npm install` 报 EPERM | npm 默认缓存目录在工作区外被拒绝写入 | 本目录已放 `.npmrc` 指定 `cache=.npm-cache`（已 gitignore），直接 `npm install` 即可 |
| `vite` 启动/构建报 `spawn EPERM` | Vite 在 Windows 下调用 `child_process.exec('net use')` 探测网络盘，受限沙箱下被拦 | 在放宽权限的环境运行；**普通终端里直接 `npm run dev` 不受影响** |

> 三条均在本仓库实际踩到并验证过解决方式。

### 与后端联调的端口约定

- `vite.config.ts` 的 `/api` 代理目标是 `http://localhost:3001`；后端实现时**请监听 3001**，或同步修改此处的代理目标。
- 后端未就绪时保持 `VITE_USE_MOCK=true`，前端可独立完整演示；联调时改为 `false`，业务代码无需改动。
