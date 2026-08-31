import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Chip } from '../../components/ui/Chip';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Toggle } from '../../components/ui/Toggle';
import { Select } from '../../components/ui/Select';
import { Modal, askConfirm } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
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
  createdAt?: number;
}
/** AI 段落批注（写入方为 AI 流程，这里只做展示） */
interface BlogAnnotation {
  docId: string;
  entryId: string;
  anchor?: string;
  text: string;
  author?: string;
  createdAt?: number;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function fmtDay(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export default function BlogPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [entries, setEntries] = useState<BlogEntry[]>([]);
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [annotations, setAnnotations] = useState<BlogAnnotation[]>([]);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [catName, setCatName] = useState('');

  // 阅读视图
  const [reading, setReading] = useState<BlogEntry | null>(null);
  const [asking, setAsking] = useState<BlogEntry | null>(null);
  const [askPass, setAskPass] = useState('');
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const [c, e, cm, an] = await Promise.all([
      localGetAll('categories'),
      localGetAll('blog'),
      localGetAll('blogComments'),
      localGetAll('blogAnnotations'),
    ]);
    setCats(c.map((r) => r.data as unknown as Category));
    setEntries(e.map((r) => r.data as unknown as BlogEntry).sort((a, b) => b.createdAt - a.createdAt));
    setComments(cm.map((r) => r.data as unknown as BlogComment));
    setAnnotations(an.map((r) => r.data as unknown as BlogAnnotation));
  }

  async function addCat() {
    if (!catName.trim()) return;
    const c: Category = { docId: uid(), name: catName.trim() };
    await localPut('categories', c.docId, c as unknown as Record<string, unknown>);
    setCatName('');
    toast('分类已添加');
    load();
  }

  async function addEntry() {
    if (!title.trim()) return;
    if (locked && !password.trim()) return toast('密码日记需要设置密码');
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
    setLocked(false);
    setPassword('');
    toast('已发布');
    load();
  }

  async function del(id: string) {
    if (!(await askConfirm('删除这篇日志？', { danger: true, okText: '删除' }))) return;
    await localDelete('blog', id);
    setReading(null);
    load();
  }

  function commentsFor(id: string) {
    return comments.filter((c) => c.entryId === id);
  }

  function annotationsFor(id: string) {
    return annotations.filter((a) => a.entryId === id);
  }

  async function addComment(entryId: string) {
    if (!commentText.trim()) return;
    const c: BlogComment = {
      docId: uid(),
      entryId,
      author: '我',
      text: commentText.trim(),
      createdAt: Date.now(),
    };
    await localPut('blogComments', c.docId, c as unknown as Record<string, unknown>);
    setCommentText('');
    toast('留言已添加');
    load();
  }

  /** 点击条目：密码日记先验密，其余直接进入阅读视图 */
  function tapEntry(e: BlogEntry) {
    if (e.locked) {
      setAsking(e);
      setAskPass('');
    } else {
      setReading(e);
    }
  }

  function tryUnlock() {
    if (asking && askPass === asking.password) {
      setReading(asking);
      setAsking(null);
      setAskPass('');
    } else {
      toast('密码不对');
    }
  }

