import { z } from 'zod';

const purchaseEventDetailsSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  performerName: z.string().min(1),
  venueName: z.string().min(1),
  startsAt: z.string().min(1),
});

const purchaseEventTicketSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(8).max(128),
  tierName: z.string().min(1),
});

export const purchaseCompletedSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('purchase.completed'),
  occurredAt: z.string().min(1),
  orderId: z.string().uuid(),
  customerEmail: z.string().email(),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
  event: purchaseEventDetailsSchema,
  tickets: z.array(purchaseEventTicketSchema).min(1),
});

export const deliveryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
