# test — 测试套件（接口 / 性能 / UI 走查 / 报告）

AI 智能周报系统的完整测试套件。所有脚本均为 **Node 原生 ESM（.mjs），零第三方依赖**，
用例依据 `material/requirements/test-cases-v1.md` 的规则 ID（AUTH/LOGIN/TPL/GEN/REP/LEAD/OVR/EDGE）逐条实现。

- **环境要求**：Node.js **≥ 24**（后端依赖 `node:sqlite`，可直接运行 `.ts` 源码，无需构建）
- **最近一轮执行**：2026-10-15，接口 51/51、性能 12/12、UI 走查 15/15 全部通过（详见文末「本轮结果摘要」）

---

## 一、目录结构

```
test/
├── api-tests.mjs            # 接口自动化测试（3 个运行模式，共 37 条独立用例）
├── perf-tests.mjs           # 性能测试（延迟基线 + 并发压力，12 项断言）
├── gen-report.mjs           # HTML 测试报告生成器（聚合 api/perf 结果 + UI 走查 + 截图）
├── results/                 # 机器可读的结果与运行日志
│   ├── api-results.json     #   接口测试结果（按 phase 合并）
│   ├── perf-results.json    #   性能测试结果（含阈值与统计）
│   ├── api-run-*.log        #   各阶段接口测试运行日志
│   ├── perf-run.log         #   性能测试运行日志
│   └── smoke-via-front.log  #   经前端代理的冒烟运行日志
└── report/
    ├── index.html           # ★ 可视化测试报告（浏览器直接打开）
    └── screenshots/         # UI 走查截图（18 张，01—17 编号）
```

**查看测试结果**：直接用浏览器打开 `test/report/index.html`（无需启动任何服务）。

---

## 二、环境准备

### 1. 安装 Node ≥ 24

macOS / Linux（nvm 示例）：

```bash
nvm install 24 && nvm use 24
node -v   # 需 ≥ v24.0.0
```

### 2. 安装依赖（首次）

```bash
cd back  && npm install     # 仅 3 个运行时依赖
cd ../front && npm install  # 前端依赖
```

> 仓库已在 `back/.npmrc`、`front/.npmrc` 将 npm 缓存指向各自目录内的 `.npm-cache`，
> 沙箱/受限环境下可直接 `npm install`，无需额外参数。

---

## 三、启动被测系统（完整序列）

测试需要 **1 个 Mock LLM + 3 个后端实例 + 1 个前端** 共 5 个进程，端口分配如下：

| 端口 | 进程 | 用途 | 关键环境变量 |
| --- | --- | --- | --- |
| 3021 | Mock LLM | 离线模拟大模型（免 API Key） | — |
| 3000 | 后端主实例 | UI 走查与性能测试目标 | `LLM_BASE_URL=http://127.0.0.1:3021/v1` |
| 3012 | 后端测试实例 A | 接口测试 · AI 模式 | `DB_FILE=data/test-api.db` |
| 3013 | 后端测试实例 B | 接口测试 · 降级模式 | `AI_ENABLED=false` `DB_FILE=data/test-degraded.db` |
| 5173 | 前端 dev server | UI 走查目标 | `/api` 代理至 3000 |

```bash
# 终端 1：Mock LLM（3021）
cd back && npm run mock:llm

# 终端 2：后端主实例（3000，供前端与性能测试）
cd back && LLM_BASE_URL=http://127.0.0.1:3021/v1 LLM_API_KEY=mock AI_ENABLED=true npm start

# 终端 3：接口测试实例 A（3012，AI 模式，独立测试库）
cd back && PORT=3012 DB_FILE=data/test-api.db LLM_BASE_URL=http://127.0.0.1:3021/v1 LLM_API_KEY=mock AI_ENABLED=true npm start

# 终端 4：接口测试实例 B（3013，降级模式，独立测试库）
cd back && PORT=3013 DB_FILE=data/test-degraded.db AI_ENABLED=false npm start

# 终端 5：前端（5173）
cd front && npm run dev
```

**健康检查**（5 个进程全部就绪的标志）：

```bash
curl -s http://127.0.0.1:3000/api/health   # {"status":"ok","week":"2026-W42","aiEnabled":true}
curl -s http://127.0.0.1:3012/api/health
curl -s http://127.0.0.1:3013/api/health   # aiEnabled:false
curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5173/   # 200
```

> **测试库卫生**：3012/3013 使用独立数据库文件。重跑接口测试前建议删除
> `back/data/test-api.db`、`back/data/test-degraded.db`，让种子数据恢复初始状态
> （部分用例依赖"本周尚未写入"的初始数据，如 TC-AUTH-02 期望 `/mine` 恰好 2 条种子历史）。

