import { Router } from 'express';
import { requireAuth, authedUser } from '../middleware/auth.ts';
import { generateContract } from '../ai/service.ts';
import { findObjective } from '../repositories/objectiveRepo.ts';
import { getDb } from '../db/index.ts';
import { unprocessable } from '../utils/errors.ts';
import { checkItem } from '../utils/algorithms.ts';

const router = Router();
router.use(requireAuth);

router.post('/contracts/generate', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const desc = String(body.desc ?? '').trim();
  if (desc === '') throw unprocessable('请输入工作描述');
  const objectiveId = typeof body.objective_id === 'string' ? body.objective_id : null;
  const objective = objectiveId !== null ? findObjective(getDb(), objectiveId) : null;
  res.json(await generateContract(authedUser(req).id, desc, objective !== null ? objective.name : null));
});

router.post('/contracts/check', (req, res) => {
  const items = Array.isArray((req.body as Record<string, unknown>)?.items) ? (req.body as { items: unknown[] }).items : [];
  const checks = items.map((raw) => {
    const r = raw as Record<string, unknown>;
    const c = checkItem({ targetDesc: String(r.target_desc ?? ''), dueDate: String(r.due_date ?? ''), deliverableType: String(r.deliverable_type ?? ''), deliverableDesc: String(r.deliverable_desc ?? '') });
    return { item_title: String(r.title ?? ''), ...c, pass: c.score >= 80 };
  });
  res.json({ checks });
});

export default router;
