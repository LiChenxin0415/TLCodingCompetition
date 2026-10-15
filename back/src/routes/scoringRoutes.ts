import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { calibration, publish, scoreItem, submitRating } from '../services/scoringService.ts';
import { resolveMonth } from '../utils/month.ts';

const router = Router();
router.use(requireAuth);

router.put('/items/:id/score', requireRole('leader', 'center'), (req, res) => res.json(scoreItem(authedUser(req), String(req.params.id), req.body as Record<string, unknown>)));
router.post('/contracts/:id/submit-rating', requireRole('leader', 'center'), (req, res) => res.json(submitRating(authedUser(req), String(req.params.id))));
router.get('/calibration', requireRole('center'), (req, res) => res.json(calibration(authedUser(req), resolveMonth(req.query.month))));
router.post('/publish', requireRole('center'), (req, res) => res.json(publish(authedUser(req), resolveMonth((req.body as Record<string, unknown>)?.month))));

export default router;