import { ReactNode } from 'react';

export function ThemeToggle() {
  return (
    <div className="theme-drop" id="theme-drop" onClick={() => window.dispatchEvent(new CustomEvent('ib-toggle-theme'))} title="切换主题">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M12 3c0 6-4 9-9 9a9 9 0 1 0 18 0c0-5-4-9-9-9z" />
      </svg>
    </div>
  );
}

export function TopBar({ title, left, right }: { title: ReactNode; left?: ReactNode; right?: ReactNode }) {
  return (
    <>
      <div id="top-veil" />
      <div id="topbar" className="glass">
        <div className="icon-btn" style={{ visibility: left ? 'visible' : 'hidden' }}>{left}</div>
        <div id="tb-title">{title}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {right}
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
