import { Router } from 'express';
import { listAccounts, login } from '../services/userService.ts';
import { requireAuth, authedUser } from '../middleware/auth.ts';

const router = Router();

router.post('/login', (req, res) => {
  const body = req.body as { userId?: unknown } | undefined;
  res.json(login(body?.userId));
});

router.get('/accounts', (_req, res) => {
  res.json({ accounts: listAccounts() });
});

router.get('/me', requireAuth, (req, res) => {
  res.json(authedUser(req));
});

export default router;