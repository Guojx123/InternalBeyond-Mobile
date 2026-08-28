import mongoose, { Schema, Document } from 'mongoose';

// InternetBeyond 社交圈动态。逐条可见范围：all | self | allow(指定) | exclude(排除)。
export type Visibility = 'all' | 'self' | 'allow' | 'exclude';

export interface IPost extends Document {
  userId: mongoose.Types.ObjectId;
  authorType: 'user' | 'ai';
  authorId: string; // user 时为 userId，ai 时为对应 apiConfig 的 id
  authorName: string;
  text: string;
  image?: string;
  location?: string;
  visibility: Visibility;
  allow?: string[];
  exclude?: string[];
  repostOf?: string; // 转发源 post id
  comments: Array<{ authorType: 'user' | 'ai'; authorName: string; text: string; createdAt: Date }>;
  createdAt: Date;
}

const PostSchema = new Schema<IPost>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorType: { type: String, enum: ['user', 'ai'], default: 'user' },
  authorId: { type: String, default: '' },
  authorName: { type: String, default: '' },
  text: { type: String, default: '' },
  image: { type: String },
  location: { type: String },
  visibility: { type: String, enum: ['all', 'self', 'allow', 'exclude'], default: 'self' },
  allow: { type: [String], default: [] },
  exclude: { type: [String], default: [] },
  repostOf: { type: String },
  comments: [
    new Schema(
      {
        authorType: { type: String, enum: ['user', 'ai'], default: 'user' },
        authorName: { type: String, default: '' },
        text: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
      { _id: false }
    ),
  ],
  createdAt: { type: Date, default: Date.now, index: true },
});

export const Post = mongoose.model<IPost>('Post', PostSchema);
