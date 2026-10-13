/**
 * 登录路由（api-spec 第二节）
 *   POST /api/login     免密登录（LOGIN-02）
 *   GET  /api/accounts  预置账号列表（LOGIN-01 登录页账号卡片数据源）
 *
 * 说明：GET /api/accounts 是契约之外的**追加接口**（登录页需要展示 4 个预置账号卡片，
 * 避免前端硬编码账号），仅新增、不影响既有契约，详见 back/README.md。
 */

import { Router } from 'express';
import { listLoginAccounts, login } from '../services/userService.ts';

const router = Router();

router.post('/', (req, res) => {
  const body = req.body as { userId?: unknown } | undefined;
  res.json(login(body?.userId));
});

router.get('/accounts', (_req, res) => {
  res.json({ accounts: listLoginAccounts() });
});

export default router;
