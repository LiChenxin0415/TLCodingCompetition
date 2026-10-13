/**
 * 周报路由（api-spec 第四节）
 *   GET  /api/reports/mine      本人周报列表（member/leader，仅本人）
 *   GET  /api/reports/team      团队周报列表（leader）
 *   POST /api/reports           新建/更新本人本周周报
 *   GET  /api/reports/{id}      周报详情（本人 / leader）
 *   PUT  /api/reports/{id}      更新周报（本人 / leader 代编辑）
 *
 * 注意：/mine、/team 必须声明在 /:id 之前，否则会被 :id 抢占。
 */

import { Router } from 'express';
import { requireAuth, authedUser } from '../middleware/auth.ts';
import {
  getMine,
  getReportById,
  getTeamReports,
  saveMyReport,
  updateReportById,
} from '../services/reportService.ts';

const router = Router();

router.use(requireAuth);

router.get('/mine', (req, res) => {
  res.json(getMine(authedUser(req)));
});

router.get('/team', (req, res) => {
  res.json(getTeamReports(authedUser(req), req.query.week));
});

router.post('/', (req, res) => {
  res.json(saveMyReport(authedUser(req), req.body));
});

router.get('/:id', (req, res) => {
  res.json(getReportById(authedUser(req), req.params.id));
});

router.put('/:id', (req, res) => {
  res.json(updateReportById(authedUser(req), req.params.id, req.body));
});

export default router;
