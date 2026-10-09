# TLCodingCompetition

TL 编程竞赛项目仓库。本仓库由**多个智能体（Agent）并行协作开发**，因此在动手写任何一行代码之前，
请先完整阅读本文档中的「协作铁律」章节。

- 远程仓库：`ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git`
- 主分支：`main`（默认分支，所有智能体的同步基线）
- 仓库主页：https://github.com/LiChenxin0415/TLCodingCompetition

---

## 一、目录结构

```
TLCodingCompetition/
├── front/       # 前端代码（前端智能体负责）
├── back/        # 后端代码（后端智能体负责）
├── material/    # 项目资料：业务需求、概要设计、UI 设计稿等
├── README.md    # 本文件：仓库总览 + 协作规范
└── AGENTS.md    # 面向智能体的强制协作规则（精简版，优先遵守）
```

| 目录 | 用途 | 谁可以改 |
| --- | --- | --- |
| `front/` | 前端工程源码、构建配置、前端单测 | 前端相关智能体 |
| `back/` | 后端工程源码、数据库脚本、接口实现、后端单测 | 后端相关智能体 |
| `material/` | **需求与设计类资料**：业务需求（业需）、概要设计（概设）、UI 设计稿、接口文档、评审记录 | 全员可读；资料负责人可写 |

> 各目录的详细约定见目录内的 `README.md`。

---

## 二、协作铁律（强制，所有智能体必须遵守）

### 1. 先拉取，后开发（红线）
**任何智能体在修改本地代码/资料之前，必须先拉取远程最新内容。** 不允许基于过期代码开工。

```bash
git pull --rebase origin main
```

- 不允许跳过这一步直接编辑文件。
- 如果 `pull` 出现冲突，**先解决冲突**，解决完再开始自己的开发。

### 2. 小步提交，定时推送
- 每完成一个**可自洽的小任务**（一个接口、一个页面、一份文档）就立即提交并推送，不要攒一大批改动。
- 长时间连续开发的，**至少每 10~15 分钟 push 一次**，把成果同步到远程，避免其他智能体读到旧代码。
- **收工（结束本轮任务）前必须 push**，本地不允许留存未推送的成果。

### 3. 推送前再同步一次
推送前必须再次 `pull --rebase`，避免被拒绝或覆盖他人提交：

```bash
git pull --rebase origin main
git push origin main
```

### 4. 提交信息规范
```
[agent:<智能体名称>][<模块>] <简要说明>
```
示例：
```
[agent:frontend-dev][front] 新增登录页表单校验
[agent:backend-dev][back] 实现 /api/user/login 接口
[agent:ba][material] 补充业需 V0.3 订单流程
```
- `<模块>` 取值：`front` / `back` / `material` / `docs` / `chore`。
- 一次提交只做一件事，说明写清楚「做了什么」，便于并发智能体判断影响面。

### 5. 冲突与安全底线
- **禁止** `git push --force` / `--force-with-lease` 推送到 `main`。
- **禁止** 改写已推送的公共历史（`commit --amend`、`reset --hard` 后强推）。
- 冲突解决原则：保留双方有效改动，**不要为了消除冲突而删除他人的功能**；无法判断时在提交信息或 PR 中说明并保留两份实现。
- **禁止**提交任何密钥、Token、账号密码、`.env` 真实配置、超大二进制文件。

### 6. 减少同文件竞争
- 智能体之间尽量按「文件」划分工作边界；多人需要改同一文件时，先沟通（issue / PR / 提交信息备注），并尽量**小块多次**提交以便 rebase。
- 公共入口文件（如路由表、`package.json`、`pom.xml`、`requirements.txt`、README 索引）修改后要**立即 push**，减少他人等待。

---

## 三、标准工作流

每个智能体每一轮任务的固定动作：

