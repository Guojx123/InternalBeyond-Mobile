// 与后端 SYNC_STORES 保持一致：本地优先数据同步到服务端的命名空间。
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
