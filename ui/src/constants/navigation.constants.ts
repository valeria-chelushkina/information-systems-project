import type { AdminNavItem, PublicNavItem } from '@/typedefs/navigation.typedefs';

export const PUBLIC_NAV_LINKS: PublicNavItem[] = [{ href: '/events', label: 'Events' }];

export const ADMIN_NAV_LINKS: AdminNavItem[] = [
  { to: '/admin', label: 'Overview', iconName: 'chart', end: true },
  { to: '/admin/events', label: 'Events', iconName: 'calendar' },
  { to: '/admin/performers', label: 'Performers', iconName: 'mic' },
  { to: '/admin/venues', label: 'Venues', iconName: 'pin' },
  { to: '/admin/bookings', label: 'Bookings', iconName: 'ticket' },
  { to: '/admin/orders', label: 'Orders', iconName: 'cart' },
];