```bash
# 0) 进入仓库
cd TLCodingCompetition

# 1) 开工前同步（红线）
git pull --rebase origin main

# 2) 开发 / 写文档 ...

# 3) 小步提交（可多次）
git add -A
git commit -m "[agent:<name>][<module>] xxx"

# 4) 定时同步：推送前再次 rebase
git pull --rebase origin main

# 5) 推送成果
git push origin main
```

> 有推送脚本时也可使用：`git pull --rebase origin main && git push origin main`（Windows 下分两条执行）。

### 分支策略
- **常规小改动**：直接在 `main` 上提交（必须 `pull --rebase`）。
- **大改动 / 重构 / 试验性方案**：拉特性分支 `feature/<模块>-<简述>`，开发完成后合并回 `main` 并推送，避免影响其他智能体。
- 任何情况下 `main` 必须始终是可用的、能拉取的状态。

---

## 四、网络与远程仓库配置（本机必读）

本机直连 `github.com:443` 会被重置，请使用下面的可用通道：

| 通道 | 状态 | 说明 |
| --- | --- | --- |
| `https://github.com/...` | ❌ 连接被重置 | 无法 clone / fetch / push |
| `ssh://git@ssh.github.com:443/...` | ✅ 可用 | **推荐**，SSH 密钥已配置 |
| `https://api.github.com` | ✅ 可用 | 查询仓库信息（需走代理 `127.0.0.1:7890`） |
| `https://codeload.github.com`、`https://raw.githubusercontent.com` | ✅ 可用 | 可下载压缩包 / 读取单文件（需走代理） |

### 首次克隆（使用 SSH 443 通道）

```bash
git clone ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
cd TLCodingCompetition
```

### 已有仓库时配置 origin

```bash
git remote set-url origin ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
```

### ⚠️ Windows 必要配置：git 内置 ssh 不可用

本机 Git 自带的 cygwin `ssh.exe` 在沙箱环境下启动失败，必须改用 Windows 原生 OpenSSH：

```bash
# 在当前仓库生效（推荐，每个克隆下来的仓库都执行一次）
git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"

# 首次连接时把主机密钥写入 known_hosts（缺省会因校验失败而拒绝连接）
"C:/Windows/System32/OpenSSH/ssh-keyscan.exe" -p 443 ssh.github.com >> C:/Users/<用户名>/.ssh/known_hosts
```

验证通道是否可用：

```bash
ssh -T -p 443 git@ssh.github.com     # 期望输出：Hi <用户名>! You've successfully authenticated...
```

> 使用 HTTPS 代理时（`127.0.0.1:7890`）：`git config --global http.proxy http://127.0.0.1:7890`，
> 但注意 `github.com` 走代理仍会被重置，推送请一律使用上面的 SSH 443 通道。

---

## 五、资料（material）协作约定

`material/` 存放**非代码类交付物**，建议按以下子目录组织（可随项目推进调整）：

```
material/
├── requirements/   # 业务需求（业需）：需求说明、用户故事、验收标准
├── design/         # 概要设计（概设）：架构图、模块划分、数据库设计、接口定义
├── ui/             # UI 设计：原型、设计稿、切图、设计规范
└── meeting/        # 会议纪要、评审记录、决策记录
```

- 文档一律使用 Markdown（图片放同目录 `assets/`），文件名使用英文小写加中划线：`order-flow-v1.md`。
- 需求或设计一旦变更，**必须同时更新文档并 push**，不允许只口头同步；接口/字段变更需在提交信息中注明影响模块（`front` / `back`）。
- 资料是开发的输入：前端、后端智能体在实现前应确认 `material/` 中的最新版本，避免实现与设计不一致。

---

## 六、待补充（随项目推进更新）

- [ ] 项目业务背景与竞赛题目说明
- [ ] 前端技术栈与启动方式（补充到 `front/README.md`）
- [ ] 后端技术栈、数据库与启动方式（补充到 `back/README.md`）
- [ ] 接口文档地址与联调环境
- [ ] 各智能体职责分工清单
