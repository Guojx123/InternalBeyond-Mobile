import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Toggle } from '../../components/ui/Toggle';
import { askConfirm } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';

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
      toast((e as Error).message);
    }
  }

  async function add() {
    if (!url.trim()) return toast('先填接口地址 URL');
    await api('/api/tools', { method: 'POST', body: JSON.stringify({ name: name || url, url, kind, confirmBeforeRun: confirm }) });
    setName('');
    setUrl('');
    toast('工具已添加');
    load();
  }

  async function del(id: string) {
    if (!(await askConfirm('删除这个工具？', { danger: true, okText: '删除' }))) return;
    await api(`/api/tools/${id}`, { method: 'DELETE' });
    load();
  }

  async function run(t: Tool) {
    if (t.confirmBeforeRun && !(await askConfirm(`运行「${t.name}」？`, { okText: '运行' }))) return;
    setRunResult('运行中…');
    try {
      const r = await api<{ status: number; body: string }>(`/api/tools/${t._id}/run`, { method: 'POST', body: JSON.stringify({ method: 'POST', payload: {} }) });
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
        <div className="field">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="工具名（可选）" />
        </div>
        <div className="field">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="接口地址 URL" />
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <Select value={kind} onChange={(e) => setKind(e.target.value as 'http' | 'mcp')}>
              <option value="http">HTTP</option>
              <option value="mcp">MCP</option>
            </Select>
          </div>
          <div style={{ flex: 2 }}>
            <Toggle on={confirm} onChange={setConfirm} title="调用前确认" sub="每次运行前弹出确认框" />
          </div>
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={add}>添加工具</button>
      </GlassCard>

      <SectionTitle en="Tools" cn="已配置工具" />
      {tools.length === 0 && <Empty text="还没有外部工具" />}
      {tools.map((t) => (
        <GlassCard key={t._id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{t.name}</div>
              <div className="muted" style={{ wordBreak: 'break-all', fontSize: '0.72rem' }}>
                <span className="chip" style={{ padding: '1px 8px', fontSize: '0.6rem', cursor: 'default', marginRight: 6 }}>{t.kind}</span>
                {t.url}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flex: 'none' }}>
              <button className="btn primary" style={{ padding: '6px 14px' }} onClick={() => run(t)}>运行</button>
              <button className="btn danger" style={{ padding: '6px 14px' }} onClick={() => del(t._id)}>删除</button>
            </div>
          </div>
        </GlassCard>
      ))}

      {runResult && (
        <GlassCard>
          <SectionTitle en="Result" cn="运行结果" />
          <pre className="code">{runResult}</pre>
        </GlassCard>
      )}
    </div>
  );
}
