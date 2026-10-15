import { Router } from 'express';
import { requireAuth, requireRole, authedUser } from '../middleware/auth.ts';
import { getContractForUser, getMyContractByMonth, getOrCreateContract, listMyContracts, listTeamContracts, reviewContract, saveItems, submitContract } from '../services/contractService.ts';
import { resolveMonth } from '../utils/month.ts';

const router = Router();
router.use(requireAuth);

router.get('/mine', (req, res) => {
  const user = authedUser(req);
  const month = resolveMonth(req.query.month);
  const contract = getMyContractByMonth(user, month);
  const items = contract === null ? [] : getContractForUser(user, contract.id).items;
  res.json({ contract, items });
});

router.get('/mine/history', (req, res) => {
  res.json(listMyContracts(authedUser(req)));
});

router.post('/', (req, res) => {
  const user = authedUser(req);
  const month = resolveMonth((req.body as Record<string, unknown>)?.month);
  res.json(getOrCreateContract(user, month));
});

router.get('/team', requireRole('leader', 'center'), (req, res) => {
  res.json(listTeamContracts(authedUser(req), resolveMonth(req.query.month)));
});

router.get('/export', requireRole('leader', 'center'), (req, res) => {
  const rows = listTeamContracts(authedUser(req), resolveMonth(req.query.month));
  const lines = ['月份\t成员\t工作包\t类型\t优先级\t权重\t进度\t评分\t评分说明'];
  for (const r of rows) {
    const c = r.contract as { month: string; userId: string };
    const items = r.items as Array<Record<string, unknown>>;
    for (const it of items) lines.push([c.month, c.userId, it.title, it.type, it.priority, it.weight, it.progress, it.score ?? '', ''].join('\t'));
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contracts-' + resolveMonth(req.query.month) + '.txt"');
  res.send('\uFEFF' + lines.join('\n'));
});

router.get('/:id', (req, res) => res.json(getContractForUser(authedUser(req), String(req.params.id))));

router.put('/:id/items', (req, res) => res.json(saveItems(authedUser(req), String(req.params.id), (req.body as Record<string, unknown>)?.items)));

router.post('/:id/submit', (req, res) => res.json(submitContract(authedUser(req), String(req.params.id))));

router.post('/:id/confirm', requireRole('leader', 'center'), (req, res) => res.json(reviewContract(authedUser(req), String(req.params.id), true, '')));
router.post('/:id/reject', requireRole('leader', 'center'), (req, res) => res.json(reviewContract(authedUser(req), String(req.params.id), false, String((req.body as Record<string, unknown>)?.note ?? ''))));

export default router;