import { Request, Response, NextFunction } from 'express';

// 统一错误兜底：未知异常返回 500，并避免泄漏密钥等敏感信息。
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[error]', err.message);
  res.status(500).json({ error: '服务器内部错误' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: '接口不存在' });
}
