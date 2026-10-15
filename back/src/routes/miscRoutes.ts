import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { hideSkill, listSkills, regenerateSkills } from '../services/skillService.ts';
import { exportAuditText, listAudit } from '../services/auditService.ts';

const router = Router();
router.use(requireAuth);

router.get('/skills/:userId', (req, res) => res.json(listSkills(authedUser(req), String(req.params.userId))));
router.post('/skills/:userId/regenerate', (req, res) => res.json(regenerateSkills(authedUser(req), String(req.params.userId))));
router.post('/skills/hide/:tagId', requireRole('center'), (req, res) => { hideSkill(authedUser(req), String(req.params.tagId)); res.json({ ok: true }); });

router.get('/audit', requireRole('center'), (req, res) => res.json(listAudit(authedUser(req))));
router.get('/audit/export', requireRole('center'), (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="audit-log.txt"');
  res.send('\uFEFF' + exportAuditText(authedUser(req)));
});

export default router;