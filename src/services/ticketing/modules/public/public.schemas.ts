import { z } from 'zod';

export const publicEventIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listPublicEventsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  performerId: z.uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPublicEventsQuery = z.infer<typeof listPublicEventsQuerySchema>;
