import { Icon } from '@/components/Icon';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      className="icon-btn theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
