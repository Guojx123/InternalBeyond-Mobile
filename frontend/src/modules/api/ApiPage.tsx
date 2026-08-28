import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';

interface AiConfig {
  _id: string;
  provider: string;
  name: string;
  nickname: string;
  relation: string;
  systemPrompt: string;
  baseUrl: string;
  aiModel: string;
  permissions?: Record<string, boolean>;
}

const PROVIDERS = [
  { value: 'claude', label: 'Claude (Anthropic)' },
  { value: 'gpt', label: 'GPT (OpenAI)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Gemini (Google)' },
  { value: 'custom', label: '自定义 / 中转站' },
];

const EMPTY = {
  provider: 'claude',
  name: '',
  nickname: '',
  relation: '',
  systemPrompt: '',
  baseUrl: '',
  aiModel: '',
  apiKey: '',
};

export default function ApiPage() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [form, setForm] = useState<typeof EMPTY & { _id?: string }>({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const r = await api<{ configs: AiConfig[] }>('/api/ai/configs');
      setConfigs(r.configs);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  function edit(c: AiConfig) {
    setForm({ ...EMPTY, ...c, apiKey: '' }); // 密钥不回显，留空表示不修改
    setMsg('');
  }

  function reset() {
    setForm({ ...EMPTY });
  }

  async function save() {
    setBusy(true);
    setMsg('');
    try {
      const payload: Record<string, unknown> = { ...form };
      delete payload._id;
      if (!payload.apiKey) delete payload.apiKey; // 未填则不覆盖服务端已有密钥
      if (form._id) {
        await api(`/api/ai/configs/${form._id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/ai/configs', { method: 'POST', body: JSON.stringify(payload) });
      }
      reset();
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    await api(`/api/ai/configs/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="page">
      <SectionTitle en="API" cn="接口 · 端口配置" />
      <p className="hint">
        每个端口成为一位 AI 好友。密钥仅在服务端加密保存（AES-256-GCM），<b>不会回传浏览器、不进入备份</b>。
        选好服务商后接口地址与默认模型会自动填入，也可填自定义中转站。
      </p>

      {/* 列表 */}
      {configs.length === 0 && <Empty text="尚未配置任何 AI 端口" />}
      {configs.map((c) => (
        <GlassCard key={c._id} onClick={() => edit(c)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.nickname || c.name || '未命名'}</div>
              <div className="muted">{PROVIDERS.find((p) => p.value === c.provider)?.label || c.provider} · {c.aiModel || '默认模型'}</div>
            </div>
            <button
              className="btn danger"
              onClick={(e) => {
                e.stopPropagation();
                del(c._id);
              }}
            >
              删除
            </button>
          </div>
        </GlassCard>
      ))}

      {/* 表单 */}
      <SectionTitle en={form._id ? 'Edit Port' : 'New Port'} cn={form._id ? '编辑端口' : '新增端口'} />
      <GlassCard>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="服务商">
            <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="fld">
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="昵称（称呼 TA）" grow>
              <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="如：小满" />
            </Field>
            <Field label="关系" grow>
              <input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="如：恋人" />
            </Field>
          </div>
          <Field label="API Key">
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder={form._id ? '留空则不修改' : 'sk-… / AIza…'}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="接口地址 Base URL" grow>
              <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="留空用官方默认" />
            </Field>
            <Field label="模型 Model" grow>
              <input value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })} placeholder="留空用默认" />
            </Field>
          </div>
          <Field label="系统提示词 / 关系设定">
            <textarea
              value={form.systemPrompt}
              onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
              rows={3}
              placeholder="你对 TA 的设定与上下文…"
            />
          </Field>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
            {form._id && <button className="btn" onClick={reset}>取消</button>}
          </div>
          {msg && <p className="muted">{msg}</p>}
        </div>
      </GlassCard>
    </div>
  );
}

function Field({ label, children, grow }: { label: string; children: React.ReactNode; grow?: boolean }) {
  return (
    <label style={{ display: 'block', flex: grow ? 1 : undefined }}>
      <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 6 }}>{label}</div>
      {children}
    </label>
  );
}
