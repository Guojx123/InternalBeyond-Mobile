import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { Toggle } from '../../components/ui/Toggle';
import { Input } from '../../components/ui/Input';
import { Chip } from '../../components/ui/Chip';
import { toast } from '../../components/ui/Toast';
import { PatternPad, seqToPattern, lockModeOf } from '../../components/ui/PatternPad';
import { kvGet, kvSet } from '../../lib/db';

/** 壁纸：纯色 + 渐变，供锁屏 .lk-wall 使用 */
const WALLS = [
  { v: '#eef2f8', name: '晨雾' },
  { v: '#141a2e', name: '墨夜' },
  { v: 'linear-gradient(172deg, #2b4570 0%, #16223f 44%, #0a0f1e 100%)', name: '深海' },
  { v: 'linear-gradient(160deg, #f3e7e0, #e8d3c8)', name: '陶土' },
  { v: 'linear-gradient(165deg, #e6f0ea, #cfe4d8)', name: '青瓷' },
  { v: 'linear-gradient(155deg, #f0e6f3, #d8c8e8)', name: '暮紫' },
];

type LockMode = 'pattern' | 'pin';

export default function LockPage() {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<LockMode>('pattern');
  const [pass, setPass] = useState('');
  const [wall, setWall] = useState('#eef2f8');
  const [qaQ, setQaQ] = useState('');
  const [qaA, setQaA] = useState('');
  const [padErr, setPadErr] = useState(false);

  useEffect(() => {
    kvGet<boolean>('lockOn').then((v) => v && setOn(true));
    kvGet<string>('lockWall').then((w) => w && setWall(w));
    kvGet<{ q: string; a: string }>('lockQA').then((q) => q && (setQaQ(q.q), setQaA(q.a)));
    kvGet<string>('lockPass').then((p) => {
      if (!p) return;
      setPass(p);
      setMode(lockModeOf(p));
    });
  }, []);

  async function toggle(v: boolean) {
    setOn(v);
    await kvSet('lockOn', v);
  }

  /** 图案盘抬手：两次输入一致才落盘 */
  function onPatternDraw(seq: number[]) {
    const pattern = seqToPattern(seq);
    if (pattern.length < 7) {
      setPadErr(true);
      window.setTimeout(() => setPadErr(false), 460);
      return toast('图案至少要连 4 个点');
    }
    if (!pass) {
      // 第一次绘制：先暂存，等待确认
      setPass(pattern);
      setMode('pattern');
      return toast('请再画一次以确认图案');
    }
    if (pass === pattern) {
      kvSet('lockPass', pattern);
      kvSet('lockMode', 'pattern');
      toast('图案锁已保存（仅本机）');
    } else {
      setPass('');
      setPadErr(true);
      window.setTimeout(() => setPadErr(false), 460);
      toast('两次图案不一致，已重置');
    }
  }

  async function savePin() {
    if (pass.length < 4) return toast('密码至少 4 位');
    await kvSet('lockPass', pass);
    await kvSet('lockMode', 'pin');
    toast('数字密码已保存（仅本机）');
  }

  function switchMode(m: LockMode) {
    setMode(m);
    setPass('');
  }

  async function saveQA() {
    if (!qaQ.trim() || !qaA.trim()) return toast('问题与答案都要填');
    await kvSet('lockQA', { q: qaQ.trim(), a: qaA.trim() });
    toast('密保已保存（仅本机）');
  }

  function pickWall(w: string) {
    setWall(w);
    kvSet('lockWall', w);
  }

  return (
    <div className="page">
      <SectionTitle en="Lock" cn="锁屏" />
      <p className="hint">iOS 式锁屏配置（本机专属，电脑端不读不写——它防的是顺手翻看，不能替代设备锁）。</p>

      <GlassCard>
        <Toggle
          on={on}
          onChange={toggle}
          title="启用锁屏"
          sub="启动时先进入锁屏，滑动或绘制图案解锁"
        />
      </GlassCard>

      <GlassCard>
        <SectionTitle en="Passcode" cn="图案 / 密码" />
        <div className="chips" style={{ marginBottom: 14 }}>
          <Chip on={mode === 'pattern'} onClick={() => switchMode('pattern')}>图案锁</Chip>
          <Chip on={mode === 'pin'} onClick={() => switchMode('pin')}>数字锁</Chip>
        </div>

        {mode === 'pattern' ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
              <PatternPad size={196} onComplete={onPatternDraw} error={padErr} minNodes={1} />
            </div>
            <div className="hint" style={{ textAlign: 'center' }}>
              {pass
                ? '已记录第一次图案 —— 请再画一次以确认'
                : '在盘上滑动连线（≥4 个点），绘制你的解锁图案'}
            </div>
          </>
        ) : (
          <>
            <Input
              type="password"
              inputMode="numeric"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="设置 4 位以上数字密码"
            />
            <button className="btn primary" style={{ marginTop: 10 }} onClick={savePin}>
              保存密码
            </button>
          </>
        )}
        <div className="hint">忘记密码可通过密保问答解锁。旧版数字密码仍可正常解锁。</div>
      </GlassCard>

      <GlassCard>
        <SectionTitle en="Recovery" cn="密保问答" />
        <div className="field">
          <Input value={qaQ} onChange={(e) => setQaQ(e.target.value)} placeholder="密保问题（如：我们的纪念日）" />
        </div>
        <div className="field">
          <Input value={qaA} onChange={(e) => setQaA(e.target.value)} placeholder="密保答案" />
        </div>
        <button className="btn primary" onClick={saveQA}>保存密保</button>
      </GlassCard>

      <SectionTitle en="Wallpaper" cn="壁纸" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {WALLS.map((w) => (
          <div
            key={w.v}
            onClick={() => pickWall(w.v)}
            className="glass"
            title={w.name}
            style={{
              height: 70,
              borderRadius: 14,
              background: w.v,
              cursor: 'pointer',
              border: w.v === wall ? '2px solid var(--acc)' : '1px solid var(--line)',
              boxShadow: w.v === wall ? '0 0 0 3px color-mix(in srgb, var(--acc) 24%, transparent)' : undefined,
            }}
          />
        ))}
      </div>
      <p className="hint">当前：{WALLS.find((w) => w.v === wall)?.name || '自定义'}</p>
    </div>
  );
}
