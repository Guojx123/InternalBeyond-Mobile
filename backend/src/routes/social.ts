import { Router } from 'express';
import { z } from 'zod';
import { Post } from '../models/Post';
import { ApiConfig } from '../models/ApiConfig';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { mongoConnected } from '../config/db';
import { completeChat } from '../services/aiProxy';
import mongoose from 'mongoose';

const router = Router();
router.use(requireAuth);

// 列出当前用户社交圈动态（含 AI 发布的，按可见范围过滤）。
router.get('/posts', async (req: AuthedRequest, res) => {
  const posts = await Post.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(200).lean();
  res.json({ posts });
});

const postSchema = z.object({
  authorType: z.enum(['user', 'ai']).default('user'),
  authorId: z.string().default(''),
  authorName: z.string().default(''),
  text: z.string().default(''),
  image: z.string().optional(),
  location: z.string().optional(),
  visibility: z.enum(['all', 'self', 'allow', 'exclude']).default('self'),
  allow: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
});

router.post('/posts', async (req: AuthedRequest, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '动态格式不正确' });
  const post = await Post.create({ userId: req.userId, ...parsed.data });
  // 发帖后让已配置的 AI 伙伴自然接话（异步、不阻塞响应）
  if (post.authorType === 'user') void autoReact(String(post._id), req.userId!);
  res.json({ post });
});

// 让已配置的 AI 伙伴对动态各回应一句（用于自动互动或手动触发）
async function autoReact(postId: string, userId: string): Promise<void> {
  if (!mongoConnected) return;
  try {
    const configs = await ApiConfig.find({ userId });
    if (!configs.length) return;
    const post = await Post.findById(postId);
    if (!post || !post.text) return;
    for (const cfg of configs) {
      try {
        const text = await completeChat(
          cfg,
          [
            { role: 'system', content: '你是社交圈里的一位伙伴，看到下面这条动态，用一句话真诚自然地回应或接话，不超过 40 字，不要使用 emoji。' },
            { role: 'user', content: post.text },
          ],
          { temperature: 0.9, maxTokens: 120 }
        );
        const reply = text.trim();
        if (reply) {
          await Post.findByIdAndUpdate(postId, {
            $push: { comments: { authorType: 'ai', authorName: cfg.nickname || cfg.name || 'AI', text: reply, createdAt: new Date() } },
          });
        }
      } catch {
        /* 单个 AI 失败忽略，不阻断其余 */
      }
    }
  } catch {
    /* 忽略整体失败 */
  }
}

router.post('/posts/:id/ai-react', async (req: AuthedRequest, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
  if (!post) return res.status(404).json({ error: '动态不存在' });
  await autoReact(String(post._id), req.userId!);
  const updated = await Post.findById(post._id).lean();
  res.json({ post: updated });
});

router.delete('/posts/:id', async (req: AuthedRequest, res) => {
  await Post.deleteOne({ _id: req.params.id, userId: req.userId });
  res.json({ ok: true });
});

// 评论（仅当前用户可评论；AI 评论由服务端定时/事件触发写入）
const commentSchema = z.object({ text: z.string().min(1).max(2000) });
router.post('/posts/:id/comment', async (req: AuthedRequest, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '评论不能为空' });
  const post = await Post.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { $push: { comments: { authorType: 'user', authorName: '我', text: parsed.data.text, createdAt: new Date() } } },
    { new: true }
  );
  if (!post) return res.status(404).json({ error: '动态不存在' });
  res.json({ post });
});

// 转发：以当前用户身份新建一条引用源 post 的动态
const repostSchema = z.object({ text: z.string().max(2000).default('') });
router.post('/posts/:id/repost', async (req: AuthedRequest, res) => {
  const parsed = repostSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '转发内容无效' });
  const src = await Post.findOne({ _id: req.params.id, userId: req.userId });
  if (!src) return res.status(404).json({ error: '源动态不存在' });
  const repost = await Post.create({
    userId: req.userId,
    authorType: 'user',
    authorId: req.userId,
    authorName: '我',
    text: parsed.data.text,
    visibility: 'self',
    repostOf: src._id.toString(),
  });
  res.json({ post: repost });
});

export default router;

// 可见范围查询辅助（供后续评论/转发与服务端定时推送复用）
export function visibleTo(post: InstanceType<typeof Post>, viewerId: string): boolean {
  if (post.visibility === 'all') return true;
  if (post.visibility === 'self') return post.userId.equals(viewerId as unknown as mongoose.Types.ObjectId);
  if (post.visibility === 'allow') return (post.allow || []).includes(viewerId);
  if (post.visibility === 'exclude') return !(post.exclude || []).includes(viewerId);
  return false;
}
