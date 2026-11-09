import { z } from 'zod';

export const purchaseCompletedSchema = z.object({
  id: z.string().uuid(),
  type: z.literal('purchase.completed'),
  occurredAt: z.string(),
  orderId: z.string().uuid(),
  showId: z.string().uuid(),
  tierId: z.string().uuid(),
  quantity: z.number().int().positive(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().min(1),
  customerEmail: z.string().email(),
  ticketIds: z.array(z.string().uuid()).min(1),
});
