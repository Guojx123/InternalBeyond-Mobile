// 对应前端 SYNC_STORES：本地优先数据同步到服务端的 13 个命名空间。
// 这些 store 在后端以单一 SyncDoc 集合按 (userId, store, docId) 存储，
// 后续若某 store 需要复杂查询（如社交可见范围），可提升为独立 Mongoose Model。
export const SYNC_STORES = [
  'about',
  'apiConfigs',
  'chatMessages',
  'chatThreads',
  'chatSummaries',
  'groups',
  'uploadedFiles',
  'memories',
  'autoMemory',
  'apiSettings',
  'calEvents',
  'calNotes',
  'calLedger',
  'posts',
  'categories',
  'letters',
  'blogComments',
  'blogAnnotations',
  'blog',
  'projects',
  'projectFiles',
  'feed',
] as const;

export type SyncStoreName = (typeof SYNC_STORES)[number];

export function isSyncStore(value: string): value is SyncStoreName {
  return (SYNC_STORES as readonly string[]).includes(value);
}
