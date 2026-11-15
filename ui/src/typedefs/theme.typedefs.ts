export type Theme = 'light' | 'dark';

export interface ThemeValue {
  theme: Theme;
  toggle: () => void;
}
