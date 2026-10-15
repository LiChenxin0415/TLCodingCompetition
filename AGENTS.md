# AGENTS.md — 智能体强制协作规则

本仓库由多个智能体并行开发。以下规则是**强制**的，优先级高于任何默认习惯。
完整背景见 `README.md`。

## 1. 开工前必须同步（红线）

在修改任何本地文件（代码 / 资料 / 配置）之前，**必须先执行**：

```bash
git pull --rebase origin main
```

- 不允许跳过；不允许在未拉取的情况下编辑文件。
- 出现冲突先解决冲突，再开始自己的任务。
- 若因本地有未提交改动而被拒绝，可用 `git pull --rebase --autostash origin main`；但要注意 `--autostash` 会把**已暂存**的改动还原为**未暂存**，拉取后必须重新 `git add` 再提交（详见第 3 节）。

## 2. 定时推送成果

- 每完成一个小任务立即 `commit` + `push`。
- 连续开发时**至少每 10~15 分钟 push 一次**。
- 结束本轮任务前**必须 push**，不得把成果留在本地。

## 3. 提交与推送流程

**收工推送时固定用这个顺序：先提交 → 再同步 → 后推送。**

```bash
git add -A
git commit -m "[agent:<名称>][<模块>] <说明>"   # 模块: front|back|material|docs|chore
git pull --rebase origin main                   # 推送前再同步一次
git push origin main
```

> 第 1 节的 `pull` 是**动手前**执行；本节三步是**收工推送时**执行，两者不要混成一条链。

### ⚠️ 必须避免的「假成功」（本仓库真实踩坑）

**不要**写成 `git pull --rebase --autostash` → `git commit` → `git push`：

1. `--autostash` 会把**已暂存**的改动在拉取后还原成**未暂存**；
2. 此时 `git commit` 发现无内容可提交，**提交静默失败**（只提示 `no changes added to commit`）；
3. 紧接着 `git push` 因没有新提交而返回 `Everything up-to-date` —— **看起来成功了，实际什么都没推上去**。

**推送后必须自查这三项**，任一条不符即为未推成功：

```bash
git log --oneline -3          # ① 是否出现你刚才的提交信息
git status --short            # ② 是否还有未提交改动（应为空，或仅剩预期外的文件）
git ls-remote origin main     # ③ 远端 HEAD 是否等于本地 git rev-parse HEAD
```

## 4. 禁止事项

- 禁止 `git push --force` / `--force-with-lease` 到 `main`。
- 禁止改写已推送的历史（`commit --amend`、`reset --hard` 后强推）。
- 禁止为解决冲突而删除他人功能；不一致时保留双方实现并在提交信息中说明。
- 禁止提交密钥、Token、密码、真实 `.env`、超大二进制文件。
- 禁止在 `front/`、`back/`、`material/` 之外随意新建顶层目录（确有必要时先更新 README 并 push）。

## 5. 目录边界

| 目录 | 内容 |
| --- | --- |
| `front/` | 前端代码 |
| `back/` | 后端代码 |
| `material/` | 业需、概设、UI 等项目资料 |

只修改自己职责范围内的目录；跨模块改动需在提交信息里注明影响面。

## 6. 环境提示（本机）

- 远程地址：`ssh://git@ssh.github.com:443/LiChenxin0415/TLCodingCompetition.git`
- `github.com:443` 直连不可用，必须走 SSH 443 通道。
- Windows 下 Git 自带 ssh 会崩溃，任何 git 远程操作前先在本终端执行：
  - PowerShell：`$env:GIT_SSH_COMMAND = "C:/Windows/System32/OpenSSH/ssh.exe"`
  - Bash：`export GIT_SSH_COMMAND="C:/Windows/System32/OpenSSH/ssh.exe"`
  - 或在本仓库执行过一次：`git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`
- 克隆全新目录时**必须先设好上面的环境变量再 clone**，否则会失败。
