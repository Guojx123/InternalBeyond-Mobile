import { useEffect, useState } from 'react';
import { GlassCard, SectionTitle } from '../../components/GlassCard';
import { kvGet, kvSet } from '../../lib/db';

const WALLS = ['#eef2f8', '#141a2e', '#f3e7e0', '#e6f0ea', '#f0e6f3', '#1a2330'];

export default function LockPage() {
  const [on, setOn] = useState(false);
  const [pass, setPass] = useState('');
  const [wall, setWall] = useState('#eef2f8');
  const [qaQ, setQaQ] = useState('');
  const [qaA, setQaA] = useState('');

  useEffect(() => {
    kvGet<boolean>('lockOn').then((v) => v && setOn(true));
    kvGet<string>('lockWall').then((w) => w && setWall(w));
    kvGet<{ q: string; a: string }>('lockQA').then((q) => q && (setQaQ(q.q), setQaA(q.a)));
  }, []);

  async function toggle(v: boolean) {
    setOn(v);
    await kvSet('lockOn', v);
  }
  async function savePass() {
    if (pass.length < 4) return alert('密码至少 4 位');
    await kvSet('lockPass', pass);
    alert('锁屏密码已保存（仅本机）');
  }
  async function saveQA() {
    if (!qaQ.trim() || !qaA.trim()) return alert('问题与答案都要填');
    await kvSet('lockQA', { q: qaQ.trim(), a: qaA.trim() });
    alert('密保已保存（仅本机）');
  }
  function pickWall(w: string) {
    setWall(w);
    kvSet('lockWall', w);
  }

  return (
    <div className="page">
      <SectionTitle en="Lock" cn="锁屏" />
      <p className="hint">iOS 式指滑锁屏配置（本机专属，电脑端不读不写——它防的是顺手翻看，不能替代设备锁）。</p>

      <GlassCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>启用锁屏</div>
            <div className="muted">启动先进锁屏</div>
          </div>
          <button className={on ? 'btn primary' : 'btn'} onClick={() => toggle(!on)}>{on ? '已开启' : '已关闭'}</button>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle en="Passcode" cn="图案 / 密码" />
        <input type="password" inputMode="numeric" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="设置 4 位以上密码" className="fld" />
        <button className="btn primary" style={{ marginTop: 10 }} onClick={savePass}>保存密码</button>
        <div className="hint">忘记密码可通过密保问答重置。</div>
      </GlassCard>

      <GlassCard>
        <SectionTitle en="Recovery" cn="密保问答" />
        <input className="fld" value={qaQ} onChange={(e) => setQaQ(e.target.value)} placeholder="密保问题（如：我们的纪念日）" />
        <input className="fld" style={{ marginTop: 8 }} value={qaA} onChange={(e) => setQaA(e.target.value)} placeholder="密保答案" />
        <button className="btn primary" style={{ marginTop: 10 }} onClick={saveQA}>保存密保</button>
      </GlassCard>

      <SectionTitle en="Wallpaper" cn="壁纸" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {WALLS.map((w) => (
          <div
            key={w}
            onClick={() => pickWall(w)}
            className="glass"
            style={{ height: 70, borderRadius: 14, background: w, cursor: 'pointer', border: w === wall ? '2px solid var(--acc)' : '1px solid var(--line)' }}
          />
        ))}
      </div>
    </div>
  );
}
