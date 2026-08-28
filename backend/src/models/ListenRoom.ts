import mongoose, { Schema, Document } from 'mongoose';

// 「一起听」聆听房间：每位用户一个共享播放会话，跨设备轮询同步。
export interface IListenRoom extends Document {
  userId: mongoose.Types.ObjectId;
  track: string;
  position: number;
  playing: boolean;
  by: string; // 最近一次控制的设备标签
  updatedAt: Date;
}

const ListenRoomSchema = new Schema<IListenRoom>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    track: { type: String, default: '' },
    position: { type: Number, default: 0 },
    playing: { type: Boolean, default: false },
    by: { type: String, default: '' },
  },
  { timestamps: true }
);

export const ListenRoom = mongoose.model<IListenRoom>('ListenRoom', ListenRoomSchema);
