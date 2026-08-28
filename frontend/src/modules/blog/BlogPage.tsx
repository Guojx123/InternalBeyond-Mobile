import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { localGetAll, localPut, localDelete } from '../../lib/db';

interface Category {
  docId: string;
  name: string;
}
interface BlogEntry {
  docId: string;
  title: string;
  body: string;
  category: string;
  locked: boolean;
  password?: string;
  createdAt: number;
}
interface BlogComment {
  docId: string;
  entryId: string;
  author: string;
  text: string;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function BlogPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [entries, setEntries] = useState<BlogEntry[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [catName, setCatName] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [c, e, cm] = await Promise.all([localGetAll('categories'), localGetAll('blog'), localGetAll('blogComments')]);
    setCats(c.map((r) => r.data as unknown as Category));
    setEntries(e.map((r) => r.data as unknown as BlogEntry).sort((a, b) => b.createdAt - a.createdAt));
    setComments(cm.map((r) => r.data as unknown as BlogComment));
  }

  async function addCat() {
    if (!catName.trim()) return;
    const c: Category = { docId: uid(), name: catName.trim() };
    await localPut('categories', c.docId, c as unknown as Record<string, unknown>);
    setCatName('');
    load();
  }

  async function addEntry() {
    if (!title.trim()) return;
    const e: BlogEntry = {
      docId: uid(),
      title,
      body,
      category,
      locked,
      password: locked ? password : undefined,
      createdAt: Date.now(),
    };
    await localPut('blog', e.docId, e as unknown as Record<string, unknown>);
    setTitle('');
    setBody('');
    load();
  }

  async function del(id: string) {
    await localDelete('blog', id);
    load();
  }

  function commentsFor(id: string) {
    return comments.filter((c) => c.entryId === id);
  }

  return (
    <div className="page">
      <SectionTitle en="Blog" cn="日志" />
      <p className="hint">日记 / 剧本 / 分类管理 / AI 留言与段落批注。密码日记本与公开日志隔离（仅自己可见）。</p>

      <SectionTitle en="Categories" cn="分类" />
      <GlassCard>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="新分类名" className="fld" style={{ flex: 1 }} />
          <button className="btn primary" onClick={addCat}>添加</button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {cats.map((c) => (
            <span key={c.docId} className="chip" style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid var(--line)', fontSize: '0.74rem' }}>{c.name}</span>
          ))}
        </div>
      </GlassCard>

      <SectionTitle en="Write" cn="写日志" />
      <GlassCard>
        <div style={{ display: 'grid', gap: 10 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="正文…" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'var(--panel)', color: 'var(--tx)', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="fld" value={category} onChange={(e) => setCategory(e.target.value)} style={{ flex: 1 }}>
              <option value="">（无分类）</option>
              {cats.map((c) => <option key={c.docId} value={c.name}>{c.name}</option>)}
            </select>
            <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> 密码日记
            </label>
          </div>
          {locked && (
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="日记密码" className="fld" />
          )}
          <button className="btn primary" onClick={addEntry}>发布</button>
        </div>
      </GlassCard>

      <SectionTitle en="Entries" cn="日志列表" />
      {entries.length === 0 && <Empty text="还没有日志" />}
      {entries.map((e) => (
        <GlassCard key={e.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {e.locked ? '🔒 ' : ''}{e.title}
                {e.category && <span className="muted"> · {e.category}</span>}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem', marginTop: 4 }}>{e.body}</div>
              {commentsFor(e.docId).map((c) => (
                <div key={c.docId} className="muted" style={{ marginTop: 6, borderLeft: '2px solid var(--line)', paddingLeft: 8 }}>
                  💬 {c.author}：{c.text}
                </div>
              ))}
            </div>
            <button className="btn danger" onClick={() => del(e.docId)}>×</button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
