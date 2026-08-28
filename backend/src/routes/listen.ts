import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ListenRoom } from '../models/ListenRoom';

const router = Router();
router.use(requireAuth);

// 取当前用户的聆听房间状态
router.get('/', async (req: AuthedRequest, res) => {
  const room = await ListenRoom.findOne({ userId: req.userId });
  res.json({
    room: room
      ? { track: room.track, position: room.position, playing: room.playing, by: room.by, updatedAt: room.updatedAt.getTime() }
      : null,
  });
});

// 上报/更新播放状态（谁控制了就由谁写入）
const body = z.object({
  track: z.string().default(''),
  position: z.number().default(0),
  playing: z.boolean().default(false),
  by: z.string().default(''),
});
router.post('/', async (req: AuthedRequest, res) => {
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '格式不正确' });
  const updated = await ListenRoom.findOneAndUpdate(
    { userId: req.userId },
    { track: parsed.data.track, position: parsed.data.position, playing: parsed.data.playing, by: parsed.data.by },
    { upsert: true, new: true }
  );
  res.json({
    room: { track: updated.track, position: updated.position, playing: updated.playing, by: updated.by, updatedAt: updated.updatedAt.getTime() },
  });
});

export default router;
