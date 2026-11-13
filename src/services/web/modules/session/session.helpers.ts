import type { SessionUser } from '@/services/web/typedefs/api.typedefs.js';

export function isStaff(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'staff';
}

export function canSeeOrder(user: SessionUser, customerRef: string): boolean {
  return isStaff(user) || customerRef === user.userId;
}
