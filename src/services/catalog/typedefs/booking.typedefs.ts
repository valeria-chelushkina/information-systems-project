import type { bookingRequests } from '@/services/catalog/db/schema/index.js';

export const BOOKING_STATUSES = ['requested', 'confirmed', 'rejected', 'cancelled'] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingRow = typeof bookingRequests.$inferSelect;
export type NewBookingRow = typeof bookingRequests.$inferInsert;

export interface BookingFilters {
  venueId?: string;
  status?: BookingStatus;
  limit: number;
  offset: number;
}
