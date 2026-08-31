import { ReactNode, useEffect, useState } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: ReactNode;
  /** 底部按钮组 */
  footer?: ReactNode;
  /** 宽版（阅读视图 / 写信等） */
  wide?: boolean;
}

/** 居中玻璃对话框（参考 #dlg）—— 用于读信、阅读视图、确认等弹层 */
export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), 220);
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
      <div
        className={`dlg${shown ? ' show' : ''}${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        style={wide ? { transition: 'opacity 0.24s, transform 0.24s' } : undefined}
      >
        {title && <div className="dlg-title">{title}</div>}
        {children}
        {footer && <div className="dlg-btns">{footer}</div>}
      </div>
    </>
  );
}

/* ============================================================================
   全局确认框（替换 window.confirm）
   ========================================================================== */

export interface ConfirmOpts {
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface PendingConfirm {
  msg: string;
  opts: ConfirmOpts;
  resolve: (v: boolean) => void;
}

let pending: PendingConfirm | null = null;
const subs = new Set<() => void>();

function notifySubs() {
  subs.forEach((f) => f());
}

function settle(v: boolean) {
  if (!pending) return;
  const p = pending;
  pending = null;
  notifySubs();
  p.resolve(v);
}

/** Promise 化确认框，可在任何位置调用：`if (await askConfirm('删除？')) {...}` */
export function askConfirm(msg: string, opts: ConfirmOpts = {}): Promise<boolean> {
  return new Promise((resolve) => {
    pending = { msg, opts, resolve };
    notifySubs();
  });
}

/** 挂载一次（建议放在 App 根）即可全局使用 askConfirm() */
export function ConfirmHost() {
  const [cur, setCur] = useState<PendingConfirm | null>(pending);

  useEffect(() => {
    const sync = () => setCur(pending ? { ...pending } : null);
    subs.add(sync);
    return () => {
      subs.delete(sync);
    };
  }, []);

  return (
    <Modal
      open={!!cur}
      onClose={() => settle(false)}
      footer={
        cur && (
          <>
            <button className="btn" onClick={() => settle(false)}>
              {cur.opts.cancelText || '取消'}
            </button>
            <button
              className={`btn ${cur.opts.danger ? 'danger' : 'primary'}`}
              onClick={() => settle(true)}
            >
              {cur.opts.okText || '确定'}
            </button>
          </>
        )
      }
    >
      <div className="dlg-msg">{cur?.msg}</div>
    </Modal>
  );
}

export default Modal;
