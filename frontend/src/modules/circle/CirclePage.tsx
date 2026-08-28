import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';

interface Comment {
  authorType: 'user' | 'ai';
  authorName: string;
  text: string;
  createdAt: string;
}
interface Post {
  _id: string;
  authorType: 'user' | 'ai';
  authorName: string;
  text: string;
  image?: string;
  location?: string;
  visibility: 'all' | 'self' | 'allow' | 'exclude';
  comments?: Comment[];
  repostOf?: string;
  createdAt: string;
}

const VIS = [
  { value: 'self', label: '仅自己' },
  { value: 'all', label: '所有人' },
  { value: 'allow', label: '仅指定' },
  { value: 'exclude', label: '排除指定' },
];

export default function CirclePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'self' | 'allow' | 'exclude'>('self');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const r = await api<{ posts: Post[] }>('/api/social/posts');
      setPosts(r.posts);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function publish() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      await api('/api/social/posts', { method: 'POST', body: JSON.stringify({ text, visibility }) });
      setText('');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    await api(`/api/social/posts/${id}`, { method: 'DELETE' });
    load();
  }

  async function comment(id: string, text: string) {
    if (!text.trim()) return;
    await api(`/api/social/posts/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) });
    await load();
  }
  async function repost(id: string) {
    const text = prompt('转发附言（可留空）') || '';
    await api(`/api/social/posts/${id}/repost`, { method: 'POST', body: JSON.stringify({ text }) });
    await load();
  }
  async function aiReact(id: string) {
    setMsg('AI 正在接话…');
    try {
      await api(`/api/social/posts/${id}/ai-react`, { method: 'POST', body: JSON.stringify({}) });
      await load();
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }
  async function care() {
    setMsg('TA 正在惦记你…');
    try {
      await api('/api/care/trigger', { method: 'POST', body: JSON.stringify({}) });
      await load();
      setMsg('');
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div className="page">
      <SectionTitle en="Circle" cn="社交圈 · InternetBeyond" />
      <p className="hint">你与已授权的 AI 互发动态、评论、回复与转发，逐条设置可见范围。两端同一个圈子。</p>

      <GlassCard>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="此刻想说点什么…"
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'var(--panel)', color: 'var(--tx)', fontFamily: 'inherit', fontSize: '0.86rem' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)} className="fld" style={{ flex: 1 }}>
            {VIS.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
          <button className="btn primary" disabled={busy} onClick={publish}>{busy ? '发布中…' : '发布'}</button>
        </div>
        {msg && <p className="muted" style={{ marginTop: 6 }}>{msg}</p>}
        <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={care}>🤍 让 TA 主动关怀</button>
      </GlassCard>

      {posts.length === 0 && <Empty text="还没有动态" />}
      {posts.map((p) => (
        <GlassCard key={p._id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ marginBottom: 4 }}>
                {p.authorType === 'ai' ? '🤖 ' : '🙂 '}
                {p.authorName || '我'} · {VIS.find((v) => v.value === p.visibility)?.label}
                {p.repostOf && ' · 🔁 转发'}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.88rem' }}>{p.text}</div>

              {/* 评论 */}
              {(p.comments || []).map((c, i) => (
                <div key={i} className="comment" style={{ marginTop: 8 }}>
                  <span className="muted">{c.authorType === 'ai' ? '🤖 ' : '🙂 '}{c.authorName}：</span>
                  <span style={{ fontSize: '0.84rem' }}>{c.text}</span>
                </div>
              ))}
              <CircleCommentBox onSend={(t) => comment(p._id, t)} />
            </div>
            {p.authorType === 'user' && (
              <button className="btn danger" onClick={() => del(p._id)}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn" onClick={() => repost(p._id)}>🔁 转发</button>
            <button className="btn" onClick={() => aiReact(p._id)}>🤖 让 AI 互动</button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function CircleCommentBox({ onSend }: { onSend: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      <input className="fld" value={t} onChange={(e) => setT(e.target.value)} placeholder="写评论…" style={{ flex: 1 }} />
      <button className="btn primary" onClick={() => { onSend(t); setT(''); }}>评</button>
    </div>
  );
}
