import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { config } from '../config.ts';
import { badRequest, ApiError } from './errors.ts';

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'zip', 'md', 'txt'];
const MAX_FILE_MB = 50; // 交付物 ≤50MB（PRD FR-03 R2）
const MAX_REPORT_MB = 20; // 日报周报 ≤20MB（PRD FR-07 R2）

function fileFilter(allowed: string[]) {
  return (_req: unknown, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('FILE_TYPE_NOT_ALLOWED'));
  };
}

function buildStorage(dir: string): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop()?.toLowerCase() ?? '';
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + '.' + ext);
    },
  });
}

export const uploadsDir = (): string => path.resolve(config.uploadsDir);

/** 交付物上传中间件（单文件字段名 file） */
export const deliverableUpload = multer({
  storage: buildStorage(path.resolve(config.uploadsDir, 'deliverables')),
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_EXTENSIONS),
});

/** 日报周报上传中间件 */
export const reportUpload = multer({
  storage: buildStorage(path.resolve(config.uploadsDir, 'reports')),
  limits: { fileSize: MAX_REPORT_MB * 1024 * 1024 },
  fileFilter: fileFilter(['pdf', 'docx', 'xlsx', 'png', 'jpg', 'md', 'txt']),
});

export function multerErrorToApi(error: unknown): ApiError {
  const anyError = error as { code?: string; message?: string };
  if (anyError?.code === 'LIMIT_FILE_SIZE') return badRequest('文件大小超过限制');
  if (anyError?.message === 'FILE_TYPE_NOT_ALLOWED') return badRequest('文件类型不支持');
  return badRequest('文件上传失败');
}