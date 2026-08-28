import Dexie, { Table } from 'dexie';
import { schedulePush, scheduleDelete } from './sync';

// 本地优先存储：浏览器 IndexedDB（Dexie 封装）。
// - sync: 通用同步表，镜像后端的 SyncDoc（store+docId 为主键），离线可读可写。
// - kv:   纯本地偏好（主题、锁屏开关等），不进跨端备份。
export interface SyncRow {
  store: string;
  docId: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface KVRow {
  key: string;
  value: unknown;
}

export class IBDatabase extends Dexie {
  sync!: Table<SyncRow, [string, string]>;
  kv!: Table<KVRow, string>;

  constructor() {
    super('InternalBeyondDB');
    this.version(1).stores({
      // 复合主键 [store, docId] 保证唯一；updatedAt 用于增量同步
      sync: 'store,docId, updatedAt',
      kv: 'key',
    });
  }
}

export const db = new IBDatabase();

// ── 通用读写（本地优先）──
export async function localGet(store: string, docId: string): Promise<SyncRow | undefined> {
  return db.sync.get([store, docId]);
}

export async function localGetAll(store: string): Promise<SyncRow[]> {
  return db.sync.where('store').equals(store).toArray();
}

export async function localPut(store: string, docId: string, data: Record<string, unknown>): Promise<void> {
  const updatedAt = Date.now();
  await db.sync.put({ store, docId, data, updatedAt });
  // 触发同步（若已登录且在线）
  schedulePush(store, docId, data, updatedAt);
}

export async function localDelete(store: string, docId: string): Promise<void> {
  await db.sync.delete([store, docId]);
  scheduleDelete(store, docId);
}

// ── 本地 KV ──
export async function kvGet<T = unknown>(key: string): Promise<T | undefined> {
  const row = await db.kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}
