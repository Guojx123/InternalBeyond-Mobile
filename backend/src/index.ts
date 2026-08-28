import express from 'express';
import cors from 'cors';
import { env, isProd } from './config/env';
import { connectDB } from './config/db';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import syncRouter from './routes/sync';
import aiRouter from './routes/ai';
import socialRouter from './routes/social';
import toolsRouter from './routes/tools';
import careRouter from './routes/care';
import listenRouter from './routes/listen';
import { errorHandler, notFound } from './middleware/error';
import { requireDb } from './middleware/auth';

async function main() {
  await connectDB();

  const app = express();
  app.use(cors({ origin: isProd ? env.frontendUrl || true : true, credentials: true }));
  app.use(express.json({ limit: '12mb' }));

  app.get('/', (_req, res) => res.json({ service: 'ib-backend', docs: '/api/health' }));
  app.use('/api/health', healthRouter);
  app.use('/api', requireDb); // 数据库不可用时，其余 /api 接口返回 503
  app.use('/api/auth', authRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/ai', aiRouter);
  app.use('/api/social', socialRouter);
  app.use('/api/tools', toolsRouter);
  app.use('/api/care', careRouter);
  app.use('/api/listen', listenRouter);

  app.use(notFound);
  app.use(errorHandler);

  app.listen(env.port, () => {
    console.log(`[server] IB 后端已启动: http://localhost:${env.port} (${isProd ? 'production' : 'development'})`);
  });

  // 可选自保活：每 10 分钟 ping 自身 /api/health，避免免费实例休眠
  if (env.selfPingUrl) {
    setInterval(
      () => {
        fetch(env.selfPingUrl).catch(() => {});
      },
      10 * 60 * 1000
    );
  }
}

main().catch((err) => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});

// 防止异步路由中未捕获的 Promise 拒绝导致进程退出（生产环境应改用 asyncHandler 包裹）
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
