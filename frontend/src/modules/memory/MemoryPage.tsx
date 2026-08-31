import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle, Empty } from '../../components/GlassCard';
import { Slider } from '../../components/ui/Slider';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Avatar } from '../../components/ui/Avatar';
import { toast } from '../../components/ui/Toast';
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

/** 2D 情感坐标散点（x=效价, y=唤醒度） */
function AffectPlot({ memories }: { memories: Memory[] }) {
  if (!memories.length) return null;
  return (
    <div className="glass" style={{ borderRadius: 18, padding: 12, marginBottom: 12 }}>
      <div className="muted" style={{ fontSize: '0.66rem', letterSpacing: '0.2em', marginBottom: 6 }}>
        AFFECT MAP · 情感坐标
      </div>
      <svg viewBox="0 0 220 132" style={{ width: '100%', display: 'block' }} aria-label="情感坐标散点图">
        {/* 坐标轴 */}
        <line x1="110" y1="8" x2="110" y2="124" stroke="var(--line)" strokeWidth="1" />
        <line x1="10" y1="66" x2="210" y2="66" stroke="var(--line)" strokeWidth="1" />
        <text x="204" y="62" fontSize="6" fill="var(--tx3)" textAnchor="end">激动</text>
        <text x="204" y="76" fontSize="6" fill="var(--tx3)" textAnchor="end">平静</text>
        <text x="14" y="62" fontSize="6" fill="var(--tx3)">负面</text>
        <text x="206" y="62" fontSize="0" fill="var(--tx3)" />
        <text x="112" y="14" fontSize="6" fill="var(--tx3)">正面 →</text>
        {memories.slice(0, 60).map((m) => {
          const x = 110 + m.valence * 92;
          const y = 66 - m.arousal * 52;
          const r = 2.5 + m.importance * 3;
          return (
            <circle key={m.docId} cx={x} cy={y} r={r} fill="var(--acc)" opacity={0.3 + m.importance * 0.55}>
              <title>{m.content.slice(0, 40)}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

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
    toast('已存入记忆');
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
    if (!selPort) return toast('请先选择 AI 端口');
    if (!source.trim()) return toast('先写点什么，或从聊天提炼');
    setGenBusy(true);
    toast(`${label}中…`);
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
      toast('已生成，确认后存入');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setGenBusy(false);
    }
  }

  async function genFromChat() {
    const rows = await localGetAll('chatMessages');
    const msgs = rows.map((r) => r.data as Record<string, unknown>);
    if (!msgs.length) return toast('还没有聊天记录');
    const recent = msgs.slice(-24).map((m) => `${m.role}: ${m.content}`).join('\n');
    genFrom(recent, '从聊天提炼');
  }

  // 按 AI 分组的 Auto Memory
  const autoByAi = auto.reduce<Record<string, AutoMemory[]>>((acc, a) => {
    const k = a.aiName || '某 AI';
    (acc[k] = acc[k] || []).push(a);
    return acc;
  }, {});

  return (
    <div className="page">
      <SectionTitle en="Memory" cn="记忆库" />
      <p className="hint">「我们之间的记忆。」情感坐标（效价 / 唤醒度）+ 重要性，按预算自动注入上下文；可授权 AI 在对话中写入（默认仅 TA 自己可见）。</p>

      <GlassCard>
        <div className="field">
          <span className="fld-lb">AI 端口</span>
          <Select value={selPort} onChange={(e) => setSelPort(e.target.value)}>
            {ports.map((p) => (
              <option key={p._id} value={p._id}>{p.nickname || p.name}</option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className="btn" disabled={genBusy} onClick={() => genFrom(content, 'AI 提炼')}>AI 提炼坐标</button>
          <button className="btn" disabled={genBusy} onClick={genFromChat}>从聊天提炼</button>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder="记下一刻：今天 TA 说……"
        />
        <div style={{ marginTop: 6 }}>
          <Slider label="效价（正负情绪）" min={-1} max={1} step={0.05} value={valence} onChange={setValence} format={(v) => v.toFixed(2)} />
          <Slider label="唤醒度" min={-1} max={1} step={0.05} value={arousal} onChange={setArousal} format={(v) => v.toFixed(2)} />
          <Slider label="重要性" min={0} max={1} step={0.05} value={importance} onChange={setImportance} format={(v) => v.toFixed(2)} />
        </div>
        <button className="btn primary" onClick={addMemory} style={{ marginTop: 8 }}>存入记忆</button>
      </GlassCard>

      <AffectPlot memories={memories} />

      {memories.length === 0 && <Empty text="还没有记忆" />}
      {memories.map((m) => (
        <GlassCard key={m.docId}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.86rem', minWidth: 0 }}>{m.content}</div>
            <button className="btn danger" style={{ flex: 'none', padding: '5px 12px' }} onClick={() => delMemory(m.docId)}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>V {m.valence.toFixed(2)}</span>
            <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>A {m.arousal.toFixed(2)}</span>
            <span className="chip" style={{ padding: '2px 9px', fontSize: '0.64rem', cursor: 'default' }}>I {m.importance.toFixed(2)}</span>
          </div>
        </GlassCard>
      ))}

      <SectionTitle en="Auto Memory" cn="AI 认知档案" />
      <p className="hint">每个 AI 独立维护的认知档案（六分类、always / normal / low 三级优先），由 AI 自主创建更新，你可随时删除。</p>
      {auto.length === 0 && <Empty text="暂无 Auto Memory（对话中授权 TA 记忆后会出现）" />}
      {Object.entries(autoByAi).map(([aiName, list]) => (
        <GlassCard key={aiName}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            <Avatar glyph="✶" name={aiName} size={34} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{aiName}</div>
            <span className="muted" style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>{list.length} 条</span>
          </div>
          {list.map((a) => (
            <div key={a.docId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--line)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <span className="chip on" style={{ padding: '1px 8px', fontSize: '0.6rem', cursor: 'default' }}>{a.category}</span>
                  <span className="chip" style={{ padding: '1px 8px', fontSize: '0.6rem', cursor: 'default' }}>{a.priority}</span>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: '0.82rem', color: 'var(--tx2)' }}>{a.content}</div>
              </div>
              <button className="btn danger" style={{ flex: 'none', padding: '4px 10px', fontSize: '0.68rem', alignSelf: 'flex-start' }} onClick={() => delAuto(a.docId)}>
                ×
              </button>
            </div>
          ))}
        </GlassCard>
      ))}
    </div>
  );
}

// 预留：六分类选择器（Auto Memory 编辑可用）
export const MEMORY_CATEGORIES = CATEGORIES;
