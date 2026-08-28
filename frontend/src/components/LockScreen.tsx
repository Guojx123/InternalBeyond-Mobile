import { useEffect, useState } from 'react';
import { kvGet } from '../lib/db';

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [wall, setWall] = useState('#eef2f8');
  const [err, setErr] = useState('');
  const [recover, setRecover] = useState(false);
  const [qa, setQa] = useState<{ q: string; a: string }>({ q: '', a: '' });
  const [ans, setAns] = useState('');

  useEffect(() => {
    kvGet<string>('lockWall').then((w) => w && setWall(w));
    kvGet<{ q: string; a: string }>('lockQA').then((q) => q && setQa(q));
  }, []);

  async function tryUnlock() {
    const pass = await kvGet<string>('lockPass');
    if (code === pass) onUnlock();
    else {
      setErr('密码错误');
      setCode('');
    }
  }

  function tryRecover() {
    if (ans.trim() && ans.trim() === qa.a) onUnlock();
    else setErr('答案不对');
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 4001,
        background: wall,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        transition: 'opacity .4s',
      }}
    >
      <div style={{ fontSize: '2.4rem', fontFamily: 'var(--serif)', color: 'var(--tx)' }}>InternalBeyond</div>
      <div style={{ fontSize: '0.8rem', color: 'var(--tx3)' }}>上滑解锁 · 输入密码</div>

      {!recover ? (
        <>
          <input
            type="password"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
            placeholder="••••"
            style={{ fontSize: '1.4rem', textAlign: 'center', letterSpacing: '0.4em', width: 160 }}
          />
          {err && <div style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>{err}</div>}
          <button className="btn primary" onClick={tryUnlock}>解锁</button>
          {qa.q && (
            <button className="btn" style={{ fontSize: '0.72rem' }} onClick={() => { setErr(''); setRecover(true); }}>
              忘记密码？
            </button>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: '0.86rem', color: 'var(--tx2)', textAlign: 'center', maxWidth: 280 }}>{qa.q}</div>
          <input
            value={ans}
            onChange={(e) => setAns(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryRecover()}
            placeholder="密保答案"
            style={{ fontSize: '1rem', textAlign: 'center', width: 220 }}
          />
          {err && <div style={{ color: 'var(--danger)', fontSize: '0.78rem' }}>{err}</div>}
          <button className="btn primary" onClick={tryRecover}>验证</button>
          <button className="btn" style={{ fontSize: '0.72rem' }} onClick={() => { setRecover(false); setErr(''); setAns(''); }}>返回</button>
        </>
      )}
    </div>
  );
}
