import mongoose, { Schema, Document } from 'mongoose';
import { encrypt, decrypt } from '../lib/crypto';

// 各 AI 端口配置。apiKey 在落库前加密，读取时解密——浏览器永不接触明文密钥。
export interface IApiConfig extends Document {
  userId: mongoose.Types.ObjectId;
  provider: string; // 'claude' | 'gpt' | 'deepseek' | 'gemini' | 'custom'
  name: string; // 端口昵称
  nickname: string; // 对该 AI 的称呼
  relation: string;
  systemPrompt: string;
  baseUrl: string;
  aiModel: string;
  permissions: Record<string, boolean>;
  _apiKeyEnc?: string;
  setApiKey(k: string): void;
  getApiKey(): string;
  createdAt: Date;
}

const ApiConfigSchema = new Schema<IApiConfig>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, required: true },
  name: { type: String, default: '' },
  nickname: { type: String, default: '' },
  relation: { type: String, default: '' },
  systemPrompt: { type: String, default: '' },
  baseUrl: { type: String, default: '' },
  aiModel: { type: String, default: '' },
  permissions: { type: Schema.Types.Mixed, default: {} },
  _apiKeyEnc: { type: String, select: false },
  createdAt: { type: Date, default: Date.now },
});

ApiConfigSchema.methods.setApiKey = function (k: string) {
  this._apiKeyEnc = encrypt(k);
};
ApiConfigSchema.methods.getApiKey = function (): string {
  return this._apiKeyEnc ? decrypt(this._apiKeyEnc) : '';
};

export const ApiConfig = mongoose.model<IApiConfig>('ApiConfig', ApiConfigSchema);
