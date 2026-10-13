# 接口契约 / API 规格说明（API Spec）

- **文档版本**：v1.0
- **对应需求**：需求文档 6.2（接口定义）、6.1（数据字典）、第七章（异常边界）
- **地位**：**冻结契约**。前端按此 Mock 先行，后端按此实现，联调以此为准。
- **更新日期**：2026-10

> 通用约定：所有接口除登录外均需 `Authorization: Bearer <token>`。统一响应错误体 `{ code, message }`（错误码见需求 6.2 / 本文件第九节）。

---

## 一、通用约定

- **Base URL**：`/api`
- **Content-Type**：`application/json`（导出接口为文件流）
- **鉴权**：除 `POST /api/login` 外，所有接口需在 Header 携带 `Authorization: Bearer <token>`。
- **统一错误响应**：
  ```json
  { "code": 403, "message": "无权限访问" }
  ```
- **周次格式**：ISO 8601 周，服务端按当前日期计算，`YYYY-Www`（如 `2026-W42`），用户不可修改。
- **字段数组存储**：`weekDone/ongoing/issues/nextPlan` 均为字符串数组，每条 ≤50 字。

---

## 二、用户模块

### POST /api/login
- **权限**：公开
- **请求**：
  ```json
  { "userId": "member01" }
  ```
- **响应 200**：
  ```json
  {
    "token": "<jwt, 有效期24h>",
    "user": { "id": "member01", "name": "李成员", "role": "member" }
  }
  ```
- **说明**：无密码（LOGIN-02）；`userId` 不在预置表内返回 400。

---

## 三、模板模块

### GET /api/template
- **权限**：登录用户
- **请求**：无
- **响应 200**：
  ```json
  {
    "fields": [
      { "key": "weekDone",  "label": "本周完成",   "required": true,  "maxItems": 5, "maxLen": 50 },
      { "key": "ongoing",   "label": "进行中",     "required": true,  "maxItems": 3, "maxLen": 50 },
      { "key": "issues",    "label": "问题与风险", "required": false, "maxItems": 3, "maxLen": 50 },
      { "key": "nextPlan",  "label": "下周计划",   "required": true,  "maxItems": 3, "maxLen": 50 }
    ]
  }
  ```
- **说明**：前后端共用结构（TPL-01），前端不硬编码。

---

## 四、周报模块

### GET /api/reports/mine
- **权限**：member / leader（仅返回本人）
- **响应 200**：
  ```json
  [
    {
      "id": "rpt_xxx", "week": "2026-W42", "status": "draft",
      "weekDone": ["完成登录接口联调"], "ongoing": ["周报总览页(70%)"],
      "issues": ["暂无"], "nextPlan": ["接入权限测试"],
      "lastEditorId": "member01", "updatedAt": "2026-10-13 14:30"
    }
  ]
  ```
- **列表摘要规则**（4.4）：返回字段同上；「本周完成摘要」由前端取 `weekDone[0]` 截断 20 字展示。

### POST /api/reports
- **权限**：member（仅本人）
- **请求**（全字段 + status）：
  ```json
  {
    "weekDone": ["完成登录接口"], "ongoing": ["总览页(70%)"],
    "issues": ["暂无"], "nextPlan": ["权限测试"],
    "status": "draft"
  }
  ```
  > `week` 由服务端按当前日期计算，前端可不传；同周次重复保存为更新（REP-03）。
- **响应 200**：创建/更新后的周报对象（含 `id`、`week`、`updatedAt`、`lastEditorId`）。
- **错误**：`weekDone/ongoing/nextPlan` 缺失或数量越界 → 400。

### GET /api/reports/{id}
- **权限**：本人 / leader
- **响应 200**：单个周报完整对象（同 mine 元素）。
- **错误**：资源非本人且非 leader → 403（AUTH-02）。

