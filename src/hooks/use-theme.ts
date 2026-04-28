import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
const STORAGE_KEY = 'cap-theme';

function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('light', t === 'light');
  root.classList.toggle('dark', t === 'dark');
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'light';
      setThemeState(stored);
      applyTheme(stored);
    } catch {
      applyTheme('light');
    }
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  };

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return { theme, setTheme, toggle };
}
