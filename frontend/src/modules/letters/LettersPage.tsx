import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Modal } from '../../components/ui/Modal';
import { toast } from '../../components/ui/Toast';
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

/** 火漆印章（SVG，替代 emoji） */
function WaxSeal({ letter, sealed, size = 30 }: { letter: string; sealed: boolean; size?: number }) {
  const bumps = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    return { x: 20 + Math.cos(a) * 15, y: 20 + Math.sin(a) * 15 };
  });
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ color: sealed ? 'var(--danger)' : 'var(--tx3)', opacity: sealed ? 1 : 0.55, flex: 'none' }}
      aria-label={sealed ? '火漆密封' : '已拆'}
    >
      <g fill="currentColor">
        <circle cx="20" cy="20" r="15" />
        {bumps.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r="3.4" />
        ))}
      </g>
      <circle cx="20" cy="20" r="10.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
      <text
        x="20"
        y="24.5"
        textAnchor="middle"
        fill="rgba(255,255,255,0.92)"
        fontSize="12"
        fontFamily="var(--serif), serif"
      >
        {letter}
      </text>
    </svg>
  );
}

/** 信封瓦片上的信封图形 */
function EnvelopeArt({ sealed }: { sealed: boolean }) {
  return (
    <svg viewBox="0 0 64 40" width="100%" height="40" style={{ display: 'block' }} aria-hidden>
      <rect x="2" y="2" width="60" height="36" rx="6" fill="var(--soft)" stroke="var(--line)" />
      {sealed ? (
        <path d="M2 8 L32 26 L62 8" fill="none" stroke="var(--line)" strokeWidth="1.4" />
      ) : (
        <path d="M2 38 L24 18 M62 38 L40 18" fill="none" stroke="var(--line)" strokeWidth="1.2" />
      )}
    </svg>
  );
}

export default function LettersPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [ports, setPorts] = useState<AiPort[]>([]);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [open, setOpen] = useState<Letter | null>(null);
  const [ghostBusy, setGhostBusy] = useState(false);

  useEffect(() => {
    load();
    api<{ configs: AiPort[] }>('/api/ai/configs').then((r) => setPorts(r.configs)).catch(() => {});
  }, []);

  async function load() {
    const rows = await localGetAll('letters');
    setLetters(rows.map((r) => r.data as unknown as Letter).sort((a, b) => b.createdAt - a.createdAt));
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return toast('主题和正文都要填');
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
    toast('信已投递');
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
    toast('信已销毁');
    load();
  }

  // AI 代笔：以选中 AI 的口吻，结合我的名片，给「我」写一封信
  async function aiDraft() {
    if (!to) return toast('先选择接收的 AI');
    setGhostBusy(true);
    toast('TA 正在写信…');
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
      toast('已代笔，可修改后投递');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setGhostBusy(false);
    }
  }

  // AI 主动来信：让选中的 AI 以「给我的信」口吻，主动写一封火漆密封的信投入信箱
  async function receiveLetter() {
    if (!to) return toast('先选择接收的 AI');
    setGhostBusy(true);
    toast('TA 正在给你写信…');
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
      toast('信已投入信箱（火漆密封）');
      load();
    } catch (e) {
      toast((e as Error).message);
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
        <div className="field">
          <span className="fld-lb">收件人</span>
          <Select value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">（选择接收的 AI）</option>
            {ports.map((p) => (
              <option key={p._id} value={p._id}>{p.nickname || p.name}</option>
            ))}
          </Select>
        </div>
        <div className="field">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="主题" />
        </div>
        <div className="field">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="正文…" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn" disabled={ghostBusy} onClick={aiDraft}>AI 代笔</button>
          <button className="btn" disabled={ghostBusy} onClick={receiveLetter}>✉️ 收 TA 的来信</button>
          <button className="btn primary" style={{ flex: 1 }} onClick={send}>{ghostBusy ? 'TA 写信中…' : '投递'}</button>
        </div>
      </GlassCard>

      <SectionTitle en="Mailbox" cn="信箱" />
      {letters.length === 0 && <Empty text="信箱空空如也" />}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
        {letters.map((l) => (
          <div
            key={l.docId}
            onClick={() => (l.sealed ? unseal(l.docId) : setOpen(l))}
            className="glass"
            style={{ padding: 12, borderRadius: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <EnvelopeArt sealed={l.sealed} />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <WaxSeal letter={(l.fromId ? l.from : l.to).slice(0, 1)} sealed={l.sealed} size={28} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.sealed ? '火漆密封' : l.subject}
                </div>
                <div className="muted" style={{ fontSize: '0.66rem' }}>
                  {l.fromId ? `${l.from} → 我` : `我 → ${l.to}`}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 读信 Modal */}
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        wide
        title={open ? (open.fromId ? `${open.from} → 我` : `我 → ${open.to}`) : ''}
        footer={
          open && (
            <>
              <button className="btn danger" onClick={() => del(open.docId)}>销毁此信</button>
              <button className="btn primary" onClick={() => setOpen(null)}>合上</button>
            </>
          )
        }
      >
        {open && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <WaxSeal letter={(open.fromId ? open.from : open.to).slice(0, 1)} sealed={false} size={40} />
              <h3 style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: '1.2rem', color: 'var(--tx)' }}>
                {open.subject}
              </h3>
            </div>
            <div className="dlg-body" style={{ lineHeight: 1.9, fontSize: '0.9rem' }}>
              {open.body}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
