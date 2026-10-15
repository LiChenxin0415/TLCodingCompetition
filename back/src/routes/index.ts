import { Router } from 'express';
import { aiUsable, config } from '../config.ts';
import { currentMonth } from '../utils/month.ts';
import authRoutes from './authRoutes.ts';
import objectiveRoutes from './objectiveRoutes.ts';
import contractRoutes from './contractRoutes.ts';
import executionRoutes from './executionRoutes.ts';
import aiRoutes from './aiRoutes.ts';
import scoringRoutes from './scoringRoutes.ts';
import dashboardRoutes from './dashboardRoutes.ts';
import miscRoutes from './miscRoutes.ts';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', month: currentMonth(), aiEnabled: aiUsable(), llmConfigured: config.llm.endpoints.length > 0 });
});

router.use(authRoutes);
router.use('/objectives', objectiveRoutes);
router.use('/contracts', contractRoutes);
router.use('/ai', aiRoutes);
router.use(executionRoutes);
router.use(scoringRoutes);
router.use('/dashboard', dashboardRoutes);
router.use(miscRoutes);

export default router;