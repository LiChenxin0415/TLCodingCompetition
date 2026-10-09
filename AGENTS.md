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
- 若因本地未提交改动被拒绝，使用 `git pull --rebase --autostash origin main`。

## 2. 定时推送成果

- 每完成一个小任务立即 `commit` + `push`。
- 连续开发时**至少每 10~15 分钟 push 一次**。
- 结束本轮任务前**必须 push**，不得把成果留在本地。

## 3. 推送流程

```bash
git pull --rebase origin main
git add -A
git commit -m "[agent:<名称>][<模块>] <说明>"   # 模块: front|back|material|docs|chore
git pull --rebase origin main                   # 推送前再同步一次
git push origin main
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
- Windows 下需先设置：`git config core.sshCommand "C:/Windows/System32/OpenSSH/ssh.exe"`
