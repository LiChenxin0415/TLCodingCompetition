# back — 后端代码

本目录存放本项目的**后端工程代码**，由后端相关智能体负责维护。

> **当前状态：已实现并验证** ——《目标合约通》后端已按 `material/design/HLD-目标合约通-v1.0.md` 落地，
> 11 张表 / 8 个 service / 全部接口（P0/P1/P2）、AI 四能力接 DeepSeek（外网）+ 降级、7 账号种子数据；
> `typecheck` 0 错误、冒烟 **24/24 通过**、AI 真实调用验证通过。

## 快速开始

```bash
cd back
npm install                     # 首次安装（.npmrc 已把缓存指到 .npm-cache）
cp .env.example .env            # 填 LLM_API_KEY 即可启用外网 AI；不填则降级
npm start                       # http://localhost:3000/api
npm run smoke                   # 冒烟测试（需服务已启动）
npm run mock:llm                # 本地 Mock LLM（断网演示 AI 链路）
```

- 接口契约、数据模型、核心算法见 `material/design/HLD-目标合约通-v1.0.md`（§5 数据模型 / §7 接口 / §8 规则 / §9 AI）。
- 鉴权：免密登录 `POST /api/login`；三角色 employee / leader / center，行级权限由服务端强制。

---

## 一、目录约定

```
back/
├── README.md        # 本文件：后端说明与启动方式
└── <工程根目录>/     # 后端工程（脚手架生成后放在这里，或直接以 back/ 为工程根）
```

> 脚手架生成后，请把**技术栈、数据库、启动命令、接口清单**补充到本文件，并立即 push。

---

## 二、开工前必读（协作要求）

1. **先同步再动手（红线）**：`git pull --rebase origin main`。完整规范见根目录 `README.md`「协作铁律」。
2. **小步提交、定时推送**：完成一个接口/一个模块就 commit + push；连续开发每 10~15 分钟 push 一次。
3. **提交顺序固定为**：`git add` → `git commit` → `git pull --rebase` → `git push`。
   ⚠️ **不要先 `git pull --rebase --autostash` 再 commit**：`--autostash` 会把已暂存的改动还原成未暂存，导致 commit 时「无内容可提交」，而 push 又显示 `up-to-date`——这是一个很容易误判为成功的**假成功**。
4. **接口先行**：新增或变更接口时，先更新接口契约文档，再改代码，并在提交信息中注明影响的 `front` 改动点。
5. **数据库变更**：建表语句保持可重复执行（如 `CREATE TABLE IF NOT EXISTS`）；已有数据的迁移另写脚本，禁止直接改动历史脚本的语义。
6. **依赖文件冲突**：`package.json` / `pom.xml` / `requirements.txt` / 锁文件是高频冲突点，改动后立即 push。
7. **不要提交**：`node_modules/`、编译产物（`dist/`、`target/`、`__pycache__/`）、数据库文件、`.env`、密钥、日志。

---

## 三、环境须知（本机实测结论，可直接复用）

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `clone` / `push` 报连接被重置 | 本机 `github.com:443` 不可达 | 走 SSH 443 通道 `ssh://git@ssh.github.com:443/...`，详见根 `README.md` 第四章 |
| `npm install` 报 EPERM | npm 默认缓存目录在工作区外被拒绝写入 | 在本目录放 `.npmrc`：`cache=.npm-cache`（并 gitignore 该目录） |
| 依赖安装卡在原生编译 | 需匹配运行时 ABI 的预编译包或本机 C++ 构建工具链 | **优先选零编译方案**（例如用运行时的内置能力替代原生模块），比赛现场没有时间排构建故障 |

> 第 3 条是上一轮实际踩到的坑：原生编译依赖是现场最大的不确定性来源，选型时优先规避。

---

## 四、提交信息示例

```
[agent:backend-dev][back] 实现 /api/reports CRUD 与权限校验
[agent:backend-dev][back] 新增 AI 生成接口与降级模式
```

模块名固定用 `back`，格式见根 `README.md`「提交信息规范」。

---

## 五、待补充（脚手架就绪后逐项填写）

- [ ] 技术栈与版本（语言、框架、ORM、数据库）
- [ ] 安装与启动命令（含服务端口）
- [ ] 数据库连接、建表与**种子数据**灌入/重置步骤
- [ ] 接口清单（路径 / 入参 / 出参 / 权限）与统一错误码约定
- [ ] 鉴权方式与令牌有效期
- [ ] 环境变量说明（`.env.example`，密钥只放本地 `.env`）
- [ ] 外部依赖（如大模型）的**超时、重试与降级开关**
- [ ] 冒烟/回归测试的启动方式（供测试智能体复用）

---

## 六、变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10 | 初始化：目录约定、协作要求、环境须知、待补充清单 |
