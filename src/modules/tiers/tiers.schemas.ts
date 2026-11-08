import { z } from 'zod';

const nameSchema = z.string().trim().min(1).max(100);
const priceSchema = z.number().int().nonnegative();
const numberSchema = z.number().int().positive();

export const eventIdParamsSchema = z.object({
  eventId: z.uuid(),
});

export const tierIdParamsSchema = z.object({
  tierId: z.uuid(),
});

export const createTierSchema = z.object({
  name: nameSchema,
  priceCents: priceSchema,
  totalQty: numberSchema,
});

export const updateTierSchema = z
  .object({
    name: nameSchema.optional(),
    priceCents: priceSchema.optional(),
    totalQty: numberSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type CreateTierInput = z.infer<typeof createTierSchema>;
export type UpdateTierInput = z.infer<typeof updateTierSchema>;
