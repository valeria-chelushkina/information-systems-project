import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { THEME_COLORS, THEME_STORAGE_KEY } from '@/constants/theme.constants';
import type { Theme, ThemeValue } from '@/typedefs/theme.typedefs';
import type { ChildrenProps } from '@/typedefs/ui.typedefs';

export const ThemeContext = createContext<ThemeValue | null>(null);

function initialTheme(): Theme {
  if (typeof document === 'undefined') {
    return 'dark';
  }

  const fromDocument = document.documentElement.dataset.theme;

  if (fromDocument === 'light' || fromDocument === 'dark') {
    return fromDocument;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function ThemeProvider({ children }: ChildrenProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    const meta = document.querySelector('meta[name="theme-color"]');

    if (meta) {
      meta.setAttribute('content', THEME_COLORS[theme]);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((value) => (value === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo<ThemeValue>(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
