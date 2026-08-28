import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';

interface Tool {
  _id: string;
  kind: 'http' | 'mcp';
  name: string;
  url: string;
  enabled: boolean;
  confirmBeforeRun: boolean;
}

export default function DIYPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<'http' | 'mcp'>('http');
  const [confirm, setConfirm] = useState(true);
  const [runResult, setRunResult] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const r = await api<{ tools: Tool[] }>('/api/tools');
      setTools(r.tools);
    } catch (e) {
      setRunResult((e as Error).message);
    }
  }

  async function add() {
    if (!url.trim()) return;
    await api('/api/tools', { method: 'POST', body: JSON.stringify({ name: name || url, url, kind, confirmBeforeRun: confirm }) });
    setName('');
    setUrl('');
    load();
  }

  async function del(id: string) {
    await api(`/api/tools/${id}`, { method: 'DELETE' });
    load();
  }

  async function run(id: string) {
    setRunResult('运行中…');
    try {
      const r = await api<{ status: number; body: string }>(`/api/tools/${id}/run`, { method: 'POST', body: JSON.stringify({ method: 'POST', payload: {} }) });
      setRunResult(`[${r.status}] ${r.body}`);
    } catch (e) {
      setRunResult((e as Error).message);
    }
  }

  return (
    <div className="page">
      <SectionTitle en="DIY" cn="外部工具" />
      <p className="hint">配置外部 HTTP 接口与 MCP 服务器，由后端代发请求（绕过浏览器 CORS），支持调用前确认。MCP 接入为占位，当前按 HTTP 执行。</p>

      <GlassCard>
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="fld" value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名（可选）" />
          <input className="fld" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="接口地址 URL" />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="fld" value={kind} onChange={(e) => setKind(e.target.value as 'http' | 'mcp')} style={{ flex: 1 }}>
              <option value="http">HTTP</option>
              <option value="mcp">MCP</option>
            </select>
            <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> 调用前确认
            </label>
          </div>
          <button className="btn primary" onClick={add}>添加工具</button>
        </div>
      </GlassCard>

      <SectionTitle en="Tools" cn="已配置工具" />
      {tools.length === 0 && <Empty text="还没有外部工具" />}
      {tools.map((t) => (
        <GlassCard key={t._id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="muted" style={{ wordBreak: 'break-all' }}>{t.kind} · {t.url}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn primary" onClick={() => run(t._id)}>运行</button>
              <button className="btn danger" onClick={() => del(t._id)}>删除</button>
            </div>
          </div>
        </GlassCard>
      ))}

      {runResult && (
        <GlassCard>
          <SectionTitle en="Result" cn="运行结果" />
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '0.76rem', color: 'var(--tx2)' }}>{runResult}</pre>
        </GlassCard>
      )}
    </div>
  );
}
