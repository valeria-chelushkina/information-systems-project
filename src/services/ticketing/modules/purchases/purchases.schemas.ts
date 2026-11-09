import { z } from 'zod';

export const holdIdParamsSchema = z.object({
  id: z.uuid(),
});

export const orderIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createHoldSchema = z.object({
  tierId: z.uuid(),
  quantity: z.number().int().min(1).max(10),
  customerRef: z.uuid(),
});

export const purchaseSchema = z.object({
  holdId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(128),
  customerEmail: z.email(),
});

export const refundOrderSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateHoldInput = z.infer<typeof createHoldSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;
