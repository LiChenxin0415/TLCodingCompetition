/**
 * 服务入口：初始化数据库 → 灌入种子数据 → 挂载路由 → 监听
 * 需求依据：backend-design §3 系统架构、§9 目录结构
 */

import cors from 'cors';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { pathToFileURL } from 'node:url';
import { aiUsable, config } from './config.ts';
import { closeDb, getDb, resolveDbFile } from './db/index.ts';
import { seedDemoData } from './db/seed.ts';
import apiRouter from './routes/index.ts';
import { ApiError } from './utils/errors.ts';
import { currentWeek } from './utils/isoWeek.ts';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiRouter);

  // 404：未匹配到任何接口
  app.use((req: Request, res: Response) => {
    res.status(404).json({ code: 404, message: `接口不存在：${req.method} ${req.originalUrl}` });
  });

  // 统一错误响应 { code, message }（第八章）
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ code: err.status, message: err.message });
      return;
    }

    // body-parser 抛出的 JSON 语法错误 / 体积超限 → 400
    const anyErr = err as { type?: string; status?: number; message?: string };
    if (anyErr?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      res.status(400).json({ code: 400, message: '请求体不是合法 JSON' });
      return;
    }
    if (anyErr?.type === 'entity.too.large') {
      res.status(400).json({ code: 400, message: '请求体过大' });
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
    const week = currentWeek();
    console.log('==============================================');
    console.log('  AI 智能周报系统 · 后端服务已启动');
    console.log(`  接口基地址 : http://localhost:${config.port}/api`);
    console.log(`  当前周次   : ${week}`);
    console.log(`  数据库文件 : ${resolveDbFile()}`);
    console.log(`  种子数据   : 新增账号 ${seeded.users} 个 / 历史周报 ${seeded.reports} 条（已存在的跳过）`);
    console.log(`  AI 状态    : ${aiUsable() ? '已启用' : '降级模式（AI_ENABLED=false 或未配置 LLM 端点）'}`);
    console.log('==============================================');
  });

  const shutdown = (signal: string): void => {
    console.log(`\n[${signal}] 正在关闭服务...`);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// 仅在直接运行时启动（被 import 时不启动，便于冒烟脚本复用 createApp）
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
