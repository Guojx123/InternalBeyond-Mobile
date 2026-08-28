import { Router, Request, Response } from 'express';
import { mongoConnected } from '../config/db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'ib-backend', mongo: mongoConnected, time: new Date().toISOString() });
});

export default router;