---

## 四、接口自动化测试（api-tests.mjs）

按 3 个运行模式分别执行，覆盖**正常、AI 故障（504）、功能降级（AI_ENABLED=false）**三类路径：

```bash
# 阶段一 · AI 启用模式（Mock LLM 运行中）
node test/api-tests.mjs --base http://127.0.0.1:3012 --phase ai

# 阶段二 · AI 故障模式（先停止 Mock LLM，再执行）
pkill -f mockLlm.ts        # 或 Ctrl-C 掉终端 1
node test/api-tests.mjs --base http://127.0.0.1:3012 --phase fail

# 阶段三 · 降级模式
node test/api-tests.mjs --base http://127.0.0.1:3013 --phase degraded
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--base` | 后端基地址 | `http://127.0.0.1:3012` |
| `--phase` | `ai` / `fail` / `degraded` | `ai` |
| `--out` | 结果 JSON（按 phase 合并写入） | `test/results/api-results.json` |

退出码：全部通过 `0`，存在失败 `1`，后端不可用 `2`。

**覆盖范围**（37 条独立用例）：登录鉴权（LOGIN/AUTH 6）、模板（TPL 2）、
AI 生成（GEN 7，含 20s 超时与围栏剥离）、周报状态机（REP 5）、
负责人代管（LEAD 4）、团队总览与导出（OVR 8）、边界与错误（EDGE 4）。

---

## 五、性能测试（perf-tests.mjs）

```bash
# 默认参数：延迟基线每接口 30 次、并发 50
node test/perf-tests.mjs --base http://127.0.0.1:3000

# 自定义强度
node test/perf-tests.mjs --base http://127.0.0.1:3000 --rounds 50 --concurrency 100
```

| 参数 | 说明 | 默认值 |
| --- | --- | --- |
| `--base` | 后端基地址 | `http://127.0.0.1:3000` |
| `--rounds` | 延迟基线每接口请求次数 | `30` |
| `--concurrency` | 并发场景并发数 | `50` |
| `--out` | 结果 JSON | `test/results/perf-results.json` |

**测试内容与通过标准**：

| 类别 | 场景 | 通过标准 |
| --- | --- | --- |
| 延迟基线 | 8 个关键接口顺序请求（login/template/mine/team/detail/generate/summary/export） | 非 AI 接口 P95 ≤ 300ms；AI 接口 P95 ≤ 2000ms；错误率 0% |
| 并发读 | `--concurrency` 个并发 GET /api/reports/mine | 错误率 0% 且 QPS ≥ 100 |
| 并发登录 | `--concurrency` 个并发 POST /api/login | 错误率 0% 且 QPS ≥ 100 |
| 并发写 | 3 名成员同时 POST /api/reports，重复 5 轮 | 错误率 0% 且单轮 P95 ≤ 1000ms |
| AI 并发 | 10 个并发 POST /api/reports/generate | 错误率 0% |

---

## 六、后端冒烟回归（back/npm run smoke）

后端自带的 37 项规则断言（AUTH/GEN/REP/LEAD/OVR + 错误码），可作为独立回归基线。
**建议经前端代理执行**，同时验证 Vite 代理链路：

```bash
cd back && SMOKE_BASE_URL=http://127.0.0.1:5173/api npm run smoke
```

> 注意：冒烟含写操作，会污染目标库的"本周"数据。请勿对 3000 主库在 UI 走查前执行，
> 或执行后删除 `back/data/weekly-report.db` 并重启后端恢复初始种子状态。

---

## 七、UI 走查（playwright-cli）

