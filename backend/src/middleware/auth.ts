import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { mongoConnected } from '../config/db';

export interface AuthPayload {
  uid: string;
}

export interface AuthedRequest extends Request {
  userId?: string;
}

// 数据库未连接时，需要持久化的接口统一返回 503（而非缓冲超时崩溃进程）。
export function requireDb(_req: Request, res: Response, next: NextFunction): void {
  if (!mongoConnected) {
    res.status(503).json({ error: '数据库未连接，请配置 MONGODB_URI 后重试' });
    return;
  }
  next();
}

export function signToken(uid: string): string {
  return jwt.sign({ uid }, env.jwtSecret, { expiresIn: '30d' });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  try {
    const payload = jwt.verify(token, env.jwtSecret) as AuthPayload;
    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
}
