/**
 * API 路由总装（Base URL: /api）
 * 需求依据：api-spec-v1.md 第一~五节
 *
 * 挂载顺序说明：AI 路由（/reports/generate、/reports/team-summary*）先于周报资源路由注册，
 * 避免被 /reports/:id 抢占。
 */

import { Router } from 'express';
import { aiUsable, config } from '../config.ts';
import { currentWeek } from '../utils/isoWeek.ts';
import loginRoutes from './loginRoutes.ts';
import templateRoutes from './templateRoutes.ts';
import aiRoutes from './aiRoutes.ts';
import reportRoutes from './reportRoutes.ts';

const router = Router();

/** 健康检查（联调排障用，契约之外追加） */
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    week: currentWeek(),
    aiEnabled: aiUsable(),
    llmConfigured: config.llm.endpoints.length > 0,
  });
});

router.use('/login', loginRoutes);
router.use('/template', templateRoutes);
router.use('/reports', aiRoutes);
router.use('/reports', reportRoutes);

export default router;
