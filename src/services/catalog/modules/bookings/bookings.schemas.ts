import { z } from 'zod';
import { BOOKING_STATUSES } from '@/services/catalog/typedefs/booking.typedefs.js';

const dateSchema = z.coerce.date();

export const bookingIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createBookingSchema = z.object({
  performerId: z.uuid(),
  venueId: z.uuid(),
  startsAt: dateSchema,
  endsAt: dateSchema,
  requestedBy: z.uuid().optional(),
  note: z.string().trim().max(500).optional(),
});

export const decideBookingSchema = z.object({
  status: z.enum(['confirmed', 'rejected']),
  decidedBy: z.uuid().optional(),
});

export const listBookingsQuerySchema = z.object({
  venueId: z.uuid().optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type DecideBookingInput = z.infer<typeof decideBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
