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
- 如果本地已有未提交改动导致 `pull` 被拒绝（`cannot pull with rebase: You have unstaged changes`），
  使用自动暂存模式：`git pull --rebase --autostash origin main`。（正常流程下应先提交再拉取。）

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

> ⚠️ 本机 Git 自带的 ssh 不可用（原因见下一节），**必须先指定 SSH 客户端再克隆**，
> 否则会报 `fatal: Could not read from remote repository`。

PowerShell：

```powershell
$env:GIT_SSH_COMMAND = "C:/Windows/System32/OpenSSH/ssh.exe"
git clone ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
cd TLCodingCompetition
```

Bash / Git Bash：

```bash
export GIT_SSH_COMMAND="C:/Windows/System32/OpenSSH/ssh.exe"
git clone ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
cd TLCodingCompetition
```

只对这一次命令生效、不改环境变量的写法：

```bash
git -c core.sshCommand="C:/Windows/System32/OpenSSH/ssh.exe" clone ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
```

### 已有仓库时配置 origin

```bash
git remote set-url origin ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
```

### ⚠️ Windows 必要配置：git 内置 ssh 不可用

本机 Git 自带的 cygwin `ssh.exe` 在沙箱环境下启动失败（报
`fatal error - CreateFileMapping ... Win32 error 5`），必须改用 Windows 原生 OpenSSH。
三种等效做法，任选其一：

```bash
# 方式 A（推荐，全局无侵入）：临时环境变量，当前终端会话内所有 git 命令生效
#   PowerShell: $env:GIT_SSH_COMMAND = "C:/Windows/System32/OpenSSH/ssh.exe"
#   Bash:       export GIT_SSH_COMMAND="C:/Windows/System32/OpenSSH/ssh.exe"

# 方式 B：写入当前仓库配置（本仓库已配置好，无需重复执行）
git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"

# 方式 C：只对单条命令生效
git -c core.sshCommand="C:/Windows/System32/OpenSSH/ssh.exe" <命令>

# 主机密钥（本机 known_hosts 已写入，换机器时需要执行一次）
"C:/Windows/System32/OpenSSH/ssh-keyscan.exe" -p 443 ssh.github.com >> C:/Users/<用户名>/.ssh/known_hosts
```

验证通道是否可用：

```bash
# 注意用原生 ssh 验证，不要用 PATH 里 git 自带的 ssh
"C:/Windows/System32/OpenSSH/ssh.exe" -T -p 443 git@ssh.github.com
# 期望输出：Hi <用户名>! You've successfully authenticated...
```

> 使用 HTTPS 代理时（`127.0.0.1:7890`）：`git config --global http.proxy http://127.0.0.1:7890`，
> 但注意 `github.com` 走代理仍会被重置，推送请一律使用上面的 SSH 443 通道。
> 本机 `.git/config` 中的 `core.sshCommand` 属于**本地配置、不会随仓库分发**，
> 因此换目录/换机器克隆时请按上面方式 A 或 C 操作。

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

## 六、同事 / 新机器接入与 push 失败排查

> 本仓库是 **public（公开）**：任何人都能 `clone`（读），但**只有 Collaborator 才能 `push`（写）**。
> 因此「能拉代码、但提交被拒」基本可以锁定为**权限或网络通道**问题，而不是代码问题。

### 第 1 步：确认邀请是否真的已接受（仓库所有者检查）

打开 `Settings → Collaborators and teams`（即
`https://github.com/LiChenxin0415/TLCodingCompetition/settings/access`）：

| 显示状态 | 含义 | 处理 |
| --- | --- | --- |
| `Pending invite` / 待接受 | **邀请尚未生效**，对方还没有写权限 | 让对方到邮箱点接受（注意垃圾邮件），或在 GitHub 通知页接受；邀请 **7 天过期**需重发 |
| 已显示为成员 | 权限已生效 | 转第 2 步 |

⚠️ 常见坑：邀请邮件会发到**该邮箱所绑定的 GitHub 账号**。若对方 GitHub 账号没有绑定这个邮箱，
对方**根本看不到邀请**。此时应让对方提供其 GitHub 用户名，按用户名邀请，或让对方先把该邮箱
加到自己的 GitHub 账号（Settings → Emails）。

