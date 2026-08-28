import mongoose from 'mongoose';
import { env } from './env';

export let mongoConnected = false;

const RETRY_INTERVAL_MS = 15_000;

let connecting = false;

async function tryConnect(): Promise<boolean> {
  if (connecting) return false;
  connecting = true;
  try {
    await mongoose.connect(env.mongoUri, { appName: 'InternalBeyond-Mobile' });
    mongoConnected = true;
    console.log('[db] MongoDB 连接成功');
    return true;
  } catch (err) {
    mongoConnected = false;
    console.error('[db] MongoDB 连接失败:', (err as Error).message);
    return false;
  } finally {
    connecting = false;
  }
}

export async function connectDB(): Promise<void> {
  // 断开/未配置时，禁止 Mongoose 缓冲命令（否则请求会挂起 10s 后抛错使进程崩溃）
  mongoose.set('bufferCommands', false);

  // 连接状态变化实时同步（覆盖“曾连上后断开”的驱动自动重连场景）
  mongoose.connection.on('connected', () => {
    mongoConnected = true;
  });
  mongoose.connection.on('disconnected', () => {
    mongoConnected = false;
  });

  if (!env.mongoUri) {
    console.warn('[db] MONGODB_URI 未设置，跳过连接。后端仍可启动，但同步/社交等需数据库的功能不可用。');
    return;
  }

  const ok = await tryConnect();
  if (ok) return;

  // 初始连接失败：后台定时重试，白名单修好后无需手动重启
  console.warn(`[db] 后端继续运行，每 ${RETRY_INTERVAL_MS / 1000}s 重试连接；健康检查将报告 mongo:false`);
  const timer = setInterval(async () => {
    const connected = await tryConnect();
    if (connected) clearInterval(timer);
  }, RETRY_INTERVAL_MS);
  // 不让定时器阻止进程退出（服务器本身会保持进程存活）
  timer.unref?.();
}
