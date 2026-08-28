import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  useEffect(() => {
    kvGet<Theme>('theme').then((t) => {
      if (t === 'internal' || t === 'infernal') setTheme(t);
    });
    apply(theme);
  }, []);

  useEffect(() => {
    apply(theme);
    kvSet('theme', theme);
  }, [theme]);

  function apply(t: Theme) {
    document.body.classList.toggle('theme-infernal', t === 'infernal');
    document.body.classList.toggle('theme-internal', t === 'internal');
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
