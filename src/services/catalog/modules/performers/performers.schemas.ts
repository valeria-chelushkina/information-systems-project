import { z } from 'zod';

export const performerIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createPerformerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  genre: z.string().trim().min(1).max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  contactEmail: z.email().optional(),
});

export const updatePerformerSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    genre: z.string().trim().min(1).max(80).nullable().optional(),
    bio: z.string().trim().max(2000).nullable().optional(),
    contactEmail: z.email().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listPerformersQuerySchema = z.object({
  search: z.string().trim().max(160).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreatePerformerInput = z.infer<typeof createPerformerSchema>;
export type UpdatePerformerInput = z.infer<typeof updatePerformerSchema>;
export type ListPerformersQuery = z.infer<typeof listPerformersQuerySchema>;
