import { z } from 'zod';

export const reportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
