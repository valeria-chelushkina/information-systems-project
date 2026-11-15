import { ICON_PATHS } from '@/constants/icons.constants';
import type { IconProps } from '@/typedefs/ui.typedefs';

export function Icon({ name, className = 'icon' }: IconProps) {
  const path = ICON_PATHS[name] ?? ICON_PATHS.spark;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}
