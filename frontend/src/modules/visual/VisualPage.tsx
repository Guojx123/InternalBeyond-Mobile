import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { kvGet, kvSet } from '../../lib/db';

interface Scheme {
  accent: string;
  scale: number;
}
const SLOTS = 4;

function applyVisual(accent: string, scale: number) {
  const root = document.documentElement;
  root.style.setProperty('--acc', accent);
  root.style.setProperty('--ui-scale', String(scale));
  document.body.style.fontSize = `${16 * scale}px`;
}

export default function VisualPage() {
  const [accent, setAccent] = useState('#2a6bb0');
  const [scale, setScale] = useState(1);
  const [slots, setSlots] = useState<(Scheme | null)[]>([null, null, null, null]);

  useEffect(() => {
    kvGet<string>('visual:accent').then((a) => a && setAccent(a));
    kvGet<number>('visual:scale').then((s) => s && setScale(s));
    kvGet<(Scheme | null)[]>('visual:slots').then((s) => s && setSlots(s));
  }, []);

  function change(accent: string, scale: number) {
    setAccent(accent);
    setScale(scale);
    applyVisual(accent, scale);
    kvSet('visual:accent', accent);
    kvSet('visual:scale', scale);
  }

  async function saveSlot(i: number) {
    const next = [...slots];
    next[i] = { accent, scale };
    setSlots(next);
    await kvSet('visual:slots', next);
  }
  async function loadSlot(i: number) {
    const s = slots[i];
    if (s) change(s.accent, s.scale);
  }

  return (
    <div className="page">
      <SectionTitle en="Visual" cn="视觉个性化" />
      <p className="hint">全站色调整套更换与方案槽（手机端偏好独立，不进备份）。修改即时生效。</p>

      <GlassCard>
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--tx3)', marginBottom: 8 }}>全站主色 Accent</div>
        <input type="color" value={accent} onChange={(e) => change(e.target.value, scale)} style={{ width: 60, height: 36, border: 'none', background: 'transparent' }} />
        <div style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: 'var(--tx3)', margin: '14px 0 8px' }}>字号缩放 {scale.toFixed(2)}×</div>
        <input type="range" min={0.85} max={1.25} step={0.01} value={scale} onChange={(e) => change(accent, parseFloat(e.target.value))} style={{ width: '100%' }} />
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--soft)', color: 'var(--tx)' }}>
          预览文字 · <span style={{ color: 'var(--acc)' }}>主题色样例</span>
        </div>
      </GlassCard>

      <SectionTitle en="Scheme Slots" cn="方案槽（4）" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {Array.from({ length: SLOTS }).map((_, i) => (
          <GlassCard key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>槽 {i + 1}</div>
            <div style={{ width: 36, height: 36, borderRadius: '50%', margin: '0 auto 10px', background: slots[i]?.accent || 'var(--line)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn primary" onClick={() => saveSlot(i)}>存</button>
              <button className="btn" disabled={!slots[i]} onClick={() => loadSlot(i)}>用</button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
