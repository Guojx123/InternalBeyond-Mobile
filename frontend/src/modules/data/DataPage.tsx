import { useState } from 'react';
import { db, localGetAll } from '../../lib/db';
import { SYNC_STORES } from '../../lib/storeNames';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { toast } from '../../components/ui/Toast';

interface Thread {
  docId: string;
  title: string;
  members: string[];
}

export default function DataPage() {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [usage, setUsage] = useState<{ label: string; count: number }[] | null>(null);

  async function refreshStats() {
    const s: Record<string, number> = {};
    for (const store of SYNC_STORES) {
      s[store] = (await localGetAll(store)).length;
    }
    setStats(s);

    // Token 用量仪表盘 —— 本地近似：按会话消息条数（后端暂未记录 usage，待接口接入后替换）
    const [msgs, threads] = await Promise.all([localGetAll('chatMessages'), localGetAll('chatThreads')]);
    const byThread: Record<string, number> = {};
    for (const m of msgs) {
      const tid = m.docId.split(':')[0];
      byThread[tid] = (byThread[tid] || 0) + 1;
    }
    const threadRows = threads.map((r) => r.data as unknown as Thread);
    const rows = Object.entries(byThread).map(([tid, count]) => ({
      label: threadRows.find((t) => t.docId === tid)?.title || '未命名会话',
      count,
    }));
    rows.sort((a, b) => b.count - a.count);
    setUsage(rows.slice(0, 8));
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
    toast('备份已导出');
  }

  async function importBackup(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.stores) {
        toast('备份文件格式不正确');
        return;
      }
      let count = 0;
      for (const [store, docs] of Object.entries<any>(data.stores)) {
        for (const d of docs) {
          await db.sync.put({ store, docId: d.docId, data: d.data, updatedAt: d.updatedAt || Date.now() });
          count++;
        }
      }
      toast(`导入完成（${count} 条，本地）。如需同步到云端请联网后稍候自动推送。`);
      await refreshStats();
    } catch {
      // 坏文件 / JSON 解析失败不再抛未捕获异常
      toast('导入失败：文件无法解析，请确认是本应用导出的备份');
    }
  }

  const maxUsage = usage?.length ? Math.max(...usage.map((u) => u.count)) : 1;

  return (
    <div className="page">
      <SectionTitle en="Data" cn="数据" />
      <GlassCard>
        <p className="hint">数据以本地优先存储（IndexedDB），登录后自动同步到你的云端账户。此页用于一键导出 / 导入备份（与电脑端共用同一备份格式）。</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={exportBackup}>导出备份</button>
          <label className="btn">
            导入备份
            <input type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importBackup(e.target.files[0])} />
          </label>
          <button className="btn" onClick={refreshStats}>刷新统计</button>
        </div>
      </GlassCard>

      {/* 存储总览：统计网格 */}
      {stats && (
        <GlassCard>
          <SectionTitle en="Storage" cn="存储总览" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))', gap: 8 }}>
            {SYNC_STORES.map((s) => (
              <div
                key={s}
                className="glass"
                style={{ borderRadius: 14, padding: '10px 12px', textAlign: 'center' }}
              >
                <div style={{ fontFamily: 'var(--monoP)', fontSize: '1.05rem', color: 'var(--tx)' }}>{stats[s] ?? 0}</div>
                <div className="muted" style={{ fontSize: '0.62rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Token 用量仪表盘（UI 骨架 + 本地近似，待后端用量接口接入） */}
      {usage && (
        <GlassCard>
          <SectionTitle en="Usage" cn="用量仪表盘" />
          <div className="hint" style={{ marginTop: -6, marginBottom: 10 }}>
            后端暂未记录 token usage：此处以各会话消息条数做本地近似，仅作骨架示意，待用量接口接入后替换为真实数据。
          </div>
          {usage.length === 0 && <div className="muted">暂无会话数据</div>}
          {usage.map((u) => (
            <div key={u.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: 'var(--tx2)', marginBottom: 3 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{u.label}</span>
                <span style={{ fontFamily: 'var(--monoP)', color: 'var(--tx3)' }}>{u.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--soft)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${Math.round((u.count / maxUsage) * 100)}%`,
                    height: '100%',
                    borderRadius: 3,
                    background: 'linear-gradient(90deg, var(--acc), color-mix(in srgb, var(--acc) 55%, transparent))',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </GlassCard>
      )}
    </div>
  );
}
