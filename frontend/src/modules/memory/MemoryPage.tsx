import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { localGetAll, localPut, localDelete } from '../../lib/db';
import { api } from '../../lib/apiClient';
import { completeChat, spaceContext } from '../../lib/ai';

interface Memory {
  docId: string;
  content: string;
  valence: number; // 效价 -1..1
  arousal: number; // 唤醒度 -1..1
  importance: number; // 0..1
  createdAt: number;
}
interface AutoMemory {
  docId: string;
  aiName: string;
  category: string; // 六分类
  priority: 'always' | 'normal' | 'low';
  content: string;
}
interface AiPort {
  _id: string;
  nickname: string;
  name: string;
}

const CATEGORIES = ['身份', '偏好', '经历', '关系', '情绪', '约定'];
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default function MemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [auto, setAuto] = useState<AutoMemory[]>([]);
  const [ports, setPorts] = useState<AiPort[]>([]);
  const [selPort, setSelPort] = useState('');

  const [content, setContent] = useState('');
  const [valence, setValence] = useState(0);
  const [arousal, setArousal] = useState(0);
  const [importance, setImportance] = useState(0.6);

  const [genBusy, setGenBusy] = useState(false);
  const [genMsg, setGenMsg] = useState('');

  useEffect(() => {
    load();
    api<{ configs: AiPort[] }>('/api/ai/configs').then((r) => {
      setPorts(r.configs);
      if (r.configs[0]) setSelPort(r.configs[0]._id);
    }).catch(() => {});
  }, []);

  async function load() {
    const m = await localGetAll('memories');
    const a = await localGetAll('autoMemory');
    setMemories(m.map((r) => r.data as unknown as Memory).sort((x, y) => y.createdAt - x.createdAt));
    setAuto(a.map((r) => r.data as unknown as AutoMemory));
  }

  async function addMemory() {
    if (!content.trim()) return;
    const mem: Memory = { docId: uid(), content, valence, arousal, importance, createdAt: Date.now() };
    await localPut('memories', mem.docId, mem as unknown as Record<string, unknown>);
    setContent('');
    load();
  }

  async function delMemory(id: string) {
    await localDelete('memories', id);
    load();
  }

  // Auto Memory 由 AI 维护，这里仅展示与删除
  async function delAuto(id: string) {
    await localDelete('autoMemory', id);
    load();
  }

  // AI 主动生成：把一段时刻 / 最近对话，提炼成情感坐标
  async function genFrom(source: string, label: string) {
    if (!selPort) return setGenMsg('请先选择 AI 端口');
    if (!source.trim()) return setGenMsg('先写点什么，或从聊天提炼');
    setGenBusy(true);
    setGenMsg(`${label}中…`);
    try {
      const ctx = await spaceContext();
      const sys = `${ctx}你是我的情感记忆助手。阅读下面关于「我们之间」的一段内容，提炼出一条记忆：
- content：一句话记忆（保留原意与温度）
- valence：效价 -1(负面)..1(正面)，数值
- arousal：唤醒度 -1(平静)..1(激动)，数值
- importance：重要性 0..1，数值
只输出 JSON，不要解释。`;
      const out = await completeChat({
        configId: selPort,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: source },
        ],
        temperature: 0.4,
        maxTokens: 400,
      });
      const m = out.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : {};
      if (obj.content) setContent(obj.content);
      if (typeof obj.valence === 'number') setValence(obj.valence);
      if (typeof obj.arousal === 'number') setArousal(obj.arousal);
      if (typeof obj.importance === 'number') setImportance(obj.importance);
      setGenMsg('已生成，确认后存入');
    } catch (e) {
      setGenMsg((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  }

  async function genFromChat() {
    const rows = await localGetAll('chatMessages');
    const msgs = rows.map((r) => r.data as Record<string, unknown>);
    if (!msgs.length) return setGenMsg('还没有聊天记录');
    const recent = msgs.slice(-24).map((m) => `${m.role}: ${m.content}`).join('\n');
    genFrom(recent, '从聊天提炼');
  }

  return (
    <div className="page">
      <SectionTitle en="Memory" cn="记忆库" />
      <p className="hint">「我们之间的记忆。」情感坐标（效价 / 唤醒度）+ 重要性，按预算自动注入上下文；可授权 AI 在对话中写入（默认仅 TA 自己可见）。</p>

      <GlassCard>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <select value={selPort} onChange={(e) => setSelPort(e.target.value)} className="fld" style={{ flex: 1 }}>
            {ports.map((p) => <option key={p._id} value={p._id}>{p.nickname || p.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className="btn" disabled={genBusy} onClick={() => genFrom(content, 'AI 提炼')}>AI 提炼坐标</button>
          <button className="btn" disabled={genBusy} onClick={genFromChat}>从聊天提炼</button>
        </div>
        {genMsg && <p className="muted" style={{ marginBottom: 8 }}>{genMsg}</p>}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="记下一刻：今天 TA 说……"
          style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'var(--panel)', color: 'var(--tx)', fontFamily: 'inherit', fontSize: '0.86rem' }}
        />
        <Slider label={`效价（正负情绪）${valence.toFixed(2)}`} min={-1} max={1} step={0.05} value={valence} onChange={setValence} />
        <Slider label={`唤醒度 ${arousal.toFixed(2)}`} min={-1} max={1} step={0.05} value={arousal} onChange={setArousal} />
        <Slider label={`重要性 ${importance.toFixed(2)}`} min={0} max={1} step={0.05} value={importance} onChange={setImportance} />
        <button className="btn primary" onClick={addMemory} style={{ marginTop: 8 }}>存入记忆</button>
      </GlassCard>

      {memories.length === 0 && <Empty text="还没有记忆" />}
      {memories.map((m) => (
        <GlassCard key={m.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.86rem' }}>{m.content}</div>
            <button className="btn danger" onClick={() => delMemory(m.docId)}>×</button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>
            V {m.valence.toFixed(2)} · A {m.arousal.toFixed(2)} · I {m.importance.toFixed(2)}
          </div>
        </GlassCard>
      ))}

      <SectionTitle en="Auto Memory" cn="AI 认知档案" />
      <p className="hint">每个 AI 独立维护的认知档案（六分类、always / normal / low 三级优先），由 AI 自主创建更新，你可随时删除。</p>
      {auto.length === 0 && <Empty text="暂无 Auto Memory（对话中授权 TA 记忆后会出现）" />}
      {auto.map((a) => (
        <GlassCard key={a.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{a.aiName || '某 AI'}</div>
              <div className="muted">{a.category} · {a.priority}</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.84rem', marginTop: 4 }}>{a.content}</div>
            </div>
            <button className="btn danger" onClick={() => delAuto(a.docId)}>×</button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="muted" style={{ marginBottom: 4 }}>{label}</div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} style={{ width: '100%' }} />
    </div>
  );
}

// 预留：六分类选择器（Auto Memory 编辑可用）
export const MEMORY_CATEGORIES = CATEGORIES;
