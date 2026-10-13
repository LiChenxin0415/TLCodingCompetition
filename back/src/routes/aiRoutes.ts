/**
 * AI 路由（api-spec 第五节）
 *   POST /api/reports/generate               AI 生成个人周报（登录用户）
 *   POST /api/reports/team-summary           AI 汇总团队周报（leader）
 *   GET  /api/reports/team-summary/export    导出团队周报 .txt（leader，OVR-08）
 */

import { Router } from 'express';
import { requireAuth, requireLeader } from '../middleware/auth.ts';
import {
  buildExportText,
  exportFileName,
  generatePersonalReport,
  generateTeamSummary,
  getSummarySnapshot,
} from '../services/aiService.ts';
import { badRequest } from '../utils/errors.ts';
import { resolveWeek } from '../services/reportService.ts';

const router = Router();

router.use(requireAuth);

router.post('/generate', async (req, res) => {
  const body = req.body as { input?: unknown } | undefined;
  res.json(await generatePersonalReport(body?.input));
});

router.post('/team-summary', requireLeader, async (req, res) => {
  const body = req.body as { week?: unknown } | undefined;
  res.json(await generateTeamSummary(body?.week));
});

router.get('/team-summary/export', requireLeader, (req, res) => {
  const week = resolveWeek(req.query.week);
  const snapshot = getSummarySnapshot(week);
  if (snapshot === null) {
    throw badRequest('请先生成团队周报后再导出');
  }

  const filename = exportFileName(snapshot.week);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="team-weekly-${snapshot.week}.txt"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  // BOM：保证 Windows 记事本 / Excel 打开时中文不乱码（对应种子数据里记录的"导出乱码"问题）
  res.send(`\uFEFF${buildExportText(snapshot.summary)}`);
});

export default router;
