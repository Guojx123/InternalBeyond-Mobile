import { useEffect, useState } from 'react';

interface ToastItem {
  id: number;
  text: string;
  ms: number;
}

let seq = 0;
let queue: ToastItem[] = [];
const subs = new Set<() => void>();

function notify() {
  subs.forEach((f) => f());
}

/**
 * 以玻璃胶囊提示替代 window.alert()。
 * 可在任何位置（含非组件代码）直接调用。
 */
export function toast(text: string, ms = 2200) {
  queue = [...queue, { id: ++seq, text, ms }];
  notify();
}

/** 挂载一次（建议放在 App 根）即可全局使用 toast() */
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(queue);

  useEffect(() => {
    const sync = () => setItems([...queue]);
    subs.add(sync);
    return () => {
      subs.delete(sync);
    };
  }, []);

  // 逐条到期后出队
  useEffect(() => {
    if (!items.length) return;
    const head = items[0];
    const t = window.setTimeout(() => {
      queue = queue.filter((i) => i.id !== head.id);
      notify();
    }, head.ms);
    return () => window.clearTimeout(t);
  }, [items]);

  if (!items.length) return null;
  const head = items[0];

  return (
    <div className="toast show" role="status" aria-live="polite" key={head.id}>
      {head.text}
    </div>
  );
}
