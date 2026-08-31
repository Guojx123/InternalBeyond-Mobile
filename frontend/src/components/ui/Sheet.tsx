import { ReactNode, useEffect, useState } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** 顶部小标题（参考 .sheet h3，全大写居中） */
  title?: string;
  children?: ReactNode;
}

/** 底部玻璃抽屉（参考 .sheet）—— 用于转发、选择、短表单等弹层 */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div className={`ib-scrim${shown ? ' show' : ''}`} onClick={onClose} aria-hidden />
      <div className={`sheet${shown ? ' open' : ''}`} role="dialog" aria-modal="true">
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </>
  );
}
