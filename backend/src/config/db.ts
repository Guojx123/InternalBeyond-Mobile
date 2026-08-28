import mongoose from 'mongoose';
import { env } from './env';

export let mongoConnected = false;

export async function connectDB(): Promise<void> {
  // 断开/未配置时，禁止 Mongoose 缓冲命令（否则请求会挂起 10s 后抛错使进程崩溃）
  mongoose.set('bufferCommands', false);
  if (!env.mongoUri) {
    console.warn('[db] MONGODB_URI 未设置，跳过连接。后端仍可启动，但同步/社交等需数据库的功能不可用。');
    return;
  }
  try {
    await mongoose.connect(env.mongoUri, { appName: 'InternalBeyond-Mobile' });
    mongoConnected = true;
    console.log('[db] MongoDB 连接成功');
  } catch (err) {
    mongoConnected = false;
    console.error('[db] MongoDB 连接失败:', (err as Error).message);
    console.warn('[db] 后端继续运行，健康检查将报告 mongo:false');
  }
}
