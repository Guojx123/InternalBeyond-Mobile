import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { Slider } from '../../components/ui/Slider';
import { kvGet, kvSet } from '../../lib/db';

interface Scheme {
  accent: string;
  scale: number;
  blur: number;
}
const SLOTS = 4;

/**
 * 应用视觉设置。
 * 主色写 --acc-custom（tokens.css 中 :root 与 body.theme-infernal 均以 var(--acc-custom, 默认) 引用），
 * 亮 / 暗两套主题同时生效；置 null 移除自定义即回默认。
 * --ui-scale 为历史死代码，已移除；字号实际由 body.style.fontSize 承载。
 */
function applyVisual(accent: string | null, scale: number, blur: number) {
  const root = document.documentElement;
  if (accent) root.style.setProperty('--acc-custom', accent);
  else root.style.removeProperty('--acc-custom');
  root.style.setProperty('--ibBlur', `${blur}px`);
  document.body.style.fontSize = `${16 * scale}px`;
}

export default function VisualPage() {
  const [accent, setAccent] = useState('#2a6bb0');
  const [customOn, setCustomOn] = useState(false);
  const [scale, setScale] = useState(1);
  const [blur, setBlur] = useState(20);
  const [slots, setSlots] = useState<(Scheme | null)[]>([null, null, null, null]);

  useEffect(() => {
    (async () => {
      const a = await kvGet<string>('visual:accent');
      const on = await kvGet<boolean>('visual:customOn');
      const s = await kvGet<number>('visual:scale');
      const b = await kvGet<number>('visual:blur');
      const sl = await kvGet<(Scheme | null)[]>('visual:slots');
      if (a) setAccent(a);
      if (typeof on === 'boolean') setCustomOn(on);
      if (s) setScale(s);
      if (b) setBlur(b);
      if (sl) setSlots(sl);
      applyVisual(on && a ? a : null, s || 1, b || 20);
    })();
  }, []);

  function change(next: Partial<{ accent: string; scale: number; blur: number }>) {
    const a = next.accent ?? accent;
    const s = next.scale ?? scale;
    const b = next.blur ?? blur;
    setAccent(a);
    setScale(s);
    setBlur(b);
    applyVisual(customOn ? a : null, s, b);
    kvSet('visual:accent', a);
    kvSet('visual:scale', s);
    kvSet('visual:blur', b);
  }

  async function toggleCustom(v: boolean) {
    setCustomOn(v);
    await kvSet('visual:customOn', v);
    applyVisual(v ? accent : null, scale, blur);
  }

  async function saveSlot(i: number) {
    const next = [...slots];
    next[i] = { accent, scale, blur };
    setSlots(next);
    await kvSet('visual:slots', next);
  }

  async function loadSlot(i: number) {
    const s = slots[i];
    if (!s) return;
    setCustomOn(true);
    await kvSet('visual:customOn', true);
    setAccent(s.accent);
    setScale(s.scale);
    setBlur(s.blur);
    applyVisual(s.accent, s.scale, s.blur);
    kvSet('visual:accent', s.accent);
    kvSet('visual:scale', s.scale);
    kvSet('visual:blur', s.blur);
  }

  return (
    <div className="page">
      <SectionTitle en="Visual" cn="视觉个性化" />
      <p className="hint">全站色调整套更换与方案槽（手机端偏好独立，不进备份）。修改即时生效；暗色主题同样使用自定义主色。</p>

      <GlassCard>
        <div className="set-card" style={{ margin: 0 }}>
          <div className="sc-t">Accent · 主色</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input type="color" value={accent} onChange={(e) => change({ accent: e.target.value })} />
            <span style={{ fontFamily: 'var(--monoP)', fontSize: '0.78rem', color: 'var(--tx2)' }}>{accent}</span>
          </div>
        </div>

        <div className="set-card" style={{ margin: '12px 0 0' }}>
          <div className="sc-t">Type Scale · 字号</div>
          <Slider min={0.85} max={1.25} step={0.01} value={scale} onChange={(v) => change({ scale: v })} format={(v) => `${v.toFixed(2)}×`} />
        </div>

        <div className="set-card" style={{ margin: '12px 0 0' }}>
          <div className="sc-t">Glass Blur · 玻璃模糊</div>
          <Slider min={6} max={36} step={1} value={blur} onChange={(v) => change({ blur: v })} format={(v) => `${v}px`} />
        </div>

        {/* 预览块（此前因 --soft 缺失而透明，现已修复） */}
        <div style={{ marginTop: 12, padding: 10, borderRadius: 12, background: 'var(--soft)', color: 'var(--tx)', border: '1px solid var(--line)' }}>
          预览文字 · <span style={{ color: 'var(--acc)' }}>主题色样例</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          {customOn ? (
            <button className="btn" onClick={() => toggleCustom(false)}>恢复默认主色</button>
          ) : (
            <button className="btn primary" onClick={() => toggleCustom(true)}>启用自定义主色</button>
          )}
        </div>
      </GlassCard>

      <SectionTitle en="Scheme Slots" cn="方案槽（4）" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {Array.from({ length: SLOTS }).map((_, i) => (
          <GlassCard key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.8rem' }}>槽 {i + 1}</div>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                margin: '0 auto 10px',
                background: slots[i]?.accent || 'var(--line)',
                border: '1px solid var(--glass-line)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn primary" style={{ padding: '5px 0' }} onClick={() => saveSlot(i)}>存</button>
              <button className="btn" style={{ padding: '5px 0' }} disabled={!slots[i]} onClick={() => loadSlot(i)}>用</button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
