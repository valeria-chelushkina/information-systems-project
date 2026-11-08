import type { Request, Response } from 'express';
import { BookingsService } from '@/services/catalog/modules/bookings/bookings.service.js';
import {
  bookingIdParamsSchema,
  createBookingSchema,
  decideBookingSchema,
  listBookingsQuerySchema,
} from '@/services/catalog/modules/bookings/bookings.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';

export class BookingsController {
  protected readonly service = new BookingsService();

  create = asyncHandler(async (req: Request, res: Response) => {
    const body = validate(createBookingSchema, req.body);
    const booking = await this.service.createBooking(body);

    res.status(201).location(`/api/bookings/${booking.id}`).json({ data: booking });
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = validate(listBookingsQuerySchema, req.query);
    const page = await this.service.listBookings(query);

    res.status(200).json({
      data: page.items,
      meta: { total: page.total, limit: page.limit, offset: page.offset },
    });
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(bookingIdParamsSchema, req.params);
    const booking = await this.service.getBookingById(id);

    res.status(200).json({ data: booking });
  });

  decide = asyncHandler(async (req: Request, res: Response) => {
    const { id } = validate(bookingIdParamsSchema, req.params);
    const body = validate(decideBookingSchema, req.body);
    const booking = await this.service.decideBooking(id, body);

    res.status(200).json({ data: booking });
  });
}
