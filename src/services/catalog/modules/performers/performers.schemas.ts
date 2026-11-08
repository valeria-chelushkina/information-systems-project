import { z } from 'zod';

export const performerIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createPerformerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  genre: z.string().trim().min(1).max(80).optional(),
  contactEmail: z.email().optional(),
});

export const listPerformersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreatePerformerInput = z.infer<typeof createPerformerSchema>;
export type ListPerformersQuery = z.infer<typeof listPerformersQuerySchema>;
