import { ReactNode, CSSProperties } from 'react';

export function GlassCard({ children, className = '', onClick, style }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div className={`glass card ${className}`} onClick={onClick} style={{ ...(onClick ? { cursor: 'pointer' } : {}), ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ en, cn }: { en: string; cn?: string }) {
  return (
    <div className="plate-title">
      {en}
      {cn && <span className="cn">{cn}</span>}
    </div>
  );
}

export function Empty({ text = '暂无内容' }: { text?: string }) {
  return <div className="empty">{text}</div>;
}

export function Loading({ text = '加载中…' }: { text?: string }) {
  return <div className="muted" style={{ padding: 16, textAlign: 'center' }}>{text}</div>;
}
