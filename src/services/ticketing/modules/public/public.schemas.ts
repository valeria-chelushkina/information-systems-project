import { z } from 'zod';

export const publicEventIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listPublicEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListPublicEventsQuery = z.infer<typeof listPublicEventsQuerySchema>;
