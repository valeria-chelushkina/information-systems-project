import type { Request, Response } from 'express';
import { CheckInService } from '@/services/ticketing/modules/check-in/check-in.service.js';
import { ticketCheckInSchema } from '@/services/ticketing/modules/check-in/check-in.schemas.js';
import { asyncHandler } from '@/shared/http/async-handler.js';
import { validate } from '@/shared/http/validate.js';
import { HttpError } from '@/shared/errors/http-error.js';

export class CheckInController {
  protected readonly service = new CheckInService();

  checkIn = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;

    if (!user) {
      throw new HttpError(401, 'missing_token', 'Authorization header is required');
    }

    if (user.role !== 'admin' && user.role !== 'staff') {
      throw new HttpError(403, 'forbidden', 'Only staff can check tickets in');
    }

    const { qrToken } = validate(ticketCheckInSchema, req.body);
    const result = await this.service.checkIn(qrToken);

    res.status(200).json({ data: result });
  });
}
