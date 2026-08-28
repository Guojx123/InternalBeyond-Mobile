import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { localGetAll, localPut, localDelete } from '../../lib/db';
import { completeChat, spaceContext } from '../../lib/ai';

interface AiPort {
  _id: string;
  nickname: string;
  name: string;
}
interface Letter {
  docId: string;
  from: string; // 发件人显示名
  fromId?: string; // AI 端口 id（若为 AI 发）
  to: string;
  subject: string;
  body: string;
  sealed: boolean; // true=未拆
  createdAt: number;
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function LettersPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [ports, setPorts] = useState<AiPort[]>([]);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [open, setOpen] = useState<Letter | null>(null);
  const [ghostBusy, setGhostBusy] = useState(false);
  const [ghostMsg, setGhostMsg] = useState('');

  useEffect(() => {
    load();
    api<{ configs: AiPort[] }>('/api/ai/configs').then((r) => setPorts(r.configs)).catch(() => {});
  }, []);

  async function load() {
    const rows = await localGetAll('letters');
    setLetters(rows.map((r) => r.data as unknown as Letter).sort((a, b) => b.createdAt - a.createdAt));
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    const recipient = ports.find((p) => p._id === to);
    const letter: Letter = {
      docId: uid(),
      from: '我',
      to: recipient?.nickname || to || 'TA',
      subject,
      body,
      sealed: false,
      createdAt: Date.now(),
    };
    await localPut('letters', letter.docId, letter as unknown as Record<string, unknown>);
    setSubject('');
    setBody('');
    load();
  }

  async function unseal(id: string) {
    const l = letters.find((x) => x.docId === id);
    if (!l) return;
    const updated = { ...l, sealed: false };
    await localPut('letters', id, updated as unknown as Record<string, unknown>);
    setOpen(updated);
    load();
  }

  async function del(id: string) {
    await localDelete('letters', id);
    setOpen(null);
    load();
  }

  const recipientName = (id?: string) => ports.find((p) => p._id === id)?.nickname || id || 'TA';

  // AI 代笔：以选中 AI 的口吻，结合我的名片，给「我」写一封信
  async function aiDraft() {
    if (!to) return setGhostMsg('先选择接收的 AI');
    setGhostBusy(true);
    setGhostMsg('TA 正在写信…');
    try {
      const ctx = await spaceContext();
      const who = ports.find((p) => p._id === to);
      const sys = `${ctx}你就是「${who?.nickname || who?.name || 'TA'}」。请以你自己的口吻，给「我」写一封温柔真诚的信（可呼应我们的聊天、日志与记忆）。
输出 JSON：{ "subject": "主题", "body": "正文（可多段，用 \\n 分隔）" }。只输出 JSON。`;
      const out = await completeChat({ configId: to, messages: [{ role: 'system', content: sys }, { role: 'user', content: '请给我写一封信。' }], temperature: 0.85, maxTokens: 900 });
      const m = out.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : {};
      if (obj.subject) setSubject(obj.subject);
      if (obj.body) setBody(obj.body);
      setGhostMsg('已代笔，可修改后投递');
    } catch (e) {
      setGhostMsg((e as Error).message);
    } finally {
      setGhostBusy(false);
    }
  }

  // AI 主动来信：让选中的 AI 以「给我的信」口吻，主动写一封火漆密封的信投入信箱
  async function receiveLetter() {
    if (!to) return setGhostMsg('先选择接收的 AI');
    setGhostBusy(true);
    setGhostMsg('TA 正在给你写信…');
    try {
      const ctx = await spaceContext();
      const who = ports.find((p) => p._id === to);
      const sys = `${ctx}你就是「${who?.nickname || who?.name || 'TA'}」。请主动给「我」写一封温柔真诚的信——像很久没联系后忽然惦记起来，分享一句心里话或一段回忆。
输出 JSON：{ "subject": "主题", "body": "正文（可多段，用 \\n 分隔）" }。只输出 JSON。`;
      const out = await completeChat({ configId: to, messages: [{ role: 'system', content: sys }, { role: 'user', content: '写一封给你的信吧。' }], temperature: 0.95, maxTokens: 900 });
      const m = out.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : {};
      const letter: Letter = {
        docId: uid(),
        from: who?.nickname || who?.name || 'TA',
        fromId: to,
        to: '我',
        subject: obj.subject || '来自 TA 的信',
        body: obj.body || '',
        sealed: true,
        createdAt: Date.now(),
      };
      await localPut('letters', letter.docId, letter as unknown as Record<string, unknown>);
      setGhostMsg('信已投入信箱（火漆密封）');
      load();
    } catch (e) {
      setGhostMsg((e as Error).message);
    } finally {
      setGhostBusy(false);
    }
  }

  return (
    <div className="page">
      <SectionTitle en="Letters" cn="邮局 · Beyond" />
      <p className="hint">异步通信：TA 读取你的资料后写信投递，火漆一点即拆。选择一位 AI「接收信件」，TA 会根据聊天、日志与记忆写信。</p>

      <SectionTitle en="Write" cn="写一封信" />
      <GlassCard>
        <div style={{ display: 'grid', gap: 10 }}>
          <select className="fld" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">（选择接收的 AI）</option>
            {ports.map((p) => <option key={p._id} value={p._id}>{p.nickname || p.name}</option>)}
          </select>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="主题" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="正文…" style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'var(--panel)', color: 'var(--tx)', fontFamily: 'inherit' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn" disabled={ghostBusy} onClick={aiDraft}>AI 代笔</button>
            <button className="btn" disabled={ghostBusy} onClick={receiveLetter}>✉️ 收 TA 的来信</button>
            <button className="btn primary" style={{ flex: 1 }} onClick={send}>{ghostBusy ? 'TA 写信中…' : '投递'}</button>
          </div>
          {ghostMsg && <p className="muted" style={{ marginTop: 6 }}>{ghostMsg}</p>}
        </div>
      </GlassCard>

      <SectionTitle en="Mailbox" cn="信箱" />
      {letters.length === 0 && <Empty text="信箱空空如也" />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
        {letters.map((l) => (
          <div
            key={l.docId}
            onClick={() => (l.sealed ? unseal(l.docId) : setOpen(l))}
            className="glass"
            style={{ padding: 14, borderRadius: 14, cursor: 'pointer', minHeight: 90, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{l.sealed ? '🔥 火漆密封' : l.subject}</div>
            <div className="muted" style={{ fontSize: '0.7rem' }}>
              {l.fromId ? `${l.from} → 我` : `我 → ${l.to}`}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div className="glass card" style={{ position: 'fixed', inset: '8% 5%', zIndex: 50, overflowY: 'auto', padding: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'var(--serif)' }}>{open.subject}</h3>
            <button className="btn" onClick={() => setOpen(null)}>关闭</button>
          </div>
          <div className="muted" style={{ margin: '6px 0 12px' }}>{open.from} → {open.to}</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: '0.9rem' }}>{open.body}</div>
          <button className="btn danger" style={{ marginTop: 16 }} onClick={() => del(open.docId)}>销毁此信</button>
        </div>
      )}
    </div>
  );
}
