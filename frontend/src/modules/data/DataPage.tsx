import { useState } from 'react';
import { db, localGetAll } from '../../lib/db';
import { SYNC_STORES } from '../../lib/storeNames';
import { GlassCard, SectionTitle } from '../../components/GlassCard';

export default function DataPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  async function refreshStats() {
    const s: Record<string, number> = {};
    for (const store of SYNC_STORES) {
      s[store] = (await localGetAll(store)).length;
    }
    setStats(s);
  }

  async function exportBackup() {
    const stores: Record<string, Array<{ docId: string; data: unknown; updatedAt: number }>> = {};
    for (const store of SYNC_STORES) {
      const rows = await localGetAll(store);
      stores[store] = rows.map((r) => ({ docId: r.docId, data: r.data, updatedAt: r.updatedAt }));
    }
    const payload = { app: 'InternalBeyond-Mobile', version: 1, exportedAt: new Date().toISOString(), stores };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ib-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(file: File) {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.stores) return alert('备份文件格式不正确');
    for (const [store, docs] of Object.entries<any>(data.stores)) {
      for (const d of docs) {
        await db.sync.put({ store, docId: d.docId, data: d.data, updatedAt: d.updatedAt || Date.now() });
      }
    }
    alert('导入完成（本地）。如需同步到云端请联网后稍候自动推送。');
  }

  return (
    <div className="page">
      <SectionTitle en="Data" cn="数据" />
      <GlassCard>
        <p className="hint">数据以本地优先存储（IndexedDB），登录后自动同步到你的云端账户。此页用于一键导出 / 导入备份（与电脑端共用同一备份格式）。</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" onClick={exportBackup}>导出备份</button>
          <label className="btn">
            导入备份
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          </label>
          <button className="btn" onClick={refreshStats}>存储概览</button>
        </div>
      </GlassCard>

      {stats && (
        <GlassCard>
          <SectionTitle en="Storage" cn="存储总览" />
          {SYNC_STORES.map((s) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 0', color: 'var(--tx2)' }}>
              <span>{s}</span>
              <span>{stats[s] ?? 0}</span>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
