import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Avatar } from '../../components/ui/Avatar';
import { Chip } from '../../components/ui/Chip';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Sheet } from '../../components/ui/Sheet';
import { toast, } from '../../components/ui/Toast';
import { askConfirm } from '../../components/ui/Modal';

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

const VIS: { value: Post['visibility']; label: string }[] = [
  { value: 'self', label: '仅自己' },
  { value: 'all', label: '所有人' },
  { value: 'allow', label: '仅指定' },
  { value: 'exclude', label: '排除指定' },
];

export default function CirclePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState('');
  const [image, setImage] = useState<string>('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<Post['visibility']>('self');
  const [busy, setBusy] = useState(false);
  const [repost, setRepost] = useState<Post | null>(null);
  const [repostText, setRepostText] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const r = await api<{ posts: Post[] }>('/api/social/posts');
      setPosts(r.posts);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  function pickImage(f: File | undefined) {
    if (!f) return;
    if (f.size > 1024 * 1024) return toast('图片过大（>1MB），请压缩后再试');
    const rd = new FileReader();
    rd.onload = () => setImage(String(rd.result || ''));
    rd.readAsDataURL(f);
  }

  async function publish() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api('/api/social/posts', {
        method: 'POST',
        body: JSON.stringify({
          text,
          visibility,
          image: image || undefined,
          location: location.trim() || undefined,
        }),
      });
      setText('');
      setImage('');
      setLocation('');
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: string) {
    if (!(await askConfirm('删除这条动态？', { danger: true, okText: '删除' }))) return;
    await api(`/api/social/posts/${id}`, { method: 'DELETE' });
    load();
  }

  async function comment(id: string, text: string) {
    if (!text.trim()) return;
    await api(`/api/social/posts/${id}/comment`, { method: 'POST', body: JSON.stringify({ text }) });
    await load();
  }

  async function doRepost() {
    if (!repost) return;
    await api(`/api/social/posts/${repost._id}/repost`, {
      method: 'POST',
      body: JSON.stringify({ text: repostText }),
    });
    setRepost(null);
    setRepostText('');
    await load();
  }

  async function aiReact(id: string) {
    toast('AI 正在接话…');
    try {
      await api(`/api/social/posts/${id}/ai-react`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function care() {
    toast('TA 正在惦记你…');
    try {
      await api('/api/care/trigger', { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="page">
      <SectionTitle en="Circle" cn="社交圈 · InternetBeyond" />
      <p className="hint">你与已授权的 AI 互发动态、评论、回复与转发，逐条设置可见范围。两端同一个圈子。</p>

      {/* 发布卡 */}
      <GlassCard>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="此刻想说点什么…"
        />
        {image && (
          <div style={{ position: 'relative', marginTop: 10 }}>
            <img
              src={image}
              alt="配图预览"
              style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 14, display: 'block' }}
            />
            <button
              className="btn danger"
              style={{ position: 'absolute', top: 8, right: 8, padding: '3px 10px', fontSize: '0.7rem' }}
              onClick={() => setImage('')}
            >
              移除
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="📍 在哪里（可选）"
            style={{ flex: 1 }}
          />
          <label className="btn" style={{ flex: 'none', cursor: 'pointer' }}>
            🖼
            <input type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
          </label>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {VIS.map((v) => (
            <Chip key={v.value} on={visibility === v.value} onClick={() => setVisibility(v.value)}>
              {v.label}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button className="btn primary" style={{ flex: 1 }} disabled={busy} onClick={publish}>
            {busy ? '发布中…' : '发布'}
          </button>
          <button className="btn" disabled={busy} onClick={care}>🤍 让 TA 主动关怀</button>
        </div>
      </GlassCard>

      {/* 动态流 */}
      {posts.length === 0 && <Empty text="还没有动态" />}
      {posts.map((p) => (
        <GlassCard key={p._id}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Avatar glyph={p.authorType === 'ai' ? '✶' : '我'} name={p.authorName || '我'} size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--tx)' }}>
                  {p.authorName || '我'}
                </span>
                <span
                  className="chip"
                  style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default', color: 'var(--tx3)' }}
                >
                  {VIS.find((v) => v.value === p.visibility)?.label}
                </span>
                {p.repostOf && (
                  <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>
                    🔁 转发
                  </span>
                )}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.88rem', marginTop: 6 }}>
                {p.text}
              </div>
              {p.image && (
                <img
                  src={p.image}
                  alt=""
                  style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14, marginTop: 10, display: 'block' }}
                />
              )}
              {p.location && (
                <div className="muted" style={{ marginTop: 6, fontSize: '0.72rem' }}>📍 {p.location}</div>
              )}

              {/* 评论线程 */}
              {(p.comments || []).map((c, i) => (
                <div key={i} className="comment" style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Avatar glyph={c.authorType === 'ai' ? '✶' : '我'} name={c.authorName} size={22} />
                  <span style={{ fontSize: '0.84rem', lineHeight: 1.6 }}>
                    <span className="muted">{c.authorName}：</span>
                    {c.text}
                  </span>
                </div>
              ))}
              <CircleCommentBox onSend={(t) => comment(p._id, t)} />

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn" style={{ padding: '6px 14px', fontSize: '0.74rem' }} onClick={() => setRepost(p)}>
                  🔁 转发
                </button>
                <button className="btn" style={{ padding: '6px 14px', fontSize: '0.74rem' }} onClick={() => aiReact(p._id)}>
                  🤖 让 AI 互动
                </button>
                {p.authorType === 'user' && (
                  <button className="btn danger" style={{ padding: '6px 14px', fontSize: '0.74rem', marginLeft: 'auto' }} onClick={() => del(p._id)}>
                    删除
                  </button>
                )}
              </div>
            </div>
          </div>
        </GlassCard>
      ))}

      {/* 转发弹层（Sheet 替代 prompt） */}
      <Sheet open={!!repost} onClose={() => setRepost(null)} title="转发这条动态">
        {repost && (
          <div className="comment" style={{ marginBottom: 12, fontSize: '0.82rem', lineHeight: 1.7 }}>
            {repost.authorName}：{repost.text.slice(0, 80)}
            {repost.text.length > 80 ? '…' : ''}
          </div>
        )}
        <Textarea
          value={repostText}
          onChange={(e) => setRepostText(e.target.value)}
          rows={2}
          placeholder="转发附言（可留空）"
        />
        <div className="sheet-btns">
          <button className="btn" onClick={() => setRepost(null)}>取消</button>
          <button className="btn primary" onClick={doRepost}>转发</button>
        </div>
      </Sheet>
    </div>
  );
}

function CircleCommentBox({ onSend }: { onSend: (t: string) => void }) {
  const [t, setT] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
      <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="写评论…" onKeyDown={(e) => { if (e.key === 'Enter') { onSend(t); setT(''); } }} style={{ flex: 1 }} />
      <button className="btn primary" onClick={() => { onSend(t); setT(''); }}>评</button>
    </div>
  );
}