UI 走查通过 [playwright-cli](https://github.com/microsoft/playwright-cli) 驱动 headless Chromium
对 `http://127.0.0.1:5173` 做真实点击/输入/下载交互，并按场景截图至 `test/report/screenshots/`。

```bash
# 安装（首次）
npm install -g @playwright/cli@latest
playwright-cli install-browser

# 打开页面（本机无 Google Chrome 时用 bundled chromium）
playwright-cli open --browser=chromium http://127.0.0.1:5173/login
playwright-cli resize 1440 900

# 快照 → 读取元素引用 → 交互 → 截图
playwright-cli snapshot --filename=login.yaml
playwright-cli click e29                      # 点击快照中的元素引用
playwright-cli fill e118 "这周主要在联调周报接口"
playwright-cli screenshot --filename=03-member-edit-page.png
```

**18 张截图对应场景**（与 HTML 报告「四、UI 走查」15 条用例映射）：

| 截图 | 场景 | 规则 |
| --- | --- | --- |
| 01-guard-redirect.png | 未登录访问受保护路由 → 跳登录页 | AUTH-03 |
| 02 / 02b-login-select-*.png | 登录页账号卡片选择高亮（成员/负责人） | LOGIN-01/02 |
| 03-member-edit-page.png | 编辑页空输入时「AI 生成」置灰 | GEN-01 |
| 04-input-filled.png | 输入描述后按钮可用 | GEN-01 |
| 05-ai-loading.png | AI 生成加载态 | GEN-04 |
| 06-ai-result.png | 生成结果回填四字段 | GEN-04 |
| 07-save-draft.png | 保存草稿提示 | REP-01 |
| 08-my-reports.png | 我的周报（本周 + 历史） | REP-04 |
| 09-submitted.png | 提交后状态跃迁 | REP-01 |
| 10-team-reports.png | 负责人成员管理页 | LEAD-01 |
| 11-unsaved-guard.png | 未保存离开确认弹窗 | 第七章 |
| 12-leader-proxy-edit.png | 代编辑视图（无 AI 按钮） | LEAD-03/05 |
| 13-team-overview.png | 团队总览风险三态 | OVR-01 |
| 14-team-summary.png | AI 团队周报四段结构 | OVR-06 |
| 15-export-toast.png | 导出 .txt 成功提示 | OVR-08 |
| 16-copy-toast.png | 复制全文提示 | OVR-08 |
| 17-member-forbidden.png | 成员访问负责人页被拦截 | AUTH-04 |

> 截图技巧：Mock LLM 瞬时返回，加载态难以抓拍；输入含 `HANG` 可让 Mock 挂起 20s，
> 稳定捕获加载态后再用正常输入重新生成（超时后前端按 GEN-06 提示"生成失败，请重试"）。

---

## 八、生成 HTML 报告

```bash
node test/gen-report.mjs
```

读取 `test/results/api-results.json`（接口）、`test/results/perf-results.json`（性能，可选）、
`test/report/screenshots/`（截图），生成 **`test/report/index.html`**：
KPI 总览、模块覆盖、三阶段接口明细、性能延迟/并发明细、UI 走查清单、截图 gallery、缺陷与结论。

---

## 九、本轮结果摘要（2026-10-15）

| 测试类型 | 执行量 | 通过 | 说明 |
| --- | --- | --- | --- |
| 接口 · AI 启用模式 | 31 条 | **31/31** | P0 18/18、P1 10/10、P2 3/3 |
| 接口 · AI 故障模式 | 9 条 | **9/9** | 504 通用文案、无原始错误泄露 |
| 接口 · 降级模式 | 11 条 | **11/11** | 空模板 + 规则化聚合 |
| 后端冒烟（经前端代理） | 37 项 | **37/37** | `SMOKE_BASE_URL=5173` |
| 性能 · 延迟基线 | 8 接口 × 30 次 | **8/8** | 非 AI 接口 P95 ≤ 7.1ms，AI ≤ 2.55ms |
| 性能 · 并发场景 | 4 类 | **4/4** | 并发读 QPS 1852、并发登录 QPS 2778、并发写/ AI 并发零错误 |
| UI 走查 | 15 场景 / 18 截图 | **15/15** | 覆盖 5 个页面全部关键交互 |

**结论**：系统核心功能、鉴权隔离、状态机、AI 生成（含超时/故障/降级三态）、
团队汇总与导出均符合需求规格；性能指标余量充足；未发现产品缺陷。

**执行环境**：Node v24.14.0、Mock LLM 3021、后端 3000/3012/3013、前端 5173、
Playwright headless Chromium 1440×900。原始数据见 `test/results/` 各 JSON 与 log。

---

## 十、常见问题

| 现象 | 处理 |
| --- | --- |
| `node: command not found` | 未安装 Node ≥24；用 nvm 安装后新开终端 |
| 接口测试 `[FATAL] 后端不可用` | 检查对应端口实例是否启动、`/api/health` 是否 200 |
| 阶段二用例不通过 | 确认 Mock LLM 已停止（`pkill -f mockLlm.ts`） |
| UI 截图是旧数据 | 冒烟/接口测试写入了本周数据；删 `back/data/weekly-report.db` 重启后端 |
| 加载态截图抓不到 | 用 `HANG` 前缀输入挂起 Mock 20s（见第七节技巧） |
| `playwright-cli` 报 chrome 缺失 | 本机无 Google Chrome，`open` 时加 `--browser=chromium` |
| Windows 下 git 远程操作失败 | 按根 README 配置 `GIT_SSH_COMMAND` 走 SSH 443 通道 |
