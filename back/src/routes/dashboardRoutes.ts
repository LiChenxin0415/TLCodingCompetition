import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { drilldown, metrics } from '../services/dashboardService.ts';
import { overview, valueDistribution, trend, workload, risks, summaryReport } from '../services/workbenchService.ts';
import { resolveMonth } from '../utils/month.ts';

const router = Router();
router.use(requireAuth);
router.use(requireRole('leader', 'center'));

router.get('/metrics', (req, res) => res.json(metrics(authedUser(req), resolveMonth(req.query.month))));
router.get('/drilldown', (req, res) => res.json(drilldown(authedUser(req), String(req.query.metric ?? 'total'), resolveMonth(req.query.month))));

// FR-10 部门工作台
router.get('/overview', (req, res) => res.json(overview(authedUser(req), resolveMonth(req.query.month))));
router.get('/value-distribution', (req, res) => res.json(valueDistribution(authedUser(req), resolveMonth(req.query.month), String(req.query.by ?? 'count'))));
router.get('/trend', (req, res) => res.json(trend(authedUser(req), resolveMonth(req.query.month))));
router.get('/workload', (req, res) => res.json(workload(authedUser(req), resolveMonth(req.query.month))));
router.get('/risks', (req, res) => res.json(risks(authedUser(req), resolveMonth(req.query.month))));
router.post('/summary-report', (req, res) => res.json(summaryReport(authedUser(req), resolveMonth(req.query.month))));

export default router;
