import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { signToken, requireAuth, AuthedRequest } from '../middleware/auth';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '邮箱或密码格式不正确' });
  const { email, password, displayName } = parsed.data;
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) return res.status(409).json({ error: '该邮箱已注册' });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, displayName: displayName || '' });
  const token = signToken(String(user._id));
  res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '邮箱或密码格式不正确' });
  const { email, password } = parsed.data;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(401).json({ error: '账号或密码错误' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: '账号或密码错误' });
  const token = signToken(String(user._id));
  res.json({ token, user: { id: user._id, email: user.email, displayName: user.displayName } });
});

router.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId).select('-passwordHash');
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: { id: user._id, email: user.email, displayName: user.displayName } });
});

export default router;
