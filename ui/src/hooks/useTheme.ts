import { useContext } from 'react';
import { ThemeContext } from '@/context/ThemeContext';
import type { ThemeValue } from '@/typedefs/theme.typedefs';

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }

  return context;
}
