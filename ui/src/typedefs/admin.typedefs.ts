import type { Booking } from '@/typedefs/bookings.typedefs';
import type { EventRecord, EventStatus, Tier } from '@/typedefs/catalog.typedefs';
import type { UserRole } from '@/typedefs/auth.typedefs';

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Dashboard {
  counts: {
    events: number;
    onSale: number;
    bookings: number;
    performers: number;
    venues: number;
    users: number;
  };
  recentEvents: EventRecord[];
  health: { auth: boolean; ticketing: boolean; catalog: boolean };
}

export interface EventsPage {
  items: EventRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface EventDetail {
  event: EventRecord;
  tiers: Tier[];
  transitions: EventStatus[];
}

export interface BookingsPage {
  bookings: Booking[];
  performerNames: Record<string, string>;
  venueNames: Record<string, string>;
  total: number;
  limit: number;
  offset: number;
}

export type TeamRole = 'staff' | 'admin';
