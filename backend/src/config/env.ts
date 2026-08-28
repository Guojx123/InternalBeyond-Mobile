import dotenv from 'dotenv';

dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    // 仅对关键项在缺失时告警；其余提供默认值以便本地最小运行
    if (name === 'JWT_SECRET' || name === 'ENCRYPTION_KEY' || name === 'MONGODB_URI') {
      console.warn(`[env] 警告: 环境变量 ${name} 未设置，使用不安全默认值（生产环境务必配置）`);
    }
  }
  return v ?? '';
}

export const env = {
  port: parseInt(process.env.PORT || '10000', 10),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: required('JWT_SECRET', 'dev-insecure-jwt-secret-change-me'),
  encryptionKey: required('ENCRYPTION_KEY', '0000000000000000000000000000000000000000000000000000000000000000'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  selfPingUrl: process.env.SELF_PING_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const isProd = env.nodeEnv === 'production';
