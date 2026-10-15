import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { createObjective, listObjectives, objectiveDetail, updateObjective } from '../services/objectiveService.ts';
import { objectiveOverview } from '../services/workbenchService.ts';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => res.json(listObjectives(authedUser(req))));
router.get('/overview', (req, res) => res.json(objectiveOverview(authedUser(req))));
router.post('/', requireRole('center', 'leader'), (req, res) => res.json(createObjective(authedUser(req), req.body as Record<string, unknown>)));
router.put('/:id', requireRole('center', 'leader'), (req, res) => res.json(updateObjective(authedUser(req), String(req.params.id), req.body as Record<string, unknown>)));
router.get('/:id', (req, res) => res.json(objectiveDetail(authedUser(req), String(req.params.id))));

export default router;
