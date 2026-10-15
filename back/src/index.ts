import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { aiUsable, config } from './config.ts';
import { closeDb, getDb, resolveDbFile } from './db/index.ts';
import { seedDemoData } from './db/seed.ts';
import apiRouter from './routes/index.ts';
import { ApiError } from './utils/errors.ts';
import { currentMonth } from './utils/month.ts';

export function createApp(): express.Express {
  const app = express();
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  // 演示用：上传文件可访问（生产应走鉴权下载）
  app.use('/files', express.static(path.resolve(config.uploadsDir)));

  app.use('/api', apiRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({ code: 404, message: '接口不存在：' + req.method + ' ' + req.originalUrl });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ code: err.status, message: err.message });
      return;
    }
    const anyError = err as { type?: string; message?: string; code?: string };
    if (anyError?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      res.status(400).json({ code: 400, message: '请求体不是合法 JSON' });
      return;
    }
    if (anyError?.code === 'NO_FILE') {
      res.status(400).json({ code: 400, message: '缺少上传文件' });
      return;
    }
    console.error('[error] 未捕获异常', err);
    res.status(500).json({ code: 500, message: '服务异常，请稍后重试' });
  });

  return app;
}

function main(): void {
  const db = getDb();
  const seeded = seedDemoData(db);
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log('==============================================');
    console.log('  目标合约通 · 后端服务已启动');
    console.log('  接口基地址 : http://localhost:' + config.port + '/api');
    console.log('  当前月份   : ' + currentMonth());
    console.log('  数据库文件 : ' + resolveDbFile());
    console.log('  种子数据   : 账号 ' + seeded.users + ' 个 / 合约 ' + seeded.contracts + ' 份 / 工作包 ' + seeded.items + ' 个');
    console.log('  AI 状态    : ' + (aiUsable() ? '已启用（' + config.llm.endpoints[0]?.model + '）' : '降级模式'));
    console.log('==============================================');
  });

  const shutdown = (signal: string): void => {
    console.log('\n[' + signal + '] 正在关闭...');
    server.close(() => { closeDb(); process.exit(0); });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}