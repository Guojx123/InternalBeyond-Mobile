import { api, auth } from './apiClient';
import { db } from './db';

// 同步引擎：本地优先写入后，把变更推送到后端（按 userId 隔离）。
// 冲突策略：last-write-wins（后端以 updatedAt 较大者胜出）。
// 为简化骨架，采用「写本地即入队、后台尝试推送」的方式；失败静默重试（下次上线 flush）。

interface PushJob {
  store: string;
  docId: string;
  data: Record<string, unknown>;
  updatedAt: number;
  op: 'put' | 'delete';
}

let queue: PushJob[] = [];
let flushing = false;

export function schedulePush(store: string, docId: string, data: Record<string, unknown>, updatedAt: number): void {
  queue.push({ store, docId, data, updatedAt, op: 'put' });
  void flush();
}

export function scheduleDelete(store: string, docId: string): void {
  queue.push({ store, docId, data: {}, updatedAt: Date.now(), op: 'delete' });
  void flush();
}

// 首次登录 / 恢复网络：拉取全量快照，按 (store,docId) 逐条 last-write-wins 合并。
// 仅当服务端版本更新（updatedAt 更大）时才覆盖本地；本地更新的离线编辑会保留并在随后 flush 推回。
export async function pullSnapshot(): Promise<void> {
  if (!auth.token) return;
  try {
    const res = await api<{ stores: Record<string, Array<{ docId: string; data: unknown; updatedAt: number | string; deleted?: boolean }>> }>('/api/sync');
    const tx = db.transaction('rw', db.sync, async () => {
      for (const [store, docs] of Object.entries(res.stores)) {
        for (const d of docs) {
          const remoteUpdated = new Date(d.updatedAt).getTime();
          const local = await db.sync.get([store, d.docId]);
          // 墓碑：删除已广播到其它设备，本地直接删（不再通知服务端，避免每次拉取重复请求）
          if (d.deleted) {
            if (local) await db.sync.delete([store, d.docId]);
            continue;
          }
          // 本地更新时间以数字(epoch ms)存储；服务端给的是 ISO 字符串，统一归一后比较
          if (!local || remoteUpdated > (local.updatedAt as number)) {
            await db.sync.put({ store, docId: d.docId, data: d.data as Record<string, unknown>, updatedAt: remoteUpdated });
          }
        }
      }
    });
    await tx;
  } catch (err) {
    console.warn('[sync] 拉取快照失败:', (err as Error).message);
  }
}

export async function flush(): Promise<void> {
  if (flushing || !auth.token || queue.length === 0) return;
  flushing = true;
  const jobs = queue;
  queue = [];
  try {
    // 按 store 归并，批量 PUT
    const byStore = new Map<string, PushJob[]>();
    for (const j of jobs) {
      const arr = byStore.get(j.store) || [];
      arr.push(j);
      byStore.set(j.store, arr);
    }
    for (const [store, jobsForStore] of byStore) {
      const puts = jobsForStore.filter((j) => j.op === 'put');
      const dels = jobsForStore.filter((j) => j.op === 'delete');
      if (puts.length) {
        await api(`/api/sync/${store}`, {
          method: 'PUT',
          body: JSON.stringify(puts.map((p) => ({ docId: p.docId, data: p.data, updatedAt: new Date(p.updatedAt).toISOString() }))),
        });
      }
      for (const d of dels) {
        await api(`/api/sync/${store}/${d.docId}`, { method: 'DELETE' });
      }
    }
  } catch (err) {
    // 推送失败：放回队列，待下次 flush
    console.warn('[sync] 推送失败，重试:', (err as Error).message);
    queue = [...jobs, ...queue];
  } finally {
    flushing = false;
    if (queue.length) void flush();
  }
}

// 网络恢复时调用
export function onOnline(): void {
  void pullSnapshot().then(flush);
}
