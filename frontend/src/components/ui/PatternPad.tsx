import { useCallback, useEffect, useRef, useState } from 'react';

const N = 3; // 3×3

function nodeCenter(i: number, size: number) {
  const cell = size / N;
  return { x: cell * ((i % N) + 0.5), y: cell * (Math.floor(i / N) + 0.5) };
}

interface PatternPadProps {
  /** 画布边长（px） */
  size?: number;
  /** 抬手时回调，返回按下的节点序号（0-8），例如 [0,1,4,7,8] */
  onComplete: (seq: number[]) => void;
  /** 置为 true 触发一次错误抖动并清空（父组件用 false→true 触发） */
  error?: boolean;
  /** 最少连接点数，不足则视为无效（默认 4） */
  minNodes?: number;
}

/**
 * 3×3 连线图案盘（LockScreen 解锁 与 LockPage 设置 复用同一份绘制逻辑）
 * 节点序号 0-8（左上→右下），对外统一转换为 1-9 的图案串。
 */
export function PatternPad({ size = 240, onComplete, error, minNodes = 4 }: PatternPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef<number[]>([]);
  const curRef = useRef<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);
  const [shaking, setShaking] = useState(false);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== size * dpr) {
      cv.width = size * dpr;
      cv.height = size * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const styles = getComputedStyle(cv);
    const acc = styles.getPropertyValue('--acc').trim() || '#72a8d8';
    const cell = size / N;
    const r = cell * 0.13; // 节点圆半径
    const hit = cell * 0.42;

    // 已连成的折线
    const seq = seqRef.current;
    if (seq.length) {
      ctx.beginPath();
      seq.forEach((i, k) => {
        const p = nodeCenter(i, size);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      const tail = curRef.current;
      if (tail) ctx.lineTo(tail.x, tail.y);
      ctx.strokeStyle = acc;
      ctx.lineWidth = Math.max(2, cell * 0.055);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 9 个节点
    for (let i = 0; i < N * N; i++) {
      const p = nodeCenter(i, size);
      const on = seq.includes(i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = acc;
      ctx.globalAlpha = on ? 0.9 : 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (on) {
        // 选中节点外圈光环
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 1.9, 0, Math.PI * 2);
        ctx.strokeStyle = acc;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = Math.max(1, cell * 0.02);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    void hit;
  }, [size]);

  useEffect(() => {
    draw();
  }, [draw]);

  // 错误抖动 + 清空
  useEffect(() => {
    if (!error) return;
    seqRef.current = [];
    curRef.current = null;
    draw();
    setShaking(true);
    const t = window.setTimeout(() => setShaking(false), 440);
    return () => window.clearTimeout(t);
  }, [error, draw]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function nearest(p: { x: number; y: number }): number {
    const cell = size / N;
    const hit = cell * 0.42;
    for (let i = 0; i < N * N; i++) {
      const c = nodeCenter(i, size);
      if (Math.hypot(c.x - p.x, c.y - p.y) <= hit) return i;
    }
    return -1;
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    seqRef.current = [];
    const p = pos(e);
    curRef.current = p;
    const i = nearest(p);
    if (i >= 0) seqRef.current = [i];
    draw();
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = pos(e);
    curRef.current = p;
    const i = nearest(p);
    if (i >= 0 && !seqRef.current.includes(i)) seqRef.current = [...seqRef.current, i];
    draw();
  }

  function onUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    curRef.current = null;
    const seq = [...seqRef.current];
    draw();
    if (seq.length >= minNodes) onComplete(seq);
    // 稍作停留让用户看清轨迹，再清空
    window.setTimeout(() => {
      seqRef.current = [];
      draw();
    }, 160);
  }

  return (
    <div ref={wrapRef} className={`lk-padwrap${shaking ? ' shake' : ''}`}>
      <canvas
        ref={canvasRef}
        className="lk-pad"
        style={{ width: size, height: size }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </div>
  );
}

/** 节点序号数组 → 图案串（0-8 转 1-9，短横连接），例如 [0,1,4,7,8] → "1-2-5-8-9" */
export function seqToPattern(seq: number[]): string {
  return seq.map((i) => i + 1).join('-');
}

/**
 * 判定 lockPass 的锁类型。
 * 约定：纯数字（≥4 位）视为老式数字锁，其余（含 '-'）视为图案串。
 */
export function lockModeOf(pass: string | null | undefined): 'pattern' | 'pin' {
  if (!pass) return 'pin';
  return /^\d{4,}$/.test(pass) ? 'pin' : 'pattern';
}
