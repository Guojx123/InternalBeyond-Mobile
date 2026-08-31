import { useEffect, useRef, useState } from 'react';
import { kvGet } from '../lib/db';
import { PatternPad, lockModeOf, seqToPattern } from './ui/PatternPad';

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function wallStyle(wall: string) {
  const w = (wall || '').trim();
  if (!w) return undefined;
  if (w.startsWith('linear-gradient') || w.startsWith('radial-gradient') || w.startsWith('url(')) {
    return { background: w };
  }
  return { background: w };
}

/**
 * 锁屏（参考 #lockscr）
 * · 居中大字时钟 + 日期
 * · 上滑（横滑）解锁轨道 → 展开图案盘 / 数字密码
 * · 3×3 图案盘（lockPass 为图案串时）或数字输入（老式 ≥4 位数字锁）
 * · 密保找回保留
 */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pass, setPass] = useState<string>('');
  const [wall, setWall] = useState('#eef2f8');
  const [qa, setQa] = useState<{ q: string; a: string }>({ q: '', a: '' });
  const [padOpen, setPadOpen] = useState(false);
  const [sqOpen, setSqOpen] = useState(false);
  const [err, setErr] = useState(false);
  const [msg, setMsg] = useState('');
  const [pin, setPin] = useState('');
  const [ans, setAns] = useState('');
  const [out, setOut] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [drag, setDrag] = useState(0); // 0..1
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const mode = lockModeOf(pass);

  useEffect(() => {
    kvGet<string>('lockPass').then((p) => setPass(p || ''));
    kvGet<string>('lockWall').then((w) => w && setWall(w));
    kvGet<{ q: string; a: string }>('lockQA').then((q) => q && setQa(q));
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  function finish() {
    setOut(true);
    window.setTimeout(onUnlock, 520);
  }

  async function verify(value: string) {
    const stored = pass || (await kvGet<string>('lockPass')) || '';
    if (value === stored) {
      setMsg('');
      finish();
    } else {
      setErr(true);
      setMsg(mode === 'pattern' ? '图案不对，再试一次' : '密码错误');
    }
  }

  function onPattern(seq: number[]) {
    void verify(seqToPattern(seq));
  }

  function tryRecover() {
    if (ans.trim() && ans.trim() === qa.a) finish();
    else {
      setErr(false);
      setMsg('答案不对');
    }
  }

  /* ── 滑动解锁轨道 ── */
  function beginDrag(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    setDrag(0);
  }
  function moveDrag(e: React.PointerEvent) {
    if (!dragging.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, (e.clientX - rect.left - 24) / (rect.width - 56)));
    setDrag(p);
  }
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (drag > 0.82) {
      setPadOpen(true);
      setMsg('');
    }
    setDrag(0);
  }

  const trackStyle = { ['--lkp' as string]: String(drag) } as React.CSSProperties;
  const knobStyle = { transform: `translateX(${drag * (trackRef.current ? trackRef.current.clientWidth - 56 : 0)}px)` };

  const dateText = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEK[now.getDay()]}`;
  const timeText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div
      id="lockscr"
      className={`${out ? 'lk-out' : ''} ${padOpen ? 'lk-padmode' : ''} ${sqOpen ? 'lk-sqmode' : ''}`.trim()}
    >
      <div className="lk-wall" style={{ ...wallStyle(wall), backgroundSize: 'cover' }} />
      <div className="lk-scrim" />

      <div className="lk-top">
        <svg className="lk-lockic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <rect x="4" y="10" width="16" height="11" rx="3" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
        <div className="lk-wel">InternalBeyond</div>
      </div>

      <div className="lk-clk">
        <div id="lk-date">{dateText}</div>
        <div id="lk-time">{timeText}</div>
      </div>

      <div className="lk-act">
        <div className="lk-hint">SLIDE TO UNLOCK</div>
        <div className="lk-slide">
          <div
            ref={trackRef}
            className="lk-track"
            style={trackStyle}
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <span className="lk-shimmer"> slide to unlock </span>
            <div className="lk-knob" style={knobStyle}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h13M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="lk-home" onClick={() => setPadOpen(true)}>
        <div className="lk-hint2">{mode === 'pattern' ? '绘制图案解锁' : '输入密码解锁'}</div>
        <div className="lk-bar" />
      </div>

      {/* 图案 / 数字密码面板 */}
      <div className="lk-padpanel">
        <div className="lk-pp-t">{mode === 'pattern' ? '绘制解锁图案' : '输入数字密码'}</div>
        {mode === 'pattern' ? (
          <PatternPad size={228} onComplete={onPattern} error={err} />
        ) : (
          <input
            className="lk-sq-in"
            type="password"
            inputMode="numeric"
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void verify(pin);
            }}
            style={{ textAlign: 'center', letterSpacing: '0.4em' }}
          />
        )}
        {msg && <div style={{ color: '#ffb4b4', fontSize: '0.74rem' }}>{msg}</div>}
        <div className="lk-sq-btns" style={{ justifyContent: 'center' }}>
          {mode !== 'pattern' && (
            <button className="lk-btn pri" onClick={() => void verify(pin)}>
              解锁
            </button>
          )}
          {qa.q && (
            <button
              className="lk-btn"
              onClick={() => {
                setSqOpen(true);
                setPadOpen(false);
                setMsg('');
              }}
            >
              忘记密码？
            </button>
          )}
          <button
            className="lk-btn"
            onClick={() => {
              setPadOpen(false);
              setPin('');
              setMsg('');
            }}
          >
            收起
          </button>
        </div>
      </div>

      {/* 密保找回 */}
      <div className="lk-sq">
        <div className="lk-sq-t">SECURITY QUESTION</div>
        <div className="lk-sq-q">{qa.q}</div>
        <input
          className="lk-sq-in"
          value={ans}
          onChange={(e) => setAns(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && tryRecover()}
          placeholder="密保答案"
        />
        {msg && <div style={{ color: '#ffb4b4', fontSize: '0.74rem' }}>{msg}</div>}
        <div className="lk-sq-btns">
          <button
            className="lk-btn"
            onClick={() => {
              setSqOpen(false);
              setAns('');
              setMsg('');
            }}
          >
            返回
          </button>
          <button className="lk-btn pri" onClick={tryRecover}>
            验证
          </button>
        </div>
      </div>
    </div>
  );
}