  return (
    <div className="page">
      <SectionTitle en="Blog" cn="日志" />
      <p className="hint">日记 / 剧本 / 分类管理 / AI 留言与段落批注。密码日记本与公开日志隔离（仅自己可见）。</p>

      <SectionTitle en="Categories" cn="分类" />
      <GlassCard>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="新分类名" style={{ flex: 1 }} />
          <button className="btn primary" onClick={addCat}>添加</button>
        </div>
        <div className="chips" style={{ marginTop: 10 }}>
          {cats.map((c) => (
            <Chip key={c.docId} onClick={() => setCategory(c.name)} on={category === c.name}>
              {c.name}
            </Chip>
          ))}
          {cats.length === 0 && <span className="muted">还没有分类</span>}
        </div>
      </GlassCard>

      <SectionTitle en="Write" cn="写日志" />
      <GlassCard>
        <div className="field">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
        </div>
        <div className="field">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="正文…" />
        </div>
        <div className="field">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">（无分类）</option>
            {cats.map((c) => (
              <option key={c.docId} value={c.name}>{c.name}</option>
            ))}
          </Select>
        </div>
        <Toggle on={locked} onChange={setLocked} title="密码日记" sub="需要密码才能阅读，仅自己可见" />
        {locked && (
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="日记密码"
            style={{ marginTop: 10 }}
          />
        )}
        <button className="btn primary" style={{ marginTop: 12 }} onClick={addEntry}>发布</button>
      </GlassCard>

      <SectionTitle en="Entries" cn="日志列表" />
      {entries.length === 0 && <Empty text="还没有日志" />}
      {entries.map((e) => {
        const cms = commentsFor(e.docId);
        const anns = annotationsFor(e.docId);
        return (
          <GlassCard key={e.docId} onClick={() => tapEntry(e)}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--tx)' }}>
                  {e.locked ? '🔒 ' : ''}{e.title}
                </div>
                <div className="muted" style={{ marginTop: 3, fontSize: '0.7rem' }}>
                  {e.category && <span>{e.category} · </span>}
                  {fmtDay(e.createdAt)}
                  {cms.length > 0 && <span> · 💬 {cms.length}</span>}
                  {anns.length > 0 && <span> · ✎ {anns.length} 段批注</span>}
                </div>
                {!e.locked && (
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.7,
                      fontSize: '0.84rem',
                      marginTop: 6,
                      color: 'var(--tx2)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {e.body}
                  </div>
                )}
                {e.locked && (
                  <div className="muted" style={{ marginTop: 6, fontSize: '0.78rem' }}>
                    密码日记 · 点击输入密码阅读
                  </div>
                )}
              </div>
              <button
                className="btn danger"
                style={{ flex: 'none', padding: '5px 12px', fontSize: '0.72rem' }}
                onClick={(ev) => {
                  ev.stopPropagation();
                  del(e.docId);
                }}
              >
                删除
              </button>
            </div>
          </GlassCard>
        );
      })}

      {/* 密码日记验密弹层 */}
      <Modal
        open={!!asking}
        onClose={() => setAsking(null)}
        title="密码日记"
        footer={
          <>
            <button className="btn" onClick={() => setAsking(null)}>取消</button>
            <button className="btn primary" onClick={tryUnlock}>解锁</button>
          </>
        }
      >
        <Input
          type="password"
          value={askPass}
          onChange={(e) => setAskPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
          placeholder="日记密码"
          autoFocus
        />
      </Modal>

      {/* 阅读视图 */}
      <Modal
        open={!!reading}
        onClose={() => setReading(null)}
        wide
        title={reading ? `${reading.category || '随笔'} · ${fmtDay(reading.createdAt)}` : ''}
        footer={
          reading && (
            <>
              <button className="btn danger" onClick={() => del(reading.docId)}>删除</button>
              <button className="btn primary" onClick={() => setReading(null)}>合上</button>
            </>
          )
        }
      >
        {reading && (
          <>
            <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: '1.24rem', color: 'var(--tx)', marginBottom: 10 }}>
              {reading.title}
            </h3>
            <div className="dlg-body" style={{ lineHeight: 1.9, fontSize: '0.9rem' }}>
              {reading.body}
            </div>

            {/* AI 段落批注（blogAnnotations，仅展示） */}
            {annotationsFor(reading.docId).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="dlg-title" style={{ marginBottom: 8 }}>AI 批注</div>
                {annotationsFor(reading.docId).map((a) => (
                  <div
                    key={a.docId}
                    style={{
                      borderLeft: '2px solid var(--think)',
                      padding: '6px 10px',
                      marginBottom: 8,
                      background: 'color-mix(in srgb, var(--think) 8%, transparent)',
                      borderRadius: '0 10px 10px 0',
                      fontSize: '0.8rem',
                      lineHeight: 1.7,
                      color: 'var(--think)',
                    }}
                  >
                    {a.anchor && <span className="muted" style={{ display: 'block', fontSize: '0.68rem' }}>「{a.anchor.slice(0, 24)}…」</span>}
                    {a.text}
                  </div>
                ))}
              </div>
            )}

            {/* 留言 */}
            <div style={{ marginTop: 16 }}>
              <div className="dlg-title" style={{ marginBottom: 8 }}>留言 · {commentsFor(reading.docId).length}</div>
              {commentsFor(reading.docId).map((c) => (
                <div key={c.docId} className="comment" style={{ marginBottom: 8, fontSize: '0.82rem', lineHeight: 1.7 }}>
                  <span className="muted">{c.author}：</span>
                  {c.text}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addComment(reading.docId)}
                  placeholder="写留言…"
                  style={{ flex: 1 }}
                />
                <button className="btn primary" onClick={() => addComment(reading.docId)}>留言</button>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
