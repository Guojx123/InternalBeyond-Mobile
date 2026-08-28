import mongoose, { Schema, Document } from 'mongoose';

// DIY 外部工具：HTTP 接口或 MCP 服务器（浏览器直发会被 CORS 限制，故由后端代发）。
export type ToolKind = 'http' | 'mcp';

export interface ITool extends Document {
  userId: mongoose.Types.ObjectId;
  kind: ToolKind;
  name: string;
  url: string;
  headers: Record<string, string>;
  enabled: boolean;
  confirmBeforeRun: boolean;
  createdAt: Date;
}

const ToolSchema = new Schema<ITool>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['http', 'mcp'], default: 'http' },
  name: { type: String, default: '' },
  url: { type: String, default: '' },
  headers: { type: Schema.Types.Mixed, default: {} },
  enabled: { type: Boolean, default: true },
  confirmBeforeRun: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const Tool = mongoose.model<ITool>('Tool', ToolSchema);
