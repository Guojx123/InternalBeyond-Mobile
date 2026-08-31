import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Toggle } from '../../components/ui/Toggle';
import { toast } from '../../components/ui/Toast';

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

/** 端口权限项（服务端以 Record<string,boolean> 存储） */
const PERMS: { key: string; label: string; sub: string }[] = [
  { key: 'memoryWrite', label: '写入记忆', sub: '允许 TA 在对话中写入 Auto Memory' },
  { key: 'calendarRead', label: '读取日历', sub: '允许 TA 感知临近纪念日与日程' },
  { key: 'blogRead', label: '读取日志', sub: '允许 TA 阅读公开日志（不含密码日记）' },
  { key: 'circlePost', label: '互动圈子', sub: '允许 TA 在 Circle 发动态与评论' },
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
  const [form, setForm] = useState<typeof EMPTY & { _id?: string; permissions?: Record<string, boolean> }>({ ...EMPTY });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const r = await api<{ configs: AiConfig[] }>('/api/ai/configs');
      setConfigs(r.configs);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function edit(c: AiConfig) {
    setForm({ ...EMPTY, ...c, apiKey: '' }); // 密钥不回显，留空表示不修改
  }

  function reset() {
    setForm({ ...EMPTY });
  }

  async function save() {
    setBusy(true);
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
      toast('已保存');
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    await api(`/api/ai/configs/${id}`, { method: 'DELETE' });
    toast('端口已删除');
    await load();
  }

  function setPerm(key: string, v: boolean) {
    setForm((f) => ({ ...f, permissions: { ...(f.permissions || {}), [key]: v } }));
  }

  return (
    <div className="page">
      <SectionTitle en="API" cn="接口 · 端口配置" />
      <p className="hint">
        每个端口成为一位 AI 好友。密钥仅在服务端加密保存（AES-256-GCM），<b>不会回传浏览器、不进入备份</b>。
        选好服务商后接口地址与默认模型会自动填入，也可填自定义中转站。
      </p>

      {/* 端口卡列表 */}
      {configs.length === 0 && <Empty text="尚未配置任何 AI 端口" />}
      {configs.map((c) => (
        <GlassCard key={c._id} onClick={() => edit(c)}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Avatar glyph="✶" name={c.nickname || c.name} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: 'var(--tx)' }}>{c.nickname || c.name || '未命名'}</div>
              <div className="muted" style={{ fontSize: '0.72rem' }}>
                {PROVIDERS.find((p) => p.value === c.provider)?.label || c.provider} · {c.aiModel || '默认模型'}
                {c.relation ? ` · ${c.relation}` : ''}
              </div>
            </div>
            <button
              className="btn danger"
              style={{ flex: 'none', padding: '5px 12px', fontSize: '0.72rem' }}
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

      {/* 新增 / 编辑表单 */}
      <SectionTitle en={form._id ? 'Edit Port' : 'New Port'} cn={form._id ? '编辑端口' : '新增端口'} />
      <GlassCard>
        <div className="field">
          <span className="fld-lb">服务商</span>
          <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <span className="fld-lb">昵称（称呼 TA）</span>
            <Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="如：小满" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <span className="fld-lb">关系</span>
            <Input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="如：恋人" />
          </div>
        </div>
        <div className="field">
          <span className="fld-lb">API Key</span>
          <Input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            placeholder={form._id ? '留空则不修改' : 'sk-… / AIza…'}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="field" style={{ flex: 1 }}>
            <span className="fld-lb">接口地址 Base URL</span>
            <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="留空用官方默认" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <span className="fld-lb">模型 Model</span>
            <Input value={form.aiModel} onChange={(e) => setForm({ ...form, aiModel: e.target.value })} placeholder="留空用默认" />
          </div>
        </div>
        <div className="field">
          <span className="fld-lb">系统提示词 / 关系设定</span>
          <Textarea
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            rows={3}
            placeholder="你对 TA 的设定与上下文…"
          />
        </div>

        {/* 逐项权限 */}
        <div className="set-card" style={{ margin: '6px 0 12px' }}>
          <div className="sc-t">Permissions · 权限</div>
          {PERMS.map((p) => (
            <Toggle
              key={p.key}
              on={!!form.permissions?.[p.key]}
              onChange={(v) => setPerm(p.key, v)}
              title={p.label}
              sub={p.sub}
            />
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存'}</button>
          {form._id && <button className="btn" onClick={reset}>取消</button>}
        </div>
      </GlassCard>
    </div>
  );
}
