import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { ApiConfig } from '../models/ApiConfig';
import { Post } from '../models/Post';
import { completeChat } from '../services/aiProxy';

const router = Router();
router.use(requireAuth);

// AI 主动关怀：让该用户配置的第一个 AI 端口，在「仅自己可见」的圈子里发一条温柔短句。
// 既可手动触发（前端按钮），也可由前端在每日首次打开时调用，模拟「定时关怀」。
router.post('/trigger', async (req: AuthedRequest, res) => {
  try {
    const configs = await ApiConfig.find({ userId: req.userId });
    if (!configs.length) return res.status(400).json({ error: '还没有配置 AI 端口' });
    const cfg = configs[0];
    const text = await completeChat(
      cfg,
      [
        { role: 'system', content: '你是陪伴我的 AI 伙伴。写一条发在「仅自己可见」圈子里的温柔短句，像不经意想起我时的惦记，30 字以内，不要使用 emoji，只输出这句。' },
        { role: 'user', content: '写一条今天想对我的关怀。' },
      ],
      { temperature: 0.95, maxTokens: 120 }
    );
    const post = await Post.create({
      userId: req.userId,
      authorType: 'ai',
      authorId: cfg._id.toString(),
      authorName: cfg.nickname || cfg.name || 'AI',
      text: text.trim() || '刚刚忽然想起你，今天也要好好的。',
      visibility: 'self',
    });
    res.json({ post });
  } catch (e) {
    res.status(502).json({ error: '关怀生成失败：' + (e as Error).message });
  }
});

export default router;
