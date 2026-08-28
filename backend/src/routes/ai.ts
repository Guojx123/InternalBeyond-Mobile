import { Router } from 'express';
import { z } from 'zod';
import { ApiConfig } from '../models/ApiConfig';
import { proxyChat } from '../services/aiProxy';
import { requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

// 流式对话代理：浏览器只传 configId + 消息，密钥由后端从 ApiConfig 取出。
router.post('/chat', async (req: AuthedRequest, res) => {
  const schema = z.object({
    configId: z.string().min(1),
    messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string() })),
    stream: z.boolean().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '请求体格式不正确' });

  const config = await ApiConfig.findById(parsed.data.configId).where('userId').equals(req.userId);
  if (!config) return res.status(404).json({ error: '未找到该 AI 端口配置' });

  await proxyChat(req, res, config);
});

// 列出当前用户的端口（不返回密钥）
router.get('/configs', async (req: AuthedRequest, res) => {
  const configs = await ApiConfig.find({ userId: req.userId }).select('-_apiKeyEnc').lean();
  res.json({ configs });
});

const cfgSchema = z.object({
  provider: z.string().min(1),
  name: z.string().optional(),
  nickname: z.string().optional(),
  relation: z.string().optional(),
  systemPrompt: z.string().optional(),
  baseUrl: z.string().optional(),
  aiModel: z.string().optional(),
  apiKey: z.string().optional(),
  permissions: z.record(z.boolean()).optional(),
});

router.post('/configs', async (req: AuthedRequest, res) => {
  const parsed = cfgSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '配置格式不正确' });
  const cfg: any = { userId: req.userId, ...parsed.data };
  if (parsed.data.apiKey) cfg._apiKeyEnc = undefined; // 由 setter 处理
  const doc = new ApiConfig(cfg);
  if (parsed.data.apiKey) doc.setApiKey(parsed.data.apiKey);
  await doc.save();
  res.json({ id: doc._id });
});

router.put('/configs/:id', async (req: AuthedRequest, res) => {
  const parsed = cfgSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '配置格式不正确' });
  const doc = await ApiConfig.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, parsed.data, { new: true });
  if (!doc) return res.status(404).json({ error: '未找到配置' });
  if (parsed.data.apiKey) doc.setApiKey(parsed.data.apiKey);
  await doc.save();
  res.json({ ok: true });
});

router.delete('/configs/:id', async (req: AuthedRequest, res) => {
  await ApiConfig.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

export default router;
