/**
 * 模板路由（api-spec 第三节）
 *   GET /api/template  四字段模板结构（TPL-01，登录用户）
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { getTemplate } from '../services/templateService.ts';

const router = Router();

router.get('/', requireAuth, (_req, res) => {
  res.json(getTemplate());
});

export default router;
