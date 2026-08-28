import { Router } from 'express';
import { z } from 'zod';
import { Tool } from '../models/Tool';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res) => {
  const tools = await Tool.find({ userId: req.userId }).lean();
  res.json({ tools });
});

const toolSchema = z.object({
  kind: z.enum(['http', 'mcp']).default('http'),
  name: z.string().default(''),
  url: z.string().min(1),
  headers: z.record(z.string()).optional(),
  enabled: z.boolean().optional(),
  confirmBeforeRun: z.boolean().optional(),
});

router.post('/', async (req: AuthedRequest, res) => {
  const parsed = toolSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '工具配置格式不正确' });
  const tool = await Tool.create({ userId: req.userId, ...parsed.data });
  res.json({ id: tool._id });
});

router.delete('/:id', async (req: AuthedRequest, res) => {
  await Tool.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

// 由后端代发外部请求（绕过浏览器 CORS）：调用前由前端确认（confirmBeforeRun）。
router.post('/:id/run', async (req: AuthedRequest, res) => {
  const tool = await Tool.findOne({ _id: req.params.id, userId: req.userId });
  if (!tool) return res.status(404).json({ error: '未找到工具' });
  if (!tool.enabled) return res.status(403).json({ error: '工具已禁用' });

  const bodySchema = z.object({ method: z.string().optional(), payload: z.unknown().optional() });
  const parsed = bodySchema.safeParse(req.body);
  const method = (parsed.success && parsed.data.method) || 'POST';

  try {
    const upstream = await fetch(tool.url, {
      method,
      headers: { 'Content-Type': 'application/json', ...tool.headers },
      body: method === 'GET' ? undefined : JSON.stringify(parsed.success ? parsed.data.payload : {}),
    });
    const text = await upstream.text();
    res.json({ status: upstream.status, body: text.slice(0, 2000) });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;
