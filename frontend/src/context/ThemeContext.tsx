import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { kvGet, kvSet } from '../lib/db';

type Theme = 'internal' | 'infernal';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('internal');
  // 首次渲染不回写：否则挂载即把默认值写入 kv，会覆盖尚未读出的持久化主题（竞态导致刷新后偶发丢主题）
  const firstRun = useRef(true);

  useEffect(() => {
    kvGet<Theme>('theme').then((t) => {
      if (t === 'internal' || t === 'infernal') setTheme(t);
    });
    apply(theme);
  }, []);

  useEffect(() => {
    apply(theme);
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    kvSet('theme', theme);
  }, [theme]);

  function apply(t: Theme) {
    // 明亮态由 :root 默认承载，仅暗色需要 theme-infernal（无 CSS 消费 theme-internal，已移除）
    document.body.classList.toggle('theme-infernal', t === 'infernal');
    const meta = document.getElementById('meta-theme-color') as HTMLMetaElement | null;
    if (meta) meta.setAttribute('content', t === 'infernal' ? '#141a2e' : '#dfe9f6');
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme((p) => (p === 'internal' ? 'infernal' : 'internal')), set: setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}
