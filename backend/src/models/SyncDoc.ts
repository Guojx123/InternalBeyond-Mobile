import mongoose, { Schema, Document } from 'mongoose';
import { isSyncStore, SyncStoreName } from '../lib/storeNames';

// 通用同步文档：覆盖 SYNC_STORES 的 13+ 个命名空间。
// 每条记录 = { userId, store, docId, data, updatedAt }；本地优先写入后增量同步到此。
export interface ISyncDoc extends Document {
  userId: mongoose.Types.ObjectId;
  store: SyncStoreName;
  docId: string;
  data: Record<string, unknown>;
  updatedAt: Date;
  deleted: boolean; // 墓碑：删除不硬删，广播给其它设备
}

const SyncDocSchema = new Schema<ISyncDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  store: { type: String, required: true, index: true },
  docId: { type: String, required: true },
  data: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
  deleted: { type: Boolean, default: false, index: true },
});

SyncDocSchema.index({ userId: 1, store: 1, docId: 1 }, { unique: true });

SyncDocSchema.pre('save', function (next) {
  if (!isSyncStore(this.store)) {
    // 非白名单 store 名称在写入前拦截，防止任意集合污染
    return next(new Error(`未知同步 store: ${this.store}`));
  }
  this.updatedAt = new Date();
  next();
});

export const SyncDoc = mongoose.model<ISyncDoc>('SyncDoc', SyncDocSchema);