### 第 2 步：判断卡在哪一层（同事在本机执行）

```powershell
# A. 本地能不能提交（报 "Please tell me who you are" 说明是本地身份未配置）
git config user.name ; git config user.email

# B. 通道通不通（两条分别测）
git ls-remote https://github.com/LiChenxin0415/TLCodingCompetition.git
git ls-remote ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git

# C. 写权限生效没有（在已 clone 的仓库内执行）
git push origin main
```

### 第 3 步：按现象对症处理

| 现象（关键词） | 原因 | 处理 |
| --- | --- | --- |
| `Connection was reset` / `Failed to connect` / 超时（`github.com:443`） | **网络受限**，与权限无关 | 改走 SSH 443 通道（见第 4 步）；HTTPS 在此网络下不可用 |
| `Permission to LiChenxin0415/TLCodingCompetition.git denied to <用户名>`（403） | 邀请未接受，或用错了账号 / 令牌 | 回第 1 步；核对报错里的用户名是否就是被邀请的人 |
| `Permission denied (publickey)` | SSH 公钥没加到**自己的** GitHub 账号 | 把 `id_ed25519.pub` 加到 GitHub → Settings → SSH and GPG keys |
| `! [rejected] main -> main (fetch first)` / `non-fast-forward` | 本地落后于远端（他人已推送） | `git pull --rebase origin main` 后重新 `git push` |
| `Please tell me who you are` / `unable to auto-detect email address` | 本地没配提交身份（这属于**无法 commit**） | `git config user.name "你的名字"` + `git config user.email "你的邮箱"` |
| `GH007: Your push would publish a private email address` | 账号开启了邮箱隐私保护 | 把 `user.email` 改为 GitHub 的 `xxxx@users.noreply.github.com` 后重新提交 |
| `Authentication failed` / 要求输入密码（HTTPS） | GitHub 已不支持账号密码 | 用 Personal Access Token 作为密码（见第 5 步） |
| `fatal: not a git repository` | 不在仓库目录里执行 | `cd` 到仓库根目录再执行 |

### 第 4 步（受限网络推荐）：用 SSH over 443 接入

```powershell
# 1) 生成自己的密钥（已有可跳过）
ssh-keygen -t ed25519 -C "你的邮箱"

# 2) 复制公钥内容，加到 GitHub → Settings → SSH and GPG keys → New SSH key
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub

# 3) 验证（Windows 下请用原生 ssh，不要用 git 自带的 ssh）
& "C:/Windows/System32/OpenSSH/ssh.exe" -T -p 443 git@ssh.github.com
#    期望输出：Hi <你的用户名>! You've successfully authenticated...

# 4) 克隆与推送都走 443 通道
$env:GIT_SSH_COMMAND = "C:/Windows/System32/OpenSSH/ssh.exe"
git clone ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git
cd TLCodingCompetition
git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"
```

> 每个新终端会话都要先设一次 `GIT_SSH_COMMAND`（原因见第四章）。

### 第 5 步（HTTPS 方式，仅当网络正常时）

1. GitHub → Settings → Developer settings → Personal access tokens 生成令牌
   （classic 勾选 `repo`；fine-grained 选择本仓库并给 `Contents: Read and write`）。
2. 把远程地址改为 HTTPS，并把**令牌当作密码**输入：
   ```powershell
   git remote set-url origin https://github.com/LiChenxin0415/TLCodingCompetition.git
   git push origin main
   ```
3. 若报 `GH007`，按第 3 步改 `user.email` 为 noreply 邮箱后重试。

---

## 七、待补充（随项目推进更新）

- [ ] 项目业务背景与竞赛题目说明
- [ ] 前端技术栈与启动方式（补充到 `front/README.md`）
- [ ] 后端技术栈、数据库与启动方式（补充到 `back/README.md`）
- [ ] 接口文档地址与联调环境
- [ ] 各智能体职责分工清单
