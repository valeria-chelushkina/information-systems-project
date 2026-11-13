import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.uuid(),
});

export const loginSchema = z.object({
  email: z.string().trim().min(3).max(200),
  password: z.string().min(1).max(200),
});

export const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
});

export const publicEventsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  performerId: z.uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(24).default(6),
  offset: z.coerce.number().int().min(0).default(0),
});

export const purchaseSchema = z.object({
  tierId: z.uuid(),
  quantity: z.number().int().min(1).max(10),
});

export const eventCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  performerId: z.uuid(),
  venueId: z.uuid(),
  startsAt: z.string().trim().min(16).max(16),
  doorsAt: z.string().trim().max(16).optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
});

export const eventStatusSchema = z.object({
  status: z.enum(['draft', 'scheduled', 'on_sale', 'sold_out', 'completed', 'cancelled']),
});

export const tierCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceCents: z.number().int().nonnegative().max(10_000_000),
  totalQty: z.number().int().positive().max(100_000),
});

export const tierUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  priceCents: z.number().int().nonnegative().max(10_000_000),
  totalQty: z.number().int().positive().max(100_000),
});

export const performerCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  genre: z.string().trim().min(1).max(80).optional(),
  contactEmail: z.email().optional(),
});

export const venueCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64).default('Europe/Kyiv'),
  capacity: z.number().int().positive().max(1_000_000),
});

export const bookingDecisionSchema = z.object({
  status: z.enum(['confirmed', 'rejected']),
});

export const accountCreateSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(200),
  role: z.enum(['customer', 'staff', 'admin']).default('customer'),
});

export const adminEventListQuerySchema = z.object({
  status: z
    .enum(['draft', 'scheduled', 'on_sale', 'sold_out', 'completed', 'cancelled'])
    .optional(),
  search: z.string().trim().max(200).optional(),
  performerId: z.uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const bookingListQuerySchema = z.object({
  status: z.enum(['requested', 'confirmed', 'rejected', 'cancelled']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type EventCreateInput = z.infer<typeof eventCreateSchema>;
export type TierCreateInput = z.infer<typeof tierCreateSchema>;
export type PerformerCreateInput = z.infer<typeof performerCreateSchema>;
export type VenueCreateInput = z.infer<typeof venueCreateSchema>;
export type AccountCreateInput = z.infer<typeof accountCreateSchema>;
