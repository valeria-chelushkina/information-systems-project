import { z } from 'zod';

export const ticketCheckInSchema = z.object({
  qrToken: z.string().trim().min(6).max(64),
});

export type TicketCheckInInput = z.infer<typeof ticketCheckInSchema>;
