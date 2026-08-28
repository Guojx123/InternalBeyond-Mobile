import { Router } from 'express';
import { z } from 'zod';
import { SyncDoc } from '../models/SyncDoc';
import { isSyncStore } from '../lib/storeNames';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import mongoose from 'mongoose';

const router = Router();
router.use(requireAuth);

// 增量同步：本地优先写入后，按 store 回传/拉取。
// 冲突策略：last-write-wins（以 updatedAt 较大者胜出）。

// 拉取某 store 全部记录（可选 ?since=ISO 仅增量）
router.get('/:store', async (req: AuthedRequest, res) => {
  const { store } = req.params;
  if (!isSyncStore(store)) return res.status(400).json({ error: '未知 store' });
  const since = req.query.since ? new Date(String(req.query.since)) : undefined;
  const filter: mongoose.FilterQuery<typeof SyncDoc> = { userId: req.userId, store };
  if (since && !isNaN(since.getTime())) filter.updatedAt = { $gt: since };
  const docs = await SyncDoc.find(filter).lean();
  res.json({ store, docs: docs.map((d) => ({ docId: d.docId, data: d.data, updatedAt: d.updatedAt, deleted: d.deleted })) });
});

// 全量快照（首次登录拉取）
router.get('/', async (req: AuthedRequest, res) => {
  const docs = await SyncDoc.find({ userId: req.userId }).lean();
  const byStore: Record<string, Array<{ docId: string; data: unknown; updatedAt: Date; deleted?: boolean }>> = {};
  for (const d of docs) {
    (byStore[d.store] ||= []).push({ docId: d.docId, data: d.data, updatedAt: d.updatedAt, deleted: d.deleted });
  }
  res.json({ stores: byStore });
});

const upsertSchema = z.array(
  z.object({
    docId: z.string().min(1),
    data: z.record(z.unknown()),
    updatedAt: z.string().optional(),
  })
);

// 批量 upsert
router.put('/:store', async (req: AuthedRequest, res) => {
  const { store } = req.params;
  if (!isSyncStore(store)) return res.status(400).json({ error: '未知 store' });
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: '请求体格式不正确' });

   let applied = 0;
  for (const item of parsed.data) {
    const updatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();
    // 服务端也按 updatedAt 做 last-write-wins：传入版本更旧则保留云端版本
    const existing = await SyncDoc.findOne({ userId: req.userId, store, docId: item.docId }, { updatedAt: 1 });
    if (existing?.updatedAt && existing.updatedAt.getTime() >= updatedAt.getTime()) continue;
    await SyncDoc.updateOne(
      { userId: req.userId, store, docId: item.docId },
      { $set: { data: item.data, updatedAt, deleted: false }, $setOnInsert: { userId: req.userId, store, docId: item.docId } },
      { upsert: true }
    );
    applied++;
  }
  res.json({ ok: true, applied });
});

router.delete('/:store/:docId', async (req: AuthedRequest, res) => {
  const { store, docId } = req.params;
  if (!isSyncStore(store)) return res.status(400).json({ error: '未知 store' });
  // 墓碑删除：不硬删，仅标记 deleted，使其它设备拉取快照时也能删除本地副本
  await SyncDoc.updateOne(
    { userId: req.userId, store, docId },
    { $set: { deleted: true, updatedAt: new Date() }, $setOnInsert: { userId: req.userId, store, docId, data: {} } },
    { upsert: true }
  );
  res.json({ ok: true });
});

export default router;
