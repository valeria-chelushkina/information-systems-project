import { z } from 'zod';
import { EVENT_STATUSES } from '@/services/ticketing/typedefs/event.typedefs.js';

const eventStatusSchema = z.enum(EVENT_STATUSES);
const nameSchema = z.string().trim().min(1).max(200);
const dateSchema = z.coerce.date();
const durationSchema = z.number().int().positive().optional();

export const eventIdParamsSchema = z.object({
  id: z.uuid(),
});

export const createEventSchema = z.object({
  title: nameSchema,
  performerId: z.uuid(),
  performerName: nameSchema,
  venueId: z.uuid(),
  venueName: nameSchema,
  startsAt: dateSchema,
  doorsAt: dateSchema.optional(),
  durationMinutes: durationSchema,
  onSaleAt: dateSchema.optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
});

export const updateEventSchema = z
  .object({
    title: nameSchema.optional(),
    performerId: z.uuid().optional(),
    performerName: nameSchema.optional(),
    venueId: z.uuid().optional(),
    venueName: nameSchema.optional(),
    startsAt: dateSchema.optional(),
    doorsAt: dateSchema.optional(),
    durationMinutes: durationSchema,
    onSaleAt: dateSchema.optional(),
    status: eventStatusSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listEventsQuerySchema = z.object({
  status: eventStatusSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
