import { Router } from 'express';
import { requireAuth, authedUser } from '../middleware/auth.ts';
import { confirmProgress, parseProgressText } from '../services/progressService.ts';
import { addDeliverableFile, addDeliverableLink, deleteDeliverable, listDeliverables } from '../services/deliverableService.ts';
import { uploadReport, parseReportContent, adoptReport } from '../services/reportService.ts';
import { deliverableUpload, reportUpload, multerErrorToApi } from '../utils/upload.ts';

const router = Router();
router.use(requireAuth);

// 进度
router.post('/progress/parse', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  res.json(await parseProgressText(authedUser(req), body.text, body.item_id));
});
router.post('/progress/confirm', (req, res) => res.json(confirmProgress(authedUser(req), req.body as Record<string, unknown>)));

// 交付物
router.get('/items/:id/deliverables', (req, res) => res.json(listDeliverables(authedUser(req), String(req.params.id))));
router.post('/items/:id/deliverables/link', (req, res) => res.json(addDeliverableLink(authedUser(req), String(req.params.id), String((req.body as Record<string, unknown>)?.url ?? ''))));
router.post('/items/:id/deliverables/file', (req, res, next) => {
  deliverableUpload.single('file')(req, res, (err: unknown) => {
    if (err) return next(multerErrorToApi(err));
    const file = (req as { file?: Express.Multer.File }).file;
    if (file === undefined) return next(new Error('NO_FILE'));
    res.json(addDeliverableFile(authedUser(req), String(req.params.id), { originalname: file.originalname, filename: file.filename, path: file.path, size: file.size }));
  });
});
router.delete('/deliverables/:id', (req, res) => { deleteDeliverable(authedUser(req), String(req.params.id)); res.json({ ok: true }); });

// 日报周报
router.post('/reports', (req, res, next) => {
  reportUpload.single('file')(req, res, (err: unknown) => {
    if (err) return next(multerErrorToApi(err));
    const body = req.body as Record<string, unknown>;
    const file = (req as { file?: Express.Multer.File }).file;
    res.json(uploadReport(authedUser(req), String(body.kind ?? ''), String(body.period ?? ''), typeof body.text === 'string' ? body.text : null, file !== undefined ? { originalname: file.originalname, filename: file.filename } : null));
  });
});
router.post('/reports/:id/parse', async (req, res) => {
  res.json(await parseReportContent(authedUser(req), String(req.params.id)));
});
router.post('/reports/:id/adopt', (req, res) => res.json(adoptReport(authedUser(req), String(req.params.id), req.body as Record<string, unknown>)));

export default router;