### PUT /api/reports/{id}
- **权限**：本人 / leader（任意）
- **请求**：同 POST 全字段（可部分更新）。
- **响应 200**：更新后的周报对象。
- **规则**：`status` 由 `submitted` 编辑后回退 `draft`（REP-02）；`lastEditorId` 写为操作者；并发最后写入优先（LEAD-04）。

### GET /api/reports/team
- **权限**：leader
- **请求**：`?week=2026-W42`（默认本周）
- **响应 200**：
  ```json
  [
    {
      "user": { "id": "member01", "name": "李成员", "role": "member" },
      "report": { "week": "2026-W42", "status": "submitted", "weekDone": [...], "ongoing": [...], "issues": [...], "nextPlan": [...], "lastEditorId": "member01", "updatedAt": "..." }
    },
    {
      "user": { "id": "member02", "name": "张成员", "role": "member" },
      "report": null
    }
  ]
  ```
  > `report` 为 `null` 表示「未开始」（本周无周报），前端据此标 ⚠（OVR-01）。
- **错误**：member 访问 → 403。

---

## 五、AI 模块

### POST /api/reports/generate
- **权限**：登录用户（member 主用；leader 不提供入口，LEAD-05）
- **请求**：
  ```json
  { "input": "这周主要在弄登录和周报的接口，联调差不多弄完了，就差权限那块还没测..." }
  ```
  > `input` 必填、非空、≤2000 字（GEN-01/02）；否则 400。
- **响应 200**（严格 JSON，四字段均为字符串数组）：
  ```json
  {
    "weekDone": ["完成登录接口联调", "周报模块 CRUD 实现"],
    "ongoing": ["权限校验模块(60%)"],
    "issues": ["暂无"],
    "nextPlan": ["权限用例测试", "总览页联调"]
  }
  ```
- **错误**：超时 >20s → 504；解析失败 / 网络错误 → 视同失败（GEN-06），前端可重试 / 降级。

### POST /api/reports/team-summary
- **权限**：leader
- **请求**：
  ```json
  { "week": "2026-W42" }
  ```
  > 无任何成员保存过周报时，返回 400 + 提示「暂无可汇总的周报」（OVR-05）。
- **响应 200**（四段结构，严格 JSON）：
  ```json
  {
    "overall": "本周团队整体推进顺利，核心接口联调完成，总览页待收尾。",
    "achievements": ["李成员：完成登录与周报 CRUD", "张成员：模板查询接口", "王负责人：代补风险说明"],
    "risks": ["刘成员：权限测试阻塞，需后端支持"],
    "nextFocus": ["权限用例测试", "团队总览页联调", "演示数据灌入"]
  }
  ```
  > `risks` 无风险时为 `["本周无明显风险"]`（OVR-06）。
- **错误**：超时 / 解析失败 → 504 / 失败重试（OVR-07）。

### GET /api/reports/team-summary/export
- **权限**：leader
- **请求**：`?week=2026-W42`
- **响应**：`text/plain` 文件流，附件名 `团队周报_2026-W42.txt`，内容为四段纯文本：
  ```
  整体进展：
  <overall>

  关键成果：
  - <achievements[0]>
  ...

  风险集中点：
  - <risks[0]>

  下周重点：
  - <nextFocus[0]>
  ```
- **说明**：复制全文（OVR-08）由前端直接拿 `team-summary` 结果拼文本；导出走本接口。

---

## 六、错误码汇总

| 错误码 | 场景 | 前端行为 |
| --- | --- | --- |
| 400 | 参数缺失 / 超长 / 格式错误（GEN-01、空可汇总） | 表单级错误提示 |
| 401 | 未登录 / token 失效 | 跳转登录页 |
| 403 | 越权访问他人资源（AUTH-02） | 提示「无权限访问」 |
| 504 | AI 生成超时（>20s） | 提示重试 + 降级入口 |
| 500 | 服务端异常 | 提示「服务异常，请稍后重试」 |

---

## 七、变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10 | 初版：9 个接口的入参/出参/权限/错误码，冻结契约 |
