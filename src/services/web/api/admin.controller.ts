import type { Request, Response } from 'express';
import { noContent, ok } from '@/services/web/api/respond.js';
import {
  accountCreateSchema,
  adminEventListQuerySchema,
  bookingDecisionSchema,
  bookingListQuerySchema,
  eventCreateSchema,
  eventStatusSchema,
  idParamsSchema,
  pageQuerySchema,
  performerCreateSchema,
  tierCreateSchema,
  tierUpdateSchema,
  venueCreateSchema,
} from '@/services/web/api/schemas.js';
import { AdminService } from '@/services/web/modules/admin/admin.service.js';
import {
  currentToken,
  currentUser,
} from '@/services/web/modules/session/session.middleware.js';
import { endOfKyivDay, localToUtc, optionalUtc, startOfKyivDay } from '@/services/web/lib/time.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

function requiredDate(value: string): Date {
  const date = localToUtc(value);

  if (!date) {
    throw HttpError.badRequest('validation_failed', 'Invalid date or time');
  }

  return date;
}

function optionalDate(value: string | undefined): Date | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  const date = optionalUtc(value);

  if (!date) {
    throw HttpError.badRequest('validation_failed', 'Invalid date or time');
  }

  return date;
}

export class AdminController {
  protected readonly service = new AdminService();

  dashboard = asyncHandler(async (_req: Request, res: Response) => {
    const token = currentToken(res);
    const data = await this.service.dashboard(token);

    ok(res, data);
  });

  events = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(adminEventListQuerySchema, req.query);
    const from = query.from ? startOfKyivDay(query.from) : null;
    const to = query.to ? endOfKyivDay(query.to) : null;

    if ((query.from && !from) || (query.to && !to)) {
      throw HttpError.badRequest('validation_failed', 'Invalid date filter');
    }

    const page = await this.service.listEvents(token, {
      status: query.status,
      search: query.search,
      performerId: query.performerId,
      from: from?.toISOString(),
      to: to?.toISOString(),
      limit: query.limit,
      offset: query.offset,
    });

    ok(res, page);
  });

  event = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const event = await this.service.getEvent(token, id);
    const tiers = await this.service.listTiers(token, id);

    ok(res, { event, tiers, transitions: this.service.transitionsFor(event) });
  });

  createEvent = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const body = validate(eventCreateSchema, req.body);
    const event = await this.service.createEvent(token, {
      title: body.title,
      performerId: body.performerId,
      venueId: body.venueId,
      startsAt: requiredDate(body.startsAt),
      doorsAt: optionalDate(body.doorsAt),
      durationMinutes: body.durationMinutes,
      status: body.status ?? 'draft',
    });

    ok(res, event, 201);
  });

  updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const body = validate(eventStatusSchema, req.body);
    const event = await this.service.updateStatus(token, id, body.status);

    ok(res, event);
  });

  deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    await this.service.deleteEvent(token, id);

    noContent(res);
  });

  createTier = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const body = validate(tierCreateSchema, req.body);
    const tier = await this.service.createTier(token, id, body);

    ok(res, tier, 201);
  });

  updateTier = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const body = validate(tierUpdateSchema, req.body);
    const tier = await this.service.updateTier(token, id, body);

    ok(res, tier);
  });

  deleteTier = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    await this.service.deleteTier(token, id);

    noContent(res);
  });

  performers = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(pageQuerySchema, req.query);
    const page = await this.service.listPerformers(token, query.limit, query.offset);

    ok(res, page);
  });

  createPerformer = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const body = validate(performerCreateSchema, req.body);
    const performer = await this.service.createPerformer(token, body);

    ok(res, performer, 201);
  });

  venues = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(pageQuerySchema, req.query);
    const page = await this.service.listVenues(token, query.limit, query.offset);

    ok(res, page);
  });

  createVenue = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const body = validate(venueCreateSchema, req.body);
    const venue = await this.service.createVenue(token, body);

    ok(res, venue, 201);
  });

  bookings = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(bookingListQuerySchema, req.query);
    const result = await this.service.listBookings(
      token,
      query.status,
      query.limit,
      query.offset,
    );

    ok(res, result);
  });

  decideBooking = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const body = validate(bookingDecisionSchema, req.body);
    const booking = await this.service.decideBooking(token, id, body.status, user);

    ok(res, booking);
  });

  order = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const order = await this.service.order(user, token, id);

    ok(res, order);
  });

  refundOrder = asyncHandler(async (req: Request, res: Response) => {
    const user = currentUser(res);
    const token = currentToken(res);
    const { id } = validate(idParamsSchema, req.params);
    const orderId = await this.service.refund(user, token, id);

    ok(res, { orderId });
  });

  users = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const query = validate(pageQuerySchema, req.query);
    const page = await this.service.listUsers(token, query.limit, query.offset);

    ok(res, page);
  });

  createUser = asyncHandler(async (req: Request, res: Response) => {
    const token = currentToken(res);
    const body = validate(accountCreateSchema, req.body);
    const user = await this.service.createUser(token, body);

    ok(res, user, 201);
  });
}
