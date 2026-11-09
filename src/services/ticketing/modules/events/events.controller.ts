import type { Request, Response } from 'express';
import { EventsService } from '@/services/ticketing/modules/events/events.service.js';
import {
  createEventSchema,
  eventIdParamsSchema,
  listEventsQuerySchema,
  updateEventSchema,
} from '@/services/ticketing/modules/events/events.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

function tokenOf(req: Request): string {
  const token = req.authToken;

  if (!token) {
    throw new HttpError(401, 'missing_token', 'Authorization header is required');
  }

  return token;
}

export class EventsController {
  protected readonly service = new EventsService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createEventSchema, req.body);
    const event = await this.service.createEvent(body, tokenOf(req), req.requestId);

    res.status(201).location(`/api/events/${event.id}`).json({ data: event });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listEventsQuerySchema, req.query);
    const page = await this.service.listEvents(query);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(eventIdParamsSchema, req.params);
    const event = await this.service.getEventById(id);

    res.status(200).json({ data: event });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(eventIdParamsSchema, req.params);
    const body = validate(updateEventSchema, req.body);
    const event = await this.service.updateEvent(id, body, tokenOf(req), req.requestId);

    res.status(200).json({ data: event });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(eventIdParamsSchema, req.params);
    await this.service.deleteEvent(id);

    res.status(204).send();
  });
}
