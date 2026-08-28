import mongoose, { Schema, Document } from 'mongoose';

// 全局 AI 设置（语音通话系统 / 记忆系统 / 输出与续写 / 进阶指令等）。
export interface IApiSettings extends Document {
  userId: mongoose.Types.ObjectId;
  settings: Record<string, unknown>;
  updatedAt: Date;
}

const ApiSettingsSchema = new Schema<IApiSettings>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true, unique: true },
  settings: { type: Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now },
});

export const ApiSettings = mongoose.model<IApiSettings>('ApiSettings', ApiSettingsSchema);
