import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/apiClient';
import { localGetAll, localPut, localGet } from '../../lib/db';
import { streamChat } from '../../lib/stream';
import { Avatar } from '../../components/ui/Avatar';
import { Select } from '../../components/ui/Select';

interface AiConfig {
  _id: string;
  provider: string;
  nickname: string;
  name: string;
}
interface Msg {
  docId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  ts: number;
  /** 可选思考链（仅当数据携带时渲染，现状无此字段则不造 UI） */
  thinking?: string;
  /** 可选操作卡片（仅当数据携带时渲染） */
  actions?: string[];
}
interface Thread {
  docId: string;
  title: string;
  members: string[];
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatPage() {
  const [configs, setConfigs] = useState<AiConfig[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConfigs();
    loadThreads();
  }, []);

  async function loadConfigs() {
    try {
      const r = await api<{ configs: AiConfig[] }>('/api/ai/configs');
      setConfigs(r.configs);
      if (r.configs.length && !thread) {
        // 自动建一个以首个 AI 为成员的会话
        newThread(r.configs[0]._id);
      }
    } catch {
      /* 未配置 AI 时提示 */
    }
  }

  async function loadThreads() {
    const rows = await localGetAll('chatThreads');
    const list = rows.map((r) => r.data as unknown as Thread);
    list.sort((a, b) => (b.docId > a.docId ? 1 : -1));
    setThreads(list);
  }

  async function newThread(configId: string) {
    const t: Thread = { docId: uid(), title: '新对话', members: [configId] };
    await localPut('chatThreads', t.docId, t as unknown as Record<string, unknown>);
    setThread(t);
    setMessages([]);
    loadThreads();
  }

  async function openThread(t: Thread) {
    setThread(t);
    const rows = await localGetAll('chatMessages');
    const msgs = rows
      .map((r) => r.data as unknown as Msg)
      .filter((m) => m.docId.startsWith(t.docId + ':'))
      .sort((a, b) => a.ts - b.ts);
    setMessages(msgs);
  }

  async function switchPort(cfgId: string) {
    if (thread) {
      const next = { ...thread, members: [cfgId] };
      setThread(next);
      await localPut('chatThreads', next.docId, next as unknown as Record<string, unknown>);
    }
  }

  async function send() {
    if (!input.trim() || !thread || busy) return;
    const cfgId = thread.members[0];
    const userMsg: Msg = { docId: thread.docId + ':' + uid(), role: 'user', content: input, ts: Date.now() };
    const aiMsg: Msg = { docId: thread.docId + ':' + uid(), role: 'assistant', content: '', ts: Date.now() + 1 };

    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setBusy(true);
    await localPut('chatMessages', userMsg.docId, userMsg as unknown as Record<string, unknown>);

    const history = next.map((m) => ({ role: m.role, content: m.content }));
    // 注入 Space 名片作为 system 上下文
    const about = await localGet('about', 'me');
    if (about?.data && (about.data as any).bio) {
      history.unshift({ role: 'system', content: `关于用户：${(about.data as any).bio}` });
    }

    try {
      await streamChat({ configId: cfgId, messages: history }, {
        onDelta: (raw) => {
          aiMsg.content += raw;
          setMessages((prev) => {
            const copy = [...prev];
            const i = copy.findIndex((m) => m.docId === aiMsg.docId);
            if (i >= 0) copy[i] = { ...aiMsg };
            else copy.push({ ...aiMsg });
            return copy;
          });
          scrollRef.current?.scrollTo({ top: 1e9 });
        },
        onError: (msg) => {
          aiMsg.content += `\n[错误: ${msg}]`;
          setMessages((prev) => [...prev, { ...aiMsg }]);
        },
        onDone: () => {
          localPut('chatMessages', aiMsg.docId, aiMsg as unknown as Record<string, unknown>);
          setBusy(false);
        },
      });
    } catch (e) {
      setBusy(false);
      setMessages((prev) => [...prev, { ...aiMsg, content: `[异常: ${(e as Error).message}]` }]);
    }
  }

  const cfg = configs.find((c) => c._id === thread?.members[0]);
  const aiName = cfg?.nickname || cfg?.name || 'AI';

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', minHeight: '72vh' }}>
      {/* 会话顶栏（参考 .cv-head） */}
      <div className="cv-head glass">
        <Avatar glyph="✶" name={aiName} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--tx)', fontWeight: 600, lineHeight: 1.3 }}>
            {thread?.title || 'InternalBeyond'}
          </div>
          <div className="muted" style={{ fontSize: '0.68rem' }}>{aiName}</div>
        </div>
        <button className="btn" style={{ padding: '6px 12px', fontSize: '0.72rem' }} onClick={() => configs[0] && newThread(configs[0]._id)}>
          + 新对话
        </button>
      </div>

      {/* 线程 / 端口选择（参考 #cv-selbar） */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div className="cv-selbar">
          <Select
            value={thread?.docId || ''}
            onChange={(e) => {
              const t = threads.find((x) => x.docId === e.target.value);
              if (t) openThread(t);
            }}
            style={{ flex: 1 }}
          >
            {threads.length === 0 && <option value="">暂无会话</option>}
            {threads.map((t) => (
              <option key={t.docId} value={t.docId}>{t.title}</option>
            ))}
          </Select>
        </div>
        <div className="cv-selbar">
          <Select value={thread?.members[0] || ''} onChange={(e) => switchPort(e.target.value)} style={{ flex: 1 }}>
            {configs.map((c) => (
              <option key={c._id} value={c._id}>{c.nickname || c.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {!configs.length && (
        <div className="empty">尚未配置 AI 端口。请到「接口 / API」页添加（密钥仅存服务端）。</div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {messages.map((m) => (
          <div key={m.docId} className={`cv-row${m.role === 'user' ? ' me' : ''}`}>
            <Avatar
              glyph={m.role === 'user' ? '我' : '✶'}
              name={m.role === 'user' ? '我' : aiName}
              size={30}
            />
            <div className="cv-bubble">
              {m.thinking && (
                <details className="cv-think">
                  <summary>思考链</summary>
                  <div>{m.thinking}</div>
                </details>
              )}
              {m.content || '…'}
              {m.actions && m.actions.length > 0 && (
                <div className="cv-actions">
                  {m.actions.map((a, i) => (
                    <button key={i} className="btn" style={{ padding: '5px 12px', fontSize: '0.72rem' }}>{a}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 输入栏（参考 .cv-input） */}
      <div className="cv-input glass">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={busy ? '回复中…' : '说点什么（Enter 发送）'}
          rows={2}
        />
        <button className="btn primary" disabled={busy} onClick={send}>发送</button>
      </div>
    </div>
  );
}
