import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { drilldown, metrics } from '../services/dashboardService.ts';
import { resolveMonth } from '../utils/month.ts';

const router = Router();
router.use(requireAuth);
router.use(requireRole('leader', 'center'));

router.get('/metrics', (req, res) => res.json(metrics(authedUser(req), resolveMonth(req.query.month))));
router.get('/drilldown', (req, res) => res.json(drilldown(authedUser(req), String(req.query.metric ?? 'total'), resolveMonth(req.query.month))));

export default router;