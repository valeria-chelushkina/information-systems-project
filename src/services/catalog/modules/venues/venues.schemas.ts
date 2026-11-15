import { z } from 'zod';

export const venueIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createVenueSchema = z.object({
  name: z.string().trim().min(1).max(160),
  city: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(64).default('UTC'),
  capacity: z.number().int().positive(),
});

export const updateVenueSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listVenuesQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
export type ListVenuesQuery = z.infer<typeof listVenuesQuerySchema>;
