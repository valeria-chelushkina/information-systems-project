import type { SessionUser } from '@/typedefs/auth.typedefs';

export function initials(email: string): string {
  return email.slice(0, 1).toUpperCase();
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'staff';
}
