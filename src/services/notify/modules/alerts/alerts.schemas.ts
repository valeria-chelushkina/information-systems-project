import { z } from 'zod';

export const alertSchema = z.object({
  status: z.enum(['firing', 'resolved']),
  labels: z.record(z.string(), z.string()),
  annotations: z.record(z.string(), z.string()).default({}),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export const notificationSchema = z.object({
  alerts: z.array(alertSchema),
});